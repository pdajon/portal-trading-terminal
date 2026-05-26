import { buildBaselineProfile } from "@/features/baseline-import/build-baseline-profile";
import {
  normalizeLedgerUpdates,
  normalizeUserFills,
  normalizeUserFunding,
} from "@/features/baseline-import/normalize-import";
import { reconstructImportedTrades } from "@/features/baseline-import/reconstruct-trades";
import { buildSessionIntelligence } from "@/features/baseline-import/session-intelligence";
import type {
  BaselineDataQualityWarning,
  BaselineImportRequest,
  BaselineImportScanResult,
  HyperliquidLedgerUpdateWire,
  HyperliquidUserFillWire,
  HyperliquidUserFundingWire,
} from "@/features/baseline-import/types";
import { resolvePortalTimezone } from "@/features/time/portal-time";
import type { HyperliquidEnvironment } from "@/lib/hyperliquid/types";

export type ManualHistoryImportFileInput = {
  name: string;
  text: string;
};

export type ManualHistoryImportFileSummary = {
  acceptedRows: number;
  detectedColumns: string[];
  duplicateRows: number;
  name: string;
  rejectedRows: number;
  rowCount: number;
  type: "trades" | "funding" | "ledger" | "mixed" | "unsupported";
};

export type ManualHistoryImportSourceQuality = {
  confidence: "high" | "medium" | "low";
  limitations: string[];
  missingFields: string[];
  readiness: "directional_only" | "ready_for_review" | "unsafe_not_enough_evidence";
  unsupportedRows: number;
};

export type ManualHistoryImportParseResult = {
  accountAddress: string;
  detectedDateRange: {
    endTime: number;
    startTime: number;
  } | null;
  environment: HyperliquidEnvironment;
  files: ManualHistoryImportFileSummary[];
  rawRecords: {
    ledgerUpdates: HyperliquidLedgerUpdateWire[];
    userFills: HyperliquidUserFillWire[];
    userFunding: HyperliquidUserFundingWire[];
  };
  rowCounts: {
    accepted: number;
    duplicates: number;
    rejected: number;
    total: number;
  };
  sourceQuality: ManualHistoryImportSourceQuality;
  timezone: string;
  warnings: BaselineDataQualityWarning[];
};

export type ManualHistoryImportResult = {
  parseResult: ManualHistoryImportParseResult;
  request: BaselineImportRequest;
  scanResult: BaselineImportScanResult;
};

export type ManualHistoryImportDebugOutput = {
  kind: "portal-manual-history-import-debug";
  outputPath: ".portal/audits/manual-history-import-latest.json";
  accountAddress: string;
  environment: HyperliquidEnvironment;
  timezone: string;
  uploadedFiles: ManualHistoryImportFileSummary[];
  rowCounts: ManualHistoryImportParseResult["rowCounts"];
  detectedDateRange: ManualHistoryImportParseResult["detectedDateRange"];
  detectedColumns: Record<string, string[]>;
  acceptedRejectedRows: {
    accepted: number;
    duplicates: number;
    rejected: number;
    unsupported: number;
  };
  warnings: BaselineDataQualityWarning[];
  reconstruction: {
    closedTradeCount: number;
    openTradeCount: number;
    reconstructedSessionCount: number;
    reconstructedTradeCount: number;
  };
  sourceQuality: ManualHistoryImportSourceQuality;
  confidenceDistribution: Record<"high" | "medium" | "low", number>;
  readinessDistribution: Record<
    "directional_only" | "ready_for_review" | "unsafe_not_enough_evidence",
    number
  >;
  evidenceRules: {
    importedHistoricalBaseline: true;
    journalNativeEvidence: false;
    diagnosisGradeByDefault: false;
    recommendedUse: "supporting_directional_context";
  };
};

const MANUAL_UPLOAD_ACCOUNT_ADDRESS =
  "manual-upload-history-source";
const DEFAULT_UPLOAD_START_TIME = Date.parse("1970-01-01T00:00:00.000Z");

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(/[$,%]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseTimestamp(value: unknown) {
  const numeric = parseNumber(value);

  if (numeric !== null && numeric > 0) {
    return numeric > 9_999_999_999 ? Math.trunc(numeric) : Math.trunc(numeric * 1000);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { columns: [], rows: [] as Record<string, unknown>[] };
  }

  const rawHeaders = splitCsvLine(lines[0] ?? "");
  const headers = rawHeaders.map(normalizeHeader);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce<Record<string, unknown>>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });

  return {
    columns: rawHeaders.map((header) => header.trim()).filter(Boolean),
    rows,
  };
}

