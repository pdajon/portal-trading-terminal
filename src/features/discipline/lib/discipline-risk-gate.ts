import type { HyperliquidSymbol } from "@/types/market";
import type { ChartTradePlan, TradeDirection } from "@/types/trade";
import type {
  ProtectionContextInput,
  RequireProtectionRule,
} from "./discipline-protection";

export type DisciplineRiskDirection =
  | "risk_increasing"
  | "risk_reducing"
  | "neutral"
  | "unknown";

export type DisciplineRiskGateDecision =
  | "allowed"
  | "blocked"
  | "warning"
  | "override_required";

export type DisciplineRiskGateReasonCode =
  | "blocked_time_window_active"
  | "cooldown_active"
  | "max_daily_loss_hit"
  | "max_trades_per_day_hit"
  | "market_entry_confirmation_required"
  | "min_rr_failed"
  | "no_trade_zone_active"
  | "protection_required"
  | "discipline_locked"
  | "unknown_risk_action";

export type DisciplineRiskActionType =
  | "market_order"
  | "limit_order"
  | "order_zone_create"
  | "trigger_market_order"
  | "magic_trade_open_position"
  | "magic_trade_risk_reducing"
  | "close_position"
  | "reduce_position"
  | "cancel_order"
  | "cancel_all_orders"
  | "close_all"
  | "break_even"
  | "protection_update"
  | "reverse_position"
  | "order_update"
  | "zone_order_update"
  | "unknown";

export type DisciplineRiskActionSource =
  | "manual"
  | "trigger"
  | "magic_trade"
  | "protection"
  | "order_zone"
  | "system";

export type DisciplineRiskGateRules = {
  cooldownAfterLossMinutes: number | null;
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
  minRiskReward: number | null;
};

export type MarketEntryConfirmationRule = {
  enabled: boolean;
  mode: "warn_only" | "confirm_required";
  source?: "manual" | "operator_diagnosis";
  sourceFindingId?: string;
  state?: "inactive" | "active" | "triggered" | "locked" | "overridden";
};

export type DisciplineRiskGateTracking = {
  cooldownRemainingMs: number;
  realizedPnlToday: number;
  tradesPlacedToday: number;
};

export type DisciplineRiskGatePosition = {
  direction: TradeDirection;
  size?: number | null;
  symbol?: HyperliquidSymbol | string | null;
} | null;

export type DisciplineRiskGateOrderSnapshot = {
  id?: string;
  orderId?: number | null;
  reduceOnly?: boolean;
  side?: TradeDirection;
  size: number;
};

export type DisciplineRiskGateInput = {
  actionType: DisciplineRiskActionType;
  blockedTimeWindowActive?: boolean;
  blockedTimeWindowSource?: "manual" | "operator_diagnosis" | string | null;
  confirmedDisciplineWarnings?: DisciplineRiskGateReasonCode[];
  currentPosition?: DisciplineRiskGatePosition;
  disciplineLocked?: boolean;
  existingOrder?: DisciplineRiskGateOrderSnapshot | null;
  existingOrders?: DisciplineRiskGateOrderSnapshot[];
  marketEntryConfirmation?: MarketEntryConfirmationRule;
  nextOrder?: DisciplineRiskGateOrderSnapshot | null;
  nextOrders?: DisciplineRiskGateOrderSnapshot[];
  noTradeZoneActive?: boolean;
  orderType?: "market" | "limit";
  protectionContext?: ProtectionContextInput["protectionMetadata"];
  requestedTrades?: number;
  requireProtection?: RequireProtectionRule;
  rules: DisciplineRiskGateRules;
  side?: TradeDirection;
  size?: number | null;
  source: DisciplineRiskActionSource;
  symbol?: HyperliquidSymbol | string | null;
  tracking: DisciplineRiskGateTracking;
  tradePlan?: Pick<ChartTradePlan, "entry" | "stop" | "symbol" | "target"> | null;
};

export type DisciplineRiskClassification = {
  reason?: string;
  riskDirection: DisciplineRiskDirection;
};

export type DisciplineRiskGateResult = {
  decision: DisciplineRiskGateDecision;
  input: DisciplineRiskGateInput;
  message?: string;
  reasonCode?: DisciplineRiskGateReasonCode;
  riskDirection: DisciplineRiskDirection;
};

export type DisciplineRiskGateLogEntry = {
  actionType: DisciplineRiskActionType;
  category: "discipline";
  description: string;
  eventType: "discipline-rule-blocked";
  reasonCode: DisciplineRiskGateReasonCode;
  riskDirection: DisciplineRiskDirection;
  source: DisciplineRiskActionSource;
  symbol: string | null;
};

const BLOCK_MESSAGES: Record<DisciplineRiskGateReasonCode, string> = {
  blocked_time_window_active: "Trade blocked. This time window is locked by your Discipline Plan.",
  cooldown_active: "Trade blocked. Cooldown is still active.",
  discipline_locked: "Trade blocked. Discipline is locked.",
  max_daily_loss_hit: "Trade blocked. Max daily loss reached.",
  max_trades_per_day_hit: "Trade blocked. Max trades per day reached.",
  market_entry_confirmation_required: "Manual market entry requires confirmation.",
  min_rr_failed: "Trade blocked. R:R rule failed.",
  no_trade_zone_active: "Trade blocked. No-trade zone active.",
  protection_required: "Trade blocked. Add a stop loss before taking new risk.",
  unknown_risk_action: "Trade blocked. Risk could not be classified.",
};

