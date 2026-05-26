import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { POST as executePost } from "@/app/api/execute/route";
import { POST as limitOrderPost } from "@/app/api/limit-order/route";
import { POST as orderZonePost } from "@/app/api/order-zone/route";
import { POST as reversePositionPost } from "@/app/api/reverse-position/route";
import { POST as updateZoneOrdersPost } from "@/app/api/update-zone-orders/route";
import { POST as overrideBondPost } from "@/app/api/discipline/override-bond/route";
import { PUT as disciplineStatePut } from "@/app/api/discipline/state/route";
import {
  getOverrideBondMultiplier,
  readOverrideBondLedger,
} from "@/features/discipline/lib/override-bond-ledger";
import {
  evaluateDisciplineRiskGate,
  type DisciplineRiskGateInput,
} from "@/features/discipline/lib/discipline-risk-gate";
import {
  evaluateServerDisciplineRiskGateWithState,
} from "@/features/discipline/lib/discipline-server-gate";
import {
  createDefaultServerDisciplineState,
  deriveServerDisciplineRuleStates,
  readServerDisciplineState,
  syncServerDisciplineState,
  writeServerDisciplineState,
  type ServerDisciplineState,
} from "@/features/discipline/lib/discipline-server-state";

test("direct /api/execute risk-increasing request is blocked during cooldown", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const response = await executePost(jsonRequest("/api/execute", {
      baseSize: 0.001,
      executionId: "exec-test",
      side: "long",
      symbol: "BTC-USD",
    }));
    const payload = await response.json() as DisciplineBlockedPayload;

    assert.equal(response.status, 403);
    assert.equal(payload.discipline.reasonCode, "cooldown_active");
    assert.equal(payload.discipline.riskDirection, "risk_increasing");
  });
});

test("server gate allows manual market entry when protection can only be attached after fill", () => {
  const result = evaluateServerDisciplineRiskGateWithState(requireProtectionState(), {
    actionType: "market_order",
    orderType: "market",
    requestedTrades: 1,
    side: "long",
    size: 0.001,
    source: "manual",
    symbol: "BTC-USD",
  });

  assert.equal(result.decision, "allowed");
});

test("server gate no longer blocks Market Entry Confirmation market entry", () => {
  const result = evaluateServerDisciplineRiskGateWithState(marketEntryConfirmationState(), {
    actionType: "market_order",
    orderType: "market",
    requestedTrades: 1,
    side: "long",
    size: 0.001,
    source: "manual",
    symbol: "BTC-USD",
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.reasonCode, undefined);
});

test("confirmed server gate allows Market Entry Confirmation market entry", () => {
  const result = evaluateServerDisciplineRiskGateWithState(marketEntryConfirmationState(), {
    actionType: "market_order",
    confirmedDisciplineWarnings: ["market_entry_confirmation_required"],
    orderType: "market",
    requestedTrades: 1,
    side: "long",
    size: 0.001,
    source: "manual",
    symbol: "BTC-USD",
  });

  assert.equal(result.decision, "allowed");
});

test("direct /api/execute with stop loss context passes Require Protection gate", async () => {
  await withServerDisciplineState(requireProtectionState(), async () => {
    const result = evaluateServerDisciplineRiskGateWithState(await readServerDisciplineState(), {
      actionType: "market_order",
      orderType: "market",
      protectionContext: { stopLoss: 95_000 },
      requestedTrades: 1,
      side: "long",
      size: 0.001,
      source: "manual",
      symbol: "BTC-USD",
    });

    assert.equal(result.decision, "allowed");
  });
});

test("direct /api/limit-order request is blocked during cooldown", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const response = await limitOrderPost(jsonRequest("/api/limit-order", {
      placementId: "limit-test",
      price: 100_000,
      side: "long",
      size: 0.001,
      symbol: "BTC-USD",
    }));
    const payload = await response.json() as DisciplineBlockedPayload;

    assert.equal(response.status, 403);
    assert.equal(payload.discipline.reasonCode, "cooldown_active");
  });
});

