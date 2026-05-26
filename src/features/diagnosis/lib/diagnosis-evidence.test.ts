import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoDebugUserFacingDiagnosis,
  assertNoImportedPrimaryDiagnosis,
  canUseAsPrimaryDiagnosisEvidence,
  canUseAsSupportingDiagnosisEvidence,
  canUseForDisciplineEnforcement,
  createDebugOnlyEvidence,
  createImportedBaselineEvidence,
  createImportedSessionEvidence,
  createNativeDisciplineEvidence,
  createNativeExecutionEvidence,
  createNativeJournalEvidence,
  getEvidenceUserFacingLabel,
  isDebugOnlyEvidence,
  isImportedEvidence,
  isNativeEvidence,
  mapImportedSessionToDiagnosisEvidence,
} from "./diagnosis-evidence";
import type { ReconstructedSession } from "@/features/baseline-import";

function session(overrides: Partial<ReconstructedSession> = {}): ReconstructedSession {
  return {
    accountAddress: "0x1111111111111111111111111111111111111111",
    assetMix: { BTC: { netPnl: -10, tradeCount: 1 } },
    averageHoldMinutes: 10,
    avgGapBetweenTrades: null,
    bestTradeId: "trade-1",
    boundaryTradeCount: 0,
    closedTrades: 1,
    confidence: "low",
    confidenceReasons: ["Fewer than 2 closed trades in session."],
    diagnosisReadiness: "directional_only",
    directionMix: {
      long: { netPnl: -10, tradeCount: 1 },
      short: { netPnl: 0, tradeCount: 0 },
    },
    endedAt: Date.parse("2026-05-20T15:10:00.000Z"),
    environment: "mainnet",
    fees: 1,
    firstTradeResult: "loss",
    funding: 0,
    grossPnlBeforeFees: -9,
    id: "session-1",
    isHighDensity: false,
    isOvernight: true,
    isPostLossCluster: false,
    isRevengeRisk: false,
    isWeekend: false,
    largestBaseSize: 1,
    largestNotionalExposure: 100,
    lastTradeResult: "loss",
    localDateKey: "2026-05-20",
    losses: 1,
    maxConsecutiveLosses: 1,
    maxConsecutiveWins: 0,
    netPnlAfterFeesAndFunding: -10,
    openAtSessionEnd: false,
    openTrades: 0,
    orderMatchCompleteness: {
      fullyMatchedTrades: 1,
      matchedOrderIds: 1,
      partiallyMatchedTrades: 0,
      unmatchedOrderIds: 0,
      unmatchedTrades: 0,
    },
    postLossReentryCount: 0,
    sessionType: "overnight",
    shortGapTradeCount: 0,
    sourceCompleteness: ["complete"],
    startedAt: Date.parse("2026-05-20T15:00:00.000Z"),
    tags: ["overnight", "long_bias"],
    timezone: "America/Chicago",
    totalTimeInMarketMinutes: 10,
    totalTrades: 1,
    tradeIds: ["trade-1"],
    winRate: 0,
    wins: 0,
    worstTradeId: "trade-1",
    ...overrides,
  };
}

test("native journal evidence can become diagnosis_grade primary evidence", () => {
  const evidence = createNativeJournalEvidence({
    id: "journal-evidence-1",
    relatedTradeIds: ["native-trade-1"],
  });

  assert.equal(evidence.sourceType, "native_journal");
  assert.equal(evidence.trustLevel, "diagnosis_grade");
  assert.equal(isNativeEvidence(evidence), true);
  assert.equal(canUseAsPrimaryDiagnosisEvidence(evidence), true);
  assert.equal(canUseForDisciplineEnforcement(evidence), true);
});

test("diagnosis_grade evidence cannot use insufficient_evidence confidence", () => {
  assert.throws(
    () =>
      createNativeExecutionEvidence({
        confidence: "insufficient_evidence",
        id: "native-exec-invalid",
        trustLevel: "diagnosis_grade",
      }),
    /diagnosis_grade/i,
  );
});

