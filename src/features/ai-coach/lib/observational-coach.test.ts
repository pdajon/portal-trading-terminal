import test from "node:test";
import assert from "node:assert/strict";
import { deriveObservationalCoachV1 } from "./observational-coach";
import type { BaselineMetricRow, BaselineProfile, SessionIntelligenceResult } from "@/features/baseline-import/types";
import type { ImportedSessionSupportingContext } from "@/features/diagnosis/lib/imported-session-supporting-context";
import type { EvidenceComparisonResult } from "@/features/diagnosis/lib/evidence-comparison";
import type { OperatorDiagnosis } from "@/features/diagnosis/lib/operator-diagnosis";

function createMetricRow<Key extends string>(row: Omit<BaselineMetricRow<Key>, "sampleReliable">): BaselineMetricRow<Key> {
  return {
    ...row,
    sampleReliable: row.tradeCount >= 10,
  };
}

function createEntry(
  overrides: Partial<Parameters<typeof deriveObservationalCoachV1>[0]["journalEntries"][number]> = {},
): Parameters<typeof deriveObservationalCoachV1>[0]["journalEntries"][number] {
  return {
    entryStyle: "Hunted",
    id: "entry-1",
    realizedPnl: 20,
    relatedSessionLogIds: [],
    replayMetadata: { frames: [] },
    setupTag: "Trend Break",
    size: 0.001,
    status: "closed",
    timestamp: "2026-04-27T18:00:00.000Z",
    ...overrides,
  };
}

function createLog(
  overrides: Partial<Parameters<typeof deriveObservationalCoachV1>[0]["sessionLogEntries"][number]> = {},
): Parameters<typeof deriveObservationalCoachV1>[0]["sessionLogEntries"][number] {
  return {
    eventType: "position-closed",
    id: "log-1",
    metadata: {},
    size: null,
    symbol: null,
    timestamp: "2026-04-27T18:15:00.000Z",
    ...overrides,
  };
}

function createRuleState(
  overrides: Partial<Parameters<typeof deriveObservationalCoachV1>[0]["ruleState"]> = {},
): Parameters<typeof deriveObservationalCoachV1>[0]["ruleState"] {
  return {
    activeDisciplineRuleCount: 0,
    cooldownRemainingMs: 0,
    disciplineCurrentlyBlocked: false,
    maxDailyLoss: null,
    maxTradesPerDay: null,
    realizedPnlToday: 0,
    tradesPlacedToday: 0,
    ...overrides,
  };
}

