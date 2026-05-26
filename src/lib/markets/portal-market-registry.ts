import {
  normalizeHyperliquidMarketSymbol,
  type HyperliquidMarketResolution,
} from "@/lib/markets/hyperliquid-market-registry";
import type {
  HyperliquidMarketMetadata,
  PortalChartSymbol,
} from "@/types/market";

export const CHART_ONLY_INDEX_MESSAGE =
  "Chart-only index. Use this as a Magic Trade trigger source.";

export const INDEX_TRIGGER_MARKET_SYMBOLS = [
  "TOTAL",
  "TOTAL2",
  "TOTAL3",
  "OTHERS",
  "BTC.D",
  "ETH.D",
  "USDT.D",
] as const;

export type IndexTriggerMarketSymbol =
  (typeof INDEX_TRIGGER_MARKET_SYMBOLS)[number];

export type PortalMarketType = "tradeable" | "index";
export type PortalChartProvider = "hyperliquid" | "tradingview-compatible-index";

export type PortalMarketMetadata = {
  assetId: number | null;
  badgeLabel: "PERP" | "CHART ONLY";
  baseAsset: string;
  chartProvider: PortalChartProvider;
  chartable: boolean;
  coin: string;
  displayName: string;
  enabled: boolean;
  executionEnabled: boolean;
  maxLeverage: number | null;
  pricePrecision: number;
  quantityPrecision: number;
  quoteAsset: string;
  quoteLabel: string;
  searchKeywords: string[];
  sizeDecimals: number | null;
  source:
    | HyperliquidMarketMetadata["source"]
    | "tradingview-compatible-index";
  symbol: PortalChartSymbol;
  ticker: string;
  tradeable: boolean;
  tradingViewSymbol?: string;
  triggerable: boolean;
  type: PortalMarketType;
};

const indexTriggerMarkets = [
  {
    baseAsset: "TOTAL",
    displayName: "Total Crypto Market Cap",
    pricePrecision: 0,
    searchKeywords: ["total", "crypto total"],
    symbol: "TOTAL",
    tradingViewSymbol: "CRYPTOCAP:TOTAL",
  },
  {
    baseAsset: "TOTAL2",
    displayName: "Crypto Market Cap Excluding BTC",
    pricePrecision: 0,
    searchKeywords: ["total2", "total ex btc", "crypto total 2"],
    symbol: "TOTAL2",
    tradingViewSymbol: "CRYPTOCAP:TOTAL2",
  },
  {
    baseAsset: "TOTAL3",
    displayName: "Crypto Market Cap Excluding BTC and ETH",
    pricePrecision: 0,
    searchKeywords: ["total3", "total ex btc eth", "crypto total 3"],
    symbol: "TOTAL3",
    tradingViewSymbol: "CRYPTOCAP:TOTAL3",
  },
  {
    baseAsset: "OTHERS",
    displayName: "Altcoin Market Cap Excluding Top Assets",
    pricePrecision: 0,
    searchKeywords: ["others", "altcoin market cap"],
    symbol: "OTHERS",
    tradingViewSymbol: "CRYPTOCAP:OTHERS",
  },
  {
    baseAsset: "BTC.D",
    displayName: "Bitcoin Dominance",
    pricePrecision: 2,
    searchKeywords: ["btc.d", "btc dominance", "bitcoin dominance"],
    symbol: "BTC.D",
    tradingViewSymbol: "CRYPTOCAP:BTC.D",
  },
  {
    baseAsset: "ETH.D",
    displayName: "Ethereum Dominance",
    pricePrecision: 2,
    searchKeywords: ["eth.d", "eth dominance", "ethereum dominance"],
    symbol: "ETH.D",
    tradingViewSymbol: "CRYPTOCAP:ETH.D",
  },
  {
    baseAsset: "USDT.D",
    displayName: "Tether Dominance",
    pricePrecision: 2,
    searchKeywords: ["usdt.d", "usdt dominance", "tether dominance"],
    symbol: "USDT.D",
    tradingViewSymbol: "CRYPTOCAP:USDT.D",
  },
] as const satisfies ReadonlyArray<{
  baseAsset: IndexTriggerMarketSymbol;
  displayName: string;
  pricePrecision: number;
  searchKeywords: readonly string[];
  symbol: IndexTriggerMarketSymbol;
  tradingViewSymbol: `CRYPTOCAP:${string}`;
}>;

