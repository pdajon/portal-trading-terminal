import test from "node:test";
import assert from "node:assert/strict";
import {
  createSoulObservation,
  deriveSoulObservations,
} from "./soul-observation";
import {
  createSoulRecommendation,
  deriveSoulEscalation,
  updateSoulRecommendation,
} from "./soul-recommendations";
import {
  createInitialSoulMemory,
  getSoulRecommendationDismissalCount,
  hasSoulRecommendationReducedFrequency,
  recordAcceptedSoulRule,
  recordDismissedSoulRecommendation,
  recordSoulRecommendationReducedFrequency,
  recordTriggeredSoulObservation,
} from "./soul-memory";
import {
  applySoulExpEvent,
  createInitialSoulExpState,
  getSoulLevelForExp,
} from "./soul-exp";
import {
  createInitialSoulEvolutionState,
  updateSoulEvolutionState,
} from "./soul-evolution";
import {
  deriveSoulForceField,
  deriveSoulForceFieldFromLivePosition,
  deriveSoulForceFieldFromProtectionState,
} from "./soul-force-field";
import type { SoulObservationType } from "./soul-types";

const REQUIRED_OBSERVATION_TYPES: SoulObservationType[] = [
  "overtrading",
  "revenge_trading",
  "rapid_re_entry",
  "missing_protection",
  "weak_protected_rr",
  "impulsive_execution",
  "ignored_cooldown_behavior",
];

test("supports every required Soul observation type", () => {
  const observations = REQUIRED_OBSERVATION_TYPES.map((type) =>
    createSoulObservation({
      id: `obs-${type}`,
      type,
      createdAt: "2026-05-12T10:00:00.000Z",
      evidence: {
        summary: `${type} evidence`,
        eventIds: [`event-${type}`],
      },
      severity: "warning",
    }),
  );

  assert.deepEqual(
    observations.map((observation) => observation.type),
    REQUIRED_OBSERVATION_TYPES,
  );
});

test("derives foundational trade behavior observations without AI", () => {
  const observations = deriveSoulObservations({
    now: "2026-05-12T10:30:00.000Z",
    trades: [
      {
        id: "loss",
        openedAt: "2026-05-12T10:00:00.000Z",
        closedAt: "2026-05-12T10:05:00.000Z",
        pnl: -50,
        source: "market",
        hasStopLoss: false,
        hasTakeProfit: false,
      },
      {
        id: "re-entry",
        openedAt: "2026-05-12T10:07:00.000Z",
        closedAt: "2026-05-12T10:10:00.000Z",
        pnl: -20,
        source: "market",
        hasStopLoss: true,
        hasTakeProfit: false,
        plannedRewardRiskRatio: 0.7,
      },
      {
        id: "third",
        openedAt: "2026-05-12T10:12:00.000Z",
        closedAt: "2026-05-12T10:15:00.000Z",
        pnl: 10,
        source: "market",
        hasStopLoss: true,
        hasTakeProfit: true,
      },
    ],
    cooldownWindows: [
      {
        id: "cooldown-1",
        startedAt: "2026-05-12T10:06:00.000Z",
        endedAt: "2026-05-12T10:20:00.000Z",
      },
    ],
  });

  const types = observations.map((observation) => observation.type);

  assert.ok(types.includes("overtrading"));
  assert.ok(types.includes("revenge_trading"));
  assert.ok(types.includes("rapid_re_entry"));
  assert.ok(types.includes("missing_protection"));
  assert.ok(types.includes("weak_protected_rr"));
  assert.ok(types.includes("impulsive_execution"));
  assert.ok(types.includes("ignored_cooldown_behavior"));
});

test("creates recommendations with dismissal and show-less escalation state", () => {
  const recommendation = createSoulRecommendation({
    id: "rec-1",
    type: "require_protection",
    createdAt: "2026-05-12T10:00:00.000Z",
    evidence: {
      summary: "Two unprotected entries were observed.",
      observationIds: ["obs-1", "obs-2"],
    },
    suggestedRule: {
      type: "require_protection",
      summary: "Require SL or TP before new risk.",
      parameters: { minimumProtection: "stop_or_target" },
    },
    severity: "warning",
  });

  const dismissed = updateSoulRecommendation(recommendation, { action: "dismiss" });
  const showLess = updateSoulRecommendation(dismissed, { action: "show_less" });
  const accepted = updateSoulRecommendation(showLess, { action: "accept" });

  assert.equal(accepted.dismissalCount, 1);
  assert.equal(accepted.showLessMode, true);
  assert.equal(accepted.snoozed, false);
  assert.equal(accepted.accepted, true);
});

test("tracks escalation from repeated dismissals and ignored warnings", () => {
  const escalation = deriveSoulEscalation({
    recommendations: [
      createSoulRecommendation({
        id: "rec-1",
        type: "cooldown_after_loss",
        createdAt: "2026-05-12T10:00:00.000Z",
        evidence: { summary: "Dismissed three times.", observationIds: ["obs-1"] },
        suggestedRule: { type: "cooldown_after_loss", summary: "Take a cooldown." },
        severity: "critical",
        dismissalCount: 3,
        showLessMode: true,
      }),
    ],
    ignoredWarningCount: 2,
  });

  assert.equal(escalation.repeatedDismissals, true);
  assert.equal(escalation.repeatedIgnoredWarnings, true);
  assert.equal(escalation.showWarningsLess, true);
  assert.match(escalation.evidenceRecap, /Dismissed three times/);
});