function createBaselineProfile(overrides: Partial<BaselineProfile> = {}): BaselineProfile {
  return {
    accountAddress: "0x1111111111111111111111111111111111111111",
    byAsset: [
      createMetricRow({ averageNetPnl: 12, key: "BTC", lossCount: 1, netPnl: 24, tradeCount: 3, winCount: 2 }),
      createMetricRow({ averageNetPnl: -6, key: "ETH", lossCount: 2, netPnl: -12, tradeCount: 2, winCount: 0 }),
    ],
    byDirection: [
      createMetricRow({ averageNetPnl: 8, key: "long", lossCount: 1, netPnl: 24, tradeCount: 3, winCount: 2 }),
      createMetricRow({ averageNetPnl: -6, key: "short", lossCount: 2, netPnl: -12, tradeCount: 2, winCount: 0 }),
    ],
    byEntryStyleProxy: [
      {
        averageNetPnl: 7,
        key: "likely-hunted",
        lossCount: 1,
        netPnl: 21,
        sampleReliable: false,
        tradeCount: 3,
        winCount: 2,
      },
      {
        averageNetPnl: -4,
        key: "likely-chased",
        lossCount: 2,
        netPnl: -8,
        sampleReliable: false,
        tradeCount: 2,
        winCount: 0,
      },
    ],
    byExecutionMode: [
      createMetricRow({ averageNetPnl: 5, key: "limit", lossCount: 2, netPnl: 12, tradeCount: 4, winCount: 2 }),
      createMetricRow({ averageNetPnl: -2, key: "market", lossCount: 1, netPnl: -4, tradeCount: 1, winCount: 0 }),
    ],
    byHoldTimeBucket: [
      createMetricRow({ averageNetPnl: 9, key: "5-15m", lossCount: 1, netPnl: 18, tradeCount: 2, winCount: 1 }),
      createMetricRow({ averageNetPnl: -2, key: "<5m", lossCount: 2, netPnl: -4, tradeCount: 2, winCount: 0 }),
    ],
    byTimeOfDay: [
      createMetricRow({ averageNetPnl: 10, key: "cash", lossCount: 1, netPnl: 20, tradeCount: 2, winCount: 1 }),
      createMetricRow({ averageNetPnl: -3, key: "overnight", lossCount: 2, netPnl: -6, tradeCount: 2, winCount: 0 }),
    ],
    dataQuality: [],
    dateRange: {
      endTime: Date.parse("2026-04-28T00:00:00.000Z"),
      startTime: Date.parse("2026-03-29T00:00:00.000Z"),
      timezone: "UTC",
    },
    environment: "testnet",
    fundingContext: {
      ledgerNetFlow: 0,
      totalFundingPnl: 0.5,
    },
    sessionBehavior: {
      averageTradesPerSession: 3.5,
      maxTradesInSession: 6,
      sessionsOverFiveTrades: 1,
      shortGapTradeCount: 2,
      totalSessions: 2,
    },
    sizeAfterLoss: {
      events: [],
      flaggedCount: 1,
    },
    source: "hyperliquid",
    totals: {
      averageClosedTradeNetPnl: 2.4,
      averageHoldMinutes: 12,
      closedGrossFees: 2.5,
      closedTrades: 5,
      executionClosedPnl: 10,
      flatCount: 0,
      grossPnlBeforeFees: 14.5,
      grossFees: 3,
      lossCount: 3,
      netPnl: 12,
      openTradeFees: 0.5,
      totalTrades: 5,
      winCount: 2,
      winRate: 0.4,
    },
    version: "v1",
    ...overrides,
  };
}

function createSessionIntelligence(
  overrides: Partial<SessionIntelligenceResult["summary"]> = {},
): SessionIntelligenceResult {
  return {
    sessions: [],
    summary: {
      confidenceDistribution: {
        high: 0,
        insufficient_evidence: 0,
        low: 2,
        medium: 0,
      },
      diagnosisReadinessDistribution: {
        directional_only: 2,
        ready_for_diagnosis: 0,
        unsafe_not_enough_evidence: 0,
      },
      highDensitySessionCount: 1,
      overnightSessionCount: 1,
      postLossClusterCount: 1,
      revengeRiskCount: 0,
      sessionCount: 2,
      tagCounts: {
        high_density: 1,
        long_bias: 1,
        multi_asset: 0,
        overnight: 1,
        post_loss: 1,
        rapid_reentry: 1,
        revenge_risk: 0,
        short_bias: 0,
        weekend: 0,
      },
      topPositiveSession: {
        id: "session-positive",
        netPnlAfterFeesAndFunding: 42,
        tradeIds: ["trade-win"],
      },
      totalFees: 4,
      totalFunding: 0,
      totalSessionNetPnl: -18,
      weekendSessionCount: 0,
      worstNegativeSession: {
        id: "session-negative",
        netPnlAfterFeesAndFunding: -60,
        tradeIds: ["trade-loss"],
      },
      ...overrides,
    },
    version: "v1",
  };
}

function createDiagnosis(overrides: Partial<OperatorDiagnosis> = {}): OperatorDiagnosis {
  return {
    confidence: "medium",
    generatedAt: "2026-05-04T14:00:00.000Z",
    profitableBehaviors: [],
    profitLeaks: [
      {
        category: "manual_entry",
        evidenceEventIds: [],
        id: "finding:manual-entry",
        impact: { netPnl: -120, tradeCount: 3 },
        journalEntryIds: ["entry-1", "entry-2"],
        recommendation: "Require plan confirmation before market entry.",
        severity: "warning",
        summary: "Manual entries are underperforming.",
        title: "Manual entries underperform.",
      },
    ],
    recommendedPlan: {
      expectedBenefit: "Reduce impulse risk.",
      id: "diagnosis-plan-1",
      rules: [],
      status: "review_ready",
      summary: "Draft plan.",
      title: "Recommended Discipline Plan",
    },
    sampleSize: 8,
    ...overrides,
    nativeSessionReviewCandidates: overrides.nativeSessionReviewCandidates ?? [],
  };
}

