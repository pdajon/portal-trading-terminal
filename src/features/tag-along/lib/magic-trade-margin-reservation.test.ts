import assert from "node:assert/strict";
import test from "node:test";

import type { TradeDirection } from "@/types/trade";
import {
  deriveMagicTradeMarginReservation,
  MAGIC_TRADE_MARGIN_REVIEW_REQUIRED_REASON,
} from "./magic-trade-margin-reservation";
import type { RuleStatus, TagAlongExecutionMode, TagAlongRule } from "./tag-along-rules";

function createOpenPositionRule(
  overrides: {
    executionMode?: TagAlongExecutionMode;
    id?: string;
    legacy?: boolean;
    marginUsd?: number;
    side?: TradeDirection;
    status?: RuleStatus;
  } = {},
): TagAlongRule {
  const marginUsd = overrides.marginUsd ?? 250;

  return {
    createdAt: "2026-05-15T12:00:00.000Z",
    execution: {
      armedAt: "2026-05-15T12:00:00.000Z",
      executionCount: 0,
    },
    id: overrides.id ?? "magic-rule-1",
    name: "Magic Trade",
    safety: {
      duplicateWindowMs: 60_000,
      executionMode: overrides.executionMode ?? "live-open-position",
      fireBehavior: "disarm-after-fire",
      maxExecutions: 1,
      requireFreshSourceDataMs: 15_000,
      requireTargetStillExists: true,
      requiresConfirmationForRiskIncrease: true,
    },
    source: {
      id: "source-1",
      level: 79_850,
      sourceSymbol: "BTC-USD",
      timeframe: "15m",
      type: "candle-closes-below-level",
    },
    status: overrides.status ?? "armed",
    target: overrides.legacy
      ? {
          enterDirection: overrides.side ?? "short",
          enterLeverage: 5,
          enterOrderType: "market",
          enterSizeUsd: marginUsd,
          id: "target-1",
          targetSymbol: "SOL-USD",
          type: "enter-market",
        }
      : {
          enterDirection: overrides.side ?? "short",
          enterLeverage: 5,
          enterMarginUsd: marginUsd,
          enterOrderType: "market",
          id: "target-1",
          sizingMode: "margin",
          targetSymbol: "SOL-USD",
          type: "enter-market",
        },
    updatedAt: "2026-05-15T12:00:00.000Z",
  } as TagAlongRule;
}

test("deriveMagicTradeMarginReservation subtracts active live Open Position Magic margin from global and side availability", () => {
  const summary = deriveMagicTradeMarginReservation({
    availableToTrade: 1_000,
    availableToTradeBySide: { long: 900, short: 800 },
    rules: [
      createOpenPositionRule({ id: "magic-1", marginUsd: 250 }),
      createOpenPositionRule({ id: "magic-2", marginUsd: 125, status: "triggered" }),
      createOpenPositionRule({ id: "magic-3", marginUsd: 100, status: "executing" }),
    ],
  });

  assert.deepEqual(
    summary.reservations.map((reservation) => ({
      direction: reservation.direction,
      marginUsd: reservation.marginUsd,
      ruleId: reservation.ruleId,
    })),
    [
      { direction: "short", marginUsd: 250, ruleId: "magic-1" },
      { direction: "short", marginUsd: 125, ruleId: "magic-2" },
      { direction: "short", marginUsd: 100, ruleId: "magic-3" },
    ],
  );
  assert.equal(summary.totalReservedMarginUsd, 475);
  assert.equal(summary.remainingAvailableToTrade, 525);
  assert.deepEqual(summary.remainingAvailableToTradeBySide, {
    long: 425,
    short: 325,
  });
  assert.equal(summary.oversubscribedMarginUsd, 0);
});

test("deriveMagicTradeMarginReservation excludes inactive, simulation, and risk-reducing Magic rules", () => {
  const summary = deriveMagicTradeMarginReservation({
    availableToTrade: 1_000,
    availableToTradeBySide: { long: 1_000, short: 1_000 },
    rules: [
      createOpenPositionRule({ id: "draft", status: "draft" }),
      createOpenPositionRule({ id: "paused", status: "paused" }),
      createOpenPositionRule({ id: "disarmed", status: "disarmed" }),
      createOpenPositionRule({ id: "executed", status: "executed" }),
      createOpenPositionRule({ id: "simulation", executionMode: "simulation-only" }),
      {
        ...createOpenPositionRule({ id: "risk-reducing" }),
        safety: {
          ...createOpenPositionRule().safety,
          executionMode: "live-risk-reducing",
        },
        target: {
          id: "target-risk-reducing",
          positionSide: "long",
          targetSymbol: "BTC-USD",
          type: "close-position",
        },
      } as TagAlongRule,
    ],
  });

  assert.deepEqual(summary.reservations, []);
  assert.equal(summary.totalReservedMarginUsd, 0);
  assert.equal(summary.remainingAvailableToTrade, 1_000);
});

test("deriveMagicTradeMarginReservation excludes the rule currently being edited", () => {
  const summary = deriveMagicTradeMarginReservation({
    availableToTrade: 1_000,
    availableToTradeBySide: { long: 1_000, short: 1_000 },
    excludeRuleId: "magic-1",
    rules: [
      createOpenPositionRule({ id: "magic-1", marginUsd: 800 }),
      createOpenPositionRule({ id: "magic-2", marginUsd: 125 }),
    ],
  });

  assert.deepEqual(summary.reservations.map((reservation) => reservation.ruleId), ["magic-2"]);
  assert.equal(summary.totalReservedMarginUsd, 125);
  assert.equal(summary.remainingAvailableToTrade, 875);
});

test("deriveMagicTradeMarginReservation marks legacy live Open Position Magic rules for review instead of reserving them", () => {
  const summary = deriveMagicTradeMarginReservation({
    availableToTrade: 1_000,
    availableToTradeBySide: { long: 1_000, short: 1_000 },
    rules: [createOpenPositionRule({ id: "legacy-rule", legacy: true })],
  });

  assert.deepEqual(summary.reservations, []);
  assert.deepEqual(summary.legacyReviewRequiredRuleIds, ["legacy-rule"]);
  assert.equal(summary.legacyReviewReasons["legacy-rule"], MAGIC_TRADE_MARGIN_REVIEW_REQUIRED_REASON);
  assert.equal(summary.remainingAvailableToTrade, 1_000);
});

test("deriveMagicTradeMarginReservation reports oversubscribed reserved margin", () => {
  const summary = deriveMagicTradeMarginReservation({
    availableToTrade: 300,
    availableToTradeBySide: { long: 275, short: 250 },
    rules: [createOpenPositionRule({ marginUsd: 450 })],
  });

  assert.equal(summary.totalReservedMarginUsd, 450);
  assert.equal(summary.remainingAvailableToTrade, 0);
  assert.equal(summary.remainingAvailableToTradeBySide.long, 0);
  assert.equal(summary.remainingAvailableToTradeBySide.short, 0);
  assert.equal(summary.oversubscribedMarginUsd, 150);
});
