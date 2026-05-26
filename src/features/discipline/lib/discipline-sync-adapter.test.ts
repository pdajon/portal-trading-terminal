import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDisciplineSyncPayload,
  createEmptyDisciplineTracking,
  DEFAULT_DISCIPLINE_RULES,
  DEFAULT_MARKET_ENTRY_CONFIRMATION_CLIENT_RULE,
  DEFAULT_OVERRIDE_BOND_CONFIG,
  DEFAULT_REQUIRE_PROTECTION_CLIENT_RULE,
  getActiveDisciplineRuleCount,
  getDisciplineServerRuleTypeForClientRule,
  getFreshDisciplineTracking,
  getHardLockActive,
  normalizeServerDisciplineSnapshot,
  resolveBlockedTimeWindowStates,
  resolveDisciplineWorkspaceStatusLabel,
  sanitizeDisciplineRules,
} from "./discipline-sync-adapter";

test("normalizes server Discipline snapshots through one shared contract", () => {
  const snapshot = normalizeServerDisciplineSnapshot(
    {
      blockedTimeWindows: [
        {
          enabled: true,
          endTime: "11:00",
          id: "ny-open",
          source: "operator_diagnosis",
          startTime: "09:30",
          state: "locked",
          timezone: "America/New_York",
        },
      ],
      marketEntryConfirmation: {
        enabled: true,
        mode: "confirm_required",
        state: "locked",
      },
      noTradeZones: [
        {
          bottomPrice: 100,
          id: "zone-1",
          isNoTrade: true,
          symbol: "SOL-USD",
          topPrice: 110,
        },
        {
          bottomPrice: Number.NaN,
          id: "bad-zone",
          isNoTrade: true,
          symbol: "BTC-USD",
          topPrice: 10,
        },
      ],
      overrideBondConfigs: {
        cooldownAfterLossMinutes: {
          baseAmountUsdc: 50,
          enabled: true,
          label: "heavy",
        },
      },
      requireProtection: {
        enabled: true,
        mode: "sl_and_tp_required",
        state: "locked",
      },
      ruleStates: {
        blockedTimeWindows: {
          "ny-open": { state: "overridden" },
        },
      },
      rules: {
        cooldownAfterLossMinutes: 15.8,
        maxDailyLoss: 250,
        maxTradesPerDay: 4.9,
        minRiskReward: 2.25,
      },
      tracking: {
        cooldownRemainingMs: 999,
        dayKey: "2026-05-09",
        lastLosingTradeAt: "2026-05-09T12:00:00.000Z",
        realizedPnlToday: -125.5,
        tradesPlacedToday: 2.6,
      },
      version: 7.2,
    },
    new Date("2026-05-09T00:00:00.000Z"),
  );

  assert.equal(snapshot.nextVersion, 7);
  assert.equal(snapshot.minRiskReward, null);
  assert.deepEqual(snapshot.rules, {
    blockedTimeWindows: [
      {
        daysOfWeek: undefined,
        enabled: true,
        endTime: "11:00",
        id: "ny-open",
        label: undefined,
        source: "operator_diagnosis",
        sourceFindingId: undefined,
        startTime: "09:30",
        state: "locked",
        timezone: "America/New_York",
      },
    ],
    cooldownAfterLossMinutes: 15,
    marketEntryConfirmation: {
      enabled: false,
      mode: "confirm_required",
      state: "inactive",
    },
    maxDailyLoss: 250,
    maxTradesPerDay: 4,
    requireProtection: {
      enabled: false,
      mode: "stop_loss_required",
      state: "inactive",
    },
  });
  assert.deepEqual(snapshot.overrideBondConfig, {
    baseAmountUsdc: 50,
    enabled: true,
    label: "heavy",
  });
  assert.deepEqual(snapshot.tracking, {
    cooldownRemainingMs: 0,
    dayKey: "2026-05-09",
    lastLosingTradeAt: "2026-05-09T12:00:00.000Z",
    realizedPnlToday: -125.5,
    tradesPlacedToday: 2,
  });
  assert.deepEqual(snapshot.noTradeZones, [
    {
      bottomPrice: 100,
      createdAt: "2026-05-09T00:00:00.000Z",
      id: "zone-1",
      isNoTrade: true,
      lastInteraction: "server-discipline-sync",
      source: "context-menu-drag",
      state: "idle",
      symbol: "SOL-USD",
      topPrice: 110,
    },
  ]);
});

