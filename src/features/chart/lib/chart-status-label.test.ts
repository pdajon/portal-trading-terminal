import assert from "node:assert/strict";
import test from "node:test";

import { getChartStatusLabel } from "./chart-status-label";

test("getChartStatusLabel names the active asset while loading", () => {
  assert.equal(
    getChartStatusLabel({ baseAsset: "ETH", status: "loading" }).title,
    "Loading ETH chart",
  );
});

test("getChartStatusLabel keeps unavailable copy asset-neutral", () => {
  assert.equal(
    getChartStatusLabel({ baseAsset: "SOL", status: "fetch-failed" }).title,
    "Chart unavailable",
  );
});

test("getChartStatusLabel explains missing index provider state", () => {
  assert.deepEqual(
    getChartStatusLabel({ baseAsset: "TOTAL", status: "provider-missing" }),
    {
      detail:
        "This chart is registered for Magic Trade triggers, but needs a live index candle provider before candles can render.",
      title: "Index data source not connected yet.",
    },
  );
});

test("getChartStatusLabel explains unsupported index timeframe state", () => {
  assert.deepEqual(
    getChartStatusLabel({ baseAsset: "TOTAL", status: "unsupported-timeframe" }),
    {
      detail:
        "CoinGecko index data is live only on supported index timeframes. Switch to 1h or 1d to render real candles.",
      title: "Index timeframe not supported",
    },
  );
});

test("getChartStatusLabel explains plan-limited index provider state", () => {
  assert.deepEqual(
    getChartStatusLabel({ baseAsset: "TOTAL", status: "provider-limited" }),
    {
      detail:
        "TOTAL and dominance candles require CoinGecko global market-cap history. Connect an API plan or provider with that endpoint before signal candles can render.",
      title: "CoinGecko index history unavailable",
    },
  );
});

test("getChartStatusLabel distinguishes no candle data from fetch failure", () => {
  assert.deepEqual(
    getChartStatusLabel({ baseAsset: "TOTAL", status: "no-data" }),
    {
      detail: null,
      title: "No chart data returned",
    },
  );
});
