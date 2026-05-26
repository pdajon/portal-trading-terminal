import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type {
  ChartDrawingTool,
  ChartTrendLine,
  PriceCandle,
} from "@/features/chart/types";
import {
  buildChartFibonacciLevels,
  formatChartMeasurementLabel,
  getChartTrendLineTool,
  resolveChartLogicalIndexForTime,
  type ChartFibonacciLevel,
} from "@/features/chart/lib/chart-drawing-tools";

type Point = {
  x: number;
  y: number;
};

export type ChartDrawingPrimitiveDraftLine = Pick<
  ChartTrendLine,
  "endPrice" | "endTime" | "source" | "startPrice" | "startTime" | "symbol"
> & {
  id: string;
};

export type ChartDrawingPrimitiveState = {
  candles: Array<Pick<PriceCandle, "time">>;
  draftLine: ChartDrawingPrimitiveDraftLine | null;
  hoveredLineId: string | null;
  lines: readonly ChartTrendLine[];
  paneHeight: number;
  selectedLineId: string | null;
  symbol: ChartTrendLine["symbol"];
};

export type ChartDrawingRenderItem = {
  endX: number;
  endY: number;
  fibonacciLevels: Array<ChartFibonacciLevel & { y: number }>;
  hovered: boolean;
  id: string;
  isDraft: boolean;
  isLocked: boolean;
  line?: ChartTrendLine;
  measurementLabel: string | null;
  selected: boolean;
  startX: number;
  startY: number;
  tool: ChartDrawingTool;
};

export type ChartDrawingHit = {
  id: string;
  line: ChartTrendLine;
  mode: "body" | "end" | "start";
};

type BuildChartDrawingRenderItemsOptions = ChartDrawingPrimitiveState & {
  priceToCoordinate: (price: number) => number | null;
  timeToCoordinate: (time: number) => number | null;
};

type ChartDrawingRenderItemsSource =
  | readonly ChartDrawingRenderItem[]
  | (() => readonly ChartDrawingRenderItem[]);

const HANDLE_HIT_THRESHOLD = 12;
const LINE_HIT_THRESHOLD = 10;

export function resolveChartDrawingXCoordinate(
  candles: Array<Pick<PriceCandle, "time">>,
  time: number,
  timeScale: {
    logicalToCoordinate(logical: Logical): number | null;
  },
) {
  const logicalIndex = resolveChartLogicalIndexForTime(candles, time);

  if (logicalIndex === null) {
    return null;
  }

  const coordinate = timeScale.logicalToCoordinate(logicalIndex as Logical);

  return coordinate !== null && Number.isFinite(coordinate)
    ? coordinate
    : null;
}

export function buildChartDrawingRenderItems({
  candles,
  draftLine,
  hoveredLineId,
  lines,
  paneHeight,
  priceToCoordinate,
  selectedLineId,
  symbol,
  timeToCoordinate,
}: BuildChartDrawingRenderItemsOptions) {
  const renderItems = lines.flatMap((line) => {
    if (line.symbol !== symbol || line.isHidden) {
      return [];
    }

    const item = buildChartDrawingRenderItem({
      isDraft: false,
      line,
      paneHeight,
      priceToCoordinate,
      selectedLineId,
      hoveredLineId,
      timeToCoordinate,
    });

    return item ? [item] : [];
  });

  if (draftLine?.symbol === symbol) {
    const draftItem = buildChartDrawingRenderItem({
      isDraft: true,
      line: draftLine,
      paneHeight,
      priceToCoordinate,
      selectedLineId: null,
      hoveredLineId: null,
      timeToCoordinate,
    });

    if (draftItem) {
      renderItems.push(draftItem);
    }
  }

  return renderItems;
}

export function findChartDrawingHit(
  items: readonly ChartDrawingRenderItem[],
  point: Point,
): ChartDrawingHit | null {
  let bestMatch: { distance: number; hit: ChartDrawingHit } | null = null;

  for (const item of items) {
    if (!item.line) {
      continue;
    }

    if (item.tool !== "vertical-ray") {
      const startDistance = Math.hypot(
        point.x - item.startX,
        point.y - item.startY,
      );

      if (startDistance <= HANDLE_HIT_THRESHOLD) {
        if (!bestMatch || startDistance < bestMatch.distance) {
          bestMatch = {
            distance: startDistance,
            hit: {
              id: item.id,
              line: item.line,
              mode: "start",
            },
          };
        }
        continue;
      }

      const endDistance = Math.hypot(point.x - item.endX, point.y - item.endY);

      if (endDistance <= HANDLE_HIT_THRESHOLD) {
        if (!bestMatch || endDistance < bestMatch.distance) {
          bestMatch = {
            distance: endDistance,
            hit: {
              id: item.id,
              line: item.line,
              mode: "end",
            },
          };
        }
        continue;
      }
    }

    const lineDistance = distancePointToSegment(
      point,
      { x: item.startX, y: item.startY },
      { x: item.endX, y: item.endY },
    );

    if (lineDistance <= LINE_HIT_THRESHOLD) {
      if (!bestMatch || lineDistance < bestMatch.distance) {
        bestMatch = {
          distance: lineDistance,
          hit: {
            id: item.id,
            line: item.line,
            mode: "body",
          },
        };
      }
    }
  }

  return bestMatch?.hit ?? null;
}

export class ChartDrawingPrimitiveRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly itemsSource: ChartDrawingRenderItemsSource) {}

  draw(target: CanvasRenderingTarget2D) {
    const items =
      typeof this.itemsSource === "function"
        ? this.itemsSource()
        : this.itemsSource;

    if (items.length === 0) {
      return;
    }

    target.useBitmapCoordinateSpace(
      ({ bitmapSize, context, horizontalPixelRatio, verticalPixelRatio }) => {
        context.save();
        context.beginPath();
        context.rect(0, 0, bitmapSize.width, bitmapSize.height);
        context.clip();

        items.forEach((item) => {
          drawFibonacciLevels(
            context,
            item,
            bitmapSize.width,
            horizontalPixelRatio,
            verticalPixelRatio,
          );
          drawDrawingLine(
            context,
            item,
            horizontalPixelRatio,
            verticalPixelRatio,
            bitmapSize.height,
          );
          drawMeasurementLabel(
            context,
            item,
            bitmapSize.width,
            horizontalPixelRatio,
            verticalPixelRatio,
          );
          drawDrawingHandles(
            context,
            item,
            horizontalPixelRatio,
            verticalPixelRatio,
          );
        });

        context.restore();
      },
    );
  }
}

class ChartDrawingPrimitivePaneView implements IPrimitivePaneView {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<"Candlestick", Time> | null = null;
  private state: ChartDrawingPrimitiveState | null = null;

  update(
    chart: IChartApi,
    series: ISeriesApi<"Candlestick", Time>,
    state: ChartDrawingPrimitiveState,
  ) {
    this.chart = chart;
    this.series = series;
    this.state = state;
  }

  private buildRenderItems() {
    if (!this.chart || !this.series || !this.state) {
      return [];
    }

    const timeScale = this.chart.timeScale();

    return buildChartDrawingRenderItems({
      ...this.state,
      priceToCoordinate: (price) => {
        const coordinate = this.series?.priceToCoordinate(price);

        return coordinate !== null &&
          coordinate !== undefined &&
          Number.isFinite(coordinate)
          ? coordinate
          : null;
      },
      timeToCoordinate: (time) =>
        resolveChartDrawingXCoordinate(
          this.state?.candles ?? [],
          time,
          timeScale,
        ),
    });
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    if (
      !this.state ||
      (this.state.lines.length === 0 && !this.state.draftLine)
    ) {
      return null;
    }

    return new ChartDrawingPrimitiveRenderer(() => this.buildRenderItems());
  }
}

export class ChartDrawingPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private paneView = new ChartDrawingPrimitivePaneView();
  private requestUpdate: (() => void) | null = null;
  private series: ISeriesApi<"Candlestick", Time> | null = null;
  private state: ChartDrawingPrimitiveState = {
    candles: [],
    draftLine: null,
    hoveredLineId: null,
    lines: [],
    paneHeight: 0,
    selectedLineId: null,
    symbol: "BTC-USD",
  };

  attached({
    chart,
    requestUpdate,
    series,
  }: SeriesAttachedParameter<Time, "Candlestick">) {
    this.chart = chart;
    this.requestUpdate = requestUpdate;
    this.series = series;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  detached() {
    this.chart = null;
    this.requestUpdate = null;
    this.series = null;
  }

  updateAllViews() {
    if (!this.chart || !this.series) {
      return;
    }

    this.paneView.update(this.chart, this.series, this.state);
  }

  paneViews() {
    return [this.paneView];
  }

  setDrawings(state: ChartDrawingPrimitiveState) {
    this.state = {
      ...state,
      candles: [...state.candles],
      lines: [...state.lines],
    };
    this.updateAllViews();
    this.requestUpdate?.();
  }
}

