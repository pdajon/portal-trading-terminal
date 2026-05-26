import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChartTrendLine } from "@/features/chart/types";

import {
  buildChartDrawingRailItems,
  buildChartDrawingObjectRows,
  buildChartFibonacciLevels,
  formatChartMeasurementLabel,
  getChartDrawingCreateSource,
  getChartTrendLineTool,
  resolveChartLogicalIndexForTime,
  resolveChartTimeForLogicalIndex,
} from "./chart-drawing-tools";

function line(
  overrides: Partial<ChartTrendLine> = {},
): ChartTrendLine {
  return {
    createdAt: "2026-05-16T00:00:00.000Z",
    endPrice: 105,
    endTime: 1_700_003_600,
    id: "line-1",
    source: "context-menu-two-point",
    startPrice: 100,
    startTime: 1_700_000_000,
    symbol: "BTC-USD",
    ...overrides,
  };
}

test("resolves chart drawing tools from current and legacy line sources", () => {
  assert.equal(getChartTrendLineTool(line()), "trend-line");
  assert.equal(
    getChartTrendLineTool(line({ source: "context-menu-vertical-ray" })),
    "vertical-ray",
  );
  assert.equal(
    getChartTrendLineTool(line({ source: "context-menu-measurement" })),
    "measure",
  );
  assert.equal(
    getChartTrendLineTool(line({ source: "context-menu-fibonacci" })),
    "fibonacci",
  );
});

test("maps drawing tools to persisted chart line sources", () => {
  assert.equal(getChartDrawingCreateSource("trend-line"), "context-menu-two-point");
  assert.equal(
    getChartDrawingCreateSource("vertical-ray"),
    "context-menu-vertical-ray",
  );
  assert.equal(
    getChartDrawingCreateSource("measure"),
    "context-menu-measurement",
  );
  assert.equal(
    getChartDrawingCreateSource("fibonacci"),
    "context-menu-fibonacci",
  );
});

test("builds the compact Hyperliquid-style drawing rail order", () => {
  assert.deepEqual(
    buildChartDrawingRailItems().map((item) => [
      item.key,
      item.label,
      item.action,
    ]),
    [
      ["cursor", "Cursor", "cursor"],
      ["trend-line", "Trend line", "drawing-tool"],
      ["vertical-ray", "Vertical ray", "drawing-tool"],
      ["measure", "Measure move", "drawing-tool"],
      ["fibonacci", "Fibonacci", "drawing-tool"],
      ["zone", "Create zone", "zone"],
      ["trade-plan", "Trade plan", "trade-plan"],
      ["objects", "Objects", "objects"],
    ],
  );
});

test("resolves exact candle times to logical indexes", () => {
  assert.equal(
    resolveChartLogicalIndexForTime(
      [{ time: 100 }, { time: 160 }, { time: 220 }],
      160,
    ),
    1,
  );
});

test("interpolates drawing times between candles into fractional logical indexes", () => {
  assert.equal(
    resolveChartLogicalIndexForTime(
      [{ time: 100 }, { time: 160 }, { time: 220 }],
      130,
    ),
    0.5,
  );
});

test("extrapolates drawing times outside the visible candle set", () => {
  const candles = [{ time: 100 }, { time: 160 }, { time: 220 }];

  assert.equal(resolveChartLogicalIndexForTime(candles, 70), -0.5);
  assert.equal(resolveChartLogicalIndexForTime(candles, 250), 2.5);
});

test("resolves future logical drawing positions to forward synthetic candle times", () => {
  const candles = [{ time: 100 }, { time: 160 }, { time: 220 }];

  assert.equal(resolveChartTimeForLogicalIndex(candles, 2), 220);
  assert.equal(resolveChartTimeForLogicalIndex(candles, 2.5), 250);
  assert.equal(resolveChartTimeForLogicalIndex(candles, 3.5), 310);
});

