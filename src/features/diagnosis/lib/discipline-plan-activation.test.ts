import test from "node:test";
import assert from "node:assert/strict";
import {
  activateRecommendedDisciplinePlanV1,
  getRecommendedDisciplineRuleSupportStatus,
} from "./discipline-plan-activation";
import type { RecommendedDisciplineRule } from "./operator-diagnosis";

function rule(overrides: Partial<RecommendedDisciplineRule> = {}): RecommendedDisciplineRule {
  return {
    id: "rule:cooldown",
    proposedValue: { minutes: 30 },
    reason: "Post-loss trades are weak.",
    ruleType: "cooldown_after_loss",
    title: "Cooldown after loss",
    ...overrides,
  };
}

test("activates selected cooldown rule into Discipline", () => {
  const result = activateRecommendedDisciplinePlanV1({
    currentRules: { cooldownAfterLossMinutes: null, maxDailyLoss: null, maxTradesPerDay: null },
    currentMinRiskReward: null,
    recommendedRules: [rule()],
    selectedRuleIds: ["rule:cooldown"],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.nextRules.cooldownAfterLossMinutes, 30);
  assert.equal(result.activatedRules[0]?.ruleType, "cooldown_after_loss");
});

test("activates selected max trades rule", () => {
  const result = activateRecommendedDisciplinePlanV1({
    currentRules: { cooldownAfterLossMinutes: null, maxDailyLoss: null, maxTradesPerDay: null },
    currentMinRiskReward: null,
    recommendedRules: [
      rule({
        id: "rule:max-trades",
        proposedValue: { maxTrades: 3 },
        ruleType: "max_trades_per_day",
      }),
    ],
    selectedRuleIds: ["rule:max-trades"],
  });

  assert.equal(result.nextRules.maxTradesPerDay, 3);
  assert.equal(result.activatedRules[0]?.ruleType, "max_trades_per_day");
});

test("blocked time window recommendation activates into Discipline", () => {
  const result = activateRecommendedDisciplinePlanV1({
    currentRules: {
      blockedTimeWindows: [],
      cooldownAfterLossMinutes: null,
      maxDailyLoss: null,
      maxTradesPerDay: null,
    },
    currentMinRiskReward: null,
    recommendedRules: [
      rule({
        id: "rule:blocked-window",
        proposedValue: { window: "21:00-22:00" },
        ruleType: "blocked_time_window",
        sourceFindingId: "finding:time-window",
      }),
    ],
    selectedRuleIds: ["rule:blocked-window"],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.nextRules.blockedTimeWindows?.[0]?.startTime, "21:00");
  assert.equal(result.nextRules.blockedTimeWindows?.[0]?.endTime, "22:00");
  assert.equal(result.nextRules.blockedTimeWindows?.[0]?.source, "operator_diagnosis");
  assert.equal(result.nextRules.blockedTimeWindows?.[0]?.sourceFindingId, "finding:time-window");
});

test("blocked time window recommendation missing time data is skipped, not faked", () => {
  const result = activateRecommendedDisciplinePlanV1({
    currentRules: { cooldownAfterLossMinutes: null, maxDailyLoss: null, maxTradesPerDay: null },
    currentMinRiskReward: null,
    recommendedRules: [
      rule({
        id: "rule:blocked-window",
        proposedValue: { mode: "warn_or_block" },
        ruleType: "blocked_time_window",
      }),
    ],
    selectedRuleIds: ["rule:blocked-window"],
  });

  assert.equal(result.accepted, false);
  assert.equal(result.skippedRules[0]?.reasonCode, "missing_rule_data");
  assert.equal(result.activatedRules.length, 0);
});

test("user-unselected rule is skipped", () => {
  const result = activateRecommendedDisciplinePlanV1({
    currentRules: { cooldownAfterLossMinutes: null, maxDailyLoss: null, maxTradesPerDay: null },
    currentMinRiskReward: null,
    recommendedRules: [rule()],
    selectedRuleIds: [],
  });

  assert.equal(result.skippedRules[0]?.reasonCode, "user_unselected");
});

test("activation does not weaken locked rule", () => {
  const result = activateRecommendedDisciplinePlanV1({
    currentRules: { cooldownAfterLossMinutes: 60, maxDailyLoss: null, maxTradesPerDay: null },
    currentMinRiskReward: null,
    lockedRuleIds: ["cooldownAfterLossMinutes"],
    recommendedRules: [rule({ proposedValue: { minutes: 30 } })],
    selectedRuleIds: ["rule:cooldown"],
  });

  assert.equal(result.nextRules.cooldownAfterLossMinutes, 60);
  assert.equal(result.blockedRules[0]?.reasonCode, "locked_rule_cannot_be_weakened");
});

test("activation can strengthen existing locked rule", () => {
  const result = activateRecommendedDisciplinePlanV1({
    currentRules: { cooldownAfterLossMinutes: 30, maxDailyLoss: null, maxTradesPerDay: null },
    currentMinRiskReward: null,
    lockedRuleIds: ["cooldownAfterLossMinutes"],
    recommendedRules: [rule({ proposedValue: { minutes: 60 } })],
    selectedRuleIds: ["rule:cooldown"],
  });

  assert.equal(result.nextRules.cooldownAfterLossMinutes, 60);
  assert.equal(result.activatedRules[0]?.ruleType, "cooldown_after_loss");
});

test("partial activation succeeds when one rule is blocked", () => {
  const result = activateRecommendedDisciplinePlanV1({
    currentRules: { cooldownAfterLossMinutes: 60, maxDailyLoss: null, maxTradesPerDay: null },
    currentMinRiskReward: null,
    lockedRuleIds: ["cooldownAfterLossMinutes"],
    recommendedRules: [
      rule({ proposedValue: { minutes: 30 } }),
      rule({
        id: "rule:max-trades",
        proposedValue: { maxTrades: 3 },
        ruleType: "max_trades_per_day",
      }),
    ],
    selectedRuleIds: ["rule:cooldown", "rule:max-trades"],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.activatedRules.length, 1);
  assert.equal(result.blockedRules.length, 1);
  assert.match(result.message, /Some rules were not activated/);
});

test("ready support status is exposed for supported selected rule", () => {
  assert.equal(
    getRecommendedDisciplineRuleSupportStatus(rule(), {
      currentRules: { cooldownAfterLossMinutes: null, maxDailyLoss: null, maxTradesPerDay: null },
      currentMinRiskReward: null,
    }).status,
    "ready",
  );
});

test("unsupported support status is exposed for v1 gaps", () => {
  assert.equal(
    getRecommendedDisciplineRuleSupportStatus(rule({ ruleType: "override_bond_warning" }), {
      currentRules: { cooldownAfterLossMinutes: null, maxDailyLoss: null, maxTradesPerDay: null },
      currentMinRiskReward: null,
    }).status,
    "unsupported",
  );
});

test("blocked time window support status is ready when time data exists", () => {
  assert.equal(
    getRecommendedDisciplineRuleSupportStatus(rule({
      proposedValue: { window: "14:00-15:00" },
      ruleType: "blocked_time_window",
    }), {
      currentRules: { cooldownAfterLossMinutes: null, maxDailyLoss: null, maxTradesPerDay: null },
      currentMinRiskReward: null,
    }).status,
    "ready",
  );
});