test("returns a not-enough-data state when local history is thin", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  assert.equal(coach.state, "Not Enough Data");
  assert.equal(coach.cards.find((card) => card.id === "entry-style")?.body, "Not enough hunted/chased data yet.");
});

test("does not render a duplicate live position card inside AI Coach insights", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [createEntry()],
    livePosition: {
      direction: "long",
      protectionMissing: true,
      size: 0.0025,
      slStatus: "missing",
      stopPrice: null,
      symbol: "BTC-USD",
      targetPrice: null,
      tpStatus: "missing",
    },
    ruleState: createRuleState({ activeDisciplineRuleCount: 2 }),
    sessionLogEntries: [],
  });

  assert.equal(
    coach.cards.some((candidate) => String(candidate.id) === "live-position"),
    false,
  );
});

test("flags revenge-risk when sizing up after the most recent loss", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: {
      allocationPercent: 25,
      direction: "long",
      estimatedSize: 0.004,
      executionMode: "market",
    },
    journalEntries: [
      createEntry({
        id: "loss-1",
        realizedPnl: -40,
        relatedSessionLogIds: ["loss-1-log"],
        size: 0.0015,
        timestamp: "2026-04-27T19:00:00.000Z",
      }),
      createEntry({
        id: "older-win",
        realizedPnl: 15,
        relatedSessionLogIds: ["older-win-log"],
        size: 0.001,
        timestamp: "2026-04-27T17:00:00.000Z",
      }),
      createEntry({
        id: "peer-chased-1",
        entryStyle: "Chased",
        realizedPnl: -5,
        size: 0.001,
      }),
      createEntry({
        id: "peer-chased-2",
        entryStyle: "Chased",
        realizedPnl: -4,
        size: 0.001,
      }),
      createEntry({
        id: "peer-hunted-2",
        entryStyle: "Hunted",
        realizedPnl: 18,
        size: 0.001,
      }),
      createEntry({
        id: "peer-hunted-3",
        entryStyle: "Hunted",
        realizedPnl: 12,
        size: 0.001,
      }),
      createEntry({
        id: "peer-chased-3",
        entryStyle: "Chased",
        realizedPnl: -3,
        size: 0.001,
      }),
    ],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({ id: "loss-1-log", timestamp: "2026-04-27T19:20:00.000Z" }),
      createLog({ id: "older-win-log", timestamp: "2026-04-27T17:20:00.000Z" }),
    ],
  });

  const card = coach.cards.find((candidate) => candidate.id === "behavior-risk");
  assert.equal(card?.state, "Warning");
  assert.equal(card?.body, "You are trading after a loss. Size discipline matters here.");
});

test("warns when trader is near the max trades per session rule", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [createEntry()],
    livePosition: null,
    ruleState: createRuleState({
      activeDisciplineRuleCount: 1,
      maxTradesPerDay: 5,
      tradesPlacedToday: 4,
    }),
    sessionLogEntries: [createLog({ eventType: "discipline-rule-blocked", id: "block-1" })],
  });

  const card = coach.cards.find((candidate) => candidate.id === "behavior-risk");
  assert.equal(card?.state, "Warning");
  assert.equal(card?.body, "You are near your max trades for the session.");
});

