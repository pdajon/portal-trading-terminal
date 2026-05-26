import assert from "node:assert/strict";
import test from "node:test";
import {
  mapNativeSessionsToDiagnosisFindings,
  type NativeSessionDiagnosisFinding,
} from "./native-session-diagnosis";
import type { NativeSessionV1 } from "./native-session-contract";
import {
  createDebugOnlyEvidence,
  createImportedBaselineEvidence,
  createNativeAiWarningEvidence,
  createNativeDisciplineEvidence,
  createNativeJournalEvidence,
} from "./diagnosis-evidence";

function nativeSession(overrides: Partial<NativeSessionV1> = {}): NativeSessionV1 {
  const startedAt = Date.parse("2026-05-23T14:00:00.000Z");
  const endedAt = Date.parse("2026-05-23T15:00:00.000Z");
  const id = overrides.id ?? "native-session:test";
  const relatedTradeIds = overrides.relatedTradeIds ?? ["trade-1", "trade-2"];

  return {
    accountAddress: "0x1111111111111111111111111111111111111111",
    aiWarningDismissedCount: 0,
    aiWarningShownCount: 0,
    allowedUses: ["operator_diagnosis_primary", "operator_diagnosis_supporting", "ai_coach_context", "investigation_prompt"],
    assetMix: { BTC: { netPnl: -90, tradeCount: 2 } },
    averageHoldMinutes: 20,
    bestTradeId: "trade-2",
    closedTrades: 2,
    confidence: "medium",
    confidenceReasons: ["Native session satisfies diagnosis-grade contract gates."],
    diagnosisReadiness: "diagnosis_grade",
    directionMix: { long: { netPnl: -90, tradeCount: 2 } },
    disciplineViolationCount: 0,
    endedAt,
    environment: "mainnet",
    evidence: [
      createNativeJournalEvidence({
        confidence: "medium",
        id: "native-journal-evidence",
        relatedSessionIds: [id],
        relatedTradeIds,
      }),
    ],
    fees: 2,
    firstTradeResult: "loss",
    funding: 0,
    grossPnlBeforeFees: -88,
    id,
    lastTradeResult: "loss",
    localDateKey: "2026-05-23",
    losses: 2,
    manualExecutionCount: 0,
    maxConsecutiveLosses: 2,
    maxConsecutiveWins: 0,
    netPnlAfterFeesAndFunding: -90,
    openTrades: 0,
    plannedExecutionCount: 0,
    postLossReentryCount: 0,
    prohibitedUses: ["discipline_enforcement"],
    protectedTradeCount: 2,
    relatedAiWarningIds: [],
    relatedDisciplineEventIds: [],
    relatedExecutionEventIds: [],
    relatedJournalEntryIds: relatedTradeIds,
    relatedTradeIds,
    sessionType: "regular",
    shortGapTradeCount: 0,
    source: "portal_native",
    startedAt,
    tags: [],
    timezone: "America/Chicago",
    totalTimeInMarketMinutes: 40,
    totalTrades: 2,
    unprotectedTradeCount: 0,
    walletAddress: "0x2222222222222222222222222222222222222222",
    winRate: 0,
    wins: 0,
    worstTradeId: "trade-1",
    ...overrides,
  };
}

function assertReviewOnly(finding: NativeSessionDiagnosisFinding) {
  assert.equal(finding.reviewOnly, true);
  assert.equal(finding.sourceType, "native");
  assert.equal(finding.prohibitedActions.includes("automatic_trade_blocking"), true);
  assert.equal(finding.prohibitedActions.includes("automatic_discipline_activation"), true);
  assert.equal(finding.prohibitedActions.includes("imported_only_enforcement"), true);
  assert.equal(finding.labels.includes("Native Portal evidence"), true);
  assert.equal(finding.labels.includes("Review-only"), true);
}

test("no native sessions returns no findings", () => {
  assert.deepEqual(mapNativeSessionsToDiagnosisFindings([]), []);
});

test("unsafe and directional-only sessions do not create findings", () => {
  const findings = mapNativeSessionsToDiagnosisFindings([
    nativeSession({ diagnosisReadiness: "directional_only", closedTrades: 1, relatedTradeIds: ["trade-1"] }),
    nativeSession({ diagnosisReadiness: "unsafe_not_enough_evidence", confidence: "insufficient_evidence", timezone: null }),
  ]);

  assert.deepEqual(findings, []);
});

