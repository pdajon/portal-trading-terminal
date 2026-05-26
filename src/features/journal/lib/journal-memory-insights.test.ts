import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveJournalMemoryInsights,
  deriveNoTradeMemoryInsights,
  type JournalMemoryInsight,
} from "./journal-memory-insights";
import type { JournalMemoryEvent } from "./journal-memory-events";

type InsightEntry = NonNullable<Parameters<typeof deriveJournalMemoryInsights>[0]["selectedEntry"]>;

function createEntry(overrides: Partial<InsightEntry> = {}): InsightEntry {
  return {
    id: "journal-1",
    planFollowed: null,
    relatedSessionLogIds: [],
    status: "closed",
    symbol: "BTC-USD",
    ...overrides,
  };
}

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

function titles(insights: JournalMemoryInsight[]) {
  return insights.map((insight) => insight.title);
}

test("AI warning insight appears when warning event exists", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [createEvent({ id: "ai-1", source: "ai_coach", type: "ai_warning_shown" })],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["AI warned during this trade."]);
  assert.equal(insights[0]?.category, "ai_warning");
});

test("warning dismissed insight appears when dismissed event exists", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [createEvent({ id: "dismissed-1", source: "ai_coach", type: "ai_warning_dismissed" })],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["Warning dismissed."]);
});

test("discipline block insight appears", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [createEvent({ id: "blocked-1", source: "discipline", type: "discipline_rule_blocked" })],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["Discipline stepped in.", "Rule respected."]);
});

test("Override Bond insight appears", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [
      createEvent({ id: "bond-1", source: "override_bond", type: "discipline_override_bond_posted" }),
    ],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["Override Bond posted."]);
});

test("repeated Override Bond insight appears when multiple override events exist", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [
      createEvent({ id: "bond-1", source: "override_bond", type: "discipline_override_bond_posted" }),
      createEvent({ id: "bond-2", source: "override_bond", type: "discipline_override_bond_posted" }),
    ],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["Override Bond posted.", "Repeated override pattern."]);
});

test("repeated Override Bond insight appears from override count metadata", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [
      createEvent({
        id: "bond-1",
        metadata: { overrideCountToday: 2 },
        source: "override_bond",
        type: "discipline_override_bond_posted",
      }),
    ],
    selectedEntry: createEntry(),
  });

  assert.equal(titles(insights).includes("Repeated override pattern."), true);
});

test("Rule respected insight appears when locked risk event exists but no override exists", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [
      createEvent({ id: "blocked-1", source: "discipline", type: "discipline_rule_edit_blocked" }),
    ],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["Discipline stepped in.", "Rule respected."]);
});

test("Magic Trade insight appears", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [createEvent({ id: "magic-1", source: "magic_trade", type: "magic_trade_executed" })],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["Magic Trade involved."]);
});

test("Trigger insight appears", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [createEvent({ id: "trigger-1", source: "trigger", type: "trigger_fired" })],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["Trigger involved."]);
});

test("No-trade insight appears without fake Journal trade", () => {
  const insights = deriveNoTradeMemoryInsights([
    createEvent({
      id: "no-trade-1",
      journalEntryId: undefined,
      source: "discipline",
      type: "no_trade_session",
    }),
  ]);

  assert.deepEqual(titles(insights), ["No-trade decision recorded."]);
  assert.equal(insights[0]?.evidenceEventIds[0], "no-trade-1");
});

test("Plan followed insight appears", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [],
    selectedEntry: createEntry({ planFollowed: "followed" }),
  });

  assert.deepEqual(titles(insights), ["Plan followed."]);
});

test("Plan broken insight appears", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [],
    selectedEntry: createEntry({ planFollowed: "broken" }),
  });

  assert.deepEqual(titles(insights), ["Plan broken."]);
});

test("does not create duplicate insight spam from duplicate memory events", () => {
  const insights = deriveJournalMemoryInsights({
    relatedMemoryEvents: [
      createEvent({ id: "ai-1", source: "ai_coach", type: "ai_warning_shown" }),
      createEvent({ id: "ai-1", source: "ai_coach", type: "ai_warning_shown" }),
      createEvent({ id: "ai-2", source: "ai_coach", type: "ai_warning_shown" }),
    ],
    selectedEntry: createEntry(),
  });

  assert.deepEqual(titles(insights), ["AI warned during this trade."]);
  assert.deepEqual(insights[0]?.evidenceEventIds, ["ai-1", "ai-2"]);
});

test("ignores imported baseline-like entries as native insight targets", () => {
  const insights = deriveJournalMemoryInsights({
    allJournalEntries: [
      createEntry({ id: "journal-1" }),
      { ...createEntry({ id: "imported-1", planFollowed: "broken" }), source: "imported_baseline" },
    ],
    relatedMemoryEvents: [],
    selectedEntry: createEntry({ id: "journal-1", planFollowed: null }),
  });

  assert.deepEqual(insights, []);
});
