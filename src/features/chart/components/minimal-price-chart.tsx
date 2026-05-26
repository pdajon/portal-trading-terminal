"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  type CandlestickData,
  HistogramSeries,
  type HistogramData,
  type IPaneApi,
  type IPriceLine,
  type ISeriesApi,
  LineStyle,
  type Logical,
  LineSeries,
  type LineData,
  type LineSeriesPartialOptions,
  type MouseEventParams,
  PriceScaleMode,
  type Time,
  type WhitespaceData,
} from "lightweight-charts";
import {
  ChartExecutionLineMarkerPrimitive,
  type ChartExecutionLineMarker,
} from "@/features/chart/lib/execution-line-marker-primitive";
import {
  ChartPendingOrderChipPrimitive,
  type PendingOrderChipHit,
  type PendingOrderChipModel,
} from "@/features/chart/lib/pending-order-chip-primitive";
import {
  buildChartFutureWhitespaceTimes,
  getDefaultChartRightOffsetBars,
  getDefaultChartVisibleLogicalRange,
} from "@/features/chart/lib/chart-viewport";
import { ChartMagicTradeOverlayPrimitive } from "@/features/chart/lib/magic-trade-overlay-primitive";
import {
  calculateAtr,
  calculateEma,
  calculateMacd,
  calculateRsi,
  calculateVwap,
} from "@/features/chart/lib/chart-indicators";
import type { ChartIndicatorPoint } from "@/features/chart/lib/chart-indicators";
import {
  buildMarketContextReadouts,
  fetchChartMarketContext,
  normalizeOpenInterestSnapshot,
  upsertOpenInterestPoint,
  type ChartMarketContext,
  type ChartMarketContextReadout,
  type ChartMarketContextStatus,
  type ChartOpenInterestPoint,
} from "@/features/chart/lib/chart-market-context";
import {
  CHART_INDICATOR_OPTIONS,
  CHART_RANGE_CALENDAR_OPTIONS,
  CHART_RANGE_PRIMARY_OPTIONS,
  CHART_SETTINGS_OPTIONS,
  CHART_PRICE_SCALE_UTILITY_OPTIONS,
  CHART_SERIES_STYLE_OPTIONS,
  DEFAULT_CHART_SETTINGS,
  formatChartUtilityClock,
  formatChartActiveCountLabel,
  formatChartChromeTitle,
  formatChartCandleCountdown,
  getChartRangeStart,
  getChartIndicatorActiveCount,
  getChartScaleUtilityStatus,
  getChartSettingsActiveCount,
  getChartChromePrimaryIntervals,
  type ChartPriceScaleModeKey,
  type ChartRangePreset,
  type ChartIndicatorLayerKey,
  type ChartSettingKey,
  type ChartSettingsPreferences,
  type ChartSeriesStyleKey,
  type ChartPriceScaleUtilityKey,
} from "@/features/chart/lib/chart-chrome";
import { isChartRightPriceAxisPoint } from "@/features/chart/lib/chart-interactions";
import {
  buildChartLayerStackGroups,
  buildChartLayerStackSummary,
  CHART_LAYER_DEFINITIONS,
  CHART_LAYER_PRESETS,
  DEFAULT_CHART_LAYER_VISIBILITY,
  getChartLayerPresetVisibility,
  readChartLayerVisibility,
  resolveChartLayerPresetKey,
  writeChartLayerVisibility,
  type ChartLayerKey,
  type ChartLayerPresetKey,
  type ChartLayerVisibility,
} from "@/features/chart/lib/chart-layer-visibility";
import {
  buildChartDrawingObjectRows,
  buildChartDrawingRailItems,
  getChartDrawingCreateSource,
  resolveChartLogicalIndexForTime,
  resolveChartTimeForLogicalIndex,
} from "@/features/chart/lib/chart-drawing-tools";
import {
  buildChartDrawingRenderItems,
  ChartDrawingPrimitive,
  findChartDrawingHit,
  resolveChartDrawingXCoordinate,
  type ChartDrawingPrimitiveDraftLine,
  type ChartDrawingRenderItem,
} from "@/features/chart/lib/chart-drawing-primitive";
import {
  ChartSnapshotRequestError,
  fetchChartSnapshotCandles,
} from "@/features/chart/lib/chart-snapshot-request";
import {
  getChartStatusLabel,
  type ChartStatus,
} from "@/features/chart/lib/chart-status-label";
import { ChartTradePlanPrimitive } from "@/features/chart/lib/trade-plan-primitive";
import { getTradePlanPlacementError } from "@/features/chart/lib/trade-plan-direction";
import { ChartZonesPrimitive } from "@/features/chart/lib/zone-primitive";
import { ChartLimitPriceArmature } from "@/features/chart/components/chart-limit-price-armature";
import { getOrderZonePrices } from "@/lib/order-zone";
import type {
  MagicTradeChartOverlay,
  MagicTradeChartOverlayStatus,
} from "@/features/tag-along/lib/magic-trade-chart-overlays";
import {
  chartTimeframes,
  type ChartTimeframe,
} from "@/features/chart/components/timeframe-switcher";
import type { SessionLogEntry } from "@/features/session-log/lib/session-log";
import type {
  ChartDrawingTool,
  ChartLevel,
  ChartLineTriggerCondition,
  ChartLineTrigger,
  ChartSelection,
  ChartTrendLine,
  ChartTrendLineUpdate,
  ChartZone,
  PriceCandle,
} from "@/features/chart/types";
import type { HyperliquidSymbol, PortalChartSymbol } from "@/types/market";
import type {
  ActivePosition,
  ChartTradePlan,
  DraftChartTradePlan,
  JournalChartSnapshot,
  JournalChartSnapshotCaptureOptions,
  LiveExchangePosition,
  OrderZoneDistribution,
  PendingLimitOrder,
} from "@/types/trade";

type MinimalPriceChartProps = {
  activePosition: ActivePosition | null;
  activeTradePlan: ChartTradePlan | null;
  draftTradePlan: DraftChartTradePlan | null;
  levels: ChartLevel[];
  lineTriggers: ChartLineTrigger[];
  focusedMagicTradeRule?: { ruleId: string; requestId: number } | null;
  magicTradeOverlays?: MagicTradeChartOverlay[];
  magicTradeLevelPickActive?: boolean;
  limitPlacementInstructionLabel?: string | null;
  trendLines: ChartTrendLine[];
  limitPlacementActive: boolean;
  livePosition: LiveExchangePosition | null;
  onArmLineTrigger: (
    targetType: "horizontal-level",
    targetId: string,
    direction: "long" | "short",
    condition: ChartLineTriggerCondition,
  ) => void;
  onCancelPendingOrder: (pendingOrder: PendingLimitOrder) => void;
  onClearSelection: () => void;
  onCandleClose: (
    closePrice: number,
    candleTime: number,
    timeframe: ChartTimeframe,
  ) => void;
  onCurrentPriceChange: (price: number) => void;
  onLevelChange: (levelId: string, nextPrice: number) => void;
  onDisarmLineTrigger: (
    targetType: "horizontal-level",
    targetId: string,
  ) => void;
  onPendingOrderCommit: (
    pendingOrder: PendingLimitOrder,
    nextPrice: number,
  ) => Promise<boolean> | boolean;
  onDraftTradePlanChange: (tradePlan: DraftChartTradePlan | null) => void;
  onMidZoneLimitOrderCreate: (
    zoneId: string,
    direction: "long" | "short",
  ) => unknown | Promise<unknown>;
  onSnapshotCaptureReady?: (
    capture:
      | ((
          options?: JournalChartSnapshotCaptureOptions,
        ) => Promise<JournalChartSnapshot | null>)
      | null,
  ) => void;
  onOrderZoneCreate: (
    zoneId: string,
    direction: "long" | "short",
    count: number,
    distribution: OrderZoneDistribution,
  ) => unknown | Promise<unknown>;
  onZoneDerivedOrderConfigure: (
    zoneId: string,
    type: "mid-zone" | "order-zone",
    direction: "long" | "short",
    count: number,
    distribution: OrderZoneDistribution,
  ) => unknown | Promise<unknown>;
  onPriceSelect: (price: number) => void;
  onMagicTradeLevelPick?: (price: number) => void;
  onMagicTradeLevelPickCancel?: () => void;
  onTimeframeChange?: (timeframe: ChartTimeframe) => void;
  onSelectObject: (selection: ChartSelection) => void;
  onTradePlanChange: (tradePlan: ChartTradePlan) => void;
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
  ) => void | Promise<void>;
  onTrendLineEditingChange: (lineId: string, isEditing: boolean) => void;
  pendingLimitOrders: PendingLimitOrder[];
  selectedObject: ChartSelection | null;
  sessionLogEntries?: SessionLogEntry[];
  onShowExecutionFillChipsChange?: (show: boolean) => void;
  showExecutionFillChips?: boolean;
  showTradePlanChip?: boolean;
  coin: string | null;
  symbol: PortalChartSymbol;
  timeframe: ChartTimeframe;
  zones: ChartZone[];
};

type DraftZone = {
  topPrice: number;
  bottomPrice: number;
};

type DraftTrendLine = {
  startPrice: number;
  startTime: number;
  endPrice: number;
  endTime: number;
};

type PortalCrosshairGuidePoint = {
  height: number;
  width: number;
  x: number;
  y: number;
};

const PORTAL_CROSSHAIR_LINE_COLOR = "rgba(186,230,253,0.62)";
const PORTAL_CROSSHAIR_DASH_SIZE_PX = 10;
const PORTAL_CROSSHAIR_GAP_SIZE_PX = 8;

const CHART_DRAWING_TOOL_LABELS: Record<ChartDrawingTool, string> = {
  fibonacci: "Fibonacci",
  measure: "Measure move",
  "trend-line": "Trend line",
  "vertical-ray": "Vertical ray",
};

type OrderZoneDraft = {
  count: number;
  direction: "long" | "short";
  distribution: OrderZoneDistribution;
  type: "mid-zone" | "order-zone";
  zoneId: string;
};

type TrendLineInteractionMode = "body" | "start" | "end";

const CUSTOM_TREND_LINE_DRAWING_ENABLED = true;
const MAGIC_TRADE_PICK_DRAG_THRESHOLD_PX = 5;
const MAGIC_TRADE_PICK_PRICE_AXIS_GUTTER_PX = 96;
const MAGIC_TRADE_PICK_TIME_AXIS_GUTTER_PX = 42;

type TrendLineHit = {
  line: ChartTrendLine;
  mode: TrendLineInteractionMode;
};

type ZoneInteractionMode = "move" | "resize-top" | "resize-bottom";

type ZoneInteraction = {
  bottomY: number;
  mode: ZoneInteractionMode;
  topY: number;
  zone: ChartZone;
};

type TradePlanStep = "stop" | "target";
type TradePlanLevel = "entry" | "stop" | "target";

type TradePlanMetrics = {
  reward: number;
  rewardPercent: number;
  risk: number;
  riskPercent: number;
  rr: number;
};

type TradePlanPriceState =
  | "beyond-stop"
  | "risk-zone"
  | "profit-zone"
  | "beyond-target"
  | null;

type TradePlanChipTone = {
  borderClass: string;
  labelClass: string;
  metricClass: string;
  surfaceClass: string;
};

type ChartSnapshotExportStatus = "idle" | "saved" | "unavailable" | "error";

type ChartReadoutCandle = PriceCandle & {
  source: "crosshair" | "latest";
};

type PendingOrderTooltipTarget = {
  orderId: string;
  target: "cancel" | "drag";
  y: number;
  x: number;
} | null;

type ChartLineSeriesRef = {
  current: ISeriesApi<"Line"> | null;
};

type ChartHistogramSeriesRef = {
  current: ISeriesApi<"Histogram"> | null;
};

const PORTAL_CANDLE_UP_COLOR = "#26A69A";
const PORTAL_CANDLE_DOWN_COLOR = "#EF5350";

const PRIMARY_CANDLESTICK_OPTIONS = {
  borderDownColor: PORTAL_CANDLE_DOWN_COLOR,
  borderUpColor: PORTAL_CANDLE_UP_COLOR,
  borderVisible: false,
  downColor: PORTAL_CANDLE_DOWN_COLOR,
  lastValueVisible: false,
  priceLineVisible: false,
  upColor: PORTAL_CANDLE_UP_COLOR,
  wickDownColor: PORTAL_CANDLE_DOWN_COLOR,
  wickUpColor: PORTAL_CANDLE_UP_COLOR,
};

const MUTED_CANDLESTICK_OPTIONS = {
  borderDownColor: "rgba(0,0,0,0)",
  borderUpColor: "rgba(0,0,0,0)",
  borderVisible: false,
  downColor: "rgba(0,0,0,0)",
  lastValueVisible: false,
  priceLineVisible: false,
  upColor: "rgba(0,0,0,0)",
  wickDownColor: "rgba(0,0,0,0)",
  wickUpColor: "rgba(0,0,0,0)",
};

const LIVE_PRICE_MARKER_BACKGROUND = "#f05252";
const LIVE_PRICE_MARKER_TEXT_COLOR = "#ffffff";
const LIVE_PRICE_LINE_COLOR = "rgba(240, 82, 82, 0.82)";

const CHART_PRICE_SCALE_MODE_MAP: Record<
  ChartPriceScaleModeKey,
  PriceScaleMode
> = {
  log: PriceScaleMode.Logarithmic,
  normal: PriceScaleMode.Normal,
  percent: PriceScaleMode.Percentage,
};

type MagicTradePickPointerDown = {
  clientX: number;
  clientY: number;
  price: number;
};

type ContextMenuState =
  | {
      type: "chart";
      x: number;
      y: number;
    }
  | {
      lineId: string;
      type: "level";
      x: number;
      y: number;
    }
  | {
      lineId: string;
      type: "trend-line";
      x: number;
      y: number;
    }
  | {
      type: "position";
      x: number;
      y: number;
    }
  | {
      type: "pending-order";
      x: number;
      y: number;
    }
  | {
      type: "zone";
      zoneId: string;
      x: number;
      y: number;
    }
  | null;

type WsCandleMessage = {
  channel: "candle";
  data:
    | {
        T: number;
        c: number | string;
        h: number | string;
        i: string;
        l: number | string;
        n: number;
        o: number | string;
        s: string;
        t: number;
        v: number | string;
      }
    | Array<{
        T: number;
        c: number | string;
        h: number | string;
        i: string;
        l: number | string;
        n: number;
        o: number | string;
        s: string;
        t: number;
        v: number | string;
      }>;
};

type WsActiveAssetCtxMessage = {
  channel: "activeAssetCtx";
  data: {
    coin: string;
    ctx: {
      funding?: number | string;
      markPx?: number | string;
      midPx?: number | string;
      openInterest?: number | string;
    };
  };
};

const HYPERLIQUID_TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws";
const CHART_PING_INTERVAL_MS = 30_000;
const WS_RECONNECT_DELAY_MS = 1_500;
const lastGoodChartCandles = new Map<string, PriceCandle[]>();

function getChartCandleCacheKey(symbol: string, timeframe: ChartTimeframe) {
  return `${symbol}:${timeframe}`;
}

function isWsCandleMessage(message: unknown): message is WsCandleMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "channel" in message &&
    (message as { channel?: string }).channel === "candle" &&
    "data" in message
  );
}

function isWsActiveAssetCtxMessage(
  message: unknown,
): message is WsActiveAssetCtxMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "channel" in message &&
    (message as { channel?: string }).channel === "activeAssetCtx" &&
    "data" in message
  );
}

function normalizePriceCandle(
  candle: Partial<{
    c: number | string;
    h: number | string;
    l: number | string;
    o: number | string;
    t: number;
    v: number | string;
  }>,
): PriceCandle | null {
  if (typeof candle.t !== "number") {
    return null;
  }

  const open = Number(candle.o);
  const high = Number(candle.h);
  const low = Number(candle.l);
  const close = Number(candle.c);
  const volume = Number(candle.v);

  if (![open, high, low, close].every((value) => Number.isFinite(value))) {
    return null;
  }

  return {
    time: Math.floor(candle.t / 1000),
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : null,
  };
}

function toCandlestickPoint(candle: PriceCandle) {
  return {
    close: candle.close,
    high: candle.high,
    low: candle.low,
    open: candle.open,
    time: candle.time as Time,
  };
}

function toFutureWhitespacePoint(time: number): WhitespaceData<Time> {
  return {
    time: time as Time,
  };
}

function toBarSeriesPoint(candle: PriceCandle) {
  return {
    close: candle.close,
    high: candle.high,
    low: candle.low,
    open: candle.open,
    time: candle.time as Time,
  };
}

function toCloseValueSeriesPoint(candle: PriceCandle): LineData<Time> {
  return {
    time: candle.time as Time,
    value: candle.close,
  };
}

function toVolumeHistogramData(candles: PriceCandle[]): HistogramData<Time>[] {
  return candles.flatMap((candle) => {
    const volume = Number(candle.volume);

    if (!Number.isFinite(volume) || volume <= 0) {
      return [];
    }

    return [
      {
        color:
          candle.close >= candle.open
            ? "rgba(34,197,94,0.24)"
            : "rgba(239,68,68,0.24)",
        time: candle.time as Time,
        value: volume,
      },
    ];
  });
}

function toLineSeriesData(points: ChartIndicatorPoint[]): LineData<Time>[] {
  return points.map((point) => ({
    time: point.time as Time,
    value: point.value,
  }));
}

function toMacdHistogramData(
  points: ChartIndicatorPoint[],
): HistogramData<Time>[] {
  return points.map((point) => ({
    color: point.value >= 0 ? "rgba(34,197,94,0.24)" : "rgba(239,68,68,0.24)",
    time: point.time as Time,
    value: point.value,
  }));
}

function resolveNearestCandleTime(
  targetTime: number,
  candles: readonly PriceCandle[],
) {
  if (!Number.isFinite(targetTime) || candles.length === 0) {
    return null;
  }

  let bestTime = candles[0]?.time ?? null;
  let bestDistance =
    bestTime === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(bestTime - targetTime);

  for (const candle of candles) {
    const distance = Math.abs(candle.time - targetTime);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestTime = candle.time;
    }
  }

  return bestTime;
}

function toOpenInterestLineData(
  points: ChartOpenInterestPoint[],
): LineData<Time>[] {
  return points.flatMap((point) => {
    const value = point.valueUsd ?? point.valueBase;

    if (value === null || !Number.isFinite(value)) {
      return [];
    }

    return [{ time: point.time as Time, value }];
  });
}

function getBrowserChartLayerStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function isOhlcData(value: unknown): value is PriceCandle {
  return (
    typeof value === "object" &&
    value !== null &&
    "open" in value &&
    "high" in value &&
    "low" in value &&
    "close" in value &&
    [value.open, value.high, value.low, value.close].every(
      (price) => typeof price === "number" && Number.isFinite(price),
    )
  );
}

function formatChartHudPrice(price: number | null | undefined) {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(price) >= 1000 ? 1 : 3,
    minimumFractionDigits: Math.abs(price) >= 1000 ? 1 : 2,
  }).format(price);
}

function formatChartAxisPrice(price: number | null | undefined) {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(price) >= 1 ? 2 : 5,
    minimumFractionDigits: Math.abs(price) >= 1 ? 2 : 2,
  }).format(price);
}

function formatPendingOrderChipPrice(price: number | null | undefined) {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(price) >= 1000 ? 0 : 5,
    minimumFractionDigits: 0,
  }).format(price);
}

function formatPendingOrderChipSize(size: number | null | undefined) {
  if (size === null || size === undefined || !Number.isFinite(size)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(size) >= 1 ? 4 : 5,
    minimumFractionDigits: Math.abs(size) >= 1 ? 0 : 5,
  }).format(size);
}

function getMarketContextReadoutToneClass(
  tone: ChartMarketContextReadout["tone"],
) {
  if (tone === "positive") {
    return "text-[#22C55E]/82";
  }

  if (tone === "negative") {
    return "text-[#EF4444]/80";
  }

  if (tone === "warning") {
    return "text-amber-100/76";
  }

  if (tone === "muted") {
    return "text-white/42";
  }

  return "text-cyan-50/78";
}

function formatChartHudTime(time: number | null | undefined) {
  if (time === null || time === undefined || !Number.isFinite(time)) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
  }).format(new Date(time * 1000));
}

function renderChartCalendarIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 4v3M17 4v3M5.5 9.5h13M6.5 6h11A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function renderChartSnapshotIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M8.5 7.25 9.8 5.5h4.4l1.3 1.75h2.25A2.25 2.25 0 0 1 20 9.5v6.75a2.25 2.25 0 0 1-2.25 2.25H6.25A2.25 2.25 0 0 1 4 16.25V9.5a2.25 2.25 0 0 1 2.25-2.25H8.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M12 15.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function renderChartDrawingPencilIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m5.25 16.85-.75 2.65 2.65-.75L18.5 7.4a1.75 1.75 0 0 0 0-2.48l-.42-.42a1.75 1.75 0 0 0-2.48 0L5.25 16.85Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m14.45 5.65 3.9 3.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function renderChartAxisNutIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M8.1 4.75h7.8L20 12l-4.1 7.25H8.1L4 12l4.1-7.25Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9.25 12a2.75 2.75 0 1 0 5.5 0 2.75 2.75 0 0 0-5.5 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.1 4.75 9.25 8M15.9 4.75 14.75 8M8.1 19.25 9.25 16M15.9 19.25 14.75 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.35"
        opacity="0.58"
      />
    </svg>
  );
}

function renderChartSeriesStyleIcon(style: ChartSeriesStyleKey) {
  const iconClass = "h-4 w-4";

  if (style === "bars") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M8 4v16M16 4v16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
        <path
          d="M5.5 8H8m0 7h2.5M13.5 10H16m0 6h2.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (style === "line") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="m4.5 15.5 4.25-3.8 3.5 2.3 7.25-7.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (style === "area") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="m4.5 15.5 4.25-3.8 3.5 2.3 7.25-7.5v9.25H4.5Z"
          fill="currentColor"
          opacity="0.22"
        />
        <path
          d="m4.5 15.5 4.25-3.8 3.5 2.3 7.25-7.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (style === "baseline") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M4.5 12h15"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.2"
          opacity="0.45"
        />
        <path
          d="m4.5 15.5 4.25-3.8 3.5 2.3 7.25-7.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={iconClass}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M8 5v14M16 5v14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M5.75 8.25h4.5v7.5h-4.5zM13.75 6.75h4.5v8h-4.5z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function renderChartDrawingRailIcon(
  key:
    | "cursor"
    | "fibonacci"
    | "measure"
    | "objects"
    | "trade-plan"
    | "trend-line"
    | "vertical-ray"
    | "zone",
) {
  const iconClass = "h-5 w-5";

  if (key === "cursor") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 4v12l3.2-2.7L11 20l2.1-.9-2.7-6.3H15L5 4Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (key === "trend-line") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 17 19 7"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <circle cx="5" cy="17" r="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="19" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  if (key === "vertical-ray") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 4v16M7 9l5-5 5 5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (key === "measure") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M6 18 18 6M8 20l-4-4M20 8l-4-4M9.5 14.5l2 2M12.5 11.5l2 2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (key === "fibonacci") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 7h14M5 11h14M5 15h14M5 19h14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M7 5c4 2 5 6 1 8 5 0 7 2 7 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (key === "zone") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 8h14M5 16h14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
        <path
          d="M7 8v8M17 8v8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  if (key === "trade-plan") {
    return (
      <svg
        aria-hidden="true"
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M6 12h12M8 7h8M9 17h6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
        <path
          d="M8 5v4M16 15v4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={iconClass}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 7h12M6 12h12M6 17h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <circle cx="9" cy="7" r="1.7" fill="currentColor" />
      <circle cx="15" cy="12" r="1.7" fill="currentColor" />
      <circle cx="11" cy="17" r="1.7" fill="currentColor" />
    </svg>
  );
}

function upsertCandle(
  candles: PriceCandle[],
  nextCandle: PriceCandle,
  maxCandles = 720,
): PriceCandle[] {
  if (candles.length === 0) {
    return [nextCandle];
  }

  const nextCandles = [...candles];
  const lastCandle = nextCandles[nextCandles.length - 1];

  if (nextCandle.time < lastCandle.time) {
    const existingIndex = nextCandles.findIndex(
      (candle) => candle.time === nextCandle.time,
    );

    if (existingIndex >= 0) {
      nextCandles[existingIndex] = nextCandle;
    } else {
      nextCandles.push(nextCandle);
      nextCandles.sort((left, right) => left.time - right.time);
    }
  } else if (nextCandle.time === lastCandle.time) {
    nextCandles[nextCandles.length - 1] = nextCandle;
  } else {
    nextCandles.push(nextCandle);
  }

  return nextCandles.slice(-maxCandles);
}

function getChartStatusFromSnapshotError(error: unknown): ChartStatus {
  if (
    error instanceof ChartSnapshotRequestError &&
    error.code === "provider-missing"
  ) {
    return "provider-missing";
  }

  if (
    error instanceof ChartSnapshotRequestError &&
    error.code === "unsupported-timeframe"
  ) {
    return "unsupported-timeframe";
  }

  if (
    error instanceof ChartSnapshotRequestError &&
    error.code === "provider-limited"
  ) {
    return "provider-limited";
  }

  return "fetch-failed";
}

function getEffectivePendingOrderPrice(
  pendingOrder: PendingLimitOrder | null,
  previewPrice: number | null,
  zones: ChartZone[] = [],
  activeZoneId: string | null = null,
) {
  if (!pendingOrder) {
    return null;
  }

  const shouldUseZoneGeometry =
    pendingOrder.parentZoneId !== undefined &&
    pendingOrder.parentZoneId !== null &&
    (pendingOrder.status === "updating" ||
      pendingOrder.parentZoneId === activeZoneId);

  if (
    shouldUseZoneGeometry &&
    pendingOrder.source === "mid-zone" &&
    pendingOrder.parentZoneId
  ) {
    const parentZone = zones.find(
      (zone) => zone.id === pendingOrder.parentZoneId,
    );
    if (parentZone) {
      return (parentZone.topPrice + parentZone.bottomPrice) / 2;
    }
  }

  if (
    shouldUseZoneGeometry &&
    pendingOrder.source === "order-zone" &&
    pendingOrder.parentZoneId
  ) {
    const parentZone = zones.find(
      (zone) => zone.id === pendingOrder.parentZoneId,
    );
    if (parentZone) {
      const ladderPrices = getOrderZonePrices(
        parentZone,
        pendingOrder.orderZoneCount ?? 2,
        pendingOrder.orderZoneDistribution ?? "even",
      );
      const ladderPrice = ladderPrices[pendingOrder.orderZoneIndex ?? 0];
      if (Number.isFinite(ladderPrice)) {
        return ladderPrice;
      }
    }
  }

  return previewPrice ?? pendingOrder.normalizedPrice;
}

function findPendingOrderAtYCoordinate(
  pendingOrders: PendingLimitOrder[],
  zones: ChartZone[],
  symbol: string,
  priceToCoordinate: ((price: number) => number | null | undefined) | undefined,
  y: number,
  previewPrice: number | null,
  previewOrderId: string | null,
  activeZoneId: string | null = null,
  threshold = 8,
) {
  let bestMatch: { distance: number; order: PendingLimitOrder } | null = null;

  for (const order of pendingOrders) {
    if (
      order.symbol !== symbol ||
      !["live", "placing", "updating", "canceling"].includes(order.status)
    ) {
      continue;
    }

    const effectivePrice =
      previewOrderId === order.id
        ? getEffectivePendingOrderPrice(
            order,
            previewPrice,
            zones,
            activeZoneId,
          )
        : getEffectivePendingOrderPrice(order, null, zones, activeZoneId);
    const coordinate =
      effectivePrice !== null && priceToCoordinate
        ? priceToCoordinate(effectivePrice)
        : null;

    if (coordinate === null || coordinate === undefined) {
      continue;
    }

    const distance = Math.abs(coordinate - y);

    if (distance > threshold) {
      continue;
    }

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { distance, order };
    }
  }

  return bestMatch?.order ?? null;
}

function findLevelAtYCoordinate(
  levels: ChartLevel[],
  symbol: string,
  priceToCoordinate: ((price: number) => number | null | undefined) | undefined,
  y: number,
  threshold = 8,
) {
  let bestMatch: { distance: number; level: ChartLevel } | null = null;

  for (const level of levels) {
    if (level.symbol !== symbol || !priceToCoordinate) {
      continue;
    }

    const coordinate = priceToCoordinate(level.price);

    if (coordinate === null || coordinate === undefined) {
      continue;
    }

    const distance = Math.abs(coordinate - y);

    if (distance > threshold) {
      continue;
    }

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { distance, level };
    }
  }

  return bestMatch?.level ?? null;
}

function findMagicTradeOverlayAtYCoordinate(
  overlays: MagicTradeChartOverlay[],
  priceToCoordinate: ((price: number) => number | null | undefined) | undefined,
  y: number,
  threshold = 10,
) {
  if (!priceToCoordinate) {
    return null;
  }

  let bestMatch: { distance: number; overlay: MagicTradeChartOverlay } | null =
    null;

  for (const overlay of overlays) {
    const coordinate = priceToCoordinate(overlay.level);

    if (coordinate === null || coordinate === undefined) {
      continue;
    }

    const distance = Math.abs(coordinate - y);

    if (distance > threshold) {
      continue;
    }

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { distance, overlay };
    }
  }

  return bestMatch?.overlay ?? null;
}

function getMagicTradeOverlayPalette(
  status: MagicTradeChartOverlayStatus,
  selected: boolean,
): {
  axisLabelColor: string;
  axisLabelTextColor: string;
  color: string;
  lineWidth: 1 | 2 | 3 | 4;
  title: string;
} {
  if (status === "failed" || status === "skipped") {
    return {
      axisLabelColor: selected
        ? "rgba(145, 88, 42, 0.34)"
        : "rgba(145, 88, 42, 0.18)",
      axisLabelTextColor: "rgba(255, 237, 213, 0.92)",
      color: selected ? "rgba(251, 146, 60, 0.84)" : "rgba(251, 146, 60, 0.46)",
      lineWidth: selected ? 2 : 1,
      title: status === "failed" ? "Magic failed" : "Magic skipped",
    };
  }

  if (status === "executed") {
    return {
      axisLabelColor: selected
        ? "rgba(148, 163, 184, 0.22)"
        : "rgba(148, 163, 184, 0.12)",
      axisLabelTextColor: "rgba(226, 232, 240, 0.76)",
      color: selected
        ? "rgba(203, 213, 225, 0.56)"
        : "rgba(148, 163, 184, 0.28)",
      lineWidth: 1,
      title: "Magic executed",
    };
  }

  if (status === "triggered" || status === "executing") {
    return {
      axisLabelColor: "rgba(34, 211, 238, 0.30)",
      axisLabelTextColor: "rgba(236, 253, 255, 0.98)",
      color: "rgba(125, 249, 255, 0.96)",
      lineWidth: 2,
      title: status === "executing" ? "Magic executing" : "Magic triggered",
    };
  }

  if (status === "near-trigger") {
    return {
      axisLabelColor: "rgba(34, 211, 238, 0.22)",
      axisLabelTextColor: "rgba(207, 250, 254, 0.92)",
      color: "rgba(103, 232, 249, 0.74)",
      lineWidth: selected ? 2 : 1,
      title: "Magic near",
    };
  }

  return {
    axisLabelColor: selected
      ? "rgba(34, 211, 238, 0.20)"
      : "rgba(34, 211, 238, 0.12)",
    axisLabelTextColor: selected
      ? "rgba(236, 253, 255, 0.94)"
      : "rgba(207, 250, 254, 0.74)",
    color: selected ? "rgba(103, 232, 249, 0.72)" : "rgba(34, 211, 238, 0.36)",
    lineWidth: selected ? 2 : 1,
    title: selected ? "Magic armed" : "",
  };
}

function formatMagicTradeOverlayTitle(label: string) {
  return label.replace(/^Magic:/i, "MAGIC:");
}

