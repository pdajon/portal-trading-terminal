import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";

export type ChartLayerKey =
  | "positions"
  | "tradePlan"
  | "levels"
  | "zones"
  | "orders"
  | "volume"
  | "ema20"
  | "ema50"
  | "vwap"
  | "rsi"
  | "macd"
  | "atr"
  | "funding"
  | "openInterest"
  | "drawings"
  | "magicTrade"
  | "executionMarkers";

export type ChartLayerVisibility = Record<ChartLayerKey, boolean>;

export type ChartLayerPresetKey =
  | "execution"
  | "clean"
  | "trend"
  | "context"
  | "all";

export type ChartLayerStackGroupKey =
  | "core"
  | "studies"
  | "context"
  | "drawings"
  | "automation";

export const CHART_LAYER_STORAGE_KEY = "portal.chart-layer-visibility";

export const DEFAULT_CHART_LAYER_VISIBILITY: ChartLayerVisibility = {
  atr: false,
  drawings: true,
  ema20: false,
  ema50: false,
  executionMarkers: true,
  funding: false,
  levels: true,
  magicTrade: true,
  macd: false,
  openInterest: false,
  orders: true,
  positions: true,
  rsi: false,
  tradePlan: true,
  volume: false,
  vwap: false,
  zones: true,
};

export const CHART_LAYER_DEFINITIONS: Array<{
  key: ChartLayerKey;
  label: string;
  detail: string;
}> = [
  {
    key: "positions",
    label: "Position",
    detail: "Entry, mark, liq",
  },
  {
    key: "tradePlan",
    label: "Plan",
    detail: "Entry, SL, TP",
  },
  {
    key: "levels",
    label: "Levels",
    detail: "Manual lines",
  },
  {
    key: "zones",
    label: "Zones",
    detail: "Risk areas",
  },
  {
    key: "orders",
    label: "Orders",
    detail: "Pending limits",
  },
  {
    key: "volume",
    label: "Volume",
    detail: "Candle flow",
  },
  {
    key: "ema20",
    label: "EMA 20",
    detail: "Fast trend",
  },
  {
    key: "ema50",
    label: "EMA 50",
    detail: "Slow trend",
  },
  {
    key: "vwap",
    label: "VWAP",
    detail: "Volume mean",
  },
  {
    key: "rsi",
    label: "RSI",
    detail: "Momentum pane",
  },
  {
    key: "macd",
    label: "MACD",
    detail: "Trend pane",
  },
  {
    key: "atr",
    label: "ATR",
    detail: "Volatility pane",
  },
  {
    key: "funding",
    label: "Funding",
    detail: "Funding 7D",
  },
  {
    key: "openInterest",
    label: "Open Int",
    detail: "OI Live",
  },
  {
    key: "drawings",
    label: "Drawings",
    detail: "Trend tools",
  },
  {
    key: "magicTrade",
    label: "Magic",
    detail: "Armed logic",
  },
  {
    key: "executionMarkers",
    label: "Markers",
    detail: "Trade labels",
  },
];

export const CHART_LAYER_PRESETS: Array<{
  key: ChartLayerPresetKey;
  label: string;
  detail: string;
}> = [
  {
    key: "execution",
    label: "Execution",
    detail: "Orders + risk",
  },
  {
    key: "clean",
    label: "Clean",
    detail: "Price only",
  },
  {
    key: "trend",
    label: "Trend",
    detail: "EMA + VWAP",
  },
  {
    key: "context",
    label: "Context",
    detail: "Flow + funding",
  },
  {
    key: "all",
    label: "All",
    detail: "Full stack",
  },
];

export const CHART_LAYER_STACK_GROUPS: Array<{
  key: ChartLayerStackGroupKey;
  label: string;
}> = [
  {
    key: "core",
    label: "Core",
  },
  {
    key: "studies",
    label: "Studies",
  },
  {
    key: "context",
    label: "Context",
  },
  {
    key: "drawings",
    label: "Drawings",
  },
  {
    key: "automation",
    label: "Automation",
  },
];

const CHART_LAYER_STACK_GROUP_BY_KEY: Record<
  ChartLayerKey,
  ChartLayerStackGroupKey
> = {
  atr: "studies",
  drawings: "drawings",
  ema20: "studies",
  ema50: "studies",
  executionMarkers: "core",
  funding: "context",
  levels: "drawings",
  magicTrade: "automation",
  macd: "studies",
  openInterest: "context",
  orders: "core",
  positions: "core",
  rsi: "studies",
  tradePlan: "core",
  volume: "studies",
  vwap: "studies",
  zones: "drawings",
};

const CHART_LAYER_PRESET_VISIBILITY: Record<
  ChartLayerPresetKey,
  ChartLayerVisibility
