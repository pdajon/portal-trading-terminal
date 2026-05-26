import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTradeActionRisk,
  createDisciplineRiskGateLogEntry,
  evaluateDisciplineRiskGate,
  type DisciplineRiskGateInput,
} from "./discipline-risk-gate";

const baseInput: DisciplineRiskGateInput = {
  actionType: "market_order",
  source: "manual",
  requestedTrades: 1,
  rules: {
    cooldownAfterLossMinutes: null,
    maxDailyLoss: null,
    maxTradesPerDay: null,
    minRiskReward: null,
  },
  symbol: "BTC-USD",
  tracking: {
    cooldownRemainingMs: 0,
    realizedPnlToday: 0,
    tradesPlacedToday: 0,
  },
};

test("manual market order is blocked during cooldown", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    tracking: {
      ...baseInput.tracking,
      cooldownRemainingMs: 90_000,
    },
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.riskDirection, "risk_increasing");
  assert.equal(result.reasonCode, "cooldown_active");
  assert.equal(result.message, "Trade blocked. Cooldown is still active.");
});

test("Require Protection disabled does not block risk-increasing market order", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    requireProtection: { enabled: false, mode: "stop_loss_required" },
  });

  assert.equal(result.decision, "allowed");
});

test("Market Entry Confirmation disabled allows manual market entry", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    marketEntryConfirmation: { enabled: false, mode: "confirm_required" },
    orderType: "market",
  });

  assert.equal(result.decision, "allowed");
});

test("Market Entry Confirmation is retired and no longer intercepts manual market entry", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    marketEntryConfirmation: {
      enabled: true,
      mode: "confirm_required",
      source: "operator_diagnosis",
      sourceFindingId: "finding:manual-entry",
      state: "active",
    },
    orderType: "market",
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.reasonCode, undefined);
});

test("Market Entry Confirmation allows confirmed manual market entry", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    confirmedDisciplineWarnings: ["market_entry_confirmation_required"],
    marketEntryConfirmation: { enabled: true, mode: "confirm_required", state: "active" },
    orderType: "market",
  });

  assert.equal(result.decision, "allowed");
});

test("Market Entry Confirmation does not trigger for limit trigger or Magic Trade execution", () => {
  for (const input of [
    { actionType: "limit_order", orderType: "limit", source: "manual" },
    { actionType: "trigger_market_order", orderType: "market", source: "trigger" },
    { actionType: "magic_trade_open_position", orderType: "market", source: "magic_trade" },
  ] as const) {
    const result = evaluateDisciplineRiskGate({
      ...baseInput,
      ...input,
      marketEntryConfirmation: { enabled: true, mode: "confirm_required", state: "active" },
    });

    assert.equal(result.decision, "allowed");
  }
});

test("Require Protection allows manual market order without pre-entry stop loss", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    requireProtection: { enabled: true, mode: "stop_loss_required" },
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.reasonCode, undefined);
});

test("Require Protection allows market order with valid stop loss context", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    requireProtection: { enabled: true, mode: "stop_loss_required" },
    tradePlan: { entry: 100, stop: 95, symbol: "BTC-USD", target: 115 },
  });

  assert.equal(result.decision, "allowed");
});

test("Require Protection is retired and no longer blocks limit orders", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "limit_order",
    nextOrder: { reduceOnly: false, side: "long", size: 1 },
    requireProtection: { enabled: true, mode: "stop_loss_required" },
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.reasonCode, undefined);
});

test("Require Protection is retired and no longer blocks order zone or trigger entries", () => {
  for (const actionType of ["order_zone_create", "trigger_market_order"] as const) {
    const result = evaluateDisciplineRiskGate({
      ...baseInput,
      actionType,
      requireProtection: { enabled: true, mode: "stop_loss_required" },
      source: actionType === "trigger_market_order" ? "trigger" : "order_zone",
    });

    assert.equal(result.decision, "allowed");
    assert.equal(result.reasonCode, undefined);
  }
});

test("Require Protection is retired and no longer blocks reverse new-side exposure", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "reverse_position",
    requireProtection: { enabled: true, mode: "stop_loss_required" },
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.reasonCode, undefined);
});

test("Require Protection sl_and_tp mode is ignored after retirement", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    requireProtection: { enabled: true, mode: "sl_and_tp_required" },
    tradePlan: { entry: 100, stop: 95, symbol: "BTC-USD", target: 100 },
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.reasonCode, undefined);
});

test("manual limit order is blocked during cooldown", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "limit_order",
    orderType: "limit",
    side: "long",
    tracking: {
      ...baseInput.tracking,
      cooldownRemainingMs: 15_000,
    },
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "cooldown_active");
});

