import assert from "node:assert/strict";
import test from "node:test";

import {
  appendJournalReplayFrameToEntry,
  buildOpenedJournalEntryCapture,
  buildOrderFilledMemoryEventForActiveEntry,
  commitJournalEntriesRefUpdate,
  createJournalReplayFrame,
  createJournalReplayMetadata,
  getJournalEntryClassification,
  getReplayFrameEventLabel,
  resolveJournalSetupGateFooterTransition,
  resolveCloseAllJournalEntryTargets,
  resolveOpenJournalEntryForTradeFill,
  updateLatestOpenJournalEntryForSymbol,
  type JournalEntry,
} from "./journal-capture-adapter";
import { updateJournalEntryForClosedTrade } from "./journal-lifecycle";

test("getJournalEntryClassification preserves Portal journal source semantics", () => {
  assert.deepEqual(getJournalEntryClassification({ triggerSource: "market-manual" }), {
    entrySource: "Market",
    entryStyle: "Chased",
  });
  assert.deepEqual(getJournalEntryClassification({ triggerCondition: "touch" }), {
    entrySource: "Touch Trigger",
    entryStyle: "Hunted",
  });
  assert.deepEqual(getJournalEntryClassification({ triggerCondition: "close-above" }), {
    entrySource: "Close Trigger",
    entryStyle: "Hunted",
  });
  assert.deepEqual(getJournalEntryClassification({ orderSource: "mid-zone" }), {
    entrySource: "Mid-Zone",
    entryStyle: "Hunted",
  });
  assert.deepEqual(getJournalEntryClassification({ orderSource: "order-zone" }), {
    entrySource: "Order Zone",
    entryStyle: "Hunted",
  });
  assert.deepEqual(getJournalEntryClassification({ orderSource: "horizontal-line" }), {
    entrySource: "Limit",
    entryStyle: "Hunted",
  });
  assert.deepEqual(getJournalEntryClassification({}), {
    entrySource: "Other",
    entryStyle: "Chased",
  });
});

test("createJournalReplayMetadata creates the entry frame and capture contract", () => {
  const metadata = createJournalReplayMetadata(
    "2026-05-09T01:00:00.000Z",
    "journal-1",
    {
      captureIntervalTargetSeconds: 30,
      price: 100,
      randomUUID: () => "frame-id",
      size: 2,
    },
  );

  assert.equal(metadata.captureIntervalTargetSeconds, 30);
  assert.equal(metadata.finalTimelineMaxFrames, 15);
  assert.equal(metadata.replayStatus, "capturing");
  assert.equal(metadata.frames.length, 1);
  assert.deepEqual(metadata.frames[0], {
    capturedAt: "2026-05-09T01:00:00.000Z",
    event: "entry",
    id: "replay-entry-frame-id",
    journalEntryId: "journal-1",
    pnl: null,
    price: 100,
    size: 2,
    status: "planned",
    storageKey: null,
  });
});

test("buildOpenedJournalEntryCapture creates lifecycle entry, memory events, and snapshot request", () => {
  const uuids = ["entry-uuid", "frame-uuid"];
  const capture = buildOpenedJournalEntryCapture(
    {
      direction: "long",
      entryPrice: 100,
      entrySource: "Limit",
      entryStyle: "Hunted",
      executionId: "exec-1",
      metadata: { source: "pending-limit" },
      orderId: 42,
      relatedSessionLogIds: ["log-1"],
      size: 3,
      symbol: "BTC-USD",
      timestamp: "2026-05-09T02:00:00.000Z",
    },
    {
      activeChartTimeframe: "15m",
      captureIntervalTargetSeconds: 60,
      disciplineRulesSnapshot: ["Require Protection Stop loss"],
      nowMs: 1_777_777_777_000,
      randomUUID: () => uuids.shift() ?? "extra",
    },
  );

  assert.equal(capture.entry.id, "journal-1777777777000-entry-uuid");
  assert.equal(capture.entry.openedAt, "2026-05-09T02:00:00.000Z");
  assert.equal(capture.entry.tradeLifecycleEvents?.[0]?.type, "opened");
  assert.equal(capture.entry.replayMetadata.frames[0].id, "replay-entry-frame-uuid");
  assert.deepEqual(capture.snapshotRequest, {
    frameId: "replay-entry-frame-uuid",
    journalEntryId: "journal-1777777777000-entry-uuid",
    price: 100,
    size: 3,
  });
  assert.deepEqual(
    capture.memoryEvents.map((event) => [event.id, event.type, event.journalEntryId]),
    [
      [
        "journal-memory:trade_opened:log-1",
        "trade_opened",
        "journal-1777777777000-entry-uuid",
      ],
      [
        "journal-memory:order_filled:exec-1",
        "order_filled",
        "journal-1777777777000-entry-uuid",
      ],
    ],
  );
});

