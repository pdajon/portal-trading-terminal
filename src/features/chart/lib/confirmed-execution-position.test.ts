import assert from "node:assert/strict";
import test from "node:test";

import { buildConfirmedExecutionPosition } from "./confirmed-execution-position";
import type { ExecutionSummary } from "@/types/trade";

function createExecutionSummary(overrides: Partial<ExecutionSummary> = {}): ExecutionSummary {
  return {
    actualFilledSize: 0.01234,
    direction: "long",
    entryOrder: {
      executionId: "exec-1",
      id: 123,
      status: "filled",
    },
    executionId: "exec-1",
    fillPrice: 78_500,
    finalPositionState: null,
    finalResult: "success",
    intendedSize: 0.01234,
    normalizedSize: 0.01234,
    symbol: "BTC-USD",
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

test("buildConfirmedExecutionPosition derives an immediate rail position from a fill summary", () => {
  const position = buildConfirmedExecutionPosition(createExecutionSummary());

  assert.ok(position);
  assert.equal(position.symbol, "BTC-USD");
  assert.equal(position.direction, "long");
  assert.equal(position.entryPrice, 78_500);
  assert.equal(position.markPrice, 78_500);
  assert.equal(position.size, 0.01234);
  assert.equal(position.pnlUsd, 0);
  assert.equal(position.pnlPercent, 0);
  assert.equal(position.syncStatus, "confirmed-execution");
  assert.equal(position.protectionMissing, true);
});

test("buildConfirmedExecutionPosition returns null for unconfirmed fills", () => {
  assert.equal(
    buildConfirmedExecutionPosition(
      createExecutionSummary({
        actualFilledSize: 0,
        fillPrice: 0,
        finalResult: "entry failed",
      }),
    ),
    null,
  );
});
