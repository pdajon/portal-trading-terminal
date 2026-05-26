import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import type {
  HyperliquidRecentTrade,
  HyperliquidRecentTrades,
  HyperliquidSymbol,
} from "@/types/market";

export const dynamic = "force-dynamic";

const HYPERLIQUID_TESTNET_INFO_URL = "https://api.hyperliquid-testnet.xyz/info";
const RECENT_TRADES_CACHE_TTL_MS = 1_000;
const RECENT_TRADES_LIMIT = 24;

type HyperliquidRecentTradeWire = {
  hash?: unknown;
  px?: unknown;
  side?: unknown;
  sz?: unknown;
  tid?: unknown;
  time?: unknown;
};

type CachedRecentTrades = {
  expiresAt: number;
  payload: HyperliquidRecentTrades;
};

const recentTradesCache = new Map<string, CachedRecentTrades>();
const inFlightRecentTradesRequests = new Map<
  string,
  Promise<HyperliquidRecentTrades>
>();

function parseFiniteNumber(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeRecentTrade(
  trade: HyperliquidRecentTradeWire,
): HyperliquidRecentTrade | null {
  const price = parseFiniteNumber(trade.px);
  const size = parseFiniteNumber(trade.sz);
  const time = parseFiniteNumber(trade.time);

  if (price === null || size === null || time === null) {
    return null;
  }

  return {
    id: String(trade.tid ?? trade.hash ?? `${time}-${price}-${size}`),
    price,
    side: trade.side === "B" ? "buy" : "sell",
    size,
    sizeUsd: size * price,
    time,
  };
}

async function readHyperliquidJson<T>(response: Response): Promise<T> {
  const body = await response.text();

  if (body.trim().length === 0) {
    throw new Error("Hyperliquid recent trades response was empty");
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Hyperliquid recent trades response was not valid JSON");
  }
}

async function fetchHyperliquidRecentTrades(
  symbol: HyperliquidSymbol,
  coin: string,
) {
  const response = await fetch(HYPERLIQUID_TESTNET_INFO_URL, {
    body: JSON.stringify({ coin, type: "recentTrades" }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid recent trades request failed with ${response.status}`);
  }

  const payload = await readHyperliquidJson<HyperliquidRecentTradeWire[]>(response);
  const trades = (Array.isArray(payload) ? payload : [])
    .map(normalizeRecentTrade)
    .filter((trade): trade is HyperliquidRecentTrade => trade !== null)
    .slice(0, RECENT_TRADES_LIMIT);

  return {
    coin,
    fetchedAt: Date.now(),
    source: "hyperliquid-testnet-recent-trades",
    symbol,
    trades,
  } satisfies HyperliquidRecentTrades;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "BTC-USD") as HyperliquidSymbol;
  const market = await resolveHyperliquidMarketFromMetadata(symbol);

  if (!market) {
    return Response.json(
      { error: `No Hyperliquid recent trades path configured for ${symbol}` },
      { status: 400 },
    );
  }

  try {
    const now = Date.now();
    const cachedEntry = recentTradesCache.get(symbol);

    if (cachedEntry && cachedEntry.expiresAt > now) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Recent-Trades-Cache": "hit",
          "X-Portal-Recent-Trades-Source": "hyperliquid-testnet-recent-trades",
        },
      });
    }

    let requestPromise = inFlightRecentTradesRequests.get(symbol);

    if (!requestPromise) {
      requestPromise = fetchHyperliquidRecentTrades(symbol, market.coin);
      inFlightRecentTradesRequests.set(symbol, requestPromise);
    }

    const recentTrades = await requestPromise;
    recentTradesCache.set(symbol, {
      expiresAt: now + RECENT_TRADES_CACHE_TTL_MS,
      payload: recentTrades,
    });
    inFlightRecentTradesRequests.delete(symbol);

    return Response.json(recentTrades, {
      headers: {
        "X-Portal-Recent-Trades-Cache": "miss",
        "X-Portal-Recent-Trades-Source": "hyperliquid-testnet-recent-trades",
      },
    });
  } catch (error) {
    inFlightRecentTradesRequests.delete(symbol);
    console.error("[portal] Hyperliquid recent trades fetch failed", error);

    const cachedEntry = recentTradesCache.get(symbol);

    if (cachedEntry?.payload) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Recent-Trades-Cache": "stale",
          "X-Portal-Recent-Trades-Source": "hyperliquid-testnet-recent-trades",
        },
      });
    }

    return Response.json(
      { error: "Unable to fetch Hyperliquid recent trades." },
      { status: 502 },
    );
  }
}
