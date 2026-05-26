export type ReducePositionReconciliationInput = {
  initialSize: number;
  payloadRemainingSize?: number | null;
  refreshedSize?: number | null;
};

export type ReducePositionReconciliationOutcome =
  | {
      closed: boolean;
      ok: true;
      reconciledFromRefresh: boolean;
      reducedSize: number;
      remainingSize: number;
    }
  | {
      ok: false;
    };

function finiteNonNegativeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function buildOutcome(
  initialSize: number,
  remainingSize: number,
  reconciledFromRefresh: boolean,
): ReducePositionReconciliationOutcome {
  if (remainingSize >= initialSize) {
    return { ok: false };
  }

  const reducedSize = Math.max(initialSize - remainingSize, 0);

  if (reducedSize <= 0) {
    return { ok: false };
  }

  return {
    closed: remainingSize <= 0,
    ok: true,
    reconciledFromRefresh,
    reducedSize,
    remainingSize,
  };
}

export function reconcileReducePositionOutcome({
  initialSize,
  payloadRemainingSize,
  refreshedSize,
}: ReducePositionReconciliationInput): ReducePositionReconciliationOutcome {
  if (!Number.isFinite(initialSize) || initialSize <= 0) {
    return { ok: false };
  }

  const payloadSize = finiteNonNegativeNumber(payloadRemainingSize);
  const refreshSize = finiteNonNegativeNumber(refreshedSize);

  if (payloadSize !== null) {
    const payloadOutcome = buildOutcome(initialSize, payloadSize, false);

    if (payloadOutcome.ok) {
      return payloadOutcome;
    }
  }

  if (refreshSize !== null) {
    return buildOutcome(initialSize, refreshSize, true);
  }

  return { ok: false };
}
