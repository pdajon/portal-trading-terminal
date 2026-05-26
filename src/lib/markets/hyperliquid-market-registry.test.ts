import assert from "node:assert/strict";
import test from "node:test";

import {
  getEnabledHyperliquidUiMarkets,
  getFallbackHyperliquidMarkets,
  isSupportedHyperliquidSymbol,
  mergeHyperliquidMarketsWithFallback,
  normalizeHyperliquidUniverseMarkets,
  resolveHyperliquidMarket,
  resolveHyperliquidMarketOrThrow,
} from "./hyperliquid-market-registry";

const discoveredMarkets = mergeHyperliquidMarketsWithFallback(
  normalizeHyperliquidUniverseMarkets([
    { maxLeverage: 10, name: "SOL", szDecimals: 2 },
    { maxLeverage: 40, name: "BTC", szDecimals: 5 },
    { maxLeverage: 25, name: "ETH", szDecimals: 4 },
    { maxLeverage: 3, name: "HYPE", szDecimals: 2 },
    { isDelisted: true, maxLeverage: 50, name: "MATIC", szDecimals: 1 },
  ]),
);

test("resolves enabled BTC ETH and SOL markets through one registry", () => {
  assert.deepEqual(
    getEnabledHyperliquidUiMarkets(getFallbackHyperliquidMarkets()).map((market) => ({
      coin: market.coin,
      maxTestnetBaseSize: market.maxTestnetBaseSize,
      pricePrecision: market.pricePrecision,
      quantityPrecision: market.quantityPrecision,
      symbol: market.symbol,
    })),
    [
      {
        coin: "BTC",
        maxTestnetBaseSize: 1,
        pricePrecision: 1,
        quantityPrecision: 5,
        symbol: "BTC-USD",
      },
      {
        coin: "ETH",
        maxTestnetBaseSize: 25,
        pricePrecision: 2,
        quantityPrecision: 4,
        symbol: "ETH-USD",
      },
      {
        coin: "SOL",
        maxTestnetBaseSize: 500,
        pricePrecision: 3,
        quantityPrecision: 2,
        symbol: "SOL-USD",
      },
    ],
  );
});

test("normalizes dynamic Hyperliquid universe markets into Portal registry records", () => {
  assert.equal(discoveredMarkets.length, 5);
  assert.deepEqual(resolveHyperliquidMarket("hype", discoveredMarkets), {
    assetId: 3,
    baseAsset: "HYPE",
    coin: "HYPE",
    enabled: true,
    enabledInV1Ui: true,
    maxLeverage: 3,
    maxTestnetBaseSize: 1,
    pricePrecision: 4,
    quantityPrecision: 2,
    quoteAsset: "USD",
    sizeDecimals: 2,
    source: "hyperliquid-testnet-meta",
    status: "active",
    symbol: "HYPE-USD",
    ticker: "HYPE-USDC",
  });
});

test("preserves BTC ETH and SOL safety metadata when live metadata is merged", () => {
  assert.equal(resolveHyperliquidMarket("BTC-USD", discoveredMarkets)?.maxTestnetBaseSize, 1);
  assert.equal(resolveHyperliquidMarket("ETH-USD", discoveredMarkets)?.quantityPrecision, 4);
  assert.equal(resolveHyperliquidMarket("SOL-USD", discoveredMarkets)?.pricePrecision, 3);
});

test("normalizes common market inputs before resolving", () => {
  assert.equal(resolveHyperliquidMarket("btc")?.symbol, "BTC-USD");
  assert.equal(resolveHyperliquidMarket("eth/usdc")?.symbol, "ETH-USD");
  assert.equal(resolveHyperliquidMarket("sol-usd")?.coin, "SOL");
  assert.equal(resolveHyperliquidMarket("hype/usdc", discoveredMarkets)?.coin, "HYPE");
});

test("rejects invalid or disabled markets cleanly", () => {
  assert.equal(resolveHyperliquidMarket("HYPE-USD"), null);
  assert.equal(resolveHyperliquidMarket("MATIC-USD", discoveredMarkets), null);
  assert.equal(isSupportedHyperliquidSymbol("DOGE-USD"), false);
  assert.throws(
    () => resolveHyperliquidMarketOrThrow("PEPE"),
    /Unsupported Hyperliquid market: PEPE/,
  );
});
