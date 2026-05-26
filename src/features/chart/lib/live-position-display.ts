import type { LiveExchangePosition } from "@/types/trade";

export function deriveLivePositionDisplayPrice(
  position: LiveExchangePosition,
  liveMarkPrice: number | null,
) {
  if (
    liveMarkPrice === null ||
    !Number.isFinite(liveMarkPrice) ||
    liveMarkPrice <= 0 ||
    !Number.isFinite(position.entryPrice) ||
    position.entryPrice <= 0 ||
    !Number.isFinite(position.size)
  ) {
    return position;
  }

  const directionMultiplier = position.direction === "long" ? 1 : -1;
  const positionValueUsd = Math.abs(position.size) * liveMarkPrice;
  const marginUsedUsd =
    position.leverageValue !== null &&
    Number.isFinite(position.leverageValue) &&
    position.leverageValue > 0
      ? positionValueUsd / position.leverageValue
      : position.marginUsedUsd;
  const pnlUsd = (liveMarkPrice - position.entryPrice) * position.size * directionMultiplier;
  const pnlPercent =
    ((liveMarkPrice - position.entryPrice) / position.entryPrice) * 100 * directionMultiplier;

  return {
    ...position,
    markPrice: liveMarkPrice,
    marginUsedUsd,
    pnlPercent,
    pnlUsd,
    positionValueUsd,
  };
}
