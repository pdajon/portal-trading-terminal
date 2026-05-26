import test from "node:test";
import assert from "node:assert/strict";
import { deriveOperatorDiagnosisV1 } from "./operator-diagnosis";
import type { JournalMemoryEvent } from "@/features/journal/lib/journal-memory-events";
import type { NativeSessionV1 } from "./native-session-contract";
import { createImportedBaselineEvidence, createNativeJournalEvidence } from "./diagnosis-evidence";
import { deriveDiagnosisRealtimeWarningsV1 } from "./diagnosis-realtime-warnings";

function trade(
  overrides: Partial<Parameters<typeof deriveOperatorDiagnosisV1>[0]["journalEntries"][number]> = {},
): Parameters<typeof deriveOperatorDiagnosisV1>[0]["journalEntries"][number] {
  return {
    entrySource: "Market",
    id: "trade-1",
    planFollowed: "followed",
    realizedPnl: 50,
    relatedSessionLogIds: [],
    replayMetadata: { frames: [] },
    setupQualityRating: 4,
    status: "closed",
    symbol: "BTC-USD",
    timestamp: "2026-05-01T14:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<JournalMemoryEvent> = {}): JournalMemoryEvent {
  return {
    id: "event-1",
    journalEntryId: "trade-1",
    source: "journal",
    timestamp: "2026-05-01T14:00:00.000Z",
    type: "trade_closed",
    ...overrides,
  };
}

function nativeSession(overrides: Partial<NativeSessionV1> = {}): NativeSessionV1 {
  const id = overrides.id ?? "native-session:operator-test";
  const relatedTradeIds = overrides.relatedTradeIds ?? ["native-1", "native-2"];

  return {
    accountAddress: "0x1111111111111111111111111111111111111111",
    aiWarningDismissedCount: 0,
    aiWarningShownCount: 0,
    allowedUses: ["operator_diagnosis_primary", "operator_diagnosis_supporting", "ai_coach_context", "investigation_prompt"],
    assetMix: { BTC: { netPnl: -75, tradeCount: 2 } },
    averageHoldMinutes: 18,
    bestTradeId: "native-2",
    closedTrades: 2,
    confidence: "medium",
    confidenceReasons: ["Native session satisfies diagnosis-grade contract gates."],
    diagnosisReadiness: "diagnosis_grade",
    directionMix: { long: { netPnl: -75, tradeCount: 2 } },
    disciplineViolationCount: 0,
    endedAt: Date.parse("2026-05-23T15:00:00.000Z"),
    environment: "mainnet",
    evidence: [
      createNativeJournalEvidence({
        confidence: "medium",
        id: "native-session-journal-evidence",
        relatedSessionIds: [id],
        relatedTradeIds,
      }),
    ],
    fees: 1,
    firstTradeResult: "loss",
    funding: 0,
    grossPnlBeforeFees: -74,
    id,
    lastTradeResult: "loss",
    localDateKey: "2026-05-23",
    losses: 2,
    manualExecutionCount: 0,
    maxConsecutiveLosses: 2,
    maxConsecutiveWins: 0,
    netPnlAfterFeesAndFunding: -75,
    openTrades: 0,
    plannedExecutionCount: 0,
    postLossReentryCount: 1,
    prohibitedUses: ["discipline_enforcement"],
    protectedTradeCount: 2,
    relatedAiWarningIds: [],
    relatedDisciplineEventIds: [],
    relatedExecutionEventIds: [],
    relatedJournalEntryIds: relatedTradeIds,
    relatedTradeIds,
    sessionType: "regular",
    shortGapTradeCount: 1,
    source: "portal_native",
    startedAt: Date.parse("2026-05-23T14:00:00.000Z"),
    tags: ["post_loss"],
    timezone: "America/Chicago",
    totalTimeInMarketMinutes: 36,
    totalTrades: 2,
    unprotectedTradeCount: 0,
    walletAddress: "0x2222222222222222222222222222222222222222",
    winRate: 0,
    wins: 0,
    worstTradeId: "native-1",
    ...overrides,
  };
}

test("returns empty diagnosis when evidence is insufficient", () => {
  const diagnosis = deriveOperatorDiagnosisV1({ journalEntries: [], journalMemoryEvents: [] });

  assert.equal(diagnosis.sampleSize, 0);
  assert.equal(diagnosis.confidence, "low");
  assert.equal(diagnosis.profitLeaks.length, 0);
  assert.equal(diagnosis.profitableBehaviors.length, 0);
  assert.equal(diagnosis.recommendedPlan.rules.length, 0);
});

test("detects post-loss behavior and recommends cooldown after loss", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "loss-1", realizedPnl: -80, timestamp: "2026-05-01T14:00:00.000Z" }),
      trade({ id: "after-loss-1", realizedPnl: -40, timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "loss-2", realizedPnl: -60, timestamp: "2026-05-02T14:00:00.000Z" }),
      trade({ id: "after-loss-2", realizedPnl: -30, timestamp: "2026-05-02T15:00:00.000Z" }),
      trade({ id: "normal-win", realizedPnl: 120, timestamp: "2026-05-03T14:00:00.000Z" }),
    ],
    journalMemoryEvents: [],
  });

  assert.ok(diagnosis.profitLeaks.some((finding) => finding.category === "post_loss_behavior"));
  assert.ok(
    diagnosis.recommendedPlan.rules.some((rule) => rule.ruleType === "cooldown_after_loss"),
  );
});