test("adds baseline-powered historical cards when a saved baseline exists", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: createBaselineProfile(),
    currentIntent: null,
    journalEntries: [createEntry(), createEntry({ id: "entry-2", realizedPnl: -12, entryStyle: "Chased" })],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  assert.equal(coach.cards.find((card) => card.id === "baseline-performance")?.state, "Insight Available");
  assert.equal(coach.cards.find((card) => card.id === "baseline-risk")?.state, "Warning");
  assert.match(coach.cards.find((card) => card.id === "baseline-entry-proxy")?.body ?? "", /proxy/i);
  assert.equal(coach.cards.find((card) => card.id === "baseline-vs-portal")?.state, "Insight Available");
});

test("directional-only session baseline cards use cautious imported-context language", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: createBaselineProfile(),
    baselineSessionIntelligence: createSessionIntelligence(),
    currentIntent: null,
    journalEntries: [createEntry(), createEntry({ id: "entry-2", realizedPnl: -12, entryStyle: "Chased" })],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  const performanceCard = coach.cards.find((card) => card.id === "baseline-performance");
  const riskCard = coach.cards.find((card) => card.id === "baseline-risk");

  assert.match(performanceCard?.body ?? "", /Directional baseline signal/i);
  assert.doesNotMatch(performanceCard?.body ?? "", /diagnosis shows/i);
  assert.ok(performanceCard?.details.includes("Imported context only"));
  assert.ok(performanceCard?.details.includes("Not diagnosis-grade yet"));
  assert.match(riskCard?.body ?? "", /Early session pattern/i);
});

test("session supporting context appears as labeled imported detail only", () => {
  const supportingContext: ImportedSessionSupportingContext = {
    allowedUses: ["ai_coach_context", "investigation_prompt", "operator_diagnosis_supporting"],
    confidence: "low",
    confidenceReasons: ["Source warnings limit imported session confidence."],
    evidenceLabel: "Imported Historical Baseline / Directional context / Not diagnosis-grade yet",
    id: "context-1",
    prohibitedUses: [
      "native_journal_claim",
      "discipline_enforcement",
      "automatic_trade_blocking",
      "high_confidence_diagnosis",
      "hard_behavior_claim",
    ],
    relatedSessionIds: ["session-1"],
    relatedTradeIds: ["trade-1"],
    sourceType: "imported_historical_baseline",
    sourceWarnings: [],
    summary:
      "Imported Historical Baseline shows negative overnight sessions in this scan. Source quality limits diagnosis confidence.",
    title: "Directional overnight signal",
    trustLevel: "weak_signal",
  };
  const coach = deriveObservationalCoachV1({
    baselineProfile: createBaselineProfile(),
    baselineSessionIntelligence: createSessionIntelligence(),
    baselineSessionSupportingContexts: [supportingContext],
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  const performanceCard = coach.cards.find((card) => card.id === "baseline-performance");
  const riskCard = coach.cards.find((card) => card.id === "baseline-risk");

  assert.match(performanceCard?.details.join(" ") ?? "", /Directional overnight signal/);
  assert.match(riskCard?.details.join(" ") ?? "", /Not diagnosis-grade yet/);
});

test("evidence comparisons appear as comparison-only AI Coach details", () => {
  const comparison: EvidenceComparisonResult = {
    confidence: "low",
    conclusion:
      "Imported baseline suggests overnight performance is worth investigating, but native Portal evidence does not confirm it yet.",
    id: "evidence-comparison:overnight_performance",
    importedSummary:
      "Imported Historical Baseline shows negative overnight sessions in this scan. Source quality limits diagnosis confidence.",
    labels: [
      "Comparison only",
      "Imported Historical Baseline",
      "Directional context",
      "Not native Journal evidence",
      "Not diagnosis-grade yet",
    ],
    nativeSummary: null,
    recommendedUse: "show_as_investigation_prompt",
    relatedImportedEvidenceIds: ["imported-session:session-1:overnight_negative"],
    relatedNativeEvidenceIds: [],
    sourceWarnings: [],
    status: "imported_only",
    topic: "overnight_performance",
  };
  const coach = deriveObservationalCoachV1({
    baselineEvidenceComparisons: [comparison],
    baselineProfile: createBaselineProfile(),
    baselineSessionIntelligence: createSessionIntelligence(),
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  const performanceCard = coach.cards.find((card) => card.id === "baseline-performance");

  assert.match(performanceCard?.details.join(" ") ?? "", /Comparison only/);
  assert.match(performanceCard?.details.join(" ") ?? "", /Needs native confirmation/);
  assert.match(performanceCard?.details.join(" ") ?? "", /Recommended use/);
});

test("low-confidence and source-warning session baseline copy stays cautious", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: createBaselineProfile({
      dataQuality: [
        {
          code: "fill-cap-hit",
          detail: "Historical fills were capped.",
          severity: "warning",
        },
      ],
    }),
    baselineSessionIntelligence: createSessionIntelligence(),
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  const performanceCard = coach.cards.find((card) => card.id === "baseline-performance");

  assert.match(performanceCard?.body ?? "", /source quality limits diagnosis confidence/i);
  assert.ok(performanceCard?.details.includes("Weak signal"));
  assert.ok(performanceCard?.details.includes("Order/fill completeness limits this read"));
});

test("insufficient session evidence suppresses strong baseline insight language", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: createBaselineProfile(),
    baselineSessionIntelligence: createSessionIntelligence({
      confidenceDistribution: {
        high: 0,
        insufficient_evidence: 1,
        low: 0,
        medium: 0,
      },
      diagnosisReadinessDistribution: {
        directional_only: 0,
        ready_for_diagnosis: 0,
        unsafe_not_enough_evidence: 1,
      },
      sessionCount: 1,
    }),
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  const performanceCard = coach.cards.find((card) => card.id === "baseline-performance");

  assert.equal(performanceCard?.state, "Not Enough Data");
  assert.match(performanceCard?.body ?? "", /missing complete session evidence/i);
  assert.ok(performanceCard?.details.includes("Unsafe: not enough evidence"));
});

test("discipline block creates a real-time AI warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-1",
        metadata: { reasonCode: "unknown_risk_action" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.title, "Risk could not be classified.");
  assert.equal(coach.warnings[0]?.source, "risk_gate");
});

test("market entry confirmation required creates Manual entry risk warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-market-entry-confirmation-required",
        id: "market-entry-required",
        metadata: { reasonCode: "market_entry_confirmation_required", ruleType: "market_entry_confirmation" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.title, "Manual entry risk.");
  assert.equal(coach.warnings[0]?.message, "This matches your diagnosed weak pattern. Confirm before adding risk.");
});

