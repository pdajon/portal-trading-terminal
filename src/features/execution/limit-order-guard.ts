import type { TradeDirection } from "@/types/trade";

export type LimitOrderPlacementIntent = {
  direction: TradeDirection;
  reduceOnly?: boolean;
};

export type LivePositionDirectionSnapshot = {
  direction: TradeDirection;
} | null;

export type LimitOrderPlacementGuardResult =
  | {
      allowed: true;
      scaleIn: boolean;
    }
  | {
      allowed: false;
      reason: string;
      scaleIn: false;
    };

export function evaluateLimitOrderPlacementGuard(
  intent: LimitOrderPlacementIntent,
  livePosition: LivePositionDirectionSnapshot,
): LimitOrderPlacementGuardResult {
  if (!livePosition) {
    return intent.reduceOnly
      ? {
          allowed: false,
          reason: "Reduce-only limit order invalid without a live position.",
          scaleIn: false,
        }
      : { allowed: true, scaleIn: false };
  }

  if (!intent.reduceOnly) {
    return {
      allowed: true,
      scaleIn: intent.direction === livePosition.direction,
    };
  }

  if (intent.direction !== livePosition.direction) {
    return { allowed: true, scaleIn: false };
  }

  return {
    allowed: false,
    reason: `Reduce-only limit order invalid for the live ${livePosition.direction} position.`,
    scaleIn: false,
  };
}