> = {
  all: CHART_LAYER_DEFINITIONS.reduce<ChartLayerVisibility>(
    (visibility, layer) => ({
      ...visibility,
      [layer.key]: true,
    }),
    { ...DEFAULT_CHART_LAYER_VISIBILITY },
  ),
  clean: CHART_LAYER_DEFINITIONS.reduce<ChartLayerVisibility>(
    (visibility, layer) => ({
      ...visibility,
      [layer.key]: false,
    }),
    { ...DEFAULT_CHART_LAYER_VISIBILITY },
  ),
  context: {
    ...DEFAULT_CHART_LAYER_VISIBILITY,
    funding: true,
    openInterest: true,
    volume: true,
  },
  execution: DEFAULT_CHART_LAYER_VISIBILITY,
  trend: {
    ...DEFAULT_CHART_LAYER_VISIBILITY,
    atr: true,
    ema20: true,
    ema50: true,
    macd: true,
    rsi: true,
    volume: true,
    vwap: true,
  },
};

type ChartLayerStorage = Pick<Storage, "getItem" | "setItem">;

export function buildChartLayerStorageKey(
  symbol: string,
  timeframe: ChartTimeframe,
) {
  return `${CHART_LAYER_STORAGE_KEY}:${symbol}:${timeframe}`;
}

export function normalizeChartLayerVisibility(
  value: unknown,
): ChartLayerVisibility {
  const rawVisibility =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<Record<ChartLayerKey, unknown>>)
      : {};

  return CHART_LAYER_DEFINITIONS.reduce<ChartLayerVisibility>(
    (nextVisibility, layer) => ({
      ...nextVisibility,
      [layer.key]:
        typeof rawVisibility[layer.key] === "boolean"
          ? rawVisibility[layer.key]
          : DEFAULT_CHART_LAYER_VISIBILITY[layer.key],
    }),
    { ...DEFAULT_CHART_LAYER_VISIBILITY },
  );
}

export function getChartLayerPresetVisibility(
  presetKey: ChartLayerPresetKey,
): ChartLayerVisibility {
  return normalizeChartLayerVisibility(CHART_LAYER_PRESET_VISIBILITY[presetKey]);
}

export function resolveChartLayerPresetKey(
  visibility: ChartLayerVisibility,
): ChartLayerPresetKey | "custom" {
  const normalizedVisibility = normalizeChartLayerVisibility(visibility);

  for (const preset of CHART_LAYER_PRESETS) {
    const presetVisibility = getChartLayerPresetVisibility(preset.key);
    const isPresetMatch = CHART_LAYER_DEFINITIONS.every(
      (layer) => normalizedVisibility[layer.key] === presetVisibility[layer.key],
    );

    if (isPresetMatch) {
      return preset.key;
    }
  }

  return "custom";
}

export function buildChartLayerStackSummary(
  visibility: ChartLayerVisibility,
  maxLabels = 6,
) {
  const normalizedVisibility = normalizeChartLayerVisibility(visibility);
  const activeLayers = CHART_LAYER_DEFINITIONS.filter(
    (layer) => normalizedVisibility[layer.key],
  );
  const safeMaxLabels = Math.max(0, Math.floor(maxLabels));
  const labels = activeLayers
    .slice(0, safeMaxLabels)
    .map((layer) => layer.label);

  return {
    activeCount: activeLayers.length,
    labels,
    overflowCount: Math.max(activeLayers.length - labels.length, 0),
    totalCount: CHART_LAYER_DEFINITIONS.length,
  };
}

export function buildChartLayerStackGroups(visibility: ChartLayerVisibility) {
  const normalizedVisibility = normalizeChartLayerVisibility(visibility);

  return CHART_LAYER_STACK_GROUPS.map((group) => {
    const layers = CHART_LAYER_DEFINITIONS.filter(
      (layer) => CHART_LAYER_STACK_GROUP_BY_KEY[layer.key] === group.key,
    );
    const activeLayers = layers.filter(
      (layer) => normalizedVisibility[layer.key],
    );

    return {
      activeCount: activeLayers.length,
      activeLayerKeys: activeLayers.map((layer) => layer.key),
      activeLabels: activeLayers.map((layer) => layer.label),
      key: group.key,
      label: group.label,
      layerKeys: layers.map((layer) => layer.key),
      totalCount: layers.length,
    };
  }).filter((group) => group.totalCount > 0);
}

export function readChartLayerVisibility(
  storage: Pick<ChartLayerStorage, "getItem"> | null | undefined,
  symbol: string,
  timeframe: ChartTimeframe,
) {
  if (!storage) {
    return DEFAULT_CHART_LAYER_VISIBILITY;
  }

  for (const storageKey of [
    buildChartLayerStorageKey(symbol, timeframe),
    CHART_LAYER_STORAGE_KEY,
  ]) {
    try {
      const rawValue = storage.getItem(storageKey);

      if (rawValue) {
        return normalizeChartLayerVisibility(JSON.parse(rawValue));
      }
    } catch {
      return DEFAULT_CHART_LAYER_VISIBILITY;
    }
  }

  return DEFAULT_CHART_LAYER_VISIBILITY;
}

export function writeChartLayerVisibility(
  storage: Pick<ChartLayerStorage, "setItem"> | null | undefined,
  symbol: string,
  timeframe: ChartTimeframe,
  visibility: ChartLayerVisibility,
) {
  if (!storage) {
    return;
  }

  storage.setItem(
    buildChartLayerStorageKey(symbol, timeframe),
    JSON.stringify(normalizeChartLayerVisibility(visibility)),
  );
}