test("order zone ladder is blocked when trade cap would be exceeded", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "order_zone_create",
    requestedTrades: 3,
    source: "order_zone",
    rules: {
      ...baseInput.rules,
      maxTradesPerDay: 4,
    },
    tracking: {
      ...baseInput.tracking,
      tradesPlacedToday: 2,
    },
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "max_trades_per_day_hit");
  assert.equal(result.message, "Trade blocked. Max trades per day reached.");
});

test("trigger-based risk-increasing execution is blocked", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "trigger_market_order",
    source: "trigger",
    rules: {
      ...baseInput.rules,
      maxDailyLoss: 100,
    },
    tracking: {
      ...baseInput.tracking,
      realizedPnlToday: -125,
    },
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "max_daily_loss_hit");
});

test("Magic Trade open-position is blocked by Discipline", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "magic_trade_open_position",
    source: "magic_trade",
    tracking: {
      ...baseInput.tracking,
      cooldownRemainingMs: 1,
    },
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "cooldown_active");
});

test("risk-increasing market order is blocked during active blocked time window", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    blockedTimeWindowActive: true,
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "blocked_time_window_active");
  assert.equal(result.message, "Trade blocked. This time window is locked by your Discipline Plan.");
});

test("Magic Trade live risk-reducing action is allowed during Discipline lock", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "magic_trade_risk_reducing",
    source: "magic_trade",
    tracking: {
      ...baseInput.tracking,
      cooldownRemainingMs: 60_000,
    },
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.riskDirection, "risk_reducing");
});

test("Magic Trade risk-reducing action is allowed during active blocked time window", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "magic_trade_risk_reducing",
    blockedTimeWindowActive: true,
    source: "magic_trade",
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.riskDirection, "risk_reducing");
});

test("trigger risk-increasing execution is blocked during active blocked time window", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "trigger_market_order",
    blockedTimeWindowActive: true,
    source: "trigger",
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "blocked_time_window_active");
});

test("close reduce and break-even are allowed during Discipline lock", () => {
  for (const actionType of ["close_position", "reduce_position", "break_even"] as const) {
    const result = evaluateDisciplineRiskGate({
      ...baseInput,
      actionType,
      tracking: {
        ...baseInput.tracking,
        cooldownRemainingMs: 60_000,
      },
    });

    assert.equal(result.decision, "allowed");
    assert.equal(result.riskDirection, "risk_reducing");
  }
});

test("reverse position is blocked when new exposure is blocked", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "reverse_position",
    rules: {
      ...baseInput.rules,
      maxDailyLoss: 100,
    },
    tracking: {
      ...baseInput.tracking,
      realizedPnlToday: -100,
    },
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.riskDirection, "risk_increasing");
  assert.equal(result.message, "Reverse blocked. Discipline does not allow new exposure right now.");
});

test("reverse position is blocked during active blocked time window", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "reverse_position",
    blockedTimeWindowActive: true,
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "blocked_time_window_active");
  assert.equal(result.message, "Reverse blocked. Discipline does not allow new exposure right now.");
});

test("batch modify that increases exposure is gated", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "zone_order_update",
    existingOrders: [{ id: "a", size: 1 }],
    nextOrders: [{ id: "a", size: 1.25 }],
    rules: {
      ...baseInput.rules,
      maxTradesPerDay: 1,
    },
    tracking: {
      ...baseInput.tracking,
      tradesPlacedToday: 1,
    },
  });

  assert.equal(classifyTradeActionRisk(result.input).riskDirection, "risk_increasing");
  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "max_trades_per_day_hit");
});

test("batch modify that only reduces exposure is allowed", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "zone_order_update",
    existingOrders: [
      { id: "a", size: 1 },
      { id: "b", size: 1 },
    ],
    nextOrders: [{ id: "a", size: 0.75 }],
    tracking: {
      ...baseInput.tracking,
      cooldownRemainingMs: 60_000,
    },
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.riskDirection, "risk_reducing");
});

test("unknown risk-changing action is blocked", () => {
  const result = evaluateDisciplineRiskGate({
    ...baseInput,
    actionType: "unknown",
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.riskDirection, "unknown");
  assert.equal(result.reasonCode, "unknown_risk_action");
});

test("blocked Discipline decision creates a specific log entry", () => {
  const decision = evaluateDisciplineRiskGate({
    ...baseInput,
    tracking: {
      ...baseInput.tracking,
      cooldownRemainingMs: 60_000,
    },
  });
  const logEntry = createDisciplineRiskGateLogEntry(decision);

  assert.equal(logEntry.category, "discipline");
  assert.equal(logEntry.eventType, "discipline-rule-blocked");
  assert.equal(logEntry.reasonCode, "cooldown_active");
  assert.equal(logEntry.riskDirection, "risk_increasing");
  assert.equal(logEntry.description, "Trade blocked. Cooldown is still active.");
});