function getField(row: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];

    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function normalizeSide(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["b", "buy", "long"].includes(normalized)) {
    return "B";
  }

  if (["a", "sell", "short"].includes(normalized)) {
    return "A";
  }

  return value;
}

function rowLooksLikeFunding(row: Record<string, unknown>) {
  return (
    getField(row, ["funding", "fundingDelta", "fundingPayment"]) !== undefined ||
    (getField(row, ["delta", "amount"]) !== undefined &&
      `${getField(row, ["type", "kind", "category"]) ?? ""}`
        .toLowerCase()
        .includes("fund"))
  );
}

function rowLooksLikeLedger(row: Record<string, unknown>) {
  const type = `${getField(row, ["type", "kind", "category", "action"]) ?? ""}`.toLowerCase();
  return (
    type.includes("deposit") ||
    type.includes("withdraw") ||
    type.includes("transfer")
  );
}

function mapFillRow(row: Record<string, unknown>) {
  const time = parseTimestamp(getField(row, ["time", "timestamp", "date", "datetime", "createdAt"]));
  const coin = getField(row, ["coin", "asset", "symbol", "market"]);
  const price = getField(row, ["px", "price", "fillPrice"]);
  const size = getField(row, ["sz", "size", "quantity", "qty"]);

  if (time === null || coin === undefined || price === undefined || size === undefined) {
    return null;
  }

  const side = normalizeSide(getField(row, ["side", "directionSide"]));

  return {
    closedPnl: getField(row, ["closedPnl", "closedPnlUsd", "realizedPnl", "pnl"]) ?? "0",
    coin,
    crossed: getField(row, ["crossed", "taker"]),
    dir: getField(row, ["dir", "direction", "tradeDirection"]),
    fee: getField(row, ["fee", "fees", "feeUsd"]) ?? "0",
    feeToken: getField(row, ["feeToken", "feeCurrency", "feeAsset"]) ?? "USDC",
    hash: getField(row, ["hash", "txHash", "transactionHash"]),
    oid: getField(row, ["oid", "orderId", "orderID"]),
    px: price,
    side,
    startPosition: getField(row, ["startPosition", "startPos", "start_position"]),
    sz: size,
    tid: getField(row, ["tid", "tradeId", "tradeID", "fillId"]),
    time,
  } satisfies HyperliquidUserFillWire;
}

function mapFundingRow(row: Record<string, unknown>) {
  const time = parseTimestamp(getField(row, ["time", "timestamp", "date", "datetime", "createdAt"]));
  const coin = getField(row, ["coin", "asset", "symbol", "market"]);
  const delta =
    getField(row, ["delta", "amount", "funding", "fundingDelta", "fundingPayment"]) ?? undefined;

  if (time === null || coin === undefined || delta === undefined) {
    return null;
  }

  return {
    coin,
    delta,
    hash: getField(row, ["hash", "txHash", "transactionHash"]),
    time,
  } satisfies HyperliquidUserFundingWire;
}

function mapLedgerRow(row: Record<string, unknown>) {
  const time = parseTimestamp(getField(row, ["time", "timestamp", "date", "datetime", "createdAt"]));
  const delta = getField(row, ["delta", "amount", "netAmount"]);
  const type = getField(row, ["type", "kind", "category", "action"]);

  if (time === null || delta === undefined || type === undefined) {
    return null;
  }

  return {
    delta,
    hash: getField(row, ["hash", "txHash", "transactionHash"]),
    time,
    token: getField(row, ["token", "currency", "asset"]) ?? "USDC",
    type,
  } satisfies HyperliquidLedgerUpdateWire;
}

function parseJsonRows(parsed: unknown) {
  if (Array.isArray(parsed)) {
    return {
      columns: Array.from(
        new Set(
          parsed.flatMap((row) =>
            row && typeof row === "object" && !Array.isArray(row)
              ? Object.keys(row)
              : [],
          ),
        ),
      ),
      rows: parsed as Record<string, unknown>[],
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return { columns: [], rows: [] as Record<string, unknown>[] };
  }

  const container = parsed as Record<string, unknown>;
  const rows = ["fills", "trades", "tradeHistory", "funding", "fundingHistory", "ledger", "ledgerUpdates"]
    .flatMap((key) => {
      const value = container[key];
      if (!Array.isArray(value)) {
        return [];
      }
      return value.map((row) =>
        row && typeof row === "object" && !Array.isArray(row)
          ? ({ ...row, __manualSourceHint: key } as Record<string, unknown>)
          : row,
      );
    })
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));

  return {
    columns: Array.from(new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== "__manualSourceHint")))),
    rows,
  };
}