function buildChartDrawingRenderItem({
  hoveredLineId,
  isDraft,
  line,
  paneHeight,
  priceToCoordinate,
  selectedLineId,
  timeToCoordinate,
}: {
  hoveredLineId: string | null;
  isDraft: boolean;
  line: ChartDrawingPrimitiveDraftLine | ChartTrendLine;
  paneHeight: number;
  priceToCoordinate: (price: number) => number | null;
  selectedLineId: string | null;
  timeToCoordinate: (time: number) => number | null;
}): ChartDrawingRenderItem | null {
  const tool = getChartTrendLineTool(line);
  const startX = timeToCoordinate(line.startTime);
  const endX = timeToCoordinate(line.endTime);
  const startY = priceToCoordinate(line.startPrice);
  const endY = priceToCoordinate(line.endPrice);
  const selected = !isDraft && line.id === selectedLineId;
  const hovered = !isDraft && line.id === hoveredLineId;

  if (
    startX === null ||
    startX === undefined ||
    startY === null ||
    startY === undefined
  ) {
    return null;
  }

  if (tool === "vertical-ray") {
    return {
      endX: startX,
      endY: Math.max(0, paneHeight),
      fibonacciLevels: [],
      hovered,
      id: line.id,
      isDraft,
      isLocked: !isDraft && Boolean((line as ChartTrendLine).isLocked),
      line: isDraft ? undefined : (line as ChartTrendLine),
      measurementLabel: null,
      selected,
      startX,
      startY: 0,
      tool,
    };
  }

  if (
    endX === null ||
    endX === undefined ||
    endY === null ||
    endY === undefined
  ) {
    return null;
  }

  const fibonacciLevels =
    tool === "fibonacci"
      ? buildChartFibonacciLevels(line).flatMap((level) => {
          const y = priceToCoordinate(level.price);

          return y === null || y === undefined ? [] : [{ ...level, y }];
        })
      : [];

  return {
    endX,
    endY,
    fibonacciLevels,
    hovered,
    id: line.id,
    isDraft,
    isLocked: !isDraft && Boolean((line as ChartTrendLine).isLocked),
    line: isDraft ? undefined : (line as ChartTrendLine),
    measurementLabel:
      !isDraft && tool === "measure" ? formatChartMeasurementLabel(line) : null,
    selected,
    startX,
    startY,
    tool,
  };
}

