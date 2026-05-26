import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSessionIntelligence,
  buildSessionIntelligenceDebugOutput,
  type BaselineImportRequest,
  type ImportedTrade,
} from "@/features/baseline-import";

const REQUEST: BaselineImportRequest = {
  accountAddress: "0x1111111111111111111111111111111111111111",
  endTime: Date.parse("2026-05-25T00:00:00.000Z"),
  environment: "mainnet",
  startTime: Date.parse("2026-05-20T00:00:00.000Z"),
  timezone: "America/Chicago",
};

function trade(overrides: Partial<ImportedTrade> = {}): ImportedTrade {
  const entryTime = overrides.entryTime ?? Date.parse("2026-05-20T15:00:00.000Z");
  const endTime = overrides.endTime === undefined ? entryTime + 10 * 60_000 : overrides.endTime;

  return {
    accountAddress: REQUEST.accountAddress,
    addFills: [],
    closeFills: [],
    coin: "BTC",
    direction: "long",
    durationMinutes: endTime === null ? null : Math.round((endTime - entryTime) / 60_000),
    endTime,
    entryPrice: 100,
    entryStyleProxy: "likely-chased",
    entryTime,
    environment: REQUEST.environment,
    executionClosedPnl: 10,
    executionMode: "market",
    exitPrice: 110,
    fundingPnl: 1,
    grossFees: 2,
    id: "trade-1",
    maxSize: 1,
    netPnl: 11,
    openFills: [],
    orderIds: [1],
    rawOrderMatches: [
      {
        accountAddress: REQUEST.accountAddress,
        coin: "BTC",
        environment: REQUEST.environment,
        id: "order-1",
        isPositionTpsl: false,
        isTrigger: false,
        limitPrice: null,
        orderId: 1,
        orderType: "market",
        originalSize: 1,
        raw: {},
        reduceOnly: false,
        side: "buy",
        status: "filled",
        statusTime: entryTime,
        statusTimestamp: new Date(entryTime).toISOString(),
        tif: null,
        time: entryTime,
        timestamp: new Date(entryTime).toISOString(),
        triggerCondition: null,
        triggerPrice: null,
      },
    ],
    reconstructionConfidence: "high",
    reduceFills: [],
    sessionId: null,
    sourceLabel: "Historical Import",
    status: "closed",
    ...overrides,
  };
}

function sessionsFor(trades: ImportedTrade[], request: BaselineImportRequest = REQUEST) {
  return buildSessionIntelligence({
    request,
    sourceHealth: {
      aggregatedFillCount: trades.length * 2,
      boundaryFillCount: 0,
      recommendationTradeCount: trades.length,
    },
    trades,
    warnings: [],
  }).sessions;
}

test("assigns one trade to one primary session", () => {
  const sessions = sessionsFor([trade()]);

  assert.equal(sessions.length, 1);
  assert.deepEqual(sessions[0]?.tradeIds, ["trade-1"]);
  assert.equal(sessions[0]?.totalTrades, 1);
});

test("keeps two trades separated by less than 90 minutes in the same session", () => {
  const sessions = sessionsFor([
    trade({ id: "trade-1", entryTime: Date.parse("2026-05-20T15:00:00.000Z") }),
    trade({ id: "trade-2", entryTime: Date.parse("2026-05-20T15:45:00.000Z") }),
  ]);

  assert.equal(sessions.length, 1);
  assert.deepEqual(sessions[0]?.tradeIds, ["trade-1", "trade-2"]);
});

test("splits two trades separated by more than 90 minutes", () => {
  const sessions = sessionsFor([
    trade({ id: "trade-1", entryTime: Date.parse("2026-05-20T15:00:00.000Z") }),
    trade({ id: "trade-2", entryTime: Date.parse("2026-05-20T17:00:01.000Z") }),
  ]);

  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map((session) => session.tradeIds), [["trade-1"], ["trade-2"]]);
});

test("uses trader-local date keys for session grouping metadata", () => {
  const sessions = sessionsFor([
    trade({
      id: "local-previous-day",
      entryTime: Date.parse("2026-05-21T04:30:00.000Z"),
    }),
  ]);

  assert.equal(sessions[0]?.localDateKey, "2026-05-20");
});

test("tags America/Chicago overnight sessions with any-overlap logic", () => {
  const sessions = sessionsFor([
    trade({
      endTime: Date.parse("2026-05-21T01:05:00.000Z"),
      entryTime: Date.parse("2026-05-21T00:30:00.000Z"),
      id: "overlap",
    }),
  ]);

  assert.equal(sessions[0]?.isOvernight, true);
  assert.ok(sessions[0]?.tags.includes("overnight"));
});

