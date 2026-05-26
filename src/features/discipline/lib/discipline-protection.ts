import type { ChartTradePlan } from "@/types/trade";

export type RequireProtectionMode =
  | "stop_loss_required"
  | "sl_or_tp_required"
  | "sl_and_tp_required";

export type RequireProtectionRule = {
  enabled: boolean;
  mode: RequireProtectionMode;
  source?: "manual" | "operator_diagnosis";
  sourceFindingId?: string;
  state?: "inactive" | "active" | "locked" | "overridden";
};

export type ProtectionContextInput = {
  pendingProtectionPlan?: {
    hasStopLoss?: boolean | null;
    hasTakeProfit?: boolean | null;
    symbol?: string | null;
  } | null;
  protectionMetadata?: {
    hasStopLoss?: boolean | null;
    hasTakeProfit?: boolean | null;
    stopLoss?: number | null;
    stopPrice?: number | null;
    takeProfit?: number | null;
    targetPrice?: number | null;
  } | null;
  symbol?: string | null;
  tradePlan?: Pick<ChartTradePlan, "entry" | "stop" | "symbol" | "target"> | null;
};

export const DEFAULT_REQUIRE_PROTECTION_RULE: RequireProtectionRule = {
  enabled: false,
  mode: "stop_loss_required",
  state: "inactive",
};

export function sanitizeRequireProtectionRule(value: unknown): RequireProtectionRule {
  if (!value || typeof value !== "object") {
    return DEFAULT_REQUIRE_PROTECTION_RULE;
  }

  const rule = value as Partial<RequireProtectionRule>;

  return {
    enabled: rule.enabled === true,
    mode: sanitizeRequireProtectionMode(rule.mode),
    source: rule.source === "operator_diagnosis" || rule.source === "manual" ? rule.source : undefined,
    sourceFindingId: typeof rule.sourceFindingId === "string" ? rule.sourceFindingId : undefined,
    state: sanitizeRequireProtectionState(rule.state),
  };
}

export function hasValidProtectionContext(
  input: ProtectionContextInput,
  mode: RequireProtectionMode = "stop_loss_required",
) {
  const hasStopLoss = hasStopLossContext(input);
  const hasTakeProfit = hasTakeProfitContext(input);

  switch (mode) {
    case "sl_or_tp_required":
      return hasStopLoss || hasTakeProfit;
    case "sl_and_tp_required":
      return hasStopLoss && hasTakeProfit;
    case "stop_loss_required":
    default:
      return hasStopLoss;
  }
}

export function isRequireProtectionWeakened(
  currentRule: RequireProtectionRule,
  nextRule: RequireProtectionRule,
) {
  if (!currentRule.enabled) {
    return false;
  }

  if (!nextRule.enabled) {
    return true;
  }

  return getRequireProtectionStrictness(nextRule.mode) < getRequireProtectionStrictness(currentRule.mode);
}

function hasStopLossContext(input: ProtectionContextInput) {
  if (input.protectionMetadata?.hasStopLoss === true) {
    return true;
  }

  if (
    isFiniteProtectionPrice(input.protectionMetadata?.stopLoss) ||
    isFiniteProtectionPrice(input.protectionMetadata?.stopPrice)
  ) {
    return true;
  }

  if (input.pendingProtectionPlan?.hasStopLoss === true && isSameSymbol(input)) {
    return true;
  }

  return hasValidTradePlanStop(input.tradePlan);
}

function hasTakeProfitContext(input: ProtectionContextInput) {
  if (input.protectionMetadata?.hasTakeProfit === true) {
    return true;
  }

  if (
    isFiniteProtectionPrice(input.protectionMetadata?.takeProfit) ||
    isFiniteProtectionPrice(input.protectionMetadata?.targetPrice)
  ) {
    return true;
  }

  if (input.pendingProtectionPlan?.hasTakeProfit === true && isSameSymbol(input)) {
    return true;
  }

  return hasValidTradePlanTarget(input.tradePlan);
}

function hasValidTradePlanStop(
  tradePlan: Pick<ChartTradePlan, "entry" | "stop" | "symbol"> | null | undefined,
) {
  return Boolean(
    tradePlan &&
      Number.isFinite(tradePlan.entry) &&
      Number.isFinite(tradePlan.stop) &&
      tradePlan.stop > 0 &&
      tradePlan.stop !== tradePlan.entry,
  );
}

function hasValidTradePlanTarget(
  tradePlan: Pick<ChartTradePlan, "entry" | "target" | "symbol"> | null | undefined,
) {
  return Boolean(
    tradePlan &&
      Number.isFinite(tradePlan.entry) &&
      Number.isFinite(tradePlan.target) &&
      tradePlan.target > 0 &&
      tradePlan.target !== tradePlan.entry,
  );
}

function isFiniteProtectionPrice(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isSameSymbol(input: ProtectionContextInput) {
  return !input.pendingProtectionPlan?.symbol || input.pendingProtectionPlan.symbol === input.symbol;
}

function getRequireProtectionStrictness(mode: RequireProtectionMode) {
  switch (mode) {
    case "sl_or_tp_required":
      return 1;
    case "stop_loss_required":
      return 2;
    case "sl_and_tp_required":
      return 3;
  }
}

function sanitizeRequireProtectionMode(value: unknown): RequireProtectionMode {
  return value === "sl_or_tp_required" || value === "sl_and_tp_required"
    ? value
    : "stop_loss_required";
}

function sanitizeRequireProtectionState(value: unknown): RequireProtectionRule["state"] {
  return value === "active" || value === "locked" || value === "overridden"
    ? value
    : value === "inactive"
      ? "inactive"
      : undefined;
}
