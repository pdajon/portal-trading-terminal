import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeStoredChartTrendLines } from "./chart-trend-line-storage";

test("normalizes persisted chart drawing lines for all native drawing tools", () => {
  const lines = normalizeStoredChartTrendLines([
    {
      createdAt: "2026-05-16T00:00:00.000Z",
      endPrice: 101,
      endTime: 1_700_000_060,
      id: "trend",
      source: "context-menu-two-point",
      startPrice: 100,
      startTime: 1_700_000_000,
      symbol: "BTC-USD",
    },
    {
      createdAt: "2026-05-16T00:00:01.000Z",
      endPrice: 100,
      endTime: 1_700_000_000,
      id: "ray",
      source: "context-menu-vertical-ray",
      startPrice: 100,
      startTime: 1_700_000_000,
      symbol: "ETH-USD",
    },
    {
      createdAt: "2026-05-16T00:00:02.000Z",
      endPrice: 105,
      endTime: 1_700_003_600,
      id: "measure",
      source: "context-menu-measurement",
      startPrice: 100,
      startTime: 1_700_000_000,
      symbol: "SOL-USD",
    },
    {
      customLabel: "Pullback zone",
      createdAt: "2026-05-16T00:00:03.000Z",
      endPrice: 105,
      endTime: 1_700_003_600,
      id: "fib",
      isHidden: true,
      isLocked: true,
      source: "context-menu-fibonacci",
      startPrice: 100,
      startTime: 1_700_000_000,
      symbol: "BTC-USD",
    },
  ]);

  assert.deepEqual(
    lines.map((line) => [
      line.id,
      line.source,
      line.customLabel ?? null,
      line.isHidden ?? false,
      line.isLocked ?? false,
    ]),
    [
      ["trend", "context-menu-two-point", null, false, false],
      ["ray", "context-menu-vertical-ray", null, false, false],
      ["measure", "context-menu-measurement", null, false, false],
      ["fib", "context-menu-fibonacci", "Pullback zone", true, true],
    ],
  );
});

test("drops malformed persisted chart drawing records", () => {
  const lines = normalizeStoredChartTrendLines([
    null,
    {
      createdAt: "2026-05-16T00:00:00.000Z",
      endPrice: 101,
      endTime: 1_700_000_060,
      id: "bad-source",
      source: "unknown",
      startPrice: 100,
      startTime: 1_700_000_000,
      symbol: "BTC-USD",
    },
    {
      createdAt: "2026-05-16T00:00:00.000Z",
      endPrice: 101,
      endTime: 1_700_000_060,
      id: "valid",
      source: "context-menu-two-point",
      startPrice: 100,
      startTime: 1_700_000_000,
      symbol: "BTC-USD",
    },
  ]);

  assert.deepEqual(lines.map((line) => line.id), ["valid"]);
});
