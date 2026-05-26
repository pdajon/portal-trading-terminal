export type HyperliquidSymbol = `${string}-USD`;
export type IndexTriggerSymbol =
  | "TOTAL"
  | "TOTAL2"
  | "TOTAL3"
  | "OTHERS"
  | "BTC.D"
  | "ETH.D"
  | "USDT.D";
export type PortalChartSymbol = HyperliquidSymbol | IndexTriggerSymbol;

export type MarketSymbol = {
  symbol: PortalChartSymbol;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  status: "active" | "paused";
};

export type HyperliquidMarketMetadata = {
  assetId: number | null;
  baseAsset: string;
  coin: string;
  enabled: boolean;
  maxLeverage: number | null;
  pricePrecision: number;
  quantityPrecision: number;
  quoteAsset: "USDC";
  sizeDecimals: number | null;
  source: "hyperliquid-testnet-meta" | "portal-static-fallback";
  symbol: HyperliquidSymbol;
  ticker: string;
};

export type HyperliquidMarketStats = {
  coin: string;
  dayChange: number | null;
  dayChangePercent: number | null;
  dayVolumeUsd: number | null;
  fetchedAt: number;
  fundingRate: number | null;
  markPrice: number | null;
  nextFundingTime: number;
  openInterestBase: number | null;
  openInterestUsd: number | null;
  oraclePrice: number | null;
  previousDayPrice: number | null;
  source: "hyperliquid-testnet-meta-and-asset-ctxs";
  symbol: HyperliquidSymbol;
};

export type HyperliquidOrderBookLevel = {
  price: number;
  size: number;
  sizeUsd: number;
  total: number;
  totalUsd: number;
};

export type HyperliquidOrderBook = {
  asks: HyperliquidOrderBookLevel[];
  bids: HyperliquidOrderBookLevel[];
  coin: string;
  fetchedAt: number;
  source: "hyperliquid-testnet-l2-book";
  spread: number | null;
  spreadPercent: number | null;
  symbol: HyperliquidSymbol;
  time: number | null;
};

export type HyperliquidRecentTrade = {
  id: string;
  price: number;
  side: "buy" | "sell";
  size: number;
  sizeUsd: number;
  time: number;
};

export type HyperliquidRecentTrades = {
  coin: string;
  fetchedAt: number;
  source: "hyperliquid-testnet-recent-trades";
  symbol: HyperliquidSymbol;
  trades: HyperliquidRecentTrade[];
};
