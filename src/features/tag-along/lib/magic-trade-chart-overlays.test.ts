import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultTagAlongBuilderDraft, createRuleFromBuilderDraft } from "./tag-along-rules";
import { buildMagicTradeChartOverlays } from "./magic-trade-chart-overlays";

test("shows only Magic Trade overlays for the active source chart", () => {
  const ethRule = createRuleFromBuilderDraft(
    {
      ...createDefaultTagAlongBuilderDraft("ETH-USD"),
      level: "3200",
      sourceConditionType: "price-crosses-above-level",
      targetActionType: "enter-market",
      targetSymbol: "BTC-USD",
      enterDirection: "long",
      enterLeverage: 5,
      enterSizeUsd: "25",
    },
    { status: "armed" },
  );
  const btcRule = createRuleFromBuilderDraft(
    {
      ...createDefaultTagAlongBuilderDraft("BTC-USD"),
      level: "76500",
      targetActionType: "close-position",
      targetSymbol: "SOL-USD",
    },
    { status: "armed" },
  );

  assert.deepEqual(
    buildMagicTradeChartOverlays({
      activeSymbol: "ETH-USD",
      rules: [ethRule, btcRule],
    }).map((overlay) => overlay.ruleId),
    [ethRule.id],
  );

  assert.deepEqual(
    buildMagicTradeChartOverlays({
      activeSymbol: "BTC-USD",
      rules: [ethRule, btcRule],
    }).map((overlay) => overlay.ruleId),
    [btcRule.id],
  );
});

test("maps Magic Trade watch state to near-trigger overlay state", () => {
  const rule = createRuleFromBuilderDraft(
    {
      ...createDefaultTagAlongBuilderDraft("SOL-USD"),
      enterDirection: "short",
      enterLeverage: 5,
      enterSizeUsd: "25",
      level: "85",
      targetActionType: "enter-market",
      targetSymbol: "BTC-USD",
    },
    { status: "armed" },
  );

  const overlays = buildMagicTradeChartOverlays({
    activeSymbol: "SOL-USD",
    rules: [rule],
    watchStateByRuleId: new Map([[rule.id, "near-trigger"]]),
  });

  assert.equal(overlays[0]?.status, "near-trigger");
  assert.equal(overlays[0]?.compactLabel, "Magic: SOL → BTC");
});

test("hides disarmed Magic Trade overlays", () => {
  const rule = createRuleFromBuilderDraft(
    {
      ...createDefaultTagAlongBuilderDraft("BTC-USD"),
      level: "76500",
      targetActionType: "close-position",
      targetSymbol: "BTC-USD",
    },
    { status: "disarmed" },
  );

  assert.equal(
    buildMagicTradeChartOverlays({
      activeSymbol: "BTC-USD",
      rules: [rule],
    }).length,
    0,
  );
});

test("includes execution reason for completed Magic Trade overlays", () => {
  const rule = createRuleFromBuilderDraft(
    {
      ...createDefaultTagAlongBuilderDraft("BTC-USD"),
      level: "76500",
      targetActionType: "close-position",
      targetSymbol: "BTC-USD",
    },
    { status: "failed" },
  );

  const overlays = buildMagicTradeChartOverlays({
    activeSymbol: "BTC-USD",
    executionRecords: [
      {
        actionType: "close-position",
        id: "record-1",
        reason: "exchange verification failed",
        relatedSessionLogIds: [],
        ruleId: rule.id,
        sourceSnapshot: {
          dataTimestamp: new Date().toISOString(),
          price: 76500,
          symbol: "BTC-USD",
        },
        status: "failed",
        targetAction: rule.target,
        triggeredAt: new Date().toISOString(),
      },
    ],
    rules: [rule],
  });

  assert.equal(overlays[0]?.status, "failed");
  assert.equal(overlays[0]?.executionResult, "exchange verification failed");
});
