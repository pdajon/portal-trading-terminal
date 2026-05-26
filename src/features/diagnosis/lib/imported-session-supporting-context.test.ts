import assert from "node:assert/strict";
import test from "node:test";
import type { ReconstructedSession, SessionIntelligenceResult } from "@/features/baseline-import";
import { createDebugOnlyEvidence } from "@/features/diagnosis/lib/diagnosis-evidence";
import {
  buildImportedSessionSupportingContextFromEvidence,
  detectImportedNativeConflictCandidate,
  selectImportedSessionSupportingContext,
} from "./imported-session-supporting-context";

function session(overrides: Partial<ReconstructedSession> = {}): ReconstructedSession {
  const startedAt = Date.parse("2026-05-20T02:00:00.000Z");

  return {
    accountAddress: "0x1111111111111111111111111111111111111111",
    assetMix: { BTC: { netPnl: -50, tradeCount: 2 } },
    averageHoldMinutes: 12,
    avgGapBetweenTrades: 8,
    bestTradeId: "trade-win",
    boundaryTradeCount: 0,
    closedTrades: 2,
    confidence: "low",
    confidenceReasons: ["Source warnings limit imported session confidence."],
    diagnosisReadiness: "directional_only",
    directionMix: {
      long: { netPnl: -50, tradeCount: 2 },
      short: { netPnl: 0, tradeCount: 0 },
    },
    endedAt: startedAt + 45 * 60_000,
    environment: "mainnet",
    fees: 4,
    firstTradeResult: "loss",
    funding: 0,
    grossPnlBeforeFees: -46,
    id: "session-1",
    isHighDensity: false,
    isOvernight: true,
    isPostLossCluster: false,
    isRevengeRisk: false,
    isWeekend: false,
    largestBaseSize: 1,
    largestNotionalExposure: 100,
    lastTradeResult: "loss",
    localDateKey: "2026-05-19",
    losses: 2,
    maxConsecutiveLosses: 2,
    maxConsecutiveWins: 0,
    netPnlAfterFeesAndFunding: -50,
    openAtSessionEnd: false,
    openTrades: 0,
    orderMatchCompleteness: {
      fullyMatchedTrades: 1,
      matchedOrderIds: 1,
      partiallyMatchedTrades: 0,
      unmatchedOrderIds: 1,
      unmatchedTrades: 1,
    },
    postLossReentryCount: 0,
    sessionType: "overnight",
    shortGapTradeCount: 1,
    sourceCompleteness: ["order_enrichment_incomplete"],
    startedAt,
    tags: ["overnight", "long_bias"],
    timezone: "America/Chicago",
    totalTimeInMarketMinutes: 24,
    totalTrades: 2,
    tradeIds: ["trade-loss", "trade-win"],
    winRate: 0,
    wins: 0,
    worstTradeId: "trade-loss",
    ...overrides,
  };
}

function result(sessions: ReconstructedSession[]): SessionIntelligenceResult {
  return {
    sessions,
    summary: {
      confidenceDistribution: {
        high: 0,
        insufficient_evidence: 0,
        low: sessions.filter((entry) => entry.confidence === "low").length,
        medium: sessions.filter((entry) => entry.confidence === "medium").length,
      },
      diagnosisReadinessDistribution: {
        directional_only: sessions.filter((entry) => entry.diagnosisReadiness === "directional_only").length,
        ready_for_diagnosis: 0,
        unsafe_not_enough_evidence: sessions.filter(
          (entry) => entry.diagnosisReadiness === "unsafe_not_enough_evidence",
        ).length,
      },
      highDensitySessionCount: sessions.filter((entry) => entry.isHighDensity).length,
      overnightSessionCount: sessions.filter((entry) => entry.isOvernight).length,
      postLossClusterCount: sessions.filter((entry) => entry.isPostLossCluster).length,
      revengeRiskCount: sessions.filter((entry) => entry.isRevengeRisk).length,
      sessionCount: sessions.length,
      tagCounts: {
        high_density: sessions.filter((entry) => entry.tags.includes("high_density")).length,
        long_bias: sessions.filter((entry) => entry.tags.includes("long_bias")).length,
        multi_asset: sessions.filter((entry) => entry.tags.includes("multi_asset")).length,
        overnight: sessions.filter((entry) => entry.tags.includes("overnight")).length,
        post_loss: sessions.filter((entry) => entry.tags.includes("post_loss")).length,
        rapid_reentry: sessions.filter((entry) => entry.tags.includes("rapid_reentry")).length,
        revenge_risk: sessions.filter((entry) => entry.tags.includes("revenge_risk")).length,
        short_bias: sessions.filter((entry) => entry.tags.includes("short_bias")).length,
        weekend: sessions.filter((entry) => entry.tags.includes("weekend")).length,
      },
      topPositiveSession: null,
      totalFees: sessions.reduce((sum, entry) => sum + entry.fees, 0),
      totalFunding: 0,
      totalSessionNetPnl: sessions.reduce((sum, entry) => sum + (entry.netPnlAfterFeesAndFunding ?? 0), 0),
      weekendSessionCount: sessions.filter((entry) => entry.isWeekend).length,
      worstNegativeSession: null,
    },
    version: "v1",
  };
}