test("imported baseline evidence defaults to directional context with hard-use prohibitions", () => {
  const evidence = createImportedBaselineEvidence({
    id: "imported-baseline-1",
    sampleSize: 200,
  });

  assert.equal(evidence.sourceType, "imported_historical_baseline");
  assert.equal(evidence.origin, "historical_import");
  assert.equal(evidence.trustLevel, "directional_context");
  assert.equal(isImportedEvidence(evidence), true);
  assert.equal(canUseAsPrimaryDiagnosisEvidence(evidence), false);
  assert.equal(canUseAsSupportingDiagnosisEvidence(evidence), true);
  assert.ok(evidence.prohibitedUses.includes("discipline_enforcement"));
  assert.ok(evidence.prohibitedUses.includes("high_confidence_diagnosis"));
  assert.match(getEvidenceUserFacingLabel(evidence), /Imported Historical Baseline/);
});

test("sample size alone cannot upgrade imported evidence to diagnosis_grade", () => {
  const evidence = createImportedBaselineEvidence({
    confidence: "high",
    id: "large-imported-sample",
    sampleSize: 10_000,
    trustLevel: "diagnosis_grade",
  });

  assert.notEqual(evidence.trustLevel, "diagnosis_grade");
  assert.equal(canUseAsPrimaryDiagnosisEvidence(evidence), false);
});

test("imported session evidence cannot be primary diagnosis evidence or enforce discipline", () => {
  const evidence = createImportedSessionEvidence({
    id: "imported-session-1",
    relatedSessionIds: ["session-1"],
    relatedTradeIds: ["trade-1"],
  });

  assert.equal(isImportedEvidence(evidence), true);
  assert.equal(canUseAsPrimaryDiagnosisEvidence(evidence), false);
  assert.equal(canUseForDisciplineEnforcement(evidence), false);
  assert.throws(() => assertNoImportedPrimaryDiagnosis([{ ...evidence, allowedUses: ["operator_diagnosis_primary"] }]));
});

test("debug evidence cannot be user-facing diagnosis", () => {
  const evidence = createDebugOnlyEvidence({
    allowedUses: ["operator_diagnosis_primary", "debug_audit"],
    id: "debug-1",
  });

  assert.equal(isDebugOnlyEvidence(evidence), true);
  assert.equal(canUseAsPrimaryDiagnosisEvidence(evidence), false);
  assert.equal(evidence.allowedUses.includes("operator_diagnosis_primary"), false);
  assert.throws(() =>
    assertNoDebugUserFacingDiagnosis([{ ...evidence, allowedUses: ["operator_diagnosis_supporting"] }]),
  );
});

test("native discipline evidence can enforce discipline only when diagnosis-grade", () => {
  const evidence = createNativeDisciplineEvidence({
    id: "discipline-1",
  });

  assert.equal(canUseForDisciplineEnforcement(evidence), true);

  const weakEvidence = createNativeDisciplineEvidence({
    confidence: "low",
    id: "discipline-weak",
    trustLevel: "weak_signal",
  });

  assert.equal(canUseForDisciplineEnforcement(weakEvidence), false);
});

test("imported session adapter preserves labels, source warnings, and prohibited uses", () => {
  const evidence = mapImportedSessionToDiagnosisEvidence(session(), {
    sourceWarnings: [
      {
        code: "order-cap-hit",
        detail: "historical orders capped",
        severity: "warning",
      },
    ],
  });

  assert.equal(evidence.sourceType, "imported_historical_baseline");
  assert.equal(evidence.trustLevel, "weak_signal");
  assert.deepEqual(evidence.relatedSessionIds, ["session-1"]);
  assert.deepEqual(evidence.relatedTradeIds, ["trade-1"]);
  assert.equal(evidence.sourceWarnings[0]?.code, "order-cap-hit");
  assert.match(evidence.userFacingLabel, /Imported Historical Baseline/);
  assert.match(evidence.userFacingLabel, /Directional context/);
  assert.match(evidence.userFacingLabel, /Not diagnosis-grade yet/);
  assert.ok(evidence.prohibitedUses.includes("native_journal_claim"));
  assert.ok(evidence.prohibitedUses.includes("automatic_trade_blocking"));
  assert.equal(canUseAsPrimaryDiagnosisEvidence(evidence), false);
});

test("medium-confidence imported session adapter can be supporting context only", () => {
  const evidence = mapImportedSessionToDiagnosisEvidence(
    session({
      closedTrades: 3,
      confidence: "medium",
      confidenceReasons: ["Complete imported session, still external context."],
    }),
  );

  assert.equal(evidence.trustLevel, "directional_context");
  assert.equal(canUseAsSupportingDiagnosisEvidence(evidence), true);
  assert.equal(canUseAsPrimaryDiagnosisEvidence(evidence), false);
});
