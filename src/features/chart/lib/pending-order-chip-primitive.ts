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

export type PendingOrderChipDirection = "long" | "short";
export type PendingOrderChipStatus =
  | "live"
  | "placing"
  | "updating"
  | "canceling";
export type PendingOrderChipHitTarget = "drag" | "cancel";

export type PendingOrderChipModel = {
  direction: PendingOrderChipDirection;
  id: string;
  label: string;
  price: number;
  selected: boolean;
  sizeLabel: string;
  status: PendingOrderChipStatus;
};

export type PendingOrderChipRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type PendingOrderChipPalette = {
  border: string;
  cancelText: string;
  divider: string;
  fill: string;
  glow: string;
  labelText: string;
  sizeText: string;
};

export type PendingOrderChipLayout = {
  cancelRect: PendingOrderChipRect;
  chip: PendingOrderChipModel;
  id: string;
  labelRect: PendingOrderChipRect;
  lineY: number;
  palette: PendingOrderChipPalette;
  rect: PendingOrderChipRect;
  sizeRect: PendingOrderChipRect;
  stackIndex: number;
};

export type PendingOrderChipHit = {
  id: string;
  layout: PendingOrderChipLayout;
  target: PendingOrderChipHitTarget;
};

type ChartWithPriceScale = IChartApiBase<Time> & {
  priceScale: (id: string) => { width: () => number };
};

type PendingOrderChipLayoutInput = {
  chips: readonly PendingOrderChipModel[];
  paneHeight: number;
  paneWidth: number;
  priceScaleWidth: number;
  priceToCoordinate: (price: number) => number | null | undefined;
};

