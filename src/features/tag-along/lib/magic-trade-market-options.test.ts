import assert from "node:assert/strict";
import test from "node:test";

import type { HyperliquidMarketMetadata } from "@/types/market";
import { getPortalMarketMetadata } from "@/lib/markets/portal-market-registry";
import {
  getMagicTradeAnchorMarketOptions,
  getMagicTradeFullSourceMarketOptions,
  getMagicTradeFullMarketOptions,
  getMagicTradeMaxMarginInputValue,
  getMagicTradeTargetQuickMarketOptions,
  isMagicTradeMarginInputValid,
  recordMagicTradeMarketUse,
  type MagicTradeMarketUse,
} from "./magic-trade-market-options";

function market(baseAsset: string, index: number): HyperliquidMarketMetadata {
  return {
    assetId: index,
    baseAsset,
    coin: baseAsset,
    enabled: true,
    maxLeverage: 10,
    pricePrecision: 2,
    quantityPrecision: 2,
    quoteAsset: "USDC",
    sizeDecimals: 2,
    source: "hyperliquid-testnet-meta",
    symbol: `${baseAsset}-USD`,
    ticker: `${baseAsset}-USDC`,
  };
}

const markets = [
  market("BTC", 0),
  market("ETH", 1),
  market("SOL", 2),
  market("HYPE", 3),
  market("DOGE", 4),
  market("0G", 5),
  market("FARTCOIN", 6),
  market("PURR", 7),
  { ...market("DISABLED", 8), enabled: false },
];
const portalMarkets = getPortalMarketMetadata(markets);

test("getMagicTradeAnchorMarketOptions returns only the default signal anchors", () => {
  assert.deepEqual(
    getMagicTradeAnchorMarketOptions(markets).map((option) => option.label),
    ["BTC", "ETH", "SOL", "HYPE", "DOGE", "TOTAL", "BTC.D"],
  );
});

test("getMagicTradeFullMarketOptions searches the full enabled market list", () => {
  assert.deepEqual(
    getMagicTradeFullMarketOptions(markets, "0g").map((option) => option.value),
    ["0G-USD"],
  );
  assert.equal(
    getMagicTradeFullMarketOptions(markets, "disabled").length,
    0,
  );
});

test("Magic Trade source markets include chart-only index trigger charts", () => {
  assert.deepEqual(
    getMagicTradeFullSourceMarketOptions(portalMarkets, "dominance").map(
      (option) => option.value,
    ),
    ["BTC.D", "ETH.D", "USDT.D"],
  );
  assert.deepEqual(
    getMagicTradeFullSourceMarketOptions(portalMarkets, "total").map(
      (option) => option.value,
    ),
    ["TOTAL", "TOTAL2", "TOTAL3"],
  );
});

test("Magic Trade target markets never include chart-only index trigger charts", () => {
  assert.equal(
    getMagicTradeTargetQuickMarketOptions(portalMarkets).some(
      (option) => option.value === "TOTAL",
    ),
    false,
  );
  assert.deepEqual(
    getMagicTradeFullMarketOptions(portalMarkets, "total").map(
      (option) => option.value,
    ),
    [],
  );
});

test("getMagicTradeTargetQuickMarketOptions adds recent/frequent assets after anchors up to six", () => {
  const recent = [
    { lastUsedAt: 20, symbol: "FARTCOIN-USD", useCount: 1 },
    { lastUsedAt: 10, symbol: "0G-USD", useCount: 3 },
    { lastUsedAt: 30, symbol: "PURR-USD", useCount: 3 },
  ] satisfies readonly MagicTradeMarketUse[];

  assert.deepEqual(
    getMagicTradeTargetQuickMarketOptions(markets, recent).map(
      (option) => option.value,
    ),
    [
      "BTC-USD",
      "ETH-USD",
      "SOL-USD",
      "HYPE-USD",
      "DOGE-USD",
      "PURR-USD",
    ],
  );
});

test("recordMagicTradeMarketUse increments use count and keeps most recent first", () => {
  assert.deepEqual(
    recordMagicTradeMarketUse(
      [{ lastUsedAt: 10, symbol: "SOL-USD", useCount: 1 }],
      "SOL-USD",
      25,
    ),
    [{ lastUsedAt: 25, symbol: "SOL-USD", useCount: 2 }],
  );
});

test("max margin input displays the usable funds buffer without rounding above balance", () => {
  const maxInputValue = getMagicTradeMaxMarginInputValue(912.3456);

  assert.equal(maxInputValue, "912.33");
  assert.equal(isMagicTradeMarginInputValid(maxInputValue, 912.3456), true);
  assert.equal(isMagicTradeMarginInputValid("912.34", 912.3456), false);
  assert.equal(getMagicTradeMaxMarginInputValue(911.52), "911.51");
  assert.equal(isMagicTradeMarginInputValid("911.51", 911.52), true);
  assert.equal(isMagicTradeMarginInputValid("911.52", 911.52), false);
});