function parseFileRows(file: ManualHistoryImportFileInput) {
  const trimmedText = file.text.trim();

  if (file.name.toLowerCase().endsWith(".json") || trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
    try {
      return parseJsonRows(JSON.parse(trimmedText));
    } catch {
      return { columns: [], rows: [] as Record<string, unknown>[] };
    }
  }

  return parseCsv(trimmedText);
}

function inferFileType(name: string, rows: Record<string, unknown>[]): ManualHistoryImportFileSummary["type"] {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("funding")) {
    return "funding";
  }

  if (
    lowerName.includes("deposit") ||
    lowerName.includes("withdraw") ||
    lowerName.includes("ledger")
  ) {
    return "ledger";
  }

  if (lowerName.includes("trade") || lowerName.includes("fill")) {
    return "trades";
  }

  const hints = new Set(rows.map((row) => `${row.__manualSourceHint ?? ""}`.toLowerCase()));

  if ([...hints].some((hint) => hint.includes("funding"))) {
    return "funding";
  }

  if ([...hints].some((hint) => hint.includes("ledger"))) {
    return "ledger";
  }

  if ([...hints].some((hint) => hint.includes("fill") || hint.includes("trade"))) {
    return "trades";
  }

  return rows.length > 0 ? "mixed" : "unsupported";
}

function buildRecordKey(kind: string, record: Record<string, unknown>) {
  return [
    kind,
    record.time,
    record.coin,
    record.oid,
    record.tid,
    record.px,
    record.sz,
    record.delta,
    record.type,
  ].join(":");
}

function buildWarnings(input: {
  duplicateRows: number;
  missingFields: string[];
  rejectedRows: number;
}) {
  const warnings: BaselineDataQualityWarning[] = [
    {
      code: "manual-upload-source-quality-directional-only",
      detail:
        "Uploaded history is Imported Historical Baseline context. It remains directional and is not native Journal evidence or diagnosis-grade by default.",
      severity: "info",
    },
  ];

  if (input.missingFields.length > 0) {
    warnings.push({
      code: "manual-upload-missing-fields",
      detail: `Missing source coverage: ${input.missingFields.join(", ")}.`,
      severity: "warning",
    });
  }

  if (input.missingFields.includes("funding history")) {
    warnings.push({
      code: "manual-upload-incomplete-funding-coverage",
      detail:
        "Funding history was not detected. Session and PnL attribution may omit hourly funding payments.",
      severity: "warning",
    });
  }

  if (input.rejectedRows > 0) {
    warnings.push({
      code: "manual-upload-unsupported-rows",
      detail: `${input.rejectedRows} uploaded rows were unsupported or missing required fields.`,
      severity: "warning",
    });
  }

  if (input.duplicateRows > 0) {
    warnings.push({
      code: "manual-upload-duplicates",
      detail: `${input.duplicateRows} duplicate uploaded rows were ignored.`,
      severity: "info",
    });
  }

  return warnings;
}

