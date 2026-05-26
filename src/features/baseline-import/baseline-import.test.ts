import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildBaselineProfile,
  buildHyperliquidPnlReconciliationDebugOutput,
  buildInsightBaselineDebugOutput,
  buildManualHistoryImportDebugOutput,
  buildTradeReconstructionDebugOutput,
  createStoredBaselineImportBundleId,
  deleteStoredBaselineImportBundle,
  estimateStoredBaselineImportBundlesSizeBytes,
  fetchUserFillsByTime,
  formatBaselineSourceWalletAddress,
  loadStoredBaselineImportBundlesFromLocalStore,
  parseStoredBaselineImportManifest,
  normalizeHistoricalOrders,
  normalizeLedgerUpdates,
  normalizeUserFills,
  normalizeUserFunding,
  parseManualHistoryImportFiles,
  parseStoredBaselineImportBundles,
  persistStoredBaselineImportBundlesToLocalStore,
  reconstructImportedTrades,
  runManualHistoryImportFromFiles,
  runHistoricalBaselineScanFromRecords,
  serializeStoredBaselineImportManifest,
  serializeStoredBaselineImportBundles,
  type BaselineImportRequest,
  type HyperliquidHistoricalOrderWire,
  type HyperliquidLedgerUpdateWire,
  type HyperliquidUserFillWire,
  type HyperliquidUserFundingWire,
  type ImportedFill,
  type ImportedTrade,
  type StoredBaselineImportBundle,
  type BaselineImportPayloadStore,
} from "@/features/baseline-import";

const REQUEST: BaselineImportRequest = {
  accountAddress: "0x1111111111111111111111111111111111111111",
  endTime: Date.parse("2026-04-28T15:00:00.000Z"),
  environment: "mainnet",
  startTime: Date.parse("2026-04-28T00:00:00.000Z"),
  timezone: "America/Chicago",
};

function createFill(overrides: Partial<HyperliquidUserFillWire>): HyperliquidUserFillWire {
  return {
    closedPnl: "0",
    coin: "BTC",
    crossed: false,
    dir: "Open Long",
    fee: "0.15",
    feeToken: "USDC",
    hash: "0xhash",
    oid: 1,
    px: "100000",
    side: "B",
    startPosition: "0",
    sz: "0.01",
    tid: 1,
    time: Date.parse("2026-04-28T12:00:00.000Z"),
    ...overrides,
  };
}

function normalizeFillRecords(fills: HyperliquidUserFillWire[]) {
  return normalizeUserFills(fills, REQUEST);
}

