import test from "node:test";
import assert from "node:assert/strict";
import { deriveJournalInsightsV1 } from "./journal-insights";

function createEntry(
  overrides: Partial<Parameters<typeof deriveJournalInsightsV1>[0][number]> = {},
): Parameters<typeof deriveJournalInsightsV1>[0][number] {
  return {
    entryStyle: "Hunted",
    id: "entry-1",
    realizedPnl: 25,
    relatedSessionLogIds: [],
    replayMetadata: { frames: [] },
    setupTag: "Trend Break",
    status: "closed",
    timestamp: "2026-04-27T18:00:00.000Z",
    ...overrides,
  };
}

function createLog(
  overrides: Partial<Parameters<typeof deriveJournalInsightsV1>[1][number]> = {},
): Parameters<typeof deriveJournalInsightsV1>[1][number] {
  return {
    eventType: "position-closed",
    id: "log-1",
    timestamp: "2026-04-27T18:20:00.000Z",
    ...overrides,
  };
}

test("returns safe fallback states for an empty dataset", () => {
  const insights = deriveJournalInsightsV1([], [], null);

  assert.equal(insights.totalJournaledTrades, 0);
  assert.equal(insights.closedTradesAnalyzed, 0);
  assert.equal(insights.entryStyleComparison.message, "Not enough hunted/chased data yet.");
  assert.equal(insights.setupTagPerformance.message, "Not enough setup tag data yet.");
  assert.equal(insights.selectedTrade.earlyExit.exitedBeforeTp, "not-tracked-yet");
  assert.equal(insights.selectedTrade.earlyExit.tpHitAfterExit, "not-tracked-yet");
});

test("compares hunted vs chased using closed trades only and computes durations", () => {
  const entries = [
    createEntry({
      id: "h1",
      entryStyle: "Hunted",
      realizedPnl: 120,
      relatedSessionLogIds: ["h1-exit"],
      timestamp: "2026-04-27T18:00:00.000Z",
    }),
    createEntry({
      id: "h2",
      entryStyle: "Hunted",
      realizedPnl: 90,
      relatedSessionLogIds: ["h2-exit"],
      timestamp: "2026-04-27T19:00:00.000Z",
    }),
    createEntry({
      id: "h3",
      entryStyle: "Hunted",
      realizedPnl: -20,
      relatedSessionLogIds: ["h3-exit"],
      timestamp: "2026-04-27T20:00:00.000Z",
    }),
    createEntry({
      id: "c1",
      entryStyle: "Chased",
      realizedPnl: -80,
      relatedSessionLogIds: ["c1-exit"],
      timestamp: "2026-04-27T18:10:00.000Z",
    }),
    createEntry({
      id: "c2",
      entryStyle: "Chased",
      realizedPnl: -30,
      relatedSessionLogIds: ["c2-exit"],
      timestamp: "2026-04-27T19:10:00.000Z",
    }),
    createEntry({
      id: "c3",
      entryStyle: "Chased",
      realizedPnl: 10,
      relatedSessionLogIds: ["c3-exit"],
      timestamp: "2026-04-27T20:10:00.000Z",
    }),
    createEntry({
      id: "open-ignored",
      entryStyle: "Chased",
      realizedPnl: 999,
      status: "open",
      timestamp: "2026-04-27T21:10:00.000Z",
    }),
  ];
  const logs = [
    createLog({ id: "h1-exit", timestamp: "2026-04-27T18:15:00.000Z" }),
    createLog({ id: "h2-exit", timestamp: "2026-04-27T19:18:00.000Z" }),
    createLog({ id: "h3-exit", timestamp: "2026-04-27T20:09:00.000Z" }),
    createLog({ id: "c1-exit", timestamp: "2026-04-27T18:17:00.000Z" }),
    createLog({ id: "c2-exit", timestamp: "2026-04-27T19:16:00.000Z" }),
    createLog({ id: "c3-exit", timestamp: "2026-04-27T20:14:00.000Z" }),
  ];

  const insights = deriveJournalInsightsV1(entries, logs, "h1");

  assert.equal(insights.closedTradesAnalyzed, 6);
  assert.equal(insights.entryStyleComparison.hunted.totalTrades, 3);
  assert.equal(insights.entryStyleComparison.chased.totalTrades, 3);
  assert.equal(insights.entryStyleComparison.hunted.wins, 2);
  assert.equal(insights.entryStyleComparison.hunted.losses, 1);
  assert.equal(insights.entryStyleComparison.chased.wins, 1);
  assert.equal(insights.entryStyleComparison.chased.losses, 2);
  assert.equal(insights.entryStyleComparison.message, "Your hunted trades are outperforming chased trades.");
  assert.equal(insights.entryStyleComparison.strongerStyle, "Hunted");
  assert.equal(insights.selectedTrade.entryStylePatternMessage, "This trade matches your stronger hunted pattern.");
  assert.equal(insights.entryStyleComparison.hunted.averageDurationMinutes, 14);
  assert.equal(insights.entryStyleComparison.chased.averageDurationMinutes, 5.666666666666667);
});