test("detects repeated Override Bonds", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "t1" }),
      trade({ id: "t2", timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "t3", timestamp: "2026-05-01T16:00:00.000Z" }),
      trade({ id: "t4", timestamp: "2026-05-01T17:00:00.000Z" }),
      trade({ id: "t5", timestamp: "2026-05-01T18:00:00.000Z" }),
    ],
    journalMemoryEvents: [
      event({ id: "override-1", journalEntryId: "t2", type: "discipline_override_bond_posted" }),
      event({ id: "override-2", journalEntryId: "t4", type: "discipline_override_bond_posted" }),
    ],
  });

  assert.ok(diagnosis.profitLeaks.some((finding) => finding.category === "override_bond"));
});

test("detects ignored or dismissed AI warnings", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "t1", realizedPnl: -20 }),
      trade({ id: "t2", timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "t3", timestamp: "2026-05-01T16:00:00.000Z" }),
      trade({ id: "t4", timestamp: "2026-05-01T17:00:00.000Z" }),
      trade({ id: "t5", timestamp: "2026-05-01T18:00:00.000Z" }),
    ],
    journalMemoryEvents: [
      event({ id: "ai-1", journalEntryId: "t1", source: "ai_coach", type: "ai_warning_ignored" }),
    ],
  });

  assert.ok(diagnosis.profitLeaks.some((finding) => finding.category === "ai_warning_ignored"));
});

test("detects broken plans", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "broken-1", planFollowed: "broken", realizedPnl: -80 }),
      trade({ id: "broken-2", planFollowed: "broken", realizedPnl: -30, timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "t3", timestamp: "2026-05-01T16:00:00.000Z" }),
      trade({ id: "t4", timestamp: "2026-05-01T17:00:00.000Z" }),
      trade({ id: "t5", timestamp: "2026-05-01T18:00:00.000Z" }),
    ],
    journalMemoryEvents: [],
  });

  assert.ok(diagnosis.profitLeaks.some((finding) => finding.category === "plan_broken"));
});

