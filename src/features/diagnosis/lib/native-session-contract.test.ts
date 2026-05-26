import assert from "node:assert/strict";
import test from "node:test";
import {
  canBecomeDiagnosisGradeNativeSession,
  canFeedPrimaryOperatorDiagnosis,
  canSuggestDisciplinePlanReview,
  canTriggerRealtimeWarning,
  createNativeSessionId,
  explainNativeSessionLimitations,
  type NativeSessionV1,
} from "./native-session-contract";
import {
  createDebugOnlyEvidence,
  createImportedBaselineEvidence,
  createNativeJournalEvidence,
} from "./diagnosis-evidence";

function nativeSession(overrides: Partial<NativeSessionV1> = {}): NativeSessionV1 {
  const evidence = [
    createNativeJournalEvidence({
      confidence: "high",
      id: "native-journal-evidence-1",
      relatedTradeIds: ["trade-1", "trade-2"],
    }),
  ];

  return {
    accountAddress: "0x1111111111111111111111111111111111111111",
    aiWarningDismissedCount: 0,
    aiWarningShownCount: 1,
    allowedUses: ["operator_diagnosis_primary", "operator_diagnosis_supporting", "ai_coach_context", "investigation_prompt"],
    assetMix: { BTC: { netPnl: 55, tradeCount: 2 } },
    averageHoldMinutes: 22,
    bestTradeId: "trade-2",
    closedTrades: 2,
    confidence: "high",
    confidenceReasons: ["Native closed trades are linked to Portal Journal evidence."],
    diagnosisReadiness: "diagnosis_grade",
    directionMix: {
      long: { netPnl: 55, tradeCount: 2 },
      short: { netPnl: 0, tradeCount: 0 },
    },
    disciplineViolationCount: 0,
    endedAt: Date.parse("2026-05-23T15:00:00.000Z"),
    environment: "mainnet",
    evidence,
    fees: 4,
    firstTradeResult: "loss",
    funding: 0,
    grossPnlBeforeFees: 59,
    id: "native-session:placeholder",
    lastTradeResult: "win",
    localDateKey: "2026-05-23",
    losses: 1,
    manualExecutionCount: 1,
    maxConsecutiveLosses: 1,
    maxConsecutiveWins: 1,
    netPnlAfterFeesAndFunding: 55,
    openTrades: 0,
    plannedExecutionCount: 1,
    postLossReentryCount: 1,
    prohibitedUses: ["discipline_enforcement"],
    protectedTradeCount: 1,
    relatedAiWarningIds: ["warning-1"],
    relatedDisciplineEventIds: [],
    relatedExecutionEventIds: ["execution-1"],
    relatedJournalEntryIds: ["journal-1", "journal-2"],
    relatedTradeIds: ["trade-1", "trade-2"],
    sessionType: "regular",
    shortGapTradeCount: 1,
    source: "portal_native",
    startedAt: Date.parse("2026-05-23T14:00:00.000Z"),
    tags: ["post_loss"],
    timezone: "America/Chicago",
    totalTimeInMarketMinutes: 44,
    totalTrades: 2,
    unprotectedTradeCount: 1,
    walletAddress: "0x2222222222222222222222222222222222222222",
    winRate: 0.5,
    wins: 1,
    worstTradeId: "trade-1",
    ...overrides,
  };
}

test("valid native session can become diagnosis grade and feed primary Operator Diagnosis", () => {
  const session = nativeSession();

  assert.equal(canBecomeDiagnosisGradeNativeSession(session), true);
  assert.equal(canFeedPrimaryOperatorDiagnosis(session), true);
});

test("imported source cannot become diagnosis grade native session", () => {
  const session = nativeSession({
    evidence: [createImportedBaselineEvidence({ confidence: "high", id: "imported-evidence", relatedTradeIds: ["trade-1", "trade-2"] })],
    source: "historical_import" as NativeSessionV1["source"],
  });

  assert.equal(canBecomeDiagnosisGradeNativeSession(session), false);
  assert.match(explainNativeSessionLimitations(session).join(" "), /portal-native/i);
});