test("suppresses conclusions when hunted or chased samples are below threshold", () => {
  const entries = [
    createEntry({ id: "h1", entryStyle: "Hunted", realizedPnl: 10 }),
    createEntry({ id: "h2", entryStyle: "Hunted", realizedPnl: 12 }),
    createEntry({ id: "c1", entryStyle: "Chased", realizedPnl: -5 }),
  ];

  const insights = deriveJournalInsightsV1(entries, [], "h1");

  assert.equal(insights.entryStyleComparison.status, "not-enough-data");
  assert.equal(insights.entryStyleComparison.message, "Not enough hunted/chased data yet.");
  assert.equal(insights.selectedTrade.entryStylePatternMessage, "Not enough hunted/chased data yet.");
});

test("ranks setup tags only when they meet the minimum sample threshold", () => {
  const entries = [
    createEntry({ id: "tb-1", setupTag: "Trend Break", realizedPnl: 100 }),
    createEntry({ id: "tb-2", setupTag: "Trend Break", realizedPnl: 40 }),
    createEntry({ id: "tb-3", setupTag: "Trend Break", realizedPnl: 70 }),
    createEntry({ id: "rv-1", setupTag: "Range Reclaim", realizedPnl: -20 }),
    createEntry({ id: "rv-2", setupTag: "Range Reclaim", realizedPnl: -35 }),
    createEntry({ id: "rv-3", setupTag: "Range Reclaim", realizedPnl: -10 }),
    createEntry({ id: "low-sample", setupTag: "One Off", realizedPnl: 250 }),
    createEntry({ id: "low-sample-2", setupTag: "One Off", realizedPnl: -50 }),
    createEntry({ id: "no-tag", setupTag: null, realizedPnl: 15 }),
  ];

  const insights = deriveJournalInsightsV1(entries, [], "tb-1");

  assert.equal(insights.setupTagPerformance.eligibleTagCount, 2);
  assert.equal(insights.setupTagPerformance.bestTag?.tag, "Trend Break");
  assert.equal(insights.setupTagPerformance.worstTag?.tag, "Range Reclaim");
  assert.equal(insights.setupTagPerformance.message, "Best setup tag so far: Trend Break.");
  assert.equal(insights.selectedTrade.setupTagPatternMessage, "This trade matches your best-performing setup tag: Trend Break.");
});

test("falls back cleanly when setup tag leaders tie", () => {
  const entries = [
    createEntry({ id: "a1", setupTag: "A", realizedPnl: 20 }),
    createEntry({ id: "a2", setupTag: "A", realizedPnl: 10 }),
    createEntry({ id: "a3", setupTag: "A", realizedPnl: 0 }),
    createEntry({ id: "b1", setupTag: "B", realizedPnl: 20 }),
    createEntry({ id: "b2", setupTag: "B", realizedPnl: 10 }),
    createEntry({ id: "b3", setupTag: "B", realizedPnl: 0 }),
  ];

  const insights = deriveJournalInsightsV1(entries, [], "a1");

  assert.equal(insights.setupTagPerformance.bestTag, null);
  assert.equal(insights.setupTagPerformance.worstTag, null);
  assert.equal(insights.selectedTrade.setupTagPatternMessage, "A is performing in the middle of your tracked setup tags.");
});

test("keeps early-exit placeholders at not tracked yet when TP data is unavailable", () => {
  const entries = [
    createEntry({
      id: "selected",
      relatedSessionLogIds: ["tp-log"],
      replayMetadata: { frames: [{ capturedAt: "2026-04-27T18:10:00.000Z", event: "tp-moved" }] },
    }),
    createEntry({ id: "peer-1", entryStyle: "Chased", realizedPnl: -20 }),
    createEntry({ id: "peer-2", entryStyle: "Chased", realizedPnl: -10 }),
    createEntry({ id: "peer-3", entryStyle: "Chased", realizedPnl: 5 }),
  ];
  const logs = [createLog({ id: "tp-log", eventType: "protection-attached" })];

  const insights = deriveJournalInsightsV1(entries, logs, "selected");

  assert.equal(insights.selectedTrade.earlyExit.exitedBeforeTp, "not-tracked-yet");
  assert.equal(insights.selectedTrade.earlyExit.tpHitAfterExit, "not-tracked-yet");
});
