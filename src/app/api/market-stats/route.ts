import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import type {
  HyperliquidMarketStats,
  HyperliquidSymbol,
} from "@/types/market";

export const dynamic = "force-dynamic";

const HYPERLIQUID_TESTNET_INFO_URL = "https://api.hyperliquid-testnet.xyz/info";
const MARKET_STATS_CACHE_TTL_MS = 2_500;
const FUNDING_INTERVAL_MS = 60 * 60 * 1000;

type HyperliquidUniverseAsset = {
  name?: unknown;
};

type HyperliquidAssetCtx = {
  dayNtlVlm?: unknown;
  funding?: unknown;
  markPx?: unknown;
  openInterest?: unknown;
  oraclePx?: unknown;
  prevDayPx?: unknown;
};

type CachedMarketStats = {
  expiresAt: number;
  payload: HyperliquidMarketStats;
};

const marketStatsCache = new Map<string, CachedMarketStats>();
const inFlightMarketStatsRequests = new Map<
  string,
  Promise<HyperliquidMarketStats>
>();

function parseFiniteNumber(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getNextFundingTime(now: number) {
  return Math.floor(now / FUNDING_INTERVAL_MS) * FUNDING_INTERVAL_MS + FUNDING_INTERVAL_MS;
}

async function fetchHyperliquidMarketStats(
  symbol: HyperliquidSymbol,
  coin: string,
) {
  const response = await fetch(HYPERLIQUID_TESTNET_INFO_URL, {
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid market stats request failed with ${response.status}`);
  }

  const payload = (await response.json()) as [
    { universe?: HyperliquidUniverseAsset[] },
    HyperliquidAssetCtx[],
  ];
  const universe = Array.isArray(payload[0]?.universe)
    ? payload[0].universe
    : [];
  const assetContexts = Array.isArray(payload[1]) ? payload[1] : [];
  const assetIndex = universe.findIndex((asset) => asset.name === coin);
  const assetContext = assetIndex >= 0 ? assetContexts[assetIndex] : null;

  if (!assetContext) {
    throw new Error(`Hyperliquid market stats missing asset context for ${coin}`);
  }

  const markPrice = parseFiniteNumber(assetContext.markPx);
  const previousDayPrice = parseFiniteNumber(assetContext.prevDayPx);
  const openInterestBase = parseFiniteNumber(assetContext.openInterest);
  const dayChange =
    markPrice !== null && previousDayPrice !== null
      ? markPrice - previousDayPrice
      : null;
  const dayChangePercent =
    dayChange !== null &&
    previousDayPrice !== null &&
    previousDayPrice !== 0
      ? (dayChange / previousDayPrice) * 100
      : null;
  const openInterestUsd =
    openInterestBase !== null && markPrice !== null
      ? openInterestBase * markPrice
      : null;
  const now = Date.now();

  return {
    coin,
    dayChange,
    dayChangePercent,
    dayVolumeUsd: parseFiniteNumber(assetContext.dayNtlVlm),
    fetchedAt: now,
    fundingRate: parseFiniteNumber(assetContext.funding),
    markPrice,
    nextFundingTime: getNextFundingTime(now),
    openInterestBase,
    openInterestUsd,
    oraclePrice: parseFiniteNumber(assetContext.oraclePx),
    previousDayPrice,
    source: "hyperliquid-testnet-meta-and-asset-ctxs",
    symbol,
  } satisfies HyperliquidMarketStats;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "BTC-USD") as HyperliquidSymbol;
  const market = await resolveHyperliquidMarketFromMetadata(symbol);

  if (!market) {
    return Response.json(
      { error: `No Hyperliquid market stats path configured for ${symbol}` },
      { status: 400 },
    );
  }

  try {
    const now = Date.now();
    const cachedEntry = marketStatsCache.get(symbol);

    if (cachedEntry && cachedEntry.expiresAt > now) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Market-Stats-Cache": "hit",
          "X-Portal-Market-Stats-Source": "hyperliquid-testnet-meta-and-asset-ctxs",
        },
      });
    }

    let requestPromise = inFlightMarketStatsRequests.get(symbol);

    if (!requestPromise) {
      requestPromise = fetchHyperliquidMarketStats(symbol, market.coin);
      inFlightMarketStatsRequests.set(symbol, requestPromise);
    }

    const stats = await requestPromise;
    marketStatsCache.set(symbol, {
      expiresAt: now + MARKET_STATS_CACHE_TTL_MS,
      payload: stats,
    });
    inFlightMarketStatsRequests.delete(symbol);

    return Response.json(stats, {
      headers: {
        "X-Portal-Market-Stats-Cache": "miss",
        "X-Portal-Market-Stats-Source": "hyperliquid-testnet-meta-and-asset-ctxs",
      },
    });
  } catch (error) {
    inFlightMarketStatsRequests.delete(symbol);
    console.error("[portal] Hyperliquid market stats fetch failed", error);

    const cachedEntry = marketStatsCache.get(symbol);

    if (cachedEntry?.payload) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Market-Stats-Cache": "stale",
          "X-Portal-Market-Stats-Source": "hyperliquid-testnet-meta-and-asset-ctxs",
        },
      });
    }

    return Response.json(
      { error: "Unable to fetch Hyperliquid market stats." },
      { status: 502 },
    );
  }
}