function createImportedTrade(overrides: Partial<ImportedTrade> = {}): ImportedTrade {
  return {
    accountAddress: REQUEST.accountAddress,
    addFills: [],
    closeFills: [],
    coin: "BTC",
    direction: "long",
    durationMinutes: 30,
    endTime: Date.parse("2026-04-28T14:30:00.000Z"),
    entryPrice: 100,
    entryStyleProxy: "likely-chased",
    entryTime: Date.parse("2026-04-28T14:00:00.000Z"),
    environment: REQUEST.environment,
    executionClosedPnl: 10,
    executionMode: "market",
    exitPrice: 110,
    fundingPnl: 0,
    grossFees: 0.3,
    id: "trade-1",
    maxSize: 1,
    netPnl: 10,
    openFills: [],
    orderIds: [],
    rawOrderMatches: [],
    reconstructionConfidence: "high",
    reduceFills: [],
    sessionId: "session-1",
    sourceLabel: "Historical Import",
    status: "closed",
    ...overrides,
  };
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function createMemoryPayloadStore(): BaselineImportPayloadStore {
  const payloads = new Map<string, StoredBaselineImportBundle>();

  return {
    async clear() {
      payloads.clear();
    },
    async delete(ids) {
      for (const id of ids) {
        payloads.delete(id);
      }
    },
    async get(keys) {
      return keys
        .map((key) => payloads.get(key) ?? null)
        .filter((bundle): bundle is StoredBaselineImportBundle => bundle !== null);
    },
    async put(bundles) {
      for (const bundle of bundles) {
        payloads.set(bundle.id, bundle);
      }
    },
  };
}

test("normalizes fills with raw payload preservation", () => {
  const fills = normalizeUserFills(
    [
      createFill({
        closedPnl: "-2.5",
        fee: "0.42",
        oid: 12,
        px: "94321.5",
        startPosition: "0.02",
        sz: "0.005",
        tid: 88,
      }),
    ],
    REQUEST,
  );

  assert.equal(fills.length, 1);
  assert.equal(fills[0]?.orderId, 12);
  assert.equal(fills[0]?.tradeId, 88);
  assert.equal(fills[0]?.price, 94321.5);
  assert.equal(fills[0]?.size, 0.005);
  assert.equal(fills[0]?.closedPnl, -2.5);
  assert.equal(fills[0]?.fee, 0.42);
  assert.equal(fills[0]?.raw.oid, 12);
});

test("manual history import parses Hyperliquid trade, funding, and ledger CSV files", () => {
  const parsed = parseManualHistoryImportFiles({
    accountAddress: REQUEST.accountAddress,
    environment: "mainnet",
    files: [
      {
        name: "Trade History.csv",
        text:
          "time,coin,side,dir,px,sz,fee,feeToken,closedPnl,oid,tid,startPosition\n" +
          "2026-04-28T12:00:00.000Z,BTC,B,Open Long,100000,0.01,0.15,USDC,0,101,501,0\n" +
          "2026-04-28T12:30:00.000Z,BTC,A,Close Long,100500,0.01,0.15,USDC,5,102,502,0.01\n",
      },
      {
        name: "Funding History.csv",
        text: "time,coin,delta\n2026-04-28T13:00:00.000Z,BTC,-0.25\n",
      },
      {
        name: "Deposits Withdrawals.csv",
        text: "time,type,token,delta\n2026-04-28T11:00:00.000Z,deposit,USDC,1000\n",
      },
    ],
    timezone: "America/Chicago",
  });

  assert.equal(parsed.files.length, 3);
  assert.equal(parsed.rowCounts.total, 4);
  assert.equal(parsed.rowCounts.accepted, 4);
  assert.equal(parsed.rawRecords.userFills.length, 2);
  assert.equal(parsed.rawRecords.userFunding.length, 1);
  assert.equal(parsed.rawRecords.ledgerUpdates.length, 1);
  assert.deepEqual(parsed.detectedDateRange, {
    endTime: Date.parse("2026-04-28T13:00:00.000Z"),
    startTime: Date.parse("2026-04-28T11:00:00.000Z"),
  });
  assert.deepEqual(parsed.sourceQuality.missingFields, []);
  assert.equal(parsed.sourceQuality.readiness, "directional_only");
  assert.equal(parsed.sourceQuality.confidence, "high");
});

test("manual history import parses JSON arrays and flags unsupported duplicate or incomplete rows", () => {
  const parsed = parseManualHistoryImportFiles({
    accountAddress: REQUEST.accountAddress,
    environment: "mainnet",
    files: [
      {
        name: "hyperliquid-history.json",
        text: JSON.stringify({
          fills: [
            {
              coin: "ETH",
              closedPnl: "0",
              dir: "Open Short",
              fee: "0.1",
              oid: 1,
              px: "3000",
              side: "A",
              startPosition: "0",
              sz: "0.2",
              tid: 10,
              time: Date.parse("2026-04-28T12:00:00.000Z"),
            },
            {
              coin: "ETH",
              closedPnl: "0",
              dir: "Open Short",
              fee: "0.1",
              oid: 1,
              px: "3000",
              side: "A",
              startPosition: "0",
              sz: "0.2",
              tid: 10,
              time: Date.parse("2026-04-28T12:00:00.000Z"),
            },
            {
              note: "not a fill",
            },
          ],
        }),
      },
    ],
    timezone: "America/Chicago",
  });

  assert.equal(parsed.rowCounts.total, 3);
  assert.equal(parsed.rowCounts.accepted, 1);
  assert.equal(parsed.rowCounts.duplicates, 1);
  assert.equal(parsed.rowCounts.rejected, 1);
  assert.deepEqual(parsed.sourceQuality.missingFields, [
    "funding history",
    "deposits/withdrawals",
  ]);
  assert.ok(
    parsed.warnings.some(
      (warning) => warning.code === "manual-upload-duplicates",
    ),
  );
  assert.ok(
    parsed.warnings.some(
      (warning) => warning.code === "manual-upload-unsupported-rows",
    ),
  );
  assert.ok(
    parsed.warnings.some(
      (warning) =>
        warning.code === "manual-upload-incomplete-funding-coverage",
    ),
  );
});

test("manual history import builds reconstructed trades and directional session context", () => {
  const result = runManualHistoryImportFromFiles({
    accountAddress: REQUEST.accountAddress,
    environment: "mainnet",
    files: [
      {
        name: "Trade History.csv",
        text:
          "time,coin,side,dir,px,sz,fee,closedPnl,oid,tid,startPosition\n" +
          "2026-04-28T12:00:00.000Z,BTC,B,Open Long,100000,0.01,0.15,0,101,501,0\n" +
          "2026-04-28T12:30:00.000Z,BTC,A,Close Long,100500,0.01,0.15,5,102,502,0.01\n",
      },
    ],
    timezone: "America/Chicago",
  });

  assert.equal(result.scanResult.trades.length, 1);
  assert.equal(result.scanResult.trades[0]?.status, "closed");
  assert.equal(result.scanResult.sessionIntelligence?.summary.sessionCount, 1);
  assert.ok(
    result.scanResult.warnings.some(
      (warning) =>
        warning.code === "manual-upload-source-quality-directional-only",
    ),
  );
});

test("manual history import debug output includes row validation and readiness distribution", () => {
  const result = runManualHistoryImportFromFiles({
    accountAddress: REQUEST.accountAddress,
    environment: "mainnet",
    files: [
      {
        name: "Trade History.csv",
        text:
          "time,coin,side,dir,px,sz,fee,closedPnl,oid,tid,startPosition\n" +
          "2026-04-28T12:00:00.000Z,BTC,B,Open Long,100000,0.01,0.15,0,101,501,0\n" +
          "2026-04-28T12:30:00.000Z,BTC,A,Close Long,100500,0.01,0.15,5,102,502,0.01\n",
      },
    ],
    timezone: "America/Chicago",
  });
  const debugOutput = buildManualHistoryImportDebugOutput(result);

  assert.equal(debugOutput.kind, "portal-manual-history-import-debug");
  assert.equal(debugOutput.outputPath, ".portal/audits/manual-history-import-latest.json");
  assert.equal(debugOutput.uploadedFiles[0]?.name, "Trade History.csv");
  assert.equal(debugOutput.rowCounts.accepted, 2);
  assert.equal(debugOutput.reconstruction.closedTradeCount, 1);
  assert.equal(debugOutput.sourceQuality.readiness, "directional_only");
  assert.equal(debugOutput.readinessDistribution.directional_only, 1);
  assert.equal(JSON.stringify(debugOutput).includes("privateKey"), false);
});

test("manual history import audit writer targets the latest debug output path", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  const writerSource = readFileSync(
    "scripts/write-manual-history-import-audit.ts",
    "utf8",
  );

  assert.match(
    writerSource,
    /\.portal\/audits\/manual-history-import-latest\.json/,
  );
  assert.match(packageJson.scripts?.["audit:manual-history-import"] ?? "", /write-manual-history-import-audit/);
});

test("requests Hyperliquid fills in the same aggregated mode as the Trade History UI", async () => {
  const originalFetch = globalThis.fetch;
  let capturedPayload: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_url, init) => {
    capturedPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response("[]", { status: 200 });
  }) as typeof fetch;

  try {
    await fetchUserFillsByTime(REQUEST);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.notEqual(capturedPayload, null);
  const payload = capturedPayload as unknown as Record<string, unknown>;
  assert.equal(payload.type, "userFillsByTime");
  assert.equal(payload.aggregateByTime, true);
  assert.equal(payload.startTime, REQUEST.startTime);
  assert.equal(payload.endTime, REQUEST.endTime);
  assert.equal("timezone" in payload, false);
});

