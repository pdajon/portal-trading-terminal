import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";
import type { ChartLayerKey } from "@/features/chart/lib/chart-layer-visibility";
import { getChartTimeframeSeconds } from "@/features/chart/lib/chart-viewport";

export type ChartSeriesStyleKey =
  | "candles"
  | "bars"
  | "line"
  | "area"
  | "baseline";

export const CHART_SERIES_STYLE_OPTIONS: Array<{
  key: ChartSeriesStyleKey;
  label: string;
}> = [
  { key: "candles", label: "Candles" },
  { key: "bars", label: "Bars" },
  { key: "line", label: "Line" },
  { key: "area", label: "Area" },
  { key: "baseline", label: "Baseline" },
];

export type ChartPriceScaleUtilityKey = "auto" | "log" | "percent";

export type ChartPriceScaleModeKey = "log" | "normal" | "percent";

export const CHART_PRICE_SCALE_UTILITY_OPTIONS: Array<{
  key: ChartPriceScaleUtilityKey;
  label: string;
}> = [
  { key: "percent", label: "%" },
  { key: "log", label: "log" },
  { key: "auto", label: "auto" },
];

export type ChartRangePreset =
  | "5y"
  | "1y"
  | "6m"
  | "3m"
  | "1m"
  | "5d"
  | "1d"
  | "session"
  | "all";

export const CHART_RANGE_PRIMARY_OPTIONS: Array<{
  key: ChartRangePreset;
  label: string;
}> = [
  { key: "5y", label: "5y" },
  { key: "1y", label: "1y" },
  { key: "6m", label: "6m" },
  { key: "3m", label: "3m" },
  { key: "1m", label: "1m" },
  { key: "5d", label: "5d" },
  { key: "1d", label: "1d" },
];

export const CHART_RANGE_CALENDAR_OPTIONS: Array<{
  key: ChartRangePreset;
  label: string;
}> = [
  { key: "session", label: "Session" },
  { key: "all", label: "All" },
];

const CHART_RANGE_DURATION_SECONDS: Partial<Record<ChartRangePreset, number>> =
  {
    "1d": 86_400,
    "5d": 86_400 * 5,
    "1m": 86_400 * 30,
    "3m": 86_400 * 90,
    "6m": 86_400 * 180,
    "1y": 86_400 * 365,
    "5y": 86_400 * 365 * 5,
  };

export type ChartSettingKey = "crosshair" | "grid" | "price-axis" | "volume";

export type ChartSettingPreferenceKey = "crosshair" | "grid" | "priceAxis";

export type ChartSettingsPreferences = Record<
  ChartSettingPreferenceKey,
  boolean
>;

export const DEFAULT_CHART_SETTINGS: ChartSettingsPreferences = {
  crosshair: true,
  grid: false,
  priceAxis: true,
};

export const CHART_SETTINGS_OPTIONS: Array<{
  key: ChartSettingKey;
  label: string;
  group: "Display" | "Scale" | "Series";
}> = [
  { key: "grid", label: "Grid", group: "Display" },
  { key: "crosshair", label: "Crosshair", group: "Display" },
  { key: "price-axis", label: "Price axis", group: "Scale" },
  { key: "volume", label: "Volume pane", group: "Series" },
];

export type ChartIndicatorLayerKey = Extract<
  ChartLayerKey,
  | "atr"
  | "ema20"
  | "ema50"
  | "funding"
  | "macd"
  | "openInterest"
  | "rsi"
  | "volume"
  | "vwap"
>;

export const CHART_INDICATOR_OPTIONS: Array<{
  key: ChartIndicatorLayerKey;
  label: string;
  group: "Context" | "Flow" | "Momentum" | "Trend" | "Volatility";
}> = [
  { key: "volume", label: "Volume", group: "Flow" },
  { key: "ema20", label: "EMA 20", group: "Trend" },
  { key: "ema50", label: "EMA 50", group: "Trend" },
  { key: "vwap", label: "VWAP", group: "Trend" },
  { key: "rsi", label: "RSI", group: "Momentum" },
  { key: "macd", label: "MACD", group: "Momentum" },
  { key: "atr", label: "ATR", group: "Volatility" },
  { key: "funding", label: "Funding", group: "Context" },
  { key: "openInterest", label: "Open Interest", group: "Context" },
];

const CHART_CHROME_PRIMARY_INTERVALS: ChartTimeframe[] = ["5m", "1h", "1d"];

export function formatChartChromeTimeframeLabel(timeframe: ChartTimeframe) {
  if (timeframe === "1d") {
    return "D";
  }

  if (timeframe.endsWith("m")) {
    return timeframe.replace("m", "");
  }

  return timeframe;
}

