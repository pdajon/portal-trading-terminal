import assert from "node:assert/strict";
import test from "node:test";

import {
  clearIndexCandleProviderCacheForTests,
  fetchIndexCandles,
  INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE,
} from "./index-candle-provider";

const originalFetch = globalThis.fetch;
const originalEnv = {
  coingeckoApiBaseUrl: process.env.COINGECKO_API_BASE_URL,
  coingeckoApiKey: process.env.COINGECKO_API_KEY,
  coingeckoMinRequestIntervalMs:
    process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS,
  customProviderUrl: process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL,
};

function restoreEnv() {
  if (originalEnv.coingeckoApiBaseUrl === undefined) {
    delete process.env.COINGECKO_API_BASE_URL;
  } else {
    process.env.COINGECKO_API_BASE_URL = originalEnv.coingeckoApiBaseUrl;
  }

  if (originalEnv.coingeckoApiKey === undefined) {
    delete process.env.COINGECKO_API_KEY;
  } else {
    process.env.COINGECKO_API_KEY = originalEnv.coingeckoApiKey;
  }

  if (originalEnv.coingeckoMinRequestIntervalMs === undefined) {
    delete process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS;
  } else {
    process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS =
      originalEnv.coingeckoMinRequestIntervalMs;
  }

  if (originalEnv.customProviderUrl === undefined) {
    delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
  } else {
    process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL = originalEnv.customProviderUrl;
  }
}

function enableCoinGeckoForTests() {
  delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
  process.env.COINGECKO_API_BASE_URL = "https://coingecko.test/api/v3";
  process.env.COINGECKO_API_KEY = "test-key";
  process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS = "0";
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
  clearIndexCandleProviderCacheForTests();
});

test("index provider reports missing when no provider or CoinGecko key is configured", async () => {
  delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
  delete process.env.COINGECKO_API_KEY;

  const result = await fetchIndexCandles({
    endTime: 1_700_003_600_000,
    interval: "1h",
    startTime: 1_700_000_000_000,
    symbol: "TOTAL",
    tradingViewSymbol: "CRYPTOCAP:TOTAL",
  });

  assert.deepEqual(result, {
    error: "Index data source not connected yet.",
    status: "provider-missing",
  });
});

test("CoinGecko index provider rejects unsupported lower timeframes without fetching", async () => {
  enableCoinGeckoForTests();
  let fetchCalled = false;

  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({});
  };

  const result = await fetchIndexCandles({
    endTime: 1_700_003_600_000,
    interval: "15m",
    startTime: 1_700_000_000_000,
    symbol: "TOTAL",
    tradingViewSymbol: "CRYPTOCAP:TOTAL",
  });

  assert.equal(result.status, "unsupported-timeframe");
  assert.equal(result.code, INDEX_CANDLE_UNSUPPORTED_TIMEFRAME_CODE);
  assert.equal(fetchCalled, false);
});

test("CoinGecko index provider returns TOTAL market-cap candles", async () => {
  enableCoinGeckoForTests();
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));

    return Response.json({
      market_cap_chart: {
        market_cap: [
          [1_700_000_000_000, 2_400_000_000_000],
          [1_700_003_600_000, 2_450_000_000_000],
        ],
        volume: [],
      },
    });
  };

  const result = await fetchIndexCandles({
    endTime: 1_700_003_600_000,
    interval: "1h",
    startTime: 1_700_000_000_000,
    symbol: "TOTAL",
    tradingViewSymbol: "CRYPTOCAP:TOTAL",
  });

  assert.equal(result.status, "loaded");
  assert.equal(result.provider, "coingecko");
  assert.equal(result.candles.length, 2);
  assert.equal(result.candles[0]?.close, 2_400_000_000_000);
  assert.equal(result.candles[1]?.time, 1_700_002_800);
  assert.match(requestedUrls[0] ?? "", /global\/market_cap_chart/);
  assert.match(requestedUrls[0] ?? "", /days=1/);
});

