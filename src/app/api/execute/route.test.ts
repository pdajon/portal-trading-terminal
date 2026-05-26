import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route";

function jsonRequest(payload: Record<string, unknown>) {
  return new Request("http://localhost/api/execute", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

test("/api/execute rejects ambiguous legacy size payloads", async () => {
  const response = await POST(jsonRequest({
    executionId: "exec-ambiguous-size",
    side: "long",
    size: 20,
    symbol: "BTC-USD",
  }));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Ambiguous execution size. Send baseSize or notionalUsdc with conversionPrice.");
});

test("/api/execute rejects invalid margin mode", async () => {
  const response = await POST(jsonRequest({
    baseSize: 0.001,
    executionId: "exec-invalid-margin-mode",
    marginMode: "portfolio",
    side: "long",
    symbol: "BTC-USD",
  }));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid execution margin mode.");
});

test("/api/execute rejects max slippage outside Portal bounds", async () => {
  const response = await POST(jsonRequest({
    baseSize: 0.001,
    executionId: "exec-invalid-slippage",
    maxSlippagePercent: 11,
    side: "long",
    symbol: "BTC-USD",
  }));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid max slippage. Use 0.01% to 10.00%.");
});

test("/api/execute rejects chart-only index symbols before sizing or bridge execution", async () => {
  const response = await POST(jsonRequest({
    baseSize: 1,
    executionId: "exec-chart-only-index",
    side: "long",
    symbol: "TOTAL",
  }));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Chart-only index. Use this as a Magic Trade trigger source.");
});

test("/api/execute rejects chart-only index symbols before generic payload validation", async () => {
  const response = await POST(jsonRequest({
    baseSize: 1,
    side: "long",
    symbol: "TOTAL",
  }));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Chart-only index. Use this as a Magic Trade trigger source.");
});
