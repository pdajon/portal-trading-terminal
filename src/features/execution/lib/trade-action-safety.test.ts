import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MARKET_MAX_SLIPPAGE_PERCENT,
  MAX_DEMO_MARKET_SLIPPAGE_PERCENT,
  MAX_MARKET_MAX_SLIPPAGE_PERCENT,
  MIN_MARKET_MAX_SLIPPAGE_PERCENT,
  getMarketTradeActionSafety,
  normalizeMarketMaxSlippagePercent,
} from "./trade-action-safety";

test("getMarketTradeActionSafety blocks market execution when estimated slippage is above the demo max", () => {
  const safety = getMarketTradeActionSafety({
    estimatedSlippagePercent: MAX_DEMO_MARKET_SLIPPAGE_PERCENT + 0.01,
    executionMode: "market",
    primaryExecutableSize: 1,
    requestInFlight: false,
  });

  assert.equal(safety.disabled, true);
  assert.equal(safety.reason, "slippage-too-high");
  assert.equal(safety.tone, "danger");
});

test("getMarketTradeActionSafety does not block limit execution or unknown slippage", () => {
  assert.deepEqual(
    getMarketTradeActionSafety({
      estimatedSlippagePercent: MAX_DEMO_MARKET_SLIPPAGE_PERCENT + 1,
      executionMode: "limit",
      primaryExecutableSize: 1,
      requestInFlight: false,
    }),
    {
      disabled: false,
      reason: null,
      tone: "ready",
    },
  );

  assert.equal(
    getMarketTradeActionSafety({
      estimatedSlippagePercent: null,
      executionMode: "market",
      primaryExecutableSize: 1,
      requestInFlight: false,
    }).disabled,
    false,
  );
});

test("getMarketTradeActionSafety allows market execution when resting orders exist", () => {
  const safety = getMarketTradeActionSafety({
    estimatedSlippagePercent: 0.05,
    executionMode: "market",
    livePendingOrderCount: 4,
    primaryExecutableSize: 0.005,
    requestInFlight: false,
  });

  assert.deepEqual(safety, {
    disabled: false,
    reason: null,
    tone: "ready",
  });
});

test("getMarketTradeActionSafety uses the configured max market slippage", () => {
  assert.equal(
    getMarketTradeActionSafety({
      estimatedSlippagePercent: 1.25,
      executionMode: "market",
      maxSlippagePercent: 1,
      primaryExecutableSize: 0.005,
      requestInFlight: false,
    }).reason,
    "slippage-too-high",
  );

  assert.equal(
    getMarketTradeActionSafety({
      estimatedSlippagePercent: 1.25,
      executionMode: "market",
      maxSlippagePercent: 2,
      primaryExecutableSize: 0.005,
      requestInFlight: false,
    }).disabled,
    false,
  );
});

test("normalizeMarketMaxSlippagePercent clamps invalid values to Portal bounds", () => {
  assert.equal(
    normalizeMarketMaxSlippagePercent(Number.NaN),
    DEFAULT_MARKET_MAX_SLIPPAGE_PERCENT,
  );
  assert.equal(normalizeMarketMaxSlippagePercent(-1), MIN_MARKET_MAX_SLIPPAGE_PERCENT);
  assert.equal(
    normalizeMarketMaxSlippagePercent(99),
    MAX_MARKET_MAX_SLIPPAGE_PERCENT,
  );
});
