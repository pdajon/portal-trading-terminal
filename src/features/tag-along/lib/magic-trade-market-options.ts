import type { HyperliquidMarketMetadata } from "@/types/market";
import {
  getPortalMarketMetadata,
  type PortalMarketMetadata,
} from "@/lib/markets/portal-market-registry";

import type { TagAlongSymbol } from "./tag-along-rules";

export type MagicTradeMarketUse = {
  lastUsedAt: number;
  symbol: TagAlongSymbol;
  useCount: number;
};

export type MagicTradeMarketOption = PortalMarketMetadata & {
  label: string;
  value: TagAlongSymbol;
};

export const MAGIC_TRADE_ANCHOR_MARKET_SYMBOLS = [
  "BTC-USD",
  "ETH-USD",
  "SOL-USD",
  "HYPE-USD",
  "DOGE-USD",
  "TOTAL",
  "BTC.D",
] as const satisfies readonly TagAlongSymbol[];

export const MAGIC_TRADE_MARKET_USE_STORAGE_KEY =
  "portal.magic-trade-market-uses";

const MAX_TARGET_QUICK_MARKETS = 6;
const MAX_FULL_MARKET_OPTIONS = 18;
const MAGIC_TRADE_CENT_EPSILON = 0.000001;
const MAGIC_TRADE_MARGIN_BUFFER_USD = 0.01;

export function getMagicTradeAnchorMarketOptions(
  markets: readonly (HyperliquidMarketMetadata | PortalMarketMetadata)[],
) {
  const marketBySymbol = getEnabledMarketBySymbol(
    normalizeMagicTradeMarkets(markets).filter((market) => market.triggerable),
  );

  return MAGIC_TRADE_ANCHOR_MARKET_SYMBOLS.map(
    (symbol) => marketBySymbol.get(symbol),
  )
    .filter((market): market is PortalMarketMetadata => Boolean(market))
    .map(toMagicTradeMarketOption);
}

export function getMagicTradeTargetQuickMarketOptions(
  markets: readonly (HyperliquidMarketMetadata | PortalMarketMetadata)[],
  recentMarkets: readonly MagicTradeMarketUse[] = [],
) {
  const marketBySymbol = getEnabledMarketBySymbol(
    normalizeMagicTradeMarkets(markets).filter(
      (market) => market.executionEnabled,
    ),
  );
  const options = new Map<TagAlongSymbol, MagicTradeMarketOption>();

  for (const option of getMagicTradeAnchorMarketOptions(markets)) {
    const market = marketBySymbol.get(option.value);

    if (!market) {
      continue;
    }

    options.set(option.value, option);
  }

  const rankedRecentMarkets = [...recentMarkets].sort(
    (left, right) =>
      right.useCount - left.useCount || right.lastUsedAt - left.lastUsedAt,
  );

  for (const recentMarket of rankedRecentMarkets) {
    const market = marketBySymbol.get(recentMarket.symbol);

    if (!market || options.has(recentMarket.symbol)) {
      continue;
    }

    options.set(recentMarket.symbol, toMagicTradeMarketOption(market));

    if (options.size >= MAX_TARGET_QUICK_MARKETS) {
      break;
    }
  }

  return [...options.values()].slice(0, MAX_TARGET_QUICK_MARKETS);
}

export function getMagicTradeFullMarketOptions(
  markets: readonly (HyperliquidMarketMetadata | PortalMarketMetadata)[],
  query: string,
  limit = MAX_FULL_MARKET_OPTIONS,
) {
  return getMagicTradeFullMarketOptionsByCapability(
    markets,
    query,
    "execution",
    limit,
  );
}

export function getMagicTradeFullSourceMarketOptions(
  markets: readonly (HyperliquidMarketMetadata | PortalMarketMetadata)[],
  query: string,
  limit = MAX_FULL_MARKET_OPTIONS,
) {
  return getMagicTradeFullMarketOptionsByCapability(
    markets,
    query,
    "trigger",
    limit,
  );
}

