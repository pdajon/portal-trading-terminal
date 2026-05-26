import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeHyperliquidMarketsWithFallback,
  normalizeHyperliquidUniverseMarkets,
} from "@/lib/markets/hyperliquid-market-registry";
import {
  formatHyperliquidChartSymbolLabel,
  getHyperliquidChartCoin,
  isSupportedHyperliquidChartSymbol,
  SUPPORTED_HYPERLIQUID_CHART_SYMBOLS,
} from "./hyperliquid-chart-symbols";

const discoveredMarkets = mergeHyperliquidMarketsWithFallback(
  normalizeHyperliquidUniverseMarkets([
    { maxLeverage: 40, name: "BTC", szDecimals: 5 },
    { maxLeverage: 3, name: "HYPE", szDecimals: 2 },
  ]),
);

test("uses BTC ETH and SOL as the static fallback chart symbols", () => {
  assert.deepEqual(SUPPORTED_HYPERLIQUID_CHART_SYMBOLS, ["BTC-USD", "ETH-USD", "SOL-USD"]);
  assert.equal(isSupportedHyperliquidChartSymbol("BTC-USD"), true);
  assert.equal(isSupportedHyperliquidChartSymbol("ETH-USD"), true);
  assert.equal(isSupportedHyperliquidChartSymbol("SOL-USD"), true);
  assert.equal(isSupportedHyperliquidChartSymbol("HYPE-USD"), false);
  assert.equal(isSupportedHyperliquidChartSymbol("PEPE-USD"), false);
});

test("supports dynamically discovered chart symbols when metadata is provided", () => {
  assert.equal(isSupportedHyperliquidChartSymbol("HYPE-USD", discoveredMarkets), true);
  assert.equal(isSupportedHyperliquidChartSymbol("PEPE-USD", discoveredMarkets), false);
});

test("maps supported chart symbols to Hyperliquid testnet coins", () => {
  assert.equal(getHyperliquidChartCoin("BTC-USD"), "BTC");
  assert.equal(getHyperliquidChartCoin("ETH-USD"), "ETH");
  assert.equal(getHyperliquidChartCoin("SOL-USD"), "SOL");
  assert.equal(getHyperliquidChartCoin("HYPE-USD"), null);
  assert.equal(getHyperliquidChartCoin("HYPE-USD", discoveredMarkets), "HYPE");
});

test("formats chart symbols for picker and datafeed labels", () => {
  assert.equal(formatHyperliquidChartSymbolLabel("BTC-USD"), "BTC / USD");
  assert.equal(formatHyperliquidChartSymbolLabel("ETH-USD"), "ETH / USD");
  assert.equal(formatHyperliquidChartSymbolLabel("SOL-USD"), "SOL / USD");
});