test("detects weak time window and recommends blocked time window", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "bad-1", realizedPnl: -80, timestamp: "2026-05-01T21:00:00.000Z" }),
      trade({ id: "bad-2", realizedPnl: -40, timestamp: "2026-05-02T21:20:00.000Z" }),
      trade({ id: "good-1", realizedPnl: 80, timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "good-2", realizedPnl: 60, timestamp: "2026-05-02T16:00:00.000Z" }),
      trade({ id: "good-3", realizedPnl: 40, timestamp: "2026-05-03T17:00:00.000Z" }),
    ],
    journalMemoryEvents: [],
  });

  assert.ok(diagnosis.profitLeaks.some((finding) => finding.category === "time_window"));
  assert.ok(
    diagnosis.recommendedPlan.rules.some((rule) => rule.ruleType === "blocked_time_window"),
  );
});

test("detects manual entry weakness when metadata supports it", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "manual-1", entrySource: "Market", realizedPnl: -80 }),
      trade({ id: "manual-2", entrySource: "Market", realizedPnl: -30, timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "planned-1", entrySource: "Limit", realizedPnl: 70, timestamp: "2026-05-01T16:00:00.000Z" }),
      trade({ id: "planned-2", entrySource: "Order Zone", realizedPnl: 60, timestamp: "2026-05-01T17:00:00.000Z" }),
      trade({ id: "planned-3", entrySource: "Close Trigger", realizedPnl: 50, timestamp: "2026-05-01T18:00:00.000Z" }),
    ],
    journalMemoryEvents: [],
  });

  assert.ok(diagnosis.profitLeaks.some((finding) => finding.category === "manual_entry"));
});

test("detects positive behavior", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "followed-1", planFollowed: "followed", realizedPnl: 80 }),
      trade({ id: "followed-2", planFollowed: "followed", realizedPnl: 60, timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "broken-1", planFollowed: "broken", realizedPnl: -40, timestamp: "2026-05-01T16:00:00.000Z" }),
      trade({ id: "unclear-1", planFollowed: "unclear", realizedPnl: -20, timestamp: "2026-05-01T17:00:00.000Z" }),
      trade({ id: "unclear-2", planFollowed: "unclear", realizedPnl: -10, timestamp: "2026-05-01T18:00:00.000Z" }),
    ],
    journalMemoryEvents: [],
  });

  assert.ok(diagnosis.profitableBehaviors.some((finding) => finding.category === "setup_quality"));
});

test("recommends max trades rule when overtrading pattern exists", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "day-1", realizedPnl: -30, timestamp: "2026-05-01T14:00:00.000Z" }),
      trade({ id: "day-2", realizedPnl: -20, timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "day-3", realizedPnl: -10, timestamp: "2026-05-01T16:00:00.000Z" }),
      trade({ id: "day-4", realizedPnl: -40, timestamp: "2026-05-01T17:00:00.000Z" }),
      trade({ id: "day-5", realizedPnl: 10, timestamp: "2026-05-01T18:00:00.000Z" }),
    ],
    journalMemoryEvents: [],
  });

  assert.ok(diagnosis.recommendedPlan.rules.some((rule) => rule.ruleType === "max_trades_per_day"));
});

test("orders recommended rules by optimization priority", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "bad-hour-1", realizedPnl: -100, timestamp: "2026-05-01T21:00:00.000Z" }),
      trade({ id: "bad-hour-2", realizedPnl: -80, timestamp: "2026-05-02T21:00:00.000Z" }),
      trade({ id: "post-loss-source", realizedPnl: -5, timestamp: "2026-05-03T14:00:00.000Z" }),
      trade({ id: "post-loss-next", realizedPnl: -10, timestamp: "2026-05-03T15:00:00.000Z" }),
      trade({ id: "win", realizedPnl: 50, timestamp: "2026-05-04T14:00:00.000Z" }),
    ],
    journalMemoryEvents: [],
  });

  assert.equal(diagnosis.recommendedPlan.rules[0]?.ruleType, "blocked_time_window");
});

