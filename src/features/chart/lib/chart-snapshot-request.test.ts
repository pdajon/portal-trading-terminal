import assert from "node:assert/strict";
import test from "node:test";

import {
  ChartSnapshotRequestError,
  buildChartSnapshotRequestUrl,
  fetchChartSnapshotCandles,
} from "./chart-snapshot-request";

test("builds a single chart snapshot request for the selected timeframe", () => {
  assert.equal(
    buildChartSnapshotRequestUrl("BTC-USD", "15m"),
    "/api/chart?symbol=BTC-USD&interval=15m",
  );
});

test("builds a fresh chart snapshot request when cache bypass is required", () => {
  assert.equal(
    buildChartSnapshotRequestUrl("BTC-USD", "1m", { fresh: true }),
    "/api/chart?symbol=BTC-USD&interval=1m&fresh=1",
  );
});

test("retries transient chart snapshot failures before surfacing an error", async () => {
  const attempts: string[] = [];
  const fetcher = async (url: string) => {
    attempts.push(url);

    if (attempts.length === 1) {
      return {
        ok: false,
        status: 502,
        json: async () => ({ error: "temporarily unavailable" }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => [
        { close: 100, high: 101, low: 99, open: 100, time: 1 },
      ],
    };
  };

  const candles = await fetchChartSnapshotCandles("ETH-USD", "5m", {
    fetcher,
    retryDelayMs: 0,
  });

  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts, [
    "/api/chart?symbol=ETH-USD&interval=5m",
    "/api/chart?symbol=ETH-USD&interval=5m",
  ]);
  assert.equal(candles[0]?.close, 100);
});

test("surfaces missing index providers without retrying into a blank chart", async () => {
  const attempts: string[] = [];
  const fetcher = async (url: string) => {
    attempts.push(url);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candles: [],
        code: "INDEX_PROVIDER_MISSING",
        error: "Index data source not connected yet.",
        state: "provider-missing",
      }),
    };
  };

  await assert.rejects(
    fetchChartSnapshotCandles("TOTAL", "15m", {
      fetcher,
      retryDelayMs: 0,
    }),
    (error) =>
      error instanceof ChartSnapshotRequestError &&
      error.code === "provider-missing" &&
      error.message === "Index data source not connected yet.",
  );
  assert.deepEqual(attempts, ["/api/chart?symbol=TOTAL&interval=15m"]);
});

test("surfaces unsupported index timeframes without retrying into a blank chart", async () => {
  const attempts: string[] = [];
  const fetcher = async (url: string) => {
    attempts.push(url);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candles: [],
        code: "INDEX_UNSUPPORTED_TIMEFRAME",
        error:
          "CoinGecko index candles currently support 1h and 1d timeframes only.",
        state: "unsupported-timeframe",
      }),
    };
  };

  await assert.rejects(
    fetchChartSnapshotCandles("TOTAL", "15m", {
      fetcher,
      retryDelayMs: 0,
    }),
    (error) =>
      error instanceof ChartSnapshotRequestError &&
      error.code === "unsupported-timeframe" &&
      error.message ===
        "CoinGecko index candles currently support 1h and 1d timeframes only.",
  );
  assert.deepEqual(attempts, ["/api/chart?symbol=TOTAL&interval=15m"]);
});

test("surfaces plan-limited index providers without retrying into chart unavailable", async () => {
  const attempts: string[] = [];
  const fetcher = async (url: string) => {
    attempts.push(url);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candles: [],
        code: "INDEX_PROVIDER_LIMITED",
        error: "CoinGecko index history is not available for this API key.",
        state: "provider-limited",
      }),
    };
  };

  await assert.rejects(
    fetchChartSnapshotCandles("TOTAL", "1h", {
      fetcher,
      retryDelayMs: 0,
    }),
    (error) =>
      error instanceof ChartSnapshotRequestError &&
      error.code === "provider-limited" &&
      error.message ===
        "CoinGecko index history is not available for this API key.",
  );
  assert.deepEqual(attempts, ["/api/chart?symbol=TOTAL&interval=1h"]);
});

test("returns empty candle arrays so the chart can show a no-data state", async () => {
  const candles = await fetchChartSnapshotCandles("TOTAL", "15m", {
    fetcher: async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }),
    retryDelayMs: 0,
  });

  assert.deepEqual(candles, []);
});
