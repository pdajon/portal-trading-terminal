import assert from "node:assert/strict";
import test from "node:test";

import {
  getMagicTradeOpenPositionCoin,
  isMagicTradeTestnetOpenPositionSymbol,
  prepareMagicTradeOpenPositionExecution,
  type MagicTradeOpenPositionOrderContext,
} from "./magic-trade-open-position-execution";
import type { TagAlongRule } from "./tag-along-rules";

function createOpenPositionRule(overrides: Partial<TagAlongRule> = {}): TagAlongRule {
  return {
    createdAt: "2026-04-30T12:00:00.000Z",
    execution: {
      executionCount: 0,
    },
    id: "rule-1",
    name: "Magic Trade",
    safety: {
      duplicateWindowMs: 60_000,
      executionMode: "live-open-position",
      fireBehavior: "disarm-after-fire",
      maxExecutions: 1,
      requireFreshSourceDataMs: 15_000,
      requireTargetStillExists: true,
      requiresConfirmationForRiskIncrease: true,
    },
    source: {
      id: "source-1",
      level: 76_500,
      sourceSymbol: "BTC-USD",
      type: "price-touches-level",
    },
    status: "armed",
    target: {
      enterDirection: "long",
      enterLeverage: 5,
      enterMarginUsd: 250,
      enterOrderType: "market",
      id: "target-1",
      sizingMode: "margin",
      targetSymbol: "BTC-USD",
      type: "enter-market",
    },
    updatedAt: "2026-04-30T12:00:00.000Z",
    ...overrides,
  };
}

const defaultContext: MagicTradeOpenPositionOrderContext = {
  disciplineBlockReason: null,
  livePrice: 50_000,
  maxLeverage: 40,
  normalizeBaseSize: (size) => Math.floor(size * 100_000) / 100_000,
};

test("Magic Trade Open Position explicitly maps supported testnet symbols to Hyperliquid coins", () => {
  assert.equal(isMagicTradeTestnetOpenPositionSymbol("BTC-USD"), true);
  assert.equal(isMagicTradeTestnetOpenPositionSymbol("ETH-USD"), true);
  assert.equal(isMagicTradeTestnetOpenPositionSymbol("SOL-USD"), true);
  assert.equal(isMagicTradeTestnetOpenPositionSymbol("HYPE-USD"), false);
  assert.equal(getMagicTradeOpenPositionCoin("BTC-USD"), "BTC");
  assert.equal(getMagicTradeOpenPositionCoin("ETH-USD"), "ETH");
  assert.equal(getMagicTradeOpenPositionCoin("SOL-USD"), "SOL");
  assert.equal(getMagicTradeOpenPositionCoin("HYPE-USD"), "HYPE");
});

test("prepareMagicTradeOpenPositionExecution treats the configured USD value as true margin", () => {
  const result = prepareMagicTradeOpenPositionExecution(createOpenPositionRule(), defaultContext);

  assert.deepEqual(result, {
    baseSize: 0.025,
    leverage: 5,
    marginUsd: 250,
    notionalUsd: 1_250,
    ok: true,
    side: "long",
    symbol: "BTC-USD",
    targetAction: createOpenPositionRule().target,
  });
});

test("prepareMagicTradeOpenPositionExecution builds an ETH market order request", () => {
  const normalizeCalls: Array<{ size: number; symbol: string }> = [];
  const rule = createOpenPositionRule({
    source: {
      id: "source-1",
      level: 76_500,
      sourceSymbol: "BTC-USD",
      type: "price-touches-level",
    },
    target: {
      enterDirection: "short",
      enterLeverage: 4,
      enterMarginUsd: 240,
      enterOrderType: "market",
      id: "target-1",
      sizingMode: "margin",
      targetSymbol: "ETH-USD",
      type: "enter-market",
    },
  });

  const result = prepareMagicTradeOpenPositionExecution(rule, {
    ...defaultContext,
    livePrice: 2_400,
    maxLeverage: 25,
    normalizeBaseSize: (size, symbol) => {
      normalizeCalls.push({ size, symbol });
      return Math.floor(size * 10_000) / 10_000;
    },
  });

  assert.deepEqual(normalizeCalls, [{ size: 0.4, symbol: "ETH-USD" }]);
  assert.deepEqual(result, {
    baseSize: 0.4,
    leverage: 4,
    marginUsd: 240,
    notionalUsd: 960,
    ok: true,
    side: "short",
    symbol: "ETH-USD",
    targetAction: rule.target,
  });
});

