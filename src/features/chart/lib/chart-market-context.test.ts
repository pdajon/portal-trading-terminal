import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketContextReadouts,
  normalizeFundingRateHistory,
  normalizeOpenInterestSnapshot,
} from "./chart-market-context";

test("normalizes Hyperliquid funding history into ascending percent points", () => {
  assert.deepEqual(
    normalizeFundingRateHistory([
      { coin: "BTC", fundingRate: "0.0000125", time: 1715907600000 },
      { coin: "ETH", fundingRate: "0.5", time: 1715907600000 },
      { coin: "BTC", fundingRate: "-0.00002", time: 1715904000000 },
      { coin: "BTC", fundingRate: "not-a-number", time: 1715900400000 },
    ], "BTC"),
    [
      { time: 1715904000, value: -0.002 },
      { time: 1715907600, value: 0.00125 },
    ],
  );
});

test("normalizes current open interest without inventing history", () => {
  assert.deepEqual(
    normalizeOpenInterestSnapshot({
      markPrice: "70000",
      openInterestBase: "120.5",
      openInterestUsd: null,
      time: 1715907600000,
    }),
    {
      time: 1715907600,
      valueBase: 120.5,
      valueUsd: 8_435_000,
    },
  );

  assert.equal(
    normalizeOpenInterestSnapshot({
      markPrice: null,
      openInterestBase: null,
      openInterestUsd: null,
      time: 1715907600000,
    }),
    null,
  );
});

test("builds compact market context readouts for active layers", () => {
  const readouts = buildMarketContextReadouts({
    coin: "BTC",
    context: {
      coin: "BTC",
      fetchedAt: 1715907600000,
      fundingRates: [
        { time: 1715904000, value: -0.002 },
        { time: 1715907600, value: 0.00125 },
      ],
      fundingWindowHours: 168,
      openInterest: {
        time: 1715907600,
        valueBase: 120.5,
        valueUsd: 8_435_000,
      },
      source: "hyperliquid-testnet-market-context",
      symbol: "BTC-USD",
    },
    fundingEnabled: true,
    openInterestEnabled: true,
    openInterestPoints: [],
    status: "ready",
  });

  assert.deepEqual(readouts, [
    {
      detail: "7D funding",
      key: "funding",
      label: "Funding",
      tone: "positive",
      value: "+0.0013%",
    },
    {
      detail: "120.50 BTC OI",
      key: "openInterest",
      label: "Open Int",
      tone: "neutral",
      value: "$8.44M",
    },
  ]);
});

test("builds quiet loading, empty, and offline market context readouts", () => {
  assert.deepEqual(
    buildMarketContextReadouts({
      coin: "BTC",
      context: null,
      fundingEnabled: true,
      openInterestEnabled: true,
      openInterestPoints: [],
      status: "loading",
    }).map((readout) => [readout.key, readout.value, readout.detail, readout.tone]),
    [
      ["funding", "Loading", "Context route", "muted"],
      ["openInterest", "Loading", "Context route", "muted"],
    ],
  );

  assert.deepEqual(
    buildMarketContextReadouts({
      coin: "BTC",
      context: null,
      fundingEnabled: true,
      openInterestEnabled: false,
      openInterestPoints: [],
      status: "error",
    }),
    [
      {
        detail: "Retry from Layers",
        key: "funding",
        label: "Funding",
        tone: "warning",
        value: "Offline",
      },
    ],
  );

  assert.deepEqual(
    buildMarketContextReadouts({
      coin: "BTC",
      context: {
        coin: "BTC",
        fetchedAt: 1715907600000,
        fundingRates: [],
        fundingWindowHours: 168,
        openInterest: null,
        source: "hyperliquid-testnet-market-context",
        symbol: "BTC-USD",
      },
      fundingEnabled: true,
      openInterestEnabled: true,
      openInterestPoints: [],
      status: "ready",
    }).map((readout) => [readout.key, readout.value, readout.detail, readout.tone]),
    [
      ["funding", "No data", "7D funding", "muted"],
      ["openInterest", "No data", "Live session", "muted"],
    ],
  );
});
