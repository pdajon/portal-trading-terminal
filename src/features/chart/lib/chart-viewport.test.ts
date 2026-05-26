import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_RIGHT_OFFSET_BARS,
  DEFAULT_RIGHT_OFFSET_SECONDS,
  DEFAULT_VISIBLE_CANDLE_COUNT,
  buildChartFutureWhitespaceTimes,
  getDefaultChartRightOffsetBars,
  getDefaultChartVisibleLogicalRange,
} from "./chart-viewport";

test("default chart viewport waits for enough candle data", () => {
  assert.equal(getDefaultChartVisibleLogicalRange(0), null);
  assert.equal(getDefaultChartVisibleLogicalRange(1), null);
});

test("default chart viewport keeps short histories anchored at the latest candle", () => {
  assert.deepEqual(getDefaultChartVisibleLogicalRange(20), {
    from: 0,
    to: 19 + DEFAULT_RIGHT_OFFSET_BARS,
  });
});

test("default chart viewport includes bounded future drawing workspace", () => {
  const candleCount = 500;
  const lastIndex = candleCount - 1;

  assert.deepEqual(getDefaultChartVisibleLogicalRange(candleCount), {
    from: lastIndex - DEFAULT_VISIBLE_CANDLE_COUNT + 1,
    to: lastIndex + DEFAULT_RIGHT_OFFSET_BARS,
  });
});

test("default chart right offset allows future interaction without multi-day drift", () => {
  assert.equal(DEFAULT_RIGHT_OFFSET_SECONDS, 12 * 60 * 60);
  assert.equal(getDefaultChartRightOffsetBars("1m"), DEFAULT_RIGHT_OFFSET_BARS);
  assert.equal(getDefaultChartRightOffsetBars("5m"), DEFAULT_RIGHT_OFFSET_BARS);
  assert.equal(getDefaultChartRightOffsetBars("15m"), 48);
  assert.equal(getDefaultChartRightOffsetBars("1h"), 12);
  assert.equal(getDefaultChartRightOffsetBars("1d"), 1);
});

test("default visible range accepts timeframe-aware future workspace", () => {
  const candleCount = 500;
  const lastIndex = candleCount - 1;
  const rightOffsetBars = getDefaultChartRightOffsetBars("15m");

  assert.deepEqual(
    getDefaultChartVisibleLogicalRange(candleCount, { rightOffsetBars }),
    {
      from: lastIndex - DEFAULT_VISIBLE_CANDLE_COUNT + 1,
      to: lastIndex + rightOffsetBars,
    },
  );
});

test("builds future whitespace times so the time axis can label future dates", () => {
  assert.deepEqual(
    buildChartFutureWhitespaceTimes({
      candles: [{ time: 100 }, { time: 160 }],
      rightOffsetBars: 3,
      timeframe: "1m",
    }),
    [220, 280, 340],
  );

  assert.equal(
    buildChartFutureWhitespaceTimes({
      candles: [{ time: 100 }, { time: 160 }],
      rightOffsetBars: getDefaultChartRightOffsetBars("15m"),
      timeframe: "15m",
    }).at(-1),
    160 + DEFAULT_RIGHT_OFFSET_SECONDS,
  );
});
