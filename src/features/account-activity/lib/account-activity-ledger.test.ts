import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_ACTIVITY_FOOTER_TABS,
  aggregateAccountTradeHistoryByTime,
  buildAccountActivityLedger,
} from "./account-activity-ledger";
import type { LiveExchangePosition, PendingLimitOrder } from "@/types/trade";
import type { TagAlongRule } from "@/features/tag-along/lib/tag-along-rules";

test("ACCOUNT_ACTIVITY_FOOTER_TABS preserves the requested trading footer order", () => {
  assert.deepEqual(
    ACCOUNT_ACTIVITY_FOOTER_TABS.map((tab) => tab.id),
    [
      "trade",
      "positions",
      "open-orders",
      "trade-history",
      "funding-history",
      "order-history",
      "balances",
    ],
  );
  assert.equal(
    ACCOUNT_ACTIVITY_FOOTER_TABS.some((tab) => tab.label === "Protons"),
    false,
  );
});

test("buildAccountActivityLedger maps live positions, orders, balances, and session logs into footer rows", () => {
  const position: LiveExchangePosition = {
    direction: "long",
    entryPrice: 0.095071,
    fundingUsd: -0.24,
    leverageValue: 3,
    liquidationPrice: 0.066711,
    marginUsedUsd: 670.99,
    markPrice: 0.098275,
    pnlPercent: 10.1,
    pnlUsd: 65.63,
    positionValueUsd: 2012.97,
    protectionMissing: true,
    size: 20483,
    slStatus: "missing",
    stopPrice: null,
    symbol: "XPL-USD",
    targetPrice: null,
    tpOrderId: null,
    slOrderId: null,
    tpStatus: "missing",
  };
  const pendingOrder: PendingLimitOrder = {
    createdAt: "2026-05-13T18:20:00.000Z",
    direction: "short",
    id: "pending-1",
    normalizedPrice: 0.1012,
    normalizedSize: 1000,
    orderId: 123456,
    placementId: "placement-1",
    reduceOnly: true,
    requestedPrice: 0.101,
    requestedSize: 1000,
    source: "horizontal-line",
    status: "live",
    symbol: "XPL-USD",
  };

  const ledger = buildAccountActivityLedger({
    accountValue: 2400,
    accountBalances: [
      {
        availableBalance: 1200,
        availableBalanceDisplay: "1,200.00 USDC",
        coin: "USDC",
        coinLabel: "USDC (Perps)",
        contractLabel: "--",
        pnlPercent: null,
        pnlUsd: null,
        repayLabel: "--",
        sendLabel: "Not available in your jurisdiction",
        totalBalance: 2400,
        totalBalanceDisplay: "2,400.00 USDC",
        transferLabel: "Transfer to Spot",
        usdValue: 2400,
      },
    ],
    accountFundingHistory: [
      {
        coin: "XPL",
        hash: "0xfunding",
        paymentUsdc: -0.0002,
        rate: 0.000013,
        size: 20483,
        time: "2026-05-15T06:00:00.000Z",
      },
    ],
    activeSymbol: "XPL-USD",
    availableToTrade: 1200,
    availableToTradeBySide: { long: 1150, short: 1125 },
    livePendingOrders: [
      {
        createdAt: "2026-05-13T18:21:00.000Z",
        direction: "short",
        orderId: 987654,
        originalSize: 750,
        price: 0.09,
        reduceOnly: true,
        size: 750,
        status: "live",
        symbol: "XPL-USD",
        triggerCondition: "Price below stop",
        triggerPrice: 0.09,
        triggerType: "Stop Market",
      },
    ],
    pendingLimitOrders: [pendingOrder],
    positions: [position],
    sessionLogEntries: [
      {
        category: "positions",
        description: "Closed XPL long",
        direction: "long",
        eventType: "position-closed",
        id: "session-1",
        pnl: 42,
        price: 0.099,
        size: 900,
        source: "Trade",
        symbol: "XPL-USD",
        timestamp: "2026-05-13T18:25:00.000Z",
      },
      {
        category: "orders",
        description: "Placed XPL limit",
        direction: "short",
        eventType: "limit-order-placed",
        id: "session-log-1777941705740-0-5f407790-07c5-4f8c-a5ee-eccc65541299",
        pnl: null,
        price: 0.1012,
        size: 1000,
        source: "Limit Order",
        symbol: "XPL-USD",
        timestamp: "2026-05-13T18:26:00.000Z",
      },
      {
        category: "orders",
        description: "Canceled XPL order 123456.",
        direction: "short",
        eventType: "limit-order-canceled",
        id: "session-canceled-1",
        metadata: { orderId: 123456, reduceOnly: true },
        pnl: null,
        price: 0.1012,
        size: 1000,
        source: "Pending Order",
        symbol: "XPL-USD",
        timestamp: "2026-05-13T18:26:05.000Z",
      },
      {
        category: "orders",
        description: "Filled XPL close order",
        direction: "short",
        eventType: "market-order-placed",
        id: "session-2",
        pnl: null,
        price: 0.1,
        size: 250,
        source: "Market Order",
        symbol: "XPL-USD",
        timestamp: "2026-05-13T18:26:15.000Z",
      },
      {
        category: "orders",
        description: "Filled XPL close order",
        direction: "short",
        eventType: "pending-order-filled",
        id: "session-3",
        metadata: { reduceOnly: true },
        pnl: -12,
        price: 0.098,
        size: 500,
        source: "TP/SL",
        symbol: "XPL-USD",
        timestamp: "2026-05-13T18:26:30.000Z",
      },
      {
        category: "orders",
        description: "Magic Trade opened XPL testnet position",
        direction: "long",
        eventType: "TAG_ALONG_EXECUTED",
        id: "magic-1",
        pnl: null,
        price: 0.1,
        size: 250,
        source: "Magic Trade",
        symbol: "XPL-USD",
        timestamp: "2026-05-13T18:27:00.000Z",
      },
    ],
  });

  assert.equal(ledger.positions.rows[0]?.cells.coin, "XPL 3x");
  assert.equal(ledger.positions.rows[0]?.cells.actions, "Limit / Market / Reverse");
  assert.equal(ledger.positions.rows[0]?.cells.margin, "$670.99 (Cross)");
  assert.equal(ledger.positions.rows[0]?.direction, "long");
  assert.equal(ledger.positions.rows[0]?.symbol, "XPL-USD");
  assert.equal(ledger.positions.rows[0]?.cells.tpSl, "-- / --");
  assert.equal(ledger.positions.count, 1);
  assert.equal(ledger.positions.rows[0]?.share.coin, "XPL");
  assert.equal(ledger.positions.rows[0]?.share.direction, "Long 3x");
  assert.equal(ledger.positions.rows[0]?.share.pnlLabel, "+$65.63");
  assert.equal(ledger.openOrders.rows[0]?.cells.reduceOnly, "Yes");
  assert.equal(ledger.openOrders.rows[0]?.cells.direction, "Close Long");
  assert.equal(ledger.openOrders.rows[0]?.cells.size, "1,000");
  assert.equal(ledger.openOrders.rows[0]?.cells.originalSize, "1,000");
  assert.equal(ledger.openOrders.rows[0]?.cells.orderValue, "101.20 USDC");
  assert.match(ledger.openOrders.rows[0]?.cells.time ?? "", /2026/);
  assert.equal(ledger.openOrders.count, 2);
  assert.match(ledger.openOrders.rows[1]?.cells.time ?? "", /2026/);
  assert.equal(ledger.openOrders.rows[1]?.cells.type, "Stop Market");
  assert.equal(ledger.openOrders.rows[1]?.cells.size, "750");
  assert.equal(ledger.openOrders.rows[1]?.cells.originalSize, "750");
  assert.equal(ledger.openOrders.rows[1]?.cells.orderValue, "Market");
  assert.equal(ledger.openOrders.rows[1]?.cells.price, "Market");
  assert.equal(ledger.openOrders.rows[1]?.cells.reduceOnly, "Yes");
  assert.equal(ledger.openOrders.rows[1]?.cells.direction, "Close Long");
  assert.equal(ledger.openOrders.rows[1]?.cells.triggerConditions, "Price below stop");
  assert.equal(ledger.openOrders.rows[1]?.cells.tpSl, "--");
  assert.equal(ledger.tradeHistory.rows[0]?.cells.direction, "Close Long");
  assert.equal(ledger.tradeHistory.rows[0]?.cells.closedPnl, "+$42.00");
  assert.equal(ledger.tradeHistory.rows[1]?.cells.direction, "Open Short");
  assert.equal(ledger.tradeHistory.rows[2]?.cells.direction, "Close Short");
  assert.equal(
    ledger.tradeHistory.rows[0]?.explorerUrl,
    "https://app.hyperliquid.xyz/explorer",
  );
  assert.equal(ledger.tradeHistory.rows[0]?.share.coin, "XPL");
  assert.equal(ledger.tradeHistory.rows[0]?.share.pnlLabel, "+$42.00");
  assert.equal(ledger.orderHistory.rows[0]?.cells.status, "Open");
  assert.equal(ledger.orderHistory.rows[2]?.cells.orderId, "eccc65541299");
  assert.equal(ledger.orderHistory.rows[3]?.cells.status, "Canceled");
  assert.equal(
    ledger.orderHistory.rows[2]?.detail.find((detail) => detail.label === "Full Order ID")?.value,
    "session-log-1777941705740-0-5f407790-07c5-4f8c-a5ee-eccc65541299",
  );
  assert.match(ledger.fundingHistory.rows[0]?.cells.time ?? "", /05\/15\/2026/);
  assert.equal(ledger.fundingHistory.rows[0]?.cells.payment, "-0.0002 USDC");
  assert.equal(ledger.fundingHistory.rows[0]?.cells.rate, "0.0013%");
  assert.equal(ledger.balances.rows[0]?.cells.coin, "USDC (Perps)");
  assert.equal(ledger.balances.rows[0]?.cells.availableBalance, "1,200.00 USDC");
  assert.equal(ledger.balances.rows[0]?.cells.usdcValue, "$2,400.00");
});

