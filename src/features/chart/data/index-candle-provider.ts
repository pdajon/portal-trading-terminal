import type {
  PortalChartCandle,
  PortalChartInterval,
} from "@/lib/markets/portal-chart-data";

export const INDEX_CANDLE_PROVIDER_MISSING_CODE = "INDEX_PROVIDER_MISSING";
export const INDEX_CANDLE_FETCH_FAILED_CODE = "INDEX_CANDLE_FETCH_FAILED";
export const INDEX_CANDLE_PROVIDER_LIMITED_CODE = "INDEX_PROVIDER_LIMITED";
export const INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE =
  "INDEX_UNSUPPORTED_TIMEFRAME";

export type IndexCandleProviderResult =
  | {
      candles: PortalChartCandle[];
      formula?: string;
      provider: "coingecko" | "custom";
      status: "loaded" | "no-data";
    }
  | {
      code?: string;
      error: string;
      status:
        | "provider-missing"
        | "provider-limited"
        | "fetch-failed"
        | "unsupported-timeframe";
    };

type FetchIndexCandlesRequest = {
  endTime: number;
  interval: PortalChartInterval;
  startTime: number;
  symbol: string;
  tradingViewSymbol: string;
};

type IndexProviderCandlePayload = {
  close?: unknown;
  high?: unknown;
  low?: unknown;
  open?: unknown;
  time?: unknown;
  volume?: unknown;
};

type CoinGeckoSeriesPoint = readonly [number, number];

type CoinGeckoGlobalMarketCapPayload = {
  market_cap_chart?: {
    market_cap?: unknown;
  };
};

type CoinGeckoCoinMarketChartPayload = {
  market_caps?: unknown;
};

type CoinGeckoErrorPayload = {
  error_code?: unknown;
  status?: {
    error_code?: unknown;
    error_message?: unknown;
  };
};

const COINGECKO_SUPPORTED_INTERVALS = ["1h", "1d"] as const;
const DEFAULT_COINGECKO_API_BASE_URL =
  "https://pro-api.coingecko.com/api/v3";
const DEFAULT_COINGECKO_INDEX_CACHE_TTL_MS = 60_000;
const DEFAULT_COINGECKO_MIN_REQUEST_INTERVAL_MS = 1_100;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const COINGECKO_COIN_IDS = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  tether: "tether",
} as const;

const coingeckoResultCache = new Map<
  string,
  { expiresAt: number; result: IndexCandleProviderResult }
>();
const coingeckoInFlightRequests = new Map<
  string,
  Promise<IndexCandleProviderResult>
>();
let nextCoinGeckoRequestAt = 0;

class CoinGeckoProviderError extends Error {
  errorCode: number | null;
  status: number;

  constructor({
    errorCode,
    message,
    status,
  }: {
    errorCode: number | null;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "CoinGeckoProviderError";
    this.errorCode = errorCode;
    this.status = status;
  }
}

function parseFiniteNumber(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeProviderCandle(
  candle: IndexProviderCandlePayload,
): PortalChartCandle | null {
  const close = parseFiniteNumber(candle.close);
  const high = parseFiniteNumber(candle.high);
  const low = parseFiniteNumber(candle.low);
  const open = parseFiniteNumber(candle.open);
  const time = parseFiniteNumber(candle.time);

  if (
    close === null ||
    high === null ||
    low === null ||
    open === null ||
    time === null
  ) {
    return null;
  }

  return {
    close,
    high,
    low,
    open,
    time,
    volume: parseFiniteNumber(candle.volume),
  };
}

function normalizeProviderPayload(payload: unknown): PortalChartCandle[] {
  const rawCandles = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { candles?: unknown }).candles)
      ? (payload as { candles: unknown[] }).candles
      : [];

  return rawCandles
    .map((candle) =>
      candle && typeof candle === "object"
        ? normalizeProviderCandle(candle as IndexProviderCandlePayload)
        : null,
    )
    .filter((candle): candle is PortalChartCandle => candle !== null)
    .sort((left, right) => left.time - right.time);
}

export function isIndexCandleProviderConnected() {
  return Boolean(
    process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL ||
      getCoinGeckoApiKey(),
  );
}

export function clearIndexCandleProviderCacheForTests() {
  coingeckoResultCache.clear();
  coingeckoInFlightRequests.clear();
  nextCoinGeckoRequestAt = 0;
}

