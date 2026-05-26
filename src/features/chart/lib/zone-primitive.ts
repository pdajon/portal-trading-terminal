import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitiveAxisView,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { ChartZone } from "@/features/chart/types";

type DraftZone = {
  topPrice: number;
  bottomPrice: number;
};

type ZonePrimitiveData = {
  bottomY: number;
  derivedOrderDirection: ChartZone["derivedOrderDirection"];
  derivedOrderType: ChartZone["derivedOrderType"];
  id: string;
  isDraft: boolean;
  isNoTrade: boolean;
  isSelected: boolean;
  pulseAlpha: number;
  pulseLineWidth: number;
  state: ChartZone["state"];
  topY: number;
};

type ZoneAxisMarkerData = {
  backColor: string;
  coordinate: number;
  id: string;
  isNoTrade: boolean;
  isSelected: boolean;
  text: string;
  textColor: string;
};

class ZoneAxisView implements ISeriesPrimitiveAxisView {
  constructor(private readonly data: ZoneAxisMarkerData) {}

  coordinate() {
    return this.data.coordinate;
  }

  text() {
    return this.data.text;
  }

  textColor() {
    return this.data.textColor;
  }

  backColor() {
    return this.data.backColor;
  }

  visible() {
    return true;
  }

  tickVisible() {
    return this.data.isSelected;
  }
}

class ZonePrimitiveRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly data: readonly ZonePrimitiveData[]) {}

  draw() {}

  drawBackground(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace(
      ({ bitmapSize, context, verticalPixelRatio }) => {
        this.data.forEach((zone) => {
          const top = Math.round(zone.topY * verticalPixelRatio);
          const bottom = Math.round(zone.bottomY * verticalPixelRatio);
          const height = bottom - top;

          if (height <= 0) {
            return;
          }

          const gradient = context.createLinearGradient(0, top, 0, bottom);

          const shouldPulseNoTradeEdges =
            zone.isNoTrade && (zone.state === "idle" || zone.state === "approaching");

          if (zone.isDraft) {
            gradient.addColorStop(0, "rgba(103, 232, 249, 0.10)");
            gradient.addColorStop(1, "rgba(14, 74, 92, 0.06)");
            context.strokeStyle = "rgba(103, 232, 249, 0.14)";
          } else if (zone.derivedOrderType && zone.derivedOrderDirection === "long") {
            gradient.addColorStop(
              0,
              zone.isSelected ? "rgba(34, 211, 238, 0.16)" : "rgba(34, 211, 238, 0.09)",
            );
            gradient.addColorStop(
              1,
              zone.isSelected ? "rgba(14, 74, 92, 0.11)" : "rgba(14, 74, 92, 0.06)",
            );
            context.strokeStyle = zone.isSelected
              ? "rgba(103, 232, 249, 0.28)"
              : "rgba(34, 211, 238, 0.16)";
          } else if (zone.derivedOrderType && zone.derivedOrderDirection === "short") {
            gradient.addColorStop(
              0,
              zone.isSelected ? "rgba(185, 28, 28, 0.18)" : "rgba(185, 28, 28, 0.10)",
            );
            gradient.addColorStop(
              1,
              zone.isSelected ? "rgba(76, 29, 29, 0.12)" : "rgba(76, 29, 29, 0.07)",
            );
            context.strokeStyle = zone.isSelected
              ? "rgba(248, 113, 113, 0.30)"
              : "rgba(239, 68, 68, 0.16)";
          } else if (zone.state === "broken") {
            gradient.addColorStop(0, "rgba(245, 158, 11, 0.13)");
            gradient.addColorStop(1, "rgba(92, 66, 42, 0.07)");
            context.strokeStyle = "rgba(245, 158, 11, 0.26)";
          } else if (zone.state === "rejected") {
            gradient.addColorStop(0, "rgba(103, 232, 249, 0.10)");
            gradient.addColorStop(1, "rgba(39, 53, 83, 0.06)");
            context.strokeStyle = "rgba(103, 232, 249, 0.18)";
          } else if (zone.state === "inside" && zone.isNoTrade) {
            gradient.addColorStop(0, "rgba(185, 28, 28, 0.18)");
            gradient.addColorStop(1, "rgba(82, 36, 44, 0.11)");
            context.strokeStyle = "rgba(239, 68, 68, 0.26)";
          } else if (zone.state === "inside") {
            gradient.addColorStop(0, "rgba(34, 211, 238, 0.10)");
            gradient.addColorStop(1, "rgba(47, 62, 95, 0.07)");
            context.strokeStyle = "rgba(103, 232, 249, 0.18)";
          } else if (zone.isNoTrade && zone.isSelected) {
            gradient.addColorStop(0, "rgba(185, 28, 28, 0.18)");
            gradient.addColorStop(1, "rgba(92, 40, 48, 0.12)");
            context.strokeStyle = `rgba(205, 108, 118, ${zone.pulseAlpha + 0.08})`;
          } else if (zone.isNoTrade) {
            gradient.addColorStop(0, "rgba(154, 81, 92, 0.10)");
            gradient.addColorStop(1, "rgba(78, 34, 42, 0.06)");
            context.strokeStyle = `rgba(176, 92, 103, ${zone.pulseAlpha})`;
          } else if (zone.state === "approaching") {
            gradient.addColorStop(0, "rgba(245, 158, 11, 0.10)");
            gradient.addColorStop(1, "rgba(42, 56, 85, 0.05)");
            context.strokeStyle = "rgba(245, 158, 11, 0.18)";
          } else if (zone.isSelected) {
            gradient.addColorStop(0, "rgba(103, 232, 249, 0.13)");
            gradient.addColorStop(1, "rgba(55, 72, 112, 0.08)");
            context.strokeStyle = "rgba(103, 232, 249, 0.22)";
          } else {
            gradient.addColorStop(0, "rgba(112, 132, 179, 0.06)");
            gradient.addColorStop(1, "rgba(39, 53, 83, 0.04)");
            context.strokeStyle = "rgba(200, 215, 248, 0.05)";
          }

          context.fillStyle = gradient;
          context.fillRect(0, top, bitmapSize.width, height);

          const baseLineWidth = Math.max(1, Math.floor(verticalPixelRatio));
          context.lineWidth = baseLineWidth;
          context.beginPath();
          context.moveTo(0, top + 0.5);
          context.lineTo(bitmapSize.width, top + 0.5);
          context.moveTo(0, bottom - 0.5);
          context.lineTo(bitmapSize.width, bottom - 0.5);
          context.stroke();

          if (shouldPulseNoTradeEdges) {
            context.save();
            context.lineWidth = zone.pulseLineWidth * verticalPixelRatio;
            context.strokeStyle = zone.isSelected
              ? `rgba(214, 114, 124, ${zone.pulseAlpha})`
              : `rgba(186, 96, 107, ${zone.pulseAlpha})`;
            context.beginPath();
            context.moveTo(0, top + 0.5);
            context.lineTo(bitmapSize.width, top + 0.5);
            context.moveTo(0, bottom - 0.5);
            context.lineTo(bitmapSize.width, bottom - 0.5);
            context.stroke();
            context.restore();
          }
        });
      },
    );
  }
}

