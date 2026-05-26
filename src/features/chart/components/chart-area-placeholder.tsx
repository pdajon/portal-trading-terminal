"use client";

import { AssetIconMark } from "@/components/market/asset-icon-mark";
import {
  ChartSoulIntervention,
  type ChartSoulInterventionRecommendation,
} from "@/features/ai/components/chart-soul-intervention";
import { LivePositionRail } from "@/features/chart/components/live-position-rail";
import { MinimalPriceChart } from "@/features/chart/components/minimal-price-chart";
import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";
import { getHyperliquidChartCoin } from "@/features/chart/lib/hyperliquid-chart-symbols";
import { deriveLivePositionDisplayPrice } from "@/features/chart/lib/live-position-display";
import { shouldDismissMarketSelector } from "@/features/chart/lib/market-selector-dismissal";
import { hyperliquidSymbols } from "@/lib/markets/hyperliquid-symbols";
import {
  getPortalMarketMetadata,
  isChartOnlyMarketSymbol,
  type PortalMarketMetadata,
} from "@/lib/markets/portal-market-registry";
import {
  getMarketSelectorTabIdForSymbol,
  getMarketSelectorTabModel,
  getVisibleMarketSelectorOptions,
  type MarketSelectorTabId,
} from "@/features/chart/lib/market-selector-options";
import type { SessionLogEntry } from "@/features/session-log/lib/session-log";
import type {
  ChartLevel,
  ChartLineTriggerCondition,
  ChartLineTrigger,
  ChartSelection,
  ChartTrendLine,
  ChartTrendLineUpdate,
  ChartZone,
} from "@/features/chart/types";
import type {
  ActivePosition,
  ChartTradePlan,
  DraftChartTradePlan,
  JournalChartSnapshot,
  JournalChartSnapshotCaptureOptions,
  LiveExchangePosition,
  PendingLimitOrder,
} from "@/types/trade";
import type {
  HyperliquidMarketStats,
  HyperliquidSymbol,
  MarketSymbol,
  PortalChartSymbol,
} from "@/types/market";
import type { MagicTradeChartOverlay } from "@/features/tag-along/lib/magic-trade-chart-overlays";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type SystemRiskState = "safe" | "guarded" | "locked";
type SystemAiState = "watching" | "warning" | "active";
type SystemSessionState = "active" | "idle";

