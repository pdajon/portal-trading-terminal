import assert from "node:assert/strict";
import test from "node:test";

import type { PriceCandle } from "@/features/chart/types";
import {
  calculateAtr,
  calculateEma,
  calculateMacd,
  calculateRsi,
  calculateSma,
  calculateVwap,
} from "./chart-indicators";

function candle(time: number, close: number, volume = 100): PriceCandle {
  return {
    close,
    high: close + 1,
    low: close - 1,
    open: close - 0.5,
    time,
    volume,
  };
}

test("calculates moving averages from candle closes", () => {
  const candles = [1, 2, 3, 4, 5].map((close, index) =>
    candle(index + 1, close),
  );

  assert.deepEqual(calculateSma(candles, 3), [
    { time: 3, value: 2 },
    { time: 4, value: 3 },
    { time: 5, value: 4 },
  ]);
  assert.equal(calculateEma(candles, 3).at(-1)?.value, 4);
});

test("calculates VWAP only from candles with usable volume", () => {
  const candles = [
    candle(1, 10, 10),
    candle(2, 20, 0),
    candle(3, 30, 30),
  ];

  const vwap = calculateVwap(candles);

  assert.equal(vwap.length, 2);
  assert.equal(vwap[0]?.time, 1);
  assert.equal(vwap[1]?.time, 3);
  assert.equal(Number(vwap[1]?.value.toFixed(2)), 25);
});

test("calculates oscillator study data for native chart panes", () => {
  const candles = Array.from({ length: 60 }, (_, index) =>
    candle(index + 1, 100 + Math.sin(index / 3) * 4 + index * 0.2, 120),
  );

  assert.ok(calculateRsi(candles).length > 0);
  assert.ok(calculateAtr(candles).length > 0);

  const macd = calculateMacd(candles);
  assert.ok(macd.macd.length > 0);
  assert.ok(macd.signal.length > 0);
  assert.ok(macd.histogram.length > 0);
});