test("normalizes historical orders from Hyperliquid's nested order payload shape", () => {
  const orders = normalizeHistoricalOrders(
    [
      {
        order: {
          coin: "BTC",
          isPositionTpsl: false,
          isTrigger: true,
          limitPx: "76807.0",
          oid: 52193055371,
          orderType: "Take Profit Market",
          origSz: "0.0012",
          reduceOnly: true,
          side: "A",
          tif: null,
          timestamp: 1777398014830,
          triggerCondition: "Price above 76807",
          triggerPx: "76807.0",
        },
        status: "siblingFilledCanceled",
        statusTimestamp: 1777398823960,
      },
    ] as HyperliquidHistoricalOrderWire[],
    REQUEST,
  );

  assert.equal(orders.length, 1);
  assert.equal(orders[0]?.orderId, 52193055371);
  assert.equal(orders[0]?.coin, "BTC");
  assert.equal(orders[0]?.orderType, "market");
  assert.equal(orders[0]?.reduceOnly, true);
  assert.equal(orders[0]?.isTrigger, true);
  assert.equal(orders[0]?.triggerCondition, "Price above 76807");
  assert.equal(orders[0]?.status, "siblingFilledCanceled");
});

test("serializes and hydrates a stored baseline import bundle", () => {
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: normalizeFillRecords([
      createFill({
        dir: "Open Long",
        oid: 100,
        px: "100000",
        startPosition: "0",
        sz: "0.01",
        tid: 10,
        time: Date.parse("2026-04-28T12:00:00.000Z"),
      }),
      createFill({
        closedPnl: "12",
        dir: "Close Long",
        oid: 101,
        px: "101200",
        side: "A",
        startPosition: "0.01",
        sz: "0.01",
        tid: 11,
        time: Date.parse("2026-04-28T12:06:00.000Z"),
      }),
    ]),
  });

  const bundle = {
    id: createStoredBaselineImportBundleId(REQUEST),
    request: REQUEST,
    result,
    savedAt: "2026-04-28T12:30:00.000Z",
    source: "hyperliquid" as const,
    sourceLabel: "Historical Import" as const,
    version: "v1" as const,
  };
  const serialized = serializeStoredBaselineImportBundles([bundle]);
  const hydrated = parseStoredBaselineImportBundles(serialized);

  assert.ok(estimateStoredBaselineImportBundlesSizeBytes([bundle]) > 0);
  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0]?.id, createStoredBaselineImportBundleId(REQUEST));
  assert.equal(hydrated[0]?.sourceLabel, "Historical Import");
  assert.equal(hydrated[0]?.request.timezone, "America/Chicago");
  assert.equal(hydrated[0]?.result.profile.dateRange.timezone, "America/Chicago");
  assert.equal(hydrated[0]?.result.sessionIntelligence?.summary.sessionCount, 1);
  assert.equal(hydrated[0]?.result.trades[0]?.coin, "BTC");
});

test("serializes saved baseline metadata without embedding heavy scan payloads", () => {
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: normalizeFillRecords([
      createFill({
        dir: "Open Long",
        oid: 100,
        px: "100000",
        startPosition: "0",
        sz: "0.01",
        tid: 10,
        time: Date.parse("2026-04-28T12:00:00.000Z"),
      }),
      createFill({
        closedPnl: "12",
        dir: "Close Long",
        oid: 101,
        px: "101200",
        side: "A",
        startPosition: "0.01",
        sz: "0.01",
        tid: 11,
        time: Date.parse("2026-04-28T12:06:00.000Z"),
      }),
    ]),
  });
  const bundle = {
    id: createStoredBaselineImportBundleId(REQUEST),
    request: REQUEST,
    result,
    savedAt: "2026-04-28T12:30:00.000Z",
    source: "hyperliquid" as const,
    sourceLabel: "Historical Import" as const,
    version: "v1" as const,
  };

  const manifest = serializeStoredBaselineImportManifest([bundle]);
  const parsedManifest = parseStoredBaselineImportManifest(manifest);

  assert.ok(manifest.length < serializeStoredBaselineImportBundles([bundle]).length);
  assert.doesNotMatch(manifest, /"fills"/);
  assert.doesNotMatch(manifest, /"orders"/);
  assert.doesNotMatch(manifest, /"trades"/);
  assert.doesNotMatch(manifest, /"sessionIntelligence"/);
  assert.equal(parsedManifest.length, 1);
  assert.equal(parsedManifest[0]?.id, bundle.id);
  assert.equal(parsedManifest[0]?.payload.storage, "indexeddb");
  assert.equal(parsedManifest[0]?.summary.tradeCount, 1);
  assert.equal(parsedManifest[0]?.summary.netPnl, 12);
});

test("persists baseline bundles as local metadata plus external payload records", async () => {
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: normalizeFillRecords([
      createFill({
        dir: "Open Long",
        oid: 100,
        px: "100000",
        startPosition: "0",
        sz: "0.01",
        tid: 10,
        time: Date.parse("2026-04-28T12:00:00.000Z"),
      }),
      createFill({
        closedPnl: "12",
        dir: "Close Long",
        oid: 101,
        px: "101200",
        side: "A",
        startPosition: "0.01",
        sz: "0.01",
        tid: 11,
        time: Date.parse("2026-04-28T12:06:00.000Z"),
      }),
    ]),
  });
  const bundle: StoredBaselineImportBundle = {
    id: createStoredBaselineImportBundleId(REQUEST),
    request: REQUEST,
    result,
    savedAt: "2026-04-28T12:30:00.000Z",
    source: "hyperliquid",
    sourceLabel: "Historical Import",
    version: "v1",
  };
  const storage = createMemoryStorage();
  const payloadStore = createMemoryPayloadStore();

  await persistStoredBaselineImportBundlesToLocalStore(storage, [bundle], payloadStore);

  const rawManifest = storage.getItem("portal.baseline-import") ?? "";
  assert.doesNotMatch(rawManifest, /"fills"/);
  assert.doesNotMatch(rawManifest, /"trades"/);

  const loaded = await loadStoredBaselineImportBundlesFromLocalStore(storage, payloadStore);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0]?.id, bundle.id);
  assert.equal(loaded[0]?.result.trades[0]?.netPnl, 12);
  assert.equal(loaded[0]?.result.sessionIntelligence?.summary.sessionCount, 1);
});

test("hydrates legacy single-bundle storage into a collection", () => {
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: [],
  });

  const serialized = JSON.stringify({
    request: REQUEST,
    result,
    savedAt: "2026-04-28T12:30:00.000Z",
    source: "hyperliquid",
    sourceLabel: "Historical Import",
    version: "v1",
  });

  const hydrated = parseStoredBaselineImportBundles(serialized);
  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0]?.id, createStoredBaselineImportBundleId(REQUEST));
  assert.equal(hydrated[0]?.request.timezone, "America/Chicago");
  assert.equal(hydrated[0]?.result.profile.dateRange.timezone, "America/Chicago");
  assert.equal(hydrated[0]?.result.sessionIntelligence?.summary.sessionCount, 0);
});