test("prepareMagicTradeOpenPositionExecution builds a SOL market order request", () => {
  const normalizeCalls: Array<{ size: number; symbol: string }> = [];
  const rule = createOpenPositionRule({
    source: {
      id: "source-1",
      level: 2_400,
      sourceSymbol: "ETH-USD",
      type: "price-touches-level",
    },
    target: {
      enterDirection: "long",
      enterLeverage: 3,
      enterMarginUsd: 22,
      enterOrderType: "market",
      id: "target-1",
      sizingMode: "margin",
      targetSymbol: "SOL-USD",
      type: "enter-market",
    },
  });

  const result = prepareMagicTradeOpenPositionExecution(rule, {
    ...defaultContext,
    livePrice: 110,
    maxLeverage: 20,
    normalizeBaseSize: (size, symbol) => {
      normalizeCalls.push({ size, symbol });
      return Math.floor(size * 100) / 100;
    },
  });

  assert.deepEqual(normalizeCalls, [{ size: 0.6, symbol: "SOL-USD" }]);
  assert.deepEqual(result, {
    baseSize: 0.6,
    leverage: 3,
    marginUsd: 22,
    notionalUsd: 66,
    ok: true,
    side: "long",
    symbol: "SOL-USD",
    targetAction: rule.target,
  });
});

test("prepareMagicTradeOpenPositionExecution blocks unsupported targets", () => {
  const rule = createOpenPositionRule({
    target: {
      enterDirection: "short",
      enterLeverage: 5,
      enterMarginUsd: 250,
      enterOrderType: "market",
      id: "target-1",
      sizingMode: "margin",
      targetSymbol: "HYPE-USD" as TagAlongRule["target"]["targetSymbol"],
      type: "enter-market",
    },
  });

  assert.deepEqual(prepareMagicTradeOpenPositionExecution(rule, defaultContext), {
    ok: false,
    reason: "Symbol not yet supported for testnet Open Position",
    status: "skipped",
  });
});

test("prepareMagicTradeOpenPositionExecution accepts dynamically discovered supported targets", () => {
  const rule = createOpenPositionRule({
    target: {
      enterDirection: "long",
      enterLeverage: 2,
      enterMarginUsd: 20,
      enterOrderType: "market",
      id: "target-1",
      sizingMode: "margin",
      targetSymbol: "HYPE-USD" as TagAlongRule["target"]["targetSymbol"],
      type: "enter-market",
    },
  });
  const result = prepareMagicTradeOpenPositionExecution(rule, {
    ...defaultContext,
    livePrice: 20,
    maxLeverage: 3,
    supportedSymbols: ["BTC-USD", "ETH-USD", "SOL-USD", "HYPE-USD"],
  });

  assert.deepEqual(result, {
    baseSize: 2,
    leverage: 2,
    marginUsd: 20,
    notionalUsd: 40,
    ok: true,
    side: "long",
    symbol: "HYPE-USD",
    targetAction: rule.target,
  });
});

test("prepareMagicTradeOpenPositionExecution blocks leverage above market max", () => {
  const result = prepareMagicTradeOpenPositionExecution(
    createOpenPositionRule({
      target: {
        enterDirection: "long",
        enterLeverage: 50,
        enterMarginUsd: 250,
        enterOrderType: "market",
        id: "target-1",
        sizingMode: "margin",
        targetSymbol: "BTC-USD",
        type: "enter-market",
      },
    }),
    {
      ...defaultContext,
      maxLeverage: 40,
    },
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "Open Position leverage exceeds Hyperliquid max for BTC (40x).",
    status: "skipped",
  });
});

