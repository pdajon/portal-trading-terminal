import assert from "node:assert/strict";
import test from "node:test";

import { getMagicTradeTargetPriceUnavailableReason, resolveMagicTradeTargetPrice } from "./magic-trade-target-price";

test("resolveMagicTradeTargetPrice uses a fresh cached target price", async () => {
  const result = await resolveMagicTradeTargetPrice({
    cachedPrice: 78_000,
    cachedPriceUpdatedAt: 1_000,
    fetchLatestClose: async () => {
      throw new Error("fallback should not run");
    },
    maxCachedAgeMs: 15_000,
    now: 5_000,
    subscribeToLivePrice: async () => {
      throw new Error("subscription should not run");
    },
    symbol: "BTC-USD",
  });

  assert.deepEqual(result, {
    ok: true,
    price: 78_000,
    source: "cached",
  });
});

test("resolveMagicTradeTargetPrice subscribes when target price is not warmed", async () => {
  const result = await resolveMagicTradeTargetPrice({
    cachedPrice: null,
    cachedPriceUpdatedAt: null,
    fetchLatestClose: async () => {
      throw new Error("fallback should not run");
    },
    maxCachedAgeMs: 15_000,
    now: 5_000,
    subscribeToLivePrice: async () => 78_125,
    symbol: "BTC-USD",
  });

  assert.deepEqual(result, {
    ok: true,
    price: 78_125,
    source: "subscription",
  });
});

test("resolveMagicTradeTargetPrice falls back to latest candle close", async () => {
  const result = await resolveMagicTradeTargetPrice({
    cachedPrice: null,
    cachedPriceUpdatedAt: null,
    fetchLatestClose: async () => 78_250,
    maxCachedAgeMs: 15_000,
    now: 5_000,
    subscribeToLivePrice: async () => null,
    symbol: "BTC-USD",
  });

  assert.deepEqual(result, {
    ok: true,
    price: 78_250,
    source: "latest-close",
  });
});

test("resolveMagicTradeTargetPrice returns a clear target price failure", async () => {
  const result = await resolveMagicTradeTargetPrice({
    cachedPrice: null,
    cachedPriceUpdatedAt: null,
    fetchLatestClose: async () => null,
    maxCachedAgeMs: 15_000,
    now: 5_000,
    subscribeToLivePrice: async () => null,
    symbol: "BTC-USD",
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "Target BTC price unavailable",
  });
});

test("getMagicTradeTargetPriceUnavailableReason names each supported target asset", () => {
  assert.equal(getMagicTradeTargetPriceUnavailableReason("BTC-USD"), "Target BTC price unavailable");
  assert.equal(getMagicTradeTargetPriceUnavailableReason("ETH-USD"), "Target ETH price unavailable");
  assert.equal(getMagicTradeTargetPriceUnavailableReason("SOL-USD"), "Target SOL price unavailable");
});
