import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type {
  MagicTradeChartOverlay,
  MagicTradeChartOverlayStatus,
} from "@/features/tag-along/lib/magic-trade-chart-overlays";

type MagicTradeLineRenderData = {
  id: string;
  isSelected: boolean;
  phase: number;
  status: MagicTradeChartOverlayStatus;
  y: number;
};

type MagicTradeLineVisual = {
  alpha: number;
  gradientStops: Array<[number, string]>;
  lineWidth: number;
};

function getMagicTradeLineVisual(
  status: MagicTradeChartOverlayStatus,
  isSelected: boolean,
): MagicTradeLineVisual {
  if (status === "failed" || status === "skipped") {
    return {
      alpha: isSelected ? 0.76 : 0.58,
      gradientStops: [
        [0, "rgba(245, 158, 11, 0.26)"],
        [0.24, "rgba(251, 146, 60, 0.66)"],
        [0.5, "rgba(255, 237, 213, 0.56)"],
        [0.76, "rgba(251, 146, 60, 0.66)"],
        [1, "rgba(245, 158, 11, 0.26)"],
      ],
      lineWidth: isSelected ? 2 : 1.4,
    };
  }

  if (status === "executed") {
    return {
      alpha: isSelected ? 0.62 : 0.42,
      gradientStops: [
        [0, "rgba(148, 163, 184, 0.24)"],
        [0.32, "rgba(226, 232, 240, 0.46)"],
        [0.64, "rgba(100, 116, 139, 0.34)"],
        [1, "rgba(148, 163, 184, 0.24)"],
      ],
      lineWidth: isSelected ? 1.8 : 1.2,
    };
  }

  if (status === "triggered" || status === "executing") {
    return {
      alpha: 0.9,
      gradientStops: [
        [0, "rgba(51, 245, 255, 0.54)"],
        [0.2, "rgba(96, 165, 250, 0.88)"],
        [0.44, "rgba(139, 92, 246, 0.92)"],
        [0.68, "rgba(255, 61, 138, 0.56)"],
        [1, "rgba(51, 245, 255, 0.54)"],
      ],
      lineWidth: 2,
    };
  }

  if (status === "near-trigger") {
    return {
      alpha: isSelected ? 0.86 : 0.74,
      gradientStops: [
        [0, "rgba(51, 245, 255, 0.42)"],
        [0.24, "rgba(96, 165, 250, 0.74)"],
        [0.5, "rgba(139, 92, 246, 0.72)"],
        [0.76, "rgba(51, 245, 255, 0.58)"],
        [1, "rgba(51, 245, 255, 0.42)"],
      ],
      lineWidth: isSelected ? 2 : 1.6,
    };
  }

  return {
    alpha: isSelected ? 0.76 : 0.62,
    gradientStops: [
      [0, "rgba(51, 245, 255, 0.34)"],
      [0.22, "rgba(96, 165, 250, 0.64)"],
      [0.48, "rgba(139, 92, 246, 0.66)"],
      [0.74, "rgba(51, 245, 255, 0.52)"],
      [1, "rgba(51, 245, 255, 0.34)"],
    ],
    lineWidth: isSelected ? 2 : 1.4,
  };
}

function createFlowingHorizontalGradient(
  context: CanvasRenderingContext2D,
  width: number,
  stops: MagicTradeLineVisual["gradientStops"],
  phase: number,
) {
  const flowOffset = ((phase / 4200) % 1) * width;
  const gradient = context.createLinearGradient(-width + flowOffset, 0, width + flowOffset, 0);

  stops.forEach(([offset, color]) => {
    gradient.addColorStop(offset, color);
  });

  return gradient;
}

class MagicTradeOverlayRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly data: readonly MagicTradeLineRenderData[]) {}

  draw(target: CanvasRenderingTarget2D) {
    if (this.data.length === 0) {
      return;
    }

    target.useBitmapCoordinateSpace(({ bitmapSize, context, verticalPixelRatio }) => {
      this.data.forEach((line) => {
        const y = Math.round(line.y * verticalPixelRatio) + 0.5;
        const visual = getMagicTradeLineVisual(line.status, line.isSelected);
        const gradient = createFlowingHorizontalGradient(
          context,
          bitmapSize.width,
          visual.gradientStops,
          line.phase,
        );

        context.save();
        context.globalAlpha = visual.alpha;
        context.lineWidth = Math.max(1, visual.lineWidth * verticalPixelRatio);
        context.strokeStyle = gradient;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(bitmapSize.width, y);
        context.stroke();
        context.restore();
      });
    });
  }
}

class MagicTradeOverlayPaneView implements IPrimitivePaneView {
  private data: MagicTradeLineRenderData[] = [];

  update(
    series: ISeriesApi<"Candlestick", Time>,
    overlays: readonly MagicTradeChartOverlay[],
    selectedOverlayId: string | null,
    hoveredOverlayId: string | null,
    phase: number,
  ) {
    this.data = overlays.flatMap((overlay) => {
      const y = series.priceToCoordinate(overlay.level);

      if (y === null || y === undefined) {
        return [];
      }

      return [
        {
          id: overlay.id,
          isSelected: overlay.id === selectedOverlayId || overlay.id === hoveredOverlayId,
          phase,
          status: overlay.status,
          y,
        },
      ];
    });
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return new MagicTradeOverlayRenderer(this.data);
  }
}

export class ChartMagicTradeOverlayPrimitive implements ISeriesPrimitive<Time> {
  private animationFrameId: number | null = null;
  private hoveredOverlayId: string | null = null;
  private lastAnimationAt = 0;
  private overlays: MagicTradeChartOverlay[] = [];
  private paneView = new MagicTradeOverlayPaneView();
  private phase = 0;
  private requestUpdate: (() => void) | null = null;
  private selectedOverlayId: string | null = null;
  private series: ISeriesApi<"Candlestick", Time> | null = null;

  attached({ requestUpdate, series }: SeriesAttachedParameter<Time, "Candlestick">) {
    this.requestUpdate = requestUpdate;
    this.series = series;
    this.updateAllViews();
    this.requestUpdate?.();
    this.syncAnimationLoop();
  }

  detached() {
    this.stopAnimationLoop();
    this.requestUpdate = null;
    this.series = null;
  }

  updateAllViews() {
    if (!this.series) {
      return;
    }

    this.paneView.update(
      this.series,
      this.overlays,
      this.selectedOverlayId,
      this.hoveredOverlayId,
      this.phase,
    );
  }

  paneViews() {
    return [this.paneView];
  }

  setHoveredOverlayId(hoveredOverlayId: string | null) {
    this.hoveredOverlayId = hoveredOverlayId;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  setOverlays(overlays: readonly MagicTradeChartOverlay[]) {
    this.overlays = [...overlays];
    this.updateAllViews();
    this.requestUpdate?.();
    this.syncAnimationLoop();
  }

  setSelectedOverlayId(selectedOverlayId: string | null) {
    this.selectedOverlayId = selectedOverlayId;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  private syncAnimationLoop() {
    if (!this.requestUpdate || this.overlays.length === 0) {
      this.stopAnimationLoop();
      return;
    }

    if (this.animationFrameId !== null || typeof window === "undefined") {
      return;
    }

    const tick = (timestamp: number) => {
      if (!this.requestUpdate || this.overlays.length === 0) {
        this.animationFrameId = null;
        return;
      }

      if (timestamp - this.lastAnimationAt >= 50) {
        this.phase = timestamp;
        this.lastAnimationAt = timestamp;
        this.updateAllViews();
        this.requestUpdate();
      }

      this.animationFrameId = window.requestAnimationFrame(tick);
    };

    this.animationFrameId = window.requestAnimationFrame(tick);
  }

  private stopAnimationLoop() {
    if (this.animationFrameId === null || typeof window === "undefined") {
      this.animationFrameId = null;
      return;
    }

    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
}