test("keeps Soul memory as a pure serializable reducer state", () => {
  const memory = createInitialSoulMemory("2026-05-12T10:00:00.000Z");
  const withObservation = recordTriggeredSoulObservation(
    memory,
    createSoulObservation({
      id: "obs-1",
      type: "overtrading",
      createdAt: "2026-05-12T10:01:00.000Z",
      evidence: { summary: "Three trades in 15 minutes." },
      severity: "warning",
    }),
  );
  const withDismissal = recordDismissedSoulRecommendation(withObservation, "rec-1", "2026-05-12T10:02:00.000Z");
  const withRule = recordAcceptedSoulRule(withDismissal, {
    id: "rule-1",
    type: "max_trades_per_day",
    acceptedAt: "2026-05-12T10:03:00.000Z",
    summary: "Limit trades per day.",
  });

  assert.equal(withRule.triggeredObservations.length, 1);
  assert.equal(withRule.dismissedRecommendations[0]?.dismissalCount, 1);
  assert.equal(withRule.acceptedRules[0]?.type, "max_trades_per_day");
  assert.equal(withRule.repeatedHarmfulPatterns[0]?.type, "overtrading");
});

test("tracks repeated Soul dismissals by recommendation type", () => {
  const memory = createInitialSoulMemory("2026-05-12T10:00:00.000Z");
  const once = recordDismissedSoulRecommendation(
    memory,
    "rec-missing-protection-1",
    "2026-05-12T10:01:00.000Z",
    "require_protection",
  );
  const twice = recordDismissedSoulRecommendation(
    once,
    "rec-missing-protection-2",
    "2026-05-12T10:02:00.000Z",
    "require_protection",
  );
  const threeTimes = recordDismissedSoulRecommendation(
    twice,
    "rec-missing-protection-3",
    "2026-05-12T10:03:00.000Z",
    "require_protection",
  );
  const reduced = recordSoulRecommendationReducedFrequency(
    threeTimes,
    "require_protection",
    "2026-05-12T10:04:00.000Z",
  );

  assert.equal(
    getSoulRecommendationDismissalCount(
      reduced,
      "rec-missing-protection-4",
      "require_protection",
    ),
    3,
  );
  assert.equal(
    hasSoulRecommendationReducedFrequency(reduced, "require_protection"),
    true,
  );
});

test("tracks weighted EXP totals and level thresholds without rewards", () => {
  const state = createInitialSoulExpState("2026-05-12T10:00:00.000Z");
  const updated = applySoulExpEvent(state, {
    id: "exp-1",
    type: "protected_trade_taken",
    occurredAt: "2026-05-12T10:01:00.000Z",
    weight: 2,
  });

  assert.equal(updated.totalExp, 20);
  assert.equal(updated.events.length, 1);
  assert.deepEqual(getSoulLevelForExp(120), {
    level: 3,
    currentLevelExp: 100,
    nextLevelExp: 250,
  });
});

test("updates evolution state from memory and EXP without progression rewards", () => {
  const evolution = updateSoulEvolutionState(
    createInitialSoulEvolutionState("2026-05-12T10:00:00.000Z"),
    {
      expTotal: 120,
      memory: {
        ...createInitialSoulMemory("2026-05-12T10:00:00.000Z"),
        repeatedHarmfulPatterns: [
          { type: "revenge_trading", count: 2, lastObservedAt: "2026-05-12T10:05:00.000Z" },
        ],
      },
      updatedAt: "2026-05-12T10:10:00.000Z",
    },
  );

  assert.equal(evolution.level, 3);
  assert.equal(evolution.stage, "stabilizing");
  assert.equal(evolution.dominantPattern, "revenge_trading");
  assert.equal(evolution.unlockedRewards.length, 0);
});

test("derives force field state from protection only", () => {
  assert.equal(deriveSoulForceField({ hasStopLoss: false, hasTakeProfit: false }).strength, "none");
  assert.equal(deriveSoulForceField({ hasStopLoss: true, hasTakeProfit: false }).strength, "weak");
  assert.equal(deriveSoulForceField({ hasStopLoss: false, hasTakeProfit: true }).strength, "weak");
  assert.equal(deriveSoulForceField({ hasStopLoss: true, hasTakeProfit: true }).strength, "full");
});

test("derives force field state from live position protection statuses", () => {
  assert.equal(deriveSoulForceFieldFromLivePosition(null).strength, "none");
  assert.equal(
    deriveSoulForceFieldFromLivePosition({ slStatus: "live", tpStatus: "missing" }).strength,
    "weak",
  );
  assert.equal(
    deriveSoulForceFieldFromLivePosition({ slStatus: "missing", tpStatus: "live" }).strength,
    "weak",
  );
  assert.equal(
    deriveSoulForceFieldFromLivePosition({ slStatus: "live", tpStatus: "live" }).strength,
    "full",
  );
});

test("derives force field state from local chart protection intent before exchange sync", () => {
  assert.equal(
    deriveSoulForceFieldFromProtectionState({
      activeTradePlan: null,
      draftTradePlan: { stop: 79_500 },
      livePosition: { slStatus: "missing", tpStatus: "missing" },
    }).strength,
    "weak",
  );
  assert.equal(
    deriveSoulForceFieldFromProtectionState({
      activeTradePlan: { stop: 79_500, target: 82_500 },
      draftTradePlan: null,
      livePosition: { slStatus: "missing", tpStatus: "missing" },
    }).strength,
    "full",
  );
});
