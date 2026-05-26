import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";
import type { PriceCandle } from "@/features/chart/types";

const DEFAULT_CHART_SNAPSHOT_MAX_ATTEMPTS = 3;
const DEFAULT_CHART_SNAPSHOT_RETRY_DELAY_MS = 450;
const INDEX_CANDLE_PROVIDER_MISSING_CODE = "INDEX_PROVIDER_MISSING";
const INDEX_CANDLE_PROVIDER_LIMITED_CODE = "INDEX_PROVIDER_LIMITED";
const INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE =
  "INDEX_UNSUPPORTED_TIMEFRAME";

type ChartSnapshotFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, "json" | "ok" | "status">>;

type FetchChartSnapshotCandlesOptions = {
  fetcher?: ChartSnapshotFetch;
  fresh?: boolean;
  maxAttempts?: number;
  retryDelayMs?: number;
};

export type ChartSnapshotRequestErrorCode =
  | "provider-missing"
  | "provider-limited"
  | "unsupported-timeframe"
  | "fetch-failed";

export class ChartSnapshotRequestError extends Error {
  code: ChartSnapshotRequestErrorCode;
  status: number | null;

  constructor(message: string, code: ChartSnapshotRequestErrorCode, status: number | null) {
    super(message);
    this.name = "ChartSnapshotRequestError";
    this.code = code;
    this.status = status;
  }
}

export function buildChartSnapshotRequestUrl(
  symbol: string,
  timeframe: ChartTimeframe,
  options: { fresh?: boolean } = {},
) {
  const params = new URLSearchParams({
    symbol,
    interval: timeframe,
  });

  if (options.fresh) {
    params.set("fresh", "1");
  }

  return `/api/chart?${params.toString()}`;
}

function wait(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readChartErrorPayload(response: Pick<Response, "json" | "status">) {
  try {
    return (await response.json()) as { code?: unknown; error?: unknown };
  } catch {
    return {};
  }
}

function getChartSnapshotRequestError(
  status: number | null,
  payload: { code?: unknown; error?: unknown } = {},
) {
  const message =
    typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : status === null
        ? "Chart data request failed"
        : `Chart data request failed with ${status}`;

  return new ChartSnapshotRequestError(
    message,
    payload.code === INDEX_CANDLE_PROVIDER_MISSING_CODE
      ? "provider-missing"
      : payload.code === INDEX_CANDLE_PROVIDER_LIMITED_CODE
        ? "provider-limited"
        : payload.code === INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE
          ? "unsupported-timeframe"
          : "fetch-failed",
    status,
  );
}

function isStructuredChartErrorPayload(payload: unknown) {
  return (
    payload &&
    typeof payload === "object" &&
    ((payload as { code?: unknown }).code ===
      INDEX_CANDLE_PROVIDER_MISSING_CODE ||
      (payload as { code?: unknown }).code ===
        INDEX_CANDLE_PROVIDER_LIMITED_CODE ||
      (payload as { code?: unknown }).code ===
        INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE)
  );
}

export async function fetchChartSnapshotCandles(
  symbol: string,
  timeframe: ChartTimeframe,
  options: FetchChartSnapshotCandlesOptions = {},
) {
  const url = buildChartSnapshotRequestUrl(symbol, timeframe, {
    fresh: options.fresh,
  });
  const fetcher = options.fetcher ?? fetch;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_CHART_SNAPSHOT_MAX_ATTEMPTS);
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_CHART_SNAPSHOT_RETRY_DELAY_MS;
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetcher(url, { cache: "no-store" });

      if (response.ok) {
        const payload = await response.json();

        if (Array.isArray(payload)) {
          return payload as PriceCandle[];
        }

        if (isStructuredChartErrorPayload(payload)) {
          throw getChartSnapshotRequestError(response.status, {
            code: (payload as { code?: unknown }).code,
            error: (payload as { error?: unknown }).error,
          });
        }

        if (
          payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { candles?: unknown }).candles)
        ) {
          return (payload as { candles: PriceCandle[] }).candles;
        }

        return [];
      }

      lastStatus = response.status;
      const errorPayload = await readChartErrorPayload(response);

      if (
        errorPayload.code === INDEX_CANDLE_PROVIDER_MISSING_CODE ||
        errorPayload.code === INDEX_CANDLE_PROVIDER_LIMITED_CODE ||
        errorPayload.code === INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE
      ) {
        throw getChartSnapshotRequestError(response.status, errorPayload);
      }
    } catch (error) {
      if (error instanceof ChartSnapshotRequestError) {
        throw error;
      }

      lastStatus = null;
    }

    if (attempt < maxAttempts) {
      await wait(retryDelayMs);
    }
  }

  throw getChartSnapshotRequestError(lastStatus);
}