const CHIP_WIDTH = 222;
const CHIP_HEIGHT = 24;
const LABEL_WIDTH = 122;
const SIZE_WIDTH = 74;
const CANCEL_WIDTH = 26;
const EDGE_PADDING = 12;
const CHIP_RADIUS = 6;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function containsPoint(
  rect: PendingOrderChipRect,
  point: { x: number; y: number },
) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function scaleRect(
  rect: PendingOrderChipRect,
  horizontalPixelRatio: number,
  verticalPixelRatio: number,
): PendingOrderChipRect {
  return {
    height: rect.height * verticalPixelRatio,
    width: rect.width * horizontalPixelRatio,
    x: rect.x * horizontalPixelRatio,
    y: rect.y * verticalPixelRatio,
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  rect: PendingOrderChipRect,
  radius: number,
) {
  const r = Math.min(radius, rect.width / 2, rect.height / 2);

  context.beginPath();
  context.moveTo(rect.x + r, rect.y);
  context.lineTo(rect.x + rect.width - r, rect.y);
  context.quadraticCurveTo(
    rect.x + rect.width,
    rect.y,
    rect.x + rect.width,
    rect.y + r,
  );
  context.lineTo(rect.x + rect.width, rect.y + rect.height - r);
  context.quadraticCurveTo(
    rect.x + rect.width,
    rect.y + rect.height,
    rect.x + rect.width - r,
    rect.y + rect.height,
  );
  context.lineTo(rect.x + r, rect.y + rect.height);
  context.quadraticCurveTo(
    rect.x,
    rect.y + rect.height,
    rect.x,
    rect.y + rect.height - r,
  );
  context.lineTo(rect.x, rect.y + r);
  context.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
  context.closePath();
}

export function getPendingOrderChipPalette(
  direction: PendingOrderChipDirection,
  selected: boolean,
  status: PendingOrderChipStatus,
): PendingOrderChipPalette {
  const disabled = status === "canceling" || status === "updating";

  if (direction === "short") {
    return {
      border: selected
        ? "rgba(248, 113, 113, 0.82)"
        : disabled
          ? "rgba(148, 163, 184, 0.38)"
          : "rgba(239, 68, 68, 0.72)",
      cancelText: disabled
        ? "rgba(255, 255, 255, 0.34)"
        : "rgba(255, 255, 255, 0.57)",
      divider: "rgba(255, 255, 255, 0.07)",
      fill: "rgba(7, 17, 29, 0.96)",
      glow: selected ? "rgba(239, 68, 68, 0.13)" : "rgba(239, 68, 68, 0.06)",
      labelText: "rgba(255, 228, 230, 0.72)",
      sizeText: "rgba(255, 255, 255, 0.69)",
    };
  }

  return {
    border: selected
      ? "rgba(74, 222, 128, 0.82)"
      : disabled
        ? "rgba(148, 163, 184, 0.38)"
        : "rgba(34, 197, 94, 0.70)",
    cancelText: disabled
      ? "rgba(255, 255, 255, 0.34)"
      : "rgba(255, 255, 255, 0.57)",
    divider: "rgba(255, 255, 255, 0.07)",
    fill: "rgba(7, 17, 29, 0.96)",
    glow: selected ? "rgba(34, 197, 94, 0.13)" : "rgba(34, 197, 94, 0.06)",
    labelText: "rgba(220, 252, 231, 0.72)",
    sizeText: "rgba(255, 255, 255, 0.69)",
  };
}

export function buildPendingOrderChipLayouts({
  chips,
  paneHeight,
  paneWidth,
  priceScaleWidth,
  priceToCoordinate,
}: PendingOrderChipLayoutInput): PendingOrderChipLayout[] {
  const maxChipWidth = Math.max(
    150,
    paneWidth - priceScaleWidth - EDGE_PADDING * 2,
  );
  const chipWidth = Math.min(CHIP_WIDTH, maxChipWidth);
  const widthScale = chipWidth / CHIP_WIDTH;
  const labelWidth = Math.round(LABEL_WIDTH * widthScale);
  const cancelWidth = Math.max(22, Math.round(CANCEL_WIDTH * widthScale));
  const sizeWidth = Math.max(0, chipWidth - labelWidth - cancelWidth);
  const chipLeft = clamp(
    Math.round(paneWidth * 0.31),
    EDGE_PADDING,
    paneWidth - priceScaleWidth - chipWidth - EDGE_PADDING,
  );

  return chips
    .flatMap<PendingOrderChipLayout>((chip) => {
      const y = priceToCoordinate(chip.price);

      if (y === null || y === undefined || !Number.isFinite(y)) {
        return [];
      }

      if (y < -CHIP_HEIGHT || y > paneHeight + CHIP_HEIGHT) {
        return [];
      }

      const rect = {
        height: CHIP_HEIGHT,
        width: chipWidth,
        x: chipLeft,
        y: y - CHIP_HEIGHT / 2,
      };
      const labelRect = {
        height: CHIP_HEIGHT,
        width: labelWidth,
        x: rect.x,
        y: rect.y,
      };
      const sizeRect = {
        height: CHIP_HEIGHT,
        width: sizeWidth,
        x: labelRect.x + labelRect.width,
        y: rect.y,
      };
      const cancelRect = {
        height: CHIP_HEIGHT,
        width: cancelWidth,
        x: sizeRect.x + sizeRect.width,
        y: rect.y,
      };

      return [
        {
          cancelRect,
          chip,
          id: chip.id,
          labelRect,
          lineY: y,
          palette: getPendingOrderChipPalette(
            chip.direction,
            chip.selected,
            chip.status,
          ),
          rect,
          sizeRect,
          stackIndex: 0,
        },
      ];
    })
    .sort((left, right) => left.lineY - right.lineY)
    .map((layout, stackIndex) => ({
      ...layout,
      stackIndex,
    }));
}

export function hitTestPendingOrderChipLayouts(
  layouts: readonly PendingOrderChipLayout[],
  point: { x: number; y: number },
): PendingOrderChipHit | null {
  const hitLayouts = [...layouts].sort(
    (left, right) => left.stackIndex - right.stackIndex,
  );

  for (const layout of hitLayouts) {
    if (containsPoint(layout.cancelRect, point)) {
      return {
        id: layout.id,
        layout,
        target: "cancel",
      };
    }

    if (containsPoint(layout.labelRect, point)) {
      return {
        id: layout.id,
        layout,
        target: "drag",
      };
    }
  }

  return null;
}

class PendingOrderChipRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly buildLayouts: (
      paneWidth: number,
      paneHeight: number,
    ) => PendingOrderChipLayout[],
  ) {}

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace(
      ({ bitmapSize, context, horizontalPixelRatio, verticalPixelRatio }) => {
        const layouts = this.buildLayouts(
          bitmapSize.width / horizontalPixelRatio,
          bitmapSize.height / verticalPixelRatio,
        );

        if (layouts.length === 0) {
          return;
        }

        context.save();
        context.textBaseline = "middle";
        context.font = `700 ${12 * verticalPixelRatio}px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`;

        layouts
          .slice()
          .sort((left, right) => right.rect.y - left.rect.y)
          .forEach((layout) => {
            const rect = scaleRect(
              layout.rect,
              horizontalPixelRatio,
              verticalPixelRatio,
            );
            const labelRect = scaleRect(
              layout.labelRect,
              horizontalPixelRatio,
              verticalPixelRatio,
            );
            const sizeRect = scaleRect(
              layout.sizeRect,
              horizontalPixelRatio,
              verticalPixelRatio,
            );
            const cancelRect = scaleRect(
              layout.cancelRect,
              horizontalPixelRatio,
              verticalPixelRatio,
            );
            const radius = CHIP_RADIUS * horizontalPixelRatio;
            const centerY = rect.y + rect.height / 2;
            const strokeWidth = Math.max(0.5, 0.5 * horizontalPixelRatio);

            context.save();
            context.shadowBlur = layout.chip.selected
              ? 8 * horizontalPixelRatio
              : 4 * horizontalPixelRatio;
            context.shadowColor = layout.palette.glow;
            roundedRect(context, rect, radius);
            context.fillStyle = layout.palette.fill;
            context.fill();
            context.shadowBlur = 0;
            context.lineWidth = strokeWidth;
            context.strokeStyle = layout.palette.border;
            context.stroke();

            context.strokeStyle = layout.palette.divider;
            context.beginPath();
            context.moveTo(sizeRect.x, rect.y + strokeWidth);
            context.lineTo(sizeRect.x, rect.y + rect.height - strokeWidth);
            context.moveTo(cancelRect.x, rect.y + strokeWidth);
            context.lineTo(cancelRect.x, rect.y + rect.height - strokeWidth);
            context.stroke();

            context.fillStyle = layout.palette.labelText;
            context.textAlign = "left";
            context.fillText(
              layout.chip.label,
              labelRect.x + 10 * horizontalPixelRatio,
              centerY + 0.5 * verticalPixelRatio,
              Math.max(12, labelRect.width - 16 * horizontalPixelRatio),
            );

            context.fillStyle = layout.palette.sizeText;
            context.textAlign = "right";
            context.fillText(
              layout.chip.sizeLabel,
              sizeRect.x + sizeRect.width - 8 * horizontalPixelRatio,
              centerY + 0.5 * verticalPixelRatio,
              Math.max(12, sizeRect.width - 12 * horizontalPixelRatio),
            );

            context.fillStyle = layout.palette.cancelText;
            context.textAlign = "center";
            context.fillText(
              "x",
              cancelRect.x + cancelRect.width / 2,
              centerY + 0.5 * verticalPixelRatio,
            );
            context.restore();
          });

        context.restore();
      },
    );
  }
}