test("buildAccountActivityLedger merges active Magic Trade triggers into Open Orders", () => {
  const ledger = buildAccountActivityLedger({
    accountValue: 2400,
    activeSymbol: "BTC-USD",
    availableToTrade: 1200,
    availableToTradeBySide: { long: 1150, short: 1125 },
    livePendingOrders: [],
    magicTradeRules: [
      createMagicTradeRule({
        execution: { armedAt: "2026-05-15T17:45:04.000Z", executionCount: 0 },
        status: "armed",
      }),
    ],
    pendingLimitOrders: [],
    positions: [],
    sessionLogEntries: [],
  });

  assert.equal(ledger.openOrders.count, 1);
  assert.equal(ledger.openOrders.rows[0]?.origin, "magic-trade");
  assert.equal(ledger.openOrders.rows[0]?.magicTradeRuleId, "magic-btc-sol");
  assert.equal(ledger.openOrders.rows[0]?.cells.type, "Magic Trigger");
  assert.equal(ledger.openOrders.rows[0]?.cells.coin, "SOL");
  assert.equal(ledger.openOrders.rows[0]?.cells.direction, "Open Short");
  assert.equal(ledger.openOrders.rows[0]?.cells.size, "$905 margin");
  assert.equal(ledger.openOrders.rows[0]?.cells.originalSize, "--");
  assert.equal(ledger.openOrders.rows[0]?.cells.orderValue, "Market");
  assert.equal(ledger.openOrders.rows[0]?.cells.price, "Market");
  assert.equal(ledger.openOrders.rows[0]?.cells.reduceOnly, "No");
  assert.equal(
    ledger.openOrders.rows[0]?.cells.triggerConditions,
    "BTC close below 79,850 on 15m",
  );
  assert.equal(ledger.openOrders.rows[0]?.cells.tpSl, "--");
  assert.equal(ledger.openOrders.rows[0]?.cells.actions, "Edit / Disarm");
  assert.equal(ledger.openOrders.rows[0]?.tone, "negative");
});

