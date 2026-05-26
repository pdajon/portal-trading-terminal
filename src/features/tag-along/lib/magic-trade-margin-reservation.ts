import type { TradeDirection } from "@/types/trade";
import {
  getMagicTradeTargetActionMarginUsd,
  isLegacyMagicTradeOpenPositionAction,
  isLiveOpenPositionTargetAction,
  type RuleStatus,
  type TagAlongRule,
  type TargetAction,
} from "./tag-along-rules";

export const MAGIC_TRADE_MARGIN_REVIEW_REQUIRED_REASON =
  "Magic Trade needs review before it can reserve margin.";
export const MAGIC_TRADE_INSUFFICIENT_AVAILABLE_MARGIN_REASON =
  "Magic Trade skipped — insufficient available margin after active Magic Trade reserves.";

const MAGIC_TRADE_RESERVING_STATUSES = new Set<RuleStatus>([
  "armed",
  "triggered",
  "executing",
]);

export type MagicTradeMarginReservation = {
  armedAt: string;
  direction: TradeDirection;
  marginUsd: number;
  ruleId: string;
  symbol: string;
};

export type MagicTradeMarginReservationSummary = {
  legacyReviewReasons: Record<string, string>;
  legacyReviewRequiredRuleIds: string[];
  oversubscribedMarginUsd: number;
  remainingAvailableToTrade: number | null;
  remainingAvailableToTradeBySide: Record<TradeDirection, number | null>;
  reservations: MagicTradeMarginReservation[];
  totalReservedMarginUsd: number;
};

export type MagicTradeMarginReservationInput = {
  availableToTrade: number | null;
  availableToTradeBySide: Partial<Record<TradeDirection, number | null>>;
  excludeRuleId?: string | null;
  rules: TagAlongRule[];
};

export function getMagicTradeDisplayMarginUsd(action: TargetAction) {
  const configuredMargin = getMagicTradeTargetActionMarginUsd(action);

  if (configuredMargin !== null) {
    return configuredMargin;
  }

  return getFinitePositiveNumber(action.enterSizeUsd);
}

export function isMagicTradeMarginReviewRequired(rule: TagAlongRule) {
  if (!isReservableMagicTradeRule(rule)) {
    return false;
  }

  return isLegacyMagicTradeOpenPositionAction(getPrimaryAction(rule));
}

export function deriveMagicTradeMarginReservation(
  input: MagicTradeMarginReservationInput,
): MagicTradeMarginReservationSummary {
  const reservations: MagicTradeMarginReservation[] = [];
  const legacyReviewRequiredRuleIds: string[] = [];
  const legacyReviewReasons: Record<string, string> = {};

  for (const rule of input.rules) {
    if (rule.id === input.excludeRuleId || !isReservableMagicTradeRule(rule)) {
      continue;
    }

    const action = getPrimaryAction(rule);

    if (isLegacyMagicTradeOpenPositionAction(action)) {
      legacyReviewRequiredRuleIds.push(rule.id);
      legacyReviewReasons[rule.id] = MAGIC_TRADE_MARGIN_REVIEW_REQUIRED_REASON;
      continue;
    }

    const marginUsd = getMagicTradeTargetActionMarginUsd(action);

    if (marginUsd === null) {
      continue;
    }

    reservations.push({
      armedAt: rule.execution.armedAt ?? rule.updatedAt ?? rule.createdAt,
      direction: action.enterDirection ?? "long",
      marginUsd,
      ruleId: rule.id,
      symbol: action.targetSymbol,
    });
  }

  const totalReservedMarginUsd = roundUsd(
    reservations.reduce((total, reservation) => total + reservation.marginUsd, 0),
  );
  const availableToTrade = getFiniteNonNegativeNumber(input.availableToTrade);
  const availableLong =
    getFiniteNonNegativeNumber(input.availableToTradeBySide.long) ??
    availableToTrade;
  const availableShort =
    getFiniteNonNegativeNumber(input.availableToTradeBySide.short) ??
    availableToTrade;

  return {
    legacyReviewReasons,
    legacyReviewRequiredRuleIds,
    oversubscribedMarginUsd:
      availableToTrade === null
        ? 0
        : roundUsd(Math.max(totalReservedMarginUsd - availableToTrade, 0)),
    remainingAvailableToTrade: subtractReserve(availableToTrade, totalReservedMarginUsd),
    remainingAvailableToTradeBySide: {
      long: subtractReserve(availableLong, totalReservedMarginUsd),
      short: subtractReserve(availableShort, totalReservedMarginUsd),
    },
    reservations,
    totalReservedMarginUsd,
  };
}

function isReservableMagicTradeRule(rule: TagAlongRule) {
  return (
    MAGIC_TRADE_RESERVING_STATUSES.has(rule.status) &&
    rule.safety.executionMode === "live-open-position" &&
    isLiveOpenPositionTargetAction(getPrimaryAction(rule))
  );
}

function getPrimaryAction(rule: TagAlongRule) {
  return rule.targetActions?.[0] ?? rule.target;
}

function getFinitePositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getFiniteNonNegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function subtractReserve(value: number | null, reservedUsd: number) {
  return value === null ? null : roundUsd(Math.max(value - reservedUsd, 0));
}

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