class ZonePrimitivePaneView implements IPrimitivePaneView {
  private data: ZonePrimitiveData[] = [];

  update(
    series: ISeriesApi<"Area", Time>,
    zones: readonly ChartZone[],
    draftZone: DraftZone | null,
    pulseAlpha: number,
    pulseLineWidth: number,
    selectedZoneId: string | null,
  ) {
    const nextData: ZonePrimitiveData[] = zones
      .map((zone) =>
        this.toRenderData(
          series,
          zone.id,
          zone.topPrice,
          zone.bottomPrice,
          zone.derivedOrderDirection ?? null,
          zone.derivedOrderType ?? null,
          zone.isNoTrade,
          zone.state,
          false,
          pulseAlpha,
          pulseLineWidth,
          zone.id === selectedZoneId,
        ),
      )
      .filter((zone): zone is ZonePrimitiveData => zone !== null);

    if (draftZone) {
      const draftRenderData = this.toRenderData(
        series,
        "draft-zone",
        draftZone.topPrice,
        draftZone.bottomPrice,
        null,
        null,
        false,
        "idle",
        true,
        0,
        0,
        false,
      );

      if (draftRenderData) {
        nextData.push(draftRenderData);
      }
    }

    this.data = nextData;
  }

  zOrder() {
    return "bottom" as const;
  }

  renderer() {
    if (this.data.length === 0) {
      return null;
    }

    return new ZonePrimitiveRenderer(this.data);
  }

