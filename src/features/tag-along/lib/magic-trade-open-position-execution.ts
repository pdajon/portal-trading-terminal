import type { HyperliquidSymbol } from "@/types/market";
import {
  getEnabledHyperliquidUiMarkets,
  getHyperliquidCoin,
} from "@/lib/markets/hyperliquid-market-registry";
import type { TradeDirection } from "@/types/trade";
import {
  getMagicTradeTargetActionMarginUsd,
  isLegacyMagicTradeOpenPositionAction,
  isLiveOpenPositionTargetAction,
  type RuleExecutionStatus,
  type TagAlongRule,
  type TargetAction,
} from "./tag-along-rules";
import { getMagicTradeTargetPriceUnavailableReason } from "./magic-trade-target-price";
import {
  MAGIC_TRADE_INSUFFICIENT_AVAILABLE_MARGIN_REASON,
  MAGIC_TRADE_MARGIN_REVIEW_REQUIRED_REASON,
} from "./magic-trade-margin-reservation";

export const MAGIC_TRADE_TESTNET_OPEN_POSITION_SYMBOL: HyperliquidSymbol = "BTC-USD";
export const MAGIC_TRADE_OPEN_POSITION_UNSUPPORTED_SYMBOL_REASON =
  "Symbol not yet supported for testnet Open Position";
export const MAGIC_TRADE_TESTNET_OPEN_POSITION_SYMBOLS = getEnabledHyperliquidUiMarkets().map(
  (market) => market.symbol,
);

export type MagicTradeOpenPositionOrderContext = {
  availableMarginUsd?: number | null;
  disciplineBlockReason: string | null;
  livePrice: number | null | undefined;
  maxLeverage?: number | null;
  normalizeBaseSize: (size: number, symbol: HyperliquidSymbol) => number;
  supportedSymbols?: readonly HyperliquidSymbol[];
};

export type MagicTradeOpenPositionPreparationResult =
  | {
      baseSize: number;
      ok: true;
      side: TradeDirection;
      symbol: HyperliquidSymbol;
      targetAction: TargetAction;
      leverage: number;
      marginUsd: number;
      notionalUsd: number;
    }
  | {
      ok: false;
      reason: string;
      status: Extract<RuleExecutionStatus, "failed" | "skipped">;
    };

export function isMagicTradeTestnetOpenPositionSymbol(
  symbol: string,
  supportedSymbols: readonly HyperliquidSymbol[] = MAGIC_TRADE_TESTNET_OPEN_POSITION_SYMBOLS,
): symbol is HyperliquidSymbol {
  return supportedSymbols.includes(symbol as HyperliquidSymbol);
}

export function getMagicTradeOpenPositionCoin(symbol: string) {
  return getHyperliquidCoin(symbol) ?? symbol.replace(/-USD$/i, "");
}

export function prepareMagicTradeOpenPositionExecution(
  rule: TagAlongRule,
  context: MagicTradeOpenPositionOrderContext,
): MagicTradeOpenPositionPreparationResult {
  if (!isLiveOpenPositionTargetAction(rule.target)) {
    return {
      ok: false,
      reason: "unsafe action",
      status: "skipped",
    };
  }

  if (rule.execution.executionCount > 0 || rule.execution.lastExecutionRecordId) {
    return {
      ok: false,
      reason: "duplicate execution",
      status: "skipped",
    };
  }

  const targetSymbol = rule.target.targetSymbol;

  if (
    !isMagicTradeTestnetOpenPositionSymbol(
      targetSymbol,
      context.supportedSymbols,
    )
  ) {
    return {
      ok: false,
      reason: MAGIC_TRADE_OPEN_POSITION_UNSUPPORTED_SYMBOL_REASON,
      status: "skipped",
    };
  }

  if (context.disciplineBlockReason) {
    return {
      ok: false,
      reason: context.disciplineBlockReason,
      status: "skipped",
    };
  }

  if (rule.target.enterOrderType !== "market") {
    return {
      ok: false,
      reason: "Open Position only supports market orders right now.",
      status: "skipped",
    };
  }

  const side = rule.target.enterDirection;

  if (side !== "long" && side !== "short") {
    return {
      ok: false,
      reason: "Open Position requires long or short direction.",
      status: "skipped",
    };
  }

  const leverage = rule.target.enterLeverage;

  if (isLegacyMagicTradeOpenPositionAction(rule.target)) {
    return {
      ok: false,
      reason: MAGIC_TRADE_MARGIN_REVIEW_REQUIRED_REASON,
      status: "skipped",
    };
  }

  if (!Number.isFinite(leverage) || typeof leverage !== "number" || leverage <= 0) {
    return {
      ok: false,
      reason: "Invalid Open Position leverage",
      status: "skipped",
    };
  }

  const marginUsd = getMagicTradeTargetActionMarginUsd(rule.target);

  if (marginUsd === null) {
    return {
      ok: false,
      reason: "Invalid Open Position margin",
      status: "skipped",
    };
  }

  if (
    typeof context.availableMarginUsd === "number" &&
    Number.isFinite(context.availableMarginUsd) &&
    context.availableMarginUsd >= 0 &&
    marginUsd > context.availableMarginUsd
  ) {
    return {
      ok: false,
      reason: MAGIC_TRADE_INSUFFICIENT_AVAILABLE_MARGIN_REASON,
      status: "skipped",
    };
  }

  if (
    typeof context.maxLeverage === "number" &&
    Number.isFinite(context.maxLeverage) &&
    context.maxLeverage > 0 &&
    leverage > context.maxLeverage
  ) {
    return {
      ok: false,
      reason: `Open Position leverage exceeds Hyperliquid max for ${getMagicTradeOpenPositionCoin(targetSymbol)} (${Math.floor(context.maxLeverage)}x).`,
      status: "skipped",
    };
  }

  if (!Number.isFinite(context.livePrice) || !context.livePrice || context.livePrice <= 0) {
    return {
      ok: false,
      reason: getMagicTradeTargetPriceUnavailableReason(targetSymbol),
      status: "skipped",
    };
  }

  const notionalUsd = marginUsd * leverage;
  const baseSize = context.normalizeBaseSize(notionalUsd / context.livePrice, targetSymbol);

  if (!Number.isFinite(baseSize) || baseSize <= 0) {
    return {
      ok: false,
      reason: "Invalid Open Position size",
      status: "skipped",
    };
  }

  return {
    baseSize,
    ok: true,
    side,
    symbol: targetSymbol,
    targetAction: rule.target,
    leverage,
    marginUsd,
    notionalUsd,
  };
}
