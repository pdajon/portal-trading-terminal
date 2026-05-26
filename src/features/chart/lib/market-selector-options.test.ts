import assert from "node:assert/strict";
import test from "node:test";

import type { HyperliquidMarketMetadata } from "@/types/market";
import { resolveAssetIcon } from "@/lib/markets/asset-icon-resolver";
import { getPortalMarketMetadata } from "@/lib/markets/portal-market-registry";
import {
  getMarketSelectorTabIdForSymbol,
  getMarketSelectorTabModel,
  getVisibleMarketSelectorGroups,
  getVisibleMarketSelectorOptions,
} from "./market-selector-options";

const markets: HyperliquidMarketMetadata[] = [
  {
    assetId: 0,
    baseAsset: "BTC",
    coin: "BTC",
    enabled: true,
    maxLeverage: 40,
    pricePrecision: 1,
    quantityPrecision: 5,
    quoteAsset: "USDC",
    sizeDecimals: 5,
    source: "hyperliquid-testnet-meta",
    symbol: "BTC-USD",
    ticker: "BTC-USDC",
  },
  {
    assetId: 1,
    baseAsset: "HYPE",
    coin: "HYPE",
    enabled: true,
    maxLeverage: 3,
    pricePrecision: 4,
    quantityPrecision: 2,
    quoteAsset: "USDC",
    sizeDecimals: 2,
    source: "hyperliquid-testnet-meta",
    symbol: "HYPE-USD",
    ticker: "HYPE-USDC",
  },
  {
    assetId: 2,
    baseAsset: "MATIC",
    coin: "MATIC",
    enabled: false,
    maxLeverage: 50,
    pricePrecision: 4,
    quantityPrecision: 1,
    quoteAsset: "USDC",
    sizeDecimals: 1,
    source: "hyperliquid-testnet-meta",
    symbol: "MATIC-USD",
    ticker: "MATIC-USDC",
  },
];

function buildMarket(index: number): HyperliquidMarketMetadata {
  const baseAsset = `MKT${String(index).padStart(3, "0")}`;

  return {
    assetId: index,
    baseAsset,
    coin: baseAsset,
    enabled: true,
    maxLeverage: 3,
    pricePrecision: 4,
    quantityPrecision: 2,
    quoteAsset: "USDC",
    sizeDecimals: 2,
    source: "hyperliquid-testnet-meta",
    symbol: `${baseAsset}-USD`,
    ticker: `${baseAsset}-USDC`,
  };
}

test("getVisibleMarketSelectorOptions filters enabled markets by ticker and symbol", () => {
  assert.deepEqual(
    getVisibleMarketSelectorOptions(markets, "hype").map((market) => market.symbol),
    ["HYPE-USD"],
  );
  assert.deepEqual(
    getVisibleMarketSelectorOptions(markets, "USDC").map((market) => market.symbol),
    ["BTC-USD", "HYPE-USD"],
  );
});

test("getVisibleMarketSelectorOptions omits disabled markets and honors the visible limit", () => {
  assert.deepEqual(
    getVisibleMarketSelectorOptions(markets, "", 1).map((market) => market.symbol),
    ["BTC-USD"],
  );
  assert.equal(getVisibleMarketSelectorOptions(markets, "MATIC").length, 0);
});

test("getVisibleMarketSelectorOptions returns every enabled market by default", () => {
  const fullMarketList = Array.from({ length: 72 }, (_, index) =>
    buildMarket(index),
  );

  assert.equal(getVisibleMarketSelectorOptions(fullMarketList, "").length, 72);
});

test("getVisibleMarketSelectorOptions does not hide markets that use fallback icons", () => {
  assert.equal(resolveAssetIcon("HYPE-USD").kind, "fallback");
  assert.deepEqual(
    getVisibleMarketSelectorOptions(markets, "hype").map(
      (market) => market.symbol,
    ),
    ["HYPE-USD"],
  );
});

test("getVisibleMarketSelectorGroups separates tradeable markets from index trigger charts", () => {
  const groups = getVisibleMarketSelectorGroups(
    getPortalMarketMetadata(markets),
    "",
  );

  assert.deepEqual(
    groups.map((group) => group.title),
    ["Tradeable Markets", "Signal Charts"],
  );
  assert.deepEqual(
    groups[0]?.markets.map((market) => market.symbol),
    ["BTC-USD", "HYPE-USD"],
  );
  assert.deepEqual(
    groups[1]?.markets.map((market) => market.symbol),
    ["TOTAL", "TOTAL2", "TOTAL3", "OTHERS", "BTC.D", "ETH.D", "USDT.D"],
  );
});

test("getVisibleMarketSelectorGroups searches index trigger chart labels", () => {
  const groups = getVisibleMarketSelectorGroups(
    getPortalMarketMetadata(markets),
    "btc.d",
  );
  const indexGroup = groups.find((group) => group.id === "index");

  assert.deepEqual(
    groups.map((group) => group.title),
    ["Tradeable Markets", "Signal Charts"],
  );
  assert.deepEqual(
    indexGroup?.markets.map((market) => [
      market.symbol,
      market.badgeLabel,
      market.maxLeverage,
    ]),
    [["BTC.D", "CHART ONLY", null]],
  );
});