test("hydrates legacy stored baseline bundles with a UTC timezone fallback", () => {
  const legacyRequest = {
    accountAddress: REQUEST.accountAddress,
    endTime: REQUEST.endTime,
    environment: REQUEST.environment,
    startTime: REQUEST.startTime,
  };
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: [],
  });

  const serialized = JSON.stringify({
    request: legacyRequest,
    result: {
      ...result,
      profile: {
        ...result.profile,
        dateRange: {
          endTime: REQUEST.endTime,
          startTime: REQUEST.startTime,
        },
      },
    },
    savedAt: "2026-04-28T12:30:00.000Z",
    source: "hyperliquid",
    sourceLabel: "Historical Import",
    version: "v1",
  });

  const hydrated = parseStoredBaselineImportBundles(serialized);

  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0]?.request.timezone, "UTC");
  assert.equal(hydrated[0]?.result.profile.dateRange.timezone, "UTC");
  assert.equal(hydrated[0]?.result.sessionIntelligence?.summary.sessionCount, 0);
});

test("formats baseline source wallets as compact first-three last-three labels", () => {
  assert.equal(
    formatBaselineSourceWalletAddress("0x36fF15F480BDbAF92B868B54BB0B9484e82E4b8a"),
    "36f...b8a",
  );
  assert.equal(formatBaselineSourceWalletAddress("abc123"), "abc123");
});

test("deletes a stored baseline import bundle without touching other sources", () => {
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: [],
  });
  const secondRequest: BaselineImportRequest = {
    ...REQUEST,
    accountAddress: "0x2222222222222222222222222222222222222222",
  };
  const firstBundle = {
    id: createStoredBaselineImportBundleId(REQUEST),
    request: REQUEST,
    result,
    savedAt: "2026-04-28T12:30:00.000Z",
    source: "hyperliquid" as const,
    sourceLabel: "Historical Import" as const,
    version: "v1" as const,
  };
  const secondBundle = {
    id: createStoredBaselineImportBundleId(secondRequest),
    request: secondRequest,
    result: {
      ...result,
      profile: {
        ...result.profile,
        request: secondRequest,
      },
    },
    savedAt: "2026-04-28T12:31:00.000Z",
    source: "hyperliquid" as const,
    sourceLabel: "Historical Import" as const,
    version: "v1" as const,
  };

  const nextBundles = deleteStoredBaselineImportBundle(
    [firstBundle, secondBundle],
    firstBundle.id,
  );

  assert.equal(nextBundles.length, 1);
  assert.equal(nextBundles[0]?.id, secondBundle.id);
  assert.equal(nextBundles[0]?.request.accountAddress, secondRequest.accountAddress);
});

test("reconstructs a simple long open and close trade", () => {
  const trades = reconstructImportedTrades({
    fills: normalizeFillRecords([
      createFill({
        closedPnl: "0",
        dir: "Open Long",
        oid: 100,
        px: "100000",
        side: "B",
        startPosition: "0",
        sz: "0.01",
        tid: 10,
        time: Date.parse("2026-04-28T12:00:00.000Z"),
      }),
      createFill({
        closedPnl: "32",
        dir: "Close Long",
        oid: 101,
        px: "103200",
        side: "A",
        startPosition: "0.01",
        sz: "0.01",
        tid: 11,
        time: Date.parse("2026-04-28T12:20:00.000Z"),
      }),
    ]),
    funding: [],
    orders: [],
    request: REQUEST,
  });

  assert.equal(trades.trades.length, 1);
  assert.equal(trades.trades[0]?.direction, "long");
  assert.equal(trades.trades[0]?.status, "closed");
  assert.equal(trades.trades[0]?.entryPrice, 100000);
  assert.equal(trades.trades[0]?.exitPrice, 103200);
  assert.equal(trades.trades[0]?.durationMinutes, 20);
  assert.equal(trades.trades[0]?.executionClosedPnl, 32);
  assert.equal(trades.trades[0]?.grossFees, 0.3);
});

test("reconstructs a simple short open and close trade", () => {
  const trades = reconstructImportedTrades({
    fills: normalizeFillRecords([
      createFill({
        dir: "Open Short",
        oid: 200,
        px: "100000",
        side: "A",
        startPosition: "0",
        sz: "0.01",
        tid: 20,
        time: Date.parse("2026-04-28T13:00:00.000Z"),
      }),
      createFill({
        closedPnl: "18",
        dir: "Close Short",
        oid: 201,
        px: "98200",
        side: "B",
        startPosition: "-0.01",
        sz: "0.01",
        tid: 21,
        time: Date.parse("2026-04-28T13:07:00.000Z"),
      }),
    ]),
    funding: [],
    orders: [],
    request: REQUEST,
  });

  assert.equal(trades.trades.length, 1);
  assert.equal(trades.trades[0]?.direction, "short");
  assert.equal(trades.trades[0]?.durationMinutes, 7);
  assert.equal(trades.trades[0]?.executionClosedPnl, 18);
});

test("handles scale in, reduce, and close while tracking max size", () => {
  const trades = reconstructImportedTrades({
    fills: normalizeFillRecords([
      createFill({
        dir: "Open Long",
        oid: 300,
        px: "100000",
        startPosition: "0",
        sz: "0.01",
        tid: 30,
        time: Date.parse("2026-04-28T14:00:00.000Z"),
      }),
      createFill({
        dir: "Open Long",
        oid: 301,
        px: "101000",
        startPosition: "0.01",
        sz: "0.02",
        tid: 31,
        time: Date.parse("2026-04-28T14:05:00.000Z"),
      }),
      createFill({
        closedPnl: "8",
        dir: "Close Long",
        oid: 302,
        px: "101500",
        side: "A",
        startPosition: "0.03",
        sz: "0.01",
        tid: 32,
        time: Date.parse("2026-04-28T14:11:00.000Z"),
      }),
      createFill({
        closedPnl: "30",
        dir: "Close Long",
        oid: 303,
        px: "102000",
        side: "A",
        startPosition: "0.02",
        sz: "0.02",
        tid: 33,
        time: Date.parse("2026-04-28T14:18:00.000Z"),
      }),
    ]),
    funding: [],
    orders: [],
    request: REQUEST,
  });

  assert.equal(trades.trades.length, 1);
  assert.equal(trades.trades[0]?.maxSize, 0.03);
  assert.equal(trades.trades[0]?.executionClosedPnl, 38);
  assert.equal(trades.trades[0]?.closeFills.length, 1);
  assert.equal(trades.trades[0]?.reduceFills.length, 1);
});