test("imported overnight signal returns supporting context only", () => {
  const contexts = selectImportedSessionSupportingContext({
    sessionIntelligence: result([session()]),
  });

  assert.equal(contexts[0]?.title, "Directional overnight signal");
  assert.match(contexts[0]?.summary ?? "", /Imported Historical Baseline/);
  assert.match(contexts[0]?.summary ?? "", /Source quality limits diagnosis confidence/);
  assert.equal(contexts[0]?.allowedUses.includes("operator_diagnosis_primary"), false);
  assert.ok(contexts[0]?.allowedUses.includes("operator_diagnosis_supporting"));
  assert.ok(contexts[0]?.prohibitedUses.includes("discipline_enforcement"));
});

test("imported high-density signal returns supporting context only", () => {
  const contexts = selectImportedSessionSupportingContext({
    sessionIntelligence: result([
      session({
        id: "dense-session",
        isHighDensity: true,
        netPnlAfterFeesAndFunding: -125,
        tags: ["high_density", "rapid_reentry"],
        totalTrades: 7,
      }),
    ]),
  });

  assert.equal(contexts[0]?.title, "Imported high-density session signal");
  assert.equal(contexts[0]?.sourceType, "imported_historical_baseline");
  assert.equal(contexts[0]?.trustLevel, "weak_signal");
  assert.equal(contexts[0]?.allowedUses.includes("operator_diagnosis_primary"), false);
});

test("post-loss cluster signal uses cautious copy", () => {
  const contexts = selectImportedSessionSupportingContext({
    sessionIntelligence: result([
      session({
        id: "post-loss-session",
        isPostLossCluster: true,
        postLossReentryCount: 2,
        tags: ["post_loss", "rapid_reentry"],
      }),
    ]),
  });

  assert.equal(contexts[0]?.title, "Post-loss cluster candidate");
  assert.match(contexts[0]?.summary ?? "", /candidate/i);
  assert.doesNotMatch(contexts[0]?.summary ?? "", /you revenge trade/i);
});

test("unsafe evidence sessions are suppressed", () => {
  const contexts = selectImportedSessionSupportingContext({
    sessionIntelligence: result([
      session({
        confidence: "insufficient_evidence",
        diagnosisReadiness: "unsafe_not_enough_evidence",
      }),
    ]),
  });

  assert.equal(contexts.length, 0);
});

test("imported context has required user-facing labels and confidence reasons", () => {
  const contexts = selectImportedSessionSupportingContext({
    sessionIntelligence: result([session()]),
    sourceWarnings: [
      {
        code: "order-cap-hit",
        detail: "historical orders capped",
        severity: "warning",
      },
    ],
  });

  assert.match(contexts[0]?.evidenceLabel ?? "", /Imported Historical Baseline/);
  assert.match(contexts[0]?.evidenceLabel ?? "", /Directional context/);
  assert.match(contexts[0]?.evidenceLabel ?? "", /Not diagnosis-grade yet/);
  assert.ok((contexts[0]?.confidenceReasons.length ?? 0) > 0);
  assert.equal(contexts[0]?.sourceWarnings[0]?.code, "order-cap-hit");
});

test("imported context cannot be primary diagnosis evidence or Discipline enforcement", () => {
  const contexts = selectImportedSessionSupportingContext({
    sessionIntelligence: result([session()]),
  });

  assert.equal(contexts[0]?.allowedUses.includes("operator_diagnosis_primary"), false);
  assert.ok(contexts[0]?.prohibitedUses.includes("discipline_enforcement"));
  assert.ok(contexts[0]?.prohibitedUses.includes("automatic_trade_blocking"));
});

test("debug evidence is suppressed", () => {
  const context = buildImportedSessionSupportingContextFromEvidence({
    evidence: createDebugOnlyEvidence({ id: "debug-session" }),
    signalType: "overnight_negative",
    session: session(),
  });

  assert.equal(context, null);
});

test("basic conflict detection marks conflict candidates without merging evidence", () => {
  const conflict = detectImportedNativeConflictCandidate({
    importedSignalDirection: "negative",
    nativeSignalDirection: "positive",
    signalKey: "overnight",
  });

  assert.deepEqual(conflict, {
    conflictCandidate: true,
    signalKey: "overnight",
  });
});