function getCoinGeckoApiKey() {
  return (
    process.env.COINGECKO_API_KEY ??
    process.env.COINGECKO_PRO_API_KEY ??
    process.env.CG_PRO_API_KEY ??
    ""
  ).trim();
}

function getCoinGeckoApiBaseUrl() {
  return (
    process.env.COINGECKO_API_BASE_URL ?? DEFAULT_COINGECKO_API_BASE_URL
  ).replace(/\/$/, "");
}

function getEnvPositiveNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isCoinGeckoSupportedInterval(
  interval: PortalChartInterval,
): interval is (typeof COINGECKO_SUPPORTED_INTERVALS)[number] {
  return COINGECKO_SUPPORTED_INTERVALS.includes(
    interval as (typeof COINGECKO_SUPPORTED_INTERVALS)[number],
  );
}

function getIntervalMs(interval: PortalChartInterval) {
  return interval === "1d" ? DAY_MS : HOUR_MS;
}

function normalizeSeriesPoints(points: unknown): CoinGeckoSeriesPoint[] {
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) {
        return null;
      }

      const time = parseFiniteNumber(point[0]);
      const value = parseFiniteNumber(point[1]);

      return time !== null && value !== null ? ([time, value] as const) : null;
    })
    .filter((point): point is CoinGeckoSeriesPoint => point !== null)
    .sort((left, right) => left[0] - right[0]);
}

function normalizeToBucketSeries(
  points: readonly CoinGeckoSeriesPoint[],
  interval: PortalChartInterval,
) {
  const intervalMs = getIntervalMs(interval);
  const series = new Map<number, number>();

  points.forEach(([timeMs, value]) => {
    const bucketMs = Math.floor(timeMs / intervalMs) * intervalMs;
    series.set(Math.floor(bucketMs / 1000), value);
  });

  return series;
}

function buildCandlesFromSeries(series: Map<number, number>) {
  return [...series.entries()]
    .sort(([leftTime], [rightTime]) => leftTime - rightTime)
    .map(([time, value]) => ({
      close: value,
      high: value,
      low: value,
      open: value,
      time,
      volume: null,
    }));
}

function subtractSeries(
  baseSeries: Map<number, number>,
  subtractors: readonly Map<number, number>[],
) {
  const result = new Map<number, number>();

  baseSeries.forEach((baseValue, time) => {
    let nextValue = baseValue;

    for (const subtractor of subtractors) {
      const value = subtractor.get(time);

      if (value === undefined) {
        return;
      }

      nextValue -= value;
    }

    result.set(time, Math.max(0, nextValue));
  });

  return result;
}

function divideSeriesAsPercent(
  numeratorSeries: Map<number, number>,
  denominatorSeries: Map<number, number>,
) {
  const result = new Map<number, number>();

  numeratorSeries.forEach((numerator, time) => {
    const denominator = denominatorSeries.get(time);

    if (!denominator || denominator <= 0) {
      return;
    }

    result.set(time, (numerator / denominator) * 100);
  });

  return result;
}

async function waitForCoinGeckoRateLimitSlot() {
  const minRequestIntervalMs = getEnvPositiveNumber(
    "PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS",
    DEFAULT_COINGECKO_MIN_REQUEST_INTERVAL_MS,
  );

  if (minRequestIntervalMs <= 0) {
    return;
  }

  const now = Date.now();
  const waitMs = Math.max(0, nextCoinGeckoRequestAt - now);
  nextCoinGeckoRequestAt =
    Math.max(now, nextCoinGeckoRequestAt) + minRequestIntervalMs;

  if (waitMs <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, waitMs);
  });
}

async function fetchCoinGeckoJson(pathname: string, searchParams: URLSearchParams) {
  const url = new URL(`${getCoinGeckoApiBaseUrl()}${pathname}`);
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  await waitForCoinGeckoRateLimitSlot();

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      "x-cg-pro-api-key": getCoinGeckoApiKey(),
    },
  });

  if (!response.ok) {
    let payload: CoinGeckoErrorPayload = {};

    try {
      payload = (await response.json()) as CoinGeckoErrorPayload;
    } catch {
      payload = {};
    }

    const errorCode = parseFiniteNumber(
      payload.status?.error_code ?? payload.error_code,
    );
    const message =
      typeof payload.status?.error_message === "string"
        ? payload.status.error_message
        : `CoinGecko request failed with ${response.status}`;

    throw new CoinGeckoProviderError({
      errorCode,
      message,
      status: response.status,
    });
  }

  return response.json() as Promise<unknown>;
}

