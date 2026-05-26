import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveTradeReviewFlags,
  formatTradeMemoryEvent,
  getTradeMemoryEventsForEntry,
  groupTradeMemoryEvents,
} from "./trade-review";
import type { JournalMemoryEvent } from "./journal-memory-events";

function createEvent(overrides: Partial<JournalMemoryEvent> = {}): JournalMemoryEvent {
  return {
    id: "event-1",
    journalEntryId: "journal-1",
    source: "execution",
    timestamp: "2026-05-03T20:00:00.000Z",
    type: "trade_opened",
    ...overrides,
  };
}

test("loads memory events for selected Journal entry by entry, trade, and Session Log links", () => {
  const entry = { id: "journal-1", relatedSessionLogIds: ["session-2"] };
  const events = [
    createEvent({ id: "unrelated", journalEntryId: "journal-2", timestamp: "2026-05-03T20:01:00.000Z" }),
    createEvent({ id: "session-linked", journalEntryId: undefined, sessionLogId: "session-2", timestamp: "2026-05-03T20:03:00.000Z" }),
    createEvent({ id: "trade-linked", journalEntryId: undefined, tradeId: "journal-1", timestamp: "2026-05-03T20:02:00.000Z" }),
    createEvent({ id: "entry-linked", timestamp: "2026-05-03T20:00:00.000Z" }),
  ];

  assert.deepEqual(
    getTradeMemoryEventsForEntry(events, entry).map((event) => event.id),
    ["entry-linked", "trade-linked", "session-linked"],
  );
});

test("groups trade actions, discipline, AI warning, and protection events", () => {
  const groups = groupTradeMemoryEvents([
    createEvent({ id: "opened", type: "trade_opened" }),
    createEvent({ id: "blocked", source: "discipline", type: "discipline_rule_blocked" }),
    createEvent({ id: "warning", source: "ai_coach", type: "ai_warning_shown" }),
    createEvent({ id: "protection", source: "journal", type: "protection_updated" }),
  ]);

  assert.deepEqual(
    groups.map((group) => [group.label, group.events.map((event) => event.id)]),
    [
      ["Trade Actions", ["opened"]],
      ["Discipline", ["blocked"]],
      ["AI Coach", ["warning"]],
      ["Protection / Plan", ["protection"]],
    ],
  );
});

test("formats Override Bond amount, multiplier, and split summary", () => {
  const row = formatTradeMemoryEvent(
    createEvent({
      metadata: {
        finalAmountUsdc: 50,
        multiplier: 2,
        portalAmountUsdc: 10,
        reserveAmountUsdc: 5,
        vaultAmountUsdc: 35,
      },
      source: "override_bond",
      type: "discipline_override_bond_posted",
    }),
  );

  assert.equal(row.label, "Override Bond posted");
  assert.equal(row.detail, "50 USDC, 2x multiplier, split 35 vault / 10 Portal / 5 reserve");
});

test("derives deterministic behavior flags from memory events", () => {
  const flags = deriveTradeReviewFlags([
    createEvent({ source: "ai_coach", type: "ai_warning_shown" }),
    createEvent({ source: "ai_coach", type: "ai_warning_dismissed" }),
    createEvent({ source: "discipline", type: "discipline_rule_blocked" }),
    createEvent({ metadata: { overrideCountToday: 2 }, source: "override_bond", type: "discipline_override_bond_posted" }),
    createEvent({ source: "magic_trade", type: "magic_trade_executed" }),
    createEvent({ source: "trigger", type: "trigger_fired" }),
  ]);

  assert.deepEqual(flags, {
    aiWarned: true,
    warningDismissed: true,
    disciplineBlockedAction: true,
    overrideBondPosted: true,
    repeatedOverride: true,
    ruleRespectedNoOverride: false,
    magicTradeInvolved: true,
    triggerInvolved: true,
  });
});

test("marks rule respected when Discipline blocked but no override was posted", () => {
  const flags = deriveTradeReviewFlags([
    createEvent({ source: "discipline", type: "discipline_rule_blocked" }),
  ]);

  assert.equal(flags.disciplineBlockedAction, true);
  assert.equal(flags.overrideBondPosted, false);
  assert.equal(flags.ruleRespectedNoOverride, true);
});

test("formats no-trade memory without needing a native trade", () => {
  const row = formatTradeMemoryEvent(
    createEvent({
      journalEntryId: undefined,
      message: "Trade blocked. Cooldown is still active.",
      sessionLogId: "session-1",
      source: "discipline",
      symbol: "ETH-USD",
      type: "no_trade_session",
    }),
  );

  assert.equal(row.label, "No-trade session: ETH-USD");
  assert.equal(row.detail, "Trade blocked. Cooldown is still active.");
  assert.equal(row.sessionLogId, "session-1");
});
