import type { MarketSymbol } from "@/types/market";
import type { OrderZoneDistribution, TradeDirection } from "@/types/trade";

export type PriceCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type ChartLevelSource = "manual-input" | "chart-click";
export type ChartZoneSource = "context-menu-drag";
export type ChartZoneState =
  | "idle"
  | "approaching"
  | "inside"
  | "rejected"
  | "broken";

export type ChartLevel = {
  id: string;
  price: number;
  createdAt: string;
  source: ChartLevelSource;
  symbol: MarketSymbol["symbol"];
};

export type ChartDrawingTool =
  | "trend-line"
  | "vertical-ray"
  | "measure"
  | "fibonacci";

export type ChartTrendLineSource =
  | "context-menu-two-point"
  | "context-menu-vertical-ray"
  | "context-menu-measurement"
  | "context-menu-fibonacci";

export type ChartTrendLine = {
  id: string;
  createdAt: string;
  customLabel?: string;
  endPrice: number;
  endTime: number;
  isHidden?: boolean;
  isLocked?: boolean;
  source: ChartTrendLineSource;
  startPrice: number;
  startTime: number;
  symbol: MarketSymbol["symbol"];
};

export type ChartTrendLineUpdate = Partial<
  Pick<
    ChartTrendLine,
    | "customLabel"
    | "endPrice"
    | "endTime"
    | "isHidden"
    | "isLocked"
    | "startPrice"
    | "startTime"
  >
>;

export type ChartLineTriggerStatus = "armed" | "firing";
export type ChartLineTriggerTargetType = "horizontal-level";
export type ChartLineTriggerCondition = "touch" | "close-above" | "close-below";

export type ChartLineTrigger = {
  condition: ChartLineTriggerCondition;
  id: string;
  createdAt: string;
  direction: TradeDirection;
  status: ChartLineTriggerStatus;
  symbol: MarketSymbol["symbol"];
  targetId: string;
  targetType: ChartLineTriggerTargetType;
};

export type ChartZone = {
  id: string;
  topPrice: number;
  bottomPrice: number;
  createdAt: string;
  derivedOrderType?: "mid-zone" | "order-zone" | null;
  derivedOrderDirection?: TradeDirection | null;
  orderZoneCount?: number | null;
  orderZoneDistribution?: OrderZoneDistribution | null;
  isNoTrade: boolean;
  lastInteraction?: string;
  state: ChartZoneState;
  source: ChartZoneSource;
  symbol: MarketSymbol["symbol"];
};

export type ChartSelection =
  | {
      id: string;
      type: "level";
    }
  | {
      id: string;
      type: "trend-line";
    }
  | {
      id: string;
      type: "zone";
    }
  | {
      id: string;
      type: "trade-plan";
    }
  | {
      id: string;
      type: "pending-order";
    };

export function formatChartPriceInput(price: number) {
  const normalizedPrice = price >= 1000 ? Math.round(price) : Number(price.toFixed(2));

  if (Number.isInteger(normalizedPrice)) {
    return String(normalizedPrice);
  }

  return normalizedPrice.toFixed(2).replace(/\.?0+$/, "");
}