type ChartAreaPlaceholderProps = {
  activeTimeframe: ChartTimeframe;
  activeSymbol: MarketSymbol["symbol"];
  activePosition: ActivePosition | null;
  accountValue: number | null;
  aiState: SystemAiState;
  exchangePositions: LiveExchangePosition[];
  chartLevels: ChartLevel[];
  chartTrendLines: ChartTrendLine[];
  currentPrice: number | null;
  dailyPnl: number;
  draftTradePlan: DraftChartTradePlan | null;
  activeTradePlan: ChartTradePlan | null;
  lineTriggers: ChartLineTrigger[];
  pendingLimitOrders: PendingLimitOrder[];
  sessionLogEntries?: SessionLogEntry[];
  showExecutionFillChips?: boolean;
  onShowExecutionFillChipsChange?: (show: boolean) => void;
  chartZones: ChartZone[];
  chartInstructionToastMessage?: string | null;
  compactLivePositionRail?: boolean;
  orderFlowToastSlot?: ReactNode;
  limitPlacementActive: boolean;
  marketMetadata: PortalMarketMetadata | null;
  markets: PortalMarketMetadata[];
  focusedMagicTradeRule?: { ruleId: string; requestId: number } | null;
  magicTradeOverlays: MagicTradeChartOverlay[];
  magicTradeLevelPickActive?: boolean;
  soulInterventionRecommendation?: ChartSoulInterventionRecommendation | null;
  onClearSelection: () => void;
  onCurrentPriceChange: (price: number) => void;
  onCandleClose: (
    closePrice: number,
    candleTime: number,
    timeframe: ChartTimeframe,
  ) => void;
  onLevelChange: (levelId: string, nextPrice: number) => void;
  onDisarmLineTrigger: (
    targetType: "horizontal-level",
    targetId: string,
  ) => void;
  onCancelPendingOrder: (pendingOrder: PendingLimitOrder) => void;
  onPendingOrderCommit: (
    pendingOrder: PendingLimitOrder,
    nextPrice: number,
  ) => Promise<boolean> | boolean;
  onDraftTradePlanChange: (tradePlan: DraftChartTradePlan | null) => void;
  onMidZoneLimitOrderCreate: (
    zoneId: string,
    direction: "long" | "short",
  ) => unknown | Promise<unknown>;
  onOrderZoneCreate: (
    zoneId: string,
    direction: "long" | "short",
    count: number,
    distribution: "even" | "top-heavy" | "bottom-heavy",
  ) => unknown | Promise<unknown>;
  onZoneDerivedOrderConfigure: (
    zoneId: string,
    type: "mid-zone" | "order-zone",
    direction: "long" | "short",
    count: number,
    distribution: "even" | "top-heavy" | "bottom-heavy",
  ) => unknown | Promise<unknown>;
  onPriceSelect: (price: number) => void;
  onMagicTradeLevelPick?: (price: number) => void;
  onMagicTradeLevelPickCancel?: () => void;
  onSoulInterventionIgnore?: (recommendationId: string) => void;
  onSoulInterventionReviewRule?: (recommendationId: string) => void;
  onSoulInterventionShowLess?: (recommendationId: string) => void;
  onSoulInterventionSnooze?: (recommendationId: string) => void;
  onArmLineTrigger: (
    targetType: "horizontal-level",
    targetId: string,
    direction: "long" | "short",
    condition: ChartLineTriggerCondition,
  ) => void;
  onSelectObject: (selection: ChartSelection) => void;
  onSymbolChange: (symbol: PortalChartSymbol) => void;
  onClosePosition: (symbol: HyperliquidSymbol) => void;
  onLimitCloseAtCurrentPrice: (
    symbol: HyperliquidSymbol,
    percent: number,
  ) => void;
  onLimitCloseAtPrice: (
    symbol: HyperliquidSymbol,
    percent: number,
    price: number,
  ) => void;
  onLimitCloseSelectPrice: (symbol: HyperliquidSymbol, percent: number) => void;
  onReversePosition: (symbol: HyperliquidSymbol) => void;
  onReducePosition: (symbol: HyperliquidSymbol, percent: number) => void;
  onBreakEven: (symbol: HyperliquidSymbol) => void;
  positionActionInFlightSymbol: HyperliquidSymbol | null;
  riskState: SystemRiskState;
  onTradePlanChange: (tradePlan: ChartTradePlan) => void;
  onChartSnapshotCaptureReady?: (
    capture:
      | ((
          options?: JournalChartSnapshotCaptureOptions,
        ) => Promise<JournalChartSnapshot | null>)
      | null,
  ) => void;
  onTimeframeChange?: (timeframe: ChartTimeframe) => void;
  onTradePlanCommit: (
    tradePlan: ChartTradePlan,
    previousTradePlan: ChartTradePlan | null,
  ) => void | Promise<void>;
  onTradePlanCreate: (tradePlan: ChartTradePlan) => void;
  onZoneChange: (
    zoneId: string,
    nextZone: Pick<ChartZone, "topPrice" | "bottomPrice">,
  ) => void;
  onZoneEditCommit: (
    zoneId: string,
    previousZone: Pick<ChartZone, "topPrice" | "bottomPrice">,
    nextZone: Pick<ChartZone, "topPrice" | "bottomPrice">,
  ) => void | Promise<void>;
  onZoneEditStart: (zoneId: string) => void;
  onZoneNoTradeToggle: (zoneId: string) => void;
  onZoneCreate: (
    zone: Pick<ChartZone, "topPrice" | "bottomPrice" | "source">,
  ) => void;
  onTrendLineChange: (lineId: string, nextLine: ChartTrendLineUpdate) => void;
  onTrendLineCreate: (
    line: Pick<
      ChartTrendLine,
      "endPrice" | "endTime" | "source" | "startPrice" | "startTime"
    >,
  ) => void;
  onTrendLineDelete: (lineId: string) => void;
  onTrendLineEditCommit: (
    lineId: string,
    previousLine: Pick<
      ChartTrendLine,
      "endPrice" | "endTime" | "startPrice" | "startTime"
    >,
    nextLine: Pick<
      ChartTrendLine,
      "endPrice" | "endTime" | "startPrice" | "startTime"
    >,
  ) => void;
  onTrendLineEditingChange: (lineId: string, isEditing: boolean) => void;
  selectedObject: ChartSelection | null;
  sessionState: SystemSessionState;
};