test("CoinGecko index provider reports plan-limited global market-cap access", async () => {
  enableCoinGeckoForTests();

  globalThis.fetch = async () =>
    Response.json(
      {
        status: {
          error_code: 10005,
          error_message:
            "This request is limited to PRO API subscribers.",
        },
      },
      { status: 401 },
    );

  const result = await fetchIndexCandles({
    endTime: 1_700_003_600_000,
    interval: "1h",
    startTime: 1_700_000_000_000,
    symbol: "TOTAL",
    tradingViewSymbol: "CRYPTOCAP:TOTAL",
  });

  assert.equal(result.status, "provider-limited");
  assert.equal(result.code, "INDEX_PROVIDER_LIMITED");
  assert.equal(
    result.error,
    "CoinGecko index history is not available for this API key.",
  );
});

test("CoinGecko index provider calculates BTC dominance from market caps", async () => {
  enableCoinGeckoForTests();

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("/global/market_cap_chart")) {
      return Response.json({
        market_cap_chart: {
          market_cap: [
            [1_700_000_000_000, 2_000_000_000_000],
            [1_700_003_600_000, 2_500_000_000_000],
          ],
        },
      });
    }

    if (url.includes("/coins/bitcoin/market_chart/range")) {
      return Response.json({
        market_caps: [
          [1_700_000_000_000, 1_000_000_000_000],
          [1_700_003_600_000, 1_250_000_000_000],
        ],
      });
    }

    throw new Error(`Unexpected CoinGecko URL: ${url}`);
  };

  const result = await fetchIndexCandles({
    endTime: 1_700_003_600_000,
    interval: "1h",
    startTime: 1_700_000_000_000,
    symbol: "BTC.D",
    tradingViewSymbol: "CRYPTOCAP:BTC.D",
  });

  assert.equal(result.status, "loaded");
  assert.equal(result.candles[0]?.close, 50);
  assert.equal(result.candles[1]?.close, 50);
});

test("CoinGecko index provider calculates TOTAL3 from total minus BTC and ETH market caps", async () => {
  enableCoinGeckoForTests();

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("/global/market_cap_chart")) {
      return Response.json({
        market_cap_chart: {
          market_cap: [[1_700_000_000_000, 2_000_000_000_000]],
        },
      });
    }

    if (url.includes("/coins/bitcoin/market_chart/range")) {
      return Response.json({
        market_caps: [[1_700_000_000_000, 800_000_000_000]],
      });
    }

    if (url.includes("/coins/ethereum/market_chart/range")) {
      return Response.json({
        market_caps: [[1_700_000_000_000, 300_000_000_000]],
      });
    }

    throw new Error(`Unexpected CoinGecko URL: ${url}`);
  };

  const result = await fetchIndexCandles({
    endTime: 1_700_003_600_000,
    interval: "1h",
    startTime: 1_700_000_000_000,
    symbol: "TOTAL3",
    tradingViewSymbol: "CRYPTOCAP:TOTAL3",
  });

  assert.equal(result.status, "loaded");
  assert.equal(result.formula, "TOTAL - BTC - ETH");
  assert.equal(result.candles[0]?.close, 900_000_000_000);
});

test("CoinGecko index provider coalesces repeated identical requests", async () => {
  enableCoinGeckoForTests();
  let fetchCount = 0;

  globalThis.fetch = async () => {
    fetchCount += 1;

    return Response.json({
      market_cap_chart: {
        market_cap: [[1_700_000_000_000, 2_400_000_000_000]],
      },
    });
  };

  const request = {
    endTime: 1_700_003_600_000,
    interval: "1h" as const,
    startTime: 1_700_000_000_000,
    symbol: "TOTAL",
    tradingViewSymbol: "CRYPTOCAP:TOTAL",
  };

  const [firstResult, secondResult] = await Promise.all([
    fetchIndexCandles(request),
    fetchIndexCandles(request),
  ]);

  assert.equal(firstResult.status, "loaded");
  assert.equal(secondResult.status, "loaded");
  assert.equal(fetchCount, 1);
});
