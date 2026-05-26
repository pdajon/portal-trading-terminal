import assert from "node:assert/strict";
import test from "node:test";
import type { LiveExchangePosition } from "@/types/trade";
import { deriveLivePositionDisplayPrice } from "./live-position-display";

const basePosition: LiveExchangePosition = {
  direction: "long",
  entryPrice: 100,
  leverageValue: 10,
  liquidationPrice: null,
  markPrice: 101,
  marginUsedUsd: 10,
  pnlPercent: 1,
  pnlUsd: 0.01,
  positionValueUsd: 100,
  protectionMissing: true,
  fundingUsd: 0,
  size: 0.01,
  slOrderId: null,
  slStatus: "missing",
  stopPrice: null,
  symbol: "BTC-USD",
  targetPrice: null,
  tpOrderId: null,
  tpStatus: "missing",
};

test("deriveLivePositionDisplayPrice updates long mark and unrealized pnl from live price", () => {
  const displayPosition = deriveLivePositionDisplayPrice(basePosition, 105);

  assert.equal(displayPosition.markPrice, 105);
  assert.equal(displayPosition.pnlUsd, 0.05);
  assert.equal(displayPosition.pnlPercent, 5);
});

test("deriveLivePositionDisplayPrice updates position value and margin from live mark", () => {
  const displayPosition = deriveLivePositionDisplayPrice(basePosition, 105);

  assert.equal(displayPosition.positionValueUsd, 1.05);
  assert.equal(displayPosition.marginUsedUsd?.toFixed(3), "0.105");
});

test("deriveLivePositionDisplayPrice updates short pnl with inverse direction", () => {
  const displayPosition = deriveLivePositionDisplayPrice(
    {
      ...basePosition,
      direction: "short",
    },
    95,
  );

  assert.equal(displayPosition.markPrice, 95);
  assert.equal(displayPosition.pnlUsd, 0.05);
  assert.equal(displayPosition.pnlPercent, 5);
});

test("deriveLivePositionDisplayPrice keeps exchange snapshot when live mark is unavailable", () => {
  const displayPosition = deriveLivePositionDisplayPrice(basePosition, null);

  assert.equal(displayPosition, basePosition);
});