  private toRenderData(
    series: ISeriesApi<"Area", Time>,
    id: string,
    topPrice: number,
    bottomPrice: number,
    derivedOrderDirection: ChartZone["derivedOrderDirection"],
    derivedOrderType: ChartZone["derivedOrderType"],
    isNoTrade: boolean,
    state: ChartZone["state"],
    isDraft: boolean,
    pulseAlpha: number,
    pulseLineWidth: number,
    isSelected: boolean,
  ) {
    const upperY = series.priceToCoordinate(Math.max(topPrice, bottomPrice));
    const lowerY = series.priceToCoordinate(Math.min(topPrice, bottomPrice));

    if (upperY === null || lowerY === null) {
      return null;
    }

      return {
        bottomY: Math.max(upperY, lowerY),
        derivedOrderDirection,
        derivedOrderType,
        id,
      isDraft,
      isNoTrade,
      isSelected,
      pulseAlpha,
      pulseLineWidth,
      state,
      topY: Math.min(upperY, lowerY),
    };
  }
}

export class ChartZonesPrimitive implements ISeriesPrimitive<Time> {
  private animationFrameId: number | null = null;
  private axisViews: ISeriesPrimitiveAxisView[] = [];
  private draftZone: DraftZone | null = null;
  private paneView = new ZonePrimitivePaneView();
  private pulseAlpha = 0.12;
  private pulseLineWidth = 1.6;
  private requestUpdate: (() => void) | null = null;
  private selectedZoneId: string | null = null;
  private series: ISeriesApi<"Area", Time> | null = null;
  private zones: ChartZone[] = [];

  attached({ requestUpdate, series }: SeriesAttachedParameter<Time, "Area">) {
    this.requestUpdate = requestUpdate;
    this.series = series;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  detached() {
    this.stopPulseLoop();
    this.requestUpdate = null;
    this.series = null;
  }

  updateAllViews() {
    if (!this.series) {
      return;
    }

    this.paneView.update(
      this.series,
      this.zones,
      this.draftZone,
      this.pulseAlpha,
      this.pulseLineWidth,
      this.selectedZoneId,
    );
    this.axisViews = this.buildAxisViews();
  }

  paneViews() {
    return [this.paneView];
  }

  priceAxisViews() {
    return this.axisViews;
  }

  setDraftZone(zone: DraftZone | null) {
    this.draftZone = zone;
    this.requestUpdate?.();
  }

  setZones(zones: readonly ChartZone[]) {
    this.zones = [...zones];
    this.syncPulseLoop();
    this.requestUpdate?.();
  }

  setSelectedZoneId(zoneId: string | null) {
    this.selectedZoneId = zoneId;
    this.requestUpdate?.();
  }

  private syncPulseLoop() {
    const hasNoTradeZones = this.zones.some((zone) => zone.isNoTrade);

    if (hasNoTradeZones && this.animationFrameId === null) {
      this.startPulseLoop();
      return;
    }

    if (!hasNoTradeZones) {
      this.stopPulseLoop();
      this.pulseAlpha = 0.12;
      this.pulseLineWidth = 1.6;
    }
  }

  private startPulseLoop() {
    const animate = (timestamp: number) => {
      const cycleProgress = (timestamp % 3600) / 3600;
      const easedWave = (1 - Math.cos(cycleProgress * Math.PI * 2)) / 2;

      this.pulseAlpha = 0.10 + easedWave * 0.10;
      this.pulseLineWidth = 1 + easedWave * 0.8;
      this.requestUpdate?.();
      this.animationFrameId = window.requestAnimationFrame(animate);
    };

    this.animationFrameId = window.requestAnimationFrame(animate);
  }

  private stopPulseLoop() {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private buildAxisViews(): ISeriesPrimitiveAxisView[] {
    if (!this.series) {
      return [];
    }

    const nextAxisViews: ISeriesPrimitiveAxisView[] = [];

    this.zones.forEach((zone) => {
      const isSelected = zone.id === this.selectedZoneId;
      const topAxisView = this.createAxisView(
        `${zone.id}:top`,
        zone.topPrice,
        isSelected,
      );
      const bottomAxisView = this.createAxisView(
        `${zone.id}:bottom`,
        zone.bottomPrice,
        isSelected,
      );

      if (topAxisView) {
        nextAxisViews.push(topAxisView);
      }

      if (bottomAxisView) {
        nextAxisViews.push(bottomAxisView);
      }
    });

    return nextAxisViews;
  }

  private createAxisView(id: string, price: number, isSelected: boolean) {
    if (!this.series) {
      return null;
    }

    const coordinate = this.series.priceToCoordinate(price);

    if (coordinate === null) {
      return null;
    }

    return new ZoneAxisView({
      backColor: isSelected ? "rgba(34, 211, 238, 0.20)" : "rgba(122, 141, 185, 0.08)",
      coordinate,
      id,
      isNoTrade: false,
      isSelected,
      text: this.series.priceFormatter().format(price),
      textColor: isSelected ? "rgba(236, 253, 255, 0.92)" : "rgba(201, 211, 235, 0.46)",
    });
  }
}
