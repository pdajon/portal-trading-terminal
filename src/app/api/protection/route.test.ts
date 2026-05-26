import assert from "node:assert/strict";
import test from "node:test";

import { DELETE, POST } from "./route";

const activeIndexPosition = {
  createdAt: "2026-05-20T12:00:00.000Z",
  direction: "long",
  entry: 55,
  id: "index-position",
  size: 1,
  symbol: "BTC.D",
};

function jsonRequest(payload: Record<string, unknown>, method: "DELETE" | "POST" = "POST") {
  return new Request("http://localhost/api/protection", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method,
  });
}

test("/api/protection rejects chart-only index symbols before attach bridge execution", async () => {
  const response = await POST(jsonRequest({
    activePosition: activeIndexPosition,
    protectionId: "protect-chart-only-index",
    stop: 54,
    target: 60,
  }));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Chart-only index. Use this as a Magic Trade trigger source.");
});

test("/api/protection rejects chart-only index symbols before cancel bridge execution", async () => {
  const response = await DELETE(jsonRequest({
    activePosition: activeIndexPosition,
    cancelId: "cancel-chart-only-index",
  }, "DELETE"));
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Chart-only index. Use this as a Magic Trade trigger source.");
});