function getMagicTradeFullMarketOptionsByCapability(
  markets: readonly (HyperliquidMarketMetadata | PortalMarketMetadata)[],
  query: string,
  capability: "execution" | "trigger",
  limit = MAX_FULL_MARKET_OPTIONS,
) {
  const normalizedQuery = query.trim().toUpperCase();

  return normalizeMagicTradeMarkets(markets)
    .filter((market) => market.enabled)
    .filter((market) =>
      capability === "execution" ? market.executionEnabled : market.triggerable,
    )
    .filter((market) =>
      normalizedQuery
        ? [
            market.baseAsset,
            market.coin,
            market.displayName,
            market.quoteLabel,
            ...market.searchKeywords,
            market.symbol,
            market.ticker,
          ].some(
            (value) => value.toUpperCase().includes(normalizedQuery),
          )
        : true,
    )
    .slice(0, Math.max(1, limit))
    .map(toMagicTradeMarketOption);
}

export function parseMagicTradeMarketUses(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isMagicTradeMarketUse).slice(0, 18);
  } catch {
    return [];
  }
}

export function serializeMagicTradeMarketUses(
  recentMarkets: readonly MagicTradeMarketUse[],
) {
  return JSON.stringify(recentMarkets.slice(0, 18));
}

export function recordMagicTradeMarketUse(
  recentMarkets: readonly MagicTradeMarketUse[],
  symbol: TagAlongSymbol,
  now = Date.now(),
) {
  const existing = recentMarkets.find((market) => market.symbol === symbol);
  const nextEntry: MagicTradeMarketUse = {
    lastUsedAt: now,
    symbol,
    useCount: (existing?.useCount ?? 0) + 1,
  };

  return [
    nextEntry,
    ...recentMarkets.filter((market) => market.symbol !== symbol),
  ].slice(0, 18);
}

export function getMagicTradeMaxMarginInputValue(availableFunds: number) {
  if (!Number.isFinite(availableFunds) || availableFunds <= 0) {
    return "";
  }

  const normalizedFunds =
    Math.floor(
      (availableFunds - MAGIC_TRADE_MARGIN_BUFFER_USD + MAGIC_TRADE_CENT_EPSILON) *
        100,
    ) / 100;

  return normalizedFunds > 0
    ? normalizedFunds.toFixed(2)
    : "";
}

export function isMagicTradeMarginInputValid(
  inputValue: string,
  availableFunds: number,
) {
  const parsedValue = Number(inputValue.replaceAll(",", ""));

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return false;
  }

  if (!Number.isFinite(availableFunds) || availableFunds < 0) {
    return true;
  }

  const parsedCents = Math.round((parsedValue + MAGIC_TRADE_CENT_EPSILON) * 100);
  const availableCents = Math.floor(
    (availableFunds - MAGIC_TRADE_MARGIN_BUFFER_USD + MAGIC_TRADE_CENT_EPSILON) *
      100,
  );

  return parsedCents <= availableCents;
}

function normalizeMagicTradeMarkets(
  markets: readonly (HyperliquidMarketMetadata | PortalMarketMetadata)[],
) {
  if (markets.some((market) => "type" in market)) {
    return markets as readonly PortalMarketMetadata[];
  }

  return getPortalMarketMetadata(markets as readonly HyperliquidMarketMetadata[]);
}

function getEnabledMarketBySymbol(markets: readonly PortalMarketMetadata[]) {
  return new Map(
    markets
      .filter((market) => market.enabled)
      .map((market) => [market.symbol as TagAlongSymbol, market] as const),
  );
}

function toMagicTradeMarketOption(
  market: PortalMarketMetadata,
): MagicTradeMarketOption {
  return {
    ...market,
    label: market.baseAsset,
    value: market.symbol as TagAlongSymbol,
  };
}

function isMagicTradeMarketUse(value: unknown): value is MagicTradeMarketUse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as MagicTradeMarketUse;

  return (
    typeof candidate.symbol === "string" &&
    candidate.symbol.endsWith("-USD") &&
    typeof candidate.lastUsedAt === "number" &&
    Number.isFinite(candidate.lastUsedAt) &&
    typeof candidate.useCount === "number" &&
    Number.isFinite(candidate.useCount) &&
    candidate.useCount > 0
  );
}