test("buildAccountActivityLedger marks legacy live Open Position Magic Trades for review", () => {
  const ledger = buildAccountActivityLedger({
    accountValue: 2400,
    activeSymbol: "BTC-USD",
    availableToTrade: 1200,
    availableToTradeBySide: { long: 1150, short: 1125 },
    livePendingOrders: [],
    magicTradeRules: [
      createMagicTradeRule({
        safety: {
          ...createMagicTradeRule().safety,
          executionMode: "live-open-position",
        },
        target: {
          enterDirection: "short",
          enterLeverage: 1,
          enterOrderType: "market",
          enterSizeUsd: 905,
          id: "magic-btc-sol-target",
          targetSymbol: "SOL-USD",
          type: "enter-market",
        },
        targetActions: undefined,
      }),
    ],
    pendingLimitOrders: [],
    positions: [],
    sessionLogEntries: [],
  });

  assert.equal(ledger.openOrders.rows[0]?.cells.size, "$905 margin");
  assert.equal(ledger.openOrders.rows[0]?.cells.actions, "Review / Disarm");
  assert.deepEqual(
    ledger.openOrders.rows[0]?.detail.find((detail) => detail.label === "Margin Status"),
    {
      label: "Margin Status",
      tone: "warning",
      value: "Review required before execution",
    },
  );
});

