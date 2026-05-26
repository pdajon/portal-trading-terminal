import type { TradeDirection } from "@/types/trade";

export type TradePlanDirectionalLevel = "stop" | "target";

type TradePlanPlacementInput = {
  direction: TradeDirection;
  entry: number;
  level: TradePlanDirectionalLevel;
  price: number;
};

export function isTradePlanLevelDirectionValid({
  direction,
  entry,
  level,
  price,
}: TradePlanPlacementInput) {
  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(price) ||
    entry <= 0 ||
    price <= 0
  ) {
    return false;
  }

  if (direction === "long") {
    return level === "stop" ? price < entry : price > entry;
  }

  return level === "stop" ? price > entry : price < entry;
}

export function getTradePlanPlacementError(
  input: TradePlanPlacementInput,
): string | null {
  if (isTradePlanLevelDirectionValid(input)) {
    return null;
  }

  const directionLabel = input.direction === "long" ? "Long" : "Short";

  if (input.level === "stop") {
    const side = input.direction === "long" ? "below" : "above";
    return `${directionLabel} stop loss must be ${side} entry.`;
  }

  const side = input.direction === "long" ? "above" : "below";
  return `${directionLabel} take profit must be ${side} entry.`;
}