test("server gate no longer blocks limit orders through Require Protection", () => {
  const result = evaluateServerDisciplineRiskGateWithState(requireProtectionState(), {
    actionType: "limit_order",
    nextOrder: { reduceOnly: false, side: "long", size: 0.001 },
    orderType: "limit",
    requestedTrades: 1,
    side: "long",
    size: 0.001,
    source: "manual",
    symbol: "BTC-USD",
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.reasonCode, undefined);
});

test("direct /api/order-zone request is blocked when trade cap would be exceeded", async () => {
  await withServerDisciplineState({
    ...createDefaultServerDisciplineState(),
    rules: {
      cooldownAfterLossMinutes: null,
      maxDailyLoss: null,
      maxTradesPerDay: 3,
      minRiskReward: null,
    },
    tracking: {
      cooldownRemainingMs: 0,
      dayKey: todayKey(),
      lastLosingTradeAt: null,
      realizedPnlToday: 0,
      tradesPlacedToday: 2,
    },
  }, async () => {
    const response = await orderZonePost(jsonRequest("/api/order-zone", {
      direction: "long",
      distribution: "even",
      orders: [
        { placementId: "zone-1", price: 99_500, size: 0.001 },
        { placementId: "zone-2", price: 99_000, size: 0.001 },
      ],
      symbol: "BTC-USD",
    }));
    const payload = await response.json() as DisciplineBlockedPayload;

    assert.equal(response.status, 403);
    assert.equal(payload.discipline.reasonCode, "max_trades_per_day_hit");
  });
});

test("direct /api/reverse-position request is blocked when new exposure is blocked", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const response = await reversePositionPost(jsonRequest("/api/reverse-position", {
      symbol: "BTC-USD",
    }));
    const payload = await response.json() as DisciplineBlockedPayload;

    assert.equal(response.status, 403);
    assert.equal(payload.discipline.reasonCode, "cooldown_active");
    assert.equal(payload.discipline.message, "Reverse blocked. Discipline does not allow new exposure right now.");
  });
});

test("direct /api/update-zone-orders request is blocked when increasing exposure during lock", async () => {
  await withServerDisciplineState({
    ...createDefaultServerDisciplineState(),
    disciplineLocked: true,
    pendingOrders: [{
      id: "local-zone-1",
      orderId: 101,
      side: "long",
      size: 0.001,
      symbol: "BTC-USD",
    }],
  }, async () => {
    const response = await updateZoneOrdersPost(jsonRequest("/api/update-zone-orders", {
      direction: "long",
      orders: [{
        currentPrice: 99_000,
        localOrderId: "local-zone-1",
        orderId: 101,
        price: 98_500,
        size: 0.002,
      }],
      symbol: "BTC-USD",
    }));
    const payload = await response.json() as DisciplineBlockedPayload;

    assert.equal(response.status, 403);
    assert.equal(payload.discipline.reasonCode, "discipline_locked");
  });
});

test("risk-reducing close reduce cancel and protection actions remain allowed during lock", () => {
  const state = {
    ...createDefaultServerDisciplineState(),
    disciplineLocked: true,
  };

  for (const actionType of ["close_position", "reduce_position", "cancel_order", "protection_update"] as const) {
    const result = evaluateServerDisciplineRiskGateWithState(state, {
      actionType,
      requestedTrades: 1,
      source: actionType === "protection_update" ? "protection" : "manual",
      symbol: "BTC-USD",
    });

    assert.equal(result.decision, "allowed");
    assert.equal(result.riskDirection, "risk_reducing");
  }
});

test("unknown risk action is blocked server-side", () => {
  const result = evaluateServerDisciplineRiskGateWithState(createDefaultServerDisciplineState(), {
    actionType: "unknown",
    requestedTrades: 1,
    source: "system",
    symbol: "BTC-USD",
  });

  assert.equal(result.decision, "blocked");
  assert.equal(result.reasonCode, "unknown_risk_action");
});