test("buildAccountActivityLedger keeps inactive Magic Trade rules out of Open Orders", () => {
  const inactiveStatuses: Array<TagAlongRule["status"]> = [
    "draft",
    "paused",
    "disarmed",
    "executed",
    "failed",
    "expired",
  ];
  const ledger = buildAccountActivityLedger({
    accountValue: 2400,
    activeSymbol: "BTC-USD",
    availableToTrade: 1200,
    availableToTradeBySide: { long: 1150, short: 1125 },
    livePendingOrders: [],
    magicTradeRules: inactiveStatuses.map((status) =>
      createMagicTradeRule({ id: `magic-${status}`, status }),
    ),
    pendingLimitOrders: [],
    positions: [],
    sessionLogEntries: [],
  });

  assert.equal(ledger.openOrders.count, 0);
});

test("buildAccountActivityLedger prefers Hyperliquid fills and historical orders for parity tabs", () => {
  const ledger = buildAccountActivityLedger({
    accountOrderHistory: [
      {
        coin: "BTC",
        direction: "long",
        filledSize: 0.001,
        orderId: 998877,
        orderValueUsdc: 80.12,
        price: 80120,
        reduceOnly: false,
        size: 0.001,
        status: "filled",
        time: 1778880000000,
        triggerConditions: "N/A",
        tpSl: "No",
        type: "Market",
      },
    ],
    accountTradeHistory: [
      {
        closedPnl: 12.34,
        coin: "BTC",
        direction: "Open Long",
        feeUsdc: 0.032,
        hash: "0xabc123",
        orderId: 998877,
        price: 80120,
        side: "B",
        size: 0.001,
        time: 1778880000000,
      },
    ],
    accountValue: null,
    activeSymbol: "BTC-USD",
    availableToTrade: null,
    availableToTradeBySide: { long: null, short: null },
    livePendingOrders: [],
    pendingLimitOrders: [],
    positions: [],
    sessionLogEntries: [
      {
        category: "orders",
        description: "Local fallback should not render when exchange fills exist",
        direction: "short",
        eventType: "market-order-placed",
        id: "local-session-fill",
        pnl: -99,
        price: 70000,
        size: 1,
        source: "Trade",
        symbol: "BTC-USD",
        timestamp: "2026-05-13T18:25:00.000Z",
      },
    ],
  });

  assert.equal(ledger.tradeHistory.count, 1);
  assert.equal(ledger.tradeHistory.rows[0]?.cells.direction, "Open Long");
  assert.equal(ledger.tradeHistory.rows[0]?.cells.fee, "0.03 USDC");
  assert.equal(ledger.tradeHistory.rows[0]?.cells.closedPnl, "+12.31 USDC");
  assert.match(ledger.tradeHistory.rows[0]?.cells.time ?? "", /\d{2}:\d{2}:\d{2}/);
  assert.equal(ledger.tradeHistory.rows[0]?.explorerUrl, "https://app.hyperliquid.xyz/explorer/tx/0xabc123");
  assert.equal(ledger.tradeHistory.rows[0]?.detail.find((detail) => detail.label === "Order ID")?.value, "998877");
  assert.equal(ledger.orderHistory.count, 1);
  assert.equal(ledger.orderHistory.rows[0]?.cells.status, "Filled");
  assert.equal(ledger.orderHistory.rows[0]?.cells.orderId, "998877");
  assert.equal(ledger.orderHistory.rows[0]?.cells.triggerConditions, "N/A");
});

