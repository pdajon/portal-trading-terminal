import type { HyperliquidSymbol } from "@/types/market";
import {
  getEnabledHyperliquidUiMarkets,
  getHyperliquidCoin,
  isSupportedHyperliquidSymbol,
  type HyperliquidMarketResolution,
} from "@/lib/markets/hyperliquid-market-registry";
import {
  getIndexTriggerMarkets,
  isIndexTriggerMarketSymbol,
  normalizePortalMarketSymbol,
} from "@/lib/markets/portal-market-registry";

export const SUPPORTED_HYPERLIQUID_CHART_SYMBOLS = getEnabledHyperliquidUiMarkets().map(
  (market) => market.symbol,
);
export const SUPPORTED_PORTAL_CHART_SYMBOLS = [
  ...SUPPORTED_HYPERLIQUID_CHART_SYMBOLS,
  ...getIndexTriggerMarkets().map((market) => market.symbol),
] as const;

export type SupportedHyperliquidChartSymbol =
  (typeof SUPPORTED_HYPERLIQUID_CHART_SYMBOLS)[number];

export function isSupportedHyperliquidChartSymbol(
  symbol: string,
  markets?: readonly HyperliquidMarketResolution[],
) {
  return (
    isIndexTriggerMarketSymbol(symbol) ||
    isSupportedHyperliquidSymbol(symbol, markets)
  );
}

export function getHyperliquidChartCoin(
  symbol: string,
  markets?: readonly HyperliquidMarketResolution[],
) {
  if (isIndexTriggerMarketSymbol(symbol)) {
    return null;
  }

  return getHyperliquidCoin(symbol, markets);
}

export function formatHyperliquidChartSymbolLabel(symbol: HyperliquidSymbol | string) {
  const normalizedSymbol = normalizePortalMarketSymbol(symbol);

  if (isIndexTriggerMarketSymbol(normalizedSymbol)) {
    return normalizedSymbol;
  }

  const [baseAsset, quoteAsset] = normalizedSymbol.split("-");

  return `${baseAsset} / ${quoteAsset}`;
}
