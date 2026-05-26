import type {
  HyperliquidMarketMetadata,
  HyperliquidSymbol,
  MarketSymbol,
} from "@/types/market";

export type HyperliquidMarketResolution = Omit<MarketSymbol, "symbol"> & {
  assetId: number | null;
  coin: string;
  enabled: boolean;
  enabledInV1Ui: boolean;
  maxTestnetBaseSize: number;
  maxLeverage: number | null;
  sizeDecimals: number | null;
  source: HyperliquidMarketMetadata["source"];
  symbol: HyperliquidSymbol;
  ticker: string;
};

type HyperliquidUniverseAsset = {
  isDelisted?: unknown;
  maxLeverage?: unknown;
  name?: unknown;
  szDecimals?: unknown;
};

// Portal keeps notional sizing capped separately; these base caps stay high enough
// that BTC/ETH/SOL testnet orders are not unintentionally limited near $500.
const pinnedFallbackMarkets = [
  {
    assetId: null,
    baseAsset: "BTC",
    coin: "BTC",
    enabled: true,
    enabledInV1Ui: true,
    maxTestnetBaseSize: 1,
    maxLeverage: null,
    pricePrecision: 1,
    quantityPrecision: 5,
    quoteAsset: "USD",
    sizeDecimals: 5,
    source: "portal-static-fallback",
    status: "active",
    symbol: "BTC-USD",
    ticker: "BTC-USDC",
  },
  {
    assetId: null,
    baseAsset: "ETH",
    coin: "ETH",
    enabled: true,
    enabledInV1Ui: true,
    maxTestnetBaseSize: 25,
    maxLeverage: null,
    pricePrecision: 2,
    quantityPrecision: 4,
    quoteAsset: "USD",
    sizeDecimals: 4,
    source: "portal-static-fallback",
    status: "active",
    symbol: "ETH-USD",
    ticker: "ETH-USDC",
  },
  {
    assetId: null,
    baseAsset: "SOL",
    coin: "SOL",
    enabled: true,
    enabledInV1Ui: true,
    maxTestnetBaseSize: 500,
    maxLeverage: null,
    pricePrecision: 3,
    quantityPrecision: 2,
    quoteAsset: "USD",
    sizeDecimals: 2,
    source: "portal-static-fallback",
    status: "active",
    symbol: "SOL-USD",
    ticker: "SOL-USDC",
  },
] as const satisfies readonly HyperliquidMarketResolution[];

export const hyperliquidMarketRegistry = pinnedFallbackMarkets;

export type SupportedHyperliquidMarketSymbol =
  (typeof hyperliquidMarketRegistry)[number]["symbol"];

