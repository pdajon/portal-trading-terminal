import type { HyperliquidSymbol } from "@/types/market";
import type { PlannedTrade } from "@/types/trade";

const tradePlanTemplates: Record<HyperliquidSymbol, Omit<PlannedTrade, "riskRewardRatio">> =
  {
    "BTC-USD": {
      symbol: "BTC-USD",
      direction: "long",
      entry: 99100,
      stopLoss: 98520,
      takeProfit: 100840,
      positionSizeUsd: 1500,
    },
    "ETH-USD": {
      symbol: "ETH-USD",
      direction: "long",
      entry: 3486,
      stopLoss: 3442,
      takeProfit: 3608,
      positionSizeUsd: 1200,
    },
    "SOL-USD": {
      symbol: "SOL-USD",
      direction: "long",
      entry: 189.4,
      stopLoss: 185.8,
      takeProfit: 198.4,
      positionSizeUsd: 900,
    },
  };

export function calculateRiskRewardRatio(
  direction: PlannedTrade["direction"],
  entry: number,
  stopLoss: number,
  takeProfit: number,
) {
  const risk =
    direction === "long" ? entry - stopLoss : stopLoss - entry;
  const reward =
    direction === "long" ? takeProfit - entry : entry - takeProfit;

  if (risk <= 0 || reward <= 0) {
    return 0;
  }

  return reward / risk;
}

export function createMockTradePlan(symbol: HyperliquidSymbol): PlannedTrade {
  const template = tradePlanTemplates[symbol];

  return {
    ...template,
    riskRewardRatio: calculateRiskRewardRatio(
      template.direction,
      template.entry,
      template.stopLoss,
      template.takeProfit,
    ),
  };
}

export const mockTradePlan: PlannedTrade = {
  ...tradePlanTemplates["BTC-USD"],
  riskRewardRatio: calculateRiskRewardRatio(
    tradePlanTemplates["BTC-USD"].direction,
    tradePlanTemplates["BTC-USD"].entry,
    tradePlanTemplates["BTC-USD"].stopLoss,
    tradePlanTemplates["BTC-USD"].takeProfit,
  ),
};
