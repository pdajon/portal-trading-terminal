import test from "node:test";
import assert from "node:assert/strict";
import {
  appendJournalMemoryEvent,
  createAiWarningDismissedMemoryEvent,
  createAiWarningShownMemoryEvent,
  createNoTradeSessionEvent,
  findActiveJournalEntryForSymbol,
  filterJournalEntriesWithActiveTradeSymbols,
  getJournalMemoryEventsForJournalEntry,
  getJournalMemoryEventsForSession,
  getJournalMemoryEventsForSymbol,
  getJournalMemoryEventsForTrade,
  JOURNAL_MEMORY_EVENTS_STORAGE_KEY,
  linkMemoryEventToJournalEntry,
  mapSessionLogEntryToJournalMemoryEvents,
  parseJournalMemoryEvents,
  readJournalMemoryEvents,
  serializeJournalMemoryEvents,
  writeJournalMemoryEvents,
  type JournalMemoryEvent,
} from "./journal-memory-events";

type MemoryJournalEntry = Parameters<typeof findActiveJournalEntryForSymbol>[0][number];
type MemorySessionLog = Parameters<typeof mapSessionLogEntryToJournalMemoryEvents>[0];

function createEntry(overrides: Partial<MemoryJournalEntry> = {}): MemoryJournalEntry {
  return {
    direction: "long",
    id: "journal-1",
    status: "open",
    symbol: "BTC-USD",
    ...overrides,
  };
}

function createSessionLog(overrides: Partial<MemorySessionLog> = {}): MemorySessionLog {
  return {
    description: "Market Buy filled on Hyperliquid.",
    direction: "long",
    eventType: "position-opened",
    id: "session-1",
    metadata: { executionId: "exec-1" },
    pnl: null,
    price: 65000,
    size: 0.001,
    source: "Trade Dock",
    symbol: "BTC-USD",
    timestamp: "2026-05-03T20:00:00.000Z",
    ...overrides,
  };
}

function createEvent(overrides: Partial<JournalMemoryEvent> = {}): JournalMemoryEvent {
  return {
    id: "event-1",
    source: "execution",
    timestamp: "2026-05-03T20:00:00.000Z",
    type: "trade_opened",
    ...overrides,
  };
}

function createMemoryStorage(initialValue: string | null = null): Storage {
  let value = initialValue;

  return {
    clear() {
      value = null;
    },
    getItem(key: string) {
      return key === JOURNAL_MEMORY_EVENTS_STORAGE_KEY ? value : null;
    },
    key(index: number) {
      return index === 0 && value !== null ? JOURNAL_MEMORY_EVENTS_STORAGE_KEY : null;
    },
    get length() {
      return value === null ? 0 : 1;
    },
    removeItem(key: string) {
      if (key === JOURNAL_MEMORY_EVENTS_STORAGE_KEY) {
        value = null;
      }
    },
    setItem(key: string, nextValue: string) {
      if (key === JOURNAL_MEMORY_EVENTS_STORAGE_KEY) {
        value = nextValue;
      }
    },
  };
}

test("appends, reads, and filters Journal memory events", () => {
  const event = createEvent({ journalEntryId: "journal-1", sessionLogId: "session-1", symbol: "BTC-USD" });
  const nextEvents = appendJournalMemoryEvent([], event);
  const storage = createMemoryStorage();

  writeJournalMemoryEvents(storage, nextEvents);

  const storedEvents = readJournalMemoryEvents(storage);
  assert.deepEqual(storedEvents, [event]);
  assert.deepEqual(getJournalMemoryEventsForJournalEntry(storedEvents, "journal-1"), [event]);
  assert.deepEqual(getJournalMemoryEventsForTrade(storedEvents, "journal-1"), [event]);
  assert.deepEqual(getJournalMemoryEventsForSession(storedEvents, "session-1"), [event]);
  assert.deepEqual(getJournalMemoryEventsForSymbol(storedEvents, "BTC-USD"), [event]);
});

test("dedupes Journal memory events by stable ID", () => {
  const first = createEvent({ id: "stable-event", title: "First" });
  const replacement = createEvent({ id: "stable-event", title: "Updated" });

  const nextEvents = appendJournalMemoryEvent([first], replacement);

  assert.equal(nextEvents.length, 1);
  assert.equal(nextEvents[0]?.title, "Updated");
});

