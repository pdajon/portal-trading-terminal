import type {
  BaselineImportRequest,
  HyperliquidHistoricalOrderWire,
  HyperliquidLedgerUpdateWire,
  HyperliquidUserFillWire,
  HyperliquidUserFundingWire,
  ImportedFill,
  ImportedFundingRecord,
  ImportedLedgerUpdate,
  ImportedOrder,
} from "@/features/baseline-import/types";

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseInteger(value: unknown) {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function parseTimestamp(value: unknown) {
  const numeric = parseInteger(value);

  if (numeric !== null && numeric > 0) {
    return numeric;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  return Date.now();
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function normalizeSide(value: unknown): ImportedFill["side"] {
  if (value === "B" || value === "buy") {
    return "buy";
  }

  if (value === "A" || value === "sell") {
    return "sell";
  }

  return "unknown";
}

function inferSignedSize(side: ImportedFill["side"], size: number | null) {
  if (size === null) {
    return null;
  }

  if (side === "buy") {
    return size;
  }

  if (side === "sell") {
    return -size;
  }

  return null;
}

function normalizeOrderType(value: unknown): ImportedOrder["orderType"] {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("market")) {
    return "market";
  }

  if (normalized.includes("limit")) {
    return "limit";
  }

  if (normalized.includes("trigger") || normalized.includes("stop") || normalized.includes("take")) {
    return "trigger";
  }

  return "unknown";
}

function normalizeLedgerKind(value: unknown): ImportedLedgerUpdate["kind"] {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("deposit")) {
    return "deposit";
  }

  if (normalized.includes("withdraw")) {
    return "withdrawal";
  }

  if (normalized.includes("transfer")) {
    return "transfer";
  }

  return "unknown";
}

export function normalizeUserFills(records: HyperliquidUserFillWire[], request: BaselineImportRequest): ImportedFill[] {
  return records.map((record, index) => {
    const size = parseNumber(record.sz);
    const side = normalizeSide(record.side);
    const time = parseTimestamp(record.time);
    const orderId = parseInteger(record.oid);
    const tradeId = parseInteger(record.tid);

    return {
      accountAddress: request.accountAddress,
      closedPnl: parseNumber(record.closedPnl) ?? 0,
      coin: typeof record.coin === "string" ? record.coin : "UNKNOWN",
      crossed: parseBoolean(record.crossed),
      dirRaw: typeof record.dir === "string" ? record.dir : null,
      environment: request.environment,
      fee: parseNumber(record.fee) ?? 0,
      feeToken: typeof record.feeToken === "string" ? record.feeToken : null,
      hash: typeof record.hash === "string" ? record.hash : null,
      id: `fill-${request.environment}-${request.accountAddress}-${orderId ?? "no-order"}-${tradeId ?? index}-${time}`,
      orderId,
      price: parseNumber(record.px),
      raw: record,
      side,
      signedSize: inferSignedSize(side, size),
      size,
      startPosition: parseNumber(record.startPosition),
      time,
      timestamp: new Date(time).toISOString(),
      tradeId,
    };
  });
}

export function normalizeHistoricalOrders(
  records: HyperliquidHistoricalOrderWire[],
  request: BaselineImportRequest,
): ImportedOrder[] {
  return records.map((record, index) => {
    const nestedOrder =
      typeof record.order === "object" && record.order !== null ? (record.order as Record<string, unknown>) : null;
    const source = nestedOrder ?? record;
    const time = source.timestamp === undefined ? null : parseTimestamp(source.timestamp);
    const statusTime = record.statusTimestamp === undefined ? null : parseTimestamp(record.statusTimestamp);
    const orderId = parseInteger(source.oid);
    const orderType = normalizeOrderType(source.orderType);
    const isTrigger = parseBoolean(source.isTrigger) ?? orderType === "trigger";

    return {
      accountAddress: request.accountAddress,
      coin: typeof source.coin === "string" ? source.coin : "UNKNOWN",
      environment: request.environment,
      id: `order-${request.environment}-${request.accountAddress}-${orderId ?? index}`,
      isPositionTpsl: parseBoolean(source.isPositionTpsl) ?? false,
      isTrigger,
      limitPrice: parseNumber((source as { limitPx?: unknown }).limitPx ?? source.triggerPx),
      orderId,
      orderType,
      originalSize: parseNumber(source.origSz ?? (source as { sz?: unknown }).sz),
      raw: record,
      reduceOnly: parseBoolean(source.reduceOnly) ?? false,
      side: normalizeSide(source.side),
      status: typeof record.status === "string" ? record.status : null,
      statusTime,
      statusTimestamp: statusTime === null ? null : new Date(statusTime).toISOString(),
      tif: typeof source.tif === "string" ? source.tif : null,
      time,
      timestamp: time === null ? null : new Date(time).toISOString(),
      triggerCondition: typeof source.triggerCondition === "string" ? source.triggerCondition : null,
      triggerPrice: parseNumber(source.triggerPx),
    };
  });
}

export function normalizeUserFunding(
  records: HyperliquidUserFundingWire[],
  request: BaselineImportRequest,
): ImportedFundingRecord[] {
  return records.map((record, index) => {
    const time = parseTimestamp(record.time);

    return {
      accountAddress: request.accountAddress,
      coin: typeof record.coin === "string" ? record.coin : "UNKNOWN",
      delta: parseNumber(record.delta) ?? 0,
      environment: request.environment,
      hash: typeof record.hash === "string" ? record.hash : null,
      id: `funding-${request.environment}-${request.accountAddress}-${index}-${time}`,
      raw: record,
      time,
      timestamp: new Date(time).toISOString(),
    };
  });
}

export function normalizeLedgerUpdates(
  records: HyperliquidLedgerUpdateWire[],
  request: BaselineImportRequest,
): ImportedLedgerUpdate[] {
  return records.map((record, index) => {
    const time = parseTimestamp(record.time);

    return {
      accountAddress: request.accountAddress,
      delta: parseNumber(record.delta),
      environment: request.environment,
      hash: typeof record.hash === "string" ? record.hash : null,
      id: `ledger-${request.environment}-${request.accountAddress}-${index}-${time}`,
      kind: normalizeLedgerKind(record.type),
      raw: record,
      time,
      timestamp: new Date(time).toISOString(),
      token: typeof record.token === "string" ? record.token : null,
    };
  });
}