function isCoinGeckoProviderLimitedError(error: unknown) {
  if (!(error instanceof CoinGeckoProviderError)) {
    return false;
  }

  return error.errorCode === 10005 || error.errorCode === 10011;
}

function getCoinGeckoGlobalDays({
  endTime,
  interval,
  startTime,
}: {
  endTime: number;
  interval: PortalChartInterval;
  startTime: number;
}) {
  if (interval === "1h") {
    return "1";
  }

  const requestedDays = Math.ceil((endTime - startTime) / DAY_MS);

  return String(Math.max(1, requestedDays));
}

function getCoinGeckoEffectiveRange({
  endTime,
  interval,
  startTime,
}: {
  endTime: number;
  interval: PortalChartInterval;
  startTime: number;
}) {
  if (interval === "1h") {
    return {
      endTime,
      startTime: Math.max(startTime, endTime - DAY_MS),
    };
  }

  return { endTime, startTime };
}

async function fetchCoinGeckoGlobalMarketCapSeries(request: {
  endTime: number;
  interval: PortalChartInterval;
  startTime: number;
}) {
  const payload = (await fetchCoinGeckoJson(
    "/global/market_cap_chart",
    new URLSearchParams({
      days: getCoinGeckoGlobalDays(request),
      vs_currency: "usd",
    }),
  )) as CoinGeckoGlobalMarketCapPayload;

  return normalizeToBucketSeries(
    normalizeSeriesPoints(payload.market_cap_chart?.market_cap),
    request.interval,
  );
}

async function fetchCoinGeckoCoinMarketCapSeries(
  coinId: string,
  request: {
    endTime: number;
    interval: PortalChartInterval;
    startTime: number;
  },
) {
  const effectiveRange = getCoinGeckoEffectiveRange(request);
  const searchParams = new URLSearchParams({
    from: String(Math.floor(effectiveRange.startTime / 1000)),
    interval: request.interval === "1h" ? "hourly" : "daily",
    precision: "full",
    to: String(Math.floor(effectiveRange.endTime / 1000)),
    vs_currency: "usd",
  });
  const payload = (await fetchCoinGeckoJson(
    `/coins/${coinId}/market_chart/range`,
    searchParams,
  )) as CoinGeckoCoinMarketChartPayload;

  return normalizeToBucketSeries(
    normalizeSeriesPoints(payload.market_caps),
    request.interval,
  );
}

