import type { HyperliquidSymbol } from "@/types/market";

export const MAGIC_TRADE_TARGET_BTC_PRICE_UNAVAILABLE_REASON = "Target BTC price unavailable";

export type MagicTradeTargetPriceSource = "cached" | "subscription" | "latest-close";

export type MagicTradeTargetPriceResult =
  | {
      ok: true;
      price: number;
      source: MagicTradeTargetPriceSource;
    }
  | {
      ok: false;
      reason: string;
    };

export type MagicTradeTargetPriceResolverOptions = {
  cachedPrice: number | null | undefined;
  cachedPriceUpdatedAt: number | null | undefined;
  fetchLatestClose: () => Promise<number | null | undefined>;
  maxCachedAgeMs: number;
  now: number;
  subscribeToLivePrice: () => Promise<number | null | undefined>;
  symbol: HyperliquidSymbol;
};

function isValidPrice(price: unknown): price is number {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

export function getMagicTradeTargetPriceUnavailableReason(symbol: HyperliquidSymbol) {
  const [baseAsset] = symbol.split("-");

  return `Target ${baseAsset} price unavailable`;
}

export async function resolveMagicTradeTargetPrice({
  cachedPrice,
  cachedPriceUpdatedAt,
  fetchLatestClose,
  maxCachedAgeMs,
  now,
  subscribeToLivePrice,
  symbol,
}: MagicTradeTargetPriceResolverOptions): Promise<MagicTradeTargetPriceResult> {
  if (
    isValidPrice(cachedPrice) &&
    typeof cachedPriceUpdatedAt === "number" &&
    Number.isFinite(cachedPriceUpdatedAt) &&
    now - cachedPriceUpdatedAt <= maxCachedAgeMs
  ) {
    return {
      ok: true,
      price: cachedPrice,
      source: "cached",
    };
  }

  const subscribedPrice = await subscribeToLivePrice();

  if (isValidPrice(subscribedPrice)) {
    return {
      ok: true,
      price: subscribedPrice,
      source: "subscription",
    };
  }

  const latestClose = await fetchLatestClose();

  if (isValidPrice(latestClose)) {
    return {
      ok: true,
      price: latestClose,
      source: "latest-close",
    };
  }

  return {
    ok: false,
    reason: getMagicTradeTargetPriceUnavailableReason(symbol),
  };
}
