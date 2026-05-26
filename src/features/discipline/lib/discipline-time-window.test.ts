import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveBlockedTimeWindowRuleState,
  isBlockedTimeWindowActive,
  type BlockedTimeWindowRule,
} from "./discipline-time-window";

const baseRule: BlockedTimeWindowRule = {
  enabled: true,
  id: "window:test",
  startTime: "09:00",
  endTime: "11:00",
};

test("normal blocked time window is active inside range", () => {
  assert.equal(
    isBlockedTimeWindowActive(baseRule, new Date("2026-05-04T10:15:00")),
    true,
  );
});

test("overnight blocked time window is active after midnight", () => {
  assert.equal(
    isBlockedTimeWindowActive(
      { ...baseRule, startTime: "23:00", endTime: "02:00" },
      new Date("2026-05-04T01:15:00"),
    ),
    true,
  );
});

test("outside blocked time window is inactive", () => {
  assert.equal(
    isBlockedTimeWindowActive(baseRule, new Date("2026-05-04T12:15:00")),
    false,
  );
});

test("active blocked time window maps to locked", () => {
  assert.equal(
    deriveBlockedTimeWindowRuleState(baseRule, new Date("2026-05-04T10:15:00")),
    "locked",
  );
});

test("enabled outside blocked time window maps to active", () => {
  assert.equal(
    deriveBlockedTimeWindowRuleState(baseRule, new Date("2026-05-04T12:15:00")),
    "active",
  );
});

test("disabled blocked time window maps to inactive", () => {
  assert.equal(
    deriveBlockedTimeWindowRuleState(
      { ...baseRule, enabled: false },
      new Date("2026-05-04T10:15:00"),
    ),
    "inactive",
  );
});
