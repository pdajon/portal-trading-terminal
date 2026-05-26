import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultChartLookbackMs } from "@/features/chart/lib/chart-lookback";
import { clearIndexCandleProviderCacheForTests } from "@/features/chart/data/index-candle-provider";
import { GET } from "./route";
import { resetHyperliquidMarketMetadataCacheForTests } from "@/lib/markets/hyperliquid-market-data";

const originalFetch = globalThis.fetch;
const originalCoinGeckoApiBaseUrl = process.env.COINGECKO_API_BASE_URL;
const originalCoinGeckoApiKey = process.env.COINGECKO_API_KEY;
const originalCoinGeckoMinRequestIntervalMs =
  process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS;
const originalProviderUrl = process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetHyperliquidMarketMetadataCacheForTests();
  clearIndexCandleProviderCacheForTests();

  if (originalCoinGeckoApiBaseUrl === undefined) {
    delete process.env.COINGECKO_API_BASE_URL;
  } else {
    process.env.COINGECKO_API_BASE_URL = originalCoinGeckoApiBaseUrl;
  }

  if (originalCoinGeckoApiKey === undefined) {
    delete process.env.COINGECKO_API_KEY;
  } else {
    process.env.COINGECKO_API_KEY = originalCoinGeckoApiKey;
  }

  if (originalCoinGeckoMinRequestIntervalMs === undefined) {
    delete process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS;
  } else {
    process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS =
      originalCoinGeckoMinRequestIntervalMs;
  }

  if (originalProviderUrl === undefined) {
    delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
  } else {
    process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL = originalProviderUrl;
  }
});

test("returns stale chart candles on a fresh request when Hyperliquid fails", async () => {
  const candles = [
    {
      t: 1_700_000_000_000,
      o: "100",
      h: "110",
      l: "95",
      c: "105",
      v: "123.45",
    },
  ];
  let candleFetchCount = 0;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { type?: string };

    if (body.type === "meta") {
      return Response.json({
        universe: [{ maxLeverage: 40, name: "BTC", szDecimals: 5 }],
      });
    }

    candleFetchCount += 1;

    if (candleFetchCount === 1) {
      return Response.json(candles);
    }

    return Response.json({ error: "temporary upstream failure" }, { status: 502 });
  };

  const firstResponse = await GET(
    new Request("http://localhost/api/chart?symbol=BTC-USD&interval=1m&from=1700000000000&to=1700000060000"),
  );
  assert.equal(firstResponse.status, 200);
  assert.equal(firstResponse.headers.get("X-Portal-Chart-Cache"), "miss");

  const staleResponse = await GET(
    new Request("http://localhost/api/chart?symbol=BTC-USD&interval=1m&from=1700000000000&to=1700000060000&fresh=1"),
  );
  assert.equal(staleResponse.status, 200);
  assert.equal(staleResponse.headers.get("X-Portal-Chart-Cache"), "stale");
  assert.equal(candleFetchCount, 2);

  const payload = (await staleResponse.json()) as Array<{
    close: number;
    volume: number | null;
  }>;
  assert.equal(payload[0]?.close, 105);
  assert.equal(payload[0]?.volume, 123.45);
});

test("default chart lookbacks load deeper candle windows for each interval", () => {
  assert.equal(getDefaultChartLookbackMs("1m"), 48 * 60 * 60 * 1000);
  assert.equal(getDefaultChartLookbackMs("5m"), 10 * 24 * 60 * 60 * 1000);
  assert.equal(getDefaultChartLookbackMs("15m"), 30 * 24 * 60 * 60 * 1000);
  assert.equal(getDefaultChartLookbackMs("1h"), 90 * 24 * 60 * 60 * 1000);
  assert.equal(getDefaultChartLookbackMs("1d"), 365 * 24 * 60 * 60 * 1000);
});

