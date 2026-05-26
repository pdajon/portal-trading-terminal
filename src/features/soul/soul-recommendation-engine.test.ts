import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveSoulRecommendationsFromActivity,
  deriveSoulRecommendationsFromObservations,
} from "./soul-recommendation-engine";

test("maps Soul observations into deterministic recommendation objects", () => {
  const recommendations = deriveSoulRecommendationsFromObservations([
    {
      createdAt: "2026-05-12T10:00:00.000Z",
      evidence: {
        summary: "At least one trade had no protection.",
        tradeIds: ["trade-1"],
      },
      id: "soul-missing_protection",
      severity: "critical",
      type: "missing_protection",
    },
    {
      createdAt: "2026-05-12T10:00:00.000Z",
      evidence: {
        summary: "Protected trade R:R fell below 1:1.",
        tradeIds: ["trade-2"],
      },
      id: "soul-weak_protected_rr",
      severity: "warning",
      type: "weak_protected_rr",
    },
  ]);

  assert.deepEqual(
    recommendations.map((recommendation) => recommendation.type),
    [],
  );
});

test("derives recommendations from available journal, session, and live protection activity", () => {
  const recommendations = deriveSoulRecommendationsFromActivity({
    journalEntries: [
      {
        id: "loss",
        openedAt: "2026-05-12T10:00:00.000Z",
        closedAt: "2026-05-12T10:05:00.000Z",
        entrySource: "Market",
        realizedPnl: -42,
        relatedSessionLogIds: ["open-loss"],
        status: "closed",
        symbol: "BTC-USD",
        timestamp: "2026-05-12T10:00:00.000Z",
      },
      {
        id: "re-entry",
        openedAt: "2026-05-12T10:07:00.000Z",
        closedAt: "2026-05-12T10:12:00.000Z",
        entrySource: "Market",
        realizedPnl: -10,
        relatedSessionLogIds: ["open-re-entry", "protect-re-entry"],
        status: "closed",
        symbol: "BTC-USD",
        timestamp: "2026-05-12T10:07:00.000Z",
      },
      {
        id: "third",
        openedAt: "2026-05-12T10:16:00.000Z",
        closedAt: "2026-05-12T10:20:00.000Z",
        entrySource: "Limit",
        realizedPnl: 8,
        relatedSessionLogIds: ["open-third", "protect-third"],
        status: "closed",
        symbol: "ETH-USD",
        timestamp: "2026-05-12T10:16:00.000Z",
      },
    ],
    now: "2026-05-12T10:30:00.000Z",
    sessionLogEntries: [
      {
        eventType: "position-opened",
        id: "open-loss",
        timestamp: "2026-05-12T10:00:00.000Z",
      },
      {
        eventType: "position-opened",
        id: "open-re-entry",
        timestamp: "2026-05-12T10:07:00.000Z",
      },
      {
        eventType: "protection-attached",
        id: "protect-re-entry",
        timestamp: "2026-05-12T10:08:00.000Z",
      },
      {
        eventType: "position-opened",
        id: "open-third",
        timestamp: "2026-05-12T10:16:00.000Z",
      },
      {
        eventType: "protection-attached",
        id: "protect-third",
        timestamp: "2026-05-12T10:17:00.000Z",
      },
    ],
  });

  const recommendationTypes = recommendations.map(
    (recommendation) => recommendation.type,
  );

  assert.ok(recommendationTypes.includes("max_trades_per_day"));
  assert.ok(recommendationTypes.includes("cooldown_after_loss"));
});

test("uses active plan R:R and live position protection when available", () => {
  const recommendations = deriveSoulRecommendationsFromActivity({
    activeTradePlan: {
      createdAt: "2026-05-12T11:00:00.000Z",
      direction: "long",
      entry: 100,
      id: "plan-1",
      stop: 95,
      symbol: "BTC-USD",
      target: 103,
    },
    livePositions: [
      {
        entryPrice: 100,
        direction: "long",
        pnlUsd: 0,
        slStatus: "missing",
        symbol: "BTC-USD",
        tpStatus: "missing",
      },
    ],
    now: "2026-05-12T11:01:00.000Z",
  });

  const recommendationTypes = recommendations.map(
    (recommendation) => recommendation.type,
  );

  assert.equal(recommendationTypes.includes("require_protection"), false);
  assert.equal(recommendationTypes.includes("min_rr"), false);
});