test("splits reversals into a close fragment and new open trade", () => {
  const trades = reconstructImportedTrades({
    fills: normalizeFillRecords([
      createFill({
        dir: "Open Long",
        oid: 400,
        px: "100000",
        side: "B",
        startPosition: "0",
        sz: "0.01",
        tid: 40,
        time: Date.parse("2026-04-28T10:00:00.000Z"),
      }),
      createFill({
        closedPnl: "-10",
        dir: "Open Short",
        oid: 401,
        px: "99000",
        side: "A",
        startPosition: "0.01",
        sz: "0.03",
        tid: 41,
        time: Date.parse("2026-04-28T10:10:00.000Z"),
      }),
      createFill({
        closedPnl: "6",
        dir: "Close Short",
        oid: 402,
        px: "98700",
        side: "B",
        startPosition: "-0.02",
        sz: "0.02",
        tid: 42,
        time: Date.parse("2026-04-28T10:20:00.000Z"),
      }),
    ]),
    funding: [],
    orders: [],
    request: REQUEST,
  });

  assert.equal(trades.trades.length, 2);
  assert.equal(trades.trades[0]?.direction, "long");
  assert.equal(trades.trades[0]?.status, "reversed-fragment");
  assert.equal(trades.trades[1]?.direction, "short");
  assert.equal(trades.trades[1]?.status, "closed");
  assert.equal(trades.trades[1]?.entryPrice, 99000);
  assert.equal(trades.trades[1]?.maxSize, 0.02);
});

test("excludes boundary closes from recommendation-grade trades", () => {
  const reconstructed = reconstructImportedTrades({
    fills: normalizeFillRecords([
      createFill({
        closedPnl: "3",
        dir: "Close Short",
        oid: 450,
        side: "B",
        startPosition: "-0.02",
        sz: "0.01",
        tid: 45,
        time: Date.parse("2026-04-28T09:00:00.000Z"),
      }),
      createFill({
        closedPnl: "2",
        dir: "Close Short",
        oid: 451,
        side: "B",
        startPosition: "-0.01",
        sz: "0.01",
        tid: 46,
        time: Date.parse("2026-04-28T09:02:00.000Z"),
      }),
      createFill({
        dir: "Open Long",
        oid: 452,
        side: "B",
        startPosition: "0",
        sz: "0.01",
        tid: 47,
        time: Date.parse("2026-04-28T09:10:00.000Z"),
      }),
      createFill({
        closedPnl: "7",
        dir: "Close Long",
        oid: 453,
        side: "A",
        startPosition: "0.01",
        sz: "0.01",
        tid: 48,
        time: Date.parse("2026-04-28T09:20:00.000Z"),
      }),
    ]),
    funding: [],
    orders: [],
    request: REQUEST,
  });

  assert.equal(reconstructed.boundaryFillCount, 2);
  assert.equal(reconstructed.trades.length, 1);
  assert.equal(reconstructed.trades[0]?.direction, "long");
  assert.equal(reconstructed.trades[0]?.executionClosedPnl, 7);
  assert.equal(
    reconstructed.warnings.some((warning) => warning.code === "boundary-position-fills-excluded"),
    true,
  );
});

test("starts a new in-range trade when a boundary position reverses", () => {
  const reconstructed = reconstructImportedTrades({
    fills: normalizeFillRecords([
      createFill({
        closedPnl: "-10",
        dir: "Long > Short",
        oid: 460,
        side: "A",
        startPosition: "0.01",
        sz: "0.03",
        tid: 49,
        time: Date.parse("2026-04-28T09:00:00.000Z"),
      }),
      createFill({
        closedPnl: "6",
        dir: "Close Short",
        oid: 461,
        side: "B",
        startPosition: "-0.02",
        sz: "0.02",
        tid: 50,
        time: Date.parse("2026-04-28T09:18:00.000Z"),
      }),
    ]),
    funding: [],
    orders: [],
    request: REQUEST,
  });

  assert.equal(reconstructed.boundaryFillCount, 1);
  assert.equal(reconstructed.trades.length, 1);
  assert.equal(reconstructed.trades[0]?.direction, "short");
  assert.equal(reconstructed.trades[0]?.status, "closed");
  assert.equal(reconstructed.trades[0]?.maxSize, 0.02);
  assert.equal(reconstructed.trades[0]?.openFills[0]?.id.endsWith("boundary-reverse-open"), true);
});