test("chart route accepts higher-timeframe Lightweight Chart intervals", async () => {
  const requestedIntervals: string[] = [];

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      req?: { interval?: string };
      type?: string;
    };

    if (body.type === "meta") {
      return Response.json({
        universe: [{ maxLeverage: 40, name: "BTC", szDecimals: 5 }],
      });
    }

    requestedIntervals.push(body.req?.interval ?? "");

    return Response.json([
      {
        t: 1_700_000_000_000,
        o: "1",
        h: "2",
        l: "0.5",
        c: "1.5",
        v: "200.25",
      },
    ]);
  };

  const hourlyResponse = await GET(
    new Request("http://localhost/api/chart?symbol=BTC-USD&interval=1h&from=1700000000000&to=1700003600000"),
  );
  const dailyResponse = await GET(
    new Request("http://localhost/api/chart?symbol=BTC-USD&interval=1d&from=1700000000000&to=1700086400000"),
  );

  assert.equal(hourlyResponse.status, 200);
  assert.equal(hourlyResponse.headers.get("X-Portal-Chart-Interval"), "1h");
  assert.equal(dailyResponse.status, 200);
  assert.equal(dailyResponse.headers.get("X-Portal-Chart-Interval"), "1d");
  assert.deepEqual(requestedIntervals, ["1h", "1d"]);
});

test("chart route resolves dynamic Hyperliquid symbols through metadata", async () => {
  let requestedCoin: string | null = null;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      req?: { coin?: string };
      type?: string;
    };

    if (body.type === "meta") {
      return Response.json({
        universe: [{ maxLeverage: 3, name: "HYPE", szDecimals: 2 }],
      });
    }

    requestedCoin = body.req?.coin ?? null;

    return Response.json([
      {
        t: 1_700_000_000_000,
        o: "1",
        h: "2",
        l: "0.5",
        c: "1.5",
        v: "200.25",
      },
    ]);
  };

  const response = await GET(
    new Request("http://localhost/api/chart?symbol=HYPE-USD&interval=15m&from=1700000000000&to=1700000900000"),
  );

  assert.equal(response.status, 200);
  assert.equal(requestedCoin, "HYPE");

  const payload = (await response.json()) as Array<{ volume: number | null }>;
  assert.equal(payload[0]?.volume, 200.25);
});

test("chart route keeps SOL on the Hyperliquid candle provider", async () => {
  let requestedCoin: string | null = null;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      req?: { coin?: string };
      type?: string;
    };

    if (body.type === "meta") {
      return Response.json({
        universe: [{ maxLeverage: 20, name: "SOL", szDecimals: 2 }],
      });
    }

    requestedCoin = body.req?.coin ?? null;

    return Response.json([
      {
        t: 1_700_000_000_000,
        o: "100",
        h: "102",
        l: "99",
        c: "101",
        v: "42",
      },
    ]);
  };

  const response = await GET(
    new Request("http://localhost/api/chart?symbol=SOL-USD&interval=15m&from=1700000000000&to=1700000900000"),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Portal-Chart-Source"), "hyperliquid-testnet");
  assert.equal(requestedCoin, "SOL");
});

test("chart route sends TOTAL to the index provider boundary, not Hyperliquid", async () => {
  let fetchCalled = false;

  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("TOTAL should not call an upstream fetch when the index provider is missing.");
  };

  const response = await GET(
    new Request("http://localhost/api/chart?symbol=TOTAL&interval=15m&from=1700000000000&to=1700000900000"),
  );
  const payload = (await response.json()) as { code?: string; error?: string };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Portal-Chart-Source"), "tradingview-compatible-index");
  assert.equal(response.headers.get("X-Portal-Chart-State"), "provider-missing");
  assert.equal(payload.code, "INDEX_PROVIDER_MISSING");
  assert.equal(payload.error, "Index data source not connected yet.");
  assert.equal(fetchCalled, false);
});

test("chart route returns unsupported-timeframe state for CoinGecko index intervals it cannot serve", async () => {
  delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
  process.env.COINGECKO_API_KEY = "test-key";
  process.env.COINGECKO_API_BASE_URL = "https://coingecko.test/api/v3";
  process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS = "0";
  let fetchCalled = false;

  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({});
  };

  const response = await GET(
    new Request("http://localhost/api/chart?symbol=TOTAL&interval=15m&from=1700000000000&to=1700000900000"),
  );
  const payload = (await response.json()) as { code?: string; state?: string };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Portal-Chart-Source"), "tradingview-compatible-index");
  assert.equal(response.headers.get("X-Portal-Chart-State"), "unsupported-timeframe");
  assert.equal(payload.code, "INDEX_UNSUPPORTED_TIMEFRAME");
  assert.equal(payload.state, "unsupported-timeframe");
  assert.equal(fetchCalled, false);
});

