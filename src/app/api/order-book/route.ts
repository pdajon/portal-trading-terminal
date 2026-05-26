import { resolveHyperliquidMarketFromMetadata } from "@/lib/markets/hyperliquid-market-data";
import type {
  HyperliquidOrderBook,
  HyperliquidOrderBookLevel,
  HyperliquidSymbol,
} from "@/types/market";

export const dynamic = "force-dynamic";

const HYPERLIQUID_TESTNET_INFO_URL = "https://api.hyperliquid-testnet.xyz/info";
const ORDER_BOOK_CACHE_TTL_MS = 1_000;
const ORDER_BOOK_DEPTH = 12;

type HyperliquidL2Level = {
  n?: unknown;
  px?: unknown;
  sz?: unknown;
};

type HyperliquidL2BookPayload = {
  coin?: unknown;
  levels?: [HyperliquidL2Level[], HyperliquidL2Level[]];
  time?: unknown;
};

type CachedOrderBook = {
  expiresAt: number;
  payload: HyperliquidOrderBook;
};

const orderBookCache = new Map<string, CachedOrderBook>();
const inFlightOrderBookRequests = new Map<string, Promise<HyperliquidOrderBook>>();

function parseFiniteNumber(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeLevels(levels: HyperliquidL2Level[] | undefined) {
  let runningTotal = 0;
  let runningTotalUsd = 0;

  return (levels ?? [])
    .slice(0, ORDER_BOOK_DEPTH)
    .map((level): HyperliquidOrderBookLevel | null => {
      const price = parseFiniteNumber(level.px);
      const size = parseFiniteNumber(level.sz);

      if (price === null || size === null) {
        return null;
      }

      runningTotal += size;
      runningTotalUsd += size * price;

      return {
        price,
        size,
        sizeUsd: size * price,
        total: runningTotal,
        totalUsd: runningTotalUsd,
      };
    })
    .filter((level): level is HyperliquidOrderBookLevel => level !== null);
}

async function readHyperliquidJson<T>(response: Response): Promise<T> {
  const body = await response.text();

  if (body.trim().length === 0) {
    throw new Error("Hyperliquid order book response was empty");
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Hyperliquid order book response was not valid JSON");
  }
}

async function fetchHyperliquidOrderBook(
  symbol: HyperliquidSymbol,
  coin: string,
) {
  const response = await fetch(HYPERLIQUID_TESTNET_INFO_URL, {
    body: JSON.stringify({ coin, type: "l2Book" }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid order book request failed with ${response.status}`);
  }

  const payload = await readHyperliquidJson<HyperliquidL2BookPayload>(response);
  const rawLevels = Array.isArray(payload.levels) ? payload.levels : [[], []];
  const bids = normalizeLevels(rawLevels[0]);
  const asks = normalizeLevels(rawLevels[1]);
  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const spread =
    bestAsk !== null && bestBid !== null ? Math.max(0, bestAsk - bestBid) : null;
  const midPrice =
    bestAsk !== null && bestBid !== null ? (bestAsk + bestBid) / 2 : null;
  const spreadPercent =
    spread !== null && midPrice !== null && midPrice > 0
      ? (spread / midPrice) * 100
      : null;

  return {
    asks,
    bids,
    coin,
    fetchedAt: Date.now(),
    source: "hyperliquid-testnet-l2-book",
    spread,
    spreadPercent,
    symbol,
    time: parseFiniteNumber(payload.time),
  } satisfies HyperliquidOrderBook;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "BTC-USD") as HyperliquidSymbol;
  const market = await resolveHyperliquidMarketFromMetadata(symbol);

  if (!market) {
    return Response.json(
      { error: `No Hyperliquid order book path configured for ${symbol}` },
      { status: 400 },
    );
  }

  try {
    const now = Date.now();
    const cachedEntry = orderBookCache.get(symbol);

    if (cachedEntry && cachedEntry.expiresAt > now) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Order-Book-Cache": "hit",
          "X-Portal-Order-Book-Source": "hyperliquid-testnet-l2-book",
        },
      });
    }

    let requestPromise = inFlightOrderBookRequests.get(symbol);

    if (!requestPromise) {
      requestPromise = fetchHyperliquidOrderBook(symbol, market.coin);
      inFlightOrderBookRequests.set(symbol, requestPromise);
    }

    const orderBook = await requestPromise;
    orderBookCache.set(symbol, {
      expiresAt: now + ORDER_BOOK_CACHE_TTL_MS,
      payload: orderBook,
    });
    inFlightOrderBookRequests.delete(symbol);

    return Response.json(orderBook, {
      headers: {
        "X-Portal-Order-Book-Cache": "miss",
        "X-Portal-Order-Book-Source": "hyperliquid-testnet-l2-book",
      },
    });
  } catch (error) {
    inFlightOrderBookRequests.delete(symbol);
    console.error("[portal] Hyperliquid order book fetch failed", error);

    const cachedEntry = orderBookCache.get(symbol);

    if (cachedEntry?.payload) {
      return Response.json(cachedEntry.payload, {
        headers: {
          "X-Portal-Order-Book-Cache": "stale",
          "X-Portal-Order-Book-Source": "hyperliquid-testnet-l2-book",
        },
      });
    }

    return Response.json(
      { error: "Unable to fetch Hyperliquid order book." },
      { status: 502 },
    );
  }
}