test("buildOrderFilledMemoryEventForActiveEntry links fills to the active journal entry", () => {
  const activeEntry = buildJournalEntry({ id: "journal-active" });

  const event = buildOrderFilledMemoryEventForActiveEntry(
    {
      clientOrderId: "client-1",
      direction: "short",
      entryPrice: 10,
      entrySource: "Order Zone",
      entryStyle: "Hunted",
      executionId: null,
      metadata: { venue: "Hyperliquid" },
      orderId: 99,
      orderZoneId: "zone-1",
      relatedSessionLogIds: ["log-fill"],
      size: 4,
      symbol: "HYPE-USD",
      timestamp: "2026-05-09T03:00:00.000Z",
    },
    activeEntry,
    { nowMs: 1_700_000_000_000 },
  );

  assert.equal(event.id, "journal-memory:order_filled:99");
  assert.equal(event.journalEntryId, "journal-active");
  assert.equal(event.sessionLogId, "log-fill");
  assert.equal(event.tradeId, "journal-active");
  assert.equal(event.metadata?.orderZoneId, "zone-1");
});

test("resolveOpenJournalEntryForTradeFill reuses one setup thesis for add-ons and zone fills", () => {
  const capturedEntry = buildJournalEntry({
    id: "captured-btc-long",
    setupCapturedAt: "2026-05-09T02:10:00.000Z",
    setupStatus: "captured",
    setupTag: "Liquidity Sweep",
    setupType: "Liquidity Sweep",
  });
  const skippedEntry = buildJournalEntry({
    direction: "short",
    id: "skipped-eth-short",
    setupStatus: "skipped",
    symbol: "ETH-USD",
  });
  const pendingEntry = buildJournalEntry({
    id: "pending-sol-long",
    setupStatus: "pending",
    symbol: "SOL-USD",
  });

  assert.equal(
    resolveOpenJournalEntryForTradeFill(
      [capturedEntry],
      { direction: "long", symbol: "BTC-USD" },
    )?.id,
    "captured-btc-long",
  );
  assert.equal(
    resolveOpenJournalEntryForTradeFill(
      [skippedEntry],
      { direction: "short", symbol: "ETH-USD" },
    )?.id,
    "skipped-eth-short",
  );
  assert.equal(
    resolveOpenJournalEntryForTradeFill(
      [pendingEntry],
      { direction: "long", symbol: "SOL-USD" },
    )?.id,
    "pending-sol-long",
  );
  assert.equal(
    resolveOpenJournalEntryForTradeFill(
      [capturedEntry],
      { direction: "short", symbol: "BTC-USD" },
    ),
    null,
  );
});

test("resolveCloseAllJournalEntryTargets includes every flattened asset and ignores already closed entries", () => {
  const entries = [
    buildJournalEntry({
      id: "btc-open",
      setupCapturedAt: "2026-05-09T02:10:00.000Z",
      setupStatus: "captured",
      setupTag: "Retest",
      setupType: "Retest",
      symbol: "BTC-USD",
    }),
    buildJournalEntry({
      id: "eth-open",
      setupStatus: "captured",
      setupTag: "Breakout",
      setupType: "Breakout",
      symbol: "ETH-USD",
    }),
    buildJournalEntry({
      id: "sol-closed",
      setupStatus: "captured",
      setupTag: "Reversal",
      setupType: "Reversal",
      status: "closed",
      symbol: "SOL-USD",
    }),
  ];

  assert.deepEqual(
    resolveCloseAllJournalEntryTargets(entries, [
      { symbol: "BTC-USD" },
      { symbol: "ETH-USD" },
      { symbol: "SOL-USD" },
      { symbol: "BTC-USD" },
    ]),
    ["BTC-USD", "ETH-USD"],
  );
});

test("commitJournalEntriesRefUpdate exposes a full close before the next fill resolves setup state", () => {
  const openEntry = buildJournalEntry({
    id: "btc-open",
    setupCapturedAt: "2026-05-09T02:10:00.000Z",
    setupStatus: "captured",
    setupTag: "Retest",
    setupType: "Retest",
  });
  const entriesRef = { current: [openEntry] };

  const nextEntries = commitJournalEntriesRefUpdate(
    entriesRef,
    entriesRef.current,
    (entries) =>
      updateLatestOpenJournalEntryForSymbol(
        entries,
        "BTC-USD",
        (entry) =>
          updateJournalEntryForClosedTrade(entry, {
            exitPrice: 101,
            timestamp: "2026-05-09T04:00:00.000Z",
          }),
        "2026-05-09T04:00:00.000Z",
      ),
  );

  assert.equal(nextEntries[0]?.status, "closed");
  assert.equal(entriesRef.current[0]?.status, "closed");
  assert.equal(
    resolveOpenJournalEntryForTradeFill(entriesRef.current, {
      direction: "long",
      symbol: "BTC-USD",
    }),
    null,
  );
});

