import assert from "node:assert/strict";
import test from "node:test";

import {
  formatProtectionOffsetInput,
  formatProtectionPriceInput,
  parseProtectionNumber,
  resolveProtectionOffsetFromPrice,
  resolveProtectionPriceFromOffset,
} from "./protection-offset";

test("resolves long TP gain and SL loss percentages into prices", () => {
  assert.equal(
    resolveProtectionPriceFromOffset({
      direction: "long",
      entryPrice: 2000,
      kind: "target",
      offset: 5,
      positionSize: 2,
      unit: "percent",
    }),
    2100,
  );
  assert.equal(
    resolveProtectionPriceFromOffset({
      direction: "long",
      entryPrice: 2000,
      kind: "stop",
      offset: 5,
      positionSize: 2,
      unit: "percent",
    }),
    1900,
  );
});

test("resolves short TP gain and SL loss percentages into prices", () => {
  assert.equal(
    resolveProtectionPriceFromOffset({
      direction: "short",
      entryPrice: 2000,
      kind: "target",
      offset: 5,
      positionSize: 2,
      unit: "percent",
    }),
    1900,
  );
  assert.equal(
    resolveProtectionPriceFromOffset({
      direction: "short",
      entryPrice: 2000,
      kind: "stop",
      offset: 5,
      positionSize: 2,
      unit: "percent",
    }),
    2100,
  );
});

test("resolves dollar gain and loss offsets through position size", () => {
  assert.equal(
    resolveProtectionPriceFromOffset({
      direction: "long",
      entryPrice: 2000,
      kind: "target",
      offset: 400,
      positionSize: 2,
      unit: "usdc",
    }),
    2200,
  );
  assert.equal(
    resolveProtectionPriceFromOffset({
      direction: "short",
      entryPrice: 2000,
      kind: "stop",
      offset: 300,
      positionSize: 2,
      unit: "usdc",
    }),
    2150,
  );
});

test("derives visible offset values from TP and SL prices", () => {
  assert.equal(
    resolveProtectionOffsetFromPrice({
      direction: "long",
      entryPrice: 2000,
      kind: "target",
      positionSize: 2,
      price: 2200,
      unit: "percent",
    }),
    10,
  );
  assert.equal(
    resolveProtectionOffsetFromPrice({
      direction: "short",
      entryPrice: 2000,
      kind: "stop",
      positionSize: 2,
      price: 2150,
      unit: "usdc",
    }),
    300,
  );
});

test("parses and formats protection modal numbers for ledger strings", () => {
  assert.equal(parseProtectionNumber("1.9401 ETH"), 1.9401);
  assert.equal(parseProtectionNumber("2,128.95"), 2128.95);
  assert.equal(parseProtectionNumber("--"), null);
  assert.equal(formatProtectionPriceInput(2128.95000001), "2128.95");
  assert.equal(formatProtectionOffsetInput(12.5, "percent"), "12.5");
  assert.equal(formatProtectionOffsetInput(300, "usdc"), "300");
});
