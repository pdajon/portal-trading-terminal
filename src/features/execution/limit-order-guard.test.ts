import assert from "node:assert/strict";
import test from "node:test";

import { evaluateLimitOrderPlacementGuard } from "./limit-order-guard";

test("allows normal same-direction limit buy while long position exists as scale-in", () => {
  const result = evaluateLimitOrderPlacementGuard(
    { direction: "long" },
    { direction: "long" },
  );

  assert.deepEqual(result, { allowed: true, scaleIn: true });
});

test("allows normal same-direction limit sell while short position exists as scale-in", () => {
  const result = evaluateLimitOrderPlacementGuard(
    { direction: "short" },
    { direction: "short" },
  );

  assert.deepEqual(result, { allowed: true, scaleIn: true });
});

test("allows normal opposite-side limit orders while a live position exists", () => {
  const sellAgainstLong = evaluateLimitOrderPlacementGuard(
    { direction: "short" },
    { direction: "long" },
  );
  const buyAgainstShort = evaluateLimitOrderPlacementGuard(
    { direction: "long" },
    { direction: "short" },
  );

  assert.deepEqual(sellAgainstLong, { allowed: true, scaleIn: false });
  assert.deepEqual(buyAgainstShort, { allowed: true, scaleIn: false });
});

test("allows reduce-only orders only when they reduce the live position", () => {
  const reduceLong = evaluateLimitOrderPlacementGuard(
    { direction: "short", reduceOnly: true },
    { direction: "long" },
  );
  const reduceShort = evaluateLimitOrderPlacementGuard(
    { direction: "long", reduceOnly: true },
    { direction: "short" },
  );

  assert.deepEqual(reduceLong, { allowed: true, scaleIn: false });
  assert.deepEqual(reduceShort, { allowed: true, scaleIn: false });
});

test("blocks reduce-only orders that point in the same direction as the live position", () => {
  const invalidLong = evaluateLimitOrderPlacementGuard(
    { direction: "long", reduceOnly: true },
    { direction: "long" },
  );
  const invalidShort = evaluateLimitOrderPlacementGuard(
    { direction: "short", reduceOnly: true },
    { direction: "short" },
  );

  assert.deepEqual(invalidLong, {
    allowed: false,
    reason: "Reduce-only limit order invalid for the live long position.",
    scaleIn: false,
  });
  assert.deepEqual(invalidShort, {
    allowed: false,
    reason: "Reduce-only limit order invalid for the live short position.",
    scaleIn: false,
  });
});