test("server and client gate return matching reason codes for the same Discipline state", () => {
  const state = cooldownState();
  const input: Omit<DisciplineRiskGateInput, "rules" | "tracking" | "tradePlan"> = {
    actionType: "market_order",
    orderType: "market",
    requestedTrades: 1,
    side: "long",
    size: 0.001,
    source: "manual",
    symbol: "BTC-USD",
  };
  const clientResult = evaluateDisciplineRiskGate({
    ...input,
    rules: state.rules,
    tracking: state.tracking,
    tradePlan: null,
  });
  const serverResult = evaluateServerDisciplineRiskGateWithState(state, input);

  assert.equal(serverResult.reasonCode, clientResult.reasonCode);
  assert.equal(serverResult.message, clientResult.message);
});

test("stale unblocked client sync cannot overwrite active server cooldown", async () => {
  await withServerDisciplineState({
    ...cooldownState(),
    version: 4,
  }, async () => {
    const response = await disciplineStatePut(jsonRequest("/api/discipline/state", {
      ...createDefaultServerDisciplineState(),
      syncIntent: "tracking_update",
      updatedAt: "2026-05-03T00:00:00.000Z",
      version: 3,
    }));
    const payload = await response.json() as DisciplineStateSyncPayload;
    const state = await readServerDisciplineState();

    assert.equal(payload.accepted, false);
    assert.equal(payload.reasonCode, "discipline_state_weaken_attempt");
    assert.equal(state.tracking.cooldownRemainingMs > 0, true);
    assert.equal(state.version, 4);
  });
});