test("cooldown block creates direct cooldown warning copy", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-cooldown",
        metadata: { reasonCode: "cooldown_active", ruleType: "cooldown_after_loss" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.title, "Cooldown active.");
  assert.equal(coach.warnings[0]?.message, "You already locked this rule. Wait it out or post an Override Bond.");
});

test("max daily loss block creates direct warning copy", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-loss",
        metadata: { reasonCode: "max_daily_loss_hit", ruleType: "max_daily_loss" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.title, "Daily loss limit hit.");
  assert.equal(coach.warnings[0]?.message, "New risk is blocked. Closing or reducing exposure is still allowed.");
});

test("no-trade-zone block creates direct warning copy", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-zone",
        metadata: { reasonCode: "no_trade_zone_active", ruleType: "no_trade_zone" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.trigger, "no_trade_zone_active");
  assert.equal(coach.warnings[0]?.message, "No-trade zone active. Portal is blocking new risk here.");
});

test("min R:R block creates direct warning copy", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-rr",
        metadata: { reasonCode: "min_rr_failed", ruleType: "min_risk_reward" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.title, "Minimum R:R failed.");
  assert.equal(coach.warnings[0]?.message, "Wait for a cleaner setup or adjust the plan before adding risk.");
});

test("blocked time-window block creates direct warning copy", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-time-window",
        metadata: { reasonCode: "blocked_time_window_active", ruleType: "blocked_time_window" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.title, "Time window locked.");
  assert.equal(coach.warnings[0]?.message, "This time window is locked by your Discipline Plan. Reduce risk only.");
});

