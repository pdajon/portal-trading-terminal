export const DEFAULT_VISIBLE_CANDLE_COUNT = 320;
export const DEFAULT_RIGHT_OFFSET_SECONDS = 12 * 60 * 60;
export const DEFAULT_RIGHT_OFFSET_BARS = 48;

const CHART_TIMEFRAME_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "1d": 24 * 60 * 60,
};

export type DefaultChartVisibleLogicalRange = {
  from: number;
  to: number;
};

export function getDefaultChartVisibleLogicalRange(
  candleCount: number,
  options: { rightOffsetBars?: number } = {},
): DefaultChartVisibleLogicalRange | null {
  if (candleCount <= 1) {
    return null;
  }

  const lastIndex = candleCount - 1;
  const rightOffsetBars =
    options.rightOffsetBars !== undefined
      ? Math.max(0, Math.round(options.rightOffsetBars))
      : DEFAULT_RIGHT_OFFSET_BARS;

  return {
    from: Math.max(0, lastIndex - DEFAULT_VISIBLE_CANDLE_COUNT + 1),
    to: lastIndex + rightOffsetBars,
  };
}

export function getDefaultChartRightOffsetBars(timeframe: string) {
  const timeframeSeconds = CHART_TIMEFRAME_SECONDS[timeframe];

  if (!timeframeSeconds || !Number.isFinite(timeframeSeconds)) {
    return DEFAULT_RIGHT_OFFSET_BARS;
  }

  return Math.min(
    DEFAULT_RIGHT_OFFSET_BARS,
    Math.max(1, Math.round(DEFAULT_RIGHT_OFFSET_SECONDS / timeframeSeconds)),
  );
}

export function getChartTimeframeSeconds(timeframe: string) {
  return CHART_TIMEFRAME_SECONDS[timeframe] ?? null;
}

export function buildChartFutureWhitespaceTimes({
  candles,
  rightOffsetBars,
  timeframe,
}: {
  candles: Array<{ time: number }>;
  rightOffsetBars: number;
  timeframe: string;
}) {
  const latestTime = candles.at(-1)?.time;
  const timeframeSeconds = getChartTimeframeSeconds(timeframe);
  const count = Math.max(0, Math.round(rightOffsetBars));

  if (
    latestTime === undefined ||
    !Number.isFinite(latestTime) ||
    !timeframeSeconds ||
    count <= 0
  ) {
    return [];
  }

  return Array.from(
    { length: count },
    (_, index) => latestTime + timeframeSeconds * (index + 1),
  );
}
