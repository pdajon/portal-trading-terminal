import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { ChartTradePlan } from "@/types/trade";

type TradePlanPriceState =
  | "beyond-stop"
  | "risk-zone"
  | "profit-zone"
  | "beyond-target"
  | null;

type TradePlanRenderData = {
  entryY: number;
  entryFocusActive: boolean;
  rewardAlpha: number;
  rewardLineColor: string;
  rewardTopY: number;
  rewardBottomY: number;
  riskAlpha: number;
  riskLineColor: string;
  riskTopY: number;
  riskBottomY: number;
};

class TradePlanPrimitiveRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly data: TradePlanRenderData | null) {}

  draw() {}

  drawBackground(target: CanvasRenderingTarget2D) {
    if (!this.data) {
      return;
    }

    const data = this.data;

    target.useBitmapCoordinateSpace(({ bitmapSize, context, verticalPixelRatio }) => {
      const rewardTop = Math.round(data.rewardTopY * verticalPixelRatio);
      const rewardBottom = Math.round(data.rewardBottomY * verticalPixelRatio);
      const riskTop = Math.round(data.riskTopY * verticalPixelRatio);
      const riskBottom = Math.round(data.riskBottomY * verticalPixelRatio);
      const entryY = Math.round(data.entryY * verticalPixelRatio);
      const entryFocusHeight = Math.max(6, Math.round(10 * verticalPixelRatio));

      if (data.entryFocusActive) {
        const gradient = context.createLinearGradient(
          0,
          entryY - entryFocusHeight,
          0,
          entryY + entryFocusHeight,
        );
        gradient.addColorStop(0, "rgba(103, 232, 249, 0)");
        gradient.addColorStop(0.5, "rgba(103, 232, 249, 0.08)");
        gradient.addColorStop(1, "rgba(103, 232, 249, 0)");

        context.fillStyle = gradient;
        context.fillRect(
          0,
          entryY - entryFocusHeight,
          bitmapSize.width,
          entryFocusHeight * 2,
        );
      }

      context.fillStyle = `rgba(34, 211, 238, ${data.rewardAlpha})`;
      context.fillRect(
        0,
        Math.min(rewardTop, rewardBottom),
        bitmapSize.width,
        Math.abs(rewardBottom - rewardTop),
      );

      context.fillStyle = `rgba(152, 72, 80, ${data.riskAlpha})`;
      context.fillRect(
        0,
        Math.min(riskTop, riskBottom),
        bitmapSize.width,
        Math.abs(riskBottom - riskTop),
      );

      context.lineWidth = Math.max(1, Math.floor(verticalPixelRatio));

      context.strokeStyle = data.rewardLineColor;
      context.beginPath();
      context.moveTo(0, rewardTop + 0.5);
      context.lineTo(bitmapSize.width, rewardTop + 0.5);
      context.stroke();

      context.strokeStyle = data.riskLineColor;
      context.beginPath();
      context.moveTo(0, riskBottom + 0.5);
      context.lineTo(bitmapSize.width, riskBottom + 0.5);
      context.stroke();

      context.strokeStyle = "rgba(225, 232, 248, 0.12)";
      context.beginPath();
      context.moveTo(0, entryY + 0.5);
      context.lineTo(bitmapSize.width, entryY + 0.5);
      context.stroke();
    });
  }
}

class TradePlanPrimitivePaneView implements IPrimitivePaneView {
  private data: TradePlanRenderData | null = null;

