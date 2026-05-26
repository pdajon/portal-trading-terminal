export type BridgeRouteTimingHeadersInput = {
  bridgeDurationMs: number;
  extraHeaders?: Record<string, string>;
  routeDurationMs: number;
  timedOut?: boolean;
};

function formatDurationMs(durationMs: number) {
  return `${Math.max(0, Math.round(durationMs))}`;
}

export function buildBridgeRouteTimingHeaders({
  bridgeDurationMs,
  extraHeaders = {},
  routeDurationMs,
  timedOut = false,
}: BridgeRouteTimingHeadersInput) {
  return {
    ...extraHeaders,
    "X-Portal-Bridge-Duration-Ms": formatDurationMs(bridgeDurationMs),
    ...(timedOut ? { "X-Portal-Bridge-Timed-Out": "1" } : {}),
    "X-Portal-Route-Duration-Ms": formatDurationMs(routeDurationMs),
  };
}

export function isBridgeTimeoutError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "killed" in error &&
    (error as { killed?: unknown }).killed === true &&
    "signal" in error &&
    (error as { signal?: unknown }).signal === "SIGTERM"
  );
}

export function parseBridgeStdoutJson<T = unknown>(error: unknown): T | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("stdout" in error) ||
    typeof (error as { stdout?: unknown }).stdout !== "string"
  ) {
    return null;
  }

  const stdout = (error as { stdout: string }).stdout.trim();

  if (!stdout) {
    return null;
  }

  try {
    return JSON.parse(stdout) as T;
  } catch {
    return null;
  }
}
