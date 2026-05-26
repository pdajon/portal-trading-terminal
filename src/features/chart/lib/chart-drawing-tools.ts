import type {
  ChartDrawingTool,
  ChartTrendLine,
  ChartTrendLineSource,
  PriceCandle,
} from "@/features/chart/types";
import type { MarketSymbol } from "@/types/market";

type ChartDrawingRailItem =
  | {
      action: "cursor" | "objects" | "trade-plan" | "zone";
      key:
        | "cursor"
        | "objects"
        | "trade-plan"
        | "zone";
      label: string;
      tool?: never;
    }
  | {
      action: "drawing-tool";
      key: ChartDrawingTool;
      label: string;
      tool: ChartDrawingTool;
    };

export type ChartFibonacciLevel = {
  label: string;
  price: number;
  ratio: number;
};

export type ChartDrawingObjectRow = {
  defaultLabel: string;
  detail: string;
  id: string;
  isHidden: boolean;
  isLocked: boolean;
  label: string;
  tool: ChartDrawingTool;
};

const CHART_DRAWING_SOURCE_BY_TOOL: Record<
  ChartDrawingTool,
  ChartTrendLineSource
> = {
  fibonacci: "context-menu-fibonacci",
  measure: "context-menu-measurement",
  "trend-line": "context-menu-two-point",
  "vertical-ray": "context-menu-vertical-ray",
};

const CHART_DRAWING_TOOL_BY_SOURCE: Record<
  ChartTrendLineSource,
  ChartDrawingTool
> = {
  "context-menu-fibonacci": "fibonacci",
  "context-menu-measurement": "measure",
  "context-menu-two-point": "trend-line",
  "context-menu-vertical-ray": "vertical-ray",
};

const FIBONACCI_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

export function resolveChartLogicalIndexForTime(
  candles: Array<Pick<PriceCandle, "time">>,
  time: number,
) {
  if (!Number.isFinite(time) || candles.length === 0) {
    return null;
  }

  const sortedCandles = candles
    .filter((candle) => Number.isFinite(candle.time))
    .map((candle) => ({ time: candle.time }))
    .sort((a, b) => a.time - b.time);

  if (sortedCandles.length === 0) {
    return null;
  }

  if (sortedCandles.length === 1) {
    return sortedCandles[0].time === time ? 0 : null;
  }

  const firstCandle = sortedCandles[0];
  const secondCandle = sortedCandles[1];
  const lastIndex = sortedCandles.length - 1;
  const penultimateCandle = sortedCandles[lastIndex - 1];
  const lastCandle = sortedCandles[lastIndex];

  if (time <= firstCandle.time) {
    return interpolateChartLogicalIndex({
      endIndex: 1,
      endTime: secondCandle.time,
      startIndex: 0,
      startTime: firstCandle.time,
      time,
    });
  }

  if (time >= lastCandle.time) {
    return interpolateChartLogicalIndex({
      endIndex: lastIndex,
      endTime: lastCandle.time,
      startIndex: lastIndex - 1,
      startTime: penultimateCandle.time,
      time,
    });
  }

  let low = 0;
  let high = lastIndex;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const middleTime = sortedCandles[middle].time;

    if (middleTime === time) {
      return middle;
    }

    if (middleTime < time) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const startIndex = Math.max(0, high);
  const endIndex = Math.min(lastIndex, low);

  if (startIndex === endIndex) {
    return startIndex;
  }

  return interpolateChartLogicalIndex({
    endIndex,
    endTime: sortedCandles[endIndex].time,
    startIndex,
    startTime: sortedCandles[startIndex].time,
    time,
  });
}

export function resolveChartTimeForLogicalIndex(
  candles: Array<Pick<PriceCandle, "time">>,
  logicalIndex: number,
) {
  if (!Number.isFinite(logicalIndex) || candles.length === 0) {
    return null;
  }

  const sortedCandles = candles
    .filter((candle) => Number.isFinite(candle.time))
    .map((candle) => ({ time: candle.time }))
    .sort((a, b) => a.time - b.time);

  if (sortedCandles.length < 2) {
    return null;
  }

  const lastIndex = sortedCandles.length - 1;

  if (logicalIndex <= 0) {
    return interpolateChartTime({
      endIndex: 1,
      endTime: sortedCandles[1].time,
      logicalIndex,
      startIndex: 0,
      startTime: sortedCandles[0].time,
    });
  }

  if (logicalIndex >= lastIndex) {
    return interpolateChartTime({
      endIndex: lastIndex,
      endTime: sortedCandles[lastIndex].time,
      logicalIndex,
      startIndex: lastIndex - 1,
      startTime: sortedCandles[lastIndex - 1].time,
    });
  }

  const startIndex = Math.floor(logicalIndex);
  const endIndex = Math.ceil(logicalIndex);

  if (startIndex === endIndex) {
    return Math.round(sortedCandles[startIndex].time);
  }

  return interpolateChartTime({
    endIndex,
    endTime: sortedCandles[endIndex].time,
    logicalIndex,
    startIndex,
    startTime: sortedCandles[startIndex].time,
  });
}

export function getChartTrendLineTool(line: Pick<ChartTrendLine, "source">) {
  return CHART_DRAWING_TOOL_BY_SOURCE[line.source] ?? "trend-line";
}

export function getChartDrawingCreateSource(tool: ChartDrawingTool) {
  return CHART_DRAWING_SOURCE_BY_TOOL[tool];
}