test("diagnosis-grade native post-loss session creates a review-only finding", () => {
  const [finding] = mapNativeSessionsToDiagnosisFindings([
    nativeSession({
      postLossReentryCount: 1,
      shortGapTradeCount: 1,
      tags: ["post_loss", "rapid_reentry"],
    }),
  ]);

  assert.equal(finding?.topic, "post_loss_reentry_damage");
  assert.match(finding?.summary ?? "", /Review candidate/i);
  assertReviewOnly(finding);
});

test("high-density native session creates a review-only finding", () => {
  const [finding] = mapNativeSessionsToDiagnosisFindings([
    nativeSession({ tags: ["high_density"], totalTrades: 6 }),
  ]);

  assert.equal(finding?.topic, "high_density_session_damage");
  assertReviewOnly(finding);
});

test("discipline violation native session creates a review-only finding", () => {
  const session = nativeSession({
    disciplineViolationCount: 1,
    evidence: [
      createNativeJournalEvidence({ id: "native-journal-evidence", relatedTradeIds: ["trade-1", "trade-2"] }),
      createNativeDisciplineEvidence({ id: "native-discipline-evidence", relatedTradeIds: ["trade-1", "trade-2"] }),
    ],
    relatedDisciplineEventIds: ["discipline-1"],
    tags: ["discipline_violation"],
  });

  const [finding] = mapNativeSessionsToDiagnosisFindings([session]);

  assert.equal(finding?.topic, "discipline_violation_session");
  assertReviewOnly(finding);
});

test("planned execution edge creates a positive finding", () => {
  const [finding] = mapNativeSessionsToDiagnosisFindings([
    nativeSession({
      firstTradeResult: "win",
      lastTradeResult: "win",
      losses: 0,
      netPnlAfterFeesAndFunding: 120,
      plannedExecutionCount: 2,
      tags: ["planned_execution"],
      winRate: 1,
      wins: 2,
    }),
  ]);

  assert.equal(finding?.topic, "planned_execution_edge");
  assert.equal(finding?.severity, "positive");
  assertReviewOnly(finding);
});

test("manual impulse, unprotected, warning dismissal, overnight, and weekend topics are supported", () => {
  const findings = mapNativeSessionsToDiagnosisFindings([
    nativeSession({ manualExecutionCount: 2, tags: ["manual_impulse"] }),
    nativeSession({ id: "native-session:unprotected", relatedTradeIds: ["u1", "u2"], tags: ["unprotected"], unprotectedTradeCount: 2 }),
    nativeSession({
      aiWarningDismissedCount: 1,
      evidence: [
        createNativeJournalEvidence({ id: "native-journal-evidence", relatedTradeIds: ["w1", "w2"] }),
        createNativeAiWarningEvidence({ id: "native-ai-warning-evidence", relatedTradeIds: ["w1", "w2"] }),
      ],
      id: "native-session:warning",
      relatedAiWarningIds: ["warning-1"],
      relatedTradeIds: ["w1", "w2"],
      tags: ["ai_warning"],
    }),
    nativeSession({ id: "native-session:overnight", relatedTradeIds: ["o1", "o2"], tags: ["overnight"] }),
    nativeSession({ id: "native-session:weekend", relatedTradeIds: ["we1", "we2"], tags: ["weekend"] }),
  ]);

  assert.deepEqual(
    findings.map((finding) => finding.topic),
    [
      "manual_impulse_session",
      "unprotected_trade_session",
      "warning_dismissal_session",
      "overnight_native_session",
      "weekend_native_session",
    ],
  );
});

test("imported and debug evidence cannot create findings", () => {
  const findings = mapNativeSessionsToDiagnosisFindings([
    nativeSession({
      evidence: [createImportedBaselineEvidence({ confidence: "high", id: "imported-evidence" })],
      tags: ["post_loss"],
    }),
    nativeSession({
      evidence: [createDebugOnlyEvidence({ id: "debug-evidence" })],
      tags: ["high_density"],
    }),
  ]);

  assert.deepEqual(findings, []);
});

test("findings include evidence labels and prohibited actions", () => {
  const [finding] = mapNativeSessionsToDiagnosisFindings([
    nativeSession({ tags: ["high_density"], totalTrades: 6 }),
  ]);

  assert.ok(finding);
  assert.equal(finding.evidence[0]?.userFacingLabel, "Native Journal evidence");
  assertReviewOnly(finding);
});
