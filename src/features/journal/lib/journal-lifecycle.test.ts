import test from "node:test";
import assert from "node:assert/strict";
import {
  attachJournalMemoryEventToTrade,
  createJournalEntryForOpenedTrade,
  resolveActiveJournalEntryForSymbol,
  resolveJournalEntryByExecutionOrOrderId,
  updateJournalEntryForClosedTrade,
  updateJournalEntryForOrderFilledTrade,
  updateJournalEntryForReducedTrade,
  updateJournalEntryForReversedTrade,
  type NativeJournalLifecycleEntry,
} from "./journal-lifecycle";

function createEntry(overrides: Partial<NativeJournalLifecycleEntry> = {}): NativeJournalLifecycleEntry {
  return {
    direction: "long",
    entryPrice: 65000,
    exitPrice: null,
    id: "journal-1",
    realizedPnl: null,
    relatedSessionLogIds: [],
    size: 0.01,
    status: "open",
    symbol: "BTC-USD",
    timestamp: "2026-05-03T20:00:00.000Z",
    updatedAt: "2026-05-03T20:00:00.000Z",
    ...overrides,
  };
}

test("market entry creates Journal entry with opened timestamp, identifiers, and lifecycle event", () => {
  const entry = createJournalEntryForOpenedTrade({
    baseEntry: createEntry({ status: "closed" }),
    executionId: "exec-1",
    orderId: 1001,
    relatedSessionLogIds: ["session-open"],
    timestamp: "2026-05-03T20:01:00.000Z",
  });

  assert.equal(entry.status, "open");
  assert.equal(entry.openedAt, "2026-05-03T20:01:00.000Z");
  assert.equal(entry.executionId, "exec-1");
  assert.equal(entry.orderId, 1001);
  assert.deepEqual(entry.relatedExecutionIds, ["exec-1"]);
  assert.deepEqual(entry.relatedOrderIds, [1001]);
  assert.equal(entry.tradeLifecycleEvents?.[0]?.type, "opened");
});

test("market close stores closedAt, exit details, and fee-aware realized PnL", () => {
  const closed = updateJournalEntryForClosedTrade(createEntry(), {
    exitPrice: 65100,
    fees: { currency: "USDC", total: 1.25 },
    grossPnl: 10,
    relatedSessionLogIds: ["session-close"],
    timestamp: "2026-05-03T20:05:00.000Z",
  });

  assert.equal(closed.status, "closed");
  assert.equal(closed.closedAt, "2026-05-03T20:05:00.000Z");
  assert.equal(closed.exitPrice, 65100);
  assert.equal(closed.realizedPnl, 8.75);
  assert.equal(closed.fees?.total, 1.25);
  assert.equal(closed.tradeLifecycleEvents?.at(-1)?.netPnl, 8.75);
});

test("partial reduce preserves original trade, remaining size, and lifecycle event", () => {
  const reduced = updateJournalEntryForReducedTrade(createEntry(), {
    realizedPnl: 4,
    reducedSize: 0.004,
    relatedSessionLogIds: ["session-reduce"],
    remainingSize: 0.006,
    timestamp: "2026-05-03T20:03:00.000Z",
  });

  assert.equal(reduced.status, "open");
  assert.equal(reduced.size, 0.006);
  assert.equal(reduced.realizedPnl, 4);
  assert.equal(reduced.closedAt, undefined);
  assert.equal(reduced.tradeLifecycleEvents?.at(-1)?.type, "reduced");
  assert.equal(reduced.tradeLifecycleEvents?.at(-1)?.reducedSize, 0.004);
  assert.equal(reduced.tradeLifecycleEvents?.at(-1)?.remainingSize, 0.006);
});

test("partial reduce leaves fees empty when unavailable and uses gross PnL as realized fallback", () => {
  const reduced = updateJournalEntryForReducedTrade(createEntry(), {
    grossPnl: 6,
    reducedSize: 0.002,
    remainingSize: 0.008,
    timestamp: "2026-05-03T20:03:00.000Z",
  });

  assert.equal(reduced.fees, undefined);
  assert.equal(reduced.realizedPnl, 6);
  assert.equal(reduced.tradeLifecycleEvents?.at(-1)?.fees, null);
});