test("tags weekend sessions in trader timezone", () => {
  const sessions = sessionsFor([
    trade({
      entryTime: Date.parse("2026-05-23T15:00:00.000Z"),
      id: "saturday",
    }),
  ]);

  assert.equal(sessions[0]?.isWeekend, true);
  assert.ok(sessions[0]?.tags.includes("weekend"));
});

test("tags high-density sessions by trade count", () => {
  const base = Date.parse("2026-05-20T15:00:00.000Z");
  const sessions = sessionsFor(
    Array.from({ length: 6 }, (_, index) =>
      trade({
        entryTime: base + index * 20 * 60_000,
        id: `trade-${index}`,
      }),
    ),
  );

  assert.equal(sessions[0]?.isHighDensity, true);
  assert.ok(sessions[0]?.tags.includes("high_density"));
});

test("tags high-density sessions by average gap", () => {
  const base = Date.parse("2026-05-20T15:00:00.000Z");
  const sessions = sessionsFor(
    Array.from({ length: 4 }, (_, index) =>
      trade({
        entryTime: base + index * 20 * 60_000,
        id: `gap-${index}`,
      }),
    ),
  );

  assert.equal(sessions[0]?.avgGapBetweenTrades, 10);
  assert.equal(sessions[0]?.isHighDensity, true);
});

test("tags rapid re-entry after at least two short gaps", () => {
  const base = Date.parse("2026-05-20T15:00:00.000Z");
  const sessions = sessionsFor([
    trade({ endTime: base + 10 * 60_000, entryTime: base, id: "trade-1" }),
    trade({ endTime: base + 30 * 60_000, entryTime: base + 20 * 60_000, id: "trade-2" }),
    trade({ entryTime: base + 40 * 60_000, id: "trade-3" }),
  ]);

  assert.equal(sessions[0]?.shortGapTradeCount, 2);
  assert.ok(sessions[0]?.tags.includes("rapid_reentry"));
});

test("tags post-loss clusters", () => {
  const base = Date.parse("2026-05-20T15:00:00.000Z");
  const sessions = sessionsFor([
    trade({ endTime: base + 10 * 60_000, entryTime: base, id: "loss", netPnl: -25 }),
    trade({ entryTime: base + 20 * 60_000, id: "after-loss", netPnl: 5 }),
  ]);

  assert.equal(sessions[0]?.postLossReentryCount, 1);
  assert.equal(sessions[0]?.isPostLossCluster, true);
  assert.ok(sessions[0]?.tags.includes("post_loss"));
});

test("tags revenge-risk clusters when size increases after loss", () => {
  const base = Date.parse("2026-05-20T15:00:00.000Z");
  const sessions = sessionsFor([
    trade({ endTime: base + 10 * 60_000, entryTime: base, id: "loss", maxSize: 1, netPnl: -25 }),
    trade({ entryTime: base + 20 * 60_000, id: "size-up", maxSize: 1.2, netPnl: 5 }),
  ]);

  assert.equal(sessions[0]?.isRevengeRisk, true);
  assert.ok(sessions[0]?.tags.includes("revenge_risk"));
});

test("tags multi-asset sessions", () => {
  const sessions = sessionsFor([
    trade({ coin: "BTC", id: "btc" }),
    trade({ coin: "ETH", entryTime: Date.parse("2026-05-20T15:30:00.000Z"), id: "eth" }),
  ]);

  assert.ok(sessions[0]?.tags.includes("multi_asset"));
  assert.equal(sessions[0]?.assetMix.BTC?.tradeCount, 1);
  assert.equal(sessions[0]?.assetMix.ETH?.tradeCount, 1);
});

test("tags long-bias and short-bias sessions", () => {
  const base = Date.parse("2026-05-20T15:00:00.000Z");
  const longSession = sessionsFor(
    Array.from({ length: 10 }, (_, index) =>
      trade({
        direction: index < 7 ? "long" : "short",
        entryTime: base + index * 5 * 60_000,
        id: `long-${index}`,
      }),
    ),
  )[0];
  const shortSession = sessionsFor(
    Array.from({ length: 10 }, (_, index) =>
      trade({
        direction: index < 7 ? "short" : "long",
        entryTime: base + index * 5 * 60_000,
        id: `short-${index}`,
      }),
    ),
  )[0];

  assert.ok(longSession?.tags.includes("long_bias"));
  assert.ok(shortSession?.tags.includes("short_bias"));
});