test("client cannot clear server-side discipline_locked", async () => {
  await withServerDisciplineState({
    ...createDefaultServerDisciplineState(),
    disciplineLocked: true,
    version: 2,
  }, async () => {
    const result = await syncServerDisciplineState({
      ...createDefaultServerDisciplineState(),
      disciplineLocked: false,
      syncIntent: "tracking_update",
      version: 2,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "discipline_state_weaken_attempt");
    assert.equal(result.state.disciplineLocked, true);
  });
});

test("client cannot reduce trade count below server count", async () => {
  await withServerDisciplineState({
    ...createDefaultServerDisciplineState(),
    tracking: {
      cooldownRemainingMs: 0,
      dayKey: todayKey(),
      lastLosingTradeAt: null,
      realizedPnlToday: 0,
      tradesPlacedToday: 5,
    },
    version: 2,
  }, async () => {
    const result = await syncServerDisciplineState({
      tracking: {
        cooldownRemainingMs: 0,
        dayKey: todayKey(),
        lastLosingTradeAt: null,
        realizedPnlToday: 0,
        tradesPlacedToday: 1,
      },
      syncIntent: "tracking_update",
      version: 2,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.state.tracking.tradesPlacedToday, 5);
  });
});

test("client cannot reduce session loss below server loss when lock depends on it", async () => {
  await withServerDisciplineState({
    ...createDefaultServerDisciplineState(),
    rules: {
      cooldownAfterLossMinutes: null,
      maxDailyLoss: 50,
      maxTradesPerDay: null,
      minRiskReward: null,
    },
    tracking: {
      cooldownRemainingMs: 0,
      dayKey: todayKey(),
      lastLosingTradeAt: null,
      realizedPnlToday: -75,
      tradesPlacedToday: 0,
    },
    version: 2,
  }, async () => {
    const result = await syncServerDisciplineState({
      tracking: {
        cooldownRemainingMs: 0,
        dayKey: todayKey(),
        lastLosingTradeAt: null,
        realizedPnlToday: -10,
        tradesPlacedToday: 0,
      },
      syncIntent: "tracking_update",
      version: 2,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.state.tracking.realizedPnlToday, -75);
  });
});

test("client cannot clear active no-trade-zone lock through generic sync", async () => {
  await withServerDisciplineState({
    ...createDefaultServerDisciplineState(),
    noTradeZones: [{
      bottomPrice: 99_000,
      id: "server-zone",
      isNoTrade: true,
      symbol: "BTC-USD",
      topPrice: 101_000,
    }],
    version: 2,
  }, async () => {
    const result = await syncServerDisciplineState({
      noTradeZones: [],
      syncIntent: "tracking_update",
      version: 2,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.state.noTradeZones.length, 1);
  });
});

test("older client version is rejected against newer server version", async () => {
  await withServerDisciplineState({
    ...createDefaultServerDisciplineState(),
    version: 10,
  }, async () => {
    const result = await syncServerDisciplineState({
      ...createDefaultServerDisciplineState(),
      syncIntent: "rule_update",
      version: 9,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.serverVersion, 10);
    assert.equal(result.clientVersion, 9);
  });
});

test("hydration is read-only and keeps stricter server lock", async () => {
  await withServerDisciplineState({
    ...cooldownState(),
    version: 2,
  }, async () => {
    const result = await syncServerDisciplineState({
      ...createDefaultServerDisciplineState(),
      syncIntent: "hydration",
      version: 2,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.state.tracking.cooldownRemainingMs > 0, true);
  });
});

test("risk-increasing direct API call remains blocked after stale client sync attempt", async () => {
  await withServerDisciplineState({
    ...cooldownState(),
    version: 8,
  }, async () => {
    await syncServerDisciplineState({
      ...createDefaultServerDisciplineState(),
      syncIntent: "tracking_update",
      version: 8,
    });

    const response = await executePost(jsonRequest("/api/execute", {
      baseSize: 0.001,
      executionId: "exec-after-stale-sync",
      side: "long",
      symbol: "BTC-USD",
    }));
    const payload = await response.json() as DisciplineBlockedPayload;

    assert.equal(response.status, 403);
    assert.equal(payload.discipline.reasonCode, "cooldown_active");
  });
});

test("direct /api/execute risk-increasing request is blocked during active blocked time window", async () => {
  await withServerDisciplineState(blockedWindowState(), async () => {
    const response = await executePost(jsonRequest("/api/execute", {
      baseSize: 0.001,
      executionId: "exec-window-block",
      side: "long",
      symbol: "BTC-USD",
    }));
    const payload = await response.json() as DisciplineBlockedPayload;

    assert.equal(response.status, 403);
    assert.equal(payload.discipline.reasonCode, "blocked_time_window_active");
    assert.equal(payload.discipline.message, "Trade blocked. You underperform during this time window.");
  });
});

test("close-style risk-reducing gate action is allowed during active blocked time window", () => {
  const result = evaluateServerDisciplineRiskGateWithState(blockedWindowState(), {
    actionType: "close_position",
    source: "manual",
    symbol: "BTC-USD",
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.riskDirection, "risk_reducing");
});

test("client cannot remove active locked blocked time window rule", async () => {
  await withServerDisciplineState(blockedWindowState(), async () => {
    const currentState = await readServerDisciplineState();
    const result = await syncServerDisciplineState({
      blockedTimeWindows: [],
      syncIntent: "rule_update",
      version: currentState.version,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "locked_rule_cannot_be_weakened");
    assert.equal(result.overrideBondRequired, true);
    assert.equal(result.state.blockedTimeWindows.length, 1);
  });
});

test("Override Bond can override locked blocked time window rule", async () => {
  await withServerDisciplineState(blockedWindowState(), async () => {
    const response = await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
      ruleId: "window:test",
      ruleType: "blocked_time_window",
    }));
    const payload = await response.json() as OverrideBondPayload;
    const state = await readServerDisciplineState();

    assert.equal(response.status, 200);
    assert.equal(payload.accepted, true);
    assert.equal(state.ruleStates.blockedTimeWindows["window:test"]?.state, "overridden");
  });
});

test("cooldown running maps to locked", async () => {
  const state = await writeStateForTest(cooldownState());

  assert.equal(state.ruleStates.cooldownAfterLossMinutes.state, "locked");
});

test("active blocked time window maps to locked server state", () => {
  const state = deriveServerDisciplineRuleStates(blockedWindowState("09:00", "11:00"), {
    now: new Date("2026-05-04T10:15:00"),
  });

  assert.equal(state.blockedTimeWindows["window:test"]?.state, "locked");
});

test("outside enabled blocked time window maps to active server state", () => {
  const state = deriveServerDisciplineRuleStates(blockedWindowState("09:00", "11:00"), {
    now: new Date("2026-05-04T12:15:00"),
  });

  assert.equal(state.blockedTimeWindows["window:test"]?.state, "active");
});

test("max daily loss hit maps to locked", async () => {
  const state = deriveServerDisciplineRuleStates({
    ...createDefaultServerDisciplineState(),
    rules: {
      cooldownAfterLossMinutes: null,
      maxDailyLoss: 50,
      maxTradesPerDay: null,
      minRiskReward: null,
    },
    tracking: {
      cooldownRemainingMs: 0,
      dayKey: todayKey(),
      lastLosingTradeAt: null,
      realizedPnlToday: -50,
      tradesPlacedToday: 0,
    },
  });

  assert.equal(state.maxDailyLoss.state, "locked");
});

test("max trades reached maps to locked", () => {
  const state = deriveServerDisciplineRuleStates({
    ...createDefaultServerDisciplineState(),
    rules: {
      cooldownAfterLossMinutes: null,
      maxDailyLoss: null,
      maxTradesPerDay: 3,
      minRiskReward: null,
    },
    tracking: {
      cooldownRemainingMs: 0,
      dayKey: todayKey(),
      lastLosingTradeAt: null,
      realizedPnlToday: 0,
      tradesPlacedToday: 3,
    },
  });

  assert.equal(state.maxTradesPerDay.state, "locked");
});

test("min R:R failed maps to locked", () => {
  const state = deriveServerDisciplineRuleStates({
    ...createDefaultServerDisciplineState(),
    activeTradePlan: {
      entry: 100,
      id: "plan-1",
      stop: 95,
      symbol: "BTC-USD",
      target: 106,
    },
    rules: {
      cooldownAfterLossMinutes: null,
      maxDailyLoss: null,
      maxTradesPerDay: null,
      minRiskReward: 2,
    },
  });

  assert.equal(state.minRiskReward.state, "locked");
});

test("active no-trade zone maps to locked", () => {
  const state = deriveServerDisciplineRuleStates({
    ...createDefaultServerDisciplineState(),
    noTradeZones: [{
      bottomPrice: 99_000,
      id: "zone-locked",
      isNoTrade: true,
      symbol: "BTC-USD",
      topPrice: 101_000,
    }],
  }, {
    prices: [100_000],
    symbol: "BTC-USD",
  });

  assert.equal(state.noTradeZones["zone-locked"]?.state, "locked");
});

test("enabled but not triggered rules map to active", () => {
  const state = deriveServerDisciplineRuleStates({
    ...createDefaultServerDisciplineState(),
    noTradeZones: [{
      bottomPrice: 99_000,
      id: "zone-active",
      isNoTrade: true,
      symbol: "BTC-USD",
      topPrice: 101_000,
    }],
    rules: {
      cooldownAfterLossMinutes: 10,
      maxDailyLoss: 50,
      maxTradesPerDay: 3,
      minRiskReward: 2,
    },
    tracking: {
      cooldownRemainingMs: 0,
      dayKey: todayKey(),
      lastLosingTradeAt: null,
      realizedPnlToday: 0,
      tradesPlacedToday: 0,
    },
  }, {
    prices: [95_000],
    symbol: "BTC-USD",
  });

  assert.equal(state.cooldownAfterLossMinutes.state, "active");
  assert.equal(state.maxDailyLoss.state, "active");
  assert.equal(state.maxTradesPerDay.state, "active");
  assert.equal(state.minRiskReward.state, "active");
  assert.equal(state.noTradeZones["zone-active"]?.state, "active");
});

test("near no-trade zone maps to armed", () => {
  const state = deriveServerDisciplineRuleStates({
    ...createDefaultServerDisciplineState(),
    noTradeZones: [{
      bottomPrice: 99_000,
      id: "zone-armed",
      isNoTrade: true,
      symbol: "BTC-USD",
      topPrice: 101_000,
    }],
  }, {
    prices: [98_600],
    symbol: "BTC-USD",
  });

  assert.equal(state.noTradeZones["zone-armed"]?.state, "armed");
});

test("locked rule cannot be disabled", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const currentState = await readServerDisciplineState();
    const result = await syncServerDisciplineState({
      rules: {
        ...currentState.rules,
        cooldownAfterLossMinutes: null,
      },
      syncIntent: "rule_update",
      version: currentState.version,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "locked_rule_cannot_be_weakened");
    assert.equal(result.message, "Rule locked. Override Bond required to weaken this rule.");
    assert.equal(result.overrideBondRequired, true);
    assert.equal(result.overrideBondPreview?.baseAmountUsdc, 25);
    assert.equal(result.overrideBondPreview?.multiplier, 1);
    assert.equal(result.state.rules.cooldownAfterLossMinutes, 10);
  });
});

test("locked rule cannot be weakened", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const currentState = await readServerDisciplineState();
    const result = await syncServerDisciplineState({
      rules: {
        ...currentState.rules,
        cooldownAfterLossMinutes: 5,
      },
      syncIntent: "rule_update",
      version: currentState.version,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "locked_rule_cannot_be_weakened");
    assert.equal(result.state.rules.cooldownAfterLossMinutes, 10);
  });
});

test("locked rule can be strengthened", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const currentState = await readServerDisciplineState();
    const result = await syncServerDisciplineState({
      rules: {
        ...currentState.rules,
        cooldownAfterLossMinutes: 20,
      },
      syncIntent: "rule_update",
      version: currentState.version,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.state.rules.cooldownAfterLossMinutes, 20);
    assert.equal(result.state.ruleStates.cooldownAfterLossMinutes.state, "locked");
  });
});

