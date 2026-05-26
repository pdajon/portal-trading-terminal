import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBlockedTimeWindowOverridePrompt,
  buildClientOverrideBondPreview,
  resolveBlockedTimeWindowDisplayState,
} from "./blocked-time-window-override";
import type { BlockedTimeWindowRule } from "./discipline-time-window";

const lockedRule: BlockedTimeWindowRule = {
  enabled: true,
  endTime: "23:59",
  id: "blocked-window-1",
  label: "Battle test lock",
  source: "manual",
  startTime: "00:00",
  state: "locked",
  timezone: "America/Chicago",
};

test("locked blocked-time-window Override action opens the existing Override Bond prompt", () => {
  const currentRules = { blockedTimeWindows: [lockedRule] };
  const prompt = buildBlockedTimeWindowOverridePrompt({
    currentRules,
    enabled: false,
    minRiskReward: null,
    overrideBondConfig: { baseAmountUsdc: 25 },
    ruleId: lockedRule.id,
  });

  assert.deepEqual(prompt, {
    intendedMinRR: null,
    intendedRules: {
      blockedTimeWindows: [{ ...lockedRule, enabled: false }],
    },
    message: "Rule locked. Override Bond required to weaken this rule.",
    preview: buildClientOverrideBondPreview({ baseAmountUsdc: 25 }),
    ruleId: lockedRule.id,
    ruleType: "blocked_time_window",
  });
});

test("canceling Override leaves the locked blocked-time-window rule unchanged", () => {
  const currentRules = { blockedTimeWindows: [lockedRule] };
  const prompt = buildBlockedTimeWindowOverridePrompt({
    currentRules,
    enabled: false,
    minRiskReward: null,
    overrideBondConfig: { baseAmountUsdc: 25 },
    ruleId: lockedRule.id,
  });

  assert.ok(prompt);
  assert.deepEqual(currentRules.blockedTimeWindows[0], lockedRule);
});

test("unlocked blocked-time-window toggles without requiring Override Bond", () => {
  const prompt = buildBlockedTimeWindowOverridePrompt({
    currentRules: {
      blockedTimeWindows: [
        { ...lockedRule, enabled: false, state: "inactive" },
      ],
    },
    enabled: false,
    minRiskReward: null,
    overrideBondConfig: { baseAmountUsdc: 25 },
    ruleId: lockedRule.id,
  });

  assert.equal(prompt, null);
});

test("overridden server state keeps blocked-time-window row from relocking locally", () => {
  assert.equal(
    resolveBlockedTimeWindowDisplayState(lockedRule, { state: "overridden" }),
    "overridden",
  );
});
