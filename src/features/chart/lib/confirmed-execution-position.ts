import type { ExecutionSummary, LiveExchangePosition } from "@/types/trade";

export function buildConfirmedExecutionPosition(
  summary: ExecutionSummary,
): LiveExchangePosition | null {
  if (
    summary.finalResult !== "success" ||
    !Number.isFinite(summary.actualFilledSize) ||
    summary.actualFilledSize <= 0 ||
    !Number.isFinite(summary.fillPrice) ||
    summary.fillPrice <= 0
  ) {
    return null;
  }

  return {
    direction: summary.direction,
    entryPrice: summary.fillPrice,
    fundingUsd: 0,
    leverageValue: null,
    liquidationPrice: null,
    marginUsedUsd: null,
    markPrice: summary.fillPrice,
    pnlPercent: 0,
    pnlUsd: 0,
    positionValueUsd: summary.fillPrice * summary.actualFilledSize,
    protectionMissing: true,
    size: summary.actualFilledSize,
    slOrderId: null,
    slStatus: "missing",
    stopPrice: null,
    symbol: summary.symbol,
    syncStatus: "confirmed-execution",
    targetPrice: null,
    tpOrderId: null,
    tpStatus: "missing",
  };
}
