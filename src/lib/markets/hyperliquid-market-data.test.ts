import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchHyperliquidMarketMetadata,
  resetHyperliquidMarketMetadataCacheForTests,
  resolveHyperliquidMarketFromMetadata,
} from "./hyperliquid-market-data";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetHyperliquidMarketMetadataCacheForTests();
});

test("fetchHyperliquidMarketMetadata returns normalized dynamic markets", async () => {
  globalThis.fetch = async () =>
    Response.json({
      universe: [
        { maxLeverage: 40, name: "BTC", szDecimals: 5 },
        { maxLeverage: 3, name: "HYPE", szDecimals: 2 },
      ],
    });

  const result = await fetchHyperliquidMarketMetadata({ fresh: true });
  const hype = result.markets.find((market) => market.symbol === "HYPE-USD");

  assert.equal(result.degraded, false);
  assert.equal(result.source, "hyperliquid-testnet-meta");
  assert.equal(hype?.coin, "HYPE");
  assert.equal(hype?.assetId, 1);
  assert.equal(hype?.maxLeverage, 3);
  assert.equal(hype?.quantityPrecision, 2);
});

test("fetchHyperliquidMarketMetadata falls back to pinned markets on metadata failure", async () => {
  globalThis.fetch = async () =>
    Response.json({ error: "upstream unavailable" }, { status: 502 });

  const result = await fetchHyperliquidMarketMetadata({ fresh: true });

  assert.equal(result.degraded, true);
  assert.equal(result.source, "portal-static-fallback");
  assert.deepEqual(
    result.markets.map((market) => market.symbol),
    ["BTC-USD", "ETH-USD", "SOL-USD"],
  );
});

test("resolveHyperliquidMarketFromMetadata rejects invalid dynamic markets without BTC fallback", async () => {
  globalThis.fetch = async () =>
    Response.json({
      universe: [{ maxLeverage: 3, name: "HYPE", szDecimals: 2 }],
    });

  assert.equal((await resolveHyperliquidMarketFromMetadata("HYPE-USD"))?.coin, "HYPE");
  assert.equal(await resolveHyperliquidMarketFromMetadata("NOTREAL-USD"), null);
});