test("aggregateAccountTradeHistoryByTime groups matching partial fills without a bridge refetch", () => {
  const fills = [
    {
      closedPnl: 0,
      coin: "BTC",
      direction: "Open Short",
      feeUsdc: 0.071829,
      hash: "0xshared",
      orderId: 53155328991,
      price: 79414,
      side: "A",
      size: 0.00201,
      time: 1778889024954,
      tradeValueUsdc: 159.62214,
    },
    {
      closedPnl: 0,
      coin: "BTC",
      direction: "Open Short",
      feeUsdc: 0.327701,
      hash: "0xshared",
      orderId: 53155328991,
      price: 79414,
      side: "A",
      size: 0.00917,
      time: 1778889024954,
      tradeValueUsdc: 728.22638,
    },
    {
      closedPnl: -2.3188,
      coin: "ETH",
      direction: "Close Long",
      feeUsdc: 0.075246,
      hash: "0xeth",
      orderId: 53123691558,
      price: 2235.5,
      side: "A",
      size: 0.0748,
      time: 1778852322661,
      tradeValueUsdc: 167.2154,
    },
    {
      closedPnl: -0.9486,
      coin: "ETH",
      direction: "Close Long",
      feeUsdc: 0.03119,
      hash: "0xeth",
      orderId: 53123691558,
      price: 2235.9,
      side: "A",
      size: 0.031,
      time: 1778852322661,
      tradeValueUsdc: 69.3129,
    },
  ];

  const aggregated = aggregateAccountTradeHistoryByTime(fills);

  assert.equal(aggregated.length, 2);
  assert.equal(aggregated[0]?.size, 0.01118);
  assert.equal(aggregated[0]?.feeUsdc, 0.39953);
  assert.equal(aggregated[0]?.tradeValueUsdc, 887.84852);
  assert.equal(aggregated[1]?.size, 0.1058);
  assert.equal(aggregated[1]?.feeUsdc, 0.106436);
  assert.equal(aggregated[1]?.closedPnl, -3.2674);
  assert.equal(Math.round((aggregated[1]?.price ?? 0) * 1_000_000) / 1_000_000, 2235.617202);
});

test("buildAccountActivityLedger keeps partial-fill trade history row ids unique", () => {
  const ledger = buildAccountActivityLedger({
    accountTradeHistory: [
      {
        closedPnl: 0,
        coin: "BTC",
        direction: "Open Short",
        feeUsdc: 0.071829,
        hash: "0xshared",
        orderId: 53155328991,
        price: 79414,
        side: "A",
        size: 0.00201,
        time: 1778889024954,
        tradeValueUsdc: 159.62214,
      },
      {
        closedPnl: 0,
        coin: "BTC",
        direction: "Open Short",
        feeUsdc: 0.327701,
        hash: "0xshared",
        orderId: 53155328991,
        price: 79414,
        side: "A",
        size: 0.00917,
        time: 1778889024954,
        tradeValueUsdc: 728.22638,
      },
    ],
    accountValue: null,
    activeSymbol: "BTC-USD",
    availableToTrade: null,
    availableToTradeBySide: { long: null, short: null },
    livePendingOrders: [],
    pendingLimitOrders: [],
    positions: [],
    sessionLogEntries: [],
  });

  assert.equal(ledger.tradeHistory.count, 2);
  assert.equal(new Set(ledger.tradeHistory.rows.map((row) => row.id)).size, 2);
});