test("parses malformed or missing memory event storage safely", () => {
  assert.deepEqual(parseJournalMemoryEvents(null), []);
  assert.deepEqual(parseJournalMemoryEvents("not-json"), []);
  assert.deepEqual(parseJournalMemoryEvents(JSON.stringify([{ id: "bad" }])), []);

  const event = createEvent();
  assert.deepEqual(parseJournalMemoryEvents(serializeJournalMemoryEvents([event])), [event]);
});

test("links an event to the active Journal entry by symbol", () => {
  const activeEntry = findActiveJournalEntryForSymbol(
    [createEntry({ id: "closed", status: "closed" }), createEntry({ id: "open" })],
    "BTC-USD",
  );

  const event = linkMemoryEventToJournalEntry(createEvent({ symbol: "BTC-USD" }), activeEntry);

  assert.equal(activeEntry?.id, "open");
  assert.equal(event.journalEntryId, "open");
  assert.equal(event.tradeId, "open");
  assert.equal(event.side, "long");
});

test("filters stale open Journal entries out of active memory linking", () => {
  const entries = [
    createEntry({ id: "stale-open", status: "open", symbol: "BTC-USD" }),
    createEntry({ id: "active-open", status: "open", symbol: "ETH-USD" }),
    createEntry({ id: "closed", status: "closed", symbol: "SOL-USD" }),
  ];

  assert.deepEqual(
    filterJournalEntriesWithActiveTradeSymbols(entries, ["ETH-USD"]).map((entry) => entry.id),
    ["active-open", "closed"],
  );
});

test("maps a Discipline block without an active trade into no-trade session memory", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      description: "Trade blocked. Cooldown is still active.",
      direction: "short",
      eventType: "discipline-rule-blocked",
      metadata: { reasonCode: "cooldown_active", ruleType: "cooldown_after_loss" },
      source: "Discipline Risk Gate",
    }),
    [],
  );

  assert.equal(events.length, 2);
  assert.equal(events[0]?.type, "no_trade_session");
  assert.equal(events[1]?.type, "discipline_rule_blocked");
  assert.equal(events[1]?.source, "discipline");
  assert.equal(events[1]?.metadata?.["noTradeSessionEventId"], events[0]?.id);
});

test("maps market entry confirmation required into discipline memory", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      description: "Manual market entry requires confirmation.",
      direction: "long",
      eventType: "discipline-market-entry-confirmation-required",
      metadata: { reasonCode: "market_entry_confirmation_required", ruleType: "market_entry_confirmation" },
      source: "Market Entry Confirmation",
    }),
    [],
  );

  assert.equal(events.length, 2);
  assert.equal(events[0]?.type, "no_trade_session");
  assert.equal(events[1]?.type, "discipline_rule_blocked");
  assert.equal(events[1]?.metadata?.["reasonCode"], "market_entry_confirmation_required");
});

test("maps a flat blocked market buy to no-trade memory when stale open Journal entries exist", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      description: "Trade blocked. Cooldown is still active.",
      direction: "long",
      eventType: "discipline-rule-blocked",
      id: "blocked-flat-1",
      metadata: { actionType: "market_order", reasonCode: "cooldown_active", source: "manual" },
      source: "Discipline Risk Gate",
      symbol: "BTC-USD",
    }),
    [createEntry({ id: "stale-open-entry", status: "open", symbol: "BTC-USD" })],
    { activeTradeSymbols: [] },
  );

  assert.equal(events.length, 2);
  assert.equal(events[0]?.type, "no_trade_session");
  assert.equal(events[1]?.type, "discipline_rule_blocked");
  assert.equal(events[0]?.journalEntryId, undefined);
  assert.equal(events[1]?.journalEntryId, undefined);
  assert.equal(events[0]?.metadata?.["reasonCode"], "cooldown_active");
  assert.equal(events[0]?.metadata?.["actionType"], "market_order");
  assert.equal(events[1]?.metadata?.["noTradeSessionEventId"], events[0]?.id);
});

test("no-trade memory preserves blocked time-window reason", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      description: "Trade blocked. This time window is locked by your Discipline Plan.",
      direction: "long",
      eventType: "discipline-rule-blocked",
      id: "blocked-time-window-1",
      metadata: {
        actionType: "market_order",
        reasonCode: "blocked_time_window_active",
        ruleType: "blocked_time_window",
      },
      source: "Discipline Risk Gate",
      symbol: "BTC-USD",
    }),
    [],
  );

  assert.equal(events[0]?.type, "no_trade_session");
  assert.equal(events[0]?.metadata?.["reasonCode"], "blocked_time_window_active");
  assert.equal(events[1]?.type, "discipline_rule_blocked");
  assert.equal(events[1]?.metadata?.["ruleType"], "blocked_time_window");
});

