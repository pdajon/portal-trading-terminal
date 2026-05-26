import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveExecutionSizing,
  getExecutionSizingMetadata,
} from "./execution-sizing";
import * as executionSizing from "./execution-sizing";

test("rejects ambiguous execution size payloads", () => {
  const result = resolveExecutionSizing({
    size: 20,
    symbol: "BTC-USD",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "Ambiguous execution size. Send baseSize or notionalUsdc with conversionPrice.");
});

test("accepts explicit base size and records notional metadata", () => {
  const result = resolveExecutionSizing({
    baseSize: 0.001,
    conversionPrice: 80_000,
    intendedNotionalUsdc: 80,
    symbol: "BTC-USD",
  });

  assert.deepEqual(result, {
    baseSize: 0.001,
    estimatedNotionalUsdc: 80,
    ok: true,
    sizingUnit: "base",
  });
});

test("preserves already valid BTC base size precision during safety validation", () => {
  const result = resolveExecutionSizing({
    baseSize: 0.00112,
    conversionPrice: 80_616,
    intendedNotionalUsdc: 91.57,
    symbol: "BTC-USD",
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.baseSize, 0.00112);
  }
});

test("accepts explicit USDC notional when conversion price is present", () => {
  const result = resolveExecutionSizing({
    conversionPrice: 80_000,
    notionalUsdc: 40,
    symbol: "BTC-USD",
  });

  assert.deepEqual(result, {
    baseSize: 0.0005,
    estimatedNotionalUsdc: 40,
    ok: true,
    sizingUnit: "notional_usdc",
  });
});

test("allows larger testnet notional sizing above the old five hundred USDC cap", () => {
  const result = resolveExecutionSizing({
    conversionPrice: 80_000,
    notionalUsdc: 1_500,
    symbol: "BTC-USD",
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.estimatedNotionalUsdc, 1_500);
    assert.equal(result.sizingUnit, "notional_usdc");
  }
});

test("rejects oversized explicit base size before exchange execution", () => {
  const result = resolveExecutionSizing({
    baseSize: 20,
    symbol: "BTC-USD",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "Execution size exceeds Portal V1 testnet safety limit for BTC-USD.");
});

test("rejects base size when intended notional and conversion metadata disagree", () => {
  const result = resolveExecutionSizing({
    baseSize: 0.0342,
    conversionPrice: 80_557.7,
    intendedNotionalUsdc: 20,
    symbol: "BTC-USD",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "Execution sizing metadata does not match the requested base size.");
});

test("builds first-party sizing metadata from allocation, notional, base size, and price", () => {
  assert.deepEqual(
    getExecutionSizingMetadata({
      allocationPercent: 10,
      baseSize: 0.00024,
      conversionPrice: 82_000,
      intendedNotionalUsdc: 20,
    }),
    {
      allocationPercent: 10,
      baseSize: 0.00024,
      conversionPrice: 82_000,
      estimatedNotionalUsdc: 19.68,
      intendedNotionalUsdc: 20,
      sizingUnit: "base",
    },
  );
});

test("parses editable collateral allocation percentages", () => {
  const sizingHelpers = executionSizing as typeof executionSizing & {
    parseCollateralAllocationPercentInput?: (value: string) => number | null;
  };

  assert.equal(
    typeof sizingHelpers.parseCollateralAllocationPercentInput,
    "function",
  );
  assert.equal(sizingHelpers.parseCollateralAllocationPercentInput?.("25"), 25);
  assert.equal(sizingHelpers.parseCollateralAllocationPercentInput?.("25%"), 25);
  assert.equal(sizingHelpers.parseCollateralAllocationPercentInput?.("12.5"), 13);
  assert.equal(sizingHelpers.parseCollateralAllocationPercentInput?.("125"), 100);
  assert.equal(sizingHelpers.parseCollateralAllocationPercentInput?.("-4"), 0);
  assert.equal(sizingHelpers.parseCollateralAllocationPercentInput?.(""), null);
  assert.equal(sizingHelpers.parseCollateralAllocationPercentInput?.("abc"), null);
});