export function classifyTradeActionRisk(
  input: DisciplineRiskGateInput,
): DisciplineRiskClassification {
  switch (input.actionType) {
    case "close_position":
    case "reduce_position":
    case "cancel_order":
    case "cancel_all_orders":
    case "close_all":
    case "break_even":
    case "protection_update":
    case "magic_trade_risk_reducing":
      return { riskDirection: "risk_reducing" };
    case "market_order":
    case "order_zone_create":
    case "trigger_market_order":
    case "magic_trade_open_position":
    case "reverse_position":
      return { riskDirection: "risk_increasing" };
    case "limit_order":
      return classifyLimitOrderRisk(input);
    case "order_update":
    case "zone_order_update":
      return classifyZoneOrderUpdateRisk(input);
    case "unknown":
    default:
      return { reason: "unrecognized action type", riskDirection: "unknown" };
  }
}

export function evaluateDisciplineRiskGate(
  input: DisciplineRiskGateInput,
): DisciplineRiskGateResult {
  const classification = classifyTradeActionRisk(input);
  const baseResult = {
    input,
    riskDirection: classification.riskDirection,
  };

  if (classification.riskDirection === "risk_reducing" || classification.riskDirection === "neutral") {
    return {
      ...baseResult,
      decision: "allowed",
    };
  }

  if (classification.riskDirection === "unknown") {
    return block(input, classification.riskDirection, "unknown_risk_action");
  }

  if (input.noTradeZoneActive) {
    return block(input, classification.riskDirection, "no_trade_zone_active");
  }

  if (input.blockedTimeWindowActive) {
    return block(input, classification.riskDirection, "blocked_time_window_active");
  }

  if (input.disciplineLocked) {
    return block(input, classification.riskDirection, "discipline_locked");
  }

  if (
    input.rules.maxDailyLoss !== null &&
    input.tracking.realizedPnlToday <= -input.rules.maxDailyLoss
  ) {
    return block(input, classification.riskDirection, "max_daily_loss_hit");
  }

  const requestedTrades = Math.max(1, Math.floor(input.requestedTrades ?? 1));
  if (
    input.rules.maxTradesPerDay !== null &&
    input.tracking.tradesPlacedToday + requestedTrades > input.rules.maxTradesPerDay
  ) {
    return block(input, classification.riskDirection, "max_trades_per_day_hit");
  }

  if (input.tracking.cooldownRemainingMs > 0) {
    return block(input, classification.riskDirection, "cooldown_active");
  }

  return {
    ...baseResult,
    decision: "allowed",
  };
}

export function isMarketEntryConfirmationRequired(input: DisciplineRiskGateInput) {
  void input;
  return false;
}

export function createDisciplineRiskGateLogEntry(
  result: DisciplineRiskGateResult,
): DisciplineRiskGateLogEntry {
  if (result.decision !== "blocked" || !result.reasonCode) {
    throw new Error("Only blocked Discipline decisions can be logged.");
  }

  return {
    actionType: result.input.actionType,
    category: "discipline",
    description: result.message ?? BLOCK_MESSAGES[result.reasonCode],
    eventType: "discipline-rule-blocked",
    reasonCode: result.reasonCode,
    riskDirection: result.riskDirection,
    source: result.input.source,
    symbol: result.input.symbol ? String(result.input.symbol) : null,
  };
}

function classifyLimitOrderRisk(input: DisciplineRiskGateInput): DisciplineRiskClassification {
  const reduceOnly = input.nextOrder?.reduceOnly ?? input.existingOrder?.reduceOnly ?? false;

  if (reduceOnly) {
    return { riskDirection: "risk_reducing" };
  }

  return { riskDirection: "risk_increasing" };
}

function classifyZoneOrderUpdateRisk(
  input: DisciplineRiskGateInput,
): DisciplineRiskClassification {
  const existingOrders = input.existingOrders ?? [];
  const nextOrders = input.nextOrders ?? [];

  if (existingOrders.length === 0) {
    return { reason: "missing existing orders", riskDirection: "unknown" };
  }

  if (nextOrders.length > existingOrders.length) {
    return { riskDirection: "risk_increasing" };
  }

  const existingById = new Map(
    existingOrders.map((order) => [getComparableOrderId(order), order] as const),
  );

  for (const nextOrder of nextOrders) {
    const existingOrder = existingById.get(getComparableOrderId(nextOrder));

    if (!existingOrder) {
      return { reason: "new order in update", riskDirection: "risk_increasing" };
    }

    if (!Number.isFinite(nextOrder.size) || !Number.isFinite(existingOrder.size)) {
      return { reason: "invalid order size", riskDirection: "unknown" };
    }

    if (nextOrder.size > existingOrder.size) {
      return { riskDirection: "risk_increasing" };
    }
  }

  return { riskDirection: "risk_reducing" };
}

function getComparableOrderId(order: DisciplineRiskGateOrderSnapshot) {
  return order.id ?? (order.orderId === null || order.orderId === undefined ? "" : String(order.orderId));
}

function block(
  input: DisciplineRiskGateInput,
  riskDirection: DisciplineRiskDirection,
  reasonCode: DisciplineRiskGateReasonCode,
): DisciplineRiskGateResult {
  return {
    decision: "blocked",
    input,
    message:
      input.actionType === "reverse_position"
        ? "Reverse blocked. Discipline does not allow new exposure right now."
        : reasonCode === "blocked_time_window_active" &&
            input.blockedTimeWindowSource === "operator_diagnosis"
          ? "Trade blocked. You underperform during this time window."
        : BLOCK_MESSAGES[reasonCode],
    reasonCode,
    riskDirection,
  };
}