test("uses low confidence for low sample size", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [trade({ id: "t1" }), trade({ id: "t2" }), trade({ id: "t3" }), trade({ id: "t4" })],
    journalMemoryEvents: [],
  });

  assert.equal(diagnosis.confidence, "low");
  assert.match(diagnosis.recommendedPlan.expectedBenefit, /Early signal|Not enough data yet/);
});

test("ignores imported baseline trades", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [
      trade({ id: "imported-1", dataSource: "imported", realizedPnl: -100 }),
      trade({ id: "imported-2", dataSource: "imported", realizedPnl: -100, timestamp: "2026-05-01T15:00:00.000Z" }),
      trade({ id: "native-1", dataSource: "native", realizedPnl: 25, timestamp: "2026-05-01T16:00:00.000Z" }),
    ],
    journalMemoryEvents: [],
  });

  assert.equal(diagnosis.sampleSize, 1);
  assert.equal(diagnosis.profitLeaks.length, 0);
});

test("can opt imported baseline trades into diagnosis evidence", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    includeImportedEntries: true,
    journalEntries: [
      trade({ id: "imported-1", dataSource: "imported", realizedPnl: -100 }),
      trade({
        id: "imported-2",
        dataSource: "imported",
        realizedPnl: -50,
        timestamp: "2026-05-01T15:00:00.000Z",
      }),
    ],
    journalMemoryEvents: [],
  });

  assert.equal(diagnosis.sampleSize, 2);
  assert.equal(diagnosis.confidence, "low");
});

test("imported baseline sample size alone cannot create high-confidence diagnosis", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    includeImportedEntries: true,
    journalEntries: Array.from({ length: 24 }, (_, index) =>
      trade({
        dataSource: "imported",
        id: `imported-${index}`,
        realizedPnl: -20,
        sourceType: "imported",
        timestamp: `2026-05-${String((index % 20) + 1).padStart(2, "0")}T14:00:00.000Z`,
        userFacingLabel: "Imported Historical Baseline / Directional context / Not diagnosis-grade yet",
      }),
    ),
    journalMemoryEvents: [],
  });

  assert.equal(diagnosis.sampleSize, 24);
  assert.equal(diagnosis.confidence, "low");
});

test("diagnosis-grade native sessions appear as separate review-only candidates", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [],
    journalMemoryEvents: [],
    nativeSessions: [nativeSession()],
  });

  assert.equal(diagnosis.profitLeaks.length, 0);
  assert.equal(diagnosis.recommendedPlan.rules.length, 0);
  assert.equal(diagnosis.nativeSessionReviewCandidates.length, 1);
  assert.equal(diagnosis.nativeSessionReviewCandidates[0]?.topic, "post_loss_reentry_damage");
  assert.equal(diagnosis.nativeSessionReviewCandidates[0]?.reviewOnly, true);
});

test("imported native-session-shaped evidence cannot create review candidates", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [],
    journalMemoryEvents: [],
    nativeSessions: [
      nativeSession({
        evidence: [createImportedBaselineEvidence({ confidence: "high", id: "imported-session-evidence" })],
      }),
    ],
  });

  assert.equal(diagnosis.nativeSessionReviewCandidates.length, 0);
});

test("native session review candidates do not create realtime warnings", () => {
  const diagnosis = deriveOperatorDiagnosisV1({
    journalEntries: [],
    journalMemoryEvents: [],
    nativeSessions: [nativeSession()],
  });
  const warnings = deriveDiagnosisRealtimeWarningsV1({
    activeDisciplineState: {
      cooldownAfterLossMinutes: null,
      maxTradesPerDay: null,
      minRiskReward: null,
      tradesPlacedToday: 0,
    },
    currentAction: {
      actionType: "open_position",
      riskIncreasing: true,
      source: "manual",
      symbol: "BTC-USD",
    },
    diagnosis,
    journalEntries: [],
    journalMemoryEvents: [],
    now: "2026-05-24T15:00:00.000Z",
  });

  assert.deepEqual(warnings, []);
});