test("resolveJournalSetupGateFooterTransition moves pending setup capture into Trade and preserves return tab", () => {
  assert.deepEqual(
    resolveJournalSetupGateFooterTransition({
      gateActive: true,
      returnTab: null,
      selectedFooterTab: "positions",
      tradeTab: "trade",
    }),
    {
      returnTab: "positions",
      selectedFooterTab: "trade",
    },
  );
  assert.deepEqual(
    resolveJournalSetupGateFooterTransition({
      gateActive: true,
      returnTab: "positions",
      selectedFooterTab: "open-orders",
      tradeTab: "trade",
    }),
    {
      returnTab: "positions",
      selectedFooterTab: "trade",
    },
  );
  assert.deepEqual(
    resolveJournalSetupGateFooterTransition({
      gateActive: false,
      returnTab: null,
      selectedFooterTab: "positions",
      tradeTab: "trade",
    }),
    {
      returnTab: null,
      selectedFooterTab: "positions",
    },
  );
});

test("updateLatestOpenJournalEntryForSymbol updates only the latest open matching symbol", () => {
  const entries = [
    buildJournalEntry({ id: "closed", status: "closed", symbol: "BTC-USD" }),
    buildJournalEntry({ id: "open-btc", symbol: "BTC-USD" }),
    buildJournalEntry({ id: "open-eth", symbol: "ETH-USD" }),
  ];

  const nextEntries = updateLatestOpenJournalEntryForSymbol(
    entries,
    "BTC-USD",
    (entry) => ({ ...entry, lessonLearned: "managed well" }),
    "2026-05-09T04:00:00.000Z",
  );

  assert.equal(nextEntries[0].lessonLearned, "");
  assert.equal(nextEntries[1].lessonLearned, "managed well");
  assert.equal(nextEntries[1].updatedAt, "2026-05-09T04:00:00.000Z");
  assert.equal(nextEntries[2].lessonLearned, "");
});

test("appendJournalReplayFrameToEntry appends a planned frame without mutating the entry", () => {
  const entry = buildJournalEntry({ id: "journal-frames" });
  const { entry: nextEntry, frame } = appendJournalReplayFrameToEntry(
    entry,
    "partial-close",
    {
      price: 111,
      randomUUID: () => "partial",
      size: 0.5,
      timestamp: "2026-05-09T05:00:00.000Z",
    },
  );

  assert.equal(entry.replayMetadata.frames.length, 1);
  assert.equal(nextEntry.replayMetadata.frames.length, 2);
  assert.equal(nextEntry.replayMetadata.rawFrameCount, 2);
  assert.equal(frame.id, "replay-partial-close-partial");
  assert.equal(getReplayFrameEventLabel(frame.event), "Partial Close");
});

test("createJournalReplayFrame preserves status and storage hints", () => {
  assert.deepEqual(
    createJournalReplayFrame({
      event: "exit",
      journalEntryId: "journal-1",
      pnl: 12,
      price: 101,
      randomUUID: () => "exit",
      size: 1,
      status: "captured",
      storageKey: "frame-1",
      timestamp: "2026-05-09T06:00:00.000Z",
    }),
    {
      capturedAt: "2026-05-09T06:00:00.000Z",
      event: "exit",
      id: "replay-exit-exit",
      journalEntryId: "journal-1",
      pnl: 12,
      price: 101,
      size: 1,
      status: "captured",
      storageKey: "frame-1",
    },
  );
});

function buildJournalEntry(
  overrides: Partial<JournalEntry> = {},
): JournalEntry {
  const timestamp = "2026-05-09T00:00:00.000Z";

  return {
    confidenceRating: null,
    direction: "long",
    disciplineRulesSnapshot: [],
    emotionState: "",
    entryPrice: 100,
    entrySource: "Market",
    entryStyle: "Chased",
    exitPrice: null,
    exitReason: null,
    id: "journal-test",
    isCustomSetupTag: false,
    lessonLearned: "",
    mistakeMade: "",
    planFollowed: null,
    realizedPnl: null,
    relatedSessionLogIds: [],
    replayMetadata: createJournalReplayMetadata(timestamp, "journal-test", {
      captureIntervalTargetSeconds: 60,
      randomUUID: () => "entry",
    }),
    setupCapturedAt: null,
    setupQualityRating: null,
    setupStatus: "pending",
    setupTag: null,
    setupType: "",
    size: 1,
    status: "open",
    symbol: "BTC-USD",
    thesis: "",
    timeframe: "15m",
    timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}