test("prepareMagicTradeOpenPositionExecution rejects target price unavailable per asset", () => {
  const noBtcPrice = prepareMagicTradeOpenPositionExecution(createOpenPositionRule(), {
    ...defaultContext,
    livePrice: null,
  });
  const noEthPrice = prepareMagicTradeOpenPositionExecution(
    createOpenPositionRule({
      target: {
        enterDirection: "long",
        enterLeverage: 5,
        enterMarginUsd: 250,
        enterOrderType: "market",
        id: "target-1",
        sizingMode: "margin",
        targetSymbol: "ETH-USD",
        type: "enter-market",
      },
    }),
    {
      ...defaultContext,
      livePrice: null,
    },
  );
  const noSolPrice = prepareMagicTradeOpenPositionExecution(
    createOpenPositionRule({
      target: {
        enterDirection: "long",
        enterLeverage: 5,
        enterMarginUsd: 250,
        enterOrderType: "market",
        id: "target-1",
        sizingMode: "margin",
        targetSymbol: "SOL-USD",
        type: "enter-market",
      },
    }),
    {
      ...defaultContext,
      livePrice: null,
    },
  );

  assert.deepEqual(noBtcPrice, {
    ok: false,
    reason: "Target BTC price unavailable",
    status: "skipped",
  });
  assert.deepEqual(noEthPrice, {
    ok: false,
    reason: "Target ETH price unavailable",
    status: "skipped",
  });
  assert.deepEqual(noSolPrice, {
    ok: false,
    reason: "Target SOL price unavailable",
    status: "skipped",
  });
});

test("prepareMagicTradeOpenPositionExecution rejects normalized zero size without executing", () => {
  const noSize = prepareMagicTradeOpenPositionExecution(createOpenPositionRule(), {
    ...defaultContext,
    normalizeBaseSize: () => 0,
  });

  assert.deepEqual(noSize, {
    ok: false,
    reason: "Invalid Open Position size",
    status: "skipped",
  });
});

test("prepareMagicTradeOpenPositionExecution enforces discipline blocks before sizing", () => {
  const result = prepareMagicTradeOpenPositionExecution(createOpenPositionRule(), {
    ...defaultContext,
    disciplineBlockReason: "Discipline rule blocked — cooldown active",
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "Discipline rule blocked — cooldown active",
    status: "skipped",
  });
});

test("prepareMagicTradeOpenPositionExecution blocks true-margin requests above remaining available margin", () => {
  const result = prepareMagicTradeOpenPositionExecution(createOpenPositionRule(), {
    ...defaultContext,
    availableMarginUsd: 100,
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "Magic Trade skipped — insufficient available margin after active Magic Trade reserves.",
    status: "skipped",
  });
});

test("prepareMagicTradeOpenPositionExecution requires legacy Open Position Magic rules to be reviewed before execution", () => {
  const result = prepareMagicTradeOpenPositionExecution(
    createOpenPositionRule({
      target: {
        enterDirection: "long",
        enterLeverage: 5,
        enterOrderType: "market",
        enterSizeUsd: 250,
        id: "target-1",
        targetSymbol: "BTC-USD",
        type: "enter-market",
      },
    }),
    defaultContext,
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "Magic Trade needs review before it can reserve margin.",
    status: "skipped",
  });
});

test("prepareMagicTradeOpenPositionExecution blocks already-fired rules", () => {
  const result = prepareMagicTradeOpenPositionExecution(
    createOpenPositionRule({
      execution: {
        executionCount: 1,
        lastTriggeredAt: "2026-04-30T12:01:00.000Z",
      },
    }),
    defaultContext,
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "duplicate execution",
    status: "skipped",
  });
});