class PendingOrderChipPaneView implements IPrimitivePaneView {
  constructor(
    private readonly buildLayouts: (
      paneWidth: number,
      paneHeight: number,
    ) => PendingOrderChipLayout[],
  ) {}

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return new PendingOrderChipRenderer(this.buildLayouts);
  }
}

export class ChartPendingOrderChipPrimitive implements ISeriesPrimitive<Time> {
  private chart: ChartWithPriceScale | null = null;
  private chips: PendingOrderChipModel[] = [];
  private paneView = new PendingOrderChipPaneView((paneWidth, paneHeight) =>
    this.buildLayouts(paneWidth, paneHeight),
  );
  private requestUpdate: (() => void) | null = null;
  private series: ISeriesApi<"Candlestick", Time> | null = null;

  attached({
    chart,
    requestUpdate,
    series,
  }: SeriesAttachedParameter<Time, "Candlestick">) {
    this.chart = chart as ChartWithPriceScale;
    this.requestUpdate = requestUpdate;
    this.series = series;
    this.requestUpdate?.();
  }

  detached() {
    this.chart = null;
    this.requestUpdate = null;
    this.series = null;
  }

  updateAllViews() {}

  paneViews() {
    return [this.paneView];
  }

  setChips(chips: readonly PendingOrderChipModel[]) {
    this.chips = chips.filter(
      (chip) => Number.isFinite(chip.price) && chip.price > 0,
    );
    this.requestUpdate?.();
  }

  hitTestChip(
    point: { x: number; y: number },
    paneWidth: number,
    paneHeight: number,
  ) {
    return hitTestPendingOrderChipLayouts(
      this.buildLayouts(paneWidth, paneHeight),
      point,
    );
  }

  getLayout(
    orderId: string,
    paneWidth: number,
    paneHeight: number,
  ): PendingOrderChipLayout | null {
    return (
      this.buildLayouts(paneWidth, paneHeight).find(
        (layout) => layout.id === orderId,
      ) ?? null
    );
  }

  private buildLayouts(paneWidth: number, paneHeight: number) {
    const priceScaleWidth = this.chart?.priceScale("right").width() ?? 68;

    return buildPendingOrderChipLayouts({
      chips: this.chips,
      paneHeight,
      paneWidth,
      priceScaleWidth,
      priceToCoordinate: (price) => this.series?.priceToCoordinate(price),
    });
  }
}