function getMagicTradeStatusClasses(status: MagicTradeChartOverlayStatus) {
  if (status === "failed" || status === "skipped") {
    return "border-amber-300/40 bg-amber-300/[0.08] text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.13)]";
  }

  if (status === "executed") {
    return "border-cyan-200/20 bg-cyan-300/[0.045] text-cyan-50/72 shadow-[0_0_18px_rgba(34,211,238,0.10)]";
  }

  if (status === "triggered" || status === "executing") {
    return "border-cyan-200/55 bg-cyan-300/[0.11] text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.20)]";
  }

  if (status === "near-trigger") {
    return "border-cyan-200/42 bg-cyan-300/[0.09] text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.15)]";
  }

  return "border-[#33F5FF]/55 bg-[#33F5FF]/[0.07] text-[#33F5FF] shadow-[0_0_20px_rgba(51,245,255,0.14)]";
}

function renderMagicTradeSentence(sentence: string) {
  const highlightPattern =
    /(\$[\d,.]+|\b\d+(?:,\d{3})*(?:\.\d+)?x\b|\b\d+(?:,\d{3})*(?:\.\d+)?m\b|\b\d+(?:,\d{3})*(?:\.\d+)?\b)/gi;
  return sentence.split(highlightPattern).map((part, index) => {
    if (!part) {
      return null;
    }

    if (highlightPattern.test(part)) {
      highlightPattern.lastIndex = 0;
      return (
        <span key={`${part}-${index}`} className="text-cyan-300">
          {part}
        </span>
      );
    }

    highlightPattern.lastIndex = 0;
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function hasProcessingZoneOrders(
  pendingOrders: PendingLimitOrder[],
  zoneId: string,
) {
  return pendingOrders.some(
    (order) =>
      order.parentZoneId === zoneId &&
      (order.source === "mid-zone" || order.source === "order-zone") &&
      (order.status === "updating" || order.status === "canceling"),
  );
}

function getLevelTriggerPalette(
  trigger: ChartLineTrigger,
  selected: boolean,
): {
  axisLabelColor: string;
  axisLabelTextColor: string;
  color: string;
  title: string;
} {
  if (trigger.direction === "long") {
    return {
      axisLabelColor: selected
        ? "rgba(34, 211, 238, 0.28)"
        : trigger.status === "firing"
          ? "rgba(34, 211, 238, 0.34)"
          : "rgba(34, 211, 238, 0.16)",
      axisLabelTextColor: selected
        ? "rgba(236, 253, 255, 0.98)"
        : "rgba(191, 245, 255, 0.88)",
      color: selected
        ? "rgba(103, 232, 249, 0.96)"
        : trigger.status === "firing"
          ? "rgba(125, 249, 255, 0.98)"
          : "rgba(51, 245, 255, 0.72)",
      title:
        trigger.status === "firing"
          ? "Triggering"
          : selected
            ? trigger.condition === "touch"
              ? "Trigger Buy"
              : trigger.condition === "close-above"
                ? "Buy Close >"
                : "Buy Close <"
            : "",
    };
  }

  return {
    axisLabelColor: selected
      ? "rgba(150, 70, 83, 0.28)"
      : trigger.status === "firing"
        ? "rgba(160, 73, 91, 0.34)"
        : "rgba(126, 61, 73, 0.2)",
    axisLabelTextColor: selected
      ? "rgba(255, 243, 245, 0.98)"
      : "rgba(248, 224, 229, 0.92)",
    color: selected
      ? "rgba(240, 132, 150, 0.96)"
      : trigger.status === "firing"
        ? "rgba(247, 145, 162, 0.98)"
        : "rgba(239, 68, 68, 0.70)",
    title:
      trigger.status === "firing"
        ? "Triggering"
        : selected
          ? trigger.condition === "touch"
            ? "Trigger Sell"
            : trigger.condition === "close-above"
              ? "Sell Close >"
              : "Sell Close <"
          : "",
  };
}

function interpolateTrendLinePriceAtTime(
  trendLine: ChartTrendLine,
  time: number,
) {
  if (trendLine.startTime === trendLine.endTime) {
    return (trendLine.startPrice + trendLine.endPrice) / 2;
  }

  const progress =
    (time - trendLine.startTime) / (trendLine.endTime - trendLine.startTime);
  return (
    trendLine.startPrice +
    (trendLine.endPrice - trendLine.startPrice) * progress
  );
}

function getPendingOrderPalette(
  pendingOrder: PendingLimitOrder,
  selected: boolean,
): {
  axisLabelColor: string;
  axisLabelTextColor: string;
  color: string;
} {
  if (pendingOrder.direction === "long") {
    return {
      axisLabelColor: selected
        ? "rgba(28, 132, 104, 0.94)"
        : pendingOrder.status === "canceling"
          ? "rgba(51, 65, 85, 0.36)"
          : "rgba(24, 102, 84, 0.90)",
      axisLabelTextColor: "rgba(255, 255, 255, 0.96)",
      color: selected
        ? "rgba(74, 222, 128, 0.94)"
        : pendingOrder.status === "canceling"
          ? "rgba(148, 163, 184, 0.42)"
          : "rgba(34, 197, 94, 0.74)",
    };
  }

  return {
    axisLabelColor: selected
      ? "rgba(190, 64, 78, 0.94)"
      : pendingOrder.status === "canceling"
        ? "rgba(82, 86, 101, 0.38)"
        : "rgba(150, 52, 66, 0.90)",
    axisLabelTextColor: "rgba(255, 255, 255, 0.96)",
    color: selected
      ? "rgba(248, 113, 113, 0.96)"
      : pendingOrder.status === "canceling"
        ? "rgba(148, 163, 184, 0.46)"
        : "rgba(239, 68, 68, 0.78)",
  };
}

function getTradePlanPriceState(
  tradePlan: ChartTradePlan | null,
  currentPrice: number | null,
): TradePlanPriceState {
  if (!tradePlan || currentPrice === null || !Number.isFinite(currentPrice)) {
    return null;
  }

  if (tradePlan.direction === "long") {
    if (currentPrice < tradePlan.stop) {
      return "beyond-stop";
    }

    if (currentPrice <= tradePlan.entry) {
      return "risk-zone";
    }

    if (currentPrice <= tradePlan.target) {
      return "profit-zone";
    }

    return "beyond-target";
  }

  if (currentPrice > tradePlan.stop) {
    return "beyond-stop";
  }

  if (currentPrice >= tradePlan.entry) {
    return "risk-zone";
  }

  if (currentPrice >= tradePlan.target) {
    return "profit-zone";
  }

  return "beyond-target";
}

export function MinimalPriceChart({
  activePosition,
  activeTradePlan,
  draftTradePlan,
  levels,
  lineTriggers,
  focusedMagicTradeRule = null,
  magicTradeOverlays = [],
  magicTradeLevelPickActive = false,
  limitPlacementInstructionLabel = null,
  trendLines,
  limitPlacementActive,
  livePosition,
  onArmLineTrigger,
  onCancelPendingOrder,
  onClearSelection,
  onCandleClose,
  onCurrentPriceChange,
  onLevelChange,
  onDisarmLineTrigger,
  onPendingOrderCommit,
  onDraftTradePlanChange,
  onMidZoneLimitOrderCreate,
  onSnapshotCaptureReady,
  onOrderZoneCreate,
  onZoneDerivedOrderConfigure,
  onPriceSelect,
  onMagicTradeLevelPick,
  onMagicTradeLevelPickCancel,
  onTimeframeChange,
  onSelectObject,
  onTradePlanChange,
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
  pendingLimitOrders,
  selectedObject,
  sessionLogEntries = [],
  onShowExecutionFillChipsChange,
  showExecutionFillChips = true,
  showTradePlanChip = true,
  coin,
  symbol,
  timeframe,
  zones,
}: MinimalPriceChartProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const barDisplaySeriesRef = useRef<ISeriesApi<"Bar"> | null>(null);
  const lineDisplaySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const areaDisplaySeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const baselineDisplaySeriesRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const volumePaneRef = useRef<IPaneApi<Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiPaneRef = useRef<IPaneApi<Time> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const atrPaneRef = useRef<IPaneApi<Time> | null>(null);
  const atrSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdPaneRef = useRef<IPaneApi<Time> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistogramSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const fundingPaneRef = useRef<IPaneApi<Time> | null>(null);
  const fundingSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const openInterestPaneRef = useRef<IPaneApi<Time> | null>(null);
  const openInterestSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tradePlanPrimitiveRef = useRef<ChartTradePlanPrimitive | null>(null);
  const zonePrimitiveRef = useRef<ChartZonesPrimitive | null>(null);
  const chartDrawingPrimitiveRef = useRef<ChartDrawingPrimitive | null>(null);
  const magicTradeOverlayPrimitiveRef =
    useRef<ChartMagicTradeOverlayPrimitive | null>(null);
  const executionLineMarkerPrimitiveRef =
    useRef<ChartExecutionLineMarkerPrimitive | null>(null);
  const pendingOrderChipPrimitiveRef =
    useRef<ChartPendingOrderChipPrimitive | null>(null);
  const chartOverlayRefreshFrameRef = useRef<number | null>(null);
  const levelLinesRef = useRef<IPriceLine[]>([]);
  const tradePlanLinesRef = useRef<IPriceLine[]>([]);
  const livePriceLineRef = useRef<IPriceLine | null>(null);
  const liquidationPriceLineRef = useRef<IPriceLine | null>(null);
  const magicTradeOverlayLinesRef = useRef<IPriceLine[]>([]);
  const pendingLimitOrderLinesRef = useRef<IPriceLine[]>([]);
  const orderZonePreviewLinesRef = useRef<IPriceLine[]>([]);
  const levelsRef = useRef(levels);
  const magicTradeOverlaysRef =
    useRef<MagicTradeChartOverlay[]>(magicTradeOverlays);
  const trendLinesRef = useRef(trendLines);
  const zonesRef = useRef(zones);
  const symbolRef = useRef<PortalChartSymbol>(symbol);
  const activePositionRef = useRef<ActivePosition | null>(activePosition);
  const activeTradePlanRef = useRef<ChartTradePlan | null>(activeTradePlan);
  const lineTriggersRef = useRef(lineTriggers);
  const pendingLimitOrdersRef = useRef<PendingLimitOrder[]>(pendingLimitOrders);
  const onArmLineTriggerRef = useRef(onArmLineTrigger);
  const onPriceSelectRef = useRef(onPriceSelect);
  const onMagicTradeLevelPickRef = useRef(onMagicTradeLevelPick);
  const onCurrentPriceChangeRef = useRef(onCurrentPriceChange);
  const onLevelChangeRef = useRef(onLevelChange);
  const onDisarmLineTriggerRef = useRef(onDisarmLineTrigger);
  const onCancelPendingOrderRef = useRef(onCancelPendingOrder);
  const onCandleCloseRef = useRef(onCandleClose);
  const onPendingOrderCommitRef = useRef(onPendingOrderCommit);
  const onDraftTradePlanChangeRef = useRef(onDraftTradePlanChange);
  const onMidZoneLimitOrderCreateRef = useRef(onMidZoneLimitOrderCreate);
  const onOrderZoneCreateRef = useRef(onOrderZoneCreate);
  const onZoneDerivedOrderConfigureRef = useRef(onZoneDerivedOrderConfigure);
  const onSelectObjectRef = useRef(onSelectObject);
  const onClearSelectionRef = useRef(onClearSelection);
  const onTradePlanChangeRef = useRef(onTradePlanChange);
  const onTradePlanCommitRef = useRef(onTradePlanCommit);
  const onTradePlanCreateRef = useRef(onTradePlanCreate);
  const onZoneChangeRef = useRef(onZoneChange);
  const onZoneEditCommitRef = useRef(onZoneEditCommit);
  const onZoneEditStartRef = useRef(onZoneEditStart);
  const onZoneNoTradeToggleRef = useRef(onZoneNoTradeToggle);
  const onZoneCreateRef = useRef(onZoneCreate);
  const onTrendLineChangeRef = useRef(onTrendLineChange);
  const onTrendLineCreateRef = useRef(onTrendLineCreate);
  const onTrendLineDeleteRef = useRef(onTrendLineDelete);
  const onTrendLineEditCommitRef = useRef(onTrendLineEditCommit);
  const onTrendLineEditingChangeRef = useRef(onTrendLineEditingChange);
  const selectedObjectRef = useRef(selectedObject);
  const draftZoneRef = useRef<DraftZone | null>(null);
  const draftTrendLineRef = useRef<DraftTrendLine | null>(null);
  const draftTradePlanRef = useRef<DraftChartTradePlan | null>(null);
  const activeZoneModeRef = useRef(false);
  const activeTrendLineModeRef = useRef(false);
  const activeTradePlanModeRef = useRef<TradePlanStep | null>(null);
  const limitPlacementActiveRef = useRef(limitPlacementActive);
  const magicTradeLevelPickActiveRef = useRef(magicTradeLevelPickActive);
  const draggingTradePlanLevelRef = useRef<TradePlanLevel | null>(null);
  const dragStartTradePlanRef = useRef<ChartTradePlan | null>(null);
  const isDraggingPendingOrderRef = useRef(false);
  const dragStartPendingOrderRef = useRef<PendingLimitOrder | null>(null);
  const pendingOrderPointerDownOrderRef = useRef<PendingLimitOrder | null>(
    null,
  );
  const pendingOrderPointerDownYRef = useRef<number | null>(null);
  const pendingOrderPreviewOrderIdRef = useRef<string | null>(null);
  const pendingOrderPreviewPriceRef = useRef<number | null>(null);
  const magicTradePickPointerDownRef = useRef<MagicTradePickPointerDown | null>(
    null,
  );
  const suppressNextChartClickRef = useRef(false);
  const isDraggingZoneRef = useRef(false);
  const dragStartPriceRef = useRef<number | null>(null);
  const zoneEditModeRef = useRef<
    "move" | "resize-top" | "resize-bottom" | null
  >(null);
  const zoneEditPointerDownYRef = useRef<number | null>(null);
  const zoneEditPriceOffsetRef = useRef(0);
  const zoneEditStartZoneRef = useRef<ChartZone | null>(null);
  const zoneEditActiveZoneIdRef = useRef<string | null>(null);
  const hasStartedZoneEditRef = useRef(false);
  const trendLineEditModeRef = useRef<TrendLineInteractionMode | null>(null);
  const trendLineEditActiveLineIdRef = useRef<string | null>(null);
  const trendLineEditStartLineRef = useRef<ChartTrendLine | null>(null);
  const trendLineEditPointerDownRef = useRef<{ x: number; y: number } | null>(
    null,
  );
  const levelPointerDownRef = useRef<ChartLevel | null>(null);
  const levelPointerDownYRef = useRef<number | null>(null);
  const draggingLevelIdRef = useRef<string | null>(null);
  const chartLayerVisibilityRef = useRef<ChartLayerVisibility>(
    DEFAULT_CHART_LAYER_VISIBILITY,
  );
  const chartSettingsRef = useRef<ChartSettingsPreferences>(
    DEFAULT_CHART_SETTINGS,
  );
  const marketContextRef = useRef<ChartMarketContext | null>(null);
  const openInterestPointsRef = useRef<ChartOpenInterestPoint[]>([]);
  const hasStartedTrendLineEditRef = useRef(false);
  const isCreatingTrendLineRef = useRef(false);
  const candlesRef = useRef<PriceCandle[]>([]);
  const activeDrawingToolRef = useRef<ChartDrawingTool>("trend-line");
  const hoveredTrendLineIdRef = useRef<string | null>(null);
  const hoveredTrendLineHandleRef = useRef<TrendLineInteractionMode | null>(
    null,
  );
  const lastDefaultViewportKeyRef = useRef<string | null>(null);
  const lastEmittedClosedCandleTimeRef = useRef<number | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const websocketPingIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [status, setStatus] = useState<ChartStatus>("loading");
  const [zoneModeActive, setZoneModeActive] = useState(false);
  const [trendLineModeActive, setTrendLineModeActive] = useState(false);
  const [activeDrawingTool, setActiveDrawingTool] =
    useState<ChartDrawingTool>("trend-line");
  const [draftTrendLine, setDraftTrendLine] = useState<DraftTrendLine | null>(
    null,
  );
  const [tradePlanStep, setTradePlanStep] = useState<TradePlanStep | null>(
    null,
  );
  const [tradePlanPlacementWarning, setTradePlanPlacementWarning] = useState<
    string | null
  >(null);
  const [hoveredTradePlanLevel, setHoveredTradePlanLevel] =
    useState<TradePlanLevel | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [chartSeriesStyle, setChartSeriesStyle] =
    useState<ChartSeriesStyleKey>("candles");
  const [chartPriceScaleMode, setChartPriceScaleMode] =
    useState<ChartPriceScaleModeKey>("normal");
  const [chartAutoScaleEnabled, setChartAutoScaleEnabled] = useState(true);
  const [chartClockNow, setChartClockNow] = useState<number | null>(null);
  const [chartDataRevision, setChartDataRevision] = useState(0);
  const [chartUtilityTimeZone, setChartUtilityTimeZone] = useState("UTC");
  const [chartSettings, setChartSettings] = useState<ChartSettingsPreferences>(
    DEFAULT_CHART_SETTINGS,
  );
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const [chartIndicatorsOpen, setChartIndicatorsOpen] = useState(false);
  const [chartControlsOpen, setChartControlsOpen] = useState(false);
  const [chartCalendarOpen, setChartCalendarOpen] = useState(false);
  const [chartLayerActiveOnly, setChartLayerActiveOnly] = useState(false);
  const [drawingObjectsOpen, setDrawingObjectsOpen] = useState(false);
  const [drawingToolsDockOpen, setDrawingToolsDockOpen] = useState(false);
  const [chartLayerVisibility, setChartLayerVisibility] =
    useState<ChartLayerVisibility>(DEFAULT_CHART_LAYER_VISIBILITY);
  const [hydratedChartLayerStorageScope, setHydratedChartLayerStorageScope] =
    useState<string | null>(null);
  const [marketContext, setMarketContext] = useState<ChartMarketContext | null>(
    null,
  );
  const [marketContextStatus, setMarketContextStatus] =
    useState<ChartMarketContextStatus>("idle");
  const [openInterestPoints, setOpenInterestPoints] = useState<
    ChartOpenInterestPoint[]
  >([]);
  const [activeRangePreset, setActiveRangePreset] =
    useState<ChartRangePreset>("session");
  const [latestReadoutCandle, setLatestReadoutCandle] =
    useState<PriceCandle | null>(null);
  const [crosshairReadoutCandle, setCrosshairReadoutCandle] =
    useState<PriceCandle | null>(null);
  const [portalCrosshairGuidePoint, setPortalCrosshairGuidePoint] =
    useState<PortalCrosshairGuidePoint | null>(null);
  const [snapshotExportStatus, setSnapshotExportStatus] =
    useState<ChartSnapshotExportStatus>("idle");
  const [pendingOrderPreviewPrice, setPendingOrderPreviewPrice] = useState<
    number | null
  >(null);
  const [activePendingOrderTooltipTarget, setActivePendingOrderTooltipTarget] =
    useState<PendingOrderTooltipTarget>(null);

  function requestChartOverlayPositionRefresh() {
    if (chartOverlayRefreshFrameRef.current !== null) {
      return;
    }

    chartOverlayRefreshFrameRef.current = window.requestAnimationFrame(() => {
      chartOverlayRefreshFrameRef.current = null;
      setChartDataRevision((revision) => revision + 1);
    });
  }

  const [orderZoneDraft, setOrderZoneDraft] = useState<OrderZoneDraft | null>(
    null,
  );
  const [magicTradePickPreviewPrice, setMagicTradePickPreviewPrice] = useState<
    number | null
  >(null);
  const [magicTradePickGuideX, setMagicTradePickGuideX] = useState<
    number | null
  >(null);
  const [magicTradePickSnapPrice, setMagicTradePickSnapPrice] = useState<
    number | null
  >(null);
  const [hoveredMagicTradeOverlayId, setHoveredMagicTradeOverlayId] = useState<
    string | null
  >(null);
  const [selectedMagicTradeOverlayId, setSelectedMagicTradeOverlayId] =
    useState<string | null>(null);
  const [magicTradeTooltipPoint, setMagicTradeTooltipPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [hoveredZoneInteraction, setHoveredZoneInteraction] =
    useState<ZoneInteraction | null>(null);
  const [hoveredTrendLineId, setHoveredTrendLineId] = useState<string | null>(
    null,
  );
  const [hoveredTrendLineHandle, setHoveredTrendLineHandle] = useState<
    "body" | "start" | "end" | null
  >(null);
  const [activeZoneInteractionMode, setActiveZoneInteractionMode] =
    useState<ZoneInteractionMode | null>(null);

  const activeBaseAsset =
    symbol.toUpperCase().replace("-USD", "").split(/[-/]/)[0] ?? symbol;
  const chartStatusLabel = getChartStatusLabel({
    baseAsset: activeBaseAsset,
    status,
  });
  const chartLayerStorageScope = `${symbol}:${timeframe}`;
  function drawRoundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - safeRadius,
      y + height,
    );
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  async function captureVisibleChartSnapshot(
    options?: JournalChartSnapshotCaptureOptions,
  ): Promise<JournalChartSnapshot | null> {
    if (!wrapperRef.current) {
      return null;
    }

    const chartBounds = wrapperRef.current.getBoundingClientRect();
    const layeredCanvases = Array.from(
      wrapperRef.current.querySelectorAll("canvas"),
    );

    if (
      chartBounds.width <= 0 ||
      chartBounds.height <= 0 ||
      layeredCanvases.length === 0
    ) {
      return null;
    }

    const fullScale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5);
    const targetWidth = Math.min(
      Math.round(chartBounds.width * fullScale),
      2200,
    );
    const scale = targetWidth / chartBounds.width;
    const outputWidth = Math.max(1, targetWidth);
    const outputHeight = Math.max(1, Math.round(chartBounds.height * scale));
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;

    const context = outputCanvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.fillStyle = "#09101a";
    context.fillRect(0, 0, outputWidth, outputHeight);

    layeredCanvases.forEach((layerCanvas) => {
      const layerBounds = layerCanvas.getBoundingClientRect();

      if (layerBounds.width <= 0 || layerBounds.height <= 0) {
        return;
      }

      context.drawImage(
        layerCanvas,
        (layerBounds.left - chartBounds.left) * scale,
        (layerBounds.top - chartBounds.top) * scale,
        layerBounds.width * scale,
        layerBounds.height * scale,
      );
    });

    let marker: JournalChartSnapshot["marker"] = null;

    if (
      options?.markerPrice !== null &&
      options?.markerPrice !== undefined &&
      Number.isFinite(options.markerPrice) &&
      seriesRef.current
    ) {
      const markerCoordinate = seriesRef.current.priceToCoordinate(
        options.markerPrice,
      );

      if (markerCoordinate !== null && Number.isFinite(markerCoordinate)) {
        const markerY = markerCoordinate * scale;
        marker = {
          label: options.markerLabel ?? "Entry",
          price: options.markerPrice,
          tone: options.markerTone === "exit" ? "exit" : "entry",
          yPercent: outputHeight > 0 ? markerY / outputHeight : null,
        };
        const markerTone =
          options.markerTone === "exit"
            ? {
                fill: "rgba(244,114,182,0.96)",
                glow: "rgba(244,114,182,0.28)",
                line: "rgba(251,113,133,0.92)",
                text: "#fff8fb",
              }
            : {
                fill: "rgba(34,211,238,0.96)",
                glow: "rgba(34,211,238,0.26)",
                line: "rgba(103,232,249,0.94)",
                text: "#03131a",
              };
        const fontSize = Math.max(14, Math.round(12 * scale));
        const lineWidth = Math.max(1.5, 1.5 * scale);
        const lineInset = 18 * scale;
        const label = `${options.markerLabel ?? "Entry"} ${options.markerPrice.toFixed(2)}`;

        context.save();
        context.strokeStyle = markerTone.line;
        context.lineWidth = lineWidth;
        context.setLineDash([8 * scale, 6 * scale]);
        context.shadowBlur = 18 * scale;
        context.shadowColor = markerTone.glow;
        context.beginPath();
        context.moveTo(lineInset, markerY);
        context.lineTo(outputWidth - lineInset, markerY);
        context.stroke();
        context.setLineDash([]);
        context.shadowBlur = 0;

        context.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`;
        const textMetrics = context.measureText(label);
        const pillPaddingX = 14 * scale;
        const pillHeight = fontSize + 12 * scale;
        const pillWidth = textMetrics.width + pillPaddingX * 2;
        const pillX = Math.max(
          16 * scale,
          outputWidth - pillWidth - 18 * scale,
        );
        const pillY = Math.min(
          Math.max(14 * scale, markerY - pillHeight - 10 * scale),
          outputHeight - pillHeight - 14 * scale,
        );

        context.shadowBlur = 22 * scale;
        context.shadowColor = markerTone.glow;
        context.fillStyle = markerTone.fill;
        drawRoundedRect(
          context,
          pillX,
          pillY,
          pillWidth,
          pillHeight,
          12 * scale,
        );
        context.fill();
        context.shadowBlur = 0;

        context.fillStyle = markerTone.text;
        context.textBaseline = "middle";
        context.fillText(
          label,
          pillX + pillPaddingX,
          pillY + pillHeight / 2 + 0.5,
        );
        context.restore();
      }
    }

    const previewWidth = Math.min(480, outputWidth);
    const previewScale = previewWidth / outputWidth;
    const previewHeight = Math.max(1, Math.round(outputHeight * previewScale));
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = previewWidth;
    previewCanvas.height = previewHeight;
    const previewContext = previewCanvas.getContext("2d");

    if (!previewContext) {
      return null;
    }

    previewContext.drawImage(outputCanvas, 0, 0, previewWidth, previewHeight);

    const [fullBlob, previewBlob] = await Promise.all([
      new Promise<Blob | null>((resolve) => {
        outputCanvas.toBlob(resolve, "image/png");
      }),
      new Promise<Blob | null>((resolve) => {
        previewCanvas.toBlob(resolve, "image/webp", 0.92);
      }),
    ]);

    if (!fullBlob || !previewBlob) {
      return null;
    }

    return {
      fullBlob,
      fullHeight: outputHeight,
      fullWidth: outputWidth,
      marker,
      previewBlob,
      previewHeight,
      previewWidth,
    };
  }

  useEffect(() => {
    onSnapshotCaptureReady?.(captureVisibleChartSnapshot);

    return () => {
      onSnapshotCaptureReady?.(null);
    };
  }, [onSnapshotCaptureReady]);

  useEffect(() => {
    chartLayerVisibilityRef.current = chartLayerVisibility;
    syncChartDrawingPrimitive();

    if (hydratedChartLayerStorageScope !== chartLayerStorageScope) {
      return;
    }

    try {
      writeChartLayerVisibility(
        getBrowserChartLayerStorage(),
        symbol,
        timeframe,
        chartLayerVisibility,
      );
    } catch (error) {
      console.warn("[portal] unable to persist chart layer visibility", error);
    }
  }, [
    chartLayerStorageScope,
    chartLayerVisibility,
    hydratedChartLayerStorageScope,
    symbol,
    timeframe,
  ]);

  useEffect(() => {
    setChartLayerVisibility(
      readChartLayerVisibility(
        getBrowserChartLayerStorage(),
        symbol,
        timeframe,
      ),
    );
    setHydratedChartLayerStorageScope(chartLayerStorageScope);
  }, [chartLayerStorageScope, symbol, timeframe]);

  useEffect(() => {
    syncVolumePane();
  }, [chartLayerVisibility.volume]);

  useEffect(() => {
    syncIndicatorStudies();
  }, [
    chartLayerVisibility.atr,
    chartLayerVisibility.ema20,
    chartLayerVisibility.ema50,
    chartLayerVisibility.macd,
    chartLayerVisibility.rsi,
    chartLayerVisibility.vwap,
  ]);

  useEffect(() => {
    syncMarketContextPanes();
  }, [chartLayerVisibility.funding, chartLayerVisibility.openInterest]);

  useEffect(() => {
    marketContextRef.current = marketContext;
    syncMarketContextPanes();
  }, [marketContext]);

  useEffect(() => {
    openInterestPointsRef.current = openInterestPoints;
    syncMarketContextPanes();
  }, [openInterestPoints]);

  const [activeZoneInteractionZoneId, setActiveZoneInteractionZoneId] =
    useState<string | null>(null);
  function clearOrderZoneDraft() {
    setOrderZoneDraft(null);
  }

  function clearTrendLineDraft() {
    draftTrendLineRef.current = null;
    isCreatingTrendLineRef.current = false;
    setDraftTrendLine(null);
    setTrendLineModeActive(false);
    activeDrawingToolRef.current = "trend-line";
    setActiveDrawingTool("trend-line");
    syncChartDrawingPrimitive();
  }

  const tradePlanPriceState = useMemo(
    () => getTradePlanPriceState(activeTradePlan, currentPrice),
    [activeTradePlan, currentPrice],
  );
  const nearPlanThreshold = useMemo(() => {
    if (!activeTradePlan) {
      return 0;
    }

    return Math.max(Math.abs(activeTradePlan.entry) * 0.0015, 1);
  }, [activeTradePlan]);
  const entryHighlightActive = useMemo(() => {
    if (
      !activeTradePlan ||
      currentPrice === null ||
      !Number.isFinite(currentPrice)
    ) {
      return false;
    }

    return Math.abs(currentPrice - activeTradePlan.entry) <= nearPlanThreshold;
  }, [activeTradePlan, currentPrice, nearPlanThreshold]);
  const targetHighlightActive = useMemo(() => {
    if (
      !activeTradePlan ||
      currentPrice === null ||
      !Number.isFinite(currentPrice)
    ) {
      return false;
    }

    return Math.abs(currentPrice - activeTradePlan.target) <= nearPlanThreshold;
  }, [activeTradePlan, currentPrice, nearPlanThreshold]);
  useEffect(() => {
    onPriceSelectRef.current = onPriceSelect;
  }, [onPriceSelect]);

  useEffect(() => {
    onMagicTradeLevelPickRef.current = onMagicTradeLevelPick;
  }, [onMagicTradeLevelPick]);

  useEffect(() => {
    if (!magicTradeLevelPickActive) {
      magicTradePickPointerDownRef.current = null;
      setMagicTradePickPreviewPrice(null);
      setMagicTradePickGuideX(null);
    }
  }, [magicTradeLevelPickActive]);

  useEffect(() => {
    onCurrentPriceChangeRef.current = onCurrentPriceChange;
  }, [onCurrentPriceChange]);

  useEffect(() => {
    onCandleCloseRef.current = onCandleClose;
  }, [onCandleClose]);

  useEffect(() => {
    onLevelChangeRef.current = onLevelChange;
  }, [onLevelChange]);

  useEffect(() => {
    onArmLineTriggerRef.current = onArmLineTrigger;
  }, [onArmLineTrigger]);

  useEffect(() => {
    onDisarmLineTriggerRef.current = onDisarmLineTrigger;
  }, [onDisarmLineTrigger]);

  useEffect(() => {
    onCancelPendingOrderRef.current = onCancelPendingOrder;
  }, [onCancelPendingOrder]);

  useEffect(() => {
    onPendingOrderCommitRef.current = onPendingOrderCommit;
  }, [onPendingOrderCommit]);

  useEffect(() => {
    onDraftTradePlanChangeRef.current = onDraftTradePlanChange;
  }, [onDraftTradePlanChange]);

  useEffect(() => {
    onMidZoneLimitOrderCreateRef.current = onMidZoneLimitOrderCreate;
  }, [onMidZoneLimitOrderCreate]);

  useEffect(() => {
    onOrderZoneCreateRef.current = onOrderZoneCreate;
  }, [onOrderZoneCreate]);

  useEffect(() => {
    onZoneDerivedOrderConfigureRef.current = onZoneDerivedOrderConfigure;
  }, [onZoneDerivedOrderConfigure]);

  useEffect(() => {
    onTradePlanChangeRef.current = onTradePlanChange;
  }, [onTradePlanChange]);

  useEffect(() => {
    onTradePlanCommitRef.current = onTradePlanCommit;
  }, [onTradePlanCommit]);

  useEffect(() => {
    onSelectObjectRef.current = onSelectObject;
  }, [onSelectObject]);

  useEffect(() => {
    onClearSelectionRef.current = onClearSelection;
  }, [onClearSelection]);

  useEffect(() => {
    onZoneCreateRef.current = onZoneCreate;
  }, [onZoneCreate]);

  useEffect(() => {
    onTrendLineChangeRef.current = onTrendLineChange;
  }, [onTrendLineChange]);

  useEffect(() => {
    onTrendLineCreateRef.current = onTrendLineCreate;
  }, [onTrendLineCreate]);

  useEffect(() => {
    onTrendLineDeleteRef.current = onTrendLineDelete;
  }, [onTrendLineDelete]);

  useEffect(() => {
    onTrendLineEditCommitRef.current = onTrendLineEditCommit;
  }, [onTrendLineEditCommit]);

  useEffect(() => {
    onTrendLineEditingChangeRef.current = onTrendLineEditingChange;
  }, [onTrendLineEditingChange]);

  useEffect(() => {
    onZoneChangeRef.current = onZoneChange;
  }, [onZoneChange]);

  useEffect(() => {
    onZoneEditCommitRef.current = onZoneEditCommit;
  }, [onZoneEditCommit]);

  useEffect(() => {
    onZoneEditStartRef.current = onZoneEditStart;
  }, [onZoneEditStart]);

  useEffect(() => {
    onTradePlanCreateRef.current = onTradePlanCreate;
  }, [onTradePlanCreate]);

  useEffect(() => {
    onZoneNoTradeToggleRef.current = onZoneNoTradeToggle;
  }, [onZoneNoTradeToggle]);

  useEffect(() => {
    levelsRef.current = levels;
  }, [levels]);

  useEffect(() => {
    magicTradeOverlaysRef.current = magicTradeOverlays;

    if (
      selectedMagicTradeOverlayId &&
      !magicTradeOverlays.some(
        (overlay) => overlay.id === selectedMagicTradeOverlayId,
      )
    ) {
      setSelectedMagicTradeOverlayId(null);
      setMagicTradeTooltipPoint(null);
    }
  }, [magicTradeOverlays, selectedMagicTradeOverlayId]);

  useEffect(() => {
    if (!focusedMagicTradeRule) {
      return;
    }

    const overlay = magicTradeOverlays.find(
      (currentOverlay) =>
        currentOverlay.ruleId === focusedMagicTradeRule.ruleId,
    );

    if (!overlay) {
      return;
    }

    setSelectedMagicTradeOverlayId(overlay.id);
    setHoveredMagicTradeOverlayId(null);

    const container = containerRef.current;
    const lineY = seriesRef.current?.priceToCoordinate(overlay.level) ?? null;
    const tooltipY =
      lineY === null
        ? 72
        : Math.max(
            16,
            Math.min(lineY - 42, (container?.clientHeight ?? 320) - 210),
          );

    setMagicTradeTooltipPoint({
      x: Math.max(16, (container?.clientWidth ?? 430) - 370),
      y: tooltipY,
    });
  }, [focusedMagicTradeRule, magicTradeOverlays]);

  useEffect(() => {
    lineTriggersRef.current = lineTriggers;
  }, [lineTriggers]);

  useEffect(() => {
    trendLinesRef.current = trendLines;
    syncChartDrawingPrimitive();
  }, [trendLines]);

  useEffect(() => {
    activeDrawingToolRef.current = activeDrawingTool;
    syncChartDrawingPrimitive();
  }, [activeDrawingTool]);

  useEffect(() => {
    draftTrendLineRef.current = draftTrendLine;
    syncChartDrawingPrimitive();
  }, [draftTrendLine]);

  useEffect(() => {
    hoveredTrendLineIdRef.current = hoveredTrendLineId;
    syncChartDrawingPrimitive();
  }, [hoveredTrendLineId]);

  useEffect(() => {
    hoveredTrendLineHandleRef.current = hoveredTrendLineHandle;
  }, [hoveredTrendLineHandle]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    symbolRef.current = symbol;
    lastDefaultViewportKeyRef.current = null;
    candlesRef.current = [];
    seriesRef.current?.setData([]);
    syncChartDrawingPrimitive();
    seriesRef.current?.priceScale().setAutoScale(true);
    chartRef.current?.priceScale("right").setAutoScale(true);
    chartRef.current
      ?.timeScale()
      .applyOptions({ rightOffset: getFutureWorkspaceBars() });
    chartRef.current?.timeScale().resetTimeScale();
    setMagicTradePickPreviewPrice(null);
    setMagicTradePickSnapPrice(null);
    setMagicTradePickGuideX(null);
    setCurrentPrice(null);
    setStatus("loading");
  }, [symbol]);

  useEffect(() => {
    activePositionRef.current = activePosition;
  }, [activePosition]);

  useEffect(() => {
    activeTradePlanRef.current = activeTradePlan;
  }, [activeTradePlan]);

  useEffect(() => {
    pendingLimitOrdersRef.current = pendingLimitOrders;
  }, [pendingLimitOrders]);

  useEffect(
    () => () => {
      if (chartOverlayRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(chartOverlayRefreshFrameRef.current);
        chartOverlayRefreshFrameRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (
      pendingOrderPreviewPrice !== null &&
      !isDraggingPendingOrderRef.current &&
      pendingOrderPointerDownOrderRef.current === null &&
      !pendingLimitOrders.some(
        (pendingOrder) => pendingOrder.status === "updating",
      )
    ) {
      pendingOrderPreviewOrderIdRef.current = null;
      setPendingOrderPreviewPrice(null);
    }
  }, [pendingLimitOrders, pendingOrderPreviewPrice]);

  useEffect(() => {
    pendingOrderPreviewPriceRef.current = pendingOrderPreviewPrice;
  }, [pendingOrderPreviewPrice]);

  useEffect(() => {
    selectedObjectRef.current = selectedObject;
    syncChartDrawingPrimitive();
  }, [selectedObject]);

  function removeVolumePane() {
    const chart = chartRef.current;
    const volumePane = volumePaneRef.current;
    const volumeSeries = volumeSeriesRef.current;

    if (!chart) {
      volumePaneRef.current = null;
      volumeSeriesRef.current = null;
      return;
    }

    if (volumeSeries) {
      chart.removeSeries(volumeSeries);
      volumeSeriesRef.current = null;
    }

    if (volumePane) {
      const paneIndex = chart.panes().indexOf(volumePane);

      if (paneIndex > 0) {
        chart.removePane(paneIndex);
      }

      volumePaneRef.current = null;
    }
  }

  function syncVolumePane(candles: PriceCandle[] = candlesRef.current) {
    const chart = chartRef.current;
    const volumeData = toVolumeHistogramData(candles);

    if (
      !chart ||
      !chartLayerVisibilityRef.current.volume ||
      volumeData.length === 0
    ) {
      removeVolumePane();
      return;
    }

    if (!volumePaneRef.current || !volumeSeriesRef.current) {
      const volumePane = chart.addPane(false);
      volumePane.setStretchFactor(0.18);
      volumePane.priceScale("right").applyOptions({
        borderVisible: false,
      });
      volumePaneRef.current = volumePane;
      volumeSeriesRef.current = volumePane.addSeries(HistogramSeries, {
        base: 0,
        color: "rgba(103,232,249,0.16)",
        lastValueVisible: false,
        priceFormat: {
          type: "volume",
        },
        priceLineVisible: false,
        priceScaleId: "right",
      });
    }

    volumeSeriesRef.current.setData(volumeData);
  }

  function syncOverlayLineSeries(
    seriesRef: ChartLineSeriesRef,
    enabled: boolean,
    data: LineData<Time>[],
    options: LineSeriesPartialOptions,
  ) {
    const chart = chartRef.current;

    if (!chart || !enabled || data.length === 0) {
      if (chart && seriesRef.current) {
        chart.removeSeries(seriesRef.current);
      }

      seriesRef.current = null;
      return;
    }

    if (!seriesRef.current) {
      seriesRef.current = chart.addSeries(LineSeries, options);
    }

    seriesRef.current.setData(data);
  }

  function removeStudyPane(
    paneRef: { current: IPaneApi<Time> | null },
    seriesRefs: Array<ChartLineSeriesRef | ChartHistogramSeriesRef>,
  ) {
    const chart = chartRef.current;
    const pane = paneRef.current;

    if (!chart) {
      seriesRefs.forEach((seriesRef) => {
        seriesRef.current = null;
      });
      paneRef.current = null;
      return;
    }

    seriesRefs.forEach((seriesRef) => {
      if (seriesRef.current) {
        chart.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }
    });

    if (pane) {
      const paneIndex = chart.panes().indexOf(pane);

      if (paneIndex > 0) {
        chart.removePane(paneIndex);
      }

      paneRef.current = null;
    }
  }

  function syncSingleLineStudyPane(
    paneRef: { current: IPaneApi<Time> | null },
    seriesRef: ChartLineSeriesRef,
    enabled: boolean,
    data: LineData<Time>[],
    options: LineSeriesPartialOptions,
  ) {
    const chart = chartRef.current;

    if (!chart || !enabled || data.length === 0) {
      removeStudyPane(paneRef, [seriesRef]);
      return;
    }

    if (!paneRef.current || !seriesRef.current) {
      const pane = chart.addPane(false);
      pane.setStretchFactor(0.15);
      pane.priceScale("right").applyOptions({
        borderVisible: false,
      });
      paneRef.current = pane;
      seriesRef.current = pane.addSeries(LineSeries, options);
    }

    seriesRef.current.setData(data);
  }

  function syncIndicatorStudies(candles: PriceCandle[] = candlesRef.current) {
    const visibility = chartLayerVisibilityRef.current;
    const ema20Data = toLineSeriesData(calculateEma(candles, 20));
    const ema50Data = toLineSeriesData(calculateEma(candles, 50));
    const vwapData = toLineSeriesData(calculateVwap(candles));
    const rsiData = toLineSeriesData(calculateRsi(candles));
    const atrData = toLineSeriesData(calculateAtr(candles));
    const macdData = calculateMacd(candles);

    syncOverlayLineSeries(ema20SeriesRef, visibility.ema20, ema20Data, {
      color: "rgba(103,232,249,0.74)",
      lastValueVisible: false,
      lineWidth: 1,
      priceLineVisible: false,
    });
    syncOverlayLineSeries(ema50SeriesRef, visibility.ema50, ema50Data, {
      color: "rgba(167,139,250,0.70)",
      lastValueVisible: false,
      lineWidth: 1,
      priceLineVisible: false,
    });
    syncOverlayLineSeries(vwapSeriesRef, visibility.vwap, vwapData, {
      color: "rgba(245,158,11,0.62)",
      lastValueVisible: false,
      lineStyle: 2,
      lineWidth: 1,
      priceLineVisible: false,
    });
    syncSingleLineStudyPane(rsiPaneRef, rsiSeriesRef, visibility.rsi, rsiData, {
      color: "rgba(103,232,249,0.70)",
      lastValueVisible: false,
      lineWidth: 1,
      priceLineVisible: false,
    });
    syncSingleLineStudyPane(atrPaneRef, atrSeriesRef, visibility.atr, atrData, {
      color: "rgba(245,158,11,0.68)",
      lastValueVisible: false,
      lineWidth: 1,
      priceLineVisible: false,
    });

    const chart = chartRef.current;
    const macdLineData = toLineSeriesData(macdData.macd);
    const macdSignalData = toLineSeriesData(macdData.signal);
    const macdHistogramData = toMacdHistogramData(macdData.histogram);

    if (
      !chart ||
      !visibility.macd ||
      macdLineData.length === 0 ||
      macdSignalData.length === 0 ||
      macdHistogramData.length === 0
    ) {
      removeStudyPane(macdPaneRef, [
        macdLineSeriesRef,
        macdSignalSeriesRef,
        macdHistogramSeriesRef,
      ]);
    } else {
      if (
        !macdPaneRef.current ||
        !macdLineSeriesRef.current ||
        !macdSignalSeriesRef.current ||
        !macdHistogramSeriesRef.current
      ) {
        const pane = chart.addPane(false);
        pane.setStretchFactor(0.17);
        pane.priceScale("right").applyOptions({
          borderVisible: false,
        });
        macdPaneRef.current = pane;
        macdHistogramSeriesRef.current = pane.addSeries(HistogramSeries, {
          base: 0,
          color: "rgba(103,232,249,0.14)",
          lastValueVisible: false,
          priceLineVisible: false,
          priceScaleId: "right",
        });
        macdLineSeriesRef.current = pane.addSeries(LineSeries, {
          color: "rgba(103,232,249,0.72)",
          lastValueVisible: false,
          lineWidth: 1,
          priceLineVisible: false,
        });
        macdSignalSeriesRef.current = pane.addSeries(LineSeries, {
          color: "rgba(167,139,250,0.70)",
          lastValueVisible: false,
          lineWidth: 1,
          priceLineVisible: false,
        });
      }

      macdHistogramSeriesRef.current.setData(macdHistogramData);
      macdLineSeriesRef.current.setData(macdLineData);
      macdSignalSeriesRef.current.setData(macdSignalData);
    }
  }

  function syncMarketContextPanes() {
    const visibility = chartLayerVisibilityRef.current;
    const fundingData = toLineSeriesData(
      marketContextRef.current?.fundingRates ?? [],
    );
    const openInterestData = toOpenInterestLineData(
      openInterestPointsRef.current,
    );

    syncSingleLineStudyPane(
      fundingPaneRef,
      fundingSeriesRef,
      visibility.funding,
      fundingData,
      {
        color: "rgba(167,139,250,0.72)",
        lastValueVisible: false,
        lineWidth: 1,
        priceFormat: {
          minMove: 0.0001,
          precision: 4,
          type: "price",
        },
        priceLineVisible: false,
      },
    );

    syncSingleLineStudyPane(
      openInterestPaneRef,
      openInterestSeriesRef,
      visibility.openInterest,
      openInterestData,
      {
        color: "rgba(103,232,249,0.68)",
        lastValueVisible: false,
        lineWidth: 1,
        priceFormat: {
          type: "volume",
        },
        priceLineVisible: false,
      },
    );
  }

  function removeDisplaySeries(
    seriesRef:
      | typeof barDisplaySeriesRef
      | typeof lineDisplaySeriesRef
      | typeof areaDisplaySeriesRef
      | typeof baselineDisplaySeriesRef,
  ) {
    if (!chartRef.current || !seriesRef.current) {
      return;
    }

    chartRef.current.removeSeries(seriesRef.current);
    seriesRef.current = null;
  }

  function syncChartSeriesStyle(candles: PriceCandle[]) {
    const chart = chartRef.current;
    const primarySeries = seriesRef.current;

    if (!chart || !primarySeries) {
      return;
    }

    primarySeries.applyOptions(
      chartSeriesStyle === "candles"
        ? PRIMARY_CANDLESTICK_OPTIONS
        : MUTED_CANDLESTICK_OPTIONS,
    );

    if (chartSeriesStyle !== "bars") {
      removeDisplaySeries(barDisplaySeriesRef);
    }
    if (chartSeriesStyle !== "line") {
      removeDisplaySeries(lineDisplaySeriesRef);
    }
    if (chartSeriesStyle !== "area") {
      removeDisplaySeries(areaDisplaySeriesRef);
    }
    if (chartSeriesStyle !== "baseline") {
      removeDisplaySeries(baselineDisplaySeriesRef);
    }

    if (chartSeriesStyle === "bars") {
      if (!barDisplaySeriesRef.current) {
        barDisplaySeriesRef.current = chart.addSeries(BarSeries, {
          downColor: "rgba(239,68,68,0.72)",
          lastValueVisible: false,
          priceLineVisible: false,
          thinBars: true,
          upColor: "rgba(45,212,191,0.74)",
        });
      }
      barDisplaySeriesRef.current.setData(candles.map(toBarSeriesPoint));
    }

    if (chartSeriesStyle === "line") {
      if (!lineDisplaySeriesRef.current) {
        lineDisplaySeriesRef.current = chart.addSeries(LineSeries, {
          color: "rgba(103,232,249,0.78)",
          lastValueVisible: false,
          lineWidth: 2,
          priceLineVisible: false,
        });
      }
      lineDisplaySeriesRef.current.setData(
        candles.map(toCloseValueSeriesPoint),
      );
    }

    if (chartSeriesStyle === "area") {
      if (!areaDisplaySeriesRef.current) {
        areaDisplaySeriesRef.current = chart.addSeries(AreaSeries, {
          bottomColor: "rgba(14,165,233,0.02)",
          lastValueVisible: false,
          lineColor: "rgba(103,232,249,0.78)",
          lineWidth: 2,
          priceLineVisible: false,
          topColor: "rgba(34,211,238,0.16)",
        });
      }
      areaDisplaySeriesRef.current.setData(
        candles.map(toCloseValueSeriesPoint),
      );
    }

    if (chartSeriesStyle === "baseline") {
      if (!baselineDisplaySeriesRef.current) {
        baselineDisplaySeriesRef.current = chart.addSeries(BaselineSeries, {
          baseLineColor: "rgba(255,255,255,0.18)",
          bottomFillColor1: "rgba(239,68,68,0.14)",
          bottomFillColor2: "rgba(239,68,68,0.02)",
          bottomLineColor: "rgba(239,68,68,0.72)",
          lastValueVisible: false,
          lineWidth: 2,
          priceLineVisible: false,
          topFillColor1: "rgba(34,197,94,0.14)",
          topFillColor2: "rgba(34,197,94,0.02)",
          topLineColor: "rgba(34,197,94,0.72)",
        });
      }
      baselineDisplaySeriesRef.current.setData(
        candles.map(toCloseValueSeriesPoint),
      );
    }
  }

  function syncChartPriceScaleUtilities() {
    const chart = chartRef.current;
    const primarySeries = seriesRef.current;

    if (!chart || !primarySeries) {
      return;
    }

    const scaleOptions = {
      autoScale: chartAutoScaleEnabled,
      mode: CHART_PRICE_SCALE_MODE_MAP[chartPriceScaleMode],
    };

    chart.priceScale("right").applyOptions(scaleOptions);
    primarySeries.priceScale().applyOptions(scaleOptions);
    primarySeries.priceScale().setAutoScale(chartAutoScaleEnabled);
  }

  function syncChartSettings() {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    chart.applyOptions({
      crosshair: {
        mode: CrosshairMode.Normal,
        horzLine: {
          color: PORTAL_CROSSHAIR_LINE_COLOR,
          labelBackgroundColor: "#0b111b",
          labelVisible: false,
          style: LineStyle.Dashed,
          visible: false,
          width: 1,
        },
        vertLine: {
          color: PORTAL_CROSSHAIR_LINE_COLOR,
          labelBackgroundColor: "#0b111b",
          labelVisible: false,
          style: LineStyle.Dashed,
          visible: false,
          width: 1,
        },
      },
      grid: {
        horzLines: {
          color: "rgba(103,232,249,0.055)",
          visible: chartSettings.grid,
        },
        vertLines: {
          color: "rgba(103,232,249,0.045)",
          visible: chartSettings.grid,
        },
      },
      rightPriceScale: {
        visible: chartSettings.priceAxis,
      },
    });
  }

  function refitChartScale() {
    const chart = chartRef.current;
    const primarySeries = seriesRef.current;

    if (!chart || !primarySeries) {
      return;
    }

    setChartAutoScaleEnabled(true);
    chart.priceScale("right").setAutoScale(true);
    primarySeries.priceScale().setAutoScale(true);
    chart.timeScale().fitContent();
  }

  function updateSeriesWithCandles(candles: PriceCandle[]) {
    candlesRef.current = candles;
    setChartDataRevision((revision) => revision + 1);
    const chartData = buildCandlestickSeriesData(candles);
    seriesRef.current?.setData(chartData);
    syncChartSeriesStyle(candles);
    syncVolumePane(candles);
    syncIndicatorStudies(candles);
    syncMarketContextPanes();
    syncChartDrawingPrimitive();
    setLatestReadoutCandle(candles[candles.length - 1] ?? null);

    if (candles.length > 0) {
      lastGoodChartCandles.set(
        getChartCandleCacheKey(symbol, timeframe),
        candles,
      );
    }

    const viewportKey = getChartCandleCacheKey(symbol, timeframe);

    if (
      chartRef.current &&
      seriesRef.current &&
      candles.length > 0 &&
      lastDefaultViewportKeyRef.current !== viewportKey
    ) {
      seriesRef.current.priceScale().setAutoScale(true);
      chartRef.current.priceScale("right").setAutoScale(true);
      const rightOffsetBars = getFutureWorkspaceBars();
      chartRef.current
        .timeScale()
        .applyOptions({ rightOffset: rightOffsetBars });

      const defaultVisibleRange = getDefaultChartVisibleLogicalRange(
        candles.length,
        { rightOffsetBars },
      );

      if (defaultVisibleRange) {
        chartRef.current
          .timeScale()
          .setVisibleLogicalRange(defaultVisibleRange);
        lastDefaultViewportKeyRef.current = viewportKey;
      }
    }
  }

  function updateSeriesWithLivePrice(livePrice: number) {
    if (!Number.isFinite(livePrice)) {
      return;
    }

    if (candlesRef.current.length === 0) {
      const currentMinuteTime = Math.floor(Date.now() / 60_000) * 60;
      updateSeriesWithCandles([
        {
          close: livePrice,
          high: livePrice,
          low: livePrice,
          open: livePrice,
          time: currentMinuteTime,
        },
      ]);
    }

    setCurrentPrice(livePrice);
    onCurrentPriceChangeRef.current(livePrice);
  }

  function toRelativePoint(event: { clientX: number; clientY: number }) {
    if (!containerRef.current) {
      return null;
    }

    const rect = containerRef.current.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function updatePortalCrosshairGuide(clientX: number, clientY: number) {
    if (!chartSettingsRef.current.crosshair || !containerRef.current) {
      setPortalCrosshairGuidePoint(null);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const point = {
      height: rect.height,
      width: rect.width,
      x: clientX - rect.left,
      y: clientY - rect.top,
    };

    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x > rect.width ||
      point.y > rect.height
    ) {
      setPortalCrosshairGuidePoint(null);
      return;
    }

    setPortalCrosshairGuidePoint(point);
  }

  function clampRelativePointToChart(point: { x: number; y: number }) {
    if (!containerRef.current) {
      return point;
    }

    const rect = containerRef.current.getBoundingClientRect();

    return {
      x: Math.min(Math.max(point.x, 0), rect.width),
      y: Math.min(Math.max(point.y, 0), rect.height),
    };
  }

  function isRightPriceAxisRelativeX(x: number) {
    const containerWidth =
      containerRef.current?.getBoundingClientRect().width ?? 0;
    const priceScaleWidth = chartRef.current?.priceScale("right").width() ?? 0;

    return isChartRightPriceAxisPoint({
      containerWidth,
      priceScaleWidth,
      x,
    });
  }

  function isRightPriceAxisClientX(clientX: number) {
    const point = toRelativePoint({ clientX, clientY: 0 });

    return point ? isRightPriceAxisRelativeX(point.x) : false;
  }

  function priceFromClientY(clientY: number) {
    const point = toRelativePoint({ clientX: 0, clientY });

    if (!point) {
      return null;
    }

    return priceFromRelativeY(point.y);
  }

  function getMagicTradePickCandidate(clientX: number, clientY: number) {
    if (!containerRef.current) {
      return null;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const point = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    const isInsidePlotArea =
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <=
        Math.max(0, rect.width - MAGIC_TRADE_PICK_PRICE_AXIS_GUTTER_PX) &&
      point.y <=
        Math.max(0, rect.height - MAGIC_TRADE_PICK_TIME_AXIS_GUTTER_PX);

    if (!isInsidePlotArea) {
      return null;
    }

    const price = priceFromRelativeY(point.y);

    if (price === null || !Number.isFinite(price)) {
      return null;
    }

    return {
      point,
      price,
    };
  }

  function priceFromRelativeY(y: number) {
    if (!seriesRef.current || !containerRef.current) {
      return null;
    }

    const clampedY = clampRelativePointToChart({ x: 0, y }).y;

    const price = seriesRef.current.coordinateToPrice(clampedY);

    if (price === null || Number.isNaN(price)) {
      return null;
    }

    return price;
  }

  function timeFromClientX(clientX: number) {
    const point = toRelativePoint({ clientX, clientY: 0 });

    if (!point) {
      return null;
    }

    return timeFromRelativeX(point.x);
  }

  function getFutureWorkspaceBars() {
    return getDefaultChartRightOffsetBars(timeframe);
  }

  function getChartTimeScaleAnchors(
    candles: PriceCandle[] = candlesRef.current,
  ) {
    const rightOffsetBars = getFutureWorkspaceBars();

    return [
      ...candles.map((candle) => ({ time: candle.time })),
      ...buildChartFutureWhitespaceTimes({
        candles,
        rightOffsetBars,
        timeframe,
      }).map((time) => ({ time })),
    ];
  }

  function buildCandlestickSeriesData(
    candles: PriceCandle[],
  ): Array<CandlestickData<Time> | WhitespaceData<Time>> {
    return [
      ...candles.map(toCandlestickPoint),
      ...getChartTimeScaleAnchors(candles)
        .slice(candles.length)
        .map((anchor) => toFutureWhitespacePoint(anchor.time)),
    ];
  }

  function timeFromRelativeX(x: number) {
    if (!chartRef.current || !containerRef.current) {
      return null;
    }

    const clampedX = clampRelativePointToChart({ x, y: 0 }).x;

    const timeScale = chartRef.current.timeScale();
    const logicalIndex = resolveLogicalIndexFromRelativeX(clampedX);

    if (logicalIndex !== null) {
      const logicalTime = resolveChartTimeForLogicalIndex(
        getChartTimeScaleAnchors(),
        logicalIndex,
      );

      if (logicalTime !== null) {
        return logicalTime;
      }
    }

    const time = timeScale.coordinateToTime(clampedX);

    if (typeof time === "number" && Number.isFinite(time)) {
      return Math.round(time);
    }

    const visibleRange = timeScale.getVisibleRange();
    const containerWidth = containerRef.current.getBoundingClientRect().width;

    if (
      !visibleRange ||
      typeof visibleRange.from !== "number" ||
      typeof visibleRange.to !== "number" ||
      !Number.isFinite(containerWidth) ||
      containerWidth <= 0
    ) {
      return null;
    }

    const progress = clampedX / containerWidth;
    const fallbackTime =
      visibleRange.from + (visibleRange.to - visibleRange.from) * progress;

    if (!Number.isFinite(fallbackTime)) {
      return null;
    }

    return Math.round(fallbackTime);
  }

  function resolveLogicalIndexFromRelativeX(x: number) {
    if (!chartRef.current) {
      return null;
    }

    const timeScale = chartRef.current.timeScale();
    const directLogical = timeScale.coordinateToLogical(x);

    if (typeof directLogical === "number" && Number.isFinite(directLogical)) {
      return directLogical;
    }

    const candles = getChartTimeScaleAnchors();

    if (candles.length < 2) {
      return null;
    }

    const lastIndex = candles.length - 1;
    const lastX = timeScale.logicalToCoordinate(lastIndex as Logical);
    const previousX = timeScale.logicalToCoordinate((lastIndex - 1) as Logical);

    if (
      lastX === null ||
      previousX === null ||
      !Number.isFinite(lastX) ||
      !Number.isFinite(previousX)
    ) {
      return null;
    }

    const barSpacing = lastX - previousX;

    if (!Number.isFinite(barSpacing) || barSpacing <= 0) {
      return null;
    }

    return lastIndex + (x - lastX) / barSpacing;
  }

  function getChartDrawingPaneHeight() {
    return containerRef.current?.clientHeight ?? 0;
  }

  function getDraftDrawingPrimitiveLine(): ChartDrawingPrimitiveDraftLine | null {
    if (!draftTrendLineRef.current) {
      return null;
    }

    return {
      ...draftTrendLineRef.current,
      id: "draft-trend-line",
      source: getChartDrawingCreateSource(activeDrawingToolRef.current),
      symbol: symbolRef.current,
    };
  }

  function buildCurrentChartDrawingRenderItems(
    lines: readonly ChartTrendLine[] = chartLayerVisibilityRef.current.drawings
      ? trendLinesRef.current
      : [],
    draftLine: ChartDrawingPrimitiveDraftLine | null = null,
  ): ChartDrawingRenderItem[] {
    if (!chartRef.current || !seriesRef.current) {
      return [];
    }

    const timeScale = chartRef.current.timeScale();

    return buildChartDrawingRenderItems({
      candles: getChartTimeScaleAnchors(),
      draftLine,
      hoveredLineId: hoveredTrendLineIdRef.current,
      lines,
      paneHeight: getChartDrawingPaneHeight(),
      priceToCoordinate: (price) => {
        const coordinate = seriesRef.current?.priceToCoordinate(price);

        return coordinate !== null &&
          coordinate !== undefined &&
          Number.isFinite(coordinate)
          ? coordinate
          : null;
      },
      selectedLineId:
        selectedObjectRef.current?.type === "trend-line"
          ? selectedObjectRef.current.id
          : null,
      symbol: symbolRef.current,
      timeToCoordinate: (time) =>
        resolveChartDrawingXCoordinate(
          getChartTimeScaleAnchors(),
          time,
          timeScale,
        ),
    });
  }

  function syncChartDrawingPrimitive() {
    chartDrawingPrimitiveRef.current?.setDrawings({
      candles: getChartTimeScaleAnchors(),
      draftLine: getDraftDrawingPrimitiveLine(),
      hoveredLineId: hoveredTrendLineIdRef.current,
      lines: chartLayerVisibilityRef.current.drawings
        ? trendLinesRef.current
        : [],
      paneHeight: getChartDrawingPaneHeight(),
      selectedLineId:
        selectedObjectRef.current?.type === "trend-line"
          ? selectedObjectRef.current.id
          : null,
      symbol: symbolRef.current,
    });
  }

  function getTrendLineScreenGeometry(trendLine: ChartTrendLine) {
    const [item] = buildCurrentChartDrawingRenderItems([trendLine]);

    return item
      ? {
          endX: item.endX,
          endY: item.endY,
          startX: item.startX,
          startY: item.startY,
        }
      : null;
  }

  function findTrendLineHitAtPoint(point: { x: number; y: number }) {
    if (!chartLayerVisibilityRef.current.drawings) {
      return null;
    }

    const hit = findChartDrawingHit(
      buildCurrentChartDrawingRenderItems(),
      point,
    );

    return hit
      ? {
          line: hit.line,
          mode: hit.mode,
        }
      : null;
  }

  function findZoneAtYCoordinate(y: number) {
    if (!seriesRef.current) {
      return null;
    }

    return (
      zonesRef.current.find((zone) => {
        const upperCoordinate = seriesRef.current?.priceToCoordinate(
          zone.topPrice,
        );
        const lowerCoordinate = seriesRef.current?.priceToCoordinate(
          zone.bottomPrice,
        );

        if (
          upperCoordinate === null ||
          upperCoordinate === undefined ||
          lowerCoordinate === null ||
          lowerCoordinate === undefined
        ) {
          return false;
        }

        const top = Math.min(upperCoordinate, lowerCoordinate);
        const bottom = Math.max(upperCoordinate, lowerCoordinate);

        return y >= top && y <= bottom;
      }) ?? null
    );
  }

  function getZoneInteractionAtYCoordinate(y: number) {
    if (!seriesRef.current) {
      return null;
    }

    const edgeThreshold = 18;

    for (const zone of zonesRef.current) {
      const upperCoordinate = seriesRef.current.priceToCoordinate(
        zone.topPrice,
      );
      const lowerCoordinate = seriesRef.current.priceToCoordinate(
        zone.bottomPrice,
      );

      if (
        upperCoordinate === null ||
        upperCoordinate === undefined ||
        lowerCoordinate === null ||
        lowerCoordinate === undefined
      ) {
        continue;
      }

      const top = Math.min(upperCoordinate, lowerCoordinate);
      const bottom = Math.max(upperCoordinate, lowerCoordinate);
      const zoneHeight = bottom - top;
      const resizeBand = Math.min(
        edgeThreshold,
        Math.max(10, zoneHeight * 0.28),
      );
      const moveTop = top + resizeBand;
      const moveBottom = bottom - resizeBand;

      if (Math.abs(y - top) <= resizeBand) {
        return {
          bottomY: bottom,
          mode: "resize-top" as const,
          topY: top,
          zone,
        };
      }

      if (Math.abs(y - bottom) <= resizeBand) {
        return {
          bottomY: bottom,
          mode: "resize-bottom" as const,
          topY: top,
          zone,
        };
      }

      if (y >= moveTop && y <= moveBottom) {
        return {
          bottomY: bottom,
          mode: "move" as const,
          topY: top,
          zone,
        };
      }
    }

    return null;
  }

  function findTradePlanLevelAtYCoordinate(
    y: number,
    tradePlan: ChartTradePlan | null,
  ): TradePlanLevel | null {
    if (!seriesRef.current || !tradePlan) {
      return null;
    }

    const threshold = 8;
    const levelCoordinates: Array<[TradePlanLevel, number]> = (
      [
        ["entry", tradePlan.entry],
        ["stop", tradePlan.stop],
        ["target", tradePlan.target],
      ] as Array<[TradePlanLevel, number]>
    )
      .map(([level, price]) => {
        const coordinate = seriesRef.current?.priceToCoordinate(price);
        return coordinate === null || coordinate === undefined
          ? null
          : ([level, coordinate] as [TradePlanLevel, number]);
      })
      .filter((item): item is [TradePlanLevel, number] => item !== null);

    for (const [level, coordinate] of levelCoordinates) {
      if (Math.abs(coordinate - y) <= threshold) {
        return level;
      }
    }

    return null;
  }

  function isEntryLineAtYCoordinate(
    y: number,
    entryPrice: number | null,
  ): boolean {
    if (!seriesRef.current || entryPrice === null) {
      return false;
    }

    const coordinate = seriesRef.current.priceToCoordinate(entryPrice);

    if (coordinate === null || coordinate === undefined) {
      return false;
    }

    return Math.abs(coordinate - y) <= 8;
  }

  function normalizeTradePlan(
    tradePlan: ChartTradePlan,
    level: TradePlanLevel,
    nextPrice: number,
  ): ChartTradePlan {
    const minimumGap = Math.max(Math.abs(tradePlan.entry) * 0.0001, 0.5);

    if (level === "entry") {
      return tradePlan;
    }

    if (tradePlan.direction === "long") {
      if (level === "stop") {
        return {
          ...tradePlan,
          stop: Math.min(nextPrice, tradePlan.entry - minimumGap),
        };
      }

      return {
        ...tradePlan,
        target: Math.max(nextPrice, tradePlan.entry + minimumGap),
      };
    }

    if (level === "stop") {
      return {
        ...tradePlan,
        stop: Math.max(nextPrice, tradePlan.entry + minimumGap),
      };
    }

    return {
      ...tradePlan,
      target: Math.min(nextPrice, tradePlan.entry - minimumGap),
    };
  }

  function calculateTradePlanMetrics(
    tradePlan: ChartTradePlan,
  ): TradePlanMetrics {
    const risk = Math.abs(tradePlan.entry - tradePlan.stop);
    const reward = Math.abs(tradePlan.target - tradePlan.entry);
    const rr = risk > 0 ? reward / risk : 0;
    const riskPercent =
      tradePlan.entry !== 0 ? (risk / Math.abs(tradePlan.entry)) * 100 : 0;
    const rewardPercent =
      tradePlan.entry !== 0 ? (reward / Math.abs(tradePlan.entry)) * 100 : 0;

    return { reward, rewardPercent, risk, riskPercent, rr };
  }

  function formatCompactDollar(value: number) {
    return new Intl.NumberFormat("en-US", {
      currency: "USD",
      maximumFractionDigits: value >= 100 ? 0 : 2,
      minimumFractionDigits: 0,
      style: "currency",
    }).format(value);
  }

  function toggleChartLayer(layerKey: ChartLayerKey) {
    setChartLayerVisibility((currentVisibility) => ({
      ...currentVisibility,
      [layerKey]: !currentVisibility[layerKey],
    }));
  }

  function applyChartLayerPreset(presetKey: ChartLayerPresetKey) {
    setChartLayerVisibility(getChartLayerPresetVisibility(presetKey));
  }

  function showAllChartLayers() {
    applyChartLayerPreset("all");
  }

  function applyChartRangePreset(preset: ChartRangePreset) {
    const chart = chartRef.current;
    const candles = candlesRef.current;
    const latestCandle = candles[candles.length - 1];

    if (!chart || !latestCandle) {
      return;
    }

    setActiveRangePreset(preset);
    setChartCalendarOpen(false);

    if (preset === "all") {
      const rightOffsetBars = getFutureWorkspaceBars();
      chart.timeScale().setVisibleLogicalRange({
        from: 0,
        to: candles.length - 1 + rightOffsetBars,
      });
      return;
    }

    const rightOffsetBars = getFutureWorkspaceBars();
    const rangeStart = getChartRangeStart(preset, latestCandle.time, candles);
    const firstCandleTime = candles[0]?.time ?? rangeStart;
    const visibleFrom = Math.max(firstCandleTime, rangeStart);
    const visibleFromLogical =
      resolveChartLogicalIndexForTime(candles, visibleFrom) ?? 0;

    chart.timeScale().setVisibleLogicalRange({
      from: visibleFromLogical,
      to: candles.length - 1 + rightOffsetBars,
    });
  }

  function handleNativeChartSnapshotExport() {
    const chart = chartRef.current;

    if (!chart) {
      setSnapshotExportStatus("unavailable");
      return;
    }

    try {
      const screenshotCanvas = chart.takeScreenshot(true, true);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      link.href = screenshotCanvas.toDataURL("image/png");
      link.download = `portal-${symbol.toLowerCase()}-${timeframe}-${timestamp}.png`;
      link.click();
      setSnapshotExportStatus("saved");
      window.setTimeout(() => setSnapshotExportStatus("idle"), 2400);
    } catch (error) {
      console.warn("[portal] unable to export native chart snapshot", error);
      setSnapshotExportStatus("error");
    }
  }

  function getTradePlanChipTone(rr: number): TradePlanChipTone {
    if (rr < 1) {
      return {
        borderClass: "border-red-300/10",
        labelClass: "text-red-100/45",
        metricClass: "text-red-50/78",
        surfaceClass:
          "bg-[linear-gradient(180deg,rgba(24,13,16,0.9),rgba(11,17,27,0.88))]",
      };
    }

    if (rr < 2) {
      return {
        borderClass: "border-white/10",
        labelClass: "text-white/45",
        metricClass: "text-white/88",
        surfaceClass: "bg-[#0b111b]/88",
      };
    }

    if (rr < 3) {
      return {
        borderClass: "border-slate-200/12",
        labelClass: "text-slate-100/48",
        metricClass: "text-slate-50/92",
        surfaceClass:
          "bg-[linear-gradient(180deg,rgba(13,20,31,0.9),rgba(11,17,27,0.88))]",
      };
    }

    return {
      borderClass: "border-emerald-300/12",
      labelClass: "text-emerald-100/50",
      metricClass: "text-emerald-50/90",
      surfaceClass:
        "bg-[linear-gradient(180deg,rgba(10,24,22,0.9),rgba(11,17,27,0.88))]",
    };
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      defaultVisiblePriceScaleId: "right",
      hoveredSeriesOnTop: true,
      layout: {
        attributionLogo: true,
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(198, 210, 234, 0.34)",
      },
      grid: {
        horzLines: { visible: false },
        vertLines: { visible: false },
      },
      rightPriceScale: {
        borderVisible: false,
        ensureEdgeTickMarksVisible: true,
        scaleMargins: {
          bottom: 0.14,
          top: 0.12,
        },
        tickMarkDensity: 3,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        barSpacing: 2.8,
        borderVisible: false,
        conflationThresholdFactor: 1,
        enableConflation: true,
        fixRightEdge: false,
        minBarSpacing: 1.4,
        precomputeConflationOnInit: false,
        precomputeConflationPriority: "background",
        rightBarStaysOnScroll: true,
        rightOffset: getFutureWorkspaceBars(),
        secondsVisible: false,
        shiftVisibleRangeOnNewBar: true,
        timeVisible: true,
      },
      crosshair: {
        doNotSnapToHiddenSeriesIndices: true,
        mode: CrosshairMode.Normal,
        horzLine: {
          color: PORTAL_CROSSHAIR_LINE_COLOR,
          labelBackgroundColor: "#0b111b",
          labelVisible: false,
          style: LineStyle.Dashed,
          visible: false,
          width: 1,
        },
        vertLine: {
          color: PORTAL_CROSSHAIR_LINE_COLOR,
          labelBackgroundColor: "#0b111b",
          labelVisible: false,
          style: LineStyle.Dashed,
          visible: false,
          width: 1,
        },
      },
      localization: {
        locale: "en-US",
      },
    });

    const candlestickSeries = chart.addSeries(
      CandlestickSeries,
      PRIMARY_CANDLESTICK_OPTIONS,
    );
    const zonesPrimitive = new ChartZonesPrimitive();
    const tradePlanPrimitive = new ChartTradePlanPrimitive();
    const chartDrawingPrimitive = new ChartDrawingPrimitive();
    const magicTradeOverlayPrimitive = new ChartMagicTradeOverlayPrimitive();
    const executionLineMarkerPrimitive =
      new ChartExecutionLineMarkerPrimitive();
    const pendingOrderChipPrimitive = new ChartPendingOrderChipPrimitive();

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    zonePrimitiveRef.current = zonesPrimitive;
    tradePlanPrimitiveRef.current = tradePlanPrimitive;
    chartDrawingPrimitiveRef.current = chartDrawingPrimitive;
    magicTradeOverlayPrimitiveRef.current = magicTradeOverlayPrimitive;
    executionLineMarkerPrimitiveRef.current = executionLineMarkerPrimitive;
    pendingOrderChipPrimitiveRef.current = pendingOrderChipPrimitive;
    candlestickSeries.attachPrimitive(zonesPrimitive);
    candlestickSeries.attachPrimitive(tradePlanPrimitive);
    candlestickSeries.attachPrimitive(chartDrawingPrimitive);
    candlestickSeries.attachPrimitive(magicTradeOverlayPrimitive);
    candlestickSeries.attachPrimitive(executionLineMarkerPrimitive);
    candlestickSeries.attachPrimitive(pendingOrderChipPrimitive);
    zonesPrimitive.setZones(zones);
    syncChartDrawingPrimitive();

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      if (!chartSettingsRef.current.crosshair) {
        setCrosshairReadoutCandle(null);
        return;
      }

      if (!param.time || !seriesRef.current) {
        setCrosshairReadoutCandle(null);
        return;
      }

      const seriesData = param.seriesData.get(seriesRef.current);
      const normalizedTime =
        typeof param.time === "number" && Number.isFinite(param.time)
          ? Math.round(param.time)
          : null;

      if (isOhlcData(seriesData)) {
        setCrosshairReadoutCandle({
          close: seriesData.close,
          high: seriesData.high,
          low: seriesData.low,
          open: seriesData.open,
          time: normalizedTime ?? candlesRef.current.at(-1)?.time ?? 0,
        });
        return;
      }

      if (normalizedTime !== null) {
        setCrosshairReadoutCandle(
          candlesRef.current.find((candle) => candle.time === normalizedTime) ??
            null,
        );
        return;
      }

      setCrosshairReadoutCandle(null);
    };
    const handleVisibleLogicalRangeChange = () => {
      setChartDataRevision((revision) => revision + 1);
    };

    const handleChartClick = (param: { point?: { x: number; y: number } }) => {
      if (suppressNextChartClickRef.current) {
        suppressNextChartClickRef.current = false;
        return;
      }

      if (
        activeZoneModeRef.current ||
        activeTrendLineModeRef.current ||
        isDraggingZoneRef.current ||
        trendLineEditModeRef.current
      ) {
        return;
      }

      if (!param.point || !seriesRef.current) {
        return;
      }

      if (isRightPriceAxisRelativeX(param.point.x)) {
        return;
      }

      const clickedPrice = seriesRef.current.coordinateToPrice(param.point.y);

      if (clickedPrice === null || Number.isNaN(clickedPrice)) {
        return;
      }

      if (magicTradeLevelPickActiveRef.current) {
        return;
      }

      if (limitPlacementActiveRef.current) {
        onPriceSelectRef.current(clickedPrice);
        return;
      }

      if (activeTradePlanModeRef.current) {
        const position = activePositionRef.current;

        if (!position) {
          draftTradePlanRef.current = null;
          onDraftTradePlanChangeRef.current(null);
          setTradePlanPlacementWarning(null);
          setTradePlanStep(null);
          return;
        }

        if (activeTradePlanModeRef.current === "stop") {
          const placementError = getTradePlanPlacementError({
            direction: position.direction,
            entry: position.entry,
            level: "stop",
            price: clickedPrice,
          });

          if (placementError) {
            setTradePlanPlacementWarning(placementError);
            return;
          }

          const nextDraftTradePlan = {
            ...draftTradePlanRef.current,
            entry: position.entry,
            stop: clickedPrice,
            symbol: symbolRef.current as HyperliquidSymbol,
          };

          draftTradePlanRef.current = nextDraftTradePlan;
          onDraftTradePlanChangeRef.current(nextDraftTradePlan);
          setTradePlanPlacementWarning(null);
          setTradePlanStep("target");
          return;
        }

        const entry = draftTradePlanRef.current?.entry;
        const stop = draftTradePlanRef.current?.stop;

        if (entry === undefined || stop === undefined) {
          draftTradePlanRef.current = null;
          onDraftTradePlanChangeRef.current(null);
          setTradePlanPlacementWarning(null);
          setTradePlanStep(null);
          return;
        }

        const target = clickedPrice;
        const placementError = getTradePlanPlacementError({
          direction: position.direction,
          entry,
          level: "target",
          price: target,
        });

        if (placementError) {
          setTradePlanPlacementWarning(placementError);
          return;
        }

        const finalizedTradePlan: ChartTradePlan = {
          createdAt: new Date().toISOString(),
          direction: position.direction,
          entry,
          id: `${symbolRef.current}-trade-plan-${Date.now()}`,
          positionSize: position.size,
          riskAmount: 100,
          stop,
          symbol: symbolRef.current as HyperliquidSymbol,
          target,
        };

        draftTradePlanRef.current = null;
        onDraftTradePlanChangeRef.current(null);
        onTradePlanCreateRef.current(finalizedTradePlan);
        setTradePlanPlacementWarning(null);
        setTradePlanStep(null);
        return;
      }

      const clickedY = param.point.y;
      const selectedTrendLineHit = findTrendLineHitAtPoint({
        x: param.point.x,
        y: clickedY,
      });

      if (selectedTrendLineHit) {
        onSelectObjectRef.current({
          id: selectedTrendLineHit.line.id,
          type: "trend-line",
        });
        return;
      }

      const selectedTradePlanLevel = findTradePlanLevelAtYCoordinate(
        clickedY,
        activeTradePlanRef.current,
      );

      if (activeTradePlanRef.current && selectedTradePlanLevel) {
        onSelectObjectRef.current({
          id: activeTradePlanRef.current.id,
          type: "trade-plan",
        });
        return;
      }

      const selectionThreshold = 8;
      const currentPendingOrder = findPendingOrderAtYCoordinate(
        pendingLimitOrdersRef.current,
        zonesRef.current,
        symbolRef.current,
        seriesRef.current?.priceToCoordinate.bind(seriesRef.current),
        clickedY,
        pendingOrderPreviewPriceRef.current,
        dragStartPendingOrderRef.current?.id ?? null,
        activeZoneInteractionZoneId,
        selectionThreshold,
      );

      if (currentPendingOrder) {
        onSelectObjectRef.current({
          id: currentPendingOrder.id,
          type: "pending-order",
        });
        return;
      }

      const selectedMagicTradeOverlay = findMagicTradeOverlayAtYCoordinate(
        magicTradeOverlaysRef.current,
        seriesRef.current?.priceToCoordinate.bind(seriesRef.current),
        clickedY,
        selectionThreshold,
      );

      if (selectedMagicTradeOverlay) {
        setSelectedMagicTradeOverlayId(null);
        setHoveredMagicTradeOverlayId(selectedMagicTradeOverlay.id);
        setMagicTradeTooltipPoint({
          x: Math.max(
            16,
            Math.min(
              Math.max(param.point.x + 14, 16),
              (containerRef.current?.clientWidth ?? 430) - 370,
            ),
          ),
          y: Math.max(
            16,
            Math.min(
              Math.max(clickedY - 28, 16),
              (containerRef.current?.clientHeight ?? 320) - 245,
            ),
          ),
        });
        onClearSelectionRef.current();
        return;
      }

      if (selectedMagicTradeOverlayId || hoveredMagicTradeOverlayId) {
        setSelectedMagicTradeOverlayId(null);
        setHoveredMagicTradeOverlayId(null);
        setMagicTradeTooltipPoint(null);
      }

      const selectedLevel = chartLayerVisibilityRef.current.levels
        ? findLevelAtYCoordinate(
            levelsRef.current,
            symbolRef.current,
            seriesRef.current?.priceToCoordinate.bind(seriesRef.current),
            clickedY,
            selectionThreshold,
          )
        : null;

      if (selectedLevel) {
        onSelectObjectRef.current({
          id: selectedLevel.id,
          type: "level",
        });
        return;
      }

      const selectedZone = chartLayerVisibilityRef.current.zones
        ? findZoneAtYCoordinate(clickedY)
        : null;

      if (selectedZone) {
        onSelectObjectRef.current({
          id: selectedZone.id,
          type: "zone",
        });
        return;
      }

      if (selectedObjectRef.current) {
        onClearSelectionRef.current();
      }

      onPriceSelectRef.current(clickedPrice);
    };
    chart.subscribeClick(handleChartClick);
    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    return () => {
      chart.unsubscribeClick(handleChartClick);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart
        .timeScale()
        .unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

      if (zonePrimitiveRef.current) {
        candlestickSeries.detachPrimitive(zonePrimitiveRef.current);
        zonePrimitiveRef.current = null;
      }

      if (tradePlanPrimitiveRef.current) {
        candlestickSeries.detachPrimitive(tradePlanPrimitiveRef.current);
        tradePlanPrimitiveRef.current = null;
      }

      if (chartDrawingPrimitiveRef.current) {
        candlestickSeries.detachPrimitive(chartDrawingPrimitiveRef.current);
        chartDrawingPrimitiveRef.current = null;
      }

      if (magicTradeOverlayPrimitiveRef.current) {
        candlestickSeries.detachPrimitive(
          magicTradeOverlayPrimitiveRef.current,
        );
        magicTradeOverlayPrimitiveRef.current = null;
      }

      if (pendingOrderChipPrimitiveRef.current) {
        candlestickSeries.detachPrimitive(pendingOrderChipPrimitiveRef.current);
        pendingOrderChipPrimitiveRef.current = null;
      }

      levelLinesRef.current = [];
      tradePlanLinesRef.current = [];
      magicTradeOverlayLinesRef.current = [];
      livePriceLineRef.current = null;
      pendingLimitOrderLinesRef.current = [];
      volumePaneRef.current = null;
      volumeSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      vwapSeriesRef.current = null;
      rsiPaneRef.current = null;
      rsiSeriesRef.current = null;
      atrPaneRef.current = null;
      atrSeriesRef.current = null;
      macdPaneRef.current = null;
      macdLineSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
      macdHistogramSeriesRef.current = null;
      fundingPaneRef.current = null;
      fundingSeriesRef.current = null;
      openInterestPaneRef.current = null;
      openInterestSeriesRef.current = null;
      barDisplaySeriesRef.current = null;
      lineDisplaySeriesRef.current = null;
      areaDisplaySeriesRef.current = null;
      baselineDisplaySeriesRef.current = null;
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    syncChartSeriesStyle(candlesRef.current);
  }, [chartSeriesStyle]);

  useEffect(() => {
    syncChartPriceScaleUtilities();
  }, [chartAutoScaleEnabled, chartPriceScaleMode]);

  useEffect(() => {
    chartSettingsRef.current = chartSettings;
    syncChartSettings();

    if (!chartSettings.crosshair) {
      setCrosshairReadoutCandle(null);
      setPortalCrosshairGuidePoint(null);
    }
  }, [chartSettings]);

  useEffect(() => {
    setChartUtilityTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    );
    setChartClockNow(Date.now());

    const intervalId = window.setInterval(() => {
      setChartClockNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    activeZoneModeRef.current = zoneModeActive;
  }, [zoneModeActive]);

  useEffect(() => {
    activeTrendLineModeRef.current = trendLineModeActive;
  }, [trendLineModeActive]);

  useEffect(() => {
    activeTradePlanModeRef.current = tradePlanStep;
  }, [tradePlanStep]);

  useEffect(() => {
    limitPlacementActiveRef.current = limitPlacementActive;
  }, [limitPlacementActive]);

  useEffect(() => {
    magicTradeLevelPickActiveRef.current = magicTradeLevelPickActive;
  }, [magicTradeLevelPickActive]);

  useEffect(() => {
    zonePrimitiveRef.current?.setZones(chartLayerVisibility.zones ? zones : []);
  }, [chartLayerVisibility.zones, zones]);

  useEffect(() => {
    tradePlanPrimitiveRef.current?.setTradePlan(
      chartLayerVisibility.tradePlan ? activeTradePlan : null,
    );
  }, [activeTradePlan, chartLayerVisibility.tradePlan]);

  useEffect(() => {
    tradePlanPrimitiveRef.current?.setTradePlanPriceState(tradePlanPriceState);
  }, [tradePlanPriceState]);

  useEffect(() => {
    tradePlanPrimitiveRef.current?.setEntryFocusActive(entryHighlightActive);
  }, [entryHighlightActive]);

  useEffect(() => {
    magicTradeOverlayPrimitiveRef.current?.setOverlays(
      chartLayerVisibility.magicTrade ? magicTradeOverlays : [],
    );
  }, [chartLayerVisibility.magicTrade, magicTradeOverlays]);

  useEffect(() => {
    magicTradeOverlayPrimitiveRef.current?.setSelectedOverlayId(
      selectedMagicTradeOverlayId,
    );
  }, [selectedMagicTradeOverlayId]);

  useEffect(() => {
    magicTradeOverlayPrimitiveRef.current?.setHoveredOverlayId(
      hoveredMagicTradeOverlayId,
    );
  }, [hoveredMagicTradeOverlayId]);

  useEffect(() => {
    zonePrimitiveRef.current?.setSelectedZoneId(
      selectedObject?.type === "zone" ? selectedObject.id : null,
    );
  }, [selectedObject]);

  useEffect(() => {
    if (!seriesRef.current || !chartLayerVisibility.levels) {
      levelLinesRef.current = [];
      return;
    }

    levelLinesRef.current.forEach((line) => {
      seriesRef.current?.removePriceLine(line);
    });

    const triggerByLevelId = new Map(
      lineTriggers
        .filter((trigger) => trigger.targetType === "horizontal-level")
        .map((trigger) => [trigger.targetId, trigger] as const),
    );

    levelLinesRef.current = levels.map((level) => {
      const selected =
        selectedObject?.type === "level" && selectedObject.id === level.id;
      const trigger = triggerByLevelId.get(level.id);
      const triggerPalette = trigger
        ? getLevelTriggerPalette(trigger, selected)
        : null;

      return seriesRef.current!.createPriceLine({
        axisLabelColor:
          triggerPalette?.axisLabelColor ??
          (selected
            ? "rgba(223, 232, 255, 0.18)"
            : "rgba(122, 141, 185, 0.10)"),
        axisLabelTextColor:
          triggerPalette?.axisLabelTextColor ??
          (selected
            ? "rgba(246, 249, 255, 0.90)"
            : "rgba(201, 211, 235, 0.58)"),
        axisLabelVisible: Boolean(trigger) || selected,
        color:
          triggerPalette?.color ??
          (selected
            ? "rgba(232, 239, 255, 0.82)"
            : "rgba(189, 206, 243, 0.24)"),
        lineStyle: 2,
        lineVisible: true,
        lineWidth: trigger
          ? selected || trigger.status === "firing"
            ? 2
            : 1
          : selected
            ? 2
            : 1,
        price: level.price,
        title: triggerPalette?.title ?? "",
      });
    });
  }, [chartLayerVisibility.levels, lineTriggers, levels, selectedObject]);

  useEffect(() => {
    if (magicTradeOverlayLinesRef.current.length > 0 && seriesRef.current) {
      magicTradeOverlayLinesRef.current.forEach((line) => {
        seriesRef.current?.removePriceLine(line);
      });
      magicTradeOverlayLinesRef.current = [];
    }

    if (!seriesRef.current || !chartLayerVisibility.magicTrade) {
      magicTradeOverlayLinesRef.current = [];
      return;
    }

    magicTradeOverlayLinesRef.current = magicTradeOverlays.map((overlay) => {
      const selected =
        selectedMagicTradeOverlayId === overlay.id ||
        hoveredMagicTradeOverlayId === overlay.id;
      const palette = getMagicTradeOverlayPalette(overlay.status, selected);

      return seriesRef.current!.createPriceLine({
        axisLabelColor: palette.axisLabelColor,
        axisLabelTextColor: palette.axisLabelTextColor,
        axisLabelVisible: selected || overlay.status !== "armed",
        color: palette.color,
        lineStyle: 2,
        lineVisible: true,
        lineWidth: palette.lineWidth,
        price: overlay.level,
        title: selected ? overlay.compactLabel : palette.title,
      });
    });
  }, [
    chartLayerVisibility.magicTrade,
    hoveredMagicTradeOverlayId,
    magicTradeOverlays,
    selectedMagicTradeOverlayId,
  ]);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    tradePlanLinesRef.current.forEach((line) => {
      seriesRef.current?.removePriceLine(line);
    });

    const nextTradePlanLines: IPriceLine[] = [];

    const liveEntryPosition = chartLayerVisibility.positions
      ? (activePosition ??
        (livePosition
          ? {
              direction: livePosition.direction,
              entry: livePosition.entryPrice,
            }
          : null))
      : null;
    const effectiveEntryPrice =
      (chartLayerVisibility.tradePlan ? activeTradePlan?.entry : null) ??
      liveEntryPosition?.entry ??
      null;
    const entryLineSelected = selectedObject?.type === "trade-plan";
    const liveEntryPnlDelta =
      liveEntryPosition && currentPrice !== null
        ? (currentPrice - liveEntryPosition.entry) *
          (liveEntryPosition.direction === "long" ? 1 : -1)
        : 0;
    const entryFlatThreshold =
      liveEntryPosition && Number.isFinite(liveEntryPosition.entry)
        ? Math.max(Math.abs(liveEntryPosition.entry) * 0.00005, 0.25)
        : 0;
    const liveEntryTone =
      !liveEntryPosition || effectiveEntryPrice === null
        ? {
            axisLabelColor: "rgba(122, 141, 185, 0.16)",
            axisLabelTextColor: "rgba(232, 238, 251, 0.88)",
            color: "rgba(198, 209, 234, 0.7)",
          }
        : liveEntryPnlDelta > entryFlatThreshold
          ? {
              axisLabelColor: "rgba(34, 197, 94, 0.28)",
              axisLabelTextColor: "rgba(240, 253, 244, 0.96)",
              color: "rgba(34, 197, 94, 0.86)",
            }
          : liveEntryPnlDelta < -entryFlatThreshold
            ? {
                axisLabelColor: "rgba(239, 68, 68, 0.26)",
                axisLabelTextColor: "rgba(254, 242, 242, 0.96)",
                color: "rgba(239, 68, 68, 0.88)",
              }
            : {
                axisLabelColor: "rgba(112, 127, 156, 0.2)",
                axisLabelTextColor: "rgba(236, 241, 250, 0.92)",
                color: "rgba(196, 207, 228, 0.76)",
              };

    if (effectiveEntryPrice !== null) {
      nextTradePlanLines.push(
        seriesRef.current.createPriceLine({
          axisLabelColor: entryLineSelected
            ? "rgba(236, 242, 255, 0.34)"
            : liveEntryTone.axisLabelColor,
          axisLabelTextColor: entryLineSelected
            ? "rgba(249, 251, 255, 0.98)"
            : liveEntryTone.axisLabelTextColor,
          axisLabelVisible: entryLineSelected || Boolean(liveEntryPosition),
          color: entryLineSelected
            ? "rgba(246, 250, 255, 0.94)"
            : liveEntryTone.color,
          lineStyle: 2,
          lineVisible: true,
          lineWidth: entryLineSelected ? 2 : 1,
          price: effectiveEntryPrice,
          title: "",
        }),
      );
    }

    if (chartLayerVisibility.tradePlan && draftTradePlan?.stop !== undefined) {
      nextTradePlanLines.push(
        seriesRef.current.createPriceLine({
          axisLabelColor: "rgba(143, 64, 72, 0.2)",
          axisLabelTextColor: "rgba(246, 222, 225, 0.9)",
          axisLabelVisible: true,
          color: "rgba(212, 104, 116, 0.86)",
          lineStyle: 0,
          lineVisible: true,
          lineWidth: 1,
          price: draftTradePlan.stop,
          title: "",
        }),
      );
    }

    if (
      chartLayerVisibility.tradePlan &&
      draftTradePlan?.target !== undefined
    ) {
      nextTradePlanLines.push(
        seriesRef.current.createPriceLine({
          axisLabelColor: "rgba(34, 211, 238, 0.18)",
          axisLabelTextColor: "rgba(207, 250, 254, 0.86)",
          axisLabelVisible: true,
          color: "rgba(103, 232, 249, 0.74)",
          lineStyle: 0,
          lineVisible: true,
          lineWidth: 1,
          price: draftTradePlan.target,
          title: "",
        }),
      );
    }

    if (chartLayerVisibility.tradePlan && activeTradePlan) {
      const targetAchievedActive = tradePlanPriceState === "beyond-target";

      nextTradePlanLines.push(
        seriesRef.current.createPriceLine({
          axisLabelColor:
            selectedObject?.type === "trade-plan"
              ? "rgba(162, 78, 88, 0.24)"
              : "rgba(143, 64, 72, 0.2)",
          axisLabelTextColor:
            selectedObject?.type === "trade-plan"
              ? "rgba(251, 232, 235, 0.95)"
              : "rgba(246, 222, 225, 0.9)",
          axisLabelVisible: true,
          color:
            selectedObject?.type === "trade-plan" ||
            hoveredTradePlanLevel === "stop" ||
            draggingTradePlanLevelRef.current === "stop"
              ? "rgba(228, 121, 133, 0.96)"
              : "rgba(212, 104, 116, 0.86)",
          lineStyle: 0,
          lineVisible: true,
          lineWidth:
            selectedObject?.type === "trade-plan" ||
            hoveredTradePlanLevel === "stop" ||
            draggingTradePlanLevelRef.current === "stop"
              ? 2
              : 1,
          price: activeTradePlan.stop,
          title: "",
        }),
      );

      nextTradePlanLines.push(
        seriesRef.current.createPriceLine({
          axisLabelColor:
            selectedObject?.type === "trade-plan"
              ? "rgba(34, 211, 238, 0.22)"
              : targetHighlightActive || targetAchievedActive
                ? "rgba(34, 211, 238, 0.30)"
                : "rgba(34, 211, 238, 0.16)",
          axisLabelTextColor:
            selectedObject?.type === "trade-plan"
              ? "rgba(207, 250, 254, 0.94)"
              : targetHighlightActive || targetAchievedActive
                ? "rgba(236, 253, 255, 0.98)"
                : "rgba(207, 250, 254, 0.82)",
          axisLabelVisible:
            selectedObject?.type === "trade-plan" ||
            targetHighlightActive ||
            targetAchievedActive,
          color:
            selectedObject?.type === "trade-plan" ||
            targetHighlightActive ||
            targetAchievedActive ||
            hoveredTradePlanLevel === "target" ||
            draggingTradePlanLevelRef.current === "target"
              ? targetAchievedActive
                ? "rgba(125, 249, 255, 0.96)"
                : "rgba(103, 232, 249, 0.90)"
              : "rgba(34, 211, 238, 0.54)",
          lineStyle: 0,
          lineVisible: true,
          lineWidth:
            selectedObject?.type === "trade-plan" ||
            targetHighlightActive ||
            targetAchievedActive ||
            hoveredTradePlanLevel === "target" ||
            draggingTradePlanLevelRef.current === "target"
              ? 2
              : 1,
          price: activeTradePlan.target,
          title: "",
        }),
      );
    }

    tradePlanLinesRef.current = nextTradePlanLines;
  }, [
    activePosition,
    activeTradePlan,
    chartLayerVisibility.positions,
    chartLayerVisibility.tradePlan,
    currentPrice,
    draftTradePlan,
    entryHighlightActive,
    hoveredTradePlanLevel,
    livePosition,
    selectedObject,
    targetHighlightActive,
    tradePlanPriceState,
  ]);

  useEffect(() => {
    if (
      !seriesRef.current ||
      currentPrice === null ||
      !Number.isFinite(currentPrice)
    ) {
      return;
    }

    if (livePriceLineRef.current) {
      seriesRef.current.removePriceLine(livePriceLineRef.current);
    }

    livePriceLineRef.current = seriesRef.current.createPriceLine({
      axisLabelColor: LIVE_PRICE_MARKER_BACKGROUND,
      axisLabelTextColor: LIVE_PRICE_MARKER_TEXT_COLOR,
      axisLabelVisible: false,
      color: LIVE_PRICE_LINE_COLOR,
      lineStyle: 2,
      lineVisible: true,
      lineWidth: 1,
      price: currentPrice,
      title: "",
    });
  }, [currentPrice]);

  useEffect(() => {
    if (liquidationPriceLineRef.current && seriesRef.current) {
      seriesRef.current.removePriceLine(liquidationPriceLineRef.current);
      liquidationPriceLineRef.current = null;
    }

    if (
      !seriesRef.current ||
      !chartLayerVisibility.positions ||
      !livePosition ||
      livePosition.liquidationPrice === null ||
      !Number.isFinite(livePosition.liquidationPrice)
    ) {
      return;
    }

    liquidationPriceLineRef.current = seriesRef.current.createPriceLine({
      axisLabelColor: "rgba(138, 66, 74, 0.24)",
      axisLabelTextColor: "rgba(251, 230, 233, 0.94)",
      axisLabelVisible: true,
      color: "rgba(210, 104, 118, 0.78)",
      lineStyle: 2,
      lineVisible: true,
      lineWidth: 1,
      price: livePosition.liquidationPrice,
      title: "Liq",
    });
  }, [chartLayerVisibility.positions, livePosition]);

  useEffect(() => {
    if (pendingLimitOrderLinesRef.current.length > 0 && seriesRef.current) {
      pendingLimitOrderLinesRef.current.forEach((line) => {
        seriesRef.current?.removePriceLine(line);
      });
      pendingLimitOrderLinesRef.current = [];
    }

    if (!seriesRef.current || !chartLayerVisibility.orders) {
      pendingLimitOrderLinesRef.current = [];
      return;
    }

    pendingLimitOrderLinesRef.current = pendingLimitOrders
      .filter(
        (pendingOrder) =>
          pendingOrder.symbol === symbol &&
          ["live", "placing", "updating", "canceling"].includes(
            pendingOrder.status,
          ),
      )
      .map((pendingOrder) => {
        const pendingOrderSelected =
          selectedObject?.type === "pending-order" &&
          selectedObject.id === pendingOrder.id;
        const palette = getPendingOrderPalette(
          pendingOrder,
          pendingOrderSelected,
        );
        const effectivePendingOrderPrice =
          pendingOrderPreviewOrderIdRef.current === pendingOrder.id
            ? getEffectivePendingOrderPrice(
                pendingOrder,
                pendingOrderPreviewPrice,
                zones,
                activeZoneInteractionZoneId,
              )
            : getEffectivePendingOrderPrice(
                pendingOrder,
                null,
                zones,
                activeZoneInteractionZoneId,
              );

        if (effectivePendingOrderPrice === null) {
          return null;
        }

        return seriesRef.current!.createPriceLine({
          axisLabelColor: palette.axisLabelColor,
          axisLabelTextColor: palette.axisLabelTextColor,
          axisLabelVisible: true,
          color: palette.color,
          lineStyle: LineStyle.LargeDashed,
          lineVisible: true,
          lineWidth:
            pendingOrderSelected ||
            pendingOrder.status === "updating" ||
            pendingOrder.status === "canceling"
              ? 2
              : 1,
          price: effectivePendingOrderPrice,
          title: "",
        });
      })
      .filter((line): line is IPriceLine => line !== null);
  }, [
    chartLayerVisibility.orders,
    pendingLimitOrders,
    pendingOrderPreviewPrice,
    selectedObject,
    symbol,
    zones,
    activeZoneInteractionZoneId,
  ]);

  useEffect(() => {
    const chipPrimitive = pendingOrderChipPrimitiveRef.current;

    if (!chipPrimitive) {
      return;
    }

    if (!chartLayerVisibility.orders) {
      chipPrimitive.setChips([]);
      return;
    }

    const nextChips = pendingLimitOrders.flatMap<PendingOrderChipModel>(
      (pendingOrder) => {
        if (
          pendingOrder.symbol !== symbol ||
          !["live", "placing", "updating", "canceling"].includes(
            pendingOrder.status,
          )
        ) {
          return [];
        }

        const displayPrice =
          pendingOrderPreviewOrderIdRef.current === pendingOrder.id
            ? getEffectivePendingOrderPrice(
                pendingOrder,
                pendingOrderPreviewPrice,
                zones,
                activeZoneInteractionZoneId,
              )
            : getEffectivePendingOrderPrice(
                pendingOrder,
                null,
                zones,
                activeZoneInteractionZoneId,
              );

        if (displayPrice === null) {
          return [];
        }

        return [
          {
            direction: pendingOrder.direction,
            id: pendingOrder.id,
            label: `Limit ${formatPendingOrderChipPrice(displayPrice)}`,
            price: displayPrice,
            selected:
              selectedObject?.type === "pending-order" &&
              selectedObject.id === pendingOrder.id,
            sizeLabel: formatPendingOrderChipSize(pendingOrder.normalizedSize),
            status: pendingOrder.status as PendingOrderChipModel["status"],
          },
        ];
      },
    );

    chipPrimitive.setChips(nextChips);
  }, [
    activeZoneInteractionZoneId,
    chartLayerVisibility.orders,
    pendingLimitOrders,
    pendingOrderPreviewPrice,
    selectedObject,
    symbol,
    zones,
  ]);

  useEffect(() => {
    const markerPrimitive = executionLineMarkerPrimitiveRef.current;

    if (!markerPrimitive) {
      return;
    }

    const nextMarkers: ChartExecutionLineMarker[] = [];
    if (!chartLayerVisibility.executionMarkers) {
      markerPrimitive.setMarkers(nextMarkers);
      return;
    }

    const liveEntryPosition = chartLayerVisibility.positions
      ? (activePosition ??
        (livePosition
          ? {
              direction: livePosition.direction,
              entry: livePosition.entryPrice,
            }
          : null))
      : null;

    if (
      liveEntryPosition &&
      Number.isFinite(liveEntryPosition.entry) &&
      liveEntryPosition.entry > 0
    ) {
      nextMarkers.push({
        id: "execution-entry",
        label: "Entry",
        price: liveEntryPosition.entry,
        selected: selectedObject?.type === "trade-plan",
        tone: "entry",
      });
    }

    if (chartLayerVisibility.tradePlan && activeTradePlan) {
      nextMarkers.push(
        {
          id: `${activeTradePlan.id}-stop`,
          label: "SL",
          price: activeTradePlan.stop,
          selected: selectedObject?.type === "trade-plan",
          tone: "stop-loss",
        },
        {
          id: `${activeTradePlan.id}-target`,
          label: "TP",
          price: activeTradePlan.target,
          selected: selectedObject?.type === "trade-plan",
          tone: "take-profit",
        },
      );
    }

    if (
      livePosition &&
      chartLayerVisibility.positions &&
      livePosition.liquidationPrice !== null &&
      Number.isFinite(livePosition.liquidationPrice)
    ) {
      nextMarkers.push({
        id: "execution-liquidation",
        label: "Liq",
        price: livePosition.liquidationPrice,
        tone: "liquidation",
      });
    }

    if (showExecutionFillChips) {
      sessionLogEntries
        .filter(
          (entry) =>
            entry.symbol === symbol &&
            entry.direction !== null &&
            entry.price !== null &&
            (entry.eventType === "market-order-placed" ||
              entry.eventType === "pending-order-filled"),
        )
        .slice(0, 80)
        .forEach((entry) => {
          if (entry.price === null || entry.direction === null) {
            return;
          }

          const parsedTime = Date.parse(entry.timestamp);
          const markerTime = resolveNearestCandleTime(
            Math.floor(parsedTime / 1000),
            candlesRef.current,
          );

          if (markerTime === null) {
            return;
          }

          const isBuy = entry.direction === "long";

          nextMarkers.push({
            id: `${entry.id}-fill-chip`,
            label: isBuy ? "B" : "S",
            price: entry.price,
            time: markerTime,
            tone: isBuy ? "buy-fill" : "sell-fill",
          });
        });
    }

    markerPrimitive.setMarkers(nextMarkers);
  }, [
    activePosition,
    activeTradePlan,
    activeZoneInteractionZoneId,
    chartLayerVisibility.executionMarkers,
    chartLayerVisibility.orders,
    chartLayerVisibility.positions,
    chartLayerVisibility.tradePlan,
    chartDataRevision,
    livePosition,
    pendingLimitOrders,
    pendingOrderPreviewPrice,
    selectedObject,
    sessionLogEntries,
    showExecutionFillChips,
    symbol,
    zones,
  ]);

  useEffect(() => {
    if (orderZonePreviewLinesRef.current.length > 0 && seriesRef.current) {
      orderZonePreviewLinesRef.current.forEach((line) => {
        seriesRef.current?.removePriceLine(line);
      });
      orderZonePreviewLinesRef.current = [];
    }

    if (
      !seriesRef.current ||
      !orderZoneDraft ||
      !chartLayerVisibility.orders ||
      !chartLayerVisibility.zones
    ) {
      orderZonePreviewLinesRef.current = [];
      return;
    }

    const activeZone = zones.find(
      (zone) => zone.id === orderZoneDraft.zoneId && zone.symbol === symbol,
    );

    if (!activeZone) {
      return;
    }

    const previewPrices =
      orderZoneDraft.type === "mid-zone"
        ? [(activeZone.topPrice + activeZone.bottomPrice) / 2]
        : getOrderZonePrices(
            activeZone,
            orderZoneDraft.count,
            orderZoneDraft.distribution,
          );
    const previewColor =
      orderZoneDraft.direction === "long"
        ? "rgba(34, 211, 238, 0.38)"
        : "rgba(210, 108, 118, 0.42)";

    orderZonePreviewLinesRef.current = previewPrices.map((price, index) =>
      seriesRef.current!.createPriceLine({
        axisLabelVisible: false,
        color: previewColor,
        lineStyle: 2,
        lineVisible: true,
        lineWidth: 1,
        price,
        title:
          index === 0
            ? orderZoneDraft.type === "mid-zone"
              ? "Mid-Zone Preview"
              : "Zone Preview"
            : "",
      }),
    );
  }, [
    chartLayerVisibility.orders,
    chartLayerVisibility.zones,
    orderZoneDraft,
    symbol,
    zones,
  ]);

  useEffect(() => {
    let cancelled = false;
    let snapshotFailed = false;
    let realtimeFailed = false;
    let snapshotPollIntervalId: number | null = null;
    const hyperliquidCoin = coin;
    const cachedCandles = lastGoodChartCandles.get(
      getChartCandleCacheKey(symbol, timeframe),
    );

    function clearRealtimeResources() {
      if (websocketPingIntervalRef.current !== null) {
        window.clearInterval(websocketPingIntervalRef.current);
        websocketPingIntervalRef.current = null;
      }

      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (snapshotPollIntervalId !== null) {
        window.clearInterval(snapshotPollIntervalId);
        snapshotPollIntervalId = null;
      }

      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
    }

    function applySnapshotCandles(candles: PriceCandle[]) {
      if (cancelled || !seriesRef.current) {
        return;
      }

      snapshotFailed = false;
      updateSeriesWithCandles(candles);

      if (candles.length === 0) {
        lastEmittedClosedCandleTimeRef.current = null;
        setStatus("no-data");
        return;
      }

      lastEmittedClosedCandleTimeRef.current =
        candles.length > 1 ? candles[candles.length - 2].time : null;
      const latestSnapshotClose = candles.at(-1)?.close;

      if (
        typeof latestSnapshotClose === "number" &&
        Number.isFinite(latestSnapshotClose)
      ) {
        setCurrentPrice(latestSnapshotClose);
      }

      setStatus("ready");
    }

    async function loadSnapshot() {
      const candles = await fetchChartSnapshotCandles(symbol, timeframe);

      applySnapshotCandles(candles);
    }

    function connectWebSocket() {
      if (cancelled) {
        return;
      }

      if (!hyperliquidCoin) {
        setStatus("fetch-failed");
        return;
      }

      realtimeFailed = false;
      clearRealtimeResources();

      const websocket = new WebSocket(HYPERLIQUID_TESTNET_WS_URL);
      websocketRef.current = websocket;

      websocket.addEventListener("open", () => {
        websocket.send(
          JSON.stringify({
            method: "subscribe",
            subscription: {
              type: "candle",
              coin: hyperliquidCoin,
              interval: timeframe,
            },
          }),
        );
        websocket.send(
          JSON.stringify({
            method: "subscribe",
            subscription: {
              type: "activeAssetCtx",
              coin: hyperliquidCoin,
            },
          }),
        );

        websocketPingIntervalRef.current = window.setInterval(() => {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ method: "ping" }));
          }
        }, CHART_PING_INTERVAL_MS);
      });

      websocket.addEventListener("message", (event) => {
        let payload: unknown;

        try {
          payload = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (isWsCandleMessage(payload)) {
          const previousLatestCandle = candlesRef.current.at(-1) ?? null;
          const incomingCandles = Array.isArray(payload.data)
            ? payload.data
            : [payload.data];
          const nextCandles = incomingCandles
            .map(normalizePriceCandle)
            .filter((candle): candle is PriceCandle => candle !== null)
            .reduce(
              (currentCandles, candle) => upsertCandle(currentCandles, candle),
              candlesRef.current,
            );

          updateSeriesWithCandles(nextCandles);
          const latestOpenCandle = nextCandles.at(-1) ?? null;

          if (
            previousLatestCandle &&
            latestOpenCandle &&
            latestOpenCandle.time > previousLatestCandle.time
          ) {
            const lastEmittedClosedCandleTime =
              lastEmittedClosedCandleTimeRef.current ?? -Infinity;
            const newlyClosedCandles = nextCandles.filter(
              (candle) =>
                candle.time > lastEmittedClosedCandleTime &&
                candle.time < latestOpenCandle.time,
            );

            for (const closedCandle of newlyClosedCandles) {
              onCandleCloseRef.current(
                closedCandle.close,
                closedCandle.time,
                timeframe,
              );
              lastEmittedClosedCandleTimeRef.current = closedCandle.time;
            }
          }

          const latestLiveClose = nextCandles.at(-1)?.close;

          if (
            typeof latestLiveClose === "number" &&
            Number.isFinite(latestLiveClose)
          ) {
            updateSeriesWithLivePrice(latestLiveClose);
          }

          setStatus("ready");
          return;
        }

        if (isWsActiveAssetCtxMessage(payload)) {
          const livePrice = Number(payload.data.ctx.markPx);
          const openInterestPoint = normalizeOpenInterestSnapshot({
            markPrice: payload.data.ctx.markPx,
            openInterestBase: payload.data.ctx.openInterest,
            time: Date.now(),
          });

          if (Number.isFinite(livePrice)) {
            updateSeriesWithLivePrice(livePrice);
            setStatus("ready");
          }

          if (openInterestPoint) {
            setOpenInterestPoints((currentPoints) =>
              upsertOpenInterestPoint(currentPoints, openInterestPoint),
            );
          }
        }
      });

      websocket.addEventListener("close", () => {
        if (cancelled) {
          return;
        }

        realtimeFailed = true;
        clearRealtimeResources();

        if (snapshotFailed && candlesRef.current.length === 0) {
          setStatus("fetch-failed");
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          void fetchChartSnapshotCandles(symbol, timeframe, { fresh: true })
            .then((candles) => applySnapshotCandles(candles))
            .catch((error) => {
              snapshotFailed = true;
              if (candlesRef.current.length === 0) {
                setStatus(getChartStatusFromSnapshotError(error));
              }
            })
            .finally(() => {
              if (!cancelled) {
                connectWebSocket();
              }
            });
        }, WS_RECONNECT_DELAY_MS);
      });

      websocket.addEventListener("error", () => {
        realtimeFailed = true;
        websocket.close();
      });
    }

    if (cachedCandles?.length && seriesRef.current) {
      updateSeriesWithCandles(cachedCandles);
      lastEmittedClosedCandleTimeRef.current =
        cachedCandles.length > 1
          ? cachedCandles[cachedCandles.length - 2].time
          : null;
      const latestCachedClose = cachedCandles.at(-1)?.close;

      if (
        typeof latestCachedClose === "number" &&
        Number.isFinite(latestCachedClose)
      ) {
        setCurrentPrice(latestCachedClose);
      }

      setStatus("ready");
    } else {
      setStatus("loading");
    }

    if (hyperliquidCoin) {
      connectWebSocket();
    } else {
      snapshotPollIntervalId = window.setInterval(() => {
        void fetchChartSnapshotCandles(symbol, timeframe, { fresh: true })
          .then((candles) => applySnapshotCandles(candles))
          .catch((error) => {
            snapshotFailed = true;
            if (!cancelled && candlesRef.current.length === 0) {
              setStatus(getChartStatusFromSnapshotError(error));
            }
          });
      }, 5_000);
    }
    void loadSnapshot().catch((error) => {
      if (!cancelled) {
        snapshotFailed = true;
        if ((!hyperliquidCoin || realtimeFailed) && candlesRef.current.length === 0) {
          setStatus(getChartStatusFromSnapshotError(error));
        }
      }
    });

    return () => {
      cancelled = true;
      clearRealtimeResources();
    };
  }, [coin, symbol, timeframe]);

  useEffect(() => {
    let cancelled = false;

    setMarketContext(null);
    setOpenInterestPoints([]);

    if (
      !coin ||
      (!chartLayerVisibility.funding && !chartLayerVisibility.openInterest)
    ) {
      setMarketContextStatus("idle");
      return () => {
        cancelled = true;
      };
    }

    setMarketContextStatus("loading");

    void fetchChartMarketContext(symbol)
      .then((context) => {
        if (cancelled) {
          return;
        }

        setMarketContext(context);
        setOpenInterestPoints(
          context.openInterest ? [context.openInterest] : [],
        );
        setMarketContextStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setMarketContextStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chartLayerVisibility.funding, chartLayerVisibility.openInterest, symbol]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setContextMenu(null);
      setZoneModeActive(false);
      clearTrendLineDraft();
      setTradePlanStep(null);
      setTradePlanPlacementWarning(null);
      clearOrderZoneDraft();
      setHoveredTradePlanLevel(null);
      setHoveredTrendLineId(null);
      setHoveredTrendLineHandle(null);
      draftZoneRef.current = null;
      draftTradePlanRef.current = null;
      onDraftTradePlanChangeRef.current(null);
      if (
        trendLineEditActiveLineIdRef.current &&
        trendLineEditStartLineRef.current
      ) {
        onTrendLineChangeRef.current(trendLineEditActiveLineIdRef.current, {
          endPrice: trendLineEditStartLineRef.current.endPrice,
          endTime: trendLineEditStartLineRef.current.endTime,
          startPrice: trendLineEditStartLineRef.current.startPrice,
          startTime: trendLineEditStartLineRef.current.startTime,
        });
      }
      if (trendLineEditActiveLineIdRef.current) {
        onTrendLineEditingChangeRef.current(
          trendLineEditActiveLineIdRef.current,
          false,
        );
      }
      trendLineEditModeRef.current = null;
      trendLineEditActiveLineIdRef.current = null;
      trendLineEditStartLineRef.current = null;
      trendLineEditPointerDownRef.current = null;
      hasStartedTrendLineEditRef.current = false;
      if (draggingTradePlanLevelRef.current && dragStartTradePlanRef.current) {
        onTradePlanChangeRef.current(dragStartTradePlanRef.current);
      }
      isDraggingPendingOrderRef.current = false;
      dragStartPendingOrderRef.current = null;
      pendingOrderPointerDownOrderRef.current = null;
      pendingOrderPointerDownYRef.current = null;
      pendingOrderPreviewOrderIdRef.current = null;
      setActivePendingOrderTooltipTarget(null);
      setPendingOrderPreviewPrice(null);
      zoneEditModeRef.current = null;
      zoneEditPointerDownYRef.current = null;
      zoneEditPriceOffsetRef.current = 0;
      zoneEditStartZoneRef.current = null;
      zoneEditActiveZoneIdRef.current = null;
      hasStartedZoneEditRef.current = false;
      setActiveZoneInteractionMode(null);
      setActiveZoneInteractionZoneId(null);
      setHoveredZoneInteraction(null);
      draggingTradePlanLevelRef.current = null;
      dragStartTradePlanRef.current = null;
      zonePrimitiveRef.current?.setDraftZone(null);
      dragStartPriceRef.current = null;
      isDraggingZoneRef.current = false;
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function handleOutsidePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (wrapperRef.current?.contains(event.target)) {
        return;
      }

      setContextMenu(null);
      clearOrderZoneDraft();
      clearTrendLineDraft();
    }

    window.addEventListener("pointerdown", handleOutsidePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [contextMenu]);

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();

    if (magicTradeLevelPickActive) {
      return;
    }

    if (!wrapperRef.current || !containerRef.current) {
      return;
    }

    const relativePoint = toRelativePoint({
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (!relativePoint) {
      setContextMenu(null);
      return;
    }

    if (isRightPriceAxisRelativeX(relativePoint.x)) {
      setContextMenu(null);
      return;
    }

    const level = findLevelAtYCoordinate(
      levelsRef.current,
      symbolRef.current,
      seriesRef.current?.priceToCoordinate.bind(seriesRef.current),
      relativePoint.y,
    );
    const trendLineHit = findTrendLineHitAtPoint(relativePoint);
    const zone = findZoneAtYCoordinate(relativePoint.y);
    const activeEntryPrice =
      activeTradePlanRef.current?.entry ??
      activePositionRef.current?.entry ??
      null;
    const currentPendingOrder = findPendingOrderAtYCoordinate(
      pendingLimitOrdersRef.current,
      zonesRef.current,
      symbolRef.current,
      seriesRef.current?.priceToCoordinate.bind(seriesRef.current),
      relativePoint.y,
      pendingOrderPreviewPriceRef.current,
      dragStartPendingOrderRef.current?.id ?? null,
      activeZoneInteractionZoneId,
    );

    const rect = wrapperRef.current.getBoundingClientRect();

    if (trendLineHit) {
      setContextMenu({
        lineId: trendLineHit.line.id,
        type: "trend-line",
        x: Math.min(event.clientX - rect.left, rect.width - 190),
        y: Math.min(event.clientY - rect.top, rect.height - 110),
      });
      onSelectObjectRef.current({
        id: trendLineHit.line.id,
        type: "trend-line",
      });
      return;
    }

    if (level) {
      setContextMenu({
        lineId: level.id,
        type: "level",
        x: Math.min(event.clientX - rect.left, rect.width - 190),
        y: Math.min(event.clientY - rect.top, rect.height - 110),
      });
      onSelectObjectRef.current({
        id: level.id,
        type: "level",
      });
      return;
    }

    if (zone) {
      setContextMenu({
        type: "zone",
        zoneId: zone.id,
        x: Math.min(event.clientX - rect.left, rect.width - 190),
        y: Math.min(event.clientY - rect.top, rect.height - 56),
      });
      return;
    }

    if (isEntryLineAtYCoordinate(relativePoint.y, activeEntryPrice)) {
      setContextMenu({
        type: "position",
        x: Math.min(event.clientX - rect.left, rect.width - 180),
        y: Math.min(event.clientY - rect.top, rect.height - 56),
      });
      return;
    }

    if (currentPendingOrder) {
      setContextMenu({
        type: "pending-order",
        x: Math.min(event.clientX - rect.left, rect.width - 180),
        y: Math.min(event.clientY - rect.top, rect.height - 56),
      });
      onSelectObjectRef.current({
        id: currentPendingOrder.id,
        type: "pending-order",
      });
      return;
    }

    setContextMenu({
      type: "chart",
      x: Math.max(0, Math.min(event.clientX - rect.left, rect.width - 324)),
      y: Math.max(0, Math.min(event.clientY - rect.top, rect.height - 220)),
    });
  }

  function activateZoneMode() {
    setContextMenu(null);
    setDrawingObjectsOpen(false);
    clearOrderZoneDraft();
    clearTrendLineDraft();
    setTradePlanStep(null);
    setTradePlanPlacementWarning(null);
    draftTradePlanRef.current = null;
    onDraftTradePlanChangeRef.current(null);
    setZoneModeActive(true);
    draftZoneRef.current = null;
    zonePrimitiveRef.current?.setDraftZone(null);
  }

  function activateCursorMode() {
    setContextMenu(null);
    clearOrderZoneDraft();
    clearTrendLineDraft();
    setZoneModeActive(false);
    setTradePlanStep(null);
    setTradePlanPlacementWarning(null);
    setDrawingObjectsOpen(false);
    draftZoneRef.current = null;
    zonePrimitiveRef.current?.setDraftZone(null);
    draftTradePlanRef.current = null;
    onDraftTradePlanChangeRef.current(null);
  }

  function activateTrendLineMode(tool: ChartDrawingTool = "trend-line") {
    setContextMenu(null);
    setDrawingObjectsOpen(false);
    clearOrderZoneDraft();
    setZoneModeActive(false);
    setTradePlanStep(null);
    setTradePlanPlacementWarning(null);
    draftZoneRef.current = null;
    zonePrimitiveRef.current?.setDraftZone(null);
    draftTradePlanRef.current = null;
    onDraftTradePlanChangeRef.current(null);
    draftTrendLineRef.current = null;
    isCreatingTrendLineRef.current = false;
    setDraftTrendLine(null);
    activeDrawingToolRef.current = tool;
    setActiveDrawingTool(tool);
    syncChartDrawingPrimitive();
    setChartLayerVisibility((current) => ({
      ...current,
      drawings: true,
    }));
    setTrendLineModeActive(true);
  }

  function activateDrawingObjectsMode() {
    setContextMenu(null);
    clearOrderZoneDraft();
    clearTrendLineDraft();
    setZoneModeActive(false);
    setTradePlanStep(null);
    setTradePlanPlacementWarning(null);
    setChartControlsOpen(false);
    draftZoneRef.current = null;
    zonePrimitiveRef.current?.setDraftZone(null);
    draftTradePlanRef.current = null;
    onDraftTradePlanChangeRef.current(null);
    setDrawingObjectsOpen((isOpen) => !isOpen);
  }

  function activateTradePlanMode() {
    const position = activePositionRef.current;

    if (!position) {
      setContextMenu(null);
      clearOrderZoneDraft();
      clearTrendLineDraft();
      return;
    }

    setContextMenu(null);
    setDrawingObjectsOpen(false);
    clearOrderZoneDraft();
    clearTrendLineDraft();
    setZoneModeActive(false);
    setTradePlanPlacementWarning(null);
    draftZoneRef.current = null;
    zonePrimitiveRef.current?.setDraftZone(null);
    draftTradePlanRef.current = {
      entry: position.entry,
      symbol: symbolRef.current as HyperliquidSymbol,
    };
    onDraftTradePlanChangeRef.current({
      entry: position.entry,
      symbol: symbolRef.current as HyperliquidSymbol,
    });
    setTradePlanStep("stop");
  }

  function getPendingOrderById(orderId: string) {
    return (
      pendingLimitOrdersRef.current.find(
        (pendingOrder) => pendingOrder.id === orderId,
      ) ?? null
    );
  }

  function getPendingOrderChipHitFromClientPoint(
    clientX: number,
    clientY: number,
  ): PendingOrderChipHit | null {
    const container = containerRef.current;
    const chipPrimitive = pendingOrderChipPrimitiveRef.current;

    if (!container || !chipPrimitive) {
      return null;
    }

    const rect = container.getBoundingClientRect();

    return chipPrimitive.hitTestChip(
      {
        x: clientX - rect.left,
        y: clientY - rect.top,
      },
      rect.width,
      rect.height,
    );
  }

  function getPendingOrderTooltipTargetFromHit(
    hit: PendingOrderChipHit,
  ): NonNullable<PendingOrderTooltipTarget> {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const anchorX =
      hit.target === "cancel"
        ? hit.layout.cancelRect.x + hit.layout.cancelRect.width / 2
        : hit.layout.labelRect.x + hit.layout.labelRect.width * 0.46;

    return {
      orderId: hit.id,
      target: hit.target,
      x: Math.max(18, Math.min(anchorX, Math.max(18, containerWidth - 18))),
      y: Math.max(34, hit.layout.rect.y - 8),
    };
  }

  function setPendingOrderTooltipFromHit(hit: PendingOrderChipHit | null) {
    if (!hit) {
      setActivePendingOrderTooltipTarget((current) =>
        current === null ? current : null,
      );
      return;
    }

    const nextTarget = getPendingOrderTooltipTargetFromHit(hit);
    setActivePendingOrderTooltipTarget((current) => {
      if (
        current?.orderId === nextTarget.orderId &&
        current.target === nextTarget.target &&
        Math.abs(current.x - nextTarget.x) < 1 &&
        Math.abs(current.y - nextTarget.y) < 1
      ) {
        return current;
      }

      return nextTarget;
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    requestChartOverlayPositionRefresh();

    if (isRightPriceAxisClientX(event.clientX)) {
      setContextMenu(null);
      return;
    }

    if (magicTradeLevelPickActive) {
      setContextMenu(null);
      clearOrderZoneDraft();
      clearTrendLineDraft();

      if (event.button !== 0) {
        magicTradePickPointerDownRef.current = null;
        return;
      }

      const pickCandidate = getMagicTradePickCandidate(
        event.clientX,
        event.clientY,
      );

      if (!pickCandidate) {
        magicTradePickPointerDownRef.current = null;
        setMagicTradePickPreviewPrice(null);
        setMagicTradePickGuideX(null);
        return;
      }

      magicTradePickPointerDownRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        price: pickCandidate.price,
      };
      setMagicTradePickPreviewPrice(pickCandidate.price);
      setMagicTradePickGuideX(pickCandidate.point.x);
      return;
    }

    if (contextMenu) {
      if (
        orderZoneDraft &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        clearOrderZoneDraft();
      }
      setContextMenu(null);
    }

    if (
      !limitPlacementActiveRef.current &&
      !zoneModeActive &&
      !tradePlanStep &&
      !trendLineModeActive &&
      status === "ready" &&
      event.button === 0
    ) {
      const pendingOrderChipHit = getPendingOrderChipHitFromClientPoint(
        event.clientX,
        event.clientY,
      );

      if (pendingOrderChipHit) {
        const pendingOrder = getPendingOrderById(pendingOrderChipHit.id);

        if (!pendingOrder) {
          setPendingOrderTooltipFromHit(null);
          return;
        }

        event.preventDefault();
        onSelectObjectRef.current({
          id: pendingOrder.id,
          type: "pending-order",
        });
        setPendingOrderTooltipFromHit(pendingOrderChipHit);
        suppressNextChartClickRef.current = true;

        if (pendingOrderChipHit.target === "cancel") {
          if (
            pendingOrder.status !== "canceling" &&
            pendingOrder.status !== "updating" &&
            pendingOrder.orderId !== null
          ) {
            setActivePendingOrderTooltipTarget(null);
            onCancelPendingOrderRef.current(pendingOrder);
          }

          return;
        }

        if (
          pendingOrder.status === "live" &&
          pendingOrder.source === "horizontal-line"
        ) {
          pendingOrderPointerDownOrderRef.current = pendingOrder;
          pendingOrderPointerDownYRef.current = event.clientY;
          pendingOrderPreviewOrderIdRef.current = pendingOrder.id;
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        return;
      }
    }

    if (
      CUSTOM_TREND_LINE_DRAWING_ENABLED &&
      trendLineModeActive &&
      !zoneModeActive &&
      !tradePlanStep &&
      status === "ready" &&
      event.button === 0
    ) {
      const startPrice = priceFromClientY(event.clientY);
      const startTime = timeFromClientX(event.clientX);

      if (startPrice === null || startTime === null) {
        return;
      }

      event.preventDefault();

      if (activeDrawingTool === "vertical-ray") {
        onTrendLineCreateRef.current({
          endPrice: startPrice,
          endTime: startTime,
          source: getChartDrawingCreateSource(activeDrawingTool),
          startPrice,
          startTime,
        });
        clearTrendLineDraft();
        suppressNextChartClickRef.current = true;
        return;
      }

      const nextDraftTrendLine = {
        endPrice: startPrice,
        endTime: startTime,
        startPrice,
        startTime,
      };
      draftTrendLineRef.current = nextDraftTrendLine;
      setDraftTrendLine(nextDraftTrendLine);
      syncChartDrawingPrimitive();
      isCreatingTrendLineRef.current = true;
      suppressNextChartClickRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (
      CUSTOM_TREND_LINE_DRAWING_ENABLED &&
      !limitPlacementActiveRef.current &&
      !zoneModeActive &&
      !tradePlanStep &&
      !trendLineModeActive &&
      status === "ready" &&
      event.button === 0
    ) {
      const relativePoint = toRelativePoint({
        clientX: event.clientX,
        clientY: event.clientY,
      });
      const trendLineHit = relativePoint
        ? findTrendLineHitAtPoint(relativePoint)
        : null;

      if (trendLineHit) {
        event.preventDefault();
        onSelectObjectRef.current({
          id: trendLineHit.line.id,
          type: "trend-line",
        });
        if (trendLineHit.line.isLocked) {
          setHoveredTrendLineId(trendLineHit.line.id);
          setHoveredTrendLineHandle("body");
          suppressNextChartClickRef.current = true;
          return;
        }
        trendLineEditModeRef.current = trendLineHit.mode;
        trendLineEditActiveLineIdRef.current = trendLineHit.line.id;
        trendLineEditStartLineRef.current = trendLineHit.line;
        trendLineEditPointerDownRef.current = relativePoint;
        hasStartedTrendLineEditRef.current = false;
        onTrendLineEditingChangeRef.current(trendLineHit.line.id, true);
        setHoveredTrendLineId(trendLineHit.line.id);
        setHoveredTrendLineHandle(trendLineHit.mode);
        suppressNextChartClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }

    if (
      !limitPlacementActiveRef.current &&
      !zoneModeActive &&
      !tradePlanStep &&
      status === "ready" &&
      event.button === 0
    ) {
      const pointerY =
        event.clientY -
        (containerRef.current?.getBoundingClientRect().top ?? 0);
      const zoneInteraction = getZoneInteractionAtYCoordinate(pointerY);

      if (zoneInteraction) {
        const startPrice = priceFromClientY(event.clientY);

        if (startPrice !== null) {
          event.preventDefault();
          onSelectObjectRef.current({
            id: zoneInteraction.zone.id,
            type: "zone",
          });

          if (
            hasProcessingZoneOrders(
              pendingLimitOrdersRef.current,
              zoneInteraction.zone.id,
            )
          ) {
            suppressNextChartClickRef.current = true;
            return;
          }

          setActiveZoneInteractionMode(zoneInteraction.mode);
          setActiveZoneInteractionZoneId(zoneInteraction.zone.id);
          zoneEditModeRef.current = zoneInteraction.mode;
          zoneEditPointerDownYRef.current = event.clientY;
          zoneEditStartZoneRef.current = zoneInteraction.zone;
          zoneEditActiveZoneIdRef.current = zoneInteraction.zone.id;
          zoneEditPriceOffsetRef.current =
            zoneInteraction.mode === "move"
              ? startPrice -
                (zoneInteraction.zone.topPrice +
                  zoneInteraction.zone.bottomPrice) /
                  2
              : 0;
          hasStartedZoneEditRef.current = false;
          suppressNextChartClickRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }
    }

    if (
      !limitPlacementActiveRef.current &&
      !zoneModeActive &&
      !tradePlanStep &&
      status === "ready" &&
      event.button === 0
    ) {
      const pointerY =
        event.clientY -
        (containerRef.current?.getBoundingClientRect().top ?? 0);
      const selectedLevel = findLevelAtYCoordinate(
        levelsRef.current,
        symbolRef.current,
        seriesRef.current?.priceToCoordinate.bind(seriesRef.current),
        pointerY,
      );

      if (selectedLevel) {
        event.preventDefault();
        onSelectObjectRef.current({
          id: selectedLevel.id,
          type: "level",
        });
        levelPointerDownRef.current = selectedLevel;
        levelPointerDownYRef.current = event.clientY;
        draggingLevelIdRef.current = null;
        suppressNextChartClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }

    if (
      !zoneModeActive &&
      !tradePlanStep &&
      status === "ready" &&
      event.button === 0 &&
      activeTradePlanRef.current
    ) {
      const nextLevel = findTradePlanLevelAtYCoordinate(
        event.clientY -
          (containerRef.current?.getBoundingClientRect().top ?? 0),
        activeTradePlanRef.current,
      );

      if (nextLevel && nextLevel !== "entry") {
        event.preventDefault();
        onSelectObjectRef.current({
          id: activeTradePlanRef.current.id,
          type: "trade-plan",
        });
        draggingTradePlanLevelRef.current = nextLevel;
        dragStartTradePlanRef.current = activeTradePlanRef.current;
        setHoveredTradePlanLevel(nextLevel);
        suppressNextChartClickRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }

    if (!zoneModeActive || status !== "ready") {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const startPrice = priceFromClientY(event.clientY);

    if (startPrice === null) {
      return;
    }

    isDraggingZoneRef.current = true;
    dragStartPriceRef.current = startPrice;

    const nextDraftZone = {
      bottomPrice: startPrice,
      topPrice: startPrice,
    };

    event.preventDefault();
    draftZoneRef.current = nextDraftZone;
    zonePrimitiveRef.current?.setDraftZone(nextDraftZone);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    updatePortalCrosshairGuide(event.clientX, event.clientY);
    requestChartOverlayPositionRefresh();

    if (magicTradeLevelPickActive) {
      const pickCandidate = getMagicTradePickCandidate(
        event.clientX,
        event.clientY,
      );
      setMagicTradePickPreviewPrice(pickCandidate?.price ?? null);
      setMagicTradePickGuideX(pickCandidate?.point.x ?? null);
      if (magicTradePickPointerDownRef.current) {
        const dragDistance = Math.hypot(
          event.clientX - magicTradePickPointerDownRef.current.clientX,
          event.clientY - magicTradePickPointerDownRef.current.clientY,
        );

        if (dragDistance > MAGIC_TRADE_PICK_DRAG_THRESHOLD_PX) {
          magicTradePickPointerDownRef.current = null;
        }
      }
      setSelectedMagicTradeOverlayId(null);
      setHoveredMagicTradeOverlayId(null);
      setMagicTradeTooltipPoint(null);
      setHoveredZoneInteraction(null);
      setHoveredTrendLineId(null);
      setHoveredTrendLineHandle(null);
      return;
    }

    if (
      !limitPlacementActiveRef.current &&
      !zoneModeActive &&
      !tradePlanStep &&
      !trendLineModeActive &&
      status === "ready" &&
      !isDraggingPendingOrderRef.current &&
      pendingOrderPointerDownOrderRef.current === null
    ) {
      setPendingOrderTooltipFromHit(
        getPendingOrderChipHitFromClientPoint(event.clientX, event.clientY),
      );
    } else if (activePendingOrderTooltipTarget) {
      setActivePendingOrderTooltipTarget(null);
    }

    if (
      CUSTOM_TREND_LINE_DRAWING_ENABLED &&
      trendLineEditModeRef.current &&
      trendLineEditActiveLineIdRef.current &&
      trendLineEditStartLineRef.current &&
      trendLineEditPointerDownRef.current
    ) {
      const relativePoint = toRelativePoint({
        clientX: event.clientX,
        clientY: event.clientY,
      });

      if (!relativePoint) {
        return;
      }

      const currentPrice = priceFromRelativeY(relativePoint.y);
      const currentTime = timeFromRelativeX(relativePoint.x);
      const pointerDownPoint = trendLineEditPointerDownRef.current;
      const pointerDownPrice = priceFromRelativeY(pointerDownPoint.y);
      const pointerDownTime = timeFromRelativeX(pointerDownPoint.x);

      if (
        currentPrice === null ||
        currentTime === null ||
        pointerDownPrice === null ||
        pointerDownTime === null
      ) {
        return;
      }

      const dragDistance = Math.hypot(
        relativePoint.x - pointerDownPoint.x,
        relativePoint.y - pointerDownPoint.y,
      );

      if (dragDistance >= 4) {
        hasStartedTrendLineEditRef.current = true;
      }

      event.preventDefault();
      const startLine = trendLineEditStartLineRef.current;
      let nextLine: Pick<
        ChartTrendLine,
        "endPrice" | "endTime" | "startPrice" | "startTime"
      > = {
        endPrice: startLine.endPrice,
        endTime: startLine.endTime,
        startPrice: startLine.startPrice,
        startTime: startLine.startTime,
      };

      if (trendLineEditModeRef.current === "body") {
        const startGeometry = getTrendLineScreenGeometry(startLine);

        if (!startGeometry) {
          return;
        }

        const deltaX = relativePoint.x - pointerDownPoint.x;
        const deltaY = relativePoint.y - pointerDownPoint.y;

        const translatedStartPrice = priceFromRelativeY(
          startGeometry.startY + deltaY,
        );
        const translatedEndPrice = priceFromRelativeY(
          startGeometry.endY + deltaY,
        );
        const translatedStartTime = timeFromRelativeX(
          startGeometry.startX + deltaX,
        );
        const translatedEndTime = timeFromRelativeX(
          startGeometry.endX + deltaX,
        );

        if (
          translatedStartPrice === null ||
          translatedEndPrice === null ||
          translatedStartTime === null ||
          translatedEndTime === null
        ) {
          return;
        }

        nextLine = {
          endPrice: translatedEndPrice,
          endTime: translatedEndTime,
          startPrice: translatedStartPrice,
          startTime: translatedStartTime,
        };
      } else if (trendLineEditModeRef.current === "start") {
        nextLine = {
          ...nextLine,
          startPrice: currentPrice,
          startTime: currentTime,
        };
      } else {
        nextLine = {
          ...nextLine,
          endPrice: currentPrice,
          endTime: currentTime,
        };
      }

      onTrendLineChangeRef.current(
        trendLineEditActiveLineIdRef.current,
        nextLine,
      );
      setHoveredTrendLineId(trendLineEditActiveLineIdRef.current);
      setHoveredTrendLineHandle(trendLineEditModeRef.current);
      return;
    }

    if (
      CUSTOM_TREND_LINE_DRAWING_ENABLED &&
      trendLineModeActive &&
      isCreatingTrendLineRef.current &&
      draftTrendLineRef.current
    ) {
      event.preventDefault();
      const nextPrice = priceFromClientY(event.clientY);
      const nextTime = timeFromClientX(event.clientX);

      if (nextPrice === null || nextTime === null) {
        return;
      }

      const nextDraftTrendLine = {
        ...draftTrendLineRef.current,
        endPrice: nextPrice,
        endTime: nextTime,
      };
      draftTrendLineRef.current = nextDraftTrendLine;
      setDraftTrendLine(nextDraftTrendLine);
      syncChartDrawingPrimitive();
      return;
    }

    if (
      zoneEditModeRef.current &&
      zoneEditStartZoneRef.current &&
      zoneEditPointerDownYRef.current !== null
    ) {
      const dragDistance = Math.abs(
        event.clientY - zoneEditPointerDownYRef.current,
      );

      if (dragDistance >= 4) {
        if (!hasStartedZoneEditRef.current) {
          onZoneEditStartRef.current(zoneEditStartZoneRef.current.id);
          hasStartedZoneEditRef.current = true;
        }

        event.preventDefault();
        const currentPrice = priceFromClientY(event.clientY);

        if (currentPrice === null) {
          return;
        }

        const startZone = zoneEditStartZoneRef.current;
        let nextTopPrice = startZone.topPrice;
        let nextBottomPrice = startZone.bottomPrice;

        if (zoneEditModeRef.current === "move") {
          const centerPrice = currentPrice - zoneEditPriceOffsetRef.current;
          const halfHeight =
            Math.abs(startZone.topPrice - startZone.bottomPrice) / 2;
          nextTopPrice = centerPrice + halfHeight;
          nextBottomPrice = centerPrice - halfHeight;
        } else if (zoneEditModeRef.current === "resize-top") {
          nextTopPrice = Math.max(currentPrice, startZone.bottomPrice);
          nextBottomPrice = Math.min(currentPrice, startZone.bottomPrice);
        } else if (zoneEditModeRef.current === "resize-bottom") {
          nextTopPrice = Math.max(startZone.topPrice, currentPrice);
          nextBottomPrice = Math.min(startZone.topPrice, currentPrice);
        }

        onZoneChangeRef.current(startZone.id, {
          bottomPrice: nextBottomPrice,
          topPrice: nextTopPrice,
        });
        return;
      }
    }

    if (
      draggingLevelIdRef.current &&
      levelPointerDownRef.current &&
      levelPointerDownYRef.current !== null
    ) {
      event.preventDefault();
      const nextPrice = priceFromClientY(event.clientY);

      if (nextPrice === null) {
        return;
      }

      onLevelChangeRef.current(draggingLevelIdRef.current, nextPrice);
      return;
    }

    if (
      !draggingLevelIdRef.current &&
      levelPointerDownRef.current &&
      levelPointerDownYRef.current !== null
    ) {
      const dragDistance = Math.abs(
        event.clientY - levelPointerDownYRef.current,
      );

      if (dragDistance >= 4) {
        draggingLevelIdRef.current = levelPointerDownRef.current.id;
      }
    }

    if (
      !isDraggingPendingOrderRef.current &&
      pendingOrderPointerDownOrderRef.current &&
      pendingOrderPointerDownYRef.current !== null
    ) {
      const dragDistance = Math.abs(
        event.clientY - pendingOrderPointerDownYRef.current,
      );

      if (dragDistance >= 4) {
        isDraggingPendingOrderRef.current = true;
        dragStartPendingOrderRef.current =
          pendingOrderPointerDownOrderRef.current;
        pendingOrderPreviewOrderIdRef.current =
          pendingOrderPointerDownOrderRef.current.id;
        setActivePendingOrderTooltipTarget(null);
        setPendingOrderPreviewPrice(
          pendingOrderPointerDownOrderRef.current.normalizedPrice,
        );
      }
    }

    if (isDraggingPendingOrderRef.current && dragStartPendingOrderRef.current) {
      event.preventDefault();
      const nextPrice = priceFromClientY(event.clientY);

      if (nextPrice === null) {
        return;
      }

      setPendingOrderPreviewPrice(nextPrice);
      return;
    }

    if (draggingTradePlanLevelRef.current && activeTradePlanRef.current) {
      event.preventDefault();
      const nextPrice = priceFromClientY(event.clientY);

      if (nextPrice === null) {
        return;
      }

      const nextTradePlan = normalizeTradePlan(
        activeTradePlanRef.current,
        draggingTradePlanLevelRef.current,
        nextPrice,
      );

      onTradePlanChangeRef.current(nextTradePlan);
      setHoveredTradePlanLevel(draggingTradePlanLevelRef.current);
      return;
    }

    if (!zoneModeActive && !tradePlanStep && activeTradePlanRef.current) {
      const hoveredLevel = findTradePlanLevelAtYCoordinate(
        event.clientY -
          (containerRef.current?.getBoundingClientRect().top ?? 0),
        activeTradePlanRef.current,
      );
      setHoveredTradePlanLevel(hoveredLevel === "entry" ? null : hoveredLevel);
    }

    if (!zoneModeActive && !tradePlanStep && status === "ready") {
      const pointerY =
        event.clientY -
        (containerRef.current?.getBoundingClientRect().top ?? 0);
      const magicTradeOverlay = findMagicTradeOverlayAtYCoordinate(
        magicTradeOverlaysRef.current,
        seriesRef.current?.priceToCoordinate.bind(seriesRef.current),
        pointerY,
        10,
      );
      setHoveredMagicTradeOverlayId(magicTradeOverlay?.id ?? null);
      if (magicTradeOverlay) {
        setMagicTradeTooltipPoint({
          x: Math.max(
            16,
            Math.min(
              Math.max(
                event.clientX -
                  (containerRef.current?.getBoundingClientRect().left ?? 0) +
                  14,
                16,
              ),
              (containerRef.current?.clientWidth ?? 430) - 370,
            ),
          ),
          y: Math.max(
            16,
            Math.min(
              Math.max(pointerY - 34, 16),
              (containerRef.current?.clientHeight ?? 320) - 245,
            ),
          ),
        });
      } else {
        setSelectedMagicTradeOverlayId(null);
        setMagicTradeTooltipPoint(null);
      }
      const zoneInteraction = getZoneInteractionAtYCoordinate(pointerY);
      setHoveredZoneInteraction(zoneInteraction);

      if (CUSTOM_TREND_LINE_DRAWING_ENABLED && !trendLineModeActive) {
        const relativePoint = toRelativePoint({
          clientX: event.clientX,
          clientY: event.clientY,
        });
        const trendLineHit = relativePoint
          ? findTrendLineHitAtPoint(relativePoint)
          : null;
        setHoveredTrendLineId(trendLineHit?.line.id ?? null);
        setHoveredTrendLineHandle(trendLineHit?.mode ?? null);
      } else {
        setHoveredTrendLineId(null);
        setHoveredTrendLineHandle(null);
      }
    } else {
      setSelectedMagicTradeOverlayId(null);
      setHoveredMagicTradeOverlayId(null);
      setMagicTradeTooltipPoint(null);
      setHoveredZoneInteraction(null);
      setHoveredTrendLineId(null);
      setHoveredTrendLineHandle(null);
    }

    if (!isDraggingZoneRef.current || dragStartPriceRef.current === null) {
      return;
    }

    event.preventDefault();
    const currentPrice = priceFromClientY(event.clientY);

    if (currentPrice === null) {
      return;
    }

    const nextDraftZone = {
      bottomPrice: Math.min(dragStartPriceRef.current, currentPrice),
      topPrice: Math.max(dragStartPriceRef.current, currentPrice),
    };

    draftZoneRef.current = nextDraftZone;
    zonePrimitiveRef.current?.setDraftZone(nextDraftZone);
  }

  async function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (magicTradeLevelPickActive) {
      const pointerDown = magicTradePickPointerDownRef.current;
      magicTradePickPointerDownRef.current = null;

      if (!pointerDown) {
        return;
      }

      const dragDistance = Math.hypot(
        event.clientX - pointerDown.clientX,
        event.clientY - pointerDown.clientY,
      );
      const pickCandidate = getMagicTradePickCandidate(
        event.clientX,
        event.clientY,
      );

      if (dragDistance > MAGIC_TRADE_PICK_DRAG_THRESHOLD_PX || !pickCandidate) {
        return;
      }

      event.preventDefault();
      setMagicTradePickSnapPrice(pickCandidate.price);
      setMagicTradePickPreviewPrice(null);
      window.setTimeout(() => setMagicTradePickSnapPrice(null), 220);
      onMagicTradeLevelPickRef.current?.(pickCandidate.price);
      return;
    }

    if (
      CUSTOM_TREND_LINE_DRAWING_ENABLED &&
      trendLineEditModeRef.current &&
      trendLineEditActiveLineIdRef.current &&
      trendLineEditStartLineRef.current
    ) {
      const activeLineId = trendLineEditActiveLineIdRef.current;
      const previousLine = trendLineEditStartLineRef.current;
      const didEdit = hasStartedTrendLineEditRef.current;
      const committedLine =
        trendLinesRef.current.find(
          (trendLine) => trendLine.id === activeLineId,
        ) ?? previousLine;

      trendLineEditModeRef.current = null;
      trendLineEditActiveLineIdRef.current = null;
      trendLineEditStartLineRef.current = null;
      trendLineEditPointerDownRef.current = null;
      hasStartedTrendLineEditRef.current = false;
      onTrendLineEditingChangeRef.current(activeLineId, false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!didEdit) {
        return;
      }

      await onTrendLineEditCommitRef.current(
        activeLineId,
        {
          endPrice: previousLine.endPrice,
          endTime: previousLine.endTime,
          startPrice: previousLine.startPrice,
          startTime: previousLine.startTime,
        },
        {
          endPrice: committedLine.endPrice,
          endTime: committedLine.endTime,
          startPrice: committedLine.startPrice,
          startTime: committedLine.startTime,
        },
      );
      return;
    }

    if (
      CUSTOM_TREND_LINE_DRAWING_ENABLED &&
      trendLineModeActive &&
      isCreatingTrendLineRef.current &&
      draftTrendLineRef.current
    ) {
      event.preventDefault();
      const nextLine = draftTrendLineRef.current;
      const isMeaningfulLine =
        Math.abs(nextLine.endPrice - nextLine.startPrice) >= 0.01 ||
        Math.abs(nextLine.endTime - nextLine.startTime) >= 1;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (isMeaningfulLine) {
        onTrendLineCreateRef.current({
          endPrice: nextLine.endPrice,
          endTime: nextLine.endTime,
          source: getChartDrawingCreateSource(activeDrawingTool),
          startPrice: nextLine.startPrice,
          startTime: nextLine.startTime,
        });
      }

      clearTrendLineDraft();
      return;
    }

    if (levelPointerDownRef.current && !draggingLevelIdRef.current) {
      levelPointerDownRef.current = null;
      levelPointerDownYRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      return;
    }

    if (draggingLevelIdRef.current) {
      event.preventDefault();
      draggingLevelIdRef.current = null;
      levelPointerDownRef.current = null;
      levelPointerDownYRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      return;
    }

    if (zoneEditModeRef.current && zoneEditStartZoneRef.current) {
      const activeZoneId = zoneEditActiveZoneIdRef.current;
      const previousZone = zoneEditStartZoneRef.current;
      const didStartEditing = hasStartedZoneEditRef.current;

      zoneEditModeRef.current = null;
      zoneEditPointerDownYRef.current = null;
      zoneEditPriceOffsetRef.current = 0;
      zoneEditStartZoneRef.current = null;
      zoneEditActiveZoneIdRef.current = null;
      hasStartedZoneEditRef.current = false;
      setActiveZoneInteractionMode(null);
      setActiveZoneInteractionZoneId(null);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!didStartEditing || !activeZoneId) {
        return;
      }

      const committedZone = zonesRef.current.find(
        (zone) => zone.id === activeZoneId,
      );

      if (!committedZone) {
        return;
      }

      await onZoneEditCommitRef.current(
        activeZoneId,
        {
          bottomPrice: previousZone.bottomPrice,
          topPrice: previousZone.topPrice,
        },
        {
          bottomPrice: committedZone.bottomPrice,
          topPrice: committedZone.topPrice,
        },
      );
      return;
    }

    if (
      pendingOrderPointerDownOrderRef.current &&
      !isDraggingPendingOrderRef.current
    ) {
      pendingOrderPointerDownOrderRef.current = null;
      pendingOrderPointerDownYRef.current = null;
      pendingOrderPreviewOrderIdRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      return;
    }

    if (isDraggingPendingOrderRef.current) {
      event.preventDefault();

      const dragStartPendingOrder = dragStartPendingOrderRef.current;
      const nextPrice = pendingOrderPreviewPriceRef.current;

      isDraggingPendingOrderRef.current = false;
      dragStartPendingOrderRef.current = null;
      pendingOrderPointerDownOrderRef.current = null;
      pendingOrderPointerDownYRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (
        !dragStartPendingOrder ||
        nextPrice === null ||
        Math.abs(nextPrice - dragStartPendingOrder.normalizedPrice) < 0.01
      ) {
        pendingOrderPreviewOrderIdRef.current = null;
        setPendingOrderPreviewPrice(null);
        return;
      }

      const didCommit = await onPendingOrderCommitRef.current(
        dragStartPendingOrder,
        nextPrice,
      );

      if (!didCommit) {
        pendingOrderPreviewOrderIdRef.current = null;
        setPendingOrderPreviewPrice(null);
        return;
      }

      pendingOrderPreviewOrderIdRef.current = null;
      setPendingOrderPreviewPrice(null);
      return;
    }

    if (draggingTradePlanLevelRef.current) {
      event.preventDefault();
      const committedTradePlan = activeTradePlanRef.current;
      const previousTradePlan = dragStartTradePlanRef.current;
      draggingTradePlanLevelRef.current = null;
      dragStartTradePlanRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (committedTradePlan) {
        void onTradePlanCommitRef.current(
          committedTradePlan,
          previousTradePlan,
        );
      }
      return;
    }

    if (!isDraggingZoneRef.current || dragStartPriceRef.current === null) {
      return;
    }

    event.preventDefault();
    const endPrice = priceFromClientY(event.clientY);
    const startPrice = dragStartPriceRef.current;

    isDraggingZoneRef.current = false;
    dragStartPriceRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (endPrice === null || Math.abs(endPrice - startPrice) < 0.01) {
      draftZoneRef.current = null;
      zonePrimitiveRef.current?.setDraftZone(null);
      setZoneModeActive(false);
      return;
    }

    onZoneCreateRef.current({
      bottomPrice: Math.min(startPrice, endPrice),
      source: "context-menu-drag",
      topPrice: Math.max(startPrice, endPrice),
    });

    draftZoneRef.current = null;
    zonePrimitiveRef.current?.setDraftZone(null);
    setZoneModeActive(false);
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    magicTradePickPointerDownRef.current = null;
    setMagicTradePickPreviewPrice(null);

    if (
      CUSTOM_TREND_LINE_DRAWING_ENABLED &&
      trendLineEditModeRef.current &&
      trendLineEditActiveLineIdRef.current &&
      trendLineEditStartLineRef.current
    ) {
      onTrendLineChangeRef.current(trendLineEditActiveLineIdRef.current, {
        endPrice: trendLineEditStartLineRef.current.endPrice,
        endTime: trendLineEditStartLineRef.current.endTime,
        startPrice: trendLineEditStartLineRef.current.startPrice,
        startTime: trendLineEditStartLineRef.current.startTime,
      });
      onTrendLineEditingChangeRef.current(
        trendLineEditActiveLineIdRef.current,
        false,
      );
    }

    trendLineEditModeRef.current = null;
    trendLineEditActiveLineIdRef.current = null;
    trendLineEditStartLineRef.current = null;
    trendLineEditPointerDownRef.current = null;
    hasStartedTrendLineEditRef.current = false;
    setHoveredTrendLineId(null);
    setHoveredTrendLineHandle(null);
    levelPointerDownRef.current = null;
    levelPointerDownYRef.current = null;
    draggingLevelIdRef.current = null;
    if (isCreatingTrendLineRef.current) {
      clearTrendLineDraft();
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (zoneEditModeRef.current && zoneEditStartZoneRef.current) {
      onZoneChangeRef.current(zoneEditStartZoneRef.current.id, {
        bottomPrice: zoneEditStartZoneRef.current.bottomPrice,
        topPrice: zoneEditStartZoneRef.current.topPrice,
      });
    }

    zoneEditModeRef.current = null;
    zoneEditPointerDownYRef.current = null;
    zoneEditPriceOffsetRef.current = 0;
    zoneEditStartZoneRef.current = null;
    zoneEditActiveZoneIdRef.current = null;
    hasStartedZoneEditRef.current = false;
    setActiveZoneInteractionMode(null);
    setActiveZoneInteractionZoneId(null);
    setSelectedMagicTradeOverlayId(null);
    setHoveredMagicTradeOverlayId(null);
    setMagicTradeTooltipPoint(null);
    setHoveredZoneInteraction(null);
    pendingOrderPointerDownOrderRef.current = null;
    pendingOrderPointerDownYRef.current = null;
    pendingOrderPreviewOrderIdRef.current = null;
    setActivePendingOrderTooltipTarget(null);

    if (isDraggingPendingOrderRef.current) {
      event.preventDefault();
      isDraggingPendingOrderRef.current = false;
      dragStartPendingOrderRef.current = null;
      setPendingOrderPreviewPrice(null);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    if (draggingTradePlanLevelRef.current) {
      event.preventDefault();
      draggingTradePlanLevelRef.current = null;
      dragStartTradePlanRef.current = null;
      setHoveredTradePlanLevel(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    if (!isDraggingZoneRef.current) {
      return;
    }

    event.preventDefault();
    isDraggingZoneRef.current = false;
    dragStartPriceRef.current = null;
    draftZoneRef.current = null;
    zonePrimitiveRef.current?.setDraftZone(null);
    setZoneModeActive(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerLeave() {
    magicTradePickPointerDownRef.current = null;
    setMagicTradePickPreviewPrice(null);
    setMagicTradePickGuideX(null);
    setSelectedMagicTradeOverlayId(null);
    setHoveredMagicTradeOverlayId(null);
    setMagicTradeTooltipPoint(null);
    setHoveredZoneInteraction(null);
    setHoveredTrendLineId(null);
    setHoveredTrendLineHandle(null);
    setPortalCrosshairGuidePoint(null);
    setActivePendingOrderTooltipTarget(null);
  }

  const magicTradePickLineY =
    seriesRef.current &&
    (magicTradePickSnapPrice ?? magicTradePickPreviewPrice) !== null
      ? seriesRef.current.priceToCoordinate(
          magicTradePickSnapPrice ?? magicTradePickPreviewPrice ?? 0,
        )
      : null;
  const magicTradePickLineLabel =
    (magicTradePickSnapPrice ?? magicTradePickPreviewPrice) !== null
      ? (magicTradePickSnapPrice ?? magicTradePickPreviewPrice)?.toLocaleString(
          "en-US",
          {
            maximumFractionDigits:
              (magicTradePickSnapPrice ?? magicTradePickPreviewPrice ?? 0) >=
              1000
                ? 0
                : 2,
            minimumFractionDigits: 0,
          },
        )
      : null;
  const portalCrosshairHorizontalDash = `repeating-linear-gradient(to right, ${PORTAL_CROSSHAIR_LINE_COLOR} 0 ${PORTAL_CROSSHAIR_DASH_SIZE_PX}px, transparent ${PORTAL_CROSSHAIR_DASH_SIZE_PX}px ${
    PORTAL_CROSSHAIR_DASH_SIZE_PX + PORTAL_CROSSHAIR_GAP_SIZE_PX
  }px)`;
  const portalCrosshairVerticalDash = `repeating-linear-gradient(to bottom, ${PORTAL_CROSSHAIR_LINE_COLOR} 0 ${PORTAL_CROSSHAIR_DASH_SIZE_PX}px, transparent ${PORTAL_CROSSHAIR_DASH_SIZE_PX}px ${
    PORTAL_CROSSHAIR_DASH_SIZE_PX + PORTAL_CROSSHAIR_GAP_SIZE_PX
  }px)`;
  const magicTradePickHorizontalDash =
    "repeating-linear-gradient(to right, rgba(236,254,255,0.9) 0 12px, rgba(103,232,249,0.78) 12px 14px, transparent 14px 22px)";
  const magicTradePickVerticalDash =
    "repeating-linear-gradient(to bottom, rgba(236,254,255,0.9) 0 8px, rgba(103,232,249,0.78) 8px 10px, transparent 10px 17px)";
  const chartPickInstructionLabel = magicTradeLevelPickActive
    ? "Pick level"
    : limitPlacementActive && limitPlacementInstructionLabel
      ? limitPlacementInstructionLabel
      : null;
  const chartPickArmatureActive =
    (limitPlacementActive || magicTradeLevelPickActive) &&
    Boolean(chartPickInstructionLabel);
  const chartPickArmatureWidth = portalCrosshairGuidePoint
    ? Math.min(480, Math.max(180, portalCrosshairGuidePoint.width - 32))
    : 0;
  const chartPickShieldWidth = chartPickInstructionLabel
    ? Math.min(240, Math.max(132, chartPickInstructionLabel.length * 7.5 + 52))
    : 0;
  const chartPickShieldHeight = chartPickInstructionLabel ? 42 : 0;
  const chartPickArmaturePoint =
    chartPickArmatureActive &&
    chartPickInstructionLabel &&
    portalCrosshairGuidePoint
      ? {
          label: chartPickInstructionLabel,
          shieldHeight: chartPickShieldHeight,
          shieldWidth: chartPickShieldWidth,
          width: chartPickArmatureWidth,
          x: Math.min(
            Math.max(portalCrosshairGuidePoint.x, chartPickArmatureWidth / 2),
            portalCrosshairGuidePoint.width - chartPickArmatureWidth / 2,
          ),
          y: Math.min(
            Math.max(portalCrosshairGuidePoint.y, 16),
            portalCrosshairGuidePoint.height - 16,
          ),
        }
      : null;
  const activeMagicTradeOverlay =
    magicTradeOverlays.find(
      (overlay) =>
        overlay.id ===
        (selectedMagicTradeOverlayId ?? hoveredMagicTradeOverlayId),
    ) ?? null;
  const displayReadoutCandle: ChartReadoutCandle | null = crosshairReadoutCandle
    ? {
        ...crosshairReadoutCandle,
        source: "crosshair",
      }
    : latestReadoutCandle
      ? {
          ...latestReadoutCandle,
          source: "latest",
        }
      : null;
  const chartChromeTitle = formatChartChromeTitle({
    symbol,
    timeframe,
    venue: coin ? "Hyperliquid" : "Index",
  });
  const displayReadoutChange =
    displayReadoutCandle &&
    Number.isFinite(displayReadoutCandle.close) &&
    Number.isFinite(displayReadoutCandle.open)
      ? displayReadoutCandle.close - displayReadoutCandle.open
      : null;
  const displayReadoutChangePercent =
    displayReadoutChange !== null &&
    displayReadoutCandle &&
    Number.isFinite(displayReadoutCandle.open) &&
    displayReadoutCandle.open !== 0
      ? (displayReadoutChange / displayReadoutCandle.open) * 100
      : null;
  const displayReadoutChangeTone =
    displayReadoutChange !== null && displayReadoutChange < 0
      ? "text-[#EF4444]/86"
      : "text-[#22C55E]/82";
  const activeChartLayerPreset =
    resolveChartLayerPresetKey(chartLayerVisibility);
  const chartLayerStackSummary =
    buildChartLayerStackSummary(chartLayerVisibility);
  const chartLayerStackGroups =
    buildChartLayerStackGroups(chartLayerVisibility);
  const displayedChartLayerGroups = chartLayerStackGroups
    .map((group) => ({
      ...group,
      layers: CHART_LAYER_DEFINITIONS.filter(
        (layer) =>
          group.layerKeys.includes(layer.key) &&
          (!chartLayerActiveOnly || chartLayerVisibility[layer.key]),
      ),
    }))
    .filter((group) => group.layers.length > 0);
  const marketContextReadouts = buildMarketContextReadouts({
    coin,
    context: marketContext,
    fundingEnabled: chartLayerVisibility.funding,
    openInterestEnabled: chartLayerVisibility.openInterest,
    openInterestPoints,
    status: marketContextStatus,
  });
  const drawingObjectRows = buildChartDrawingObjectRows(trendLines, symbol);
  const drawingRailItems = buildChartDrawingRailItems();
  const chartUtilityClock =
    chartClockNow === null
      ? {
          offsetLabel: "UTC",
          timeLabel: "--:--:--",
        }
      : formatChartUtilityClock(new Date(chartClockNow), chartUtilityTimeZone);
  const activeChartIndicatorCount = getChartIndicatorActiveCount(
    CHART_INDICATOR_OPTIONS.reduce(
      (visibility, option) => ({
        ...visibility,
        [option.key]: chartLayerVisibility[option.key],
      }),
      {} as Record<ChartIndicatorLayerKey, boolean>,
    ),
  );
  const activeChartSettingsCount = getChartSettingsActiveCount({
    ...chartSettings,
    volume: chartLayerVisibility.volume,
  });
  const activeChartSettingsTotalCount = CHART_SETTINGS_OPTIONS.length + 1;
  const activeChartSettingsDisplayCount =
    activeChartSettingsCount + (showExecutionFillChips ? 1 : 0);
  const chartScaleUtilityStatus = getChartScaleUtilityStatus({
    autoScaleEnabled: chartAutoScaleEnabled,
    priceScaleMode: chartPriceScaleMode,
  });
  const snapshotStatusLabel =
    snapshotExportStatus === "saved"
      ? "Saved"
      : snapshotExportStatus === "error"
        ? "Failed"
        : snapshotExportStatus === "unavailable"
          ? "Unavailable"
          : "Snapshot";
  const livePriceAxisMarkerRawY =
    currentPrice !== null &&
    Number.isFinite(currentPrice) &&
    chartSettings.priceAxis
      ? (seriesRef.current?.priceToCoordinate(currentPrice) ?? null)
      : null;
  const livePriceAxisMarkerY =
    livePriceAxisMarkerRawY !== null &&
    livePriceAxisMarkerRawY !== undefined &&
    Number.isFinite(livePriceAxisMarkerRawY)
      ? Math.min(
          Math.max(livePriceAxisMarkerRawY, 19),
          Math.max(19, (containerRef.current?.clientHeight ?? 0) - 19),
        )
      : null;
  const livePriceAxisMarkerWidth = Math.max(
    58,
    chartRef.current?.priceScale("right").width() ?? 68,
  );
  const livePriceCountdownLabel =
    chartClockNow === null
      ? null
      : formatChartCandleCountdown({
          latestCandleTime: latestReadoutCandle?.time,
          nowMs: chartClockNow,
          timeframe,
        });

  function handleDrawingObjectRename(lineId: string, label: string) {
    const nextLabel = label.trim();

    onTrendLineChangeRef.current(lineId, {
      customLabel: nextLabel || undefined,
    });
  }

  function handleDrawingObjectVisibilityToggle(
    row: (typeof drawingObjectRows)[number],
  ) {
    onTrendLineChangeRef.current(row.id, {
      isHidden: !row.isHidden,
    });
  }

  function handleDrawingObjectLockToggle(
    row: (typeof drawingObjectRows)[number],
  ) {
    onTrendLineChangeRef.current(row.id, {
      isLocked: !row.isLocked,
    });
  }

  function isDrawingRailItemActive(item: (typeof drawingRailItems)[number]) {
    if (item.action === "cursor") {
      return (
        !zoneModeActive &&
        !trendLineModeActive &&
        !tradePlanStep &&
        !drawingObjectsOpen
      );
    }

    if (item.action === "drawing-tool") {
      return trendLineModeActive && activeDrawingTool === item.tool;
    }

    if (item.action === "zone") {
      return zoneModeActive;
    }

    if (item.action === "trade-plan") {
      return Boolean(tradePlanStep);
    }

    return drawingObjectsOpen;
  }

  function handleDrawingRailItemClick(item: (typeof drawingRailItems)[number]) {
    setDrawingToolsDockOpen(false);

    if (item.action === "cursor") {
      activateCursorMode();
      return;
    }

    if (item.action === "drawing-tool" && item.tool) {
      activateTrendLineMode(item.tool);
      return;
    }

    if (item.action === "zone") {
      activateZoneMode();
      return;
    }

    if (item.action === "trade-plan") {
      activateTradePlanMode();
      return;
    }

    activateDrawingObjectsMode();
  }

  function handleChartScaleUtilityClick(key: ChartPriceScaleUtilityKey) {
    if (key === "percent") {
      setChartPriceScaleMode((current) =>
        current === "percent" ? "normal" : "percent",
      );
      return;
    }

    if (key === "log") {
      setChartPriceScaleMode((current) =>
        current === "log" ? "normal" : "log",
      );
      return;
    }

    if (chartAutoScaleEnabled) {
      setChartAutoScaleEnabled(false);
      return;
    }

    refitChartScale();
  }

  function renderPrimaryChartControls() {
    const activeChartSeriesStyleLabel =
      CHART_SERIES_STYLE_OPTIONS.find((style) => style.key === chartSeriesStyle)
        ?.label ?? "Candles";

    return (
      <div
        aria-label="Chart primary controls"
        className="relative flex w-fit max-w-[min(760px,calc(100vw-1.5rem))] flex-wrap items-center gap-0.5 overflow-visible"
        role="toolbar"
      >
        <div className="relative flex items-center gap-0.5">
          {getChartChromePrimaryIntervals().map((interval) => (
            <button
              key={interval.key}
              type="button"
              aria-label={`Chart interval ${interval.label}`}
              aria-pressed={timeframe === interval.key}
              className={`rounded-portal-chip px-2 py-1 text-[12px] font-medium leading-none transition ${
                timeframe === interval.key
                  ? "bg-cyan-300/[0.12] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
                  : "text-white/54 hover:bg-white/[0.055] hover:text-white/78"
              }`}
              onClick={() => onTimeframeChange?.(interval.key)}
            >
              {interval.label}
            </button>
          ))}
          <select
            aria-label="More chart intervals"
            className="h-6 rounded-portal-chip border border-transparent bg-transparent px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white/44 outline-none transition hover:bg-white/[0.055] hover:text-white/72 focus:bg-white/[0.07] focus:text-white/80"
            value={timeframe}
            onChange={(event) =>
              onTimeframeChange?.(event.currentTarget.value as ChartTimeframe)
            }
          >
            {chartTimeframes.map((interval) => (
              <option key={interval} value={interval}>
                {interval}
              </option>
            ))}
          </select>
        </div>
        <div className="mx-0.5 hidden h-5 w-px bg-gradient-to-b from-transparent via-white/[0.12] to-transparent sm:block" />
        <div
          className="relative flex h-6 w-7 items-center justify-center rounded-portal-chip text-white/54 transition hover:bg-white/[0.055] hover:text-white/78 focus-within:bg-white/[0.07] focus-within:text-white/82"
          title={`Chart style: ${activeChartSeriesStyleLabel}`}
        >
          <span className="pointer-events-none flex items-center justify-center">
            {renderChartSeriesStyleIcon(chartSeriesStyle)}
          </span>
          <select
            aria-label={`Chart style: ${activeChartSeriesStyleLabel}`}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none"
            value={chartSeriesStyle}
            onChange={(event) =>
              setChartSeriesStyle(
                event.currentTarget.value as ChartSeriesStyleKey,
              )
            }
          >
            {CHART_SERIES_STYLE_OPTIONS.map((style) => (
              <option key={style.key} value={style.key}>
                {style.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          aria-label={formatChartActiveCountLabel(
            "Chart indicators",
            activeChartIndicatorCount,
            CHART_INDICATOR_OPTIONS.length,
          )}
          aria-expanded={chartIndicatorsOpen}
          aria-pressed={chartIndicatorsOpen}
          title={formatChartActiveCountLabel(
            "Chart indicators",
            activeChartIndicatorCount,
            CHART_INDICATOR_OPTIONS.length,
          )}
          className={`relative rounded-portal-chip px-1.5 py-1 text-[12px] font-medium leading-none transition ${
            chartIndicatorsOpen
              ? "bg-cyan-300/[0.12] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
              : "text-white/58 hover:bg-white/[0.055] hover:text-white/80"
          }`}
          onClick={() => {
            setChartIndicatorsOpen((isOpen) => !isOpen);
            setChartControlsOpen(false);
            setDrawingObjectsOpen(false);
          }}
        >
          <span className="font-mono text-cyan-100/70">ƒx</span>
        </button>
      </div>
    );
  }

  function renderDrawingToolsDock() {
    const drawingToolsActive =
      trendLineModeActive ||
      zoneModeActive ||
      Boolean(tradePlanStep) ||
      drawingObjectsOpen;
    const drawingToolsDockOpenClass = drawingToolsDockOpen
      ? "pointer-events-auto translate-y-0 opacity-100"
      : "pointer-events-none translate-y-1 opacity-0 group-hover/drawing-dock:pointer-events-auto group-hover/drawing-dock:translate-y-0 group-hover/drawing-dock:opacity-100 group-focus-within/drawing-dock:pointer-events-auto group-focus-within/drawing-dock:translate-y-0 group-focus-within/drawing-dock:opacity-100";

    return (
      <div
        aria-label="Chart drawing tools"
        className="group/drawing-dock relative flex h-6 w-6 items-center justify-center before:absolute before:bottom-full before:left-0 before:h-2 before:w-8 before:content-['']"
        onContextMenu={(event) => event.stopPropagation()}
        onFocus={() => setDrawingToolsDockOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setDrawingToolsDockOpen(false);
          }
        }}
        onMouseEnter={() => setDrawingToolsDockOpen(true)}
        onMouseLeave={() => setDrawingToolsDockOpen(false)}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Show chart drawing tools"
          aria-pressed={drawingToolsActive}
          className={`relative flex h-6 w-6 items-center justify-center rounded-portal-chip transition ${
            drawingToolsActive
              ? "bg-cyan-300/[0.12] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
              : "text-white/54 hover:bg-white/[0.055] hover:text-white/78"
          }`}
          title="Drawing tools"
          onClick={() => setDrawingToolsDockOpen((isOpen) => !isOpen)}
        >
          {renderChartDrawingPencilIcon()}
        </button>
        <div
          aria-label="Chart drawing tools"
          className={`absolute bottom-[calc(100%+0.35rem)] left-0 z-40 flex flex-col items-center gap-1 overflow-hidden rounded-portal-panel border border-cyan-100/[0.10] bg-[linear-gradient(180deg,rgba(6,13,22,0.78),rgba(4,8,14,0.64))] p-1 shadow-[0_18px_42px_rgba(0,0,0,0.34),0_0_24px_rgba(34,211,238,0.055),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[22px] transition duration-150 portal-clip-panel ${drawingToolsDockOpenClass}`}
          role="toolbar"
        >
          <div className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/[0.20] to-transparent" />
          {drawingRailItems.map((item) => {
            const active = isDrawingRailItemActive(item);
            const disabled =
              (item.action === "objects" && drawingObjectRows.length === 0) ||
              (item.action === "trade-plan" && !activePosition);

            return (
              <button
                key={item.key}
                type="button"
                aria-label={item.label}
                aria-pressed={active}
                className={`relative grid h-7 w-7 place-items-center rounded-portal-control border transition ${
                  active
                    ? "border-cyan-200/[0.22] bg-cyan-300/[0.13] text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.10),inset_0_0_0_1px_rgba(103,232,249,0.12)]"
                    : "border-transparent text-white/46 hover:border-cyan-100/[0.10] hover:bg-white/[0.055] hover:text-white/78"
                } ${
                  disabled
                    ? "cursor-not-allowed opacity-35 hover:border-transparent hover:bg-transparent hover:text-white/46"
                    : ""
                }`}
                disabled={disabled}
                title={item.label}
                onClick={() => handleDrawingRailItemClick(item)}
              >
                {renderChartDrawingRailIcon(item.key)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function getChartSettingActiveState(key: ChartSettingKey) {
    if (key === "price-axis") {
      return chartSettings.priceAxis;
    }

    if (key === "volume") {
      return chartLayerVisibility.volume;
    }

    return chartSettings[key];
  }

  function handleChartSettingToggle(key: ChartSettingKey) {
    if (key === "volume") {
      setChartLayerVisibility((current) => ({
        ...current,
        volume: !current.volume,
      }));
      return;
    }

    const settingKey = key === "price-axis" ? "priceAxis" : key;

    setChartSettings((current) => ({
      ...current,
      [settingKey]: !current[settingKey],
    }));
  }

  function handleChartIndicatorToggle(key: ChartIndicatorLayerKey) {
    setChartLayerVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative h-full w-full overflow-hidden bg-[linear-gradient(180deg,#07111a_0%,#050b12_100%)] select-none touch-none ${
        magicTradeLevelPickActive ||
        zoneModeActive ||
        tradePlanStep ||
        limitPlacementActive
          ? limitPlacementActive || magicTradeLevelPickActive
            ? "cursor-none [&_*]:cursor-none"
            : "cursor-crosshair"
          : activeZoneInteractionMode === "move"
            ? "cursor-grabbing"
            : activeZoneInteractionMode === "resize-top" ||
                activeZoneInteractionMode === "resize-bottom"
              ? "cursor-ns-resize"
              : activePendingOrderTooltipTarget?.target === "drag"
                ? "cursor-grab"
                : activePendingOrderTooltipTarget?.target === "cancel"
                  ? "cursor-pointer"
                  : hoveredZoneInteraction &&
                      hasProcessingZoneOrders(
                        pendingLimitOrders,
                        hoveredZoneInteraction.zone.id,
                      )
                    ? "cursor-not-allowed"
                    : hoveredZoneInteraction?.mode === "move"
                      ? "cursor-grab"
                      : hoveredZoneInteraction
                        ? "cursor-ns-resize"
                        : "cursor-crosshair"
      }`}
      onContextMenu={handleContextMenu}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={requestChartOverlayPositionRefresh}
    >
      <div
        ref={containerRef}
        className={`absolute bottom-[2.15rem] left-0 right-0 top-0 z-10 min-h-0 min-w-0 sm:bottom-[2.2rem] ${
          limitPlacementActive || magicTradeLevelPickActive
            ? "cursor-none [&_*]:cursor-none"
            : ""
        }`}
      />
      {activePendingOrderTooltipTarget ? (
        <div className="pointer-events-none absolute bottom-[2.15rem] left-0 right-0 top-0 z-[40] sm:bottom-[2.2rem]">
          <div
            className="absolute w-max -translate-x-1/2 -translate-y-full rounded-portal-chip bg-[#3a3d49] px-3 py-1.5 text-[14px] font-medium text-white shadow-[0_14px_34px_rgba(0,0,0,0.38)] portal-clip-chip"
            style={{
              left: activePendingOrderTooltipTarget.x,
              top: activePendingOrderTooltipTarget.y,
            }}
          >
            {activePendingOrderTooltipTarget.target === "drag"
              ? "Drag to modify price"
              : "Click to cancel"}
            <span className="absolute left-1/2 top-[calc(100%-1px)] h-3 w-3 -translate-x-1/2 rotate-45 bg-[#3a3d49]" />
          </div>
        </div>
      ) : null}
      {livePriceAxisMarkerY !== null ? (
        <div className="pointer-events-none absolute bottom-[2.15rem] left-0 right-0 top-0 z-[22] sm:bottom-[2.2rem]">
          <div
            className="absolute right-0 flex -translate-y-1/2 flex-col items-stretch overflow-hidden font-mono text-[10px] font-semibold leading-none tabular-nums"
            style={{
              background: LIVE_PRICE_MARKER_BACKGROUND,
              borderRadius: 2,
              color: LIVE_PRICE_MARKER_TEXT_COLOR,
              top: livePriceAxisMarkerY,
              width: livePriceAxisMarkerWidth,
            }}
          >
            <span className="px-1.5 pb-[2px] pt-[3px] text-left">
              {formatChartAxisPrice(currentPrice)}
            </span>
            {livePriceCountdownLabel ? (
              <span className="px-1.5 pb-[3px] pt-[1px] text-left text-[10px]">
                {livePriceCountdownLabel}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {portalCrosshairGuidePoint ? (
        <div className="pointer-events-none absolute bottom-[2.15rem] left-0 right-0 top-0 z-[18] sm:bottom-[2.2rem]">
          {chartPickArmaturePoint ? (
            <>
              <div
                className="absolute left-0 h-px"
                style={{
                  backgroundImage: portalCrosshairHorizontalDash,
                  top: portalCrosshairGuidePoint.y,
                  width: Math.max(
                    0,
                    chartPickArmaturePoint.x -
                      chartPickArmaturePoint.shieldWidth / 2,
                  ),
                }}
              />
              <div
                className="absolute right-0 h-px"
                style={{
                  backgroundImage: portalCrosshairHorizontalDash,
                  left:
                    chartPickArmaturePoint.x +
                    chartPickArmaturePoint.shieldWidth / 2,
                  top: portalCrosshairGuidePoint.y,
                }}
              />
              <div
                className="absolute top-0 w-px"
                style={{
                  backgroundImage: portalCrosshairVerticalDash,
                  height: Math.max(
                    0,
                    chartPickArmaturePoint.y -
                      chartPickArmaturePoint.shieldHeight / 2,
                  ),
                  left: portalCrosshairGuidePoint.x,
                }}
              />
              <div
                className="absolute bottom-0 w-px"
                style={{
                  backgroundImage: portalCrosshairVerticalDash,
                  left: portalCrosshairGuidePoint.x,
                  top:
                    chartPickArmaturePoint.y +
                    chartPickArmaturePoint.shieldHeight / 2,
                }}
              />
            </>
          ) : (
            <>
              <div
                className="absolute left-0 right-0 h-px"
                style={{
                  backgroundImage: portalCrosshairHorizontalDash,
                  top: portalCrosshairGuidePoint.y,
                }}
              />
              <div
                className="absolute bottom-0 top-0 w-px"
                style={{
                  backgroundImage: portalCrosshairVerticalDash,
                  left: portalCrosshairGuidePoint.x,
                }}
              />
            </>
          )}
          {chartPickArmaturePoint ? (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: chartPickArmaturePoint.x,
                top: chartPickArmaturePoint.y,
              }}
            >
              <ChartLimitPriceArmature
                label={chartPickArmaturePoint.label}
                width={chartPickArmaturePoint.width}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-[2.15rem] left-0 right-0 z-[11] h-px bg-white/[0.026] sm:bottom-[2.2rem]" />

      <div
        className="absolute left-3 right-3 top-1.5 z-20 flex max-w-[calc(100%-1.5rem)] flex-col gap-1.5 text-white"
        onContextMenu={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        {chartIndicatorsOpen ? (
          <div
            aria-label="Chart indicators"
            className="relative isolate grid w-[min(600px,calc(100vw-1.5rem))] gap-2 overflow-hidden rounded-portal-panel border border-cyan-100/[0.11] bg-[linear-gradient(180deg,rgba(8,15,26,0.82),rgba(4,8,14,0.70))] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.36),0_0_28px_rgba(34,211,238,0.055),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-[22px] portal-clip-panel"
            role="dialog"
          >
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/[0.20] to-transparent" />
            <div className="relative flex items-center justify-between gap-3 px-1">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/72">
                Native indicators
              </div>
              <div className="font-mono text-[10px] font-semibold tabular-nums text-white/38">
                {activeChartIndicatorCount}/{CHART_INDICATOR_OPTIONS.length}
              </div>
            </div>
            <div className="relative grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-1.5">
              {CHART_INDICATOR_OPTIONS.map((option) => {
                const active = chartLayerVisibility[option.key];

                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-label={`${option.label} indicator, ${
                      active ? "on" : "off"
                    }`}
                    aria-pressed={active}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-portal-control border px-3 py-2 text-left transition ${
                      active
                        ? "border-cyan-200/[0.15] bg-cyan-300/[0.085] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.08)]"
                        : "border-white/[0.055] bg-white/[0.025] text-white/46 hover:bg-white/[0.05] hover:text-white/72"
                    }`}
                    onClick={() => handleChartIndicatorToggle(option.key)}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-white/34">
                        {option.group}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.12em]">
                        {option.label}
                      </span>
                    </span>
                    <span
                      className={`rounded-portal-chip px-2 py-1 font-mono text-[9px] font-semibold leading-none ${
                        active
                          ? "bg-cyan-300/[0.12] text-cyan-100"
                          : "bg-white/[0.035] text-white/32"
                      }`}
                    >
                      {active ? "ON" : "OFF"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="absolute left-3 top-2 w-fit max-w-[min(1040px,calc(100vw-2rem))] px-1 py-0.5 opacity-[0.56] transition duration-150 hover:opacity-86">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <div className="flex min-w-[198px] items-baseline gap-1.5">
              <span className="text-[13px] font-medium text-white/58">
                {chartChromeTitle}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  displayReadoutCandle?.source === "crosshair"
                    ? "bg-cyan-300/45 shadow-[0_0_8px_rgba(103,232,249,0.16)]"
                    : "bg-emerald-300/42 shadow-[0_0_8px_rgba(34,197,94,0.14)]"
                }`}
              />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">
                {displayReadoutCandle?.source === "crosshair"
                  ? "Cursor"
                  : "Live"}
              </span>
            </div>
            {(["open", "high", "low", "close"] as const).map((field) => (
              <div key={field} className="flex items-baseline gap-1">
                <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-white/24">
                  {field[0]}
                </span>
                <span className="portal-value-number font-mono text-[10px] font-semibold text-white/56">
                  {formatChartHudPrice(displayReadoutCandle?.[field])}
                </span>
              </div>
            ))}
            <span
              className={`portal-value-number font-mono text-[10px] font-semibold opacity-75 ${displayReadoutChangeTone}`}
            >
              {displayReadoutChange === null
                ? "--"
                : `${displayReadoutChange >= 0 ? "+" : ""}${formatChartHudPrice(
                    displayReadoutChange,
                  )} (${displayReadoutChangePercent === null ? "--" : `${displayReadoutChangePercent >= 0 ? "+" : ""}${displayReadoutChangePercent.toFixed(2)}%`})`}
            </span>
            <span className="font-mono text-[9px] font-semibold text-white/28">
              {formatChartHudTime(displayReadoutCandle?.time)}
            </span>
          </div>
        </div>

        {marketContextReadouts.length > 0 ? (
          <div
            aria-live="polite"
            className="relative isolate flex w-fit max-w-[min(620px,calc(100vw-1.5rem))] flex-wrap items-center gap-x-4 gap-y-1 overflow-hidden rounded-portal-panel border border-cyan-100/[0.09] bg-[linear-gradient(180deg,rgba(7,14,24,0.68),rgba(4,8,14,0.54))] px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[18px] portal-clip-panel"
          >
            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/[0.18] to-transparent" />
            {marketContextReadouts.map((readout) => (
              <div
                key={readout.key}
                className="flex min-w-[128px] items-baseline gap-2"
              >
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-white/36">
                  {readout.label}
                </span>
                <span
                  className={`portal-value-number font-mono text-[11px] font-semibold ${getMarketContextReadoutToneClass(
                    readout.tone,
                  )}`}
                >
                  {readout.value}
                </span>
                <span className="hidden text-[10px] leading-none text-white/30 sm:inline">
                  {readout.detail}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {drawingObjectsOpen && drawingObjectRows.length > 0 ? (
          <div className="relative isolate flex max-h-[min(460px,calc(100vh-12rem))] w-[min(700px,calc(100vw-1.5rem))] flex-col gap-1 overflow-y-auto rounded-portal-panel border border-cyan-100/[0.11] bg-[linear-gradient(180deg,rgba(8,15,26,0.84),rgba(4,8,14,0.74))] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-[22px] portal-clip-panel">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/[0.18] to-transparent" />
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-50/52">
                Drawing objects
              </span>
              <button
                type="button"
                className="rounded-portal-control px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/42 transition hover:bg-white/[0.05] hover:text-white/70"
                onClick={() => {
                  setChartLayerVisibility((current) => ({
                    ...current,
                    drawings: false,
                  }));
                  setDrawingObjectsOpen(false);
                }}
              >
                Hide all
              </button>
            </div>
            {drawingObjectRows.map((row) => {
              const selected =
                selectedObject?.type === "trend-line" &&
                selectedObject.id === row.id;

              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-portal-control border px-2 py-1.5 transition ${
                    selected
                      ? "border-cyan-200/[0.18] bg-cyan-300/[0.08]"
                      : "border-white/[0.055] bg-white/[0.025]"
                  } ${row.isHidden ? "opacity-55" : ""}`}
                >
                  <div className="min-w-0">
                    <input
                      key={`${row.id}-${row.label}`}
                      aria-label={`Rename ${row.defaultLabel}`}
                      className="block w-full rounded-portal-chip border border-transparent bg-transparent px-1 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-50/82 outline-none transition placeholder:text-white/22 focus:border-cyan-200/[0.14] focus:bg-cyan-300/[0.045] focus:text-cyan-50"
                      defaultValue={row.label}
                      placeholder={row.defaultLabel}
                      spellCheck={false}
                      onBlur={(event) =>
                        handleDrawingObjectRename(
                          row.id,
                          event.currentTarget.value,
                        )
                      }
                      onFocus={() =>
                        onSelectObjectRef.current({
                          id: row.id,
                          type: "trend-line",
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          event.currentTarget.value = row.label;
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <div className="mt-0.5 truncate px-1 text-[11px] leading-none text-white/36">
                      {row.detail}
                      {row.isHidden ? " · Hidden" : ""}
                      {row.isLocked ? " · Locked" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-portal-control border border-cyan-100/[0.08] bg-white/[0.025] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/46 transition hover:bg-white/[0.06] hover:text-white/72"
                      onClick={() => handleDrawingObjectVisibilityToggle(row)}
                    >
                      {row.isHidden ? "Show" : "Hide"}
                    </button>
                    <button
                      type="button"
                      className={`rounded-portal-control border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] transition ${
                        row.isLocked
                          ? "border-amber-200/[0.16] bg-amber-300/[0.055] text-amber-100/72 hover:bg-amber-300/[0.10]"
                          : "border-cyan-100/[0.08] bg-white/[0.025] text-white/46 hover:bg-white/[0.06] hover:text-white/72"
                      }`}
                      onClick={() => handleDrawingObjectLockToggle(row)}
                    >
                      {row.isLocked ? "Unlock" : "Lock"}
                    </button>
                    <button
                      type="button"
                      className="rounded-portal-control border border-red-300/[0.12] bg-red-500/[0.035] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-red-100/58 transition hover:bg-red-400/[0.10] hover:text-red-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTrendLineDeleteRef.current(row.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {chartControlsOpen ? (
          <div className="relative isolate flex max-h-[min(480px,calc(100vh-12rem))] w-[min(1040px,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto rounded-portal-panel border border-cyan-100/[0.11] bg-[linear-gradient(180deg,rgba(8,15,26,0.82),rgba(4,8,14,0.70))] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-[22px] portal-clip-panel">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/[0.18] to-transparent" />
            <div className="relative flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-50/52">
                  Active stack
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                  {chartLayerStackSummary.activeCount}/
                  {chartLayerStackSummary.totalCount}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
                {chartLayerStackGroups.map((group) => {
                  const active = group.activeCount > 0;

                  return (
                    <span
                      key={group.key}
                      className={`rounded-portal-chip border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] tabular-nums ${
                        active
                          ? "border-cyan-200/[0.12] bg-cyan-300/[0.055] text-cyan-50/62"
                          : "border-white/[0.045] bg-white/[0.018] text-white/30"
                      }`}
                    >
                      {group.label} {group.activeCount}/{group.totalCount}
                    </span>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={chartLayerActiveOnly}
                  className={`rounded-portal-chip border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] transition ${
                    chartLayerActiveOnly
                      ? "border-violet-200/[0.16] bg-violet-300/[0.07] text-violet-50/72"
                      : "border-white/[0.055] bg-white/[0.025] text-white/40 hover:bg-white/[0.05] hover:text-white/68"
                  }`}
                  onClick={() =>
                    setChartLayerActiveOnly((activeOnly) => !activeOnly)
                  }
                >
                  Active only
                </button>
              </div>
            </div>
            <div className="relative grid grid-cols-[repeat(auto-fit,minmax(126px,1fr))] gap-1.5">
              <div className="flex items-center px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-50/44">
                Presets
              </div>
              {CHART_LAYER_PRESETS.map((preset) => {
                const active = activeChartLayerPreset === preset.key;

                return (
                  <button
                    key={preset.key}
                    type="button"
                    aria-pressed={active}
                    className={`rounded-portal-control border px-3 py-2 text-left transition ${
                      active
                        ? "border-cyan-200/[0.18] bg-cyan-300/[0.10] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.10)]"
                        : "border-white/[0.05] bg-white/[0.02] text-white/42 hover:bg-white/[0.05] hover:text-white/68"
                    }`}
                    onClick={() => applyChartLayerPreset(preset.key)}
                  >
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em]">
                      {preset.label}
                    </div>
                    <div className="mt-1 text-[11px] leading-none text-white/34">
                      {preset.detail}
                    </div>
                  </button>
                );
              })}
              {activeChartLayerPreset === "custom" ? (
                <button
                  type="button"
                  aria-pressed
                  className="rounded-portal-control border border-violet-200/[0.16] bg-violet-300/[0.06] px-3 py-2 text-left text-violet-50/78"
                >
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em]">
                    Custom
                  </div>
                  <div className="mt-1 text-[11px] leading-none text-white/34">
                    Saved here
                  </div>
                </button>
              ) : null}
            </div>
            <div className="relative grid gap-2">
              {displayedChartLayerGroups.length > 0 ? (
                displayedChartLayerGroups.map((group) => (
                  <div key={group.key} className="grid gap-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-50/44">
                        {group.label}
                      </span>
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                        {group.activeCount}/{group.totalCount}
                      </span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(142px,1fr))] gap-1.5">
                      {group.layers.map((layer) => {
                        const active = chartLayerVisibility[layer.key];

                        return (
                          <button
                            key={layer.key}
                            type="button"
                            aria-pressed={active}
                            className={`rounded-portal-control border px-3 py-2 text-left transition ${
                              active
                                ? "border-cyan-200/[0.16] bg-cyan-300/[0.08] text-cyan-50"
                                : "border-white/[0.055] bg-white/[0.025] text-white/42 hover:bg-white/[0.05] hover:text-white/68"
                            }`}
                            onClick={() => toggleChartLayer(layer.key)}
                          >
                            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em]">
                              {layer.label}
                            </div>
                            <div className="mt-1 text-[11px] leading-none text-white/34">
                              {layer.detail}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-portal-control border border-white/[0.045] bg-white/[0.018] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-white/34">
                  Price only
                </div>
              )}
              <button
                type="button"
                className="rounded-portal-control border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-white/46 transition hover:bg-white/[0.05] hover:text-white/72"
                onClick={showAllChartLayers}
              >
                Show All Layers
                <div className="mt-1 text-[11px] leading-none text-white/34">
                  Full stack
                </div>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="absolute bottom-1.5 left-3 z-20 flex max-w-[calc(100%-3rem)] origin-bottom-left scale-[0.82] flex-wrap items-center gap-1.5 text-white opacity-[0.72] transition duration-150 hover:scale-100 hover:opacity-100 focus-within:scale-100 focus-within:opacity-100 sm:max-w-[calc(100%-28rem)]"
        onContextMenu={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        {renderDrawingToolsDock()}
        {renderPrimaryChartControls()}
        <div className="mx-0.5 hidden h-5 w-px bg-gradient-to-b from-transparent via-white/[0.12] to-transparent lg:block" />
        <div className="relative flex items-center gap-1.5">
          <div className="relative flex items-center gap-0.5">
            {CHART_RANGE_PRIMARY_OPTIONS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                aria-label={`Chart range ${preset.label}`}
                aria-pressed={activeRangePreset === preset.key}
                className={`rounded-portal-chip px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] transition ${
                  activeRangePreset === preset.key
                    ? "bg-cyan-300/[0.13] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.20)]"
                    : "text-white/42 hover:bg-white/[0.045] hover:text-white/72"
                }`}
                onClick={() => applyChartRangePreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-expanded={chartCalendarOpen}
            aria-label="Chart calendar and session ranges"
            aria-pressed={CHART_RANGE_CALENDAR_OPTIONS.some(
              (option) => option.key === activeRangePreset,
            )}
            className={`relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-portal-chip border font-mono text-[9px] font-semibold uppercase tracking-[0.16em] portal-clip-chip ${
              chartCalendarOpen ||
              CHART_RANGE_CALENDAR_OPTIONS.some(
                (option) => option.key === activeRangePreset,
              )
                ? "border-transparent bg-transparent text-cyan-50 shadow-[0_0_10px_rgba(34,211,238,0.12)]"
                : "border-transparent bg-transparent text-white/50 hover:border-white/[0.055] hover:bg-white/[0.045] hover:text-white/76"
            }`}
            onClick={() => setChartCalendarOpen((open) => !open)}
          >
            {renderChartCalendarIcon()}
          </button>
          {chartCalendarOpen ? (
            <div
              aria-label="Chart calendar ranges"
              className="absolute bottom-[calc(100%+0.4rem)] left-0 z-40 grid min-w-[12rem] gap-1 overflow-hidden rounded-portal-panel border border-cyan-100/[0.10] bg-[linear-gradient(180deg,rgba(6,13,22,0.84),rgba(4,8,14,0.72))] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[22px] portal-clip-panel"
              role="dialog"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/[0.20] to-transparent" />
              {CHART_RANGE_CALENDAR_OPTIONS.map((preset) => {
                const active = activeRangePreset === preset.key;

                return (
                  <button
                    key={preset.key}
                    type="button"
                    aria-label={`Chart range ${preset.label}`}
                    aria-pressed={active}
                    className={`relative rounded-portal-control border px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                      active
                        ? "border-cyan-200/[0.16] bg-cyan-300/[0.08] text-cyan-50"
                        : "border-white/[0.055] bg-white/[0.025] text-white/46 hover:bg-white/[0.05] hover:text-white/72"
                    }`}
                    onClick={() => applyChartRangePreset(preset.key)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <button
            type="button"
            aria-label={`Export chart snapshot: ${snapshotStatusLabel}`}
            title={snapshotStatusLabel}
            className={`relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-portal-chip border font-mono text-[9px] font-semibold uppercase tracking-[0.16em] transition portal-clip-chip ${
              snapshotExportStatus === "saved"
                ? "border-transparent bg-transparent text-cyan-50 shadow-[0_0_10px_rgba(34,211,238,0.12)]"
                : snapshotExportStatus === "error" ||
                    snapshotExportStatus === "unavailable"
                  ? "border-transparent bg-transparent text-amber-100/68 hover:bg-amber-300/[0.055]"
                  : "border-transparent bg-transparent text-white/50 hover:border-white/[0.055] hover:bg-white/[0.045] hover:text-white/76"
            }`}
            onClick={handleNativeChartSnapshotExport}
          >
            {renderChartSnapshotIcon()}
          </button>
        </div>
      </div>

      {chartSettingsOpen ? (
        <div
          aria-label="Chart settings"
          className="absolute bottom-[3.2rem] right-3 z-30 max-h-[calc(100%-3.8rem)] w-[min(18rem,calc(100%-1.5rem))] overflow-x-hidden overflow-y-auto overscroll-contain rounded-portal-panel border border-cyan-100/[0.10] bg-[linear-gradient(180deg,rgba(6,13,22,0.78),rgba(4,8,14,0.62))] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.34),0_0_28px_rgba(34,211,238,0.06),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[22px] portal-clip-panel"
          role="dialog"
          onContextMenu={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/[0.22] to-transparent" />
          <div className="relative mb-2 flex items-center justify-between gap-3 px-1">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/72">
              Chart settings
            </div>
            <div className="font-mono text-[10px] font-semibold tabular-nums text-white/38">
              {activeChartSettingsDisplayCount}/{activeChartSettingsTotalCount}
            </div>
          </div>
          <div className="relative grid gap-1">
            <button
              type="button"
              aria-pressed={showExecutionFillChips}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-portal-control border px-3 py-2 text-left transition ${
                showExecutionFillChips
                  ? "border-cyan-200/[0.15] bg-cyan-300/[0.085] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.08)]"
                  : "border-white/[0.055] bg-white/[0.025] text-white/46 hover:bg-white/[0.05] hover:text-white/72"
              }`}
              onClick={() =>
                onShowExecutionFillChipsChange?.(!showExecutionFillChips)
              }
            >
              <span className="min-w-0">
                <span className="block font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-white/34">
                  Fills
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.12em]">
                    Buy/Sell chips
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[#2DD4BF]/55 bg-[#08272A]/90 font-mono text-[9px] font-black leading-none text-cyan-50 shadow-[0_0_9px_rgba(45,212,191,0.12)]"
                  >
                    B
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[#B4233A]/62 bg-[#260A11]/92 font-mono text-[9px] font-black leading-none text-red-100 shadow-[0_0_9px_rgba(180,35,58,0.11)]"
                  >
                    S
                  </span>
                </span>
              </span>
              <span
                className={`rounded-portal-chip px-2 py-1 font-mono text-[9px] font-semibold leading-none ${
                  showExecutionFillChips
                    ? "bg-cyan-300/[0.12] text-cyan-100"
                    : "bg-white/[0.035] text-white/32"
                }`}
              >
                {showExecutionFillChips ? "ON" : "OFF"}
              </span>
            </button>
            {CHART_SETTINGS_OPTIONS.map((option) => {
              const active = getChartSettingActiveState(option.key);

              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-portal-control border px-3 py-2 text-left transition ${
                    active
                      ? "border-cyan-200/[0.15] bg-cyan-300/[0.085] text-cyan-50 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.08)]"
                      : "border-white/[0.055] bg-white/[0.025] text-white/46 hover:bg-white/[0.05] hover:text-white/72"
                  }`}
                  onClick={() => handleChartSettingToggle(option.key)}
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-white/34">
                      {option.group}
                    </span>
                    <span className="mt-1 block truncate font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.12em]">
                      {option.label}
                    </span>
                  </span>
                  <span
                    className={`rounded-portal-chip px-2 py-1 font-mono text-[9px] font-semibold leading-none ${
                      active
                        ? "bg-cyan-300/[0.12] text-cyan-100"
                        : "bg-white/[0.035] text-white/32"
                    }`}
                  >
                    {active ? "ON" : "OFF"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        aria-label="Chart scale controls"
        className="absolute bottom-1.5 right-3 z-20 flex max-w-[calc(100%-3rem)] origin-bottom-right scale-[0.86] flex-wrap items-center gap-1 text-white opacity-[0.74] transition duration-150 hover:scale-100 hover:opacity-100 focus-within:scale-100 focus-within:opacity-100"
        role="toolbar"
        onContextMenu={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <div className="px-1.5 font-mono text-[12px] font-semibold leading-none text-white/62">
          {chartUtilityClock.timeLabel} ({chartUtilityClock.offsetLabel})
        </div>
        <div className="mx-1 h-5 w-px bg-gradient-to-b from-transparent via-white/[0.12] to-transparent" />
        {CHART_PRICE_SCALE_UTILITY_OPTIONS.map((option) => {
          const active = chartScaleUtilityStatus.activeUtilityKeys.includes(
            option.key,
          );

          return (
            <button
              key={option.key}
              type="button"
              aria-label={`Chart scale ${option.label}: ${chartScaleUtilityStatus.statusLabel}`}
              aria-pressed={active}
              className={`rounded-portal-chip px-1.5 py-0.5 font-mono text-[12px] font-semibold leading-none transition ${
                active
                  ? "bg-cyan-300/[0.12] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16),0_0_14px_rgba(34,211,238,0.08)]"
                  : "text-white/52 hover:bg-white/[0.055] hover:text-white/78"
              }`}
              onClick={() => handleChartScaleUtilityClick(option.key)}
            >
              {option.label}
            </button>
          );
        })}
        <div className="mx-1 h-5 w-px bg-gradient-to-b from-transparent via-white/[0.12] to-transparent" />
        <button
          type="button"
          aria-label={formatChartActiveCountLabel(
            "Chart settings",
            activeChartSettingsDisplayCount,
            activeChartSettingsTotalCount,
          )}
          aria-expanded={chartSettingsOpen}
          aria-pressed={chartSettingsOpen}
          title={formatChartActiveCountLabel(
            "Chart settings",
            activeChartSettingsDisplayCount,
            activeChartSettingsTotalCount,
          )}
          className={`grid h-6 w-6 place-items-center rounded-portal-chip transition ${
            chartSettingsOpen
              ? "bg-cyan-300/[0.12] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
              : "text-white/50 hover:bg-white/[0.055] hover:text-white/78"
          }`}
          onClick={() => setChartSettingsOpen((current) => !current)}
        >
          {renderChartAxisNutIcon()}
        </button>
      </div>

      {magicTradeLevelPickActive ? (
        <button
          type="button"
          className="absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-portal-control border border-white/[0.10] bg-[rgba(10,15,24,0.82)] px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/72 shadow-[0_14px_38px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl transition hover:border-cyan-200/[0.24] hover:bg-cyan-300/[0.07] hover:text-cyan-50"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onMagicTradeLevelPickCancel?.();
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          Back
        </button>
      ) : null}

      {magicTradePickLineY !== null && magicTradePickLineY !== undefined ? (
        <div
          className="portal-magic-chart-pick-horizontal-guide pointer-events-none absolute inset-x-0 z-[26] h-px"
          style={{
            top: magicTradePickLineY,
            transform: "translateY(-0.5px)",
          }}
        >
          {chartPickArmaturePoint ? (
            <>
              <div
                className="absolute left-0 top-0 h-px"
                style={{
                  backgroundImage: magicTradePickHorizontalDash,
                  width: Math.max(
                    0,
                    chartPickArmaturePoint.x -
                      chartPickArmaturePoint.shieldWidth / 2,
                  ),
                }}
              />
              <div
                className="absolute right-0 top-0 h-px"
                style={{
                  backgroundImage: magicTradePickHorizontalDash,
                  left:
                    chartPickArmaturePoint.x +
                    chartPickArmaturePoint.shieldWidth / 2,
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                backgroundImage: magicTradePickHorizontalDash,
              }}
            />
          )}
          {magicTradePickLineLabel ? (
            <div className="absolute right-5 top-[-14px] rounded-portal-control border border-cyan-200/18 bg-[#07111b]/88 px-2 py-1 font-mono text-[10px] font-semibold text-cyan-50/86 shadow-[0_8px_24px_rgba(0,0,0,0.26)] backdrop-blur-md">
              {magicTradePickLineLabel}
            </div>
          ) : null}
        </div>
      ) : null}

      {magicTradeLevelPickActive && magicTradePickGuideX !== null ? (
        chartPickArmaturePoint ? (
          <>
            <div
              className="portal-magic-chart-pick-vertical-guide pointer-events-none absolute top-0 z-[24] w-px"
              style={{
                backgroundImage: magicTradePickVerticalDash,
                height: Math.max(
                  0,
                  chartPickArmaturePoint.y -
                    chartPickArmaturePoint.shieldHeight / 2,
                ),
                left: magicTradePickGuideX,
                transform: "translateX(-0.5px)",
              }}
            />
            <div
              className="portal-magic-chart-pick-vertical-guide pointer-events-none absolute bottom-0 z-[24] w-px"
              style={{
                backgroundImage: magicTradePickVerticalDash,
                left: magicTradePickGuideX,
                top:
                  chartPickArmaturePoint.y +
                  chartPickArmaturePoint.shieldHeight / 2,
                transform: "translateX(-0.5px)",
              }}
            />
          </>
        ) : (
          <div
            className="portal-magic-chart-pick-vertical-guide pointer-events-none absolute inset-y-0 z-[24] w-px"
            style={{
              backgroundImage: magicTradePickVerticalDash,
              left: magicTradePickGuideX,
              transform: "translateX(-0.5px)",
            }}
          />
        )
      ) : null}

      {chartLayerVisibility.magicTrade &&
      activeMagicTradeOverlay &&
      magicTradeTooltipPoint ? (
        <div
          className="pointer-events-none absolute z-30 w-[min(350px,calc(100vw-28px))] overflow-hidden rounded-portal-panel border border-transparent bg-[#06111d]/72 p-4 text-left text-white shadow-[0_0_22px_rgba(34,211,238,0.12),0_18px_42px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(103,232,249,0.12)] backdrop-blur-[14px] portal-clip-panel"
          style={{
            left: magicTradeTooltipPoint.x,
            top: magicTradeTooltipPoint.y,
            background:
              "linear-gradient(135deg, rgba(8,15,27,0.68), rgba(3,8,15,0.56) 54%, rgba(3,14,24,0.64)) padding-box, linear-gradient(105deg, rgba(184,92,246,0.72), rgba(91,141,255,0.44) 48%, rgba(51,245,255,0.78)) border-box",
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-300/70 via-cyan-200/52 to-cyan-300/80" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-violet-300/75 via-cyan-200/12 to-violet-300/28" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-cyan-300/75 via-cyan-200/12 to-cyan-300/38" />
          <div className="pointer-events-none absolute -left-12 top-2 h-28 w-28 rounded-full bg-violet-500/[0.045] blur-3xl" />
          <div className="pointer-events-none absolute inset-x-4 top-[58px] h-px bg-cyan-100/10" />

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-portal-control border border-[#8B5CF6]/70 bg-[#8B5CF6]/[0.08] shadow-[0_0_18px_rgba(139,92,246,0.24),inset_0_1px_0_rgba(196,181,253,0.13)]">
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 text-[#A78BFA]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 3.5 14.1 9.9 20.5 12 14.1 14.1 12 20.5 9.9 14.1 3.5 12 9.9 9.9 12 3.5Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M18 3.5v3M16.5 5h3M5 17.5v2M4 18.5h2"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <div className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-violet-200">
                  {formatMagicTradeOverlayTitle(
                    activeMagicTradeOverlay.compactLabel,
                  )}
                </div>
              </div>
              <div
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${getMagicTradeStatusClasses(
                  activeMagicTradeOverlay.status,
                )}`}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 3.5 18 6v5.2c0 3.7-2.4 7.1-6 8.4-3.6-1.3-6-4.7-6-8.4V6l6-2.5Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M12 8v4.2l3-1.7"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
                {activeMagicTradeOverlay.statusLabel}
              </div>
            </div>

            <div className="mt-7 text-[14px] font-semibold leading-[1.5] tracking-[0.005em] text-white/90">
              {renderMagicTradeSentence(activeMagicTradeOverlay.sentence)}
            </div>

            {activeMagicTradeOverlay.executionResult ? (
              <div className="mt-5 border-t border-cyan-100/10 pt-4 font-mono">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/46">
                  Result
                </div>
                <div className="mt-1 text-[13px] font-semibold leading-snug text-white/82">
                  {activeMagicTradeOverlay.executionResult}
                </div>
              </div>
            ) : null}

            <div className="pointer-events-none absolute bottom-0 right-0 h-px w-20 bg-gradient-to-r from-transparent via-cyan-300/42 to-cyan-200/72" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-px w-16 bg-gradient-to-r from-violet-300/55 via-violet-300/24 to-transparent" />
          </div>
        </div>
      ) : null}

      {hoveredZoneInteraction ? (
        hoveredZoneInteraction.mode === "move" ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 rounded-portal-control border border-white/8 bg-white/[0.035]"
            style={{
              height: Math.max(
                hoveredZoneInteraction.bottomY - hoveredZoneInteraction.topY,
                1,
              ),
              top: hoveredZoneInteraction.topY,
            }}
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 bg-white/[0.07]"
            style={{
              height: 18,
              top:
                hoveredZoneInteraction.mode === "resize-top"
                  ? hoveredZoneInteraction.topY - 9
                  : hoveredZoneInteraction.bottomY - 9,
            }}
          />
        )
      ) : null}

      {tradePlanStep ? (
        <div className="pointer-events-none absolute inset-x-0 top-5 z-20 flex justify-center px-6">
          <div
            className={`max-w-[min(520px,calc(100vw-48px))] rounded-portal-control border px-3 py-1.5 text-xs font-medium shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-md ${
              tradePlanPlacementWarning
                ? "border-amber-300/26 bg-[linear-gradient(180deg,rgba(28,18,7,0.76),rgba(7,11,18,0.72))] text-amber-50/88"
                : "border-cyan-200/10 bg-[#07111b]/72 text-cyan-50/72"
            }`}
          >
            {tradePlanPlacementWarning ??
              (() => {
                const direction = activePosition?.direction ?? "long";
                const stopSide = direction === "long" ? "below" : "above";
                const targetSide = direction === "long" ? "above" : "below";

                return tradePlanStep === "stop"
                  ? `Trade plan: Click stop loss ${stopSide} entry`
                  : `Trade plan: Click take profit ${targetSide} entry`;
              })()}
          </div>
        </div>
      ) : null}

      {activeTradePlan &&
      showTradePlanChip &&
      selectedObject?.type === "trade-plan" ? (
        <div className="pointer-events-none absolute right-24 top-5 z-20">
          {(() => {
            const metrics = calculateTradePlanMetrics(activeTradePlan);
            const tone = getTradePlanChipTone(metrics.rr);

            return (
              <div
                className={`rounded-portal-panel border px-4 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl ${tone.borderClass} ${tone.surfaceClass}`}
              >
                <div
                  className={`text-[11px] uppercase tracking-[0.2em] ${tone.labelClass}`}
                >
                  R:R
                </div>
                <div
                  className={`mt-1 text-sm font-semibold ${tone.metricClass}`}
                >
                  {metrics.rr.toFixed(2)}R
                </div>
                <div className="mt-1 flex gap-3 text-[11px] text-white/54">
                  <span>
                    Risk {metrics.risk.toFixed(2)} (
                    {metrics.riskPercent.toFixed(2)}%)
                  </span>
                  <span>
                    Reward {metrics.reward.toFixed(2)} (
                    {metrics.rewardPercent.toFixed(2)}%)
                  </span>
                </div>
                <div className="mt-1 flex gap-3 text-[11px] text-white/54">
                  <span>
                    Risk Amt {formatCompactDollar(activeTradePlan.riskAmount)}
                  </span>
                  <span>Size {activeTradePlan.positionSize.toFixed(4)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="portal-popover-enter absolute z-30 min-w-[260px] rounded-portal-panel border border-white/10 bg-[#0b111b]/88 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {contextMenu.type === "chart" ? (
            <div className="grid w-[300px] grid-cols-2 gap-1">
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={activateZoneMode}
              >
                Create zone
              </button>
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => activateTrendLineMode("trend-line")}
              >
                Create trend line
              </button>
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => activateTrendLineMode("vertical-ray")}
              >
                Create vertical ray
              </button>
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => activateTrendLineMode("measure")}
              >
                Measure move
              </button>
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => activateTrendLineMode("fibonacci")}
              >
                Fibonacci retracement
              </button>
            </div>
          ) : contextMenu.type === "level" ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => {
                  onArmLineTriggerRef.current(
                    "horizontal-level",
                    contextMenu.lineId,
                    "long",
                    "touch",
                  );
                  setContextMenu(null);
                }}
              >
                Trigger Buy on Touch
              </button>
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => {
                  onArmLineTriggerRef.current(
                    "horizontal-level",
                    contextMenu.lineId,
                    "short",
                    "touch",
                  );
                  setContextMenu(null);
                }}
              >
                Trigger Sell on Touch
              </button>
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => {
                  onArmLineTriggerRef.current(
                    "horizontal-level",
                    contextMenu.lineId,
                    "long",
                    "close-above",
                  );
                  setContextMenu(null);
                }}
              >
                Trigger Buy on Close Above
              </button>
              <button
                type="button"
                className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => {
                  onArmLineTriggerRef.current(
                    "horizontal-level",
                    contextMenu.lineId,
                    "short",
                    "close-below",
                  );
                  setContextMenu(null);
                }}
              >
                Trigger Sell on Close Below
              </button>
              {lineTriggersRef.current.some(
                (trigger) =>
                  trigger.targetType === "horizontal-level" &&
                  trigger.targetId === contextMenu.lineId,
              ) ? (
                <button
                  type="button"
                  className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                  onClick={() => {
                    onDisarmLineTriggerRef.current(
                      "horizontal-level",
                      contextMenu.lineId,
                    );
                    setContextMenu(null);
                  }}
                >
                  Remove Trigger
                </button>
              ) : null}
            </div>
          ) : contextMenu.type === "trend-line" ? (
            <button
              type="button"
              className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
              onClick={() => {
                setChartLayerVisibility((current) => ({
                  ...current,
                  drawings: false,
                }));
                setContextMenu(null);
              }}
            >
              Hide drawings
            </button>
          ) : contextMenu.type === "pending-order" ? (
            <button
              type="button"
              className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
              onClick={() => {
                setContextMenu(null);
                const currentPendingOrder = pendingLimitOrdersRef.current.find(
                  (pendingOrder) =>
                    selectedObjectRef.current?.type === "pending-order" &&
                    selectedObjectRef.current.id === pendingOrder.id,
                );

                if (currentPendingOrder) {
                  onCancelPendingOrderRef.current(currentPendingOrder);
                }
              }}
            >
              Cancel Order
            </button>
          ) : contextMenu.type === "position" ? (
            <button
              type="button"
              className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
              onClick={activateTradePlanMode}
            >
              Add trade plan
            </button>
          ) : contextMenu.type === "zone" ? (
            (() => {
              const activeZone =
                zones.find((zone) => zone.id === contextMenu.zoneId) ?? null;
              const activeOrderZoneDraft =
                orderZoneDraft && orderZoneDraft.zoneId === contextMenu.zoneId
                  ? orderZoneDraft
                  : null;

              if (!activeZone) {
                return null;
              }

              if (activeOrderZoneDraft) {
                return (
                  <div className="flex flex-col gap-3 p-1">
                    <div className="px-2">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                        Order Zone
                      </div>
                      <div className="mt-1 text-sm font-medium text-white/88">
                        {activeOrderZoneDraft.direction === "long"
                          ? "Buy-side Zone"
                          : "Sell-side Zone"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(["mid-zone", "order-zone"] as const).map((type) => {
                        const active = activeOrderZoneDraft.type === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            className={`rounded-portal-control px-2 py-2 text-[11px] font-medium transition ${
                              active
                                ? "border border-white/16 bg-white/[0.09] text-white"
                                : "border border-transparent bg-white/[0.03] text-white/58 hover:bg-white/[0.06] hover:text-white/85"
                            }`}
                            onClick={() =>
                              setOrderZoneDraft((currentDraft) =>
                                currentDraft
                                  ? {
                                      ...currentDraft,
                                      type,
                                    }
                                  : currentDraft,
                              )
                            }
                          >
                            {type === "mid-zone" ? "Mid Zone" : "Order Zone"}
                          </button>
                        );
                      })}
                    </div>
                    {activeOrderZoneDraft.type === "order-zone" ? (
                      <>
                        <div className="flex items-center justify-between rounded-portal-control border border-white/8 bg-white/[0.03] px-2 py-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-white/40">
                            Orders
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="h-7 w-7 rounded-portal-control border border-white/10 text-sm text-white/75 transition hover:bg-white/[0.06]"
                              onClick={() =>
                                setOrderZoneDraft((currentDraft) =>
                                  currentDraft
                                    ? {
                                        ...currentDraft,
                                        count: Math.max(
                                          2,
                                          currentDraft.count - 1,
                                        ),
                                      }
                                    : currentDraft,
                                )
                              }
                            >
                              -
                            </button>
                            <span className="min-w-[18px] text-center text-sm font-medium text-white/88">
                              {activeOrderZoneDraft.count}
                            </span>
                            <button
                              type="button"
                              className="h-7 w-7 rounded-portal-control border border-white/10 text-sm text-white/75 transition hover:bg-white/[0.06]"
                              onClick={() =>
                                setOrderZoneDraft((currentDraft) =>
                                  currentDraft
                                    ? {
                                        ...currentDraft,
                                        count: Math.min(
                                          10,
                                          currentDraft.count + 1,
                                        ),
                                      }
                                    : currentDraft,
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(["even", "top-heavy", "bottom-heavy"] as const).map(
                            (distribution) => {
                              const active =
                                activeOrderZoneDraft.distribution ===
                                distribution;
                              return (
                                <button
                                  key={distribution}
                                  type="button"
                                  className={`rounded-portal-control px-2 py-2 text-[11px] font-medium transition ${
                                    active
                                      ? "border border-white/16 bg-white/[0.09] text-white"
                                      : "border border-transparent bg-white/[0.03] text-white/58 hover:bg-white/[0.06] hover:text-white/85"
                                  }`}
                                  onClick={() =>
                                    setOrderZoneDraft((currentDraft) =>
                                      currentDraft
                                        ? {
                                            ...currentDraft,
                                            distribution,
                                          }
                                        : currentDraft,
                                    )
                                  }
                                >
                                  {distribution === "even"
                                    ? "Even"
                                    : distribution === "top-heavy"
                                      ? "Top"
                                      : "Bottom"}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-portal-control border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/58">
                        Mid Zone uses one resting limit order at the exact
                        midpoint.
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-portal-control border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white/85 transition hover:bg-white/[0.08]"
                        onClick={clearOrderZoneDraft}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-portal-control border border-white/14 bg-white/[0.1] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.14]"
                        onClick={() => {
                          void onZoneDerivedOrderConfigureRef.current(
                            activeZone.id,
                            activeOrderZoneDraft.type,
                            activeOrderZoneDraft.direction,
                            activeOrderZoneDraft.count,
                            activeOrderZoneDraft.distribution,
                          );
                          clearOrderZoneDraft();
                          setContextMenu(null);
                        }}
                      >
                        {activeOrderZoneDraft.type === "mid-zone"
                          ? "Apply Mid Zone"
                          : `Place ${activeOrderZoneDraft.count}`}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    onClick={() => {
                      void onMidZoneLimitOrderCreateRef.current(
                        activeZone.id,
                        "long",
                      );
                      setContextMenu(null);
                    }}
                  >
                    Create Mid-Zone Limit Buy
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    onClick={() => {
                      void onMidZoneLimitOrderCreateRef.current(
                        activeZone.id,
                        "short",
                      );
                      setContextMenu(null);
                    }}
                  >
                    Create Mid-Zone Limit Sell
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    onClick={() => {
                      setOrderZoneDraft({
                        count: 3,
                        direction: "long",
                        distribution: "even",
                        type: "order-zone",
                        zoneId: activeZone.id,
                      });
                    }}
                  >
                    Create Order Zone (Limit Buy)
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    onClick={() => {
                      setOrderZoneDraft({
                        count: 3,
                        direction: "short",
                        distribution: "even",
                        type: "order-zone",
                        zoneId: activeZone.id,
                      });
                    }}
                  >
                    Create Order Zone (Limit Sell)
                  </button>
                  {activeZone.derivedOrderType &&
                  activeZone.derivedOrderDirection ? (
                    <button
                      type="button"
                      className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                      onClick={() => {
                        const derivedOrderDirection =
                          activeZone.derivedOrderDirection;
                        const derivedOrderType = activeZone.derivedOrderType;

                        if (!derivedOrderDirection || !derivedOrderType) {
                          return;
                        }

                        setOrderZoneDraft({
                          count: activeZone.orderZoneCount ?? 3,
                          direction: derivedOrderDirection,
                          distribution:
                            activeZone.orderZoneDistribution ?? "even",
                          type: derivedOrderType,
                          zoneId: activeZone.id,
                        });
                      }}
                    >
                      Edit Zone Orders
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="w-full rounded-portal-control px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    onClick={() => {
                      onZoneNoTradeToggleRef.current(activeZone.id);
                      setContextMenu(null);
                    }}
                  >
                    {activeZone.isNoTrade
                      ? "Remove No Trade Zone"
                      : "Mark as No Trade Zone"}
                  </button>
                </div>
              );
            })()
          ) : null}
        </div>
      ) : null}

      {status !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-[min(420px,calc(100%-3rem))] rounded-portal-panel border border-cyan-100/[0.10] bg-[#0c121d]/78 px-4 py-3 text-center backdrop-blur-md">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/58">
              {chartStatusLabel.title}
            </div>
            {chartStatusLabel.detail ? (
              <div className="mt-2 text-[12px] leading-5 text-cyan-50/48">
                {chartStatusLabel.detail}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
