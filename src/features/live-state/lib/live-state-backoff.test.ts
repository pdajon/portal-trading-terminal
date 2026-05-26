import assert from "node:assert/strict";
import test from "node:test";

import {
  createLiveStateBackoffState,
  getLiveStateBackoffDelayMs,
  recordLiveStateRefreshFailure,
  recordLiveStateRefreshSuccess,
  shouldSkipLiveStateRefresh,
} from "./live-state-backoff";

test("live-state backoff does not block before the failure threshold", () => {
  let state = createLiveStateBackoffState();

  state = recordLiveStateRefreshFailure(state, "live-positions", 1_000);

  assert.equal(getLiveStateBackoffDelayMs(state, "live-positions", 1_001), 0);
  assert.equal(
    shouldSkipLiveStateRefresh({
      now: 1_001,
      reason: "background",
      resource: "live-positions",
      state,
    }),
    false,
  );
});

test("live-state backoff starts at 15 seconds on the second failure", () => {
  let state = createLiveStateBackoffState();

  state = recordLiveStateRefreshFailure(state, "live-positions", 1_000);
  state = recordLiveStateRefreshFailure(state, "live-positions", 2_000);

  assert.equal(getLiveStateBackoffDelayMs(state, "live-positions", 2_000), 15_000);
  assert.equal(
    shouldSkipLiveStateRefresh({
      now: 16_999,
      reason: "background",
      resource: "live-positions",
      state,
    }),
    true,
  );
  assert.equal(
    shouldSkipLiveStateRefresh({
      now: 17_000,
      reason: "background",
      resource: "live-positions",
      state,
    }),
    false,
  );
});

test("live-state backoff increases and caps at 60 seconds", () => {
  let state = createLiveStateBackoffState();

  state = recordLiveStateRefreshFailure(state, "pending-orders", 1_000);
  state = recordLiveStateRefreshFailure(state, "pending-orders", 2_000);
  state = recordLiveStateRefreshFailure(state, "pending-orders", 20_000);
  state = recordLiveStateRefreshFailure(state, "pending-orders", 60_000);

  assert.equal(getLiveStateBackoffDelayMs(state, "pending-orders", 60_000), 60_000);
  assert.equal(
    shouldSkipLiveStateRefresh({
      now: 119_999,
      reason: "background",
      resource: "pending-orders",
      state,
    }),
    true,
  );
});

test("live-state backoff success resets failures and blocked time", () => {
  let state = createLiveStateBackoffState();

  state = recordLiveStateRefreshFailure(state, "account", 1_000);
  state = recordLiveStateRefreshFailure(state, "account", 2_000);
  state = recordLiveStateRefreshSuccess(state, "account");

  assert.equal(getLiveStateBackoffDelayMs(state, "account", 2_001), 0);
  assert.equal(
    shouldSkipLiveStateRefresh({
      now: 2_001,
      reason: "background",
      resource: "account",
      state,
    }),
    false,
  );
});

test("critical live-state refresh bypasses active backoff", () => {
  let state = createLiveStateBackoffState();

  state = recordLiveStateRefreshFailure(state, "live-positions", 1_000);
  state = recordLiveStateRefreshFailure(state, "live-positions", 2_000);

  assert.equal(
    shouldSkipLiveStateRefresh({
      now: 3_000,
      reason: "critical",
      resource: "live-positions",
      state,
    }),
    false,
  );
});