test("protection required block creates compact AI warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-protection",
        metadata: { reasonCode: "protection_required", ruleType: "require_protection" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.title, "Protection required.");
  assert.equal(coach.warnings[0]?.message, "Add a stop loss before taking new risk.");
});

test("Override Bond required creates an AI warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-edit-blocked",
        id: "edit-block",
        metadata: { ruleType: "cooldown_after_loss" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.trigger, "override_bond_required");
  assert.equal(coach.warnings[0]?.message, "Override Bond required to weaken this rule.");
});

test("Override Bond posted creates an AI warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-override-bond-posted",
        id: "bond-1",
        metadata: { multiplier: 1, ruleType: "cooldown_after_loss" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.title, "Override logged.");
  assert.equal(coach.warnings[0]?.message, "You paid to break discipline. This will count against your discipline streak.");
});

test("repeated Override Bonds create escalation warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-override-bond-posted",
        id: "bond-2",
        metadata: { multiplier: 2, ruleType: "cooldown_after_loss" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.trigger, "repeated_override");
  assert.equal(coach.warnings[0]?.message, "This Override Bond is now more expensive because this is not your first override today.");
});

test("sizing up after loss creates revenge-risk warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: {
      allocationPercent: 30,
      direction: "long",
      estimatedSize: 0.003,
      executionMode: "market",
    },
    journalEntries: [
      createEntry({
        id: "loss-size",
        realizedPnl: -20,
        relatedSessionLogIds: ["loss-size-log"],
        size: 0.001,
      }),
    ],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [createLog({ id: "loss-size-log" })],
  });

  assert.equal(coach.warnings[0]?.trigger, "sizing_up_after_loss");
  assert.equal(coach.warnings[0]?.message, "You are sizing up after a loss. That is revenge risk.");
});

test("reverse blocked creates reverse-risk warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "reverse-block",
        metadata: { actionType: "reverse_position", reasonCode: "cooldown_active" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.trigger, "reverse_blocked");
  assert.equal(coach.warnings[0]?.message, "Reverse blocked. You can close risk, but you cannot open new opposite exposure.");
});

test("risk-reducing action does not create unnecessary warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "position-reduced",
        id: "reduce-1",
      }),
    ],
  });

  assert.equal(coach.warnings.length, 0);
});

test("duplicate warnings dedupe by trigger, rule, and symbol", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-1",
        metadata: { reasonCode: "cooldown_active", ruleType: "cooldown_after_loss" },
        symbol: "BTC-USD",
        timestamp: "2026-04-27T18:15:00.000Z",
      }),
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-2",
        metadata: { reasonCode: "cooldown_active", ruleType: "cooldown_after_loss" },
        symbol: "BTC-USD",
        timestamp: "2026-04-27T18:16:00.000Z",
      }),
    ],
  });

  assert.equal(coach.warnings.length, 1);
  assert.equal(coach.warnings[0]?.timestamp, "2026-04-27T18:16:00.000Z");
});

test("warning TTL and dismissal hide transient warnings", () => {
  const expired = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    now: "2026-04-27T18:17:31.000Z",
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-override-bond-posted",
        id: "bond-expired",
        metadata: { multiplier: 1, ruleType: "cooldown_after_loss" },
        timestamp: "2026-04-27T18:16:00.000Z",
      }),
    ],
  });
  const dismissed = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    dismissedWarningIds: ["override_bond_posted:cooldown_after_loss:any"],
    journalEntries: [],
    livePosition: null,
    now: "2026-04-27T18:16:30.000Z",
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-override-bond-posted",
        id: "bond-dismissed",
        metadata: { multiplier: 1, ruleType: "cooldown_after_loss" },
        timestamp: "2026-04-27T18:16:00.000Z",
      }),
    ],
  });

  assert.equal(expired.warnings.length, 0);
  assert.equal(dismissed.warnings.length, 0);
});