test("resolves intra-candle logical drawing positions without snapping", () => {
  const candles = [{ time: 100 }, { time: 160 }, { time: 220 }];

  assert.equal(resolveChartTimeForLogicalIndex(candles, 0.5), 130);
  assert.equal(resolveChartTimeForLogicalIndex(candles, 1.25), 175);
});

test("returns null when a logical index cannot be resolved", () => {
  assert.equal(resolveChartLogicalIndexForTime([], 100), null);
  assert.equal(resolveChartLogicalIndexForTime([{ time: 100 }], 130), null);
  assert.equal(
    resolveChartLogicalIndexForTime([{ time: 100 }, { time: 100 }], 90),
    null,
  );
  assert.equal(resolveChartTimeForLogicalIndex([], 1), null);
  assert.equal(resolveChartTimeForLogicalIndex([{ time: 100 }], 1), null);
});

test("formats a compact measurement label with price, percent, and time delta", () => {
  assert.equal(
    formatChartMeasurementLabel({
      endPrice: 105,
      endTime: 1_700_007_200,
      startPrice: 100,
      startTime: 1_700_000_000,
    }),
    "+5.00 / +5.00% / 2h",
  );

  assert.equal(
    formatChartMeasurementLabel({
      endPrice: 78_500,
      endTime: 1_700_000_000,
      startPrice: 80_000,
      startTime: 1_700_003_600,
    }),
    "-1,500 / -1.88% / 1h",
  );
});

test("builds fibonacci retracement levels from the anchor price range", () => {
  assert.deepEqual(
    buildChartFibonacciLevels({ endPrice: 200, startPrice: 100 }),
    [
      { label: "0%", price: 200, ratio: 0 },
      { label: "23.6%", price: 176.4, ratio: 0.236 },
      { label: "38.2%", price: 161.8, ratio: 0.382 },
      { label: "50%", price: 150, ratio: 0.5 },
      { label: "61.8%", price: 138.2, ratio: 0.618 },
      { label: "78.6%", price: 121.4, ratio: 0.786 },
      { label: "100%", price: 100, ratio: 1 },
    ],
  );

  assert.deepEqual(
    buildChartFibonacciLevels({ endPrice: 100, startPrice: 200 }).map(
      (level) => level.price,
    ),
    [100, 123.6, 138.2, 150, 161.8, 178.6, 200],
  );
});

test("builds compact drawing object rows scoped to the active symbol", () => {
  const rows = buildChartDrawingObjectRows(
    [
      line({ id: "trend-1", symbol: "BTC-USD" }),
      line({
        id: "ray-1",
        source: "context-menu-vertical-ray",
        symbol: "BTC-USD",
      }),
      line({
        id: "measure-1",
        endPrice: 110,
        endTime: 1_700_003_600,
        source: "context-menu-measurement",
        startPrice: 100,
        startTime: 1_700_000_000,
        symbol: "BTC-USD",
      }),
      line({
        id: "fib-1",
        customLabel: "Pullback zone",
        endPrice: 105,
        isHidden: true,
        isLocked: true,
        source: "context-menu-fibonacci",
        startPrice: 100,
        symbol: "BTC-USD",
      }),
      line({ id: "eth-1", symbol: "ETH-USD" }),
    ],
    "BTC-USD",
  );

  assert.deepEqual(
    rows.map((row) => [row.id, row.label, row.detail, row.tool]),
    [
      ["trend-1", "Trend line 1", "100 -> 105", "trend-line"],
      ["ray-1", "Vertical ray 1", "Time marker", "vertical-ray"],
      ["measure-1", "Measure 1", "+10 / +10.00% / 1h", "measure"],
      ["fib-1", "Pullback zone", "100 -> 105", "fibonacci"],
    ],
  );

  assert.deepEqual(
    rows.map((row) => [row.id, row.defaultLabel, row.isHidden, row.isLocked]),
    [
      ["trend-1", "Trend line 1", false, false],
      ["ray-1", "Vertical ray 1", false, false],
      ["measure-1", "Measure 1", false, false],
      ["fib-1", "Fibonacci 1", true, true],
    ],
  );
});