test("no-trade memory preserves protection required reason", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      description: "Trade blocked. Add a stop loss before taking new risk.",
      direction: "long",
      eventType: "discipline-rule-blocked",
      id: "blocked-protection-required-1",
      metadata: {
        actionType: "market_order",
        reasonCode: "protection_required",
        ruleType: "require_protection",
      },
      source: "Discipline Risk Gate",
      symbol: "BTC-USD",
    }),
    [],
  );

  assert.equal(events[0]?.type, "no_trade_session");
  assert.equal(events[0]?.metadata?.["reasonCode"], "protection_required");
  assert.equal(events[1]?.type, "discipline_rule_blocked");
  assert.equal(events[1]?.metadata?.["ruleType"], "require_protection");
});

test("keeps distinct flat blocked attempts as separate no-trade memory events", () => {
  const first = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      description: "Trade blocked. Cooldown is still active.",
      eventType: "discipline-rule-blocked",
      id: "blocked-flat-1",
      timestamp: "2026-05-03T20:00:00.000Z",
    }),
    [],
    { activeTradeSymbols: [] },
  );
  const second = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      description: "Trade blocked. Cooldown is still active.",
      eventType: "discipline-rule-blocked",
      id: "blocked-flat-2",
      timestamp: "2026-05-03T20:01:00.000Z",
    }),
    [],
    { activeTradeSymbols: [] },
  );
  const appended = appendJournalMemoryEvent(appendJournalMemoryEvent([], first[0]!), second[0]!);

  assert.equal(first[0]?.type, "no_trade_session");
  assert.equal(second[0]?.type, "no_trade_session");
  assert.notEqual(first[0]?.id, second[0]?.id);
  assert.equal(appended.length, 2);
});

test("maps a Discipline block to an active Journal entry when one exists", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      eventType: "discipline-rule-blocked",
      metadata: { reasonCode: "reverse_blocked", ruleType: "discipline_locked" },
      symbol: "BTC-USD",
    }),
    [createEntry()],
    { activeTradeSymbols: ["BTC-USD"] },
  );

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "discipline_rule_blocked");
  assert.equal(events[0]?.journalEntryId, "journal-1");
  assert.equal(events[0]?.tradeId, "journal-1");
});

test("maps Override Bond posted with split metadata", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      eventType: "discipline-override-bond-posted",
      metadata: {
        baseAmountUsdc: 25,
        finalAmountUsdc: 50,
        multiplier: 2,
        newRuleState: "overridden",
        portalAmountUsdc: 10,
        previousRuleState: "locked",
        reserveAmountUsdc: 5,
        ruleType: "cooldown_after_loss",
        source: "simulated",
        vaultAmountUsdc: 35,
      },
      source: "Discipline Override Bond",
    }),
    [createEntry()],
  );

  assert.equal(events[0]?.type, "discipline_override_bond_posted");
  assert.equal(events[0]?.source, "override_bond");
  assert.equal(events[0]?.metadata?.["finalAmountUsdc"], 50);
  assert.equal(events[0]?.metadata?.["vaultAmountUsdc"], 35);
  assert.equal(events[0]?.journalEntryId, "journal-1");
});

test("maps Discipline Plan activation to plan-changed memory without a trade", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      description: "Recommended Discipline Plan activated.",
      eventType: "discipline-plan-activated",
      metadata: {
        activatedRules: [{ ruleType: "cooldown_after_loss" }],
        diagnosisPlanId: "operator-diagnosis-plan-v1",
        source: "operator_diagnosis",
      },
      source: "Operator Diagnosis",
      symbol: null,
    }),
    [],
  );

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "plan_changed");
  assert.equal(events[0]?.source, "journal");
  assert.equal(events[0]?.journalEntryId, undefined);
  assert.equal(events[0]?.metadata?.["diagnosisPlanId"], "operator-diagnosis-plan-v1");
});

