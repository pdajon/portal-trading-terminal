import type { HyperliquidSymbol } from "@/types/market";

export type TradeDirection = "long" | "short";
export type TradeMarginMode = "cross" | "isolated";

export type AvailableToTradeBySide = Record<TradeDirection, number | null>;

export type JournalChartSnapshot = {
  fullBlob: Blob;
  fullHeight: number;
  fullWidth: number;
  marker: JournalChartSnapshotMarker | null;
  previewBlob: Blob;
  previewHeight: number;
  previewWidth: number;
};

export type JournalChartSnapshotMarker = {
  label: string;
  price: number;
  tone: "entry" | "exit";
  yPercent: number | null;
};

export type JournalChartSnapshotCaptureOptions = {
  markerLabel?: string;
  markerPrice?: number | null;
  markerTone?: "entry" | "exit";
};

export type PlannedTrade = {
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  positionSizeUsd?: number;
};

export type DraftChartTradePlan = {
  symbol: HyperliquidSymbol;
  entry: number;
  stop?: number;
  target?: number;
};

export type ChartTradePlan = {
  id: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  entry: number;
  stop: number;
  target: number;
  riskAmount: number;
  positionSize: number;
  createdAt: string;
};

export type ActivePosition = {
  id: string;
  executionId: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  entry: number;
  size: number;
  createdAt: string;
  entryOrderId: number | null;
};

export type ExecutionOrderStatus =
  | "pending"
  | "accepted"
  | "filled"
  | "live"
  | "rejected"
  | "missing"
  | "closed";

export type ExecutionOrderSummary = {
  executionId: string;
  id: number | null;
  status: ExecutionOrderStatus;
};

export type ExecutionFinalResult =
  | "success"
  | "entry failed";

export type ExecutionSummary = {
  executionId: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  intendedSize: number;
  normalizedSize: number;
  actualFilledSize: number;
  allocationPercent?: number;
  conversionPrice?: number;
  estimatedNotionalUsdc?: number | null;
  fillPrice: number;
  entryOrder: ExecutionOrderSummary;
  finalPositionState: unknown;
  finalResult: ExecutionFinalResult;
  intendedNotionalUsdc?: number;
  sizingUnit?: "base" | "notional_usdc";
  timestamp: number;
};

export type PendingOrderStatus =
  | "placing"
  | "canceling"
  | "updating"
  | "live"
  | "filled"
  | "rejected"
  | "canceled";

export type OrderZoneDistribution = "even" | "top-heavy" | "bottom-heavy";

export type PendingLimitOrder = {
  id: string;
  placementId: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  requestedPrice: number;
  normalizedPrice: number;
  requestedSize: number;
  normalizedSize: number;
  orderId: number | null;
  status: PendingOrderStatus;
  source: "horizontal-line" | "mid-zone" | "order-zone" | "limit-close";
  reduceOnly?: boolean;
  parentZoneId?: string | null;
  orderZoneCount?: number | null;
  orderZoneDistribution?: OrderZoneDistribution | null;
  orderZoneIndex?: number | null;
  createdAt: string;
};

export type LivePendingOrder = {
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  createdAt: string;
  price: number;
  size: number;
  originalSize?: number | null;
  orderId: number;
  reduceOnly?: boolean;
  triggerCondition?: string | null;
  triggerPrice?: number | null;
  triggerType?: string | null;
  status: "live";
};

export type LimitOrderPlacementFinalResult =
  | "live"
  | "filled"
  | "rejected";

export type LimitOrderPlacementSummary = {
  placementId: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  intendedPrice: number;
  normalizedPrice: number;
  intendedSize: number;
  normalizedSize: number;
  limitOrder: ExecutionOrderSummary;
  actualFilledSize: number;
  fillPrice: number;
  finalPositionState: unknown;
  finalResult: LimitOrderPlacementFinalResult;
  timestamp: number;
};

export type PendingOrderCancelFinalResult =
  | "canceled"
  | "already closed";

export type PendingOrderCancelSummary = {
  cancelId: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  orderId: number;
  finalResult: PendingOrderCancelFinalResult;
  finalPositionState: unknown;
  timestamp: number;
};

export type ZoneDerivedOrderCancelItemStatus =
  | "canceled"
  | "already closed";

export type ZoneDerivedOrderCancelSummaryItem = {
  localOrderId: string;
  orderId: number | null;
  currentPrice: number;
  normalizedCurrentPrice: number;
  intendedSize: number;
  normalizedSize: number;
  status: ZoneDerivedOrderCancelItemStatus;
};

export type ZoneDerivedOrderCancelFinalResult =
  | "canceled"
  | "already closed";