test("buildAccountActivityLedger keeps repeated Hyperliquid order history row ids unique", () => {
  const ledger = buildAccountActivityLedger({
    accountOrderHistory: [
      {
        coin: "BTC",
        direction: "Close Long",
        filledSize: 0.00553,
        orderId: 53123664448,
        orderValueUsdc: 398.59,
        price: 72077,
        reduceOnly: true,
        size: 0.00553,
        status: "filled",
        time: 1778849905000,
        triggerConditions: "Triggered",
        tpSl: "No",
        type: "Stop Market",
      },
      {
        coin: "BTC",
        direction: "Close Long",
        filledSize: 0,
        orderId: 53123664448,
        orderValueUsdc: 442.87,
        price: 80085,
        reduceOnly: true,
        size: 0.00553,
        status: "triggered",
        time: 1778849905000,
        triggerConditions: "Price below 80085",
        tpSl: "No",
        type: "Stop Market",
      },
    ],
    accountValue: null,
    activeSymbol: "BTC-USD",
    availableToTrade: null,
    availableToTradeBySide: { long: null, short: null },
    livePendingOrders: [],
    pendingLimitOrders: [],
    positions: [],
    sessionLogEntries: [],
  });

  assert.equal(ledger.orderHistory.count, 2);
  assert.equal(ledger.orderHistory.rows[0]?.cells.orderId, "53123664448");
  assert.equal(ledger.orderHistory.rows[1]?.cells.orderId, "53123664448");
  assert.equal(ledger.orderHistory.rows[0]?.cells.size, "0.00553 BTC");
  assert.equal(ledger.orderHistory.rows[0]?.cells.filledSize, "0.00553 BTC");
  assert.equal(ledger.orderHistory.rows[0]?.cells.orderValue, "398.59 USDC");
  assert.equal(ledger.orderHistory.rows[0]?.cells.tpSl, "--");
  assert.equal(ledger.orderHistory.rows[1]?.cells.size, "--");
  assert.equal(ledger.orderHistory.rows[1]?.cells.filledSize, "--");
  assert.equal(ledger.orderHistory.rows[1]?.cells.orderValue, "--");
  assert.equal(ledger.orderHistory.rows[1]?.cells.tpSl, "--");
  assert.notEqual(ledger.orderHistory.rows[0]?.id, ledger.orderHistory.rows[1]?.id);
});

function createMagicTradeRule(
  overrides: Partial<TagAlongRule> = {},
): TagAlongRule {
  return {
    createdAt: "2026-05-15T17:44:00.000Z",
    execution: {
      executionCount: 0,
      idempotencyKey: "magic-btc-sol-key",
      ...overrides.execution,
    },
    id: overrides.id ?? "magic-btc-sol",
    metadata: {
      originalInput:
        "If BTC closes below 79850 on the 15m timeframe, open SOL short at 1x using $905 margin.",
    },
    name: "BTC controls SOL",
    safety: {
      duplicateWindowMs: 60_000,
      executionMode: "simulation-only",
      fireBehavior: "disarm-after-fire",
      maxExecutions: 1,
      requireFreshSourceDataMs: 15_000,
      requireTargetStillExists: true,
      requiresConfirmationForRiskIncrease: true,
    },
    source: {
      id: "magic-btc-sol-source",
      level: 79850,
      sourceSymbol: "BTC-USD",
      timeframe: "15m",
      type: "candle-closes-below-level",
    },
    status: overrides.status ?? "armed",
    target: {
      enterDirection: "short",
      enterLeverage: 1,
      enterMarginUsd: 905,
      enterOrderType: "market",
      id: "magic-btc-sol-target",
      sizingMode: "margin",
      targetSymbol: "SOL-USD",
      type: "enter-market",
    },
    targetActions: [
      {
        enterDirection: "short",
        enterLeverage: 1,
        enterMarginUsd: 905,
        enterOrderType: "market",
        id: "magic-btc-sol-target",
        sizingMode: "margin",
        targetSymbol: "SOL-USD",
        type: "enter-market",
      },
    ],
    updatedAt: "2026-05-15T17:45:04.000Z",
    ...overrides,
  };
}
