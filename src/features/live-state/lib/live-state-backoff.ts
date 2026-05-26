export type LiveStateBackoffResource = "account" | "live-positions" | "pending-orders";

export type LiveStateRefreshReason = "background" | "critical";

export type LiveStateBackoffEntry = {
  blockedUntilMs: number;
  consecutiveFailures: number;
};

export type LiveStateBackoffState = Record<LiveStateBackoffResource, LiveStateBackoffEntry>;

const LIVE_STATE_BACKOFF_RESOURCES: LiveStateBackoffResource[] = [
  "account",
  "live-positions",
  "pending-orders",
];

const LIVE_STATE_BACKOFF_DELAYS_MS = [0, 0, 15_000, 30_000, 60_000] as const;

function createEmptyEntry(): LiveStateBackoffEntry {
  return {
    blockedUntilMs: 0,
    consecutiveFailures: 0,
  };
}

function getDelayForFailureCount(consecutiveFailures: number) {
  if (consecutiveFailures <= 0) {
    return 0;
  }

  return LIVE_STATE_BACKOFF_DELAYS_MS[
    Math.min(consecutiveFailures, LIVE_STATE_BACKOFF_DELAYS_MS.length - 1)
  ];
}

export function createLiveStateBackoffState(): LiveStateBackoffState {
  return LIVE_STATE_BACKOFF_RESOURCES.reduce<LiveStateBackoffState>(
    (state, resource) => ({
      ...state,
      [resource]: createEmptyEntry(),
    }),
    {
      account: createEmptyEntry(),
      "live-positions": createEmptyEntry(),
      "pending-orders": createEmptyEntry(),
    },
  );
}

export function getLiveStateBackoffDelayMs(
  state: LiveStateBackoffState,
  resource: LiveStateBackoffResource,
  now: number,
) {
  return Math.max(0, state[resource].blockedUntilMs - now);
}

export function shouldSkipLiveStateRefresh({
  now,
  reason,
  resource,
  state,
}: {
  now: number;
  reason: LiveStateRefreshReason;
  resource: LiveStateBackoffResource;
  state: LiveStateBackoffState;
}) {
  if (reason === "critical") {
    return false;
  }

  return getLiveStateBackoffDelayMs(state, resource, now) > 0;
}

export function recordLiveStateRefreshFailure(
  state: LiveStateBackoffState,
  resource: LiveStateBackoffResource,
  now: number,
): LiveStateBackoffState {
  const consecutiveFailures = state[resource].consecutiveFailures + 1;
  const delayMs = getDelayForFailureCount(consecutiveFailures);

  return {
    ...state,
    [resource]: {
      blockedUntilMs: delayMs > 0 ? now + delayMs : 0,
      consecutiveFailures,
    },
  };
}

export function recordLiveStateRefreshSuccess(
  state: LiveStateBackoffState,
  resource: LiveStateBackoffResource,
): LiveStateBackoffState {
  return {
    ...state,
    [resource]: createEmptyEntry(),
  };
}