test("builds the server Discipline sync payload consistently for shell flows", () => {
  const payload = buildDisciplineSyncPayload({
    activeTradePlan: {
      entry: 100,
      id: "plan-1",
      stop: 95,
      symbol: "ETH-USD",
      target: 115,
    },
    chartZones: [
      {
        bottomPrice: 90,
        id: "zone-1",
        isNoTrade: true,
        symbol: "ETH-USD",
        topPrice: 92,
      },
      {
        bottomPrice: 88,
        id: "trade-zone",
        isNoTrade: false,
        symbol: "ETH-USD",
        topPrice: 89,
      },
    ],
    disciplineLocked: true,
    minRiskReward: 2,
    overrideBondConfig: { baseAmountUsdc: 25, enabled: true, label: "serious" },
    pendingLimitOrders: [
      {
        direction: "long",
        id: "order-live",
        normalizedSize: 0.5,
        orderId: 123,
        reduceOnly: false,
        status: "live",
        symbol: "ETH-USD",
      },
      {
        direction: "short",
        id: "order-filled",
        normalizedSize: 1,
        orderId: 456,
        reduceOnly: true,
        status: "filled",
        symbol: "ETH-USD",
      },
    ],
    rules: {
      ...DEFAULT_DISCIPLINE_RULES,
      requireProtection: { enabled: true, mode: "stop_loss_required" },
    },
    tracking: {
      cooldownRemainingMs: 0,
      dayKey: "2026-05-09",
      lastLosingTradeAt: null,
      realizedPnlToday: 0,
      tradesPlacedToday: 1,
    },
    updatedAt: "2026-05-09T15:00:00.000Z",
    version: 4,
  });

  assert.equal(payload.source, "client_sync");
  assert.equal(payload.syncIntent, "rule_update");
  assert.equal(payload.version, 4);
  assert.equal(payload.disciplineLocked, true);
  assert.deepEqual(payload.noTradeZones, [
    {
      bottomPrice: 90,
      id: "zone-1",
      isNoTrade: true,
      symbol: "ETH-USD",
      topPrice: 92,
    },
  ]);
  assert.deepEqual(payload.pendingOrders, [
    {
      id: "order-live",
      orderId: 123,
      reduceOnly: false,
      side: "long",
      size: 0.5,
      symbol: "ETH-USD",
    },
  ]);
  assert.deepEqual(payload.marketEntryConfirmation, DEFAULT_MARKET_ENTRY_CONFIRMATION_CLIENT_RULE);
  assert.deepEqual(payload.requireProtection, DEFAULT_REQUIRE_PROTECTION_CLIENT_RULE);
  assert.deepEqual(payload.overrideBondConfigs?.requireProtection, DEFAULT_OVERRIDE_BOND_CONFIG);
});

test("derives Discipline status and rule counts without app-shell-specific state", () => {
  const rules = sanitizeDisciplineRules({
    blockedTimeWindows: [
      {
        enabled: true,
        endTime: "23:59",
        id: "locked-window",
        startTime: "00:00",
        state: "locked",
      },
    ],
    cooldownAfterLossMinutes: 30,
    marketEntryConfirmation: {
      enabled: true,
      mode: "confirm_required",
      state: "active",
    },
    requireProtection: {
      enabled: true,
      mode: "stop_loss_required",
      state: "active",
    },
  });
  const blockedWindowStates = resolveBlockedTimeWindowStates(rules, {
    blockedTimeWindows: {
      "locked-window": { state: "overridden" },
    },
  });

  assert.equal(getActiveDisciplineRuleCount(rules, 2), 2);
  assert.equal(blockedWindowStates[0]?.state, "overridden");
  assert.equal(resolveDisciplineWorkspaceStatusLabel(true, rules, 2), "Blocked");
  assert.equal(resolveDisciplineWorkspaceStatusLabel(false, DEFAULT_DISCIPLINE_RULES, null), "Off");
  assert.equal(
    getHardLockActive({
      activeBlockedTimeWindow: blockedWindowStates.find((rule) => rule.state === "locked") ?? null,
      activeTradePlan: null,
      cooldownRemainingMs: 0,
      disciplineCurrentlyBlocked: false,
      minRiskReward: 2,
      rules,
      tracking: createEmptyDisciplineTracking("2026-05-09"),
    }),
    false,
  );
});

test("refreshes daily tracking and maps client rule keys to server rule types", () => {
  assert.equal(
    getDisciplineServerRuleTypeForClientRule("blockedTimeWindows"),
    "blocked_time_window",
  );
  assert.equal(
    getDisciplineServerRuleTypeForClientRule("marketEntryConfirmation"),
    "market_entry_confirmation",
  );
  assert.deepEqual(
    getFreshDisciplineTracking(
      {
        cooldownRemainingMs: 999,
        dayKey: "2026-05-08",
        lastLosingTradeAt: "2026-05-08T22:00:00.000Z",
        realizedPnlToday: -300,
        tradesPlacedToday: 8,
      },
      DEFAULT_DISCIPLINE_RULES,
      {
        now: new Date("2026-05-09T12:00:00.000Z"),
        todayKey: "2026-05-09",
      },
    ),
    {
      cooldownRemainingMs: 0,
      dayKey: "2026-05-09",
      lastLosingTradeAt: null,
      realizedPnlToday: 0,
      tradesPlacedToday: 0,
    },
  );
});
