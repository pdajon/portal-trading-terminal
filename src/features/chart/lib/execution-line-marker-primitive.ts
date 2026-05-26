import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

export type ExecutionLineMarkerTone =
  | "entry"
  | "take-profit"
  | "stop-loss"
  | "limit-long"
  | "limit-short"
  | "buy-fill"
  | "sell-fill"
  | "liquidation";

export type ChartExecutionLineMarker = {
  id: string;
  label: "Entry" | "TP" | "SL" | "Limit" | "Liq" | "B" | "S";
  price: number;
  selected?: boolean;
  time?: number;
  tone: ExecutionLineMarkerTone;
};

type ExecutionLineMarkerRenderData = ChartExecutionLineMarker & {
  kind: "line-marker" | "trade-chip";
  x?: number;
  xOffset: number;
  y: number;
};

type ExecutionLineMarkerPalette = {
  border: string;
  fill: string;
  glow: string;
  text: string;
};

function getMarkerPalette(
  tone: ExecutionLineMarkerTone,
  selected: boolean,
): ExecutionLineMarkerPalette {
  if (tone === "buy-fill") {
    return {
      border: selected
        ? "rgba(125, 249, 255, 0.92)"
        : "rgba(45, 212, 191, 0.80)",
      fill: "rgba(8, 39, 42, 0.94)",
      glow: selected ? "rgba(45, 212, 191, 0.22)" : "rgba(45, 212, 191, 0.10)",
      text: "rgba(224, 252, 255, 0.96)",
    };
  }

  if (tone === "sell-fill") {
    return {
      border: selected
        ? "rgba(248, 113, 113, 0.88)"
        : "rgba(239, 68, 68, 0.78)",
      fill: "rgba(44, 12, 18, 0.94)",
      glow: selected ? "rgba(239, 68, 68, 0.20)" : "rgba(239, 68, 68, 0.09)",
      text: "rgba(254, 226, 226, 0.96)",
    };
  }

  if (tone === "take-profit") {
    return {
      border: selected
        ? "rgba(125, 249, 255, 0.82)"
        : "rgba(45, 212, 191, 0.66)",
      fill: "rgba(8, 31, 35, 0.90)",
      glow: selected ? "rgba(34, 211, 238, 0.14)" : "rgba(34, 211, 238, 0.05)",
      text: "rgba(207, 250, 254, 0.94)",
    };
  }

  if (tone === "stop-loss" || tone === "liquidation") {
    return {
      border: selected
        ? "rgba(248, 113, 113, 0.82)"
        : "rgba(239, 68, 68, 0.66)",
      fill: "rgba(42, 13, 18, 0.91)",
      glow: selected ? "rgba(239, 68, 68, 0.13)" : "rgba(239, 68, 68, 0.05)",
      text: "rgba(254, 226, 226, 0.94)",
    };
  }

  if (tone === "limit-short") {
    return {
      border: selected
        ? "rgba(251, 113, 133, 0.78)"
        : "rgba(244, 114, 182, 0.58)",
      fill: "rgba(35, 15, 27, 0.90)",
      glow: selected
        ? "rgba(244, 114, 182, 0.12)"
        : "rgba(244, 114, 182, 0.04)",
      text: "rgba(255, 228, 230, 0.90)",
    };
  }

  return {
    border: selected
      ? "rgba(125, 249, 255, 0.78)"
      : "rgba(103, 232, 249, 0.58)",
    fill:
      tone === "limit-long"
        ? "rgba(8, 30, 42, 0.90)"
        : "rgba(12, 24, 38, 0.90)",
    glow: selected ? "rgba(103, 232, 249, 0.12)" : "rgba(103, 232, 249, 0.04)",
    text: "rgba(224, 252, 255, 0.92)",
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

class ExecutionLineMarkerRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly data: readonly ExecutionLineMarkerRenderData[],
  ) {}

  draw(target: CanvasRenderingTarget2D) {
    if (this.data.length === 0) {
      return;
    }

    target.useBitmapCoordinateSpace(
      ({ bitmapSize, context, horizontalPixelRatio, verticalPixelRatio }) => {
        const fontSize = 10 * verticalPixelRatio;
        const markerHeight = 20 * verticalPixelRatio;
        const minMarkerWidth = 48 * horizontalPixelRatio;
        const paddingX = 11 * horizontalPixelRatio;
        const radius = 2 * horizontalPixelRatio;
        const fixedLeft = 72 * horizontalPixelRatio;
        const edgePadding = 14 * horizontalPixelRatio;
        const bottomPadding = 16 * verticalPixelRatio;

        context.save();
        context.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`;
        context.textBaseline = "middle";

        this.data.forEach((marker) => {
          const label = marker.label;
          const palette = getMarkerPalette(
            marker.tone,
            Boolean(marker.selected),
          );
          const lineY = Math.round(marker.y * verticalPixelRatio) + 0.5;

          if (marker.kind === "trade-chip" && marker.x !== undefined) {
            const chipSize = 24 * verticalPixelRatio;
            const chipRadius = chipSize / 2;
            const centerX = clamp(
              marker.x * horizontalPixelRatio,
              edgePadding + chipRadius,
              Math.max(edgePadding + chipRadius, bitmapSize.width - chipRadius - edgePadding),
            );
            const centerY = clamp(
              marker.y * verticalPixelRatio - chipRadius * 0.82,
              edgePadding + chipRadius,
              Math.max(edgePadding + chipRadius, bitmapSize.height - chipRadius - bottomPadding),
            );

            context.save();
            context.shadowColor = palette.glow;
            context.shadowBlur = marker.selected
              ? 10 * horizontalPixelRatio
              : 5 * horizontalPixelRatio;
            context.beginPath();
            context.arc(centerX, centerY, chipRadius, 0, Math.PI * 2);
            context.fillStyle = palette.fill;
            context.fill();
            context.shadowBlur = 0;
            context.lineWidth = Math.max(1, 1.15 * horizontalPixelRatio);
            context.strokeStyle = palette.border;
            context.stroke();
            context.fillStyle = palette.text;
            context.textAlign = "center";
            context.fillText(label, centerX, centerY + 0.5 * verticalPixelRatio);
            context.restore();
            return;
          }

          const measuredWidth = context.measureText(label).width + paddingX * 2;
          const markerWidth = Math.max(minMarkerWidth, measuredWidth);
          const x = clamp(
            fixedLeft + marker.xOffset * horizontalPixelRatio,
            edgePadding,
            Math.max(edgePadding, bitmapSize.width - markerWidth - edgePadding),
          );
          const flipsAbove =
            lineY + markerHeight > bitmapSize.height - bottomPadding;
          const markerY = flipsAbove ? lineY - markerHeight : lineY;
          const textX = x + markerWidth / 2;
          const textY = markerY + markerHeight / 2;

          context.save();
          context.shadowColor = palette.glow;
          context.shadowBlur = marker.selected
            ? 8 * horizontalPixelRatio
            : 3 * horizontalPixelRatio;
          roundedRect(context, x, markerY, markerWidth, markerHeight, radius);
          context.fillStyle = palette.fill;
          context.fill();
          context.shadowBlur = 0;
          context.lineWidth = Math.max(1, 1.2 * horizontalPixelRatio);
          context.strokeStyle = palette.border;
          context.stroke();

          context.fillStyle = palette.text;
          context.textAlign = "center";
          context.fillText(label, textX, textY);
          context.restore();
        });

        context.restore();
      },
    );
  }
}

class ExecutionLineMarkerPaneView implements IPrimitivePaneView {
  private data: ExecutionLineMarkerRenderData[] = [];

  update(
    chart: IChartApiBase<Time>,
    series: ISeriesApi<"Candlestick", Time>,
    markers: readonly ChartExecutionLineMarker[],
  ) {
    const renderMarkers: ExecutionLineMarkerRenderData[] = markers
      .flatMap<ExecutionLineMarkerRenderData>((marker) => {
        const y = series.priceToCoordinate(marker.price);
        const x =
          typeof marker.time === "number"
            ? chart.timeScale().timeToCoordinate(marker.time as Time)
            : null;

        if (y === null || y === undefined || !Number.isFinite(y)) {
          return [];
        }

        if (typeof marker.time === "number") {
          if (x === null || x === undefined || !Number.isFinite(x)) {
            return [];
          }

          return [{ ...marker, kind: "trade-chip" as const, x, xOffset: 0, y }];
        }

        return [{ ...marker, kind: "line-marker" as const, xOffset: 0, y }];
      })
      .sort((a, b) => a.y - b.y);
    const laneOffsets = [0, 68, 136, 204, 272];

    this.data = renderMarkers.map((marker, index) => {
      const nearbyBeforeCount = renderMarkers
        .slice(0, index)
        .filter((candidate) => Math.abs(candidate.y - marker.y) < 28).length;

      return {
        ...marker,
        xOffset: laneOffsets[nearbyBeforeCount % laneOffsets.length],
      };
    });
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return new ExecutionLineMarkerRenderer(this.data);
  }
}

export class ChartExecutionLineMarkerPrimitive implements ISeriesPrimitive<Time> {
  private markers: ChartExecutionLineMarker[] = [];
  private paneView = new ExecutionLineMarkerPaneView();
  private chart: IChartApiBase<Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private series: ISeriesApi<"Candlestick", Time> | null = null;

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

    this.paneView.update(this.chart, this.series, this.markers);
  }

  paneViews() {
    return [this.paneView];
  }

  setMarkers(markers: readonly ChartExecutionLineMarker[]) {
    this.markers = markers.filter(
      (marker) => Number.isFinite(marker.price) && marker.price > 0,
    );
    this.updateAllViews();
    this.requestUpdate?.();
  }
}
