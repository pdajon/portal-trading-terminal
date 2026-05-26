import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

function jsonRequest(payload: Record<string, unknown>) {
  return new Request("http://localhost/api/limit-order", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

test("/api/limit-order resolves ETH through the shared Hyperliquid market path", async () => {
  const secret = process.env.HYPERLIQUID_TESTNET_SECRET_KEY;
  delete process.env.HYPERLIQUID_TESTNET_SECRET_KEY;

  try {
    const response = await POST(jsonRequest({
      placementId: "limit-eth-resolution",
      price: 3_000,
      side: "long",
      size: 0.01,
      symbol: "ETH-USD",
    }));
    const payload = await response.json() as { error?: string };

    assert.notEqual(response.status, 400);
    assert.notEqual(payload.error, "Invalid execution symbol.");
  } finally {
    if (secret === undefined) {
      delete process.env.HYPERLIQUID_TESTNET_SECRET_KEY;
    } else {
      process.env.HYPERLIQUID_TESTNET_SECRET_KEY = secret;
    }
  }
});

test("/api/limit-order rejects unsupported markets before bridge execution", async () => {
  const response = await POST(jsonRequest({
    placementId: "limit-invalid-resolution",
    price: 1,
    side: "long",
    size: 1,
    symbol: "NOTREAL-USD",
  }));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid execution symbol.");
});

test("/api/limit-order rejects chart-only index symbols before bridge execution", async () => {
  const response = await POST(jsonRequest({
    placementId: "limit-chart-only-index",
    price: 55,
    side: "long",
    size: 1,
    symbol: "BTC.D",
  }));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Chart-only index. Use this as a Magic Trade trigger source.");
});