test("matches the May 19 XPL aggregated screenshot shape without a phantom boundary trade", () => {
  const request: BaselineImportRequest = {
    ...REQUEST,
    endTime: Date.parse("2026-05-22T23:59:59.999Z"),
    startTime: Date.parse("2026-05-19T00:00:00.000Z"),
  };
  const fills = normalizeUserFills(
    [
      createFill({
        closedPnl: "0.07",
        coin: "XPL",
        dir: "Close Short",
        fee: "0",
        oid: 1901,
        px: "0.082289",
        side: "B",
        startPosition: "-131",
        sz: "131",
        tid: 1901,
        time: Date.parse("2026-05-19T15:50:03.000Z"),
      }),
      createFill({
        closedPnl: "-0.31",
        coin: "XPL",
        dir: "Open Long",
        fee: "0.31",
        oid: 1902,
        px: "0.082303",
        side: "B",
        startPosition: "0",
        sz: "8369",
        tid: 1902,
        time: Date.parse("2026-05-19T15:51:40.000Z"),
      }),
      createFill({
        closedPnl: "-0.15",
        coin: "XPL",
        dir: "Open Long",
        fee: "0.15",
        oid: 1903,
        px: "0.082311",
        side: "B",
        startPosition: "8369",
        sz: "4165",
        tid: 1903,
        time: Date.parse("2026-05-19T15:51:47.000Z"),
      }),
      createFill({
        closedPnl: "-12.48",
        coin: "XPL",
        dir: "Close Long",
        fee: "0.46",
        oid: 1904,
        px: "0.081346",
        side: "A",
        startPosition: "12534",
        sz: "12534",
        tid: 1904,
        time: Date.parse("2026-05-19T19:15:06.000Z"),
      }),
      createFill({
        closedPnl: "-0.45",
        coin: "XPL",
        dir: "Open Long",
        fee: "0.45",
        oid: 1905,
        px: "0.081627",
        side: "B",
        startPosition: "0",
        sz: "12154",
        tid: 1905,
        time: Date.parse("2026-05-19T19:46:01.000Z"),
      }),
    ],
    request,
  );

  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request,
    userFills: fills,
  });

  assert.equal(result.sourceHealth.aggregatedFillCount, 5);
  assert.equal(result.sourceHealth.boundaryFillCount, 1);
  assert.equal(result.sourceHealth.recommendationTradeCount, 2);
  assert.equal(result.sessionIntelligence?.summary.sessionCount, 1);
  assert.equal(result.trades.length, 2);
  assert.equal(result.trades[0]?.direction, "long");
  assert.equal(result.trades[0]?.status, "closed");
  assert.equal(result.trades[0]?.maxSize, 12534);
  assert.equal(result.trades[1]?.direction, "long");
  assert.equal(result.trades[1]?.status, "open");
  assert.equal(result.trades.some((trade) => trade.direction === "short"), false);
});

test("enriches execution mode and proxy classification from order matches, with unknown fallback", () => {
  const fills = normalizeFillRecords([
    createFill({
      dir: "Open Long",
      oid: 500,
      px: "100000",
      side: "B",
      startPosition: "0",
      sz: "0.01",
      tid: 50,
      time: Date.parse("2026-04-28T09:00:00.000Z"),
    }),
    createFill({
      closedPnl: "10",
      dir: "Close Long",
      oid: 501,
      px: "101000",
      side: "A",
      startPosition: "0.01",
      sz: "0.01",
      tid: 51,
      time: Date.parse("2026-04-28T09:08:00.000Z"),
    }),
    createFill({
      dir: "Open Short",
      oid: 999,
      px: "102000",
      side: "A",
      startPosition: "0",
      sz: "0.01",
      tid: 52,
      time: Date.parse("2026-04-28T09:30:00.000Z"),
    }),
    createFill({
      closedPnl: "3",
      dir: "Close Short",
      oid: 1000,
      px: "101700",
      side: "B",
      startPosition: "-0.01",
      sz: "0.01",
      tid: 53,
      time: Date.parse("2026-04-28T09:37:00.000Z"),
    }),
  ]);

  const orders = normalizeHistoricalOrders(
    [
      {
        coin: "BTC",
        oid: 500,
        orderType: "Limit",
        origSz: "0.01",
        reduceOnly: false,
        side: "B",
        status: "filled",
        statusTimestamp: Date.parse("2026-04-28T09:00:01.000Z"),
        tif: "Gtc",
        timestamp: Date.parse("2026-04-28T08:59:58.000Z"),
      },
      {
        coin: "BTC",
        oid: 501,
        orderType: "Limit",
        origSz: "0.01",
        reduceOnly: true,
        side: "A",
        status: "filled",
        statusTimestamp: Date.parse("2026-04-28T09:08:01.000Z"),
        tif: "Gtc",
        timestamp: Date.parse("2026-04-28T09:07:58.000Z"),
      },
    ] satisfies HyperliquidHistoricalOrderWire[],
    REQUEST,
  );

  const reconstructed = reconstructImportedTrades({
    fills,
    funding: [],
    orders,
    request: REQUEST,
  });

  assert.equal(reconstructed.trades[0]?.executionMode, "limit");
  assert.equal(reconstructed.trades[0]?.entryStyleProxy, "likely-hunted");
  assert.equal(reconstructed.trades[1]?.executionMode, "unknown");
  assert.equal(reconstructed.trades[1]?.entryStyleProxy, "unknown");
});

test("groups trades into sessions using a 90-minute inactivity gap", () => {
  const fills = normalizeFillRecords([
    createFill({
      dir: "Open Long",
      oid: 600,
      startPosition: "0",
      tid: 60,
      time: Date.parse("2026-04-28T09:00:00.000Z"),
    }),
    createFill({
      closedPnl: "2",
      dir: "Close Long",
      oid: 601,
      side: "A",
      startPosition: "0.01",
      tid: 61,
      time: Date.parse("2026-04-28T09:20:00.000Z"),
    }),
    createFill({
      dir: "Open Long",
      oid: 602,
      startPosition: "0",
      tid: 62,
      time: Date.parse("2026-04-28T12:00:00.000Z"),
    }),
    createFill({
      closedPnl: "4",
      dir: "Close Long",
      oid: 603,
      side: "A",
      startPosition: "0.01",
      tid: 63,
      time: Date.parse("2026-04-28T12:15:00.000Z"),
    }),
  ]);

  const reconstructed = reconstructImportedTrades({
    fills,
    funding: [],
    orders: [],
    request: REQUEST,
  });

  assert.equal(reconstructed.sessions.length, 2);
  assert.equal(reconstructed.sessions[0]?.tradeCount, 1);
  assert.equal(reconstructed.sessions[1]?.tradeCount, 1);
});

test("flags size-after-loss when next trade sizes up by at least ten percent", () => {
  const fills = normalizeFillRecords([
    createFill({
      dir: "Open Long",
      oid: 700,
      startPosition: "0",
      sz: "0.0100",
      tid: 70,
      time: Date.parse("2026-04-28T08:00:00.000Z"),
    }),
    createFill({
      closedPnl: "-10",
      dir: "Close Long",
      oid: 701,
      side: "A",
      startPosition: "0.0100",
      sz: "0.0100",
      tid: 71,
      time: Date.parse("2026-04-28T08:10:00.000Z"),
    }),
    createFill({
      dir: "Open Long",
      oid: 702,
      startPosition: "0",
      sz: "0.0115",
      tid: 72,
      time: Date.parse("2026-04-28T08:40:00.000Z"),
    }),
    createFill({
      closedPnl: "8",
      dir: "Close Long",
      oid: 703,
      side: "A",
      startPosition: "0.0115",
      sz: "0.0115",
      tid: 73,
      time: Date.parse("2026-04-28T08:50:00.000Z"),
    }),
  ]);

  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: fills,
  });

  assert.equal(result.profile.sizeAfterLoss.events.length, 1);
  assert.equal(result.profile.sizeAfterLoss.events[0]?.flagged, true);
});