test("chart route returns provider-limited state for CoinGecko plan-limited index access", async () => {
  delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
  process.env.COINGECKO_API_KEY = "test-key";
  process.env.COINGECKO_API_BASE_URL = "https://coingecko.test/api/v3";
  process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS = "0";

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

  const response = await GET(
    new Request("http://localhost/api/chart?symbol=TOTAL&interval=1h&from=1700000000000&to=1700003600000"),
  );
  const payload = (await response.json()) as { code?: string; state?: string };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Portal-Chart-Source"), "tradingview-compatible-index");
  assert.equal(response.headers.get("X-Portal-Chart-State"), "provider-limited");
  assert.equal(payload.code, "INDEX_PROVIDER_LIMITED");
  assert.equal(payload.state, "provider-limited");
});

test("chart route returns CoinGecko TOTAL candles when the index provider is configured", async () => {
  delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
  process.env.COINGECKO_API_KEY = "test-key";
  process.env.COINGECKO_API_BASE_URL = "https://coingecko.test/api/v3";
  process.env.PORTAL_COINGECKO_MIN_REQUEST_INTERVAL_MS = "0";

  globalThis.fetch = async () =>
    Response.json({
      market_cap_chart: {
        market_cap: [[1_700_000_000_000, 2_400_000_000_000]],
      },
    });

  const response = await GET(
    new Request("http://localhost/api/chart?symbol=TOTAL&interval=1h&from=1700000000000&to=1700003600000"),
  );
  const payload = (await response.json()) as Array<{ close?: number }>;

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Portal-Chart-Source"), "tradingview-compatible-index");
  assert.equal(response.headers.get("X-Portal-Chart-State"), "loaded");
  assert.equal(response.headers.get("X-Portal-Chart-Index-Provider"), "coingecko");
  assert.equal(payload[0]?.close, 2_400_000_000_000);
});

test("chart route returns index candles when a provider is configured", async () => {
  const originalProviderUrl = process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
  let requestedUrl = "";

  process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL = "https://index-provider.test/candles";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);

    return Response.json({
      candles: [
        {
          close: 55.12,
          high: 55.4,
          low: 54.8,
          open: 55.3,
          time: 1_700_000_900,
          volume: null,
        },
      ],
    });
  };

  try {
    const response = await GET(
      new Request("http://localhost/api/chart?symbol=BTC.D&interval=15m&from=1700000000000&to=1700000900000"),
    );
    const payload = (await response.json()) as Array<{
      close: number;
      high: number;
      low: number;
      open: number;
    }>;

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Portal-Chart-Source"), "tradingview-compatible-index");
    assert.match(requestedUrl, /symbol=CRYPTOCAP%3ABTC\.D/);
    assert.deepEqual(
      {
        close: payload[0]?.close,
        high: payload[0]?.high,
        low: payload[0]?.low,
        open: payload[0]?.open,
      },
      {
        close: 55.12,
        high: 55.4,
        low: 54.8,
        open: 55.3,
      },
    );
  } finally {
    if (originalProviderUrl === undefined) {
      delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
    } else {
      process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL = originalProviderUrl;
    }
  }
});

test("chart route marks index provider no-data responses without falling through to Hyperliquid", async () => {
  const originalProviderUrl = process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;

  process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL = "https://index-provider.test/candles";
  globalThis.fetch = async () => Response.json({ candles: [] });

  try {
    const response = await GET(
      new Request("http://localhost/api/chart?symbol=TOTAL&interval=15m&from=1700000000000&to=1700000900000&fresh=1"),
    );
    const payload = (await response.json()) as unknown[];

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Portal-Chart-Source"), "tradingview-compatible-index");
    assert.equal(response.headers.get("X-Portal-Chart-State"), "no-data");
    assert.deepEqual(payload, []);
  } finally {
    if (originalProviderUrl === undefined) {
      delete process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL;
    } else {
      process.env.PORTAL_INDEX_CANDLE_PROVIDER_URL = originalProviderUrl;
    }
  }
});