export function parseManualHistoryImportFiles(input: {
  accountAddress?: string;
  environment?: HyperliquidEnvironment;
  files: ManualHistoryImportFileInput[];
  timezone?: string;
}): ManualHistoryImportParseResult {
  const accountAddress = input.accountAddress?.trim() || MANUAL_UPLOAD_ACCOUNT_ADDRESS;
  const environment = input.environment ?? "mainnet";
  const timezone = resolvePortalTimezone(input.timezone);
  const seenRows = new Set<string>();
  const userFills: HyperliquidUserFillWire[] = [];
  const userFunding: HyperliquidUserFundingWire[] = [];
  const ledgerUpdates: HyperliquidLedgerUpdateWire[] = [];
  const fileSummaries: ManualHistoryImportFileSummary[] = [];
  let totalRows = 0;
  let acceptedRows = 0;
  let rejectedRows = 0;
  let duplicateRows = 0;
  const timestamps: number[] = [];

  for (const file of input.files) {
    const parsed = parseFileRows(file);
    const fileType = inferFileType(file.name, parsed.rows);
    let fileAcceptedRows = 0;
    let fileRejectedRows = 0;
    let fileDuplicateRows = 0;

    for (const row of parsed.rows) {
      totalRows += 1;
      let mappedKind: "fill" | "funding" | "ledger" | null = null;
      let mappedRecord:
        | HyperliquidUserFillWire
        | HyperliquidUserFundingWire
        | HyperliquidLedgerUpdateWire
        | null = null;

      if (fileType === "funding" || rowLooksLikeFunding(row)) {
        mappedKind = "funding";
        mappedRecord = mapFundingRow(row);
      } else if (fileType === "ledger" || rowLooksLikeLedger(row)) {
        mappedKind = "ledger";
        mappedRecord = mapLedgerRow(row);
      } else {
        mappedKind = "fill";
        mappedRecord = mapFillRow(row);
      }

      if (!mappedRecord || !mappedKind) {
        rejectedRows += 1;
        fileRejectedRows += 1;
        continue;
      }

      const rowKey = buildRecordKey(mappedKind, mappedRecord as Record<string, unknown>);

      if (seenRows.has(rowKey)) {
        duplicateRows += 1;
        fileDuplicateRows += 1;
        continue;
      }

      seenRows.add(rowKey);
      acceptedRows += 1;
      fileAcceptedRows += 1;
      const time = parseTimestamp((mappedRecord as { time?: unknown }).time);

      if (time !== null) {
        timestamps.push(time);
      }

      if (mappedKind === "fill") {
        userFills.push(mappedRecord as HyperliquidUserFillWire);
      } else if (mappedKind === "funding") {
        userFunding.push(mappedRecord as HyperliquidUserFundingWire);
      } else {
        ledgerUpdates.push(mappedRecord as HyperliquidLedgerUpdateWire);
      }
    }

    fileSummaries.push({
      acceptedRows: fileAcceptedRows,
      detectedColumns: parsed.columns,
      duplicateRows: fileDuplicateRows,
      name: file.name,
      rejectedRows: fileRejectedRows,
      rowCount: parsed.rows.length,
      type: fileType,
    });
  }

  const missingFields = [
    userFills.length === 0 ? "trade history" : null,
    userFunding.length === 0 ? "funding history" : null,
    ledgerUpdates.length === 0 ? "deposits/withdrawals" : null,
  ].filter((field): field is string => field !== null);
  const confidence: ManualHistoryImportSourceQuality["confidence"] =
    userFills.length === 0 || acceptedRows === 0
      ? "low"
      : missingFields.length === 0 && rejectedRows === 0
        ? "high"
        : "medium";
  const readiness: ManualHistoryImportSourceQuality["readiness"] =
    userFills.length === 0
      ? "unsafe_not_enough_evidence"
      : "directional_only";
  const limitations = [
    "Uploaded history remains Imported Historical Baseline context only.",
    "Portal does not promote uploads into native Journal evidence.",
    ...(missingFields.length > 0
      ? [`Missing coverage: ${missingFields.join(", ")}.`]
      : []),
  ];
  const warnings = buildWarnings({
    duplicateRows,
    missingFields,
    rejectedRows,
  });

  return {
    accountAddress,
    detectedDateRange:
      timestamps.length > 0
        ? {
            endTime: Math.max(...timestamps),
            startTime: Math.min(...timestamps),
          }
        : null,
    environment,
    files: fileSummaries,
    rawRecords: {
      ledgerUpdates,
      userFills,
      userFunding,
    },
    rowCounts: {
      accepted: acceptedRows,
      duplicates: duplicateRows,
      rejected: rejectedRows,
      total: totalRows,
    },
    sourceQuality: {
      confidence,
      limitations,
      missingFields,
      readiness,
      unsupportedRows: rejectedRows,
    },
    timezone,
    warnings,
  };
}

