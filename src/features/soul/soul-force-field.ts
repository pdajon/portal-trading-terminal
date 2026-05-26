import type { SoulForceFieldState } from "./soul-types";
import type {
  ChartTradePlan,
  DraftChartTradePlan,
  LiveExchangePosition,
} from "@/types/trade";

export function deriveSoulForceField(input: {
  hasStopLoss?: boolean | null;
  hasTakeProfit?: boolean | null;
}): SoulForceFieldState {
  const hasStopLoss = Boolean(input.hasStopLoss);
  const hasTakeProfit = Boolean(input.hasTakeProfit);

  if (hasStopLoss && hasTakeProfit) {
    return {
      hasStopLoss,
      hasTakeProfit,
      reason: "stabilized_protection",
      strength: "full",
    };
  }

  if (hasStopLoss || hasTakeProfit) {
    return {
      hasStopLoss,
      hasTakeProfit,
      reason: "partial_protection",
      strength: "weak",
    };
  }

  return {
    hasStopLoss,
    hasTakeProfit,
    reason: "no_protection",
    strength: "none",
  };
}

export function deriveSoulForceFieldFromLivePosition(
  position: Pick<LiveExchangePosition, "slStatus" | "tpStatus"> | null,
): SoulForceFieldState {
  return deriveSoulForceField({
    hasStopLoss: position?.slStatus === "live",
    hasTakeProfit: position?.tpStatus === "live",
  });
}

export function deriveSoulForceFieldFromProtectionState(input: {
  activeTradePlan?: Pick<ChartTradePlan, "stop" | "target"> | null;
  draftTradePlan?: Pick<DraftChartTradePlan, "stop" | "target"> | null;
  livePosition?: Pick<LiveExchangePosition, "slStatus" | "tpStatus"> | null;
}): SoulForceFieldState {
  return deriveSoulForceField({
    hasStopLoss:
      input.livePosition?.slStatus === "live" ||
      typeof input.draftTradePlan?.stop === "number" ||
      typeof input.activeTradePlan?.stop === "number",
    hasTakeProfit:
      input.livePosition?.tpStatus === "live" ||
      typeof input.draftTradePlan?.target === "number" ||
      typeof input.activeTradePlan?.target === "number",
  });
}