  update(
    series: ISeriesApi<"Area", Time>,
    tradePlan: ChartTradePlan | null,
    tradePlanPriceState: TradePlanPriceState,
    entryFocusActive: boolean,
  ) {
    if (!tradePlan) {
      this.data = null;
      return;
    }

    const entryY = series.priceToCoordinate(tradePlan.entry);
    const stopY = series.priceToCoordinate(tradePlan.stop);
    const targetY = series.priceToCoordinate(tradePlan.target);

    if (entryY === null || stopY === null || targetY === null) {
      this.data = null;
      return;
    }

    const risk = Math.abs(tradePlan.entry - tradePlan.stop);
    const reward = Math.abs(tradePlan.target - tradePlan.entry);
    const rr = risk > 0 ? reward / risk : 0;

    let rewardAlpha = 0.07;
    let rewardLineColor = "rgba(34, 211, 238, 0.12)";
    let riskAlpha = 0.10;
    let riskLineColor = "rgba(212, 104, 116, 0.14)";

    if (rr < 1) {
      rewardAlpha = 0.05;
      rewardLineColor = "rgba(245, 158, 11, 0.12)";
      riskAlpha = 0.16;
      riskLineColor = "rgba(239, 68, 68, 0.22)";
    } else if (rr < 2) {
      rewardAlpha = 0.07;
      rewardLineColor = "rgba(34, 211, 238, 0.12)";
      riskAlpha = 0.10;
      riskLineColor = "rgba(212, 104, 116, 0.14)";
    } else if (rr < 3) {
      rewardAlpha = 0.09;
      rewardLineColor = "rgba(34, 211, 238, 0.16)";
      riskAlpha = 0.09;
      riskLineColor = "rgba(212, 104, 116, 0.13)";
    } else {
      rewardAlpha = 0.11;
      rewardLineColor = "rgba(103, 232, 249, 0.20)";
      riskAlpha = 0.08;
      riskLineColor = "rgba(212, 104, 116, 0.12)";
    }

    if (tradePlanPriceState === "risk-zone") {
      riskAlpha = Math.max(riskAlpha, 0.22);
      riskLineColor = "rgba(239, 68, 68, 0.34)";
      rewardAlpha = Math.min(rewardAlpha, 0.05);
    } else if (tradePlanPriceState === "profit-zone") {
      rewardAlpha = Math.max(rewardAlpha, 0.16);
      rewardLineColor = "rgba(103, 232, 249, 0.30)";
      riskAlpha = Math.min(riskAlpha, 0.06);
    } else if (tradePlanPriceState === "beyond-target") {
      rewardAlpha = Math.max(rewardAlpha, 0.14);
      rewardLineColor = "rgba(125, 249, 255, 0.32)";
    }

    this.data = {
      entryY,
      entryFocusActive,
      rewardAlpha,
      rewardLineColor,
      rewardBottomY: Math.max(entryY, targetY),
      rewardTopY: Math.min(entryY, targetY),
      riskAlpha,
      riskLineColor,
      riskBottomY: Math.max(entryY, stopY),
      riskTopY: Math.min(entryY, stopY),
    };
  }

  zOrder() {
    return "bottom" as const;
  }

  renderer() {
    return new TradePlanPrimitiveRenderer(this.data);
  }
}

export class ChartTradePlanPrimitive implements ISeriesPrimitive<Time> {
  private paneView = new TradePlanPrimitivePaneView();
  private entryFocusActive = false;
  private requestUpdate: (() => void) | null = null;
  private tradePlanPriceState: TradePlanPriceState = null;
  private series: ISeriesApi<"Area", Time> | null = null;
  private tradePlan: ChartTradePlan | null = null;

  attached({ requestUpdate, series }: SeriesAttachedParameter<Time, "Area">) {
    this.requestUpdate = requestUpdate;
    this.series = series;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  detached() {
    this.requestUpdate = null;
    this.series = null;
  }

  updateAllViews() {
    if (!this.series) {
      return;
    }

    this.paneView.update(
      this.series,
      this.tradePlan,
      this.tradePlanPriceState,
      this.entryFocusActive,
    );
  }

  paneViews() {
    return [this.paneView];
  }

  setTradePlan(tradePlan: ChartTradePlan | null) {
    this.tradePlan = tradePlan;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  setTradePlanPriceState(tradePlanPriceState: TradePlanPriceState) {
    this.tradePlanPriceState = tradePlanPriceState;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  setEntryFocusActive(entryFocusActive: boolean) {
    this.entryFocusActive = entryFocusActive;
    this.updateAllViews();
    this.requestUpdate?.();
  }
}
