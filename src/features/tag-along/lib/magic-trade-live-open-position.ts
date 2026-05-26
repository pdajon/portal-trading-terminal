import type { HyperliquidSymbol } from "@/types/market";

type MagicTradeOpenPositionInFlightBlockOptions = {
  bulkSafetyActionInFlight: string | null;
  inFlightRuleIds: Record<string, boolean>;
  limitOrderRequestState: string;
  manualInFlightSymbols?: HyperliquidSymbol[];
  ruleId: string;
  targetSymbols?: HyperliquidSymbol[];
};

export function getMagicTradeOpenPositionInFlightBlockReason({
  bulkSafetyActionInFlight,
  inFlightRuleIds,
  limitOrderRequestState,
  manualInFlightSymbols = [],
  ruleId,
  targetSymbols = [],
}: MagicTradeOpenPositionInFlightBlockOptions) {
  if (inFlightRuleIds[ruleId]) {
    return "duplicate execution";
  }

  if (targetSymbols.some((symbol) => manualInFlightSymbols.includes(symbol))) {
    return "conflicting in-flight action";
  }

  if (bulkSafetyActionInFlight !== null || limitOrderRequestState !== "idle") {
    return "conflicting in-flight action";
  }

  return null;
}
