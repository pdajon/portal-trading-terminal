import assert from "node:assert/strict";
import test from "node:test";

import type { HyperliquidMarketMetadata } from "@/types/market";
import {
  getIndexTriggerMarkets,
  getPortalMarketMetadata,
  isChartOnlyMarketSymbol,
  isExecutionEnabledMarketSymbol,
  resolvePortalMarket,
} from "./portal-market-registry";

function tradeableMarket(baseAsset: string, index: number): HyperliquidMarketMetadata {
  return {
    assetId: index,
    baseAsset,
    coin: baseAsset,
    enabled: true,
    maxLeverage: 20,
    pricePrecision: 2,
    quantityPrecision: 4,
    quoteAsset: "USDC",
    sizeDecimals: 4,
    source: "hyperliquid-testnet-meta",
    symbol: `${baseAsset}-USD`,
    ticker: `${baseAsset}-USDC`,
  };
}

test("Portal market metadata keeps tradeable markets separate from index trigger charts", () => {
  const markets = getPortalMarketMetadata([
    tradeableMarket("BTC", 0),
    tradeableMarket("SOL", 1),
  ]);

  assert.deepEqual(
    markets.filter((market) => market.type === "tradeable").map((market) => market.symbol),
    ["BTC-USD", "SOL-USD"],
  );
  assert.deepEqual(
    markets.filter((market) => market.type === "index").map((market) => market.symbol),
    ["TOTAL", "TOTAL2", "TOTAL3", "OTHERS", "BTC.D", "ETH.D", "USDT.D"],
  );
});

test("index trigger markets are chartable and triggerable but never executable", () => {
  const [total] = getIndexTriggerMarkets();

  assert.equal(total?.symbol, "TOTAL");
  assert.equal(total?.chartable, true);
  assert.equal(total?.triggerable, true);
  assert.equal(total?.tradeable, false);
  assert.equal(total?.executionEnabled, false);
  assert.equal(total?.maxLeverage, null);
  assert.equal(total?.badgeLabel, "CHART ONLY");
  assert.deepEqual(total?.searchKeywords, ["total", "crypto total"]);
  assert.equal(total?.tradingViewSymbol, "CRYPTOCAP:TOTAL");
  assert.equal(isChartOnlyMarketSymbol("TOTAL"), true);
  assert.equal(isExecutionEnabledMarketSymbol("TOTAL"), false);
  assert.equal(isExecutionEnabledMarketSymbol("BTC-USD"), true);
});

test("Portal market resolution does not normalize index charts into Hyperliquid perps", () => {
  const markets = getPortalMarketMetadata([tradeableMarket("BTC", 0)]);

  assert.equal(resolvePortalMarket("TOTAL", markets)?.type, "index");
  assert.equal(resolvePortalMarket("btc.d", markets)?.symbol, "BTC.D");
  assert.equal(resolvePortalMarket("BTC-USDC", markets)?.symbol, "BTC-USD");
  assert.equal(resolvePortalMarket("TOTAL-USD", markets), null);
});
