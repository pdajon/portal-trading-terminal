import { getDefaultChartLookbackMs } from "@/features/chart/lib/chart-lookback";
import {
  fetchIndexCandles,
  INDEX_CANDLE_FETCH_FAILED_CODE,
  INDEX_CANDLE_PROVIDER_MISSING_CODE,
  INDEX_CANDLE_PROVIDER_LIMITED_CODE,
  INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE,
} from "@/features/chart/data/index-candle-provider";
import {
  resolvePortalChartDataProvider,
} from "@/lib/markets/portal-chart-data";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";

export const dynamic = "force-dynamic";

const HYPERLIQUID_TESTNET_INFO_URL = "https://api.hyperliquid-testnet.xyz/info";
const SUPPORTED_INTERVALS = ["1m", "5m", "15m", "1h", "1d"] as const;
const CHART_CACHE_TTL_MS = 1_500;
const DEFAULT_CHART_END_BUCKET_MS = 10_000;

type ChartInterval = (typeof SUPPORTED_INTERVALS)[number];

type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

type CachedChartResponse = {
  expiresAt: number;
  payload: ChartCandle[];
};

const chartResponseCache = new Map<string, CachedChartResponse>();
const inFlightChartRequests = new Map<string, Promise<ChartCandle[]>>();

function isSupportedInterval(interval: string): interval is ChartInterval {
  return SUPPORTED_INTERVALS.includes(interval as ChartInterval);
}

function getStabilizedDefaultEndTime() {
  return Math.floor(Date.now() / DEFAULT_CHART_END_BUCKET_MS) * DEFAULT_CHART_END_BUCKET_MS;
}

function normalizeTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
}