test("stale client cannot overwrite locked server rule state", async () => {
  await withServerDisciplineState({
    ...cooldownState(),
    version: 8,
  }, async () => {
    const result = await syncServerDisciplineState({
      ...createDefaultServerDisciplineState(),
      syncIntent: "rule_update",
      version: 7,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.state.ruleStates.cooldownAfterLossMinutes.state, "locked");
  });
});

test("overridden state is supported in schema but not reachable yet", async () => {
  const state = await writeStateForTest({
    ...createDefaultServerDisciplineState(),
    ruleStates: {
      ...createDefaultServerDisciplineState().ruleStates,
      maxDailyLoss: {
        ruleType: "max_daily_loss",
        state: "overridden",
      },
    },
  });

  assert.equal(state.ruleStates.maxDailyLoss.state, "overridden");
});

test("posting a simulated Override Bond on a locked rule succeeds and marks it overridden", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const response = await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
      ruleType: "cooldown_after_loss",
    }));
    const payload = await response.json() as OverrideBondPayload;
    const state = await readServerDisciplineState();

    assert.equal(response.status, 200);
    assert.equal(payload.accepted, true);
    assert.equal(payload.ruleState, "overridden");
    assert.equal(payload.bond.baseAmountUsdc, 25);
    assert.equal(payload.bond.multiplier, 1);
    assert.equal(payload.bond.finalAmountUsdc, 25);
    assert.equal(state.ruleStates.cooldownAfterLossMinutes.state, "overridden");
  });
});