export function ChartAreaPlaceholder({
  activeSymbol,
  activePosition,
  accountValue,
  aiState,
  exchangePositions,
  chartLevels,
  chartTrendLines,
  currentPrice,
  dailyPnl,
  draftTradePlan,
  activeTradePlan,
  lineTriggers,
  pendingLimitOrders,
  sessionLogEntries = [],
  showExecutionFillChips = true,
  onShowExecutionFillChipsChange,
  chartZones,
  chartInstructionToastMessage = null,
  compactLivePositionRail = false,
  orderFlowToastSlot = null,
  limitPlacementActive,
  marketMetadata,
  markets,
  focusedMagicTradeRule = null,
  magicTradeOverlays,
  magicTradeLevelPickActive = false,
  soulInterventionRecommendation = null,
  onClearSelection,
  onCurrentPriceChange,
  onCandleClose,
  onLevelChange,
  onDisarmLineTrigger,
  onCancelPendingOrder,
  onPendingOrderCommit,
  onDraftTradePlanChange,
  onMidZoneLimitOrderCreate,
  onOrderZoneCreate,
  onZoneDerivedOrderConfigure,
  onPriceSelect,
  onMagicTradeLevelPick,
  onMagicTradeLevelPickCancel,
  onSoulInterventionIgnore,
  onSoulInterventionReviewRule,
  onSoulInterventionShowLess,
  onSoulInterventionSnooze,
  onArmLineTrigger,
  onSelectObject,
  onSymbolChange,
  onClosePosition,
  onLimitCloseAtCurrentPrice,
  onLimitCloseAtPrice,
  onLimitCloseSelectPrice,
  onReversePosition,
  onReducePosition,
  onBreakEven,
  positionActionInFlightSymbol,
  riskState,
  onTradePlanChange,
  onChartSnapshotCaptureReady,
  onTimeframeChange,
  onTradePlanCommit,
  onTradePlanCreate,
  onZoneChange,
  onZoneEditCommit,
  onZoneEditStart,
  onZoneNoTradeToggle,
  onZoneCreate,
  onTrendLineChange,
  onTrendLineCreate,
  onTrendLineDelete,
  onTrendLineEditCommit,
  onTrendLineEditingChange,
  selectedObject,
  sessionState,
  activeTimeframe,
}: ChartAreaPlaceholderProps) {
  const marketSelectorRef = useRef<HTMLDivElement | null>(null);
  const [marketMenuOpen, setMarketMenuOpen] = useState(false);
  const [marketSearchQuery, setMarketSearchQuery] = useState("");
  const [marketSelectorTabId, setMarketSelectorTabId] =
    useState<MarketSelectorTabId>("tradeable");
  const [marketStatsMode, setMarketStatsMode] = useState<"ticker" | "static">(
    "ticker",
  );
  const [marketStats, setMarketStats] = useState<HyperliquidMarketStats | null>(
    null,
  );
  const [marketStatsNow, setMarketStatsNow] = useState(() => Date.now());
  const visibleExchangePositions = useMemo(
    () =>
      exchangePositions
        .filter((position) => position.symbol === activeSymbol)
        .map((position) =>
          deriveLivePositionDisplayPrice(position, currentPrice),
        ),
    [activeSymbol, currentPrice, exchangePositions],
  );
  const railActive = visibleExchangePositions.length > 0;
  const fallbackMarkets = useMemo(
    () => getPortalMarketMetadata(hyperliquidSymbols),
    [],
  );
  const selectableMarkets = markets.length > 0 ? markets : fallbackMarkets;
  const activeMarket = selectableMarkets.find(
    (market) => market.symbol === activeSymbol,
  );
  const activeBaseAsset =
    activeMarket?.baseAsset ?? activeSymbol.replace("-USD", "");
  const activeMarketIsChartOnly =
    activeMarket?.executionEnabled === false ||
    isChartOnlyMarketSymbol(activeSymbol);
  const activeSymbolMarketSelectorTabId = getMarketSelectorTabIdForSymbol(
    selectableMarkets,
    activeSymbol,
  );
  const displayTicker = activeMarketIsChartOnly
    ? (activeMarket?.symbol ?? activeSymbol)
    : (marketMetadata?.ticker ??
      activeMarket?.ticker ??
      `${activeBaseAsset}-USDC`);
  const maxLeverageLabel = activeMarketIsChartOnly
    ? (activeMarket?.badgeLabel ?? "CHART ONLY")
    : marketMetadata?.maxLeverage
    ? `${marketMetadata.maxLeverage}x`
    : "--x";
  const chartCoin = activeMarketIsChartOnly
    ? null
    : (marketMetadata?.coin ??
      activeMarket?.coin ??
      getHyperliquidChartCoin(activeSymbol));
  const marketSelectorTabModel = getMarketSelectorTabModel(
    selectableMarkets,
    marketSearchQuery,
    marketSelectorTabId,
  );
  const visibleMarketOptions = getVisibleMarketSelectorOptions(
    selectableMarkets,
    marketSearchQuery,
  );
  const activeMarketSelectorTab = marketSelectorTabModel.activeTab;
  const marketSearchSmartSwitched =
    marketSelectorTabModel.hasSearchQuery &&
    marketSelectorTabModel.activeTabId !== marketSelectorTabModel.selectedTabId;
  const tradeableMarketTab = marketSelectorTabModel.tabs.find(
    (tab) => tab.id === "tradeable",
  );
  const indexMarketTab = marketSelectorTabModel.tabs.find(
    (tab) => tab.id === "index",
  );
  const formattedAccountValue = formatTopBarUsd(accountValue);
  const formattedDailyPnl = formatTopBarSignedUsd(dailyPnl);
  const dailyPnlTone =
    dailyPnl > 0
      ? "text-[#22C55E]"
      : dailyPnl < 0
        ? "text-[#EF4444]"
        : "text-white/88";
  const marketStatsItems = getMarketStatsItems(marketStats, marketStatsNow);
  const marketStatsChangeTone =
    marketStats?.dayChange === null || marketStats?.dayChange === undefined
      ? "text-white/82"
      : marketStats.dayChange > 0
        ? "text-[#22C55E]"
        : marketStats.dayChange < 0
          ? "text-[#FF6B8A]"
          : "text-white/82";
  const tickerMarketStatsItems = marketStatsItems;

  useEffect(() => {
    const abortController = new AbortController();

    async function refreshMarketStats() {
      if (activeMarketIsChartOnly) {
        setMarketStats(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/market-stats?symbol=${encodeURIComponent(activeSymbol)}`,
          {
            cache: "no-store",
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as HyperliquidMarketStats;

        if (!abortController.signal.aborted) {
          setMarketStats(payload);
        }
      } catch {
        // The chart owns visual continuity; stale stats are better than a noisy bar.
      }
    }

    void refreshMarketStats();
    const intervalId = window.setInterval(refreshMarketStats, 5_000);

    return () => {
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, [activeMarketIsChartOnly, activeSymbol]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMarketStatsNow(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (magicTradeLevelPickActive) {
      setMarketMenuOpen(false);
      setMarketSearchQuery("");
    }
  }, [magicTradeLevelPickActive]);

  useEffect(() => {
    if (marketMenuOpen) {
      setMarketSelectorTabId(activeSymbolMarketSelectorTabId);
    }
  }, [activeSymbolMarketSelectorTabId, marketMenuOpen]);

  useEffect(() => {
    if (!marketMenuOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (
        shouldDismissMarketSelector(
          marketSelectorRef.current,
          event.target as Node | null,
        )
      ) {
        setMarketMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [marketMenuOpen]);

  const toggleMarketSelector = () => {
    if (!marketMenuOpen) {
      setMarketSelectorTabId(activeSymbolMarketSelectorTabId);
    }

    setMarketMenuOpen((open) => !open);
  };

  return (
    <section className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#050914_0%,#030711_48%,#02040a_100%)]">
      <div className="sticky top-0 z-20 shrink-0 px-3 pt-2">
        <div className="portal-cockpit-module portal-cockpit-module-horizontal flex min-h-[58px] items-center gap-4 rounded-portal-panel px-4 py-2">
          <div
            ref={marketSelectorRef}
            className={`relative ml-2 flex flex-col ${magicTradeLevelPickActive ? "min-w-[190px]" : "min-w-[260px]"}`}
          >
            <button
              type="button"
              className={`flex min-w-0 items-center gap-3 text-left transition ${
                magicTradeLevelPickActive
                  ? "cursor-default opacity-95"
                  : "hover:opacity-95"
              }`}
              disabled={magicTradeLevelPickActive}
              title={
                magicTradeLevelPickActive
                  ? "Market is locked while selecting a Magic Trade level."
                  : undefined
              }
              onClick={(event) => {
                if (!magicTradeLevelPickActive) {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleMarketSelector();
                }
              }}
              onKeyDown={(event) => {
                if (
                  !magicTradeLevelPickActive &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  toggleMarketSelector();
                }
              }}
            >
              <AssetIconMark asset={activeBaseAsset} />
              <span className="min-w-0 truncate font-sans text-[20px] font-semibold leading-none tracking-[0.01em] text-white/92">
                {displayTicker}
              </span>
              {!magicTradeLevelPickActive ? (
                <span
                  className="inline-flex h-[21px] w-[14px] items-center justify-center self-center"
                  aria-hidden="true"
                >
                  <span className="h-[8px] w-[8px] translate-y-[-1px] rotate-45 border-b-2 border-r-2 border-cyan-100/70" />
                </span>
              ) : null}
              {!magicTradeLevelPickActive ? (
                <span
                  className={`portal-value-number ml-2 rounded-portal-control border px-2.5 py-1.5 text-[14px] font-medium leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
                    activeMarketIsChartOnly
                      ? "border-violet-200/[0.18] bg-[linear-gradient(180deg,rgba(139,92,246,0.10),rgba(51,245,255,0.045))] text-violet-50/86"
                      : "border-cyan-200/[0.12] bg-cyan-300/[0.07] text-cyan-100/88"
                  }`}
                >
                  {maxLeverageLabel}
                </span>
              ) : null}
              <span className="sr-only">Select market</span>
            </button>
            {marketMenuOpen ? (
              <div className="absolute left-0 top-[calc(100%+14px)] z-50 w-[min(620px,calc(100vw-32px))] overflow-hidden rounded-portal-panel border border-white/[0.07] bg-[linear-gradient(180deg,rgba(13,19,30,0.96),rgba(5,8,14,0.93))] p-2.5 shadow-[0_24px_68px_rgba(0,0,0,0.42),0_0_34px_rgba(51,245,255,0.045),inset_0_1px_0_rgba(255,255,255,0.065)] backdrop-blur-[22px] portal-clip-panel">
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/[0.22] to-transparent" />
                <input
                  className="relative h-10 w-full rounded-portal-control border border-cyan-100/[0.08] bg-black/[0.24] px-3.5 font-mono text-[12px] uppercase text-white/86 outline-none placeholder:text-white/28 focus:border-cyan-200/[0.24] focus:bg-cyan-300/[0.045]"
                  placeholder="Search markets"
                  value={marketSearchQuery}
                  onChange={(event) => setMarketSearchQuery(event.target.value)}
                  autoFocus
                />
                <div
                  className="mt-2 flex min-w-0 flex-nowrap items-center gap-3 border-b border-white/[0.055] px-1 pr-2 text-[12px]"
                  role="tablist"
                  aria-label="Market selector categories"
                >
                  {marketSelectorTabModel.tabs.map((tab) => {
                    const active = tab.id === marketSelectorTabModel.activeTabId;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`relative rounded-portal-control px-3 py-2 text-left text-[12px] font-semibold transition ${
                          active
                            ? "text-cyan-100"
                            : "text-white/42 hover:text-white/74"
                        }`}
                        onClick={() => setMarketSelectorTabId(tab.id)}
                      >
                        <span className="whitespace-nowrap">
                          {tab.title}
                          <span
                            className={`ml-1 font-mono text-[11px] ${
                              active ? "text-cyan-100/64" : "text-white/30"
                            }`}
                          >
                            ({tab.visibleCount})
                          </span>
                        </span>
                        {active ? (
                          <span className="absolute inset-x-2 bottom-0 h-px bg-cyan-300/80" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {marketSearchSmartSwitched ? (
                  <div className="px-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-violet-50/44">
                    Search matched {activeMarketSelectorTab.title}
                  </div>
                ) : null}
                <div
                  className="mt-2 max-h-[336px] overflow-y-auto pr-0.5"
                  role="tabpanel"
                  aria-label={activeMarketSelectorTab.title}
                >
                  {activeMarketSelectorTab.markets.length > 0 ? (
                    <div className="grid gap-1">
                      {activeMarketSelectorTab.markets.map((market) => (
                        <button
                          key={market.symbol}
                          type="button"
                          className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-portal-control px-3 py-2.5 text-left transition ${
                            market.symbol === activeSymbol
                              ? "bg-cyan-200/[0.065] shadow-[inset_2px_0_0_rgba(103,232,249,0.58)]"
                              : "hover:bg-white/[0.045]"
                          }`}
                          onClick={() => {
                            onSymbolChange(market.symbol);
                            setMarketSearchQuery("");
                            setMarketMenuOpen(false);
                          }}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <AssetIconMark
                              asset={market.baseAsset}
                              className="h-6 w-6"
                              imageClassName="h-full w-full"
                            />
                            <span className="grid min-w-0 gap-1">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-[13px] font-semibold text-white/84">
                                  {market.baseAsset}
                                </span>
                                {market.symbol === activeSymbol ? (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.65)]" />
                                ) : null}
                              </span>
                              <span className="truncate font-mono text-[10px] uppercase tracking-[0.10em] text-cyan-100/34">
                                {market.type === "index"
                                  ? market.displayName
                                  : market.ticker}
                              </span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {market.type === "index" ? (
                              <span className="rounded-portal-control border border-violet-200/[0.16] bg-[linear-gradient(180deg,rgba(139,92,246,0.10),rgba(51,245,255,0.045))] px-2 py-1 font-mono text-[10px] text-violet-50/72">
                                {market.badgeLabel}
                              </span>
                            ) : market.maxLeverage ? (
                              <span className="rounded-portal-control border border-cyan-200/[0.10] bg-cyan-300/[0.055] px-2 py-1 font-mono text-[10px] text-cyan-100/70">
                                {market.maxLeverage}x
                              </span>
                            ) : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-5 text-center text-[12px] font-medium text-white/42">
                      {marketSelectorTabModel.totalVisibleCount > 0
                        ? `No matching ${activeMarketSelectorTab.id === "tradeable" ? "perps" : "signal charts"}.`
                        : "No matching Portal markets."}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.055] px-2 pt-2 text-[10px] uppercase tracking-[0.14em] text-cyan-100/36">
                  <span>{visibleMarketOptions.length} shown</span>
                  <span>
                    {tradeableMarketTab?.totalCount ?? 0} perps /{" "}
                    {indexMarketTab?.totalCount ?? 0} signal charts
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {!magicTradeLevelPickActive ? (
            <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 xl:flex">
              {marketStatsMode === "ticker" ? (
                <div className="portal-stat-ticker-window mx-auto h-9 w-full max-w-[740px]">
                  <div className="portal-stat-ticker-track h-full">
                    {tickerMarketStatsItems.map((item) => (
                      <div
                        key={`ticker-primary-${item.label}`}
                        className="flex min-w-[210px] items-baseline gap-2 border-l border-cyan-100/[0.055] px-5 first:border-l-0"
                      >
                        <div className="shrink-0 text-[11px] font-semibold uppercase leading-none tracking-[0.13em] text-cyan-100/[0.38]">
                          {item.label === "Funding / Countdown"
                            ? "Funding"
                            : item.label}
                        </div>
                        {item.kind === "funding" ? (
                          <div className="portal-value-number flex min-w-max items-baseline gap-1.5 text-[12px] font-medium leading-none">
                            <span className={`${item.fundingTone} opacity-78`}>
                              {item.fundingValue}
                            </span>
                            <span className="text-white/54">
                              {item.countdownValue}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`portal-value-number min-w-max text-[12px] font-medium leading-none ${
                              item.tone === "change"
                                ? marketStatsChangeTone
                                : item.tone
                            } opacity-78`}
                          >
                            {item.value}
                          </div>
                        )}
                      </div>
                    ))}
                    {tickerMarketStatsItems.map((item) => (
                      <div
                        key={`ticker-loop-${item.label}`}
                        className="flex min-w-[210px] items-baseline gap-2 border-l border-cyan-100/[0.055] px-5"
                        aria-hidden="true"
                      >
                        <div className="shrink-0 text-[11px] font-semibold uppercase leading-none tracking-[0.13em] text-cyan-100/[0.38]">
                          {item.label === "Funding / Countdown"
                            ? "Funding"
                            : item.label}
                        </div>
                        {item.kind === "funding" ? (
                          <div className="portal-value-number flex min-w-max items-baseline gap-1.5 text-[12px] font-medium leading-none">
                            <span className={`${item.fundingTone} opacity-78`}>
                              {item.fundingValue}
                            </span>
                            <span className="text-white/54">
                              {item.countdownValue}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`portal-value-number min-w-max text-[12px] font-medium leading-none ${
                              item.tone === "change"
                                ? marketStatsChangeTone
                                : item.tone
                            } opacity-78`}
                          >
                            {item.value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-[1040px] min-w-0 items-center justify-center gap-4 overflow-visible px-2">
                  {tickerMarketStatsItems.map((item) => (
                    <div
                      key={`static-${item.label}`}
                      className="flex min-w-0 items-baseline gap-1.5 border-l border-cyan-100/[0.055] pl-3 first:border-l-0 first:pl-0"
                    >
                      <div className="shrink-0 text-[10px] font-semibold uppercase leading-none tracking-[0.13em] text-cyan-100/[0.32]">
                        {item.label === "Funding / Countdown"
                          ? "Funding"
                          : item.label}
                      </div>
                      {item.kind === "funding" ? (
                        <div className="portal-value-number flex min-w-max items-baseline gap-1.5 text-[11px] font-medium leading-none">
                          <span className={`${item.fundingTone} opacity-78`}>
                            {item.fundingValue}
                          </span>
                          <span className="text-white/54">
                            {item.countdownValue}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`portal-value-number min-w-max text-[11px] font-medium leading-none ${
                            item.tone === "change"
                              ? marketStatsChangeTone
                              : item.tone
                          } opacity-78`}
                        >
                          {item.value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                aria-label={
                  marketStatsMode === "ticker"
                    ? "Show market stats as static row"
                    : "Show market stats as ticker"
                }
                aria-pressed={marketStatsMode === "static"}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-portal-control border border-white/[0.055] bg-white/[0.026] text-cyan-100/46 transition hover:border-cyan-200/22 hover:bg-cyan-300/[0.055] hover:text-cyan-50"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMarketStatsMode((current) =>
                    current === "ticker" ? "static" : "ticker",
                  );
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setMarketStatsMode((current) =>
                      current === "ticker" ? "static" : "ticker",
                    );
                  }
                }}
              >
                {marketStatsMode === "ticker" ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M4 7h16"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M4 12h16"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M4 17h16"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M4 8h10"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M4 16h10"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="m16 6 3 3-3 3"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="m16 12 3 3-3 3"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <div className="hidden flex-1 lg:block" />
          )}

          {!magicTradeLevelPickActive ? (
            <div className="hidden min-w-[188px] items-center justify-end gap-4 text-right xl:flex">
              <div>
                <div className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.22em] text-cyan-100/40">
                  Equity
                </div>
                <div className="portal-value-number mt-1.5 text-[15px] font-semibold leading-none text-white/84">
                  {formattedAccountValue}
                </div>
              </div>
              <div className="h-7 w-px bg-gradient-to-b from-transparent via-cyan-100/[0.12] to-transparent" />
              <div>
                <div className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.22em] text-cyan-100/40">
                  Daily
                </div>
                <div
                  className={`portal-value-number mt-1.5 text-[15px] font-semibold leading-none ${dailyPnlTone}`}
                >
                  {formattedDailyPnl}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 gap-2 px-2 pb-2 pt-2">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-portal-panel border border-cyan-100/[0.095] bg-[linear-gradient(180deg,rgba(7,15,27,0.98),rgba(4,10,19,0.99))] shadow-[0_16px_44px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.050)] portal-clip-panel">
          <div className="pointer-events-none absolute inset-x-4 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,rgba(165,243,252,0.18),transparent)]" />
          <MinimalPriceChart
            activePosition={activePosition}
            activeTradePlan={activeTradePlan}
            draftTradePlan={draftTradePlan}
            levels={chartLevels}
            lineTriggers={lineTriggers}
            trendLines={chartTrendLines}
            focusedMagicTradeRule={focusedMagicTradeRule}
            magicTradeOverlays={magicTradeOverlays}
            magicTradeLevelPickActive={magicTradeLevelPickActive}
            limitPlacementInstructionLabel={chartInstructionToastMessage}
            limitPlacementActive={limitPlacementActive}
            livePosition={visibleExchangePositions[0] ?? null}
            onArmLineTrigger={onArmLineTrigger}
            onCancelPendingOrder={onCancelPendingOrder}
            onClearSelection={onClearSelection}
            onCandleClose={onCandleClose}
            onCurrentPriceChange={onCurrentPriceChange}
            onLevelChange={onLevelChange}
            onDisarmLineTrigger={onDisarmLineTrigger}
            onPendingOrderCommit={onPendingOrderCommit}
            onDraftTradePlanChange={onDraftTradePlanChange}
            onMidZoneLimitOrderCreate={onMidZoneLimitOrderCreate}
            onOrderZoneCreate={onOrderZoneCreate}
            onZoneDerivedOrderConfigure={onZoneDerivedOrderConfigure}
            onPriceSelect={onPriceSelect}
            onMagicTradeLevelPick={onMagicTradeLevelPick}
            onMagicTradeLevelPickCancel={onMagicTradeLevelPickCancel}
            onTimeframeChange={onTimeframeChange}
            onSnapshotCaptureReady={onChartSnapshotCaptureReady}
            onSelectObject={onSelectObject}
            onShowExecutionFillChipsChange={onShowExecutionFillChipsChange}
            onTradePlanChange={onTradePlanChange}
            onTradePlanCommit={onTradePlanCommit}
            onTradePlanCreate={onTradePlanCreate}
            onZoneChange={onZoneChange}
            onZoneEditCommit={onZoneEditCommit}
            onZoneEditStart={onZoneEditStart}
            onZoneNoTradeToggle={onZoneNoTradeToggle}
            onZoneCreate={onZoneCreate}
            onTrendLineChange={onTrendLineChange}
            onTrendLineCreate={onTrendLineCreate}
            onTrendLineDelete={onTrendLineDelete}
            onTrendLineEditCommit={onTrendLineEditCommit}
            onTrendLineEditingChange={onTrendLineEditingChange}
            pendingLimitOrders={pendingLimitOrders}
            selectedObject={selectedObject}
            sessionLogEntries={sessionLogEntries}
            showExecutionFillChips={showExecutionFillChips}
            coin={chartCoin}
            symbol={activeSymbol}
            timeframe={activeTimeframe}
            zones={chartZones}
          />
          {orderFlowToastSlot ? (
            <div className="pointer-events-none absolute right-[5.5rem] top-4 z-40 flex w-[min(360px,calc(100%-7rem))] flex-col items-end gap-2">
              {orderFlowToastSlot}
            </div>
          ) : null}
        </div>
        <ChartSoulIntervention
          onIgnore={(recommendationId) =>
            onSoulInterventionIgnore?.(recommendationId)
          }
          onReviewRule={(recommendationId) =>
            onSoulInterventionReviewRule?.(recommendationId)
          }
          onShowLess={(recommendationId) =>
            onSoulInterventionShowLess?.(recommendationId)
          }
          onSnooze={(recommendationId) =>
            onSoulInterventionSnooze?.(recommendationId)
          }
          recommendation={soulInterventionRecommendation}
          soulAssetSrc="/portal/avatar/portal-soul.svg?v=orb-companion-v12"
        />
        {railActive ? (
          <div className="relative z-[15] flex min-h-0 w-[292px] shrink-0 self-stretch">
            <LivePositionRail
              activeTradePlan={activeTradePlan}
              onBreakEven={onBreakEven}
              onClosePosition={onClosePosition}
              onLimitCloseAtCurrentPrice={onLimitCloseAtCurrentPrice}
              onLimitCloseAtPrice={onLimitCloseAtPrice}
              onLimitCloseSelectPrice={onLimitCloseSelectPrice}
              onReversePosition={onReversePosition}
              onReducePosition={onReducePosition}
              positionActionInFlightSymbol={positionActionInFlightSymbol}
              positions={visibleExchangePositions}
              compact={compactLivePositionRail}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatTopBarUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatTopBarSignedUsd(value: number) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const formattedValue = new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: "always",
    style: "currency",
  }).format(value);

  return formattedValue.replace("+-$", "-$");
}

function formatTopBarPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const maximumFractionDigits = value >= 1_000 ? 1 : value >= 1 ? 3 : 6;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function formatTopBarSignedPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const maximumFractionDigits =
    Math.abs(value) >= 1_000 ? 1 : Math.abs(value) >= 1 ? 3 : 6;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    signDisplay: "always",
  }).format(value);
}

function formatTopBarPercent(
  value: number | null,
  options?: { signed?: boolean },
) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
    signDisplay: options?.signed ? "always" : "auto",
  }).format(value);
}

function formatFundingCountdown(nextFundingTime: number | null, now: number) {
  if (nextFundingTime === null || !Number.isFinite(nextFundingTime)) {
    return "--:--:--";
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((nextFundingTime - now) / 1000),
  );
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function getMarketStatsItems(
  stats: HyperliquidMarketStats | null,
  now: number,
) {
  const changeValue =
    stats?.dayChange !== null && stats?.dayChange !== undefined
      ? `${formatTopBarSignedPrice(stats.dayChange)} / ${formatTopBarPercent(
          stats.dayChangePercent,
          { signed: true },
        )}%`
      : "--";
  const fundingValue =
    stats?.fundingRate !== null && stats?.fundingRate !== undefined
      ? `${formatTopBarPercent(stats.fundingRate * 100)}%`
      : "--";
  const fundingTone =
    stats?.fundingRate !== null && stats?.fundingRate !== undefined
      ? stats.fundingRate >= 0
        ? "text-emerald-300"
        : "text-rose-300"
      : "text-white/70";
  const countdownValue = formatFundingCountdown(
    stats?.nextFundingTime ?? null,
    now,
  );

  return [
    {
      label: "Mark",
      hasReferenceUnderline: true,
      kind: "value",
      tone: "text-white/82",
      value: formatTopBarPrice(stats?.markPrice ?? null),
    },
    {
      label: "Oracle",
      hasReferenceUnderline: true,
      kind: "value",
      tone: "text-white/82",
      value: formatTopBarPrice(stats?.oraclePrice ?? null),
    },
    {
      label: "24h Change",
      hasReferenceUnderline: true,
      kind: "value",
      tone: "change",
      value: changeValue,
    },
    {
      label: "24h Volume",
      hasReferenceUnderline: true,
      kind: "value",
      tone: "text-white/82",
      value: formatTopBarUsd(stats?.dayVolumeUsd ?? null),
    },
    {
      label: "Open Interest",
      hasReferenceUnderline: true,
      kind: "value",
      tone: "text-white/82",
      value: formatTopBarUsd(stats?.openInterestUsd ?? null),
    },
    {
      label: "Funding / Countdown",
      hasReferenceUnderline: true,
      kind: "funding",
      fundingTone,
      fundingValue,
      countdownValue,
    },
  ];
}
