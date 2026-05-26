import {
  getFallbackHyperliquidMarkets,
  mergeHyperliquidMarketsWithFallback,
  normalizeHyperliquidUniverseMarkets,
  resolveHyperliquidMarket,
  toHyperliquidMarketMetadata,
  type HyperliquidMarketResolution,
} from "@/lib/markets/hyperliquid-market-registry";

const HYPERLIQUID_TESTNET_INFO_URL = "https://api.hyperliquid-testnet.xyz/info";
const MARKET_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;

type MarketMetadataFetchResult = {
  degraded: boolean;
  error?: string;
  markets: HyperliquidMarketResolution[];
  source: "hyperliquid-testnet-meta" | "portal-static-fallback";
};

type CachedMarketMetadata = {
  expiresAt: number;
  result: MarketMetadataFetchResult;
};

let cachedMarketMetadata: CachedMarketMetadata | null = null;
let inFlightMarketMetadataRequest: Promise<MarketMetadataFetchResult> | null =
  null;

function getFallbackMarketMetadataResult(error?: unknown): MarketMetadataFetchResult {
  return {
    degraded: true,
    error: error instanceof Error ? error.message : undefined,
    markets: getFallbackHyperliquidMarkets(),
    source: "portal-static-fallback",
  };
}

async function fetchLiveHyperliquidMarkets(): Promise<MarketMetadataFetchResult> {
  const response = await fetch(HYPERLIQUID_TESTNET_INFO_URL, {
    body: JSON.stringify({ type: "meta" }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid metadata request failed with ${response.status}`);
  }

  const payload = (await response.json()) as { universe?: unknown };
  const normalizedMarkets = mergeHyperliquidMarketsWithFallback(
    normalizeHyperliquidUniverseMarkets(payload.universe),
  );

  if (normalizedMarkets.length === 0) {
    throw new Error("Hyperliquid metadata response did not contain markets");
  }

  return {
    degraded: false,
    markets: normalizedMarkets,
    source: "hyperliquid-testnet-meta",
  };
}

export function resetHyperliquidMarketMetadataCacheForTests() {
  cachedMarketMetadata = null;
  inFlightMarketMetadataRequest = null;
}

export async function fetchHyperliquidMarketMetadata(options: { fresh?: boolean } = {}) {
  const now = Date.now();

  if (!options.fresh && cachedMarketMetadata && cachedMarketMetadata.expiresAt > now) {
    return cachedMarketMetadata.result;
  }

  try {
    inFlightMarketMetadataRequest ??= fetchLiveHyperliquidMarkets();
    const result = await inFlightMarketMetadataRequest;
    cachedMarketMetadata = {
      expiresAt: now + MARKET_METADATA_CACHE_TTL_MS,
      result,
    };
    inFlightMarketMetadataRequest = null;

    return result;
  } catch (error) {
    inFlightMarketMetadataRequest = null;
    const fallbackResult = getFallbackMarketMetadataResult(error);
    cachedMarketMetadata = {
      expiresAt: now + MARKET_METADATA_CACHE_TTL_MS,
      result: fallbackResult,
    };

    return fallbackResult;
  }
}

export async function resolveHyperliquidMarketFromMetadata(
  symbol: string | null | undefined,
) {
  const metadata = await fetchHyperliquidMarketMetadata();

  return resolveHyperliquidMarket(symbol, metadata.markets);
}

export async function getHyperliquidMarketMetadataPayload(options: { fresh?: boolean } = {}) {
  const result = await fetchHyperliquidMarketMetadata(options);

  return {
    ...result,
    metadata: result.markets.map(toHyperliquidMarketMetadata),
  };
}