test("Override Bond respects user-selected base bond amount", async () => {
  await withServerDisciplineState({
    ...cooldownState(),
    overrideBondConfigs: {
      ...createDefaultServerDisciplineState().overrideBondConfigs,
      cooldownAfterLossMinutes: {
        enabled: true,
        baseAmountUsdc: 50,
        label: "heavy",
      },
    },
  }, async () => {
    const response = await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
      ruleType: "cooldown_after_loss",
    }));
    const payload = await response.json() as OverrideBondPayload;

    assert.equal(response.status, 200);
    assert.equal(payload.bond.baseAmountUsdc, 50);
    assert.equal(payload.bond.finalAmountUsdc, 50);
  });
});

test("Override Bond escalation uses 1x, 2x, 3x, then 5x", async () => {
  assert.deepEqual(
    [0, 1, 2, 3, 9].map(getOverrideBondMultiplier),
    [1, 2, 3, 5, 5],
  );

  await withServerDisciplineState(cooldownState(), async () => {
    const multipliers: number[] = [];

    for (let index = 0; index < 4; index += 1) {
      await writeServerDisciplineState(cooldownState());
      const response = await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
        ruleType: "cooldown_after_loss",
      }));
      const payload = await response.json() as OverrideBondPayload;
      multipliers.push(payload.bond.multiplier);
    }

    assert.deepEqual(multipliers, [1, 2, 3, 5]);
  });
});