test("creates AI warning shown and dismissed memory events", () => {
  const shown = createAiWarningShownMemoryEvent({
    activeJournalEntries: [createEntry()],
    warning: {
      id: "cooldown_active:cooldown_after_loss:BTC-USD",
      message: "You already locked this rule. Wait it out or post an Override Bond.",
      relatedRuleType: "cooldown_after_loss",
      severity: "critical",
      source: "discipline",
      symbol: "BTC-USD",
      timestamp: "2026-05-03T20:00:00.000Z",
      title: "Cooldown active.",
      trigger: "cooldown_active",
    },
  });
  const dismissed = createAiWarningDismissedMemoryEvent({
    activeJournalEntries: [createEntry()],
    timestamp: "2026-05-03T20:01:00.000Z",
    warning: shown.metadata?.["warning"],
  });

  assert.equal(shown.type, "ai_warning_shown");
  assert.equal(shown.aiWarningId, "cooldown_active:cooldown_after_loss:BTC-USD");
  assert.equal(shown.journalEntryId, "journal-1");
  assert.equal(dismissed.type, "ai_warning_dismissed");
  assert.equal(dismissed.aiWarningId, shown.aiWarningId);
});

test("maps trade lifecycle Session Logs to memory events", () => {
  assert.equal(mapSessionLogEntryToJournalMemoryEvents(createSessionLog(), [createEntry()])[0]?.type, "trade_opened");
  assert.equal(
    mapSessionLogEntryToJournalMemoryEvents(createSessionLog({ eventType: "position-closed" }), [createEntry()])[0]
      ?.type,
    "trade_closed",
  );
  assert.equal(
    mapSessionLogEntryToJournalMemoryEvents(createSessionLog({ eventType: "position-reduced" }), [createEntry()])[0]
      ?.type,
    "trade_reduced",
  );
  assert.equal(
    mapSessionLogEntryToJournalMemoryEvents(createSessionLog({ eventType: "position-reversed" }), [createEntry()])[0]
      ?.type,
    "trade_reversed",
  );
  assert.equal(
    mapSessionLogEntryToJournalMemoryEvents(createSessionLog({ eventType: "pending-order-filled" }), [createEntry()])[0]
      ?.type,
    "order_filled",
  );
});

test("maps Magic Trade and trigger events when data is available", () => {
  const magicEvents = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      eventType: "TAG_ALONG_EXECUTED",
      metadata: { ruleId: "rule-1", sourceTriggerSnapshot: { triggerTimestamp: "2026-05-03T20:00:00.000Z" } },
      source: "Magic Rule",
    }),
    [createEntry()],
  );
  const triggerEvents = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({
      metadata: { triggerId: "trigger-1", triggerSource: "chart_line" },
      source: "Trigger",
    }),
    [createEntry()],
  );

  assert.equal(magicEvents[0]?.type, "magic_trade_executed");
  assert.equal(magicEvents[0]?.magicTradeRuleId, "rule-1");
  assert.equal(magicEvents[1]?.type, "trigger_fired");
  assert.equal(triggerEvents[0]?.type, "trade_opened");
  assert.equal(triggerEvents[1]?.type, "trigger_fired");
  assert.equal(triggerEvents[1]?.triggerId, "trigger-1");
});

test("creates explicit no-trade session events without creating Journal trades", () => {
  const event = createNoTradeSessionEvent({
    message: "Blocked before entry.",
    sessionLogId: "session-1",
    side: "short",
    source: "discipline",
    symbol: "ETH-USD",
    timestamp: "2026-05-03T20:00:00.000Z",
    title: "No-trade session",
  });

  assert.equal(event.type, "no_trade_session");
  assert.equal(event.journalEntryId, undefined);
  assert.equal(event.tradeId, undefined);
  assert.equal(event.sessionLogId, "session-1");
});

test("does not convert imported baseline trades into native Journal memory events", () => {
  const events = mapSessionLogEntryToJournalMemoryEvents(
    createSessionLog({ eventType: "baseline-import-trade" }),
    [createEntry()],
  );

  assert.deepEqual(events, []);
});

test("writes memory events without touching existing portal.journal entries", () => {
  const values = new Map<string, string | null>([
    ["portal.journal", JSON.stringify([{ id: "journal-existing", status: "open" }])],
  ]);
  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };

  writeJournalMemoryEvents(storage, [createEvent()]);

  assert.equal(storage.getItem("portal.journal"), JSON.stringify([{ id: "journal-existing", status: "open" }]));
  assert.equal(readJournalMemoryEvents(storage).length, 1);
});
