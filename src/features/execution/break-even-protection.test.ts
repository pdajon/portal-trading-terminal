import assert from "node:assert/strict";
import test from "node:test";

import {
  BREAK_EVEN_MISSING_ENTRY_MESSAGE,
  resolveBreakEvenProtectionContext,
} from "./break-even-protection";
import type { ActivePosition, LiveExchangePosition } from "@/types/trade";

const livePosition: LiveExchangePosition = {
  direction: "long",
  entryPrice: 100,
  fundingUsd: null,
  leverageValue: 3,
  liquidationPrice: null,
  marginUsedUsd: null,
  markPrice: 101,
  pnlPercent: 1,
  pnlUsd: 1,
  positionValueUsd: 30,
  protectionMissing: false,
  size: 0.3,
  slOrderId: 2,
  slStatus: "live",
  stopPrice: 95,
  symbol: "BTC-USD",
  targetPrice: 110,
  tpOrderId: 1,
  tpStatus: "live",
};

test("Break Even works from live position entry context without attached trade plan", () => {
  const result = resolveBreakEvenProtectionContext({
    activePosition: null,
    livePositions: [livePosition],
    symbol: "BTC-USD",
    tradePlan: null,
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.entryPrice, 100);
    assert.equal(result.position.entry, 100);
    assert.equal(result.stopPrice, 99.999);
    assert.equal(result.targetPrice, 110);
  }
});

test("Break Even shows a specific error if entry price is missing", () => {
  const result = resolveBreakEvenProtectionContext({
    activePosition: {
      createdAt: "2026-05-04T00:00:00.000Z",
      direction: "long",
      entry: 0,
      entryOrderId: null,
      executionId: "execution-1",
      id: "position-1",
      size: 0.3,
      symbol: "BTC-USD",
    } satisfies ActivePosition,
    livePositions: [{ ...livePosition, entryPrice: 0 }],
    symbol: "BTC-USD",
    tradePlan: null,
  });

  assert.deepEqual(result, {
    message: BREAK_EVEN_MISSING_ENTRY_MESSAGE,
    ok: false,
  });
});