test("Override Bond split accounting is 70 percent vault, 20 percent Portal, 10 percent reserve", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const response = await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
      ruleType: "cooldown_after_loss",
    }));
    const payload = await response.json() as OverrideBondPayload;

    assert.equal(payload.bond.vaultAmountUsdc, 17.5);
    assert.equal(payload.bond.portalAmountUsdc, 5);
    assert.equal(payload.bond.reserveAmountUsdc, 2.5);
  });
});

test("Override Bond writes a simulated ledger entry and Session Log payload", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const response = await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
      ruleType: "cooldown_after_loss",
      walletAddress: "0xabc",
    }));
    const payload = await response.json() as OverrideBondPayload;
    const ledger = await readOverrideBondLedger();
    const entry = ledger[0];

    assert.equal(response.status, 200);
    assert.equal(ledger.length, 1);
    assert.equal(entry.ruleType, "cooldown_after_loss");
    assert.equal(entry.source, "simulated");
    assert.equal(entry.status, "posted");
    assert.equal(entry.walletAddress, "0xabc");
    assert.equal(entry.finalAmountUsdc, 25);
    assert.equal(Object.hasOwn(entry, "transactionHash"), false);
    assert.equal(Object.hasOwn(entry, "reason"), false);
    assert.equal(payload.sessionLogEntry.eventType, "discipline-override-bond-posted");
    assert.equal(payload.sessionLogEntry.metadata.reasonRequired, false);
    assert.equal(payload.sessionLogEntry.metadata.source, "simulated");
    assert.equal(payload.sessionLogEntry.message, "Override Bond posted. Rule overridden.");
  });
});

test("posting Override Bond on non-locked rule is rejected", async () => {
  await withServerDisciplineState(createDefaultServerDisciplineState(), async () => {
    const response = await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
      ruleType: "cooldown_after_loss",
    }));
    const payload = await response.json() as OverrideBondPayload;

    assert.equal(response.status, 409);
    assert.equal(payload.accepted, false);
    assert.equal(payload.reasonCode, "override_bond_not_required");
  });
});

test("server lock protection remains until Override Bond is posted", async () => {
  await withServerDisciplineState(cooldownState(), async () => {
    const currentState = await readServerDisciplineState();
    const beforeBond = await syncServerDisciplineState({
      rules: {
        ...currentState.rules,
        cooldownAfterLossMinutes: null,
      },
      syncIntent: "rule_update",
      version: currentState.version,
    });

    assert.equal(beforeBond.accepted, false);
    assert.equal(beforeBond.reasonCode, "locked_rule_cannot_be_weakened");

    await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
      ruleType: "cooldown_after_loss",
    }));

    const afterBondState = await readServerDisciplineState();
    const afterBond = await syncServerDisciplineState({
      rules: {
        ...afterBondState.rules,
        cooldownAfterLossMinutes: null,
      },
      syncIntent: "rule_update",
      version: afterBondState.version,
    });

    assert.equal(afterBond.accepted, true);
    assert.equal(afterBond.state.rules.cooldownAfterLossMinutes, null);
    assert.equal(afterBond.state.ruleStates.cooldownAfterLossMinutes.state, "overridden");
  });
});

test("Override Bond allows intended edit when global discipline lock was set", async () => {
  await withServerDisciplineState({
    ...cooldownState(),
    disciplineLocked: true,
  }, async () => {
    await overrideBondPost(jsonRequest("/api/discipline/override-bond", {
      ruleType: "cooldown_after_loss",
    }));

    const afterBondState = await readServerDisciplineState();
    const afterBond = await syncServerDisciplineState({
      disciplineLocked: false,
      rules: {
        ...afterBondState.rules,
        cooldownAfterLossMinutes: null,
      },
      syncIntent: "rule_update",
      version: afterBondState.version,
    });

    assert.equal(afterBond.accepted, true);
    assert.equal(afterBond.state.disciplineLocked, false);
    assert.equal(afterBond.state.rules.cooldownAfterLossMinutes, null);
    assert.equal(afterBond.state.ruleStates.cooldownAfterLossMinutes.state, "overridden");
  });
});

type DisciplineBlockedPayload = {
  discipline: {
    message: string;
    reasonCode: string;
    riskDirection: string;
  };
};

