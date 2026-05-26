import type { ChartTradePlan, ActivePosition, LiveExchangePosition } from "@/types/trade";
import type { HyperliquidSymbol } from "@/types/market";

export const BREAK_EVEN_MISSING_ENTRY_MESSAGE =
  "Break-even unavailable. Entry price is missing.";
export const BREAK_EVEN_MISSING_TARGET_MESSAGE =
  "Break-even unavailable. Take-profit price is missing.";

type BreakEvenProtectionInput = {
  activePosition: ActivePosition | null;
  livePositions: LiveExchangePosition[];
  symbol: HyperliquidSymbol;
  tradePlan: ChartTradePlan | null;
};

type BreakEvenProtectionResult =
  | {
      ok: true;
      entryPrice: number;
      position: ActivePosition;
      stopPrice: number;
      targetPrice: number;
    }
  | {
      message: string;
      ok: false;
    };

function finitePositiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function buildActivePositionFromLivePosition(livePosition: LiveExchangePosition): ActivePosition {
  return {
    createdAt: new Date(0).toISOString(),
    direction: livePosition.direction,
    entry: livePosition.entryPrice,
    entryOrderId: null,
    executionId: `exchange-live-${livePosition.symbol}`,
    id: `${livePosition.symbol}-position-exchange-live`,
    size: livePosition.size,
    symbol: livePosition.symbol,
  };
}

export function resolveBreakEvenProtectionContext({
  activePosition,
  livePositions,
  symbol,
  tradePlan,
}: BreakEvenProtectionInput): BreakEvenProtectionResult {
  const matchingLivePosition = livePositions.find((position) => position.symbol === symbol) ?? null;
  const matchingActivePosition = activePosition?.symbol === symbol ? activePosition : null;
  const position = matchingActivePosition ?? (
    matchingLivePosition ? buildActivePositionFromLivePosition(matchingLivePosition) : null
  );

  if (!position) {
    return { message: "Protection sync failed — no live position exists", ok: false };
  }

  const entryPrice =
    finitePositiveNumber(position.entry) ??
    finitePositiveNumber(matchingLivePosition?.entryPrice);

  if (entryPrice === null) {
    return { message: BREAK_EVEN_MISSING_ENTRY_MESSAGE, ok: false };
  }

  const targetPrice =
    tradePlan?.symbol === symbol
      ? finitePositiveNumber(tradePlan.target)
      : finitePositiveNumber(matchingLivePosition?.targetPrice);

  if (targetPrice === null) {
    return { message: BREAK_EVEN_MISSING_TARGET_MESSAGE, ok: false };
  }

  return {
    entryPrice,
    ok: true,
    position: {
      ...position,
      entry: entryPrice,
    },
    stopPrice: getExchangeSafeBreakEvenStop(position.direction, entryPrice),
    targetPrice,
  };
}

export function getExchangeSafeBreakEvenStop(
  direction: ActivePosition["direction"],
  entryPrice: number,
) {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return entryPrice;
  }

  const oneBasisPoint = entryPrice * 0.00001;

  return direction === "long"
    ? entryPrice - oneBasisPoint
    : entryPrice + oneBasisPoint;
}