function parsePositiveNumber(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function parseNonNegativeInteger(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function normalizeBaseAsset(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeHyperliquidMarketSymbol(input: string) {
  const normalized = input.trim().toUpperCase().replace("/", "-");

  if (!normalized) {
    return "";
  }

  if (normalized.endsWith("-USDC")) {
    return normalized.replace(/-USDC$/, "-USD");
  }

  if (normalized.includes("-")) {
    return normalized;
  }

  return `${normalized}-USD`;
}

function getFallbackMarket(symbol: string) {
  return pinnedFallbackMarkets.find((market) => market.symbol === symbol);
}

function normalizeHyperliquidMarketFromUniverseAsset(
  asset: HyperliquidUniverseAsset,
  assetId: number,
): HyperliquidMarketResolution | null {
  if (typeof asset.name !== "string") {
    return null;
  }

  const coin = asset.name.trim();
  const baseAsset = normalizeBaseAsset(coin);

  if (!coin || !baseAsset) {
    return null;
  }

  const symbol = `${baseAsset}-USD` as HyperliquidSymbol;
  const fallbackMarket = getFallbackMarket(symbol);
  const sizeDecimals = parseNonNegativeInteger(asset.szDecimals);
  const quantityPrecision =
    fallbackMarket?.quantityPrecision ?? sizeDecimals ?? 4;
  const enabled = asset.isDelisted !== true;

  return {
    assetId,
    baseAsset,
    coin,
    enabled,
    enabledInV1Ui: enabled,
    maxLeverage: parsePositiveNumber(asset.maxLeverage),
    maxTestnetBaseSize: fallbackMarket?.maxTestnetBaseSize ?? 1,
    pricePrecision: fallbackMarket?.pricePrecision ?? 4,
    quantityPrecision,
    quoteAsset: "USD",
    sizeDecimals,
    source: "hyperliquid-testnet-meta",
    status: enabled ? "active" : "paused",
    symbol,
    ticker: `${baseAsset}-USDC`,
  };
}

export function normalizeHyperliquidUniverseMarkets(
  universe: unknown,
): HyperliquidMarketResolution[] {
  if (!Array.isArray(universe)) {
    return [];
  }

  return universe
    .map((asset, index) =>
      normalizeHyperliquidMarketFromUniverseAsset(
        asset as HyperliquidUniverseAsset,
        index,
      ),
    )
    .filter((market): market is HyperliquidMarketResolution => market !== null);
}

export function mergeHyperliquidMarketsWithFallback(
  discoveredMarkets: readonly HyperliquidMarketResolution[],
) {
  const discoveredBySymbol = new Map(
    discoveredMarkets.map((market) => [market.symbol, market]),
  );
  const mergedMarkets: HyperliquidMarketResolution[] = [
    ...pinnedFallbackMarkets.map((fallbackMarket) => {
      const discoveredMarket = discoveredBySymbol.get(fallbackMarket.symbol);

      if (!discoveredMarket) {
        return fallbackMarket;
      }

      discoveredBySymbol.delete(fallbackMarket.symbol);

      return {
        ...fallbackMarket,
        ...discoveredMarket,
        enabledInV1Ui: discoveredMarket.enabled,
        maxTestnetBaseSize: fallbackMarket.maxTestnetBaseSize,
        pricePrecision: fallbackMarket.pricePrecision,
        quantityPrecision:
          discoveredMarket.sizeDecimals ?? fallbackMarket.quantityPrecision,
      };
    }),
    ...Array.from(discoveredBySymbol.values()).sort((left, right) =>
      left.baseAsset.localeCompare(right.baseAsset),
    ),
  ];

  return mergedMarkets;
}

export function getFallbackHyperliquidMarkets() {
  return [...pinnedFallbackMarkets];
}

export function getEnabledHyperliquidUiMarkets(
  markets: readonly HyperliquidMarketResolution[] = hyperliquidMarketRegistry,
) {
  return markets.filter((market) => market.enabledInV1Ui && market.enabled);
}

export function toHyperliquidMarketMetadata(
  market: HyperliquidMarketResolution,
): HyperliquidMarketMetadata {
  return {
    assetId: market.assetId,
    baseAsset: market.baseAsset,
    coin: market.coin,
    enabled: market.enabled,
    maxLeverage: market.maxLeverage,
    pricePrecision: market.pricePrecision,
    quantityPrecision: market.quantityPrecision,
    quoteAsset: "USDC",
    sizeDecimals: market.sizeDecimals,
    source: market.source,
    symbol: market.symbol,
    ticker: market.ticker,
  };
}

export function resolveHyperliquidMarket(
  symbol: string | null | undefined,
  markets: readonly HyperliquidMarketResolution[] = hyperliquidMarketRegistry,
) {
  if (!symbol) {
    return null;
  }

  const normalizedSymbol = normalizeHyperliquidMarketSymbol(symbol);

  return (
    markets.find(
      (market) => market.enabled && market.symbol === normalizedSymbol,
    ) ?? null
  );
}

export function resolveHyperliquidMarketOrThrow(
  symbol: string,
  markets?: readonly HyperliquidMarketResolution[],
) {
  const market = resolveHyperliquidMarket(symbol, markets);

  if (!market) {
    throw new Error(`Unsupported Hyperliquid market: ${symbol}`);
  }

  return market;
}

export function isSupportedHyperliquidSymbol(
  symbol: string,
  markets?: readonly HyperliquidMarketResolution[],
): symbol is HyperliquidSymbol {
  return resolveHyperliquidMarket(symbol, markets) !== null;
}

export function getHyperliquidCoin(
  symbol: string,
  markets?: readonly HyperliquidMarketResolution[],
) {
  return resolveHyperliquidMarket(symbol, markets)?.coin ?? null;
}