const indexSymbolSet = new Set<string>(INDEX_TRIGGER_MARKET_SYMBOLS);

export function normalizePortalMarketSymbol(input: string | null | undefined) {
  if (!input) {
    return "";
  }

  const normalized = input.trim().toUpperCase().replace("/", "-");

  if (indexSymbolSet.has(normalized)) {
    return normalized;
  }

  return normalizeHyperliquidMarketSymbol(normalized);
}

export function isIndexTriggerMarketSymbol(
  symbol: string | null | undefined,
): symbol is IndexTriggerMarketSymbol {
  return indexSymbolSet.has(normalizePortalMarketSymbol(symbol));
}

export function isChartOnlyMarketSymbol(symbol: string | null | undefined) {
  return isIndexTriggerMarketSymbol(symbol);
}

export function isExecutionEnabledMarketSymbol(symbol: string | null | undefined) {
  const normalizedSymbol = normalizePortalMarketSymbol(symbol);

  return Boolean(normalizedSymbol) && !isIndexTriggerMarketSymbol(normalizedSymbol);
}

export function getIndexTriggerMarkets(): PortalMarketMetadata[] {
  return indexTriggerMarkets.map((market) => ({
    assetId: null,
    badgeLabel: "CHART ONLY",
    baseAsset: market.baseAsset,
    chartProvider: "tradingview-compatible-index",
    chartable: true,
    coin: market.symbol,
    displayName: market.displayName,
    enabled: true,
    executionEnabled: false,
    maxLeverage: null,
    pricePrecision: market.pricePrecision,
    quantityPrecision: 2,
    quoteAsset: "INDEX",
    quoteLabel: market.symbol.endsWith(".D") ? "Dominance" : "Market Cap",
    searchKeywords: [...market.searchKeywords],
    sizeDecimals: null,
    source: "tradingview-compatible-index",
    symbol: market.symbol,
    ticker: market.tradingViewSymbol,
    tradeable: false,
    tradingViewSymbol: market.tradingViewSymbol,
    triggerable: true,
    type: "index",
  }));
}

export function toPortalTradeableMarket(
  market: HyperliquidMarketMetadata | HyperliquidMarketResolution,
): PortalMarketMetadata {
  return {
    assetId: market.assetId,
    badgeLabel: "PERP",
    baseAsset: market.baseAsset,
    chartProvider: "hyperliquid",
    chartable: true,
    coin: market.coin,
    displayName: `${market.baseAsset} Perpetual`,
    enabled: market.enabled,
    executionEnabled: market.enabled,
    maxLeverage: market.maxLeverage,
    pricePrecision: market.pricePrecision,
    quantityPrecision: market.quantityPrecision,
    quoteAsset: "USDC",
    quoteLabel: "USDC Perp",
    searchKeywords: [
      market.baseAsset,
      market.coin,
      market.symbol,
      market.ticker,
      `${market.baseAsset} perp`,
    ],
    sizeDecimals: market.sizeDecimals,
    source: market.source,
    symbol: market.symbol,
    ticker: market.ticker,
    tradeable: true,
    triggerable: true,
    type: "tradeable",
  };
}

export function getPortalMarketMetadata(
  tradeableMarkets: readonly (HyperliquidMarketMetadata | HyperliquidMarketResolution)[],
) {
  return [
    ...tradeableMarkets.map(toPortalTradeableMarket),
    ...getIndexTriggerMarkets(),
  ];
}

export function resolvePortalMarket(
  symbol: string | null | undefined,
  markets: readonly PortalMarketMetadata[] = getIndexTriggerMarkets(),
) {
  const normalizedSymbol = normalizePortalMarketSymbol(symbol);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    markets.find(
      (market) =>
        market.enabled &&
        normalizePortalMarketSymbol(market.symbol) === normalizedSymbol,
    ) ?? null
  );
}

export function getTradingViewSymbolForPortalMarket(
  symbol: string | null | undefined,
) {
  return resolvePortalMarket(symbol, getIndexTriggerMarkets())?.tradingViewSymbol ?? null;
}

export function getExecutionGuardError(symbol: string | null | undefined) {
  return isChartOnlyMarketSymbol(symbol) ? CHART_ONLY_INDEX_MESSAGE : null;
}
