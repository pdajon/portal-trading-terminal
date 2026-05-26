import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionLogEntries,
  filterSessionLogEntries,
  formatSessionLogEventType,
  formatSessionLogPrice,
  formatSessionLogTimestamp,
  indexSessionLogEntriesById,
  prependSessionLogEntries,
  type SessionLogEntry,
} from "./session-log";

test("createSessionLogEntries preserves input order and creates stable ids and timestamps", () => {
  const entries = createSessionLogEntries(
    [
      {
        category: "positions",
        description: "Opened BTC long.",
        direction: "long",
        eventType: "position-opened",
        pnl: null,
        price: 80000,
        size: 0.01,
        source: "Trade",
        symbol: "BTC-USD",
      },
      {
        category: "discipline",
        description: "Blocked by rule.",
        direction: null,
        eventType: "discipline-rule-blocked",
        pnl: null,
        price: null,
        size: null,
        source: "Discipline Rule",
        symbol: "BTC-USD",
      },
    ],
    {
      now: 1_700_000_000_000,
      randomUUID: () => "uuid",
    },
  );

  assert.deepEqual(
    entries.map((entry) => [entry.id, entry.timestamp]),
    [
      ["session-log-1700000000000-0-uuid", "2023-11-14T22:13:20.000Z"],
      ["session-log-1700000000000-1-uuid", "2023-11-14T22:13:20.001Z"],
    ],
  );
  assert.equal(entries[0].eventType, "position-opened");
  assert.equal(entries[1].eventType, "discipline-rule-blocked");
});

test("createSessionLogEntries calls browser crypto with the correct receiver", () => {
  const originalCrypto = globalThis.crypto;
  const fakeCrypto = {
    randomUUID() {
      assert.equal(this, fakeCrypto);
      return "browser-uuid";
    },
  } as Crypto;

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: fakeCrypto,
  });

  try {
    const entries = createSessionLogEntries(
      [
        {
          category: "positions",
          description: "Recovered BTC long.",
          direction: "long",
          eventType: "position-opened",
          pnl: null,
          price: 80000,
          size: 0.01,
          source: "Live Position Sync",
          symbol: "BTC-USD",
        },
      ],
      { now: 1_700_000_000_000 },
    );

    assert.equal(
      entries[0]?.id,
      "session-log-1700000000000-0-browser-uuid",
    );
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  }
});

test("prependSessionLogEntries keeps newest generated entries first and caps history", () => {
  const currentEntries: SessionLogEntry[] = [
    buildEntry("existing-1", "orders"),
    buildEntry("existing-2", "positions"),
  ];
  const nextEntries: SessionLogEntry[] = [
    buildEntry("new-1", "logic"),
    buildEntry("new-2", "discipline"),
  ];

  assert.deepEqual(
    prependSessionLogEntries(currentEntries, nextEntries, 3).map(
      (entry) => entry.id,
    ),
    ["new-2", "new-1", "existing-1"],
  );
});

test("session log filters and index helpers preserve app-shell session behavior", () => {
  const entries = [
    buildEntry("orders-1", "orders"),
    buildEntry("logic-1", "logic"),
  ];

  assert.equal(filterSessionLogEntries(entries, "all").length, 2);
  assert.deepEqual(
    filterSessionLogEntries(entries, "logic").map((entry) => entry.id),
    ["logic-1"],
  );
  assert.equal(indexSessionLogEntriesById(entries).get("orders-1")?.category, "orders");
});

test("session log formatters keep compact terminal labels", () => {
  assert.equal(formatSessionLogTimestamp("bad-date"), "--:--:--");
  assert.equal(formatSessionLogPrice(Number.NaN), "--");
  assert.equal(formatSessionLogPrice(123.456), "123.46");
  assert.equal(formatSessionLogEventType("position-reversed"), "Position Reversed");
  assert.equal(
    formatSessionLogEventType("TAG_ALONG_WOULD_TRIGGER"),
    "Magic Trade Would Trigger",
  );
  assert.equal(formatSessionLogEventType("TAG_ALONG_ARMED"), "Magic Trade Armed");
  assert.equal(formatSessionLogEventType("TAG_ALONG_UPDATED"), "Magic Trade Updated");
  assert.equal(formatSessionLogEventType("TAG_ALONG_DISARMED"), "Magic Trade Disarmed");
});

function buildEntry(
  id: string,
  category: SessionLogEntry["category"],
): SessionLogEntry {
  return {
    category,
    description: id,
    direction: null,
    eventType: "position-opened",
    id,
    pnl: null,
    price: null,
    size: null,
    source: "Test",
    symbol: null,
    timestamp: "2026-05-09T00:00:00.000Z",
  };
}
