import assert from "node:assert/strict";
import test from "node:test";

import { deriveSoulExpFromActivity } from "./soul-exp-engine";

test("derives Soul EXP progression from existing journal, session, and memory activity", () => {
  const progression = deriveSoulExpFromActivity({
    journalEntries: [
      {
        id: "journal-1",
        status: "closed",
        symbol: "BTC-USD",
        timestamp: "2026-05-12T10:00:00.000Z",
        updatedAt: "2026-05-12T10:20:00.000Z",
      },
      {
        id: "journal-2",
        status: "open",
        symbol: "ETH-USD",
        timestamp: "2026-05-12T10:25:00.000Z",
      },
    ],
    journalMemoryEvents: [
      {
        id: "memory-magic-1",
        sessionLogId: "session-magic-1",
        timestamp: "2026-05-12T10:30:00.000Z",
        type: "magic_trade_executed",
      },
      {
        id: "memory-warning-1",
        timestamp: "2026-05-12T10:31:00.000Z",
        type: "ai_warning_respected",
      },
    ],
    sessionLogEntries: [
      {
        eventType: "position-opened",
        id: "session-position-1",
        source: "Market",
        symbol: "BTC-USD",
        timestamp: "2026-05-12T10:01:00.000Z",
      },
      {
        eventType: "discipline-plan-activated",
        id: "session-discipline-1",
        source: "Operator Diagnosis",
        timestamp: "2026-05-12T10:02:00.000Z",
      },
      {
        eventType: "TAG_ALONG_EXECUTED",
        id: "session-magic-1",
        source: "Magic Trade",
        timestamp: "2026-05-12T10:30:00.000Z",
      },
    ],
  });

  assert.equal(progression.state.totalExp, 82);
  assert.equal(progression.level.level, 2);
  assert.equal(progression.progressPercent, 64);
  assert.deepEqual(
    progression.recentEvents.map((event) => event.id),
    [
      "soul-exp:memory:memory-warning-1",
      "soul-exp:magic:session-magic-1",
      "soul-exp:journal:journal-2",
      "soul-exp:journal:journal-1",
      "soul-exp:discipline:session-discipline-1",
      "soul-exp:session:session-position-1",
    ],
  );
});

test("dedupes derived EXP events by source identity", () => {
  const progression = deriveSoulExpFromActivity({
    journalEntries: [
      {
        id: "journal-1",
        status: "closed",
        timestamp: "2026-05-12T10:00:00.000Z",
      },
      {
        id: "journal-1",
        status: "closed",
        timestamp: "2026-05-12T10:00:00.000Z",
      },
    ],
    journalMemoryEvents: [
      {
        id: "memory-magic-1",
        sessionLogId: "session-magic-1",
        timestamp: "2026-05-12T10:30:00.000Z",
        type: "magic_trade_executed",
      },
    ],
    sessionLogEntries: [
      {
        eventType: "TAG_ALONG_EXECUTED",
        id: "session-magic-1",
        timestamp: "2026-05-12T10:30:00.000Z",
      },
    ],
  });

  assert.equal(progression.state.totalExp, 24);
  assert.deepEqual(
    progression.state.events.map((event) => event.id),
    ["soul-exp:journal:journal-1", "soul-exp:magic:session-magic-1"],
  );
});
