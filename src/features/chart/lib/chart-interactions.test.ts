import assert from "node:assert/strict";
import test from "node:test";

import { isChartRightPriceAxisPoint } from "./chart-interactions";

test("right price-axis points are excluded from order-line drag hit testing", () => {
  assert.equal(
    isChartRightPriceAxisPoint({
      containerWidth: 1000,
      priceScaleWidth: 72,
      x: 928,
    }),
    true,
  );
  assert.equal(
    isChartRightPriceAxisPoint({
      containerWidth: 1000,
      priceScaleWidth: 72,
      x: 927.9,
    }),
    false,
  );
});

test("right price-axis guard ignores unusable chart geometry", () => {
  assert.equal(
    isChartRightPriceAxisPoint({
      containerWidth: 0,
      priceScaleWidth: 72,
      x: 999,
    }),
    false,
  );
  assert.equal(
    isChartRightPriceAxisPoint({
      containerWidth: 1000,
      priceScaleWidth: -1,
      x: 999,
    }),
    false,
  );
});

test("right price-axis guard keeps a native interaction gutter even before scale width settles", () => {
  assert.equal(
    isChartRightPriceAxisPoint({
      containerWidth: 1000,
      priceScaleWidth: 0,
      x: 928,
    }),
    true,
  );
  assert.equal(
    isChartRightPriceAxisPoint({
      containerWidth: 1000,
      priceScaleWidth: 48,
      x: 927.9,
    }),
    false,
  );
});
