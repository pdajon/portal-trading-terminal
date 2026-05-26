import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBridgeRouteTimingHeaders,
  parseBridgeStdoutJson,
  isBridgeTimeoutError,
} from "./bridge-route-timing";

test("buildBridgeRouteTimingHeaders includes route and bridge duration for bridge attempts", () => {
  assert.deepEqual(
    buildBridgeRouteTimingHeaders({
      bridgeDurationMs: 25,
      extraHeaders: {
        "X-Portal-Live-Positions-Cache": "miss",
      },
      routeDurationMs: 30,
    }),
    {
      "X-Portal-Bridge-Duration-Ms": "25",
      "X-Portal-Live-Positions-Cache": "miss",
      "X-Portal-Route-Duration-Ms": "30",
    },
  );
});

test("buildBridgeRouteTimingHeaders reports zero bridge duration for cache hits", () => {
  assert.deepEqual(
    buildBridgeRouteTimingHeaders({
      bridgeDurationMs: 0,
      extraHeaders: {
        "X-Portal-Pending-Orders-Cache": "hit",
      },
      routeDurationMs: 3,
    }),
    {
      "X-Portal-Bridge-Duration-Ms": "0",
      "X-Portal-Pending-Orders-Cache": "hit",
      "X-Portal-Route-Duration-Ms": "3",
    },
  );
});

test("buildBridgeRouteTimingHeaders marks bridge timeout responses", () => {
  assert.deepEqual(
    buildBridgeRouteTimingHeaders({
      bridgeDurationMs: 8_000,
      routeDurationMs: 8_012,
      timedOut: true,
    }),
    {
      "X-Portal-Bridge-Duration-Ms": "8000",
      "X-Portal-Bridge-Timed-Out": "1",
      "X-Portal-Route-Duration-Ms": "8012",
    },
  );
});

test("isBridgeTimeoutError detects execFile timeout errors", () => {
  assert.equal(
    isBridgeTimeoutError({
      killed: true,
      signal: "SIGTERM",
    }),
    true,
  );
  assert.equal(isBridgeTimeoutError(new Error("connection reset")), false);
});

test("parseBridgeStdoutJson recovers valid JSON from a timeout error stdout", () => {
  assert.deepEqual(
    parseBridgeStdoutJson({
      killed: true,
      signal: "SIGTERM",
      stdout: '{"success":true,"accountValue":921.75}\n',
    }),
    {
      accountValue: 921.75,
      success: true,
    },
  );
});

test("parseBridgeStdoutJson ignores empty or malformed stdout", () => {
  assert.equal(parseBridgeStdoutJson({ stdout: "" }), null);
  assert.equal(parseBridgeStdoutJson({ stdout: "not-json" }), null);
  assert.equal(parseBridgeStdoutJson(new Error("missing stdout")), null);
});