test("missing or invalid timezone blocks time and session diagnosis", () => {
  const session = nativeSession({ timezone: "Not/A_Real_Timezone" });

  assert.equal(canBecomeDiagnosisGradeNativeSession(session), false);
  assert.match(explainNativeSessionLimitations(session).join(" "), /timezone/i);
});

test("fewer than two closed native trades blocks session-level diagnosis", () => {
  const session = nativeSession({ closedTrades: 1, relatedTradeIds: ["trade-1"], totalTrades: 1 });

  assert.equal(canBecomeDiagnosisGradeNativeSession(session), false);
  assert.match(explainNativeSessionLimitations(session).join(" "), /2 closed native trades/i);
});

test("insufficient evidence blocks diagnosis-grade use", () => {
  const session = nativeSession({
    confidence: "insufficient_evidence",
    diagnosisReadiness: "insufficient_evidence",
  });

  assert.equal(canBecomeDiagnosisGradeNativeSession(session), false);
  assert.equal(canFeedPrimaryOperatorDiagnosis(session), false);
});

test("Discipline Plan review requires diagnosis-grade native evidence", () => {
  const session = nativeSession();
  const weakSession = nativeSession({ confidence: "low", diagnosisReadiness: "directional_context" });

  assert.equal(canSuggestDisciplinePlanReview(session), true);
  assert.equal(canSuggestDisciplinePlanReview(weakSession), false);
});

test("realtime warning gate rejects imported-only evidence and requires explicit rule support", () => {
  const importedOnlySession = nativeSession({
    evidence: [createImportedBaselineEvidence({ confidence: "high", id: "imported-only" })],
  });

  assert.equal(canTriggerRealtimeWarning(nativeSession(), { explicitRuleSupport: false }), false);
  assert.equal(canTriggerRealtimeWarning(importedOnlySession, { explicitRuleSupport: true }), false);
  assert.equal(canTriggerRealtimeWarning(nativeSession(), { explicitRuleSupport: true }), true);
});

test("native session ID is stable for same membership regardless of order", () => {
  const idA = createNativeSessionId({
    accountAddress: "0x1111111111111111111111111111111111111111",
    environment: "mainnet",
    eventIds: ["event-2", "event-1"],
    localDateKey: "2026-05-23",
    startedAt: Date.parse("2026-05-23T14:00:00.000Z"),
    tradeIds: ["trade-2", "trade-1"],
    walletAddress: null,
  });
  const idB = createNativeSessionId({
    accountAddress: "0x1111111111111111111111111111111111111111",
    environment: "mainnet",
    eventIds: ["event-1", "event-2"],
    localDateKey: "2026-05-23",
    startedAt: Date.parse("2026-05-23T14:00:00.000Z"),
    tradeIds: ["trade-1", "trade-2"],
    walletAddress: null,
  });

  assert.equal(idA, idB);
  assert.match(idA, /^native-session:0x1111111111111111111111111111111111111111:mainnet:2026-05-23:1779544800000:/);
});

test("native session ID changes when membership changes", () => {
  const baseId = createNativeSessionId({
    accountAddress: "0x1111111111111111111111111111111111111111",
    environment: "mainnet",
    eventIds: ["event-1"],
    localDateKey: "2026-05-23",
    startedAt: Date.parse("2026-05-23T14:00:00.000Z"),
    tradeIds: ["trade-1"],
    walletAddress: null,
  });
  const changedId = createNativeSessionId({
    accountAddress: "0x1111111111111111111111111111111111111111",
    environment: "mainnet",
    eventIds: ["event-1"],
    localDateKey: "2026-05-23",
    startedAt: Date.parse("2026-05-23T14:00:00.000Z"),
    tradeIds: ["trade-1", "trade-2"],
    walletAddress: null,
  });

  assert.notEqual(baseId, changedId);
});

test("debug-only evidence is rejected from user-facing native session evidence", () => {
  const session = nativeSession({
    evidence: [createDebugOnlyEvidence({ id: "debug-evidence" })],
  });

  assert.equal(canBecomeDiagnosisGradeNativeSession(session), false);
  assert.match(explainNativeSessionLimitations(session).join(" "), /debug-only/i);
});
