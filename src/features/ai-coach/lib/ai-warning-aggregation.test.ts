import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveAiWarningAggregation,
  getNextDismissedAiWarningIds,
  mapSessionLogsForAiWarnings,
  selectAiCoachLivePosition,
  type AiWarningAggregationInput,
} from "./ai-warning-aggregation";

function createInput(
  overrides: Partial<AiWarningAggregationInput> = {},
): AiWarningAggregationInput {
  return {
    activeDisciplineRuleCount: 1,
    activeSymbol: "HYPE-USD",
    baselineProfile: null,
    collateralAllocationPercent: 10,
    cooldownRemainingMs: 0,
    dismissedWarningIds: [],
    disciplineCurrentlyBlocked: false,
    executableMarketSize: 2,
    hasPlanContext: false,
    journalEntries: [],
    journalMemoryEvents: [],
    liveExchangePositions: [],
    maxDailyLoss: null,
    maxTradesPerDay: null,
    operatorDiagnosis: null,
    realizedPnlToday: 0,
    selectedTradeDirection: "long",
    sessionLogEntries: [],
    tradesPlacedToday: 0,
    tradeExecutionMode: "market",
    ...overrides,
  };
}

test("mapSessionLogsForAiWarnings keeps only warning-relevant session events", () => {
  const logs = mapSessionLogsForAiWarnings([
    {
      eventType: "position-closed",
      id: "close-1",
      timestamp: "2026-05-09T01:00:00.000Z",
    },
    {
      eventType: "command-submitted",
      id: "command-1",
      timestamp: "2026-05-09T01:01:00.000Z",
    },
    {
      eventType: "discipline-rule-blocked",
      id: "blocked-1",
      metadata: { reasonCode: "protection_required", ruleType: "require_protection" },
      symbol: "HYPE-USD",
      timestamp: "2026-05-09T01:02:00.000Z",
    },
  ]);

  assert.deepEqual(
    logs.map((entry) => entry.id),
    ["close-1", "blocked-1"],
  );
  assert.deepEqual(logs[1], {
    eventType: "discipline-rule-blocked",
    id: "blocked-1",
    metadata: {
      reasonCode: "protection_required",
      ruleType: "require_protection",
    },
    size: undefined,
    symbol: "HYPE-USD",
    timestamp: "2026-05-09T01:02:00.000Z",
  });
});

test("deriveAiWarningAggregation preserves discipline warning copy and dismissal filtering", () => {
  const input = createInput({
    sessionLogEntries: [
      {
        eventType: "discipline-rule-blocked",
        id: "blocked-1",
        metadata: {
          reasonCode: "protection_required",
          ruleType: "require_protection",
        },
        symbol: "HYPE-USD",
        timestamp: "2026-05-09T01:02:00.000Z",
      },
    ],
  });
  const visible = deriveAiWarningAggregation(input);

  assert.equal(visible.warnings[0]?.id, "protection_required:require_protection:HYPE-USD");
  assert.equal(visible.warnings[0]?.title, "Protection required.");
  assert.equal(visible.warnings[0]?.message, "Add a stop loss before taking new risk.");
  assert.equal(visible.warnings[0]?.severity, "critical");
  assert.equal(visible.state, "Warning");

  const dismissed = deriveAiWarningAggregation({
    ...input,
    dismissedWarningIds: [visible.warnings[0]?.id ?? ""],
  });

  assert.equal(dismissed.warnings.length, 0);
});

test("deriveAiWarningAggregation keeps TTL expiry and active live-position selection without rendering a card", () => {
  const aggregated = deriveAiWarningAggregation(
    createInput({
      liveExchangePositions: [
        {
          direction: "short",
          protectionMissing: false,
          size: 1,
          slStatus: "live",
          stopPrice: 1,
          symbol: "BTC-USD",
          targetPrice: 2,
          tpStatus: "live",
        },
        {
          direction: "long",
          protectionMissing: true,
          size: 3,
          slStatus: "missing",
          stopPrice: null,
          symbol: "HYPE-USD",
          targetPrice: null,
          tpStatus: "missing",
        },
      ],
      now: "2026-05-09T01:05:00.000Z",
      sessionLogEntries: [
        {
          eventType: "discipline-rule-blocked",
          id: "old-min-rr",
          metadata: { reasonCode: "min_rr_failed", ruleType: "min_risk_reward" },
          symbol: "HYPE-USD",
          timestamp: "2026-05-09T01:00:00.000Z",
        },
      ],
    }),
  );

  assert.equal(aggregated.warnings.some((warning) => warning.trigger === "min_rr_failed"), false);
  assert.equal(
    aggregated.cards.some((card) => String(card.id) === "live-position"),
    false,
  );
  assert.equal(
    selectAiCoachLivePosition(
      [
        {
          direction: "short",
          protectionMissing: false,
          size: 1,
          slStatus: "live",
          stopPrice: 1,
          symbol: "BTC-USD",
          targetPrice: 2,
          tpStatus: "live",
        },
      ],
      "HYPE-USD",
    )?.symbol,
    "BTC-USD",
  );
});

test("getNextDismissedAiWarningIds appends once without reordering existing ids", () => {
  assert.deepEqual(getNextDismissedAiWarningIds(["warning-a"], "warning-b"), [
    "warning-a",
    "warning-b",
  ]);
  assert.deepEqual(getNextDismissedAiWarningIds(["warning-a"], "warning-a"), [
    "warning-a",
  ]);
});