async function fetchCoinGeckoIndexCandles({
  endTime,
  interval,
  startTime,
  symbol,
}: FetchIndexCandlesRequest): Promise<IndexCandleProviderResult> {
  if (!isCoinGeckoSupportedInterval(interval)) {
    return {
      code: INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE,
      error:
        "CoinGecko index candles currently support 1h and 1d timeframes only.",
      status: "unsupported-timeframe",
    };
  }

  try {
    const request = { endTime, interval, startTime };
    const totalSeries = await fetchCoinGeckoGlobalMarketCapSeries(request);
    let candles: PortalChartCandle[] = [];
    let formula: string | undefined;

    switch (symbol) {
      case "TOTAL": {
        formula = "TOTAL";
        candles = buildCandlesFromSeries(totalSeries);
        break;
      }
      case "TOTAL2": {
        const btcSeries = await fetchCoinGeckoCoinMarketCapSeries(
          COINGECKO_COIN_IDS.bitcoin,
          request,
        );
        formula = "TOTAL - BTC";
        candles = buildCandlesFromSeries(subtractSeries(totalSeries, [btcSeries]));
        break;
      }
      case "TOTAL3": {
        const [btcSeries, ethSeries] = await Promise.all([
          fetchCoinGeckoCoinMarketCapSeries(COINGECKO_COIN_IDS.bitcoin, request),
          fetchCoinGeckoCoinMarketCapSeries(COINGECKO_COIN_IDS.ethereum, request),
        ]);
        formula = "TOTAL - BTC - ETH";
        candles = buildCandlesFromSeries(
          subtractSeries(totalSeries, [btcSeries, ethSeries]),
        );
        break;
      }
      case "OTHERS": {
        const [btcSeries, ethSeries, usdtSeries] = await Promise.all([
          fetchCoinGeckoCoinMarketCapSeries(COINGECKO_COIN_IDS.bitcoin, request),
          fetchCoinGeckoCoinMarketCapSeries(COINGECKO_COIN_IDS.ethereum, request),
          fetchCoinGeckoCoinMarketCapSeries(COINGECKO_COIN_IDS.tether, request),
        ]);
        formula = "TOTAL - BTC - ETH - USDT";
        candles = buildCandlesFromSeries(
          subtractSeries(totalSeries, [btcSeries, ethSeries, usdtSeries]),
        );
        break;
      }
      case "BTC.D":
      case "ETH.D":
      case "USDT.D": {
        const coinId =
          symbol === "BTC.D"
            ? COINGECKO_COIN_IDS.bitcoin
            : symbol === "ETH.D"
              ? COINGECKO_COIN_IDS.ethereum
              : COINGECKO_COIN_IDS.tether;
        const coinSeries = await fetchCoinGeckoCoinMarketCapSeries(
          coinId,
          request,
        );
        formula = `${symbol.replace(".D", "")} market cap / TOTAL * 100`;
        candles = buildCandlesFromSeries(
          divideSeriesAsPercent(coinSeries, totalSeries),
        );
        break;
      }
      default:
        return {
          error: `Unsupported index symbol ${symbol}.`,
          status: "fetch-failed",
        };
    }

    return candles.length > 0
      ? { candles, formula, provider: "coingecko", status: "loaded" }
      : { candles: [], formula, provider: "coingecko", status: "no-data" };
  } catch (error) {
    if (isCoinGeckoProviderLimitedError(error)) {
      return {
        code: INDEX_CANDLE_PROVIDER_LIMITED_CODE,
        error:
          "CoinGecko index history is not available for this API key.",
        status: "provider-limited",
      };
    }

    return {
      error: "Unable to load CoinGecko index chart data.",
      status: "fetch-failed",
    };
  }
}

async function fetchCustomIndexCandles({
  endTime,
  interval,
  startTime,
  symbol,
  tradingViewSymbol,
}: FetchIndexCandlesRequest): Promise<IndexCandleProviderResult> {
  const indexProviderUrl = process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;

  if (!indexProviderUrl) {
    return {
      error: "Index data source not connected yet.",
      status: "provider-missing",
    };
  }

  const url = new URL(indexProviderUrl);
  url.searchParams.set("symbol", tradingViewSymbol);
  url.searchParams.set("portalSymbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("from", String(startTime));
  url.searchParams.set("to", String(endTime));

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      return {
        error: `Index candle provider failed with ${response.status}.`,
        status: "fetch-failed",
      };
    }

    const candles = normalizeProviderPayload(await response.json());

    return candles.length > 0
      ? { candles, provider: "custom", status: "loaded" }
      : { candles: [], provider: "custom", status: "no-data" };
  } catch {
    return {
      error: "Unable to load index chart data.",
      status: "fetch-failed",
    };
  }
}

export async function fetchIndexCandles(
  request: FetchIndexCandlesRequest,
): Promise<IndexCandleProviderResult> {
  if (process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL) {
    return fetchCustomIndexCandles(request);
  }

  if (!getCoinGeckoApiKey()) {
    return {
      error: "Index data source not connected yet.",
      status: "provider-missing",
    };
  }

  const cacheTtlMs = getEnvPositiveNumber(
    "PORTAL_COINGECKO_INDEX_CACHE_TTL_MS",
    DEFAULT_COINGECKO_INDEX_CACHE_TTL_MS,
  );
  const cacheKey = [
    "coingecko",
    request.symbol,
    request.interval,
    request.startTime,
    request.endTime,
  ].join(":");
  const now = Date.now();
  const cachedEntry = coingeckoResultCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.result;
  }

  const inFlightRequest = coingeckoInFlightRequests.get(cacheKey);

  if (inFlightRequest) {
    return inFlightRequest;
  }

  const requestPromise = fetchCoinGeckoIndexCandles(request).then((result) => {
    if (result.status === "loaded" || result.status === "no-data") {
      coingeckoResultCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        result,
      });
    }

    coingeckoInFlightRequests.delete(cacheKey);

    return result;
  });

  coingeckoInFlightRequests.set(cacheKey, requestPromise);

  return requestPromise;
}