export type ZoneDerivedOrderCancelSummary = {
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  canceledOrders: ZoneDerivedOrderCancelSummaryItem[];
  finalPositionState: unknown;
  finalResult: ZoneDerivedOrderCancelFinalResult;
  timestamp: number;
};

export type PendingOrderReplaceFinalResult =
  | "live"
  | "filled"
  | "already closed"
  | "restored";

export type PendingOrderReplaceSummary = {
  replaceId: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  previousOrderId: number;
  intendedPrice: number;
  normalizedPrice: number;
  intendedSize: number;
  normalizedSize: number;
  replacementOrder: ExecutionOrderSummary;
  actualFilledSize: number;
  fillPrice: number;
  finalPositionState: unknown;
  finalResult: PendingOrderReplaceFinalResult;
  timestamp: number;
};

export type OrderZonePlacementSummaryItem = {
  actualFilledSize: number;
  direction: TradeDirection;
  fillPrice: number;
  finalResult: LimitOrderPlacementFinalResult;
  intendedPrice: number;
  intendedSize: number;
  limitOrder: ExecutionOrderSummary;
  normalizedPrice: number;
  normalizedSize: number;
  placementId: string;
  symbol: HyperliquidSymbol;
  timestamp: number;
};

export type OrderZonePlacementSummary = {
  direction: TradeDirection;
  filledOrders: OrderZonePlacementSummaryItem[];
  liveOrders: OrderZonePlacementSummaryItem[];
  rejectedOrders: Array<{
    error: string;
    intendedPrice: number;
    placementId: string;
  }>;
  symbol: HyperliquidSymbol;
  timestamp: number;
};

export type ZoneDerivedOrderUpdateItemStatus = "live" | "missing";

export type ZoneDerivedOrderUpdateSummaryItem = {
  localOrderId: string;
  orderId: number;
  intendedPrice: number;
  normalizedPrice: number;
  intendedSize: number;
  normalizedSize: number;
  status: ZoneDerivedOrderUpdateItemStatus;
};

export type ZoneDerivedOrderUpdateFinalResult =
  | "updated"
  | "partially filled"
  | "already closed";

export type ZoneDerivedOrderUpdateSummary = {
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  updatedOrders: ZoneDerivedOrderUpdateSummaryItem[];
  finalPositionState: unknown;
  finalResult: ZoneDerivedOrderUpdateFinalResult;
  timestamp: number;
};

export type ProtectionSyncFinalResult =
  | "success"
  | "protection failed";

export type ProtectionSummary = {
  protectionId: string;
  positionExecutionId: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  actualPositionSize: number;
  actualEntry: number;
  stop: number;
  target: number;
  tpOrder: ExecutionOrderSummary;
  slOrder: ExecutionOrderSummary;
  finalPositionState: unknown;
  finalResult: ProtectionSyncFinalResult;
  timestamp: number;
};

export type ProtectionRemovalFinalResult = "canceled" | "already cleared";

export type ProtectionRemovalSummary = {
  cancelId: string;
  canceledOrderCount: number;
  finalResult: ProtectionRemovalFinalResult;
  symbol: HyperliquidSymbol;
  timestamp: number;
};

export type LiveProtectionStatus = "live" | "missing";
export type LiveExchangePositionSyncStatus = "exchange" | "confirmed-execution";

export type LiveExchangePosition = {
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  size: number;
  leverageValue: number | null;
  entryPrice: number;
  markPrice: number;
  pnlUsd: number;
  pnlPercent: number;
  positionValueUsd: number | null;
  marginUsedUsd: number | null;
  fundingUsd: number | null;
  liquidationPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  tpStatus: LiveProtectionStatus;
  slStatus: LiveProtectionStatus;
  tpOrderId: number | null;
  slOrderId: number | null;
  protectionMissing: boolean;
  syncStatus?: LiveExchangePositionSyncStatus;
};

export type Position = {
  id: string;
  symbol: string;
  side: TradeDirection;
  size: string;
  entryPrice: number;
  markPrice: number;
  pnl: number;
};

export type OrderHistoryItem = {
  id: string;
  symbol: string;
  side: TradeDirection;
  type: "market" | "limit";
  status: "filled" | "canceled" | "open";
  price: number;
  size: string;
  placedAt: string;
};

export type PreparedExecutionPayload = {
  symbol: HyperliquidSymbol;
  side: TradeDirection;
  orderType: "market";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  sizeUsd: number;
  estimatedQuantity: number;
  riskRewardRatio: number;
  reduceOnly: false;
  environment: "testnet";
};