test("reverse closes old side and returns confirmed new opposite entry when data allows", () => {
  const newEntry = createJournalEntryForOpenedTrade({
    baseEntry: createEntry({ direction: "short", id: "journal-2", realizedPnl: null, size: 0.01 }),
    executionId: "reverse-open-1",
    timestamp: "2026-05-03T20:06:00.000Z",
  });
  const reversed = updateJournalEntryForReversedTrade(createEntry(), {
    exitPrice: 65050,
    newEntry,
    realizedPnl: 5,
    timestamp: "2026-05-03T20:06:00.000Z",
  });

  assert.equal(reversed.closedEntry.status, "closed");
  assert.equal(reversed.closedEntry.tradeLifecycleEvents?.at(-1)?.type, "reversed");
  assert.equal(reversed.openedEntry?.direction, "short");
  assert.equal(reversed.openedEntry?.executionId, "reverse-open-1");
});

test("pending limit and order-zone multi-fill identifiers resolve to the same active Journal entry", () => {
  const opened = createJournalEntryForOpenedTrade({
    baseEntry: createEntry(),
    executionId: "placement-1",
    orderId: 1001,
    orderZoneId: "zone-1",
    relatedSessionLogIds: ["session-fill-1"],
    timestamp: "2026-05-03T20:01:00.000Z",
  });
  const withSecondFill = updateJournalEntryForOrderFilledTrade(opened, {
    childOrderId: 1002,
    executionId: "placement-2",
    fillSize: 0.003,
    orderId: 1002,
    orderZoneId: "zone-1",
    relatedSessionLogIds: ["session-fill-2"],
    timestamp: "2026-05-03T20:02:00.000Z",
  });

  assert.equal(resolveJournalEntryByExecutionOrOrderId([withSecondFill], { executionId: "placement-1" })?.id, "journal-1");
  assert.equal(resolveJournalEntryByExecutionOrOrderId([withSecondFill], { orderId: 1002 })?.id, "journal-1");
  assert.deepEqual(withSecondFill.relatedOrderIds, [1001, 1002]);
  assert.equal(withSecondFill.size, 0.013000000000000001);
  assert.equal(withSecondFill.tradeLifecycleEvents?.at(-1)?.childOrderId, 1002);
  assert.equal(withSecondFill.tradeLifecycleEvents?.at(-1)?.type, "order_filled");
});

test("Magic Trade risk-reducing and trigger events attach to active Journal entry without creating fake trades", () => {
  const entry = createEntry();
  const magicEvent = attachJournalMemoryEventToTrade(
    {
      id: "journal-memory:magic_trade_executed:session-1",
      magicTradeRuleId: "rule-1",
      metadata: { actionType: "reduce-position-percent" },
      source: "magic_trade",
      timestamp: "2026-05-03T20:03:00.000Z",
      type: "magic_trade_executed",
    },
    resolveActiveJournalEntryForSymbol([entry], "BTC-USD", "long"),
  );
  const triggerEvent = attachJournalMemoryEventToTrade(
    {
      id: "journal-memory:trigger_fired:session-2",
      metadata: { actionType: "enter-market" },
      source: "trigger",
      timestamp: "2026-05-03T20:04:00.000Z",
      triggerId: "trigger-1",
      type: "trigger_fired",
    },
    entry,
  );

  assert.equal(magicEvent.journalEntryId, "journal-1");
  assert.equal(magicEvent.tradeId, "journal-1");
  assert.equal(triggerEvent.journalEntryId, "journal-1");
  assert.equal(triggerEvent.triggerId, "trigger-1");
});

test("existing Journal entries hydrate through lifecycle helpers without optional fields", () => {
  const hydrated = createEntry({ relatedExecutionIds: undefined, tradeLifecycleEvents: undefined });
  const closed = updateJournalEntryForClosedTrade(hydrated, {
    realizedPnl: 2,
    timestamp: "2026-05-03T20:05:00.000Z",
  });

  assert.equal(closed.status, "closed");
  assert.deepEqual(closed.relatedExecutionIds, []);
  assert.equal(closed.tradeLifecycleEvents?.at(-1)?.type, "closed");
});
