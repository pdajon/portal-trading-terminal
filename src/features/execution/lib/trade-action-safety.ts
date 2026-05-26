export const DEFAULT_MARKET_MAX_SLIPPAGE_PERCENT = 8;
export const MIN_MARKET_MAX_SLIPPAGE_PERCENT = 0.01;
export const MAX_MARKET_MAX_SLIPPAGE_PERCENT = 10;
export const MAX_DEMO_MARKET_SLIPPAGE_PERCENT =
  DEFAULT_MARKET_MAX_SLIPPAGE_PERCENT;

export function normalizeMarketMaxSlippagePercent(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_MARKET_MAX_SLIPPAGE_PERCENT;
  }

  return Math.min(
    MAX_MARKET_MAX_SLIPPAGE_PERCENT,
    Math.max(MIN_MARKET_MAX_SLIPPAGE_PERCENT, value),
  );
}

export type TradeActionSafety = {
  disabled: boolean;
  reason: "no-size" | "request-in-flight" | "slippage-too-high" | null;
  tone: "ready" | "neutral" | "danger";
};

export function getMarketTradeActionSafety(details: {
  estimatedSlippagePercent: number | null;
  executionMode: "limit" | "market";
  livePendingOrderCount?: number;
  maxSlippagePercent?: number;
  primaryExecutableSize: number;
  requestInFlight: boolean;
}): TradeActionSafety {
  if (details.requestInFlight) {
    return {
      disabled: true,
      reason: "request-in-flight",
      tone: "neutral",
    };
  }

  if (details.primaryExecutableSize <= 0) {
    return {
      disabled: true,
      reason: "no-size",
      tone: "neutral",
    };
  }

  if (
    details.executionMode === "market" &&
    details.estimatedSlippagePercent !== null &&
    Number.isFinite(details.estimatedSlippagePercent) &&
    details.estimatedSlippagePercent >
      normalizeMarketMaxSlippagePercent(
        details.maxSlippagePercent ?? DEFAULT_MARKET_MAX_SLIPPAGE_PERCENT,
      )
  ) {
    return {
      disabled: true,
      reason: "slippage-too-high",
      tone: "danger",
    };
  }

  return {
    disabled: false,
    reason: null,
    tone: "ready",
  };
}