function drawFibonacciLevels(
  context: CanvasRenderingContext2D,
  item: ChartDrawingRenderItem,
  bitmapWidth: number,
  horizontalPixelRatio: number,
  verticalPixelRatio: number,
) {
  if (item.tool !== "fibonacci" || item.fibonacciLevels.length === 0) {
    return;
  }

  const startX = Math.min(item.startX, item.endX) * horizontalPixelRatio;
  const endX = Math.max(item.startX, item.endX) * horizontalPixelRatio;
  const topY = Math.min(item.startY, item.endY) * verticalPixelRatio;
  const bottomY = Math.max(item.startY, item.endY) * verticalPixelRatio;
  const palette = getDrawingPalette(item);

  context.save();
  context.globalAlpha = item.selected || item.hovered ? 1 : 0.72;
  context.fillStyle =
    item.selected || item.hovered
      ? "rgba(34, 211, 238, 0.055)"
      : "rgba(34, 211, 238, 0.028)";
  context.strokeStyle =
    item.selected || item.hovered
      ? "rgba(103, 232, 249, 0.13)"
      : "rgba(103, 232, 249, 0.065)";
  context.lineWidth = Math.max(1, horizontalPixelRatio);
  context.beginPath();
  roundRectPath(
    context,
    startX,
    topY,
    Math.max(endX - startX, 1),
    Math.max(bottomY - topY, 1),
    10 * horizontalPixelRatio,
  );
  context.fill();
  context.stroke();

  item.fibonacciLevels.forEach((level) => {
    const y = level.y * verticalPixelRatio;
    context.beginPath();
    context.setLineDash(
      level.ratio === 0 || level.ratio === 1
        ? []
        : [4 * horizontalPixelRatio, 6 * horizontalPixelRatio],
    );
    context.strokeStyle =
      level.ratio === 0 || level.ratio === 0.5 || level.ratio === 1
        ? palette.stroke
        : "rgba(103, 232, 249, 0.36)";
    context.lineWidth =
      (item.selected || item.hovered
        ? level.ratio === 0.5
          ? 1.5
          : 1.15
        : level.ratio === 0.5
          ? 1.2
          : 0.9) * verticalPixelRatio;
    context.moveTo(startX, y);
    context.lineTo(endX, y);
    context.stroke();

    context.setLineDash([]);
    context.fillStyle =
      item.selected || item.hovered
        ? "rgba(236, 253, 255, 0.78)"
        : "rgba(236, 253, 255, 0.48)";
    context.font = `${Math.round(9 * verticalPixelRatio)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.textBaseline = "middle";
    context.fillText(
      level.label,
      Math.min(endX + 8 * horizontalPixelRatio, bitmapWidth - 72 * horizontalPixelRatio),
      y + 3 * verticalPixelRatio,
    );
  });

  context.restore();
}

function drawDrawingLine(
  context: CanvasRenderingContext2D,
  item: ChartDrawingRenderItem,
  horizontalPixelRatio: number,
  verticalPixelRatio: number,
  bitmapHeight: number,
) {
  const palette = getDrawingPalette(item);
  const startX = item.startX * horizontalPixelRatio;
  const endX = item.endX * horizontalPixelRatio;
  const startY = item.startY * verticalPixelRatio;
  const endY =
    item.tool === "vertical-ray"
      ? bitmapHeight
      : item.endY * verticalPixelRatio;
  const selected = item.selected || item.hovered;

  context.save();
  context.beginPath();
  context.setLineDash(
    item.tool === "vertical-ray"
      ? [3 * horizontalPixelRatio, 7 * horizontalPixelRatio]
      : item.tool === "fibonacci"
        ? [4 * horizontalPixelRatio, 8 * horizontalPixelRatio]
        : [],
  );
  context.lineCap = "round";
  context.strokeStyle = item.isDraft ? "rgba(184, 202, 239, 0.74)" : palette.stroke;
  context.lineWidth =
    item.tool === "vertical-ray"
      ? (selected ? 2 : 1.3) * horizontalPixelRatio
      : (selected ? 2.4 : 1.7) * horizontalPixelRatio;
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.restore();
}

function drawMeasurementLabel(
  context: CanvasRenderingContext2D,
  item: ChartDrawingRenderItem,
  bitmapWidth: number,
  horizontalPixelRatio: number,
  verticalPixelRatio: number,
) {
  if (!item.measurementLabel) {
    return;
  }

  const labelX =
    (Math.min(item.startX, item.endX) + Math.abs(item.endX - item.startX) / 2 + 10) *
    horizontalPixelRatio;
  const labelY = (Math.min(item.startY, item.endY) - 14) * verticalPixelRatio;
  const width = Math.min(
    item.measurementLabel.length * 7.1 * horizontalPixelRatio + 18 * horizontalPixelRatio,
    bitmapWidth - labelX - 8 * horizontalPixelRatio,
  );

  if (width <= 0) {
    return;
  }

  context.save();
  context.fillStyle = "rgba(7, 17, 27, 0.78)";
  context.strokeStyle = "rgba(103, 232, 249, 0.16)";
  context.lineWidth = Math.max(1, horizontalPixelRatio);
  context.beginPath();
  roundRectPath(
    context,
    labelX,
    labelY - 18 * verticalPixelRatio,
    width,
    24 * verticalPixelRatio,
    9 * horizontalPixelRatio,
  );
  context.fill();
  context.stroke();
  context.fillStyle = "rgba(236, 253, 255, 0.88)";
  context.font = `${Math.round(10 * verticalPixelRatio)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textBaseline = "middle";
  context.fillText(
    item.measurementLabel,
    labelX + 9 * horizontalPixelRatio,
    labelY - 6 * verticalPixelRatio,
  );
  context.restore();
}

function drawDrawingHandles(
  context: CanvasRenderingContext2D,
  item: ChartDrawingRenderItem,
  horizontalPixelRatio: number,
  verticalPixelRatio: number,
) {
  if (
    item.isDraft ||
    item.tool === "vertical-ray" ||
    item.isLocked ||
    (!item.selected && !item.hovered)
  ) {
    return;
  }

  const palette = getDrawingPalette(item);

  drawHandle(
    context,
    item.startX * horizontalPixelRatio,
    item.startY * verticalPixelRatio,
    palette.handleColor,
    horizontalPixelRatio,
  );
  drawHandle(
    context,
    item.endX * horizontalPixelRatio,
    item.endY * verticalPixelRatio,
    palette.handleColor,
    horizontalPixelRatio,
  );
}

function drawHandle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
  pixelRatio: number,
) {
  context.save();
  context.beginPath();
  context.arc(x, y, 5 * pixelRatio, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.strokeStyle = "rgba(10,15,24,0.92)";
  context.lineWidth = 1.5 * pixelRatio;
  context.fill();
  context.stroke();
  context.restore();
}

function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
}

function getDrawingPalette(item: Pick<ChartDrawingRenderItem, "hovered" | "selected">) {
  const selected = item.selected || item.hovered;

  return {
    handleColor: selected
      ? "rgba(241, 246, 255, 0.96)"
      : "rgba(216, 226, 245, 0.88)",
    stroke: selected
      ? "rgba(225, 234, 251, 0.88)"
      : "rgba(184, 202, 239, 0.34)",
  };
}

function distancePointToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        (dx * dx + dy * dy),
    ),
  );

  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
