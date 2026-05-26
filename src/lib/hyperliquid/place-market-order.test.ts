import assert from "node:assert/strict";
import test from "node:test";

import { placeHyperliquidMarketOrder } from "./place-market-order";
import type { ExecutionSummary } from "@/types/trade";

function createExecutionSummary(overrides: Partial<ExecutionSummary> = {}): ExecutionSummary {
  return {
    actualFilledSize: 0.001,
    direction: "long",
    entryOrder: {
      executionId: "exec-1",
      id: 123,
      status: "filled",
    },
    executionId: "exec-1",
    fillPrice: 76_500,
    finalPositionState: {},
    finalResult: "success",
    intendedSize: 0.001,
    normalizedSize: 0.001,
    symbol: "BTC-USD",
    timestamp: 1_776_000_000_000,
    ...overrides,
  };
}

test("placeHyperliquidMarketOrder posts an explicit market order payload", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ body: unknown; url: string }> = [];
  const summary = createExecutionSummary();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      url: String(input),
    });

    return Response.json({ success: true, summary });
  }) as typeof fetch;

  try {
    const result = await placeHyperliquidMarketOrder({
      baseSize: 0.001,
      executionId: "exec-1",
      side: "long",
      symbol: "BTC-USD",
    });

    assert.deepEqual(calls, [
      {
        body: {
          baseSize: 0.001,
          executionId: "exec-1",
          side: "long",
          symbol: "BTC-USD",
        },
        url: "/api/execute",
      },
    ]);
    assert.deepEqual(result, { ok: true, summary });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("placeHyperliquidMarketOrder includes leverage and margin mode when provided", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ body: unknown; url: string }> = [];
  const summary = createExecutionSummary();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      url: String(input),
    });

    return Response.json({ success: true, summary });
  }) as typeof fetch;

  try {
    const result = await placeHyperliquidMarketOrder({
      baseSize: 0.001,
      executionId: "exec-1",
      leverage: 5,
      marginMode: "isolated",
      side: "long",
      symbol: "BTC-USD",
    });

    assert.deepEqual(calls, [
      {
        body: {
          baseSize: 0.001,
          executionId: "exec-1",
          leverage: 5,
          marginMode: "isolated",
          side: "long",
          symbol: "BTC-USD",
        },
        url: "/api/execute",
      },
    ]);
    assert.deepEqual(result, { ok: true, summary });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("placeHyperliquidMarketOrder includes configured max slippage when provided", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ body: unknown; url: string }> = [];
  const summary = createExecutionSummary();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      url: String(input),
    });

    return Response.json({ success: true, summary });
  }) as typeof fetch;

  try {
    const result = await placeHyperliquidMarketOrder({
      baseSize: 0.001,
      executionId: "exec-1",
      maxSlippagePercent: 2.5,
      side: "long",
      symbol: "BTC-USD",
    });

    assert.deepEqual(calls, [
      {
        body: {
          baseSize: 0.001,
          executionId: "exec-1",
          maxSlippagePercent: 2.5,
          side: "long",
          symbol: "BTC-USD",
        },
        url: "/api/execute",
      },
    ]);
    assert.deepEqual(result, { ok: true, summary });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("placeHyperliquidMarketOrder posts explicit sizing metadata when provided", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ body: unknown; url: string }> = [];
  const summary = createExecutionSummary();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      url: String(input),
    });

    return Response.json({ success: true, summary });
  }) as typeof fetch;

  try {
    const result = await placeHyperliquidMarketOrder({
      allocationPercent: 1,
      baseSize: 0.00025,
      conversionPrice: 80_000,
      executionId: "exec-1",
      intendedNotionalUsdc: 20,
      side: "long",
      symbol: "BTC-USD",
    });

    assert.deepEqual(calls, [
      {
        body: {
          allocationPercent: 1,
          baseSize: 0.00025,
          conversionPrice: 80_000,
          executionId: "exec-1",
          intendedNotionalUsdc: 20,
          side: "long",
          symbol: "BTC-USD",
        },
        url: "/api/execute",
      },
    ]);
    assert.deepEqual(result, { ok: true, summary });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("placeHyperliquidMarketOrder returns a structured error for rejected orders", async () => {
  const originalFetch = globalThis.fetch;
  const summary = createExecutionSummary({ finalResult: "entry failed" });

  globalThis.fetch = (async () =>
    Response.json(
      { error: "Invalid execution symbol.", summary },
      { status: 400 },
    )) as typeof fetch;

  try {
    const result = await placeHyperliquidMarketOrder({
      baseSize: 0.001,
      executionId: "exec-1",
      side: "long",
      symbol: "BTC-USD",
    });

    assert.deepEqual(result, {
      error: "Invalid execution symbol.",
      ok: false,
      status: 400,
      summary,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("placeHyperliquidMarketOrder returns a structured error when the bridge cannot be reached", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  try {
    const result = await placeHyperliquidMarketOrder({
      baseSize: 0.001,
      executionId: "exec-1",
      side: "short",
      symbol: "BTC-USD",
    });

    assert.deepEqual(result, {
      error: "Execution failed — unable to reach Hyperliquid testnet bridge",
      ok: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
