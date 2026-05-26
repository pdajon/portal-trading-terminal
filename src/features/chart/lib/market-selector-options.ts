import type { PortalMarketMetadata } from "@/lib/markets/portal-market-registry";
import type { HyperliquidMarketMetadata } from "@/types/market";

type MarketSelectorOption = HyperliquidMarketMetadata | PortalMarketMetadata;

export type MarketSelectorGroup = {
  id: "tradeable" | "index";
  title: "Tradeable Markets" | "Signal Charts";
  markets: PortalMarketMetadata[];
};

export type MarketSelectorTabId = "tradeable" | "index";

export type MarketSelectorTab = {
  id: MarketSelectorTabId;
  markets: PortalMarketMetadata[];
  title: "Perps" | "Signal Charts";
  totalCount: number;
  visibleCount: number;
};

export type MarketSelectorTabModel = {
  activeTab: MarketSelectorTab;
  activeTabId: MarketSelectorTabId;
  hasSearchQuery: boolean;
  selectedTabId: MarketSelectorTabId;
  tabs: MarketSelectorTab[];
  totalVisibleCount: number;
};

export const MARKET_SELECTOR_TABS: readonly {
  id: MarketSelectorTabId;
  title: MarketSelectorTab["title"];
}[] = [
  { id: "index", title: "Signal Charts" },
  { id: "tradeable", title: "Perps" },
];

function normalizeMarketForSelector(
  market: MarketSelectorOption,
): PortalMarketMetadata {
  if ("type" in market) {
    return market;
  }

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

export function getVisibleMarketSelectorOptions(
  markets: readonly MarketSelectorOption[],
  query: string,
  limit?: number,
) {
  const normalizedQuery = query.trim().toUpperCase();
  const enabledMarkets = markets.map(normalizeMarketForSelector).filter((market) => market.enabled);
  const filteredMarkets = normalizedQuery
    ? enabledMarkets.filter((market) =>
        [
          market.baseAsset,
          market.coin,
          market.displayName,
          market.quoteLabel,
          ...market.searchKeywords,
          market.symbol,
          market.ticker,
        ].some((value) => value.toUpperCase().includes(normalizedQuery)),
      )
    : enabledMarkets;

  if (limit === undefined) {
    return filteredMarkets;
  }

  return filteredMarkets.slice(0, Math.max(1, limit));
}

export function getVisibleMarketSelectorGroups(
  markets: readonly MarketSelectorOption[],
  query: string,
): MarketSelectorGroup[] {
  const visibleMarkets = getVisibleMarketSelectorOptions(markets, query);
  const tradeableMarkets = visibleMarkets.filter(
    (market) => market.type === "tradeable",
  );
  const indexMarkets = visibleMarkets.filter((market) => market.type === "index");

  return [
    {
      id: "tradeable",
      markets: tradeableMarkets,
      title: "Tradeable Markets",
    },
    {
      id: "index",
      markets: indexMarkets,
      title: "Signal Charts",
    },
  ];
}

export function getMarketSelectorTabModel(
  markets: readonly MarketSelectorOption[],
  query: string,
  selectedTabId: MarketSelectorTabId,
): MarketSelectorTabModel {
  const hasSearchQuery = query.trim().length > 0;
  const enabledMarkets = getVisibleMarketSelectorOptions(markets, "");
  const filteredMarkets = getVisibleMarketSelectorOptions(markets, query);

  const tabs = MARKET_SELECTOR_TABS.map((tab) => {
    const tabMarkets = filteredMarkets.filter((market) => market.type === tab.id);
    const tabTotalCount = enabledMarkets.filter(
      (market) => market.type === tab.id,
    ).length;

    return {
      id: tab.id,
      markets: tabMarkets,
      title: tab.title,
      totalCount: tabTotalCount,
      visibleCount: tabMarkets.length,
    };
  });
  const fallbackTab = tabs.find((tab) => tab.id === "tradeable") ?? tabs[0];
  const selectedTab =
    tabs.find((tab) => tab.id === selectedTabId) ?? fallbackTab;
  const smartMatchedTab =
    hasSearchQuery && selectedTab?.visibleCount === 0
      ? tabs.find((tab) => tab.visibleCount > 0)
      : null;
  const activeTab = smartMatchedTab ?? selectedTab ?? fallbackTab;

  return {
    activeTab,
    activeTabId: activeTab.id,
    hasSearchQuery,
    selectedTabId: selectedTab?.id ?? fallbackTab.id,
    tabs,
    totalVisibleCount: filteredMarkets.length,
  };
}

export function getMarketSelectorTabIdForSymbol(
  markets: readonly MarketSelectorOption[],
  symbol: string,
  fallbackTabId: MarketSelectorTabId = "tradeable",
): MarketSelectorTabId {
  const market = getVisibleMarketSelectorOptions(markets, "").find(
    (option) => option.symbol === symbol,
  );
  const marketTabId = market?.type;

  if (marketTabId && MARKET_SELECTOR_TABS.some((tab) => tab.id === marketTabId)) {
    return marketTabId;
  }

  if (MARKET_SELECTOR_TABS.some((tab) => tab.id === fallbackTabId)) {
    return fallbackTabId;
  }

  return MARKET_SELECTOR_TABS[0]?.id ?? "tradeable";
}