type DisciplineStateSyncPayload = {
  accepted: boolean;
  reasonCode?: string;
};

type OverrideBondPayload = {
  accepted: boolean;
  bond: {
    baseAmountUsdc: number;
    finalAmountUsdc: number;
    multiplier: number;
    portalAmountUsdc: number;
    reserveAmountUsdc: number;
    vaultAmountUsdc: number;
  };
  reasonCode?: string;
  ruleState?: string;
  sessionLogEntry: {
    eventType: string;
    message: string;
    metadata: {
      reasonRequired: boolean;
      source: string;
    };
  };
};

async function writeStateForTest(state: ServerDisciplineState) {
  const previousPath = process.env.PORTAL_DISCIPLINE_STATE_PATH;
  const tempDirectory = await mkdtemp(join(tmpdir(), "portal-discipline-"));
  process.env.PORTAL_DISCIPLINE_STATE_PATH = join(tempDirectory, "discipline-state.json");

  try {
    return await writeServerDisciplineState(state);
  } finally {
    if (previousPath === undefined) {
      delete process.env.PORTAL_DISCIPLINE_STATE_PATH;
    } else {
      process.env.PORTAL_DISCIPLINE_STATE_PATH = previousPath;
    }

    await rm(tempDirectory, { force: true, recursive: true });
  }
}

function cooldownState(): ServerDisciplineState {
  return {
    ...createDefaultServerDisciplineState(),
    rules: {
      cooldownAfterLossMinutes: 10,
      maxDailyLoss: null,
      maxTradesPerDay: null,
      minRiskReward: null,
    },
    tracking: {
      cooldownRemainingMs: 60_000,
      dayKey: todayKey(),
      lastLosingTradeAt: new Date().toISOString(),
      realizedPnlToday: -25,
      tradesPlacedToday: 0,
    },
  };
}

function blockedWindowState(startTime = "00:00", endTime = "23:59"): ServerDisciplineState {
  return {
    ...createDefaultServerDisciplineState(),
    blockedTimeWindows: [{
      enabled: true,
      endTime,
      id: "window:test",
      label: "Weak morning window",
      source: "operator_diagnosis",
      sourceFindingId: "finding:time-window",
      startTime,
    }],
  };
}

function requireProtectionState(): ServerDisciplineState {
  return {
    ...createDefaultServerDisciplineState(),
    requireProtection: {
      enabled: true,
      mode: "stop_loss_required",
      source: "manual",
      state: "active",
    },
  };
}

function marketEntryConfirmationState(): ServerDisciplineState {
  return {
    ...createDefaultServerDisciplineState(),
    marketEntryConfirmation: {
      enabled: true,
      mode: "confirm_required",
      source: "operator_diagnosis",
      sourceFindingId: "finding:manual-entry",
      state: "active",
    },
  };
}

async function withServerDisciplineState(
  state: ServerDisciplineState,
  callback: () => Promise<void>,
) {
  const previousPath = process.env.PORTAL_DISCIPLINE_STATE_PATH;
  const previousLedgerPath = process.env.PORTAL_OVERRIDE_BOND_LEDGER_PATH;
  const tempDirectory = await mkdtemp(join(tmpdir(), "portal-discipline-"));
  process.env.PORTAL_DISCIPLINE_STATE_PATH = join(tempDirectory, "discipline-state.json");
  process.env.PORTAL_OVERRIDE_BOND_LEDGER_PATH = join(tempDirectory, "override-bond-ledger.json");

  try {
    await writeServerDisciplineState(state);
    await callback();
  } finally {
    if (previousPath === undefined) {
      delete process.env.PORTAL_DISCIPLINE_STATE_PATH;
    } else {
      process.env.PORTAL_DISCIPLINE_STATE_PATH = previousPath;
    }

    if (previousLedgerPath === undefined) {
      delete process.env.PORTAL_OVERRIDE_BOND_LEDGER_PATH;
    } else {
      process.env.PORTAL_OVERRIDE_BOND_LEDGER_PATH = previousLedgerPath;
    }

    await rm(tempDirectory, { force: true, recursive: true });
  }
}

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}
