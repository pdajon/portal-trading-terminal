import {
  normalizeFundingRateHistory,
  normalizeOpenInterestSnapshot,
  type ChartMarketContext,
} from "@/features/chart/lib/chart-market-context";
import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";

export const dynamic = "force-dynamic";

const HYPERLIQUID_TESTNET_INFO_URL = "https://api.hyperliquid-testnet.xyz/info";
const MARKET_CONTEXT_CACHE_TTL_MS = 60_000;
const FUNDING_WINDOW_HOURS = 7 * 24;

type HyperliquidUniverseAsset = {
  name?: unknown;
};

type HyperliquidAssetCtx = {
  markPx?: unknown;
  openInterest?: unknown;
};

type CachedMarketContext = {
  expiresAt: number;
  payload: ChartMarketContext;
};

const marketContextCache = new Map<string, CachedMarketContext>();
const inFlightMarketContextRequests = new Map<string, Promise<ChartMarketContext>>();

function parseFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

async function fetchFundingHistory(coin: string, startTime: number, endTime: number) {
  const response = await fetch(HYPERLIQUID_TESTNET_INFO_URL, {
    body: JSON.stringify({
      coin,
      endTime,
      startTime,
      type: "fundingHistory",
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid funding history request failed with ${response.status}`);
  }

  return response.json();
}

async function fetchAssetContext(coin: string) {
  const response = await fetch(HYPERLIQUID_TESTNET_INFO_URL, {
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid asset context request failed with ${response.status}`);
  }

  const payload = (await response.json()) as [
    { universe?: HyperliquidUniverseAsset[] },
    HyperliquidAssetCtx[],
  ];
  const universe = Array.isArray(payload[0]?.universe) ? payload[0].universe : [];
  const assetContexts = Array.isArray(payload[1]) ? payload[1] : [];
  const assetIndex = universe.findIndex((asset) => asset.name === coin);

  return assetIndex >= 0 ? assetContexts[assetIndex] : null;
}

async function fetchHyperliquidMarketContext(symbol: string, coin: string) {
  const fetchedAt = Date.now();
  const startTime = fetchedAt - FUNDING_WINDOW_HOURS * 60 * 60 * 1000;
  const [fundingHistory, assetContext] = await Promise.all([
    fetchFundingHistory(coin, startTime, fetchedAt),
    fetchAssetContext(coin),
  ]);

  return {
    coin,
    fetchedAt,
    fundingRates: normalizeFundingRateHistory(fundingHistory, coin),
    fundingWindowHours: FUNDING_WINDOW_HOURS,
    openInterest: normalizeOpenInterestSnapshot({
      markPrice: parseFiniteNumber(assetContext?.markPx),
      openInterestBase: parseFiniteNumber(assetContext?.openInterest),
      time: fetchedAt,
    }),
    source: "hyperliquid-testnet-market-context",
    symbol,
  } satisfies ChartMarketContext;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") ?? "BTC-USD";
  const market = await resolveHyperliquidMarketFromMetadata(symbol);

  if (!market) {
    return Response.json(
      { error: `No Hyperliquid market context path configured for ${symbol}` },
      { status: 400 },
    );
  }

  try {
    const now = Date.now();
    const cachedEntry = marketContextCache.get(market.symbol);

    if (cachedEntry && cachedEntry.expiresAt > now) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Market-Context-Cache": "hit",
          "X-Portal-Market-Context-Source": "hyperliquid-testnet-market-context",
        },
      });
    }

    let requestPromise = inFlightMarketContextRequests.get(market.symbol);

    if (!requestPromise) {
      requestPromise = fetchHyperliquidMarketContext(market.symbol, market.coin);
      inFlightMarketContextRequests.set(market.symbol, requestPromise);
    }

    const context = await requestPromise;
    marketContextCache.set(market.symbol, {
      expiresAt: now + MARKET_CONTEXT_CACHE_TTL_MS,
      payload: context,
    });
    inFlightMarketContextRequests.delete(market.symbol);

    return Response.json(context, {
      headers: {
        "X-Portal-Market-Context-Cache": "miss",
        "X-Portal-Market-Context-Source": "hyperliquid-testnet-market-context",
      },
    });
  } catch (error) {
    inFlightMarketContextRequests.delete(market.symbol);
    console.error("[portal] Hyperliquid market context fetch failed", error);

    const cachedEntry = marketContextCache.get(market.symbol);

    if (cachedEntry?.payload) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Market-Context-Cache": "stale",
          "X-Portal-Market-Context-Source": "hyperliquid-testnet-market-context",
        },
      });
    }

    return Response.json(
      { error: "Unable to fetch Hyperliquid market context." },
      { status: 502 },
    );
  }
}
