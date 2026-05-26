import type { PlannedTrade, PreparedExecutionPayload } from "@/types/trade";

export function prepareExecutionPayload(
  tradePlan: PlannedTrade,
): PreparedExecutionPayload {
  const sizeUsd = tradePlan.positionSizeUsd ?? 0;
  const estimatedQuantity = tradePlan.entry > 0 ? sizeUsd / tradePlan.entry : 0;

  return {
    symbol: tradePlan.symbol,
    side: tradePlan.direction,
    orderType: "market",
    entryPrice: tradePlan.entry,
    stopLoss: tradePlan.stopLoss,
    takeProfit: tradePlan.takeProfit,
    sizeUsd,
    estimatedQuantity,
    riskRewardRatio: tradePlan.riskRewardRatio,
    reduceOnly: false,
    environment: "testnet",
  };
}