test("includes funding separately from execution closed pnl", () => {
  const fills = normalizeFillRecords([
    createFill({
      dir: "Open Long",
      oid: 800,
      startPosition: "0",
      tid: 80,
      time: Date.parse("2026-04-28T07:00:00.000Z"),
    }),
    createFill({
      closedPnl: "15",
      dir: "Close Long",
      oid: 801,
      side: "A",
      startPosition: "0.01",
      tid: 81,
      time: Date.parse("2026-04-28T07:20:00.000Z"),
    }),
  ]);
  const funding = normalizeUserFunding(
    [
      {
        coin: "BTC",
        delta: "1.25",
        time: Date.parse("2026-04-28T07:10:00.000Z"),
      },
    ] satisfies HyperliquidUserFundingWire[],
    REQUEST,
  );

  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding,
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: fills,
  });

  assert.equal(result.trades[0]?.executionClosedPnl, 15);
  assert.equal(result.trades[0]?.fundingPnl, 1.25);
  assert.equal(result.trades[0]?.netPnl, 16.25);
});

test("builds data quality warnings for truncation, missing matches, and empty results", () => {
  const fills: ImportedFill[] = Array.from({ length: 2000 }, (_, index) =>
    normalizeFillRecords([
      createFill({
        oid: index + 1,
        tid: index + 1,
        time: REQUEST.startTime + index,
      }),
    ])[0]!,
  );
  const ledgerUpdates = normalizeLedgerUpdates(
    [
      {
        delta: "100",
        time: Date.parse("2026-04-28T01:00:00.000Z"),
        type: "deposit",
      },
    ] satisfies HyperliquidLedgerUpdateWire[],
    REQUEST,
  );

  const profile = buildBaselineProfile({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates,
    orders: [],
    request: {
      ...REQUEST,
      endTime: REQUEST.startTime + 1000 * 60 * 60 * 24 * 120,
    },
    sessionWarnings: [],
    trades: [],
    userFills: fills,
  });

  assert.equal(profile.dataQuality.some((warning) => warning.code === "fill-cap-hit"), true);
  assert.equal(
    profile.dataQuality.some((warning) => warning.code === "requested-range-may-exceed-recent-fill-window"),
    true,
  );
  assert.equal(profile.dataQuality.some((warning) => warning.code === "empty-results-possible-wrong-address"), true);
});

test("builds baseline performance totals from closed trades without mixing open fees into headline fees", () => {
  const profile = buildBaselineProfile({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    sessionWarnings: [],
    trades: [
      createImportedTrade({
        grossFees: 0.3,
        id: "closed-win",
        netPnl: 10,
        status: "closed",
      }),
      createImportedTrade({
        durationMinutes: null,
        endTime: null,
        grossFees: 0.7,
        id: "open-context",
        netPnl: 0,
        status: "open",
      }),
    ],
    userFills: [],
  });

  assert.equal(profile.totals.grossFees, 1);
  assert.equal(profile.totals.closedGrossFees, 0.3);
  assert.equal(profile.totals.openTradeFees, 0.7);
  assert.equal(profile.totals.netPnl, 10);
  assert.equal(profile.totals.grossPnlBeforeFees, 10.3);
  assert.equal(profile.totals.averageClosedTradeNetPnl, 10);
});

test("marks behavior metric rows reliable only after ten closed trades", () => {
  const trades = [
    ...Array.from({ length: 9 }, (_, index) =>
      createImportedTrade({
        entryTime: Date.parse(`2026-04-28T14:${String(index).padStart(2, "0")}:00.000Z`),
        id: `thin-${index}`,
        netPnl: 1,
      }),
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      createImportedTrade({
        durationMinutes: 120,
        entryTime: Date.parse(`2026-04-28T19:${String(index).padStart(2, "0")}:00.000Z`),
        id: `reliable-${index}`,
        netPnl: -2,
      }),
    ),
  ];

  const profile = buildBaselineProfile({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    sessionWarnings: [],
    trades,
    userFills: [],
  });

  assert.equal(profile.byTimeOfDay.find((row) => row.key === "premarket")?.sampleReliable, false);
  assert.equal(profile.byTimeOfDay.find((row) => row.key === "cash")?.sampleReliable, true);
  assert.equal(profile.byHoldTimeBucket.find((row) => row.key === "15-60m")?.sampleReliable, false);
  assert.equal(profile.byHoldTimeBucket.find((row) => row.key === "1-4h")?.sampleReliable, true);
});

test("builds local insight baseline debug output without raw secrets", () => {
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: normalizeFillRecords([
      createFill({
        dir: "Open Long",
        oid: 880,
        startPosition: "0",
        tid: 880,
        time: Date.parse("2026-04-28T10:00:00.000Z"),
      }),
      createFill({
        closedPnl: "4",
        dir: "Close Long",
        oid: 881,
        side: "A",
        startPosition: "0.01",
        tid: 881,
        time: Date.parse("2026-04-28T10:10:00.000Z"),
      }),
    ]),
  });

  const debugOutput = buildInsightBaselineDebugOutput(REQUEST, result);

  assert.equal(debugOutput.kind, "portal-insight-baseline-debug");
  assert.equal(debugOutput.rawSourceCounts.fills, 2);
  assert.equal(debugOutput.reconstruction.reconstructedTrades, 1);
  assert.equal(debugOutput.sessionIntelligence?.sessionCount, 1);
  assert.equal(debugOutput.sessionIntelligence?.anyReadyForDiagnosis, false);
  assert.equal(debugOutput.sessionIntelligence?.directionalOnlySessionCount, 1);
  assert.equal(
    debugOutput.sessionIntelligence?.sourceQualityWarnings[0]?.code,
    "missing-order-matches",
  );
  assert.equal(debugOutput.reconstruction.boundaryFillsExcluded, 0);
  assert.equal(debugOutput.headlineMetrics.closedTrades, 1);
  assert.equal("privateKey" in debugOutput, false);
});

