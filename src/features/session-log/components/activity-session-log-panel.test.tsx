import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ActivitySessionLogPanel } from "./activity-session-log-panel";
import type { SessionLogEntry } from "../lib/session-log";

test("ActivitySessionLogPanel renders a compact Activity feed from caller-owned log state", () => {
  const entries = Array.from({ length: 9 }, (_, index) =>
    buildEntry(`entry-${index}`, `Activity event ${index}`),
  );

  const markup = renderToStaticMarkup(
    createElement(ActivitySessionLogPanel, {
      entries,
      filter: "all",
      formatEstimatedBaseSize: (value, symbol) => `${value} ${symbol}`,
      formatUsd: (value) => `$${value.toFixed(2)}`,
      onFilterChange: () => undefined,
      totalEntryCount: entries.length,
      variant: "activity",
    }),
  );

  assert.match(markup, /Recent Events/);
  assert.match(markup, /9 events stored locally/);
  assert.match(markup, /Activity event 0/);
  assert.match(markup, /Activity event 5/);
  assert.doesNotMatch(markup, /Activity event 6/);
  assert.match(markup, /Position Opened/);
  assert.match(markup, /long/);
});

test("ActivitySessionLogPanel footer variant keeps the existing session log controls available", () => {
  const entries = [buildEntry("entry-0", "Footer event")];

  const markup = renderToStaticMarkup(
    createElement(ActivitySessionLogPanel, {
      entries,
      filter: "positions",
      formatEstimatedBaseSize: (value, symbol) => `${value} ${symbol}`,
      formatUsd: (value) => `$${value.toFixed(2)}`,
      isExpanded: false,
      onFilterChange: () => undefined,
      onToggleExpanded: () => undefined,
      totalEntryCount: entries.length,
      variant: "footer",
    }),
  );

  assert.match(markup, /Session Log/);
  assert.match(markup, /Orders/);
  assert.match(markup, /Positions/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /Footer event/);
});

function buildEntry(id: string, description: string): SessionLogEntry {
  return {
    category: "positions",
    description,
    direction: "long",
    eventType: "position-opened",
    id,
    pnl: 12.34,
    price: 100000,
    size: 0.01,
    source: "Trade",
    symbol: null,
    timestamp: "2026-05-11T14:05:00.000Z",
  };
}