export function buildChartDrawingRailItems(): ChartDrawingRailItem[] {
  return [
    { action: "cursor", key: "cursor", label: "Cursor" },
    {
      action: "drawing-tool",
      key: "trend-line",
      label: "Trend line",
      tool: "trend-line",
    },
    {
      action: "drawing-tool",
      key: "vertical-ray",
      label: "Vertical ray",
      tool: "vertical-ray",
    },
    {
      action: "drawing-tool",
      key: "measure",
      label: "Measure move",
      tool: "measure",
    },
    {
      action: "drawing-tool",
      key: "fibonacci",
      label: "Fibonacci",
      tool: "fibonacci",
    },
    { action: "zone", key: "zone", label: "Create zone" },
    { action: "trade-plan", key: "trade-plan", label: "Trade plan" },
    { action: "objects", key: "objects", label: "Objects" },
  ];
}

export function formatChartMeasurementLabel(
  line: Pick<ChartTrendLine, "endPrice" | "endTime" | "startPrice" | "startTime">,
) {
  const priceDelta = line.endPrice - line.startPrice;
  const percentDelta =
    line.startPrice === 0 ? 0 : (priceDelta / line.startPrice) * 100;
  const timeDeltaSeconds = Math.abs(line.endTime - line.startTime);

  return `${formatSignedNumber(priceDelta)} / ${formatSignedPercent(
    percentDelta,
  )} / ${formatCompactDuration(timeDeltaSeconds)}`;
}

export function buildChartFibonacciLevels(
  line: Pick<ChartTrendLine, "endPrice" | "startPrice">,
): ChartFibonacciLevel[] {
  const range = line.endPrice - line.startPrice;

  return FIBONACCI_RATIOS.map((ratio) => ({
    label: `${(ratio * 100).toFixed(1).replace(/\.0$/, "")}%`,
    price: roundChartPrice(line.endPrice - range * ratio),
    ratio,
  }));
}

export function buildChartDrawingObjectRows(
  lines: ChartTrendLine[],
  symbol: MarketSymbol["symbol"],
): ChartDrawingObjectRow[] {
  const countsByTool: Record<ChartDrawingTool, number> = {
    fibonacci: 0,
    measure: 0,
    "trend-line": 0,
    "vertical-ray": 0,
  };

  return lines.flatMap((line) => {
    if (line.symbol !== symbol) {
      return [];
    }

    const tool = getChartTrendLineTool(line);
    countsByTool[tool] += 1;
    const defaultLabel = `${getChartDrawingToolLabel(tool)} ${countsByTool[tool]}`;
    const label = line.customLabel?.trim() || defaultLabel;

    return [
      {
        defaultLabel,
        detail:
          tool === "vertical-ray"
            ? "Time marker"
            : tool === "measure"
              ? formatChartMeasurementLabel(line)
              : `${formatPlainChartNumber(line.startPrice)} -> ${formatPlainChartNumber(
                  line.endPrice,
                )}`,
        id: line.id,
        isHidden: Boolean(line.isHidden),
        isLocked: Boolean(line.isLocked),
        label,
        tool,
      },
    ];
  });
}

function getChartDrawingToolLabel(tool: ChartDrawingTool) {
  if (tool === "trend-line") {
    return "Trend line";
  }

  if (tool === "vertical-ray") {
    return "Vertical ray";
  }

  if (tool === "measure") {
    return "Measure";
  }

  return "Fibonacci";
}

function formatSignedNumber(value: number) {
  const prefix = value >= 0 ? "+" : "-";
  const absoluteValue = Math.abs(value);
  const formattedValue =
    absoluteValue < 10
      ? new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(absoluteValue.toFixed(2)))
      : formatPlainChartNumber(absoluteValue);

  return `${prefix}${formattedValue}`;
}

function formatSignedPercent(value: number) {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${Math.abs(value).toFixed(2)}%`;
}

function formatCompactDuration(seconds: number) {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = seconds / 60;

  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }

  const hours = minutes / 60;

  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }

  return `${Math.round(hours / 24)}d`;
}

function formatPlainChartNumber(value: number) {
  const normalized =
    Math.abs(value) >= 1000 ? Math.round(value) : Number(value.toFixed(2));

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(normalized);
}

function roundChartPrice(value: number) {
  return Number(value.toFixed(8));
}

function interpolateChartLogicalIndex({
  endIndex,
  endTime,
  startIndex,
  startTime,
  time,
}: {
  endIndex: number;
  endTime: number;
  startIndex: number;
  startTime: number;
  time: number;
}) {
  const timeDelta = endTime - startTime;
  const indexDelta = endIndex - startIndex;

  if (
    !Number.isFinite(timeDelta) ||
    !Number.isFinite(indexDelta) ||
    timeDelta <= 0 ||
    indexDelta === 0
  ) {
    return null;
  }

  const progress = (time - startTime) / timeDelta;
  const logicalIndex = startIndex + indexDelta * progress;

  return Number.isFinite(logicalIndex) ? logicalIndex : null;
}

function interpolateChartTime({
  endIndex,
  endTime,
  logicalIndex,
  startIndex,
  startTime,
}: {
  endIndex: number;
  endTime: number;
  logicalIndex: number;
  startIndex: number;
  startTime: number;
}) {
  const indexDelta = endIndex - startIndex;
  const timeDelta = endTime - startTime;

  if (
    !Number.isFinite(indexDelta) ||
    !Number.isFinite(timeDelta) ||
    indexDelta === 0 ||
    timeDelta <= 0
  ) {
    return null;
  }

  const progress = (logicalIndex - startIndex) / indexDelta;
  const time = startTime + timeDelta * progress;

  return Number.isFinite(time) ? Math.round(time) : null;
}