test("handles open trades and downgrades PnL confidence", () => {
  const sessions = sessionsFor([
    trade({
      durationMinutes: null,
      endTime: null,
      id: "open",
      netPnl: 0,
      status: "open",
    }),
  ]);

  assert.equal(sessions[0]?.openTrades, 1);
  assert.equal(sessions[0]?.openAtSessionEnd, true);
  assert.equal(sessions[0]?.confidence, "low");
  assert.ok(sessions[0]?.confidenceReasons.some((reason) => /open/i.test(reason)));
});

test("does not double-count PnL across tags", () => {
  const base = Date.parse("2026-05-24T02:00:00.000Z");
  const result = buildSessionIntelligence({
    request: REQUEST,
    sourceHealth: {
      aggregatedFillCount: 12,
      boundaryFillCount: 0,
      recommendationTradeCount: 6,
    },
    trades: Array.from({ length: 6 }, (_, index) =>
      trade({
        entryTime: base + index * 10 * 60_000,
        id: `tagged-${index}`,
        netPnl: 10,
      }),
    ),
    warnings: [],
  });

  assert.ok(result.sessions[0]?.tags.includes("overnight"));
  assert.ok(result.sessions[0]?.tags.includes("weekend"));
  assert.ok(result.sessions[0]?.tags.includes("high_density"));
  assert.equal(result.summary.totalSessionNetPnl, 60);
});

test("confidence downgrades for missing timezone and source warnings", () => {
  const result = buildSessionIntelligence({
    request: { ...REQUEST, timezone: "" },
    sourceHealth: {
      aggregatedFillCount: 2,
      boundaryFillCount: 1,
      recommendationTradeCount: 1,
    },
    trades: [trade()],
    warnings: [
      {
        code: "fill-cap-hit",
        detail: "fills capped",
        severity: "warning",
      },
      {
        code: "boundary-position-fills-excluded",
        detail: "boundary excluded",
        severity: "warning",
      },
    ],
  });

  assert.equal(result.sessions[0]?.confidence, "low");
  assert.equal(result.sessions[0]?.diagnosisReadiness, "directional_only");
  assert.ok(result.sessions[0]?.sourceCompleteness.includes("possibly_truncated"));
  assert.ok(result.sessions[0]?.sourceCompleteness.includes("partial_boundary"));
});

test("builds session intelligence debug output without secret fields", () => {
  const result = buildSessionIntelligence({
    request: REQUEST,
    sourceHealth: {
      aggregatedFillCount: 4,
      boundaryFillCount: 0,
      recommendationTradeCount: 2,
    },
    trades: [
      trade({ id: "win", netPnl: 20 }),
      trade({ entryTime: Date.parse("2026-05-20T15:30:00.000Z"), id: "loss", netPnl: -5 }),
    ],
    warnings: [],
  });
  const debugOutput = buildSessionIntelligenceDebugOutput(REQUEST, result, {
    evidenceComparison: {
      alignedCount: 0,
      comparisonCount: 1,
      conflictCount: 0,
      importedOnlyCount: 1,
      nativeOnlyCount: 0,
      notComparableCount: 0,
      sourceWarnings: [
        {
          code: "order-cap-hit",
          detail: "orders capped",
          severity: "warning",
        },
      ],
      suppressedCount: 0,
      topicsCompared: ["overnight_performance"],
    },
    sourceQualityWarnings: [
      {
        code: "order-cap-hit",
        detail: "orders capped",
        severity: "warning",
      },
    ],
  });

  assert.equal(debugOutput.kind, "portal-session-intelligence-debug");
  assert.equal(debugOutput.sessionCount, 1);
  assert.equal(debugOutput.totalSessionNetPnl, 15);
  assert.equal("privateKey" in debugOutput, false);
  assert.equal(debugOutput.topPositiveSession?.id, "session-1");
  assert.equal(debugOutput.worstNegativeSession, null);
  assert.equal(debugOutput.sourceQualityWarnings[0]?.code, "order-cap-hit");
  assert.equal(debugOutput.anyReadyForDiagnosis, false);
  assert.equal(debugOutput.directionalOnlySessionCount, 1);
  assert.equal(debugOutput.unsafeNotEnoughEvidenceSessionCount, 0);
  assert.equal(debugOutput.evidenceComparison.comparisonCount, 1);
  assert.equal(debugOutput.evidenceComparison.importedOnlyCount, 1);
  assert.equal(debugOutput.evidenceComparison.topicsCompared[0], "overnight_performance");
  assert.equal(debugOutput.strongestDirectionalSessionSignals[0]?.id, "session-1");
  assert.equal(debugOutput.weakestSessionSignals[0]?.id, "session-1");
});
