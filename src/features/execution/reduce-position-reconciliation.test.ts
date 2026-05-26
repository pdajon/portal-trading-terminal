import assert from "node:assert/strict";
import test from "node:test";

import { reconcileReducePositionOutcome } from "./reduce-position-reconciliation";

test("successful reduce API mutation reconciles as success", () => {
  assert.deepEqual(
    reconcileReducePositionOutcome({
      initialSize: 0.002,
      payloadRemainingSize: 0.001,
    }),
    {
      closed: false,
      ok: true,
      reconciledFromRefresh: false,
      reducedSize: 0.001,
      remainingSize: 0.001,
    },
  );
});

test("ambiguous reduce response reconciles from refreshed smaller live position", () => {
  assert.deepEqual(
    reconcileReducePositionOutcome({
      initialSize: 0.002,
      refreshedSize: 0.001,
    }),
    {
      closed: false,
      ok: true,
      reconciledFromRefresh: true,
      reducedSize: 0.001,
      remainingSize: 0.001,
    },
  );
});

test("reduce reconciliation treats a refreshed flat position as closed success", () => {
  assert.deepEqual(
    reconcileReducePositionOutcome({
      initialSize: 0.002,
      refreshedSize: 0,
    }),
    {
      closed: true,
      ok: true,
      reconciledFromRefresh: true,
      reducedSize: 0.002,
      remainingSize: 0,
    },
  );
});

test("reduce reconciliation does not fake success without reduced exposure", () => {
  assert.deepEqual(
    reconcileReducePositionOutcome({
      initialSize: 0.002,
      payloadRemainingSize: 0.002,
      refreshedSize: 0.002,
    }),
    { ok: false },
  );
});
