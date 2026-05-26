const DEFAULT_CHART_LOOKBACK_MS_BY_INTERVAL = {
  "1m": 48 * 60 * 60 * 1000,
  "5m": 10 * 24 * 60 * 60 * 1000,
  "15m": 30 * 24 * 60 * 60 * 1000,
  "1h": 90 * 24 * 60 * 60 * 1000,
  "1d": 365 * 24 * 60 * 60 * 1000,
} as const;

export type DefaultChartLookbackInterval =
  keyof typeof DEFAULT_CHART_LOOKBACK_MS_BY_INTERVAL;

export function getDefaultChartLookbackMs(
  interval: DefaultChartLookbackInterval,
) {
  return DEFAULT_CHART_LOOKBACK_MS_BY_INTERVAL[interval];
}