test("diagnosis warnings join AI Coach warning stream with dismissal support", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: {
      allocationPercent: 10,
      direction: "long",
      estimatedSize: 0.002,
      executionMode: "market",
      hasPlanContext: false,
      source: "manual",
      symbol: "BTC-USD",
    },
    journalEntries: [],
    journalMemoryEvents: [],
    livePosition: null,
    now: "2026-05-04T14:00:00.000Z",
    operatorDiagnosis: createDiagnosis(),
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  const warning = coach.warnings.find((candidate) => candidate.trigger === "diagnosed_manual_entry_weakness");
  assert.equal(warning?.source, "operator_diagnosis");
  assert.equal(warning?.title, "Manual entry risk.");

  const dismissed = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: {
      allocationPercent: 10,
      direction: "long",
      estimatedSize: 0.002,
      executionMode: "market",
      hasPlanContext: false,
      source: "manual",
      symbol: "BTC-USD",
    },
    dismissedWarningIds: warning ? [warning.id] : [],
    journalEntries: [],
    journalMemoryEvents: [],
    livePosition: null,
    now: "2026-05-04T14:00:30.000Z",
    operatorDiagnosis: createDiagnosis(),
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  assert.equal(dismissed.warnings.some((candidate) => candidate.id === warning?.id), false);
});

test("diagnosis warnings expire through the existing TTL path", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: {
      allocationPercent: 10,
      direction: "long",
      estimatedSize: 0.002,
      executionMode: "market",
      hasPlanContext: false,
      source: "manual",
      symbol: "BTC-USD",
    },
    journalEntries: [],
    journalMemoryEvents: [],
    livePosition: null,
    now: "2026-05-04T14:02:00.000Z",
    operatorDiagnosis: createDiagnosis({ generatedAt: "2026-05-04T14:00:00.000Z" }),
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  assert.equal(coach.warnings.some((warning) => warning.trigger === "diagnosed_manual_entry_weakness"), false);
});

test("activated diagnosis plan creates contextual info warning", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: {
      allocationPercent: 10,
      direction: "long",
      estimatedSize: 0.002,
      executionMode: "market",
      hasPlanContext: false,
      source: "manual",
      symbol: "BTC-USD",
    },
    journalEntries: [
      createEntry({
        id: "loss-1",
        realizedPnl: -20,
        timestamp: "2026-05-04T13:30:00.000Z",
      }),
    ],
    journalMemoryEvents: [
      {
        id: "memory-plan-1",
        metadata: {
          activatedRules: [
            {
              recommendedRuleId: "rule:cooldown-after-loss",
              ruleType: "cooldown_after_loss",
            },
          ],
          source: "operator_diagnosis",
        },
        source: "journal",
        timestamp: "2026-05-04T13:45:00.000Z",
        type: "plan_changed",
      },
    ],
    livePosition: null,
    now: "2026-05-04T14:00:00.000Z",
    operatorDiagnosis: createDiagnosis({ profitLeaks: [] }),
    ruleState: createRuleState(),
    sessionLogEntries: [],
  });

  const warning = coach.warnings.find((candidate) => candidate.trigger === "activated_plan_rule_relevant");
  assert.equal(warning?.severity, "info");
  assert.equal(warning?.title, "Discipline Plan active.");
});

test("AI Coach still renders passive insight cards with warnings", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [createEntry()],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-1",
        metadata: { reasonCode: "cooldown_active" },
      }),
    ],
  });

  assert.ok(coach.cards.find((card) => card.id === "entry-style"));
  assert.ok(coach.cards.find((card) => card.id === "discipline"));
  assert.ok(coach.warnings.length > 0);
});

test("AI Coach real-time warnings do not require an external AI call", () => {
  const coach = deriveObservationalCoachV1({
    baselineProfile: null,
    currentIntent: null,
    journalEntries: [],
    livePosition: null,
    ruleState: createRuleState(),
    sessionLogEntries: [
      createLog({
        eventType: "discipline-rule-blocked",
        id: "block-local",
        metadata: { reasonCode: "max_trades_per_day_hit" },
      }),
    ],
  });

  assert.equal(coach.warnings[0]?.source, "risk_gate");
  assert.equal(coach.warnings[0]?.title, "Max trades hit.");
});