test("getVisibleMarketSelectorGroups preserves sections while searching", () => {
  const groups = getVisibleMarketSelectorGroups(
    getPortalMarketMetadata(markets),
    "total",
  );

  assert.deepEqual(
    groups.map((group) => [group.id, group.markets.length]),
    [
      ["tradeable", 0],
      ["index", 3],
    ],
  );
});

test("getVisibleMarketSelectorGroups searches index trigger chart aliases", () => {
  const portalMarkets = getPortalMarketMetadata(markets);

  assert.deepEqual(
    getVisibleMarketSelectorGroups(portalMarkets, "total").flatMap((group) =>
      group.markets.map((market) => market.symbol),
    ),
    ["TOTAL", "TOTAL2", "TOTAL3"],
  );
  assert.deepEqual(
    getVisibleMarketSelectorGroups(portalMarkets, "btc dominance").flatMap(
      (group) => group.markets.map((market) => market.symbol),
    ),
    ["BTC.D"],
  );
  assert.deepEqual(
    getVisibleMarketSelectorGroups(portalMarkets, "eth dominance").flatMap(
      (group) => group.markets.map((market) => market.symbol),
    ),
    ["ETH.D"],
  );
  assert.deepEqual(
    getVisibleMarketSelectorGroups(portalMarkets, "tether dominance").flatMap(
      (group) => group.markets.map((market) => market.symbol),
    ),
    ["USDT.D"],
  );
});

test("getMarketSelectorTabModel separates tradeable and index tabs", () => {
  const tabModel = getMarketSelectorTabModel(
    getPortalMarketMetadata(markets),
    "",
    "tradeable",
  );

  assert.equal(tabModel.activeTabId, "tradeable");
  assert.deepEqual(
    tabModel.tabs.map((tab) => [tab.id, tab.title, tab.totalCount]),
    [
      ["index", "Signal Charts", 7],
      ["tradeable", "Perps", 2],
    ],
  );
  assert.deepEqual(
    tabModel.tabs
      .find((tab) => tab.id === "tradeable")
      ?.markets.map((market) => market.symbol),
    ["BTC-USD", "HYPE-USD"],
  );
  assert.deepEqual(
    tabModel.tabs
      .find((tab) => tab.id === "index")
      ?.markets.map((market) => market.symbol),
    ["TOTAL", "TOTAL2", "TOTAL3", "OTHERS", "BTC.D", "ETH.D", "USDT.D"],
  );
});

test("getMarketSelectorTabModel smart-switches to index matches", () => {
  const tabModel = getMarketSelectorTabModel(
    getPortalMarketMetadata(markets),
    "total",
    "tradeable",
  );

  assert.equal(tabModel.activeTabId, "index");
  assert.equal(tabModel.selectedTabId, "tradeable");
  assert.deepEqual(
    tabModel.activeTab.markets.map((market) => market.symbol),
    ["TOTAL", "TOTAL2", "TOTAL3"],
  );
  assert.deepEqual(
    tabModel.tabs.map((tab) => [tab.id, tab.visibleCount]),
    [
      ["index", 3],
      ["tradeable", 0],
    ],
  );
});

test("getMarketSelectorTabIdForSymbol resolves the open tab from the active chart symbol", () => {
  const portalMarkets = getPortalMarketMetadata(markets);

  assert.equal(getMarketSelectorTabIdForSymbol(portalMarkets, "TOTAL"), "index");
  assert.equal(getMarketSelectorTabIdForSymbol(portalMarkets, "BTC-USD"), "tradeable");
  assert.equal(
    getMarketSelectorTabIdForSymbol(portalMarkets, "UNKNOWN"),
    "tradeable",
  );
});

test("getMarketSelectorTabModel searches dominance aliases in the index tab", () => {
  const portalMarkets = getPortalMarketMetadata(markets);

  assert.deepEqual(
    getMarketSelectorTabModel(portalMarkets, "btc.d", "tradeable").activeTab.markets.map(
      (market) => [market.symbol, market.badgeLabel, market.maxLeverage],
    ),
    [["BTC.D", "CHART ONLY", null]],
  );
  assert.deepEqual(
    getMarketSelectorTabModel(
      portalMarkets,
      "btc dominance",
      "tradeable",
    ).activeTab.markets.map((market) => market.symbol),
    ["BTC.D"],
  );
  assert.deepEqual(
    getMarketSelectorTabModel(
      portalMarkets,
      "eth dominance",
      "tradeable",
    ).activeTab.markets.map((market) => market.symbol),
    ["ETH.D"],
  );
  assert.deepEqual(
    getMarketSelectorTabModel(
      portalMarkets,
      "tether dominance",
      "tradeable",
    ).activeTab.markets.map((market) => market.symbol),
    ["USDT.D"],
  );
});

test("getMarketSelectorTabModel keeps the selected tab when it has matches", () => {
  const tabModel = getMarketSelectorTabModel(
    getPortalMarketMetadata(markets),
    "btc",
    "tradeable",
  );

  assert.equal(tabModel.activeTabId, "tradeable");
  assert.deepEqual(
    tabModel.activeTab.markets.map((market) => market.symbol),
    ["BTC-USD"],
  );
});