export function runManualHistoryImportFromFiles(input: {
  accountAddress?: string;
  environment?: HyperliquidEnvironment;
  files: ManualHistoryImportFileInput[];
  timezone?: string;
}): ManualHistoryImportResult {
  const parseResult = parseManualHistoryImportFiles(input);
  const request: BaselineImportRequest = {
    accountAddress: parseResult.accountAddress,
    endTime:
      parseResult.detectedDateRange?.endTime ??
      Date.parse("1970-01-01T23:59:59.999Z"),
    environment: parseResult.environment,
    startTime:
      parseResult.detectedDateRange?.startTime ?? DEFAULT_UPLOAD_START_TIME,
    timezone: parseResult.timezone,
  };
  const fills = normalizeUserFills(parseResult.rawRecords.userFills, request);
  const funding = normalizeUserFunding(parseResult.rawRecords.userFunding, request);
  const ledgerUpdates = normalizeLedgerUpdates(parseResult.rawRecords.ledgerUpdates, request);
  const reconstructed = reconstructImportedTrades({
    fills,
    funding,
    orders: [],
    request,
  });
  const profile = buildBaselineProfile({
    accountSnapshot: null,
    funding,
    ledgerUpdates,
    orders: [],
    request,
    sessionWarnings: [...reconstructed.warnings, ...parseResult.warnings],
    trades: reconstructed.trades,
    userFills: fills,
  });
  const warnings = Array.from(
    new Map(
      [...profile.dataQuality, ...parseResult.warnings].map((warning) => [
        `${warning.code}:${warning.detail}`,
        warning,
      ]),
    ).values(),
  );
  const sourceHealth = {
    aggregatedFillCount: fills.length,
    boundaryFillCount: reconstructed.boundaryFillCount,
    recommendationTradeCount: reconstructed.trades.length,
  };
  const sessionIntelligence = buildSessionIntelligence({
    request,
    sourceHealth,
    trades: reconstructed.trades,
    warnings,
  });

  return {
    parseResult,
    request,
    scanResult: {
      accountSnapshot: null,
      fills,
      funding,
      ledgerUpdates,
      orders: [],
      profile: {
        ...profile,
        dataQuality: warnings,
      },
      sessions: reconstructed.sessions,
      sessionIntelligence,
      sourceHealth,
      trades: reconstructed.trades,
      warnings,
    },
  };
}

export function buildManualHistoryImportDebugOutput(
  result: ManualHistoryImportResult,
): ManualHistoryImportDebugOutput {
  const closedTradeCount = result.scanResult.trades.filter(
    (trade) => trade.status === "closed",
  ).length;
  const openTradeCount = result.scanResult.trades.filter(
    (trade) => trade.status === "open",
  ).length;

  return {
    accountAddress: result.request.accountAddress,
    acceptedRejectedRows: {
      accepted: result.parseResult.rowCounts.accepted,
      duplicates: result.parseResult.rowCounts.duplicates,
      rejected: result.parseResult.rowCounts.rejected,
      unsupported: result.parseResult.sourceQuality.unsupportedRows,
    },
    confidenceDistribution: {
      high: result.parseResult.sourceQuality.confidence === "high" ? 1 : 0,
      low: result.parseResult.sourceQuality.confidence === "low" ? 1 : 0,
      medium: result.parseResult.sourceQuality.confidence === "medium" ? 1 : 0,
    },
    detectedColumns: Object.fromEntries(
      result.parseResult.files.map((file) => [file.name, file.detectedColumns]),
    ),
    detectedDateRange: result.parseResult.detectedDateRange,
    environment: result.request.environment,
    evidenceRules: {
      diagnosisGradeByDefault: false,
      importedHistoricalBaseline: true,
      journalNativeEvidence: false,
      recommendedUse: "supporting_directional_context",
    },
    kind: "portal-manual-history-import-debug",
    outputPath: ".portal/audits/manual-history-import-latest.json",
    readinessDistribution: {
      directional_only:
        result.parseResult.sourceQuality.readiness === "directional_only"
          ? 1
          : 0,
      ready_for_review:
        result.parseResult.sourceQuality.readiness === "ready_for_review"
          ? 1
          : 0,
      unsafe_not_enough_evidence:
        result.parseResult.sourceQuality.readiness ===
        "unsafe_not_enough_evidence"
          ? 1
          : 0,
    },
    reconstruction: {
      closedTradeCount,
      openTradeCount,
      reconstructedSessionCount:
        result.scanResult.sessionIntelligence?.summary.sessionCount ??
        result.scanResult.sessions.length,
      reconstructedTradeCount: result.scanResult.trades.length,
    },
    rowCounts: result.parseResult.rowCounts,
    sourceQuality: result.parseResult.sourceQuality,
    timezone: result.request.timezone,
    uploadedFiles: result.parseResult.files,
    warnings: result.scanResult.warnings,
  };
}