export function getChartChromePrimaryIntervals() {
  return CHART_CHROME_PRIMARY_INTERVALS.map((key) => ({
    key,
    label: key === "5m" ? "5m" : formatChartChromeTimeframeLabel(key),
  }));
}

export function formatChartChromeTitle({
  symbol,
  timeframe,
  venue,
}: {
  symbol: string;
  timeframe: ChartTimeframe;
  venue: string;
}) {
  const normalizedSymbol = symbol.replace(/[-/]/g, "").toUpperCase();

  return `${normalizedSymbol} · ${formatChartChromeTimeframeLabel(
    timeframe,
  )} · ${venue}`;
}

function formatCountdownSeconds(totalSeconds: number) {
  const boundedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(boundedSeconds / 3600);
  const minutes = Math.floor((boundedSeconds % 3600) / 60);
  const seconds = boundedSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

export function formatChartCandleCountdown({
  latestCandleTime,
  nowMs,
  timeframe,
}: {
  latestCandleTime: number | null | undefined;
  nowMs: number;
  timeframe: ChartTimeframe;
}) {
  const timeframeSeconds = getChartTimeframeSeconds(timeframe);

  if (
    !timeframeSeconds ||
    latestCandleTime === null ||
    latestCandleTime === undefined ||
    !Number.isFinite(latestCandleTime) ||
    !Number.isFinite(nowMs)
  ) {
    return null;
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  const elapsedIntervals = Math.max(
    1,
    Math.ceil((nowSeconds - latestCandleTime + 1) / timeframeSeconds),
  );
  const nextCloseTime = latestCandleTime + elapsedIntervals * timeframeSeconds;

  return formatCountdownSeconds(nextCloseTime - nowSeconds);
}

function getUtcOffsetLabel(date: Date, timeZone: string) {
  const formattedParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const offsetPart =
    formattedParts.find((part) => part.type === "timeZoneName")?.value ?? "UTC";

  return offsetPart.replace("GMT", "UTC");
}

export function formatChartUtilityClock(date = new Date(), timeZone = "UTC") {
  return {
    offsetLabel: getUtcOffsetLabel(date, timeZone),
    timeLabel: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
      timeZone,
    }).format(date),
  };
}

export function formatChartActiveCountLabel(
  label: string,
  activeCount: number,
  totalCount: number,
) {
  return `${label}, ${activeCount} of ${totalCount} active`;
}

export function getChartRangeStart(
  preset: ChartRangePreset,
  latestTime: number,
  candles: Array<{ time: number }>,
) {
  if (preset === "all") {
    return candles[0]?.time ?? latestTime;
  }

  if (preset === "session") {
    const latestDate = new Date(latestTime * 1000);
    const sessionStart = Date.UTC(
      latestDate.getUTCFullYear(),
      latestDate.getUTCMonth(),
      latestDate.getUTCDate(),
      0,
      0,
      0,
    );

    return Math.floor(sessionStart / 1000);
  }

  return latestTime - (CHART_RANGE_DURATION_SECONDS[preset] ?? 86_400);
}

export function getChartScaleUtilityStatus({
  autoScaleEnabled,
  priceScaleMode,
}: {
  autoScaleEnabled: boolean;
  priceScaleMode: ChartPriceScaleModeKey;
}) {
  const activeUtilityKeys: ChartPriceScaleUtilityKey[] = [];

  if (priceScaleMode === "percent") {
    activeUtilityKeys.push("percent");
  }

  if (priceScaleMode === "log") {
    activeUtilityKeys.push("log");
  }

  if (autoScaleEnabled) {
    activeUtilityKeys.push("auto");
  }

  const modeLabel =
    priceScaleMode === "percent"
      ? "Percent"
      : priceScaleMode === "log"
        ? "Log"
        : "Normal";

  return {
    activeUtilityKeys,
    modeLabel,
    statusLabel: `Scale ${modeLabel}`,
  };
}

export function getChartSettingsActiveCount(
  settings: ChartSettingsPreferences & { volume?: boolean },
) {
  return CHART_SETTINGS_OPTIONS.reduce((count, option) => {
    if (option.key === "price-axis") {
      return count + (settings.priceAxis ? 1 : 0);
    }

    if (option.key === "volume") {
      return count + (settings.volume ? 1 : 0);
    }

    return count + (settings[option.key] ? 1 : 0);
  }, 0);
}

export function getChartIndicatorActiveCount(
  visibility: Record<ChartIndicatorLayerKey, boolean>,
) {
  return CHART_INDICATOR_OPTIONS.reduce(
    (count, option) => count + (visibility[option.key] ? 1 : 0),
    0,
  );
}