test("builds trade reconstruction debug output with quality counters", () => {
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: null,
    funding: [],
    ledgerUpdates: [],
    orders: [],
    request: REQUEST,
    userFills: normalizeFillRecords([
      createFill({
        dir: "Open Long",
        oid: 980,
        startPosition: "0",
        tid: 980,
        time: Date.parse("2026-04-29T02:30:00.000Z"),
      }),
      createFill({
        closedPnl: "-6",
        dir: "Close Long",
        oid: 981,
        side: "A",
        startPosition: "0.01",
        tid: 981,
        time: Date.parse("2026-04-29T02:40:00.000Z"),
      }),
    ]),
  });
  const firstFill = result.fills[0]!;
  const debugOutput = buildTradeReconstructionDebugOutput(REQUEST, {
    ...result,
    fills: [
      { ...firstFill, raw: { ...firstFill.raw, time: "not-a-date" } },
      firstFill,
    ],
  });

  assert.equal(debugOutput.kind, "portal-trade-reconstruction-debug");
  assert.equal(debugOutput.rawSourceCounts.fills, 2);
  assert.equal(debugOutput.reconstructionCounts.reconstructedTrades, 1);
  assert.equal(debugOutput.reconstructionCounts.duplicateFillsDetected.duplicateIds, 1);
  assert.equal(debugOutput.reconstructionCounts.invalidTimestampsDetected.fills, 1);
  assert.equal(debugOutput.sessionCounts.overnightSessions, 1);
  assert.equal("privateKey" in debugOutput, false);
});

test("builds Hyperliquid PNL reconciliation output with closed-trade formula safety", () => {
  const result = runHistoricalBaselineScanFromRecords({
    accountSnapshot: {
      assetPositions: [
        {
          position: {
            coin: "BTC",
            szi: "0.02",
            unrealizedPnl: "-42.5",
          },
          type: "oneWay",
        },
      ],
      marginSummary: {
        accountValue: "921.42",
      },
    },
    funding: normalizeUserFunding(
      [
        {
          coin: "BTC",
          delta: "1.25",
          hash: "0xfunding",
          time: Date.parse("2026-04-28T12:05:00.000Z"),
        },
      ],
      REQUEST,
    ),
    ledgerUpdates: normalizeLedgerUpdates(
      [
        {
          delta: "250",
          hash: "0xledger",
          time: Date.parse("2026-04-28T12:06:00.000Z"),
          token: "USDC",
          type: "deposit",
        },
      ],
      REQUEST,
    ),
    orders: [],
    request: REQUEST,
    userFills: normalizeFillRecords([
      createFill({
        fee: "0.5",
        oid: 1180,
        startPosition: "0",
        tid: 1180,
        time: Date.parse("2026-04-28T10:00:00.000Z"),
      }),
      createFill({
        closedPnl: "10",
        dir: "Close Long",
        fee: "0.75",
        oid: 1181,
        side: "A",
        startPosition: "0.01",
        tid: 1181,
        time: Date.parse("2026-04-28T10:10:00.000Z"),
      }),
      createFill({
        closedPnl: "-6",
        dir: "Close Short",
        fee: "0.2",
        oid: 1182,
        side: "B",
        startPosition: "-0.01",
        tid: 1182,
        time: Date.parse("2026-04-28T14:00:00.000Z"),
      }),
      createFill({
        fee: "0.4",
        oid: 1183,
        startPosition: "0",
        tid: 1183,
        time: Date.parse("2026-04-28T14:10:00.000Z"),
      }),
    ]),
  });

  const debugOutput = buildHyperliquidPnlReconciliationDebugOutput(REQUEST, result, {
    hyperliquidPortfolio: [
      [
        "month",
        {
          accountValueHistory: [
            [Date.parse("2026-03-29T15:00:00.000Z"), "1100"],
            [Date.parse("2026-04-28T15:00:00.000Z"), "920"],
          ],
          pnlHistory: [
            [Date.parse("2026-03-29T15:00:00.000Z"), "0"],
            [Date.parse("2026-04-28T15:00:00.000Z"), "-180"],
          ],
          vlm: "50000",
        },
      ],
    ],
  });

  assert.equal(debugOutput.kind, "portal-hyperliquid-pnl-reconciliation");
  assert.equal(debugOutput.wallet, REQUEST.accountAddress);
  assert.equal(debugOutput.portalMetric.label, "Reconstructed closed-trade net");
  assert.equal(debugOutput.portalMetric.netPnlFormulaUsed, "closed trades: sum(fill.closedPnl) + attributed funding");
  assert.equal(debugOutput.totals.allRawFillClosedPnlSum, 4);
  assert.equal(debugOutput.totals.closedPnlSum, 10);
  assert.equal(debugOutput.totals.reconstructedVsRawClosedPnlDelta, 6);
  assert.equal(debugOutput.totals.feeSum, 1.25);
  assert.equal(debugOutput.totals.fundingSum, 1.25);
  assert.equal(debugOutput.reconstruction.closedTradeCount, 1);
  assert.equal(debugOutput.reconstruction.openTradeCount, 1);
  assert.equal(debugOutput.reconstruction.boundaryFillsExcluded, 1);
  assert.equal(debugOutput.warnings.boundaryFillsExcluded, true);
  assert.equal(debugOutput.warnings.openTradesExcluded, true);
  assert.equal(debugOutput.range.portalScanRange.timezone, "America/Chicago");
  assert.equal(debugOutput.range.portalScanRange.boundarySemantics, "UTC inclusive day boundaries");
  assert.equal(debugOutput.hyperliquidPortfolio?.month?.pnlLatest, -180);
  assert.equal(debugOutput.accountValueSnapshot?.accountValue, 921.42);
  assert.equal(debugOutput.openPositionSnapshot?.positions[0]?.coin, "BTC");
  assert.equal("privateKey" in debugOutput, false);
});

test("reconciliation writer targets the local audit artifact path", () => {
  const scriptSource = readFileSync(
    "scripts/write-hyperliquid-pnl-reconciliation-audit.ts",
    "utf8",
  );
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.match(
    scriptSource,
    /\.portal\/audits\/hyperliquid-pnl-reconciliation-latest\.json/,
  );
  assert.match(
    packageJson.scripts?.["audit:hyperliquid-pnl-reconciliation"] ?? "",
    /write-hyperliquid-pnl-reconciliation-audit\.ts/,
  );
});