async function fetchHyperliquidCandles(
  coin: string,
  interval: ChartInterval,
  startTime: number,
  endTime: number,
) {
  const response = await fetch(HYPERLIQUID_TESTNET_INFO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin,
        interval,
        startTime,
        endTime,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid request failed with ${response.status}`);
  }

  const payload = (await response.json()) as Array<{
    t: number;
    o: string;
    h: string;
    l: string;
    c: string;
    v?: string | number;
  }>;

  return payload.map((candle) => ({
    time: Math.floor(candle.t / 1000),
    open: Number(candle.o),
    high: Number(candle.h),
    low: Number(candle.l),
    close: Number(candle.c),
    volume: Number.isFinite(Number(candle.v)) ? Number(candle.v) : null,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") ?? "BTC-USD";
  const requestedInterval = searchParams.get("interval") ?? "1m";
  const interval = isSupportedInterval(requestedInterval) ? requestedInterval : "1m";
  const requestedTo = normalizeTimestamp(searchParams.get("to"));
  const requestedFrom = normalizeTimestamp(searchParams.get("from"));
  const bypassCache = searchParams.get("fresh") === "1";
  const endTime = requestedTo ?? getStabilizedDefaultEndTime();
  const startTime = requestedFrom ?? endTime - getDefaultChartLookbackMs(interval);
  const cacheKey = `${symbol}:${interval}:${startTime}:${endTime}`;
  const provider = resolvePortalChartDataProvider(symbol);

  if (provider.kind === "tradingview-compatible-index") {
    const now = Date.now();
    const cachedEntry = chartResponseCache.get(cacheKey);

    if (!bypassCache && cachedEntry && cachedEntry.expiresAt > now) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Chart-Cache": "hit",
          "X-Portal-Chart-Interval": interval,
          "X-Portal-Chart-Source": "tradingview-compatible-index",
          "X-Portal-Chart-State": cachedEntry.payload.length > 0 ? "loaded" : "no-data",
        },
      });
    }

    const indexResult = await fetchIndexCandles({
      endTime,
      interval,
      startTime,
      symbol,
      tradingViewSymbol: provider.tradingViewSymbol,
    });

    if (indexResult.status === "provider-missing") {
      return Response.json(
        {
          candles: [],
          code: INDEX_CANDLE_PROVIDER_MISSING_CODE,
          error: indexResult.error,
          state: "provider-missing",
        },
        {
          headers: {
            "X-Portal-Chart-Interval": interval,
            "X-Portal-Chart-Source": "tradingview-compatible-index",
            "X-Portal-Chart-State": "provider-missing",
          },
        },
      );
    }

    if (indexResult.status === "unsupported-timeframe") {
      return Response.json(
        {
          candles: [],
          code:
            indexResult.code ?? INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE,
          error: indexResult.error,
          state: "unsupported-timeframe",
        },
        {
          headers: {
            "X-Portal-Chart-Interval": interval,
            "X-Portal-Chart-Source": "tradingview-compatible-index",
            "X-Portal-Chart-State": "unsupported-timeframe",
          },
        },
      );
    }

    if (indexResult.status === "provider-limited") {
      return Response.json(
        {
          candles: [],
          code:
            indexResult.code ?? INDEX_CANDLE_PROVIDER_LIMITED_CODE,
          error: indexResult.error,
          state: "provider-limited",
        },
        {
          headers: {
            "X-Portal-Chart-Interval": interval,
            "X-Portal-Chart-Source": "tradingview-compatible-index",
            "X-Portal-Chart-State": "provider-limited",
          },
        },
      );
    }

    if (indexResult.status === "fetch-failed") {
      if (cachedEntry?.payload.length) {
        return Response.json(cachedEntry.payload, {
          headers: {
            "X-Portal-Chart-Cache": "stale",
            "X-Portal-Chart-Interval": interval,
            "X-Portal-Chart-Source": "tradingview-compatible-index",
            "X-Portal-Chart-State": "loaded",
          },
        });
      }

      return Response.json(
        {
          code: INDEX_CANDLE_FETCH_FAILED_CODE,
          error: indexResult.error,
        },
        {
          headers: {
            "X-Portal-Chart-Interval": interval,
            "X-Portal-Chart-Source": "tradingview-compatible-index",
            "X-Portal-Chart-State": "fetch-failed",
          },
          status: 502,
        },
      );
    }

    if (indexResult.status === "loaded" || indexResult.status === "no-data") {
      chartResponseCache.set(cacheKey, {
        expiresAt: now + CHART_CACHE_TTL_MS,
        payload: indexResult.candles,
      });

      return Response.json(indexResult.candles, {
        headers: {
          "X-Portal-Chart-Cache": bypassCache ? "bypass" : "miss",
          "X-Portal-Chart-Interval": interval,
          "X-Portal-Chart-Index-Formula": indexResult.formula ?? "",
          "X-Portal-Chart-Index-Provider": indexResult.provider,
          "X-Portal-Chart-Source": "tradingview-compatible-index",
          "X-Portal-Chart-State": indexResult.status,
        },
      });
    }
  }

  const market = await resolveHyperliquidMarketFromMetadata(symbol);

  if (!market) {
    return Response.json(
      { error: `No real chart data path configured for ${symbol}` },
      { status: 400 },
    );
  }

  try {
    const now = Date.now();
    const cachedEntry = chartResponseCache.get(cacheKey);

    if (!bypassCache && cachedEntry && cachedEntry.expiresAt > now) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Chart-Cache": "hit",
          "X-Portal-Chart-Interval": interval,
          "X-Portal-Chart-Source": "hyperliquid-testnet",
        },
      });
    }

    let requestPromise = bypassCache ? undefined : inFlightChartRequests.get(cacheKey);

    if (!requestPromise) {
      requestPromise = fetchHyperliquidCandles(market.coin, interval, startTime, endTime);
      if (!bypassCache) {
        inFlightChartRequests.set(cacheKey, requestPromise);
      }
    }

    const candles = await requestPromise;
    chartResponseCache.set(cacheKey, {
      expiresAt: now + CHART_CACHE_TTL_MS,
      payload: candles,
    });
    inFlightChartRequests.delete(cacheKey);

    return Response.json(candles, {
      headers: {
        "X-Portal-Chart-Cache": bypassCache ? "bypass" : "miss",
        "X-Portal-Chart-Source": "hyperliquid-testnet",
        "X-Portal-Chart-Interval": interval,
      },
    });
  } catch {
    inFlightChartRequests.delete(cacheKey);

    const cachedEntry = chartResponseCache.get(cacheKey);

    if (cachedEntry?.payload.length) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Chart-Cache": "stale",
          "X-Portal-Chart-Source": "hyperliquid-testnet",
          "X-Portal-Chart-Interval": interval,
        },
      });
    }

    return Response.json(
      { error: `Unable to load Hyperliquid testnet chart data for ${symbol}` },
      { status: 502 },
    );
  }
}
