import assert from "node:assert/strict";
import test from "node:test";

import { getPendingOrderMarketExecutionBlockReason } from "./pending-order-market-gate";

test("allows market execution while resting orders exist", () => {
  assert.equal(
    getPendingOrderMarketExecutionBlockReason({
      ignorePendingOrders: false,
      pendingOrderCount: 4,
    }),
    null,
  );
});

test("allows explicit pending-order bypass callers", () => {
  assert.equal(
    getPendingOrderMarketExecutionBlockReason({
      ignorePendingOrders: true,
      pendingOrderCount: 4,
    }),
    null,
  );
});
