import assert from "node:assert/strict";
import test from "node:test";

import {
  appendRuleExecutionRecord,
  buildTagAlongPreview,
  createDefaultTagAlongBuilderDraft,
  createRuleFromBuilderDraft,
  createTagAlongSourceTriggerSnapshot,
  createTagAlongBuilderDraftFromParsedCommand,
  createRuleFromParsedCommand,
  evaluateTagAlongCandleClose,
  evaluateTagAlongLivePrice,
  getRuleTargetActions,
  getTagAlongExecutionModeLabel,
  isLiveOpenPositionTargetAction,
  isLiveRiskReducingTargetAction,
  MAX_TAG_ALONG_EXECUTION_RECORDS,
  parseTagAlongCommand,
  resolveRuleAfterLiveExecution,
  resolveRuleAfterSimulatedTrigger,
  TAG_ALONG_SOURCE_TRIGGER_VALIDITY_MS,
  validateTagAlongSourceTriggerSnapshot,
  validateTagAlongBuilderDraft,
  type RuleExecutionRecord,
  type TagAlongRule,
  type TagAlongRuleBuilderDraft,
} from "./tag-along-rules";

function createRule(
  overrides: Partial<TagAlongRule> = {},
): TagAlongRule {
  return {
    createdAt: "2026-04-28T12:00:00.000Z",
    execution: {
      executionCount: 0,
    },
    id: "rule-1",
    name: "BTC controls SOL",
    safety: {
      duplicateWindowMs: 60_000,
      executionMode: "simulation-only",
      fireBehavior: "disarm-after-fire",
      maxExecutions: 1,
      requireFreshSourceDataMs: 15_000,
      requireTargetStillExists: true,
      requiresConfirmationForRiskIncrease: false,
    },
    source: {
      id: "source-1",
      level: 100,
      sourceSymbol: "BTC-USD",
      type: "price-crosses-level",
    },
    status: "armed",
    target: {
      id: "target-1",
      targetSymbol: "SOL-USD",
      type: "close-position",
    },
    updatedAt: "2026-04-28T12:00:00.000Z",
    ...overrides,
  };
}

test("buildTagAlongPreview formats a plain-language candle close rule", () => {
  const rule = createRule({
    source: {
      id: "source-1",
      level: 86_500,
      sourceSymbol: "BTC-USD",
      timeframe: "15m",
      type: "candle-closes-below-level",
    },
  });

  assert.equal(
    buildTagAlongPreview(rule),
    "If BTC closes below 86,500 on the 15m timeframe, close SOL position. Fires once.",
  );
});

test("createDefaultTagAlongBuilderDraft starts as a structured simulation draft", () => {
  const draft = createDefaultTagAlongBuilderDraft("BTC-USD");

  assert.deepEqual(
    {
      executionMode: draft.executionMode,
      fireBehavior: draft.fireBehavior,
      sourceConditionType: draft.sourceConditionType,
      sourceSymbol: draft.sourceSymbol,
      targetActionType: draft.targetActionType,
      targetSymbol: draft.targetSymbol,
    },
    {
      executionMode: "simulation-only",
      fireBehavior: "disarm-after-fire",
      sourceConditionType: "price-touches-level",
      sourceSymbol: "BTC-USD",
      targetActionType: "close-position",
      targetSymbol: "BTC-USD",
    },
  );
});

test("createTagAlongBuilderDraftFromParsedCommand pre-fills structured fields from parser output", () => {
  const parsed = parseTagAlongCommand("If BTC 15m closes below 76500, reduce SOL long by 50%");

  assert.equal(parsed.ok, true);

  const draft = createTagAlongBuilderDraftFromParsedCommand(parsed.rule, "If BTC 15m closes below 76500, reduce SOL long by 50%");

  assert.deepEqual(
    {
      executionMode: draft.executionMode,
      fireBehavior: draft.fireBehavior,
      level: draft.level,
      originalInput: draft.originalInput,
      positionSide: draft.positionSide,
      reducePercent: draft.reducePercent,
      sourceConditionType: draft.sourceConditionType,
      sourceSymbol: draft.sourceSymbol,
      targetActionType: draft.targetActionType,
      targetSymbol: draft.targetSymbol,
      timeframe: draft.timeframe,
    },
    {
      executionMode: "simulation-only",
      fireBehavior: "disarm-after-fire",
      level: "76500",
      originalInput: "If BTC 15m closes below 76500, reduce SOL long by 50%",
      positionSide: "long",
      reducePercent: 50,
      sourceConditionType: "candle-closes-below-level",
      sourceSymbol: "BTC-USD",
      targetActionType: "reduce-position-percent",
      targetSymbol: "SOL-USD",
      timeframe: "15m",
    },
  );
});

test("validateTagAlongBuilderDraft requires candle timeframe and reduce percent", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76500",
    reducePercent: "",
    sourceConditionType: "candle-closes-below-level" as const,
    targetActionType: "reduce-position-percent" as const,
    timeframe: "",
  };

  assert.deepEqual(validateTagAlongBuilderDraft(draft), [
    "Candle-close rules require a timeframe.",
    "Reduce action requires a percent.",
  ]);
});

test("validateTagAlongBuilderDraft rejects unsupported candle timeframes", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76500",
    sourceConditionType: "candle-closes-below-level",
    targetSymbol: "SOL-USD",
    timeframe: "4h",
  };

  assert.ok(
    validateTagAlongBuilderDraft(draft).includes("Magic Trade candle timeframes are limited to 1m, 5m, 15m, and 1h."),
  );
});

test("createRuleFromBuilderDraft saves a structured rule and clean preview", () => {
  const draft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    executionMode: "live-risk-reducing" as const,
    level: "76500",
    originalInput: "If BTC closes below 76500, close SOL long",
    positionSide: "long" as const,
    sourceConditionType: "candle-closes-below-level" as const,
    targetActionType: "close-position" as const,
    targetSymbol: "SOL-USD" as const,
    timeframe: "15m" as const,
  };
  const rule = createRuleFromBuilderDraft(draft, {
    createdAt: "2026-04-28T12:00:00.000Z",
    id: "builder-rule",
    status: "draft",
  });

  assert.equal(rule.source.sourceSymbol, "BTC-USD");
  assert.equal(rule.source.type, "candle-closes-below-level");
  assert.equal(rule.source.level, 76_500);
  assert.equal(rule.source.timeframe, "15m");
  assert.equal(rule.target.targetSymbol, "SOL-USD");
  assert.equal(rule.target.type, "close-position");
  assert.equal(rule.target.positionSide, "long");
  assert.equal(rule.safety.executionMode, "live-risk-reducing");
  assert.equal(rule.metadata?.originalInput, "If BTC closes below 76500, close SOL long");
  assert.equal(buildTagAlongPreview(rule), "If BTC closes below 76,500 on the 15m timeframe, close SOL long. Fires once.");
});

test("createRuleFromBuilderDraft saves an open long market rule", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("ETH-USD"),
    enterDirection: "long",
    enterLeverage: 5,
    enterOrderType: "market",
    enterSizeUsd: "250",
    level: "3200",
    sourceConditionType: "price-crosses-above-level",
    targetActionType: "enter-market",
    targetSymbol: "BTC-USD",
  };

  const rule = createRuleFromBuilderDraft(draft, {
    createdAt: "2026-04-30T12:00:00.000Z",
    id: "open-long-rule",
    status: "draft",
  });

  assert.equal(rule.target.type, "enter-market");
  assert.equal(rule.target.targetSymbol, "BTC-USD");
  assert.equal(rule.target.enterDirection, "long");
  assert.equal(rule.target.enterLeverage, 5);
  assert.equal(rule.target.enterOrderType, "market");
  assert.equal(rule.target.enterMarginUsd, 250);
  assert.equal(rule.target.sizingMode, "margin");
  assert.equal(rule.target.enterSizeUsd, undefined);
  assert.equal(rule.safety.requiresConfirmationForRiskIncrease, true);
  assert.equal(
    buildTagAlongPreview(rule),
    "If ETH crosses above 3,200, open BTC long at 5x using $250 margin. Fires once.",
  );
});

test("createRuleFromBuilderDraft saves an open short market rule", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    enterDirection: "short",
    enterLeverage: 3,
    enterOrderType: "market",
    enterSizeUsd: "500",
    level: "76500",
    sourceConditionType: "candle-closes-below-level",
    targetActionType: "enter-market",
    targetSymbol: "SOL-USD",
    timeframe: "15m",
  };

  const rule = createRuleFromBuilderDraft(draft, {
    createdAt: "2026-04-30T12:00:00.000Z",
    id: "open-short-rule",
    status: "draft",
  });

  assert.equal(rule.target.type, "enter-market");
  assert.equal(rule.target.targetSymbol, "SOL-USD");
  assert.equal(rule.target.enterDirection, "short");
  assert.equal(rule.target.enterLeverage, 3);
  assert.equal(rule.target.enterOrderType, "market");
  assert.equal(rule.target.enterMarginUsd, 500);
  assert.equal(rule.target.sizingMode, "margin");
  assert.equal(rule.target.enterSizeUsd, undefined);
});

test("validateTagAlongBuilderDraft requires Open Position size and direction", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    enterDirection: "",
    enterOrderType: "market",
    enterSizeUsd: "",
    level: "76500",
    targetActionType: "enter-market",
    targetSymbol: "SOL-USD",
  };

  assert.deepEqual(validateTagAlongBuilderDraft(draft), [
    "Open Position requires long or short direction.",
    "Open Position requires leverage.",
    "Open Position requires a size.",
  ]);
});

test("createRuleFromBuilderDraft stores multiple selected position targets in one rule", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76500",
    sourceConditionType: "candle-closes-below-level",
    targetActionType: "reduce-position-percent",
    targetActions: [
      {
        id: "target-btc-long",
        positionSide: "long",
        reducePercent: 50,
        targetSymbol: "BTC-USD",
        type: "reduce-position-percent",
      },
      {
        id: "target-eth-short",
        positionSide: "short",
        reducePercent: 50,
        targetSymbol: "ETH-USD",
        type: "reduce-position-percent",
      },
    ],
    targetSymbol: "BTC-USD",
    timeframe: "15m",
  };

  const rule = createRuleFromBuilderDraft(draft, {
    createdAt: "2026-04-30T12:00:00.000Z",
    id: "multi-target-rule",
    status: "draft",
  });

  assert.equal(rule.name, "BTC controls 2 targets");
  assert.equal(rule.target.targetSymbol, "BTC-USD");
  assert.equal(rule.target.type, "reduce-position-percent");
  assert.equal(getRuleTargetActions(rule).length, 2);
  assert.equal(
    buildTagAlongPreview(rule),
    "If BTC closes below 76,500 on the 15m timeframe, reduce BTC long, ETH short by 50%. Fires once.",
  );
});

test("parseTagAlongCommand parses a touch close-position command", () => {
  const parsed = parseTagAlongCommand("If BTC touches 78000, close BTC long");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.source.sourceSymbol, "BTC-USD");
  assert.equal(parsed.rule.source.type, "price-touches-level");
  assert.equal(parsed.rule.source.level, 78_000);
  assert.equal(parsed.rule.target.targetSymbol, "BTC-USD");
  assert.equal(parsed.rule.target.type, "close-position");
  assert.equal(parsed.rule.target.positionSide, "long");
});

test("parseTagAlongCommand parses timeframe candle-close command", () => {
  const parsed = parseTagAlongCommand("If BTC 15m closes below 76500, close SOL long");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.source.sourceSymbol, "BTC-USD");
  assert.equal(parsed.rule.source.timeframe, "15m");
  assert.equal(parsed.rule.source.type, "candle-closes-below-level");
  assert.equal(parsed.rule.target.targetSymbol, "SOL-USD");
  assert.equal(parsed.rule.target.positionSide, "long");
});

test("parseTagAlongCommand allows chart-only index symbols as source anchors", () => {
  const parsed = parseTagAlongCommand("If TOTAL closes below 2500000000000 on 15m then buy SOL");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.source.sourceSymbol, "TOTAL");
  assert.equal(parsed.rule.source.timeframe, "15m");
  assert.equal(parsed.rule.source.type, "candle-closes-below-level");
  assert.equal(parsed.rule.target.targetSymbol, "SOL-USD");
  assert.equal(parsed.rule.target.type, "enter-market");
  assert.equal(parsed.rule.target.enterDirection, "long");
});

test("createRuleFromBuilderDraft allows index source and tradeable execution target", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("TOTAL"),
    enterDirection: "long",
    enterLeverage: 3,
    enterOrderType: "market",
    enterSizeUsd: "100",
    level: "2500000000000",
    sourceConditionType: "candle-closes-below-level",
    targetActionType: "enter-market",
    targetSymbol: "SOL-USD",
    timeframe: "15m",
  };

  const rule = createRuleFromBuilderDraft(draft, {
    createdAt: "2026-05-20T12:00:00.000Z",
    id: "index-source-rule",
    status: "draft",
  });

  assert.equal(rule.source.sourceSymbol, "TOTAL");
  assert.equal(rule.target.targetSymbol, "SOL-USD");
  assert.equal(rule.target.type, "enter-market");
  assert.equal(
    buildTagAlongPreview(rule),
    "If TOTAL closes below 2,500,000,000,000 on the 15m timeframe, open SOL long at 3x using $100 margin. Fires once.",
  );
});

test("validateTagAlongBuilderDraft rejects index charts as execution targets", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("TOTAL"),
    enterDirection: "long",
    enterLeverage: 3,
    enterOrderType: "market",
    enterSizeUsd: "100",
    level: "2500000000000",
    sourceConditionType: "candle-closes-below-level",
    targetActionType: "enter-market",
    targetSymbol: "BTC.D",
    timeframe: "15m",
  };

  assert.deepEqual(validateTagAlongBuilderDraft(draft), [
    "Target asset must be a tradeable Hyperliquid market.",
  ]);
});

test("validateTagAlongBuilderDraft blocks live index triggers when index data is not available", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("TOTAL"),
    enterDirection: "long",
    enterLeverage: 3,
    enterOrderType: "market",
    enterSizeUsd: "100",
    executionMode: "live-open-position",
    level: "2500000000000",
    sourceConditionType: "candle-closes-below-level",
    targetActionType: "enter-market",
    targetSymbol: "SOL-USD",
    timeframe: "15m",
  };

  assert.deepEqual(
    validateTagAlongBuilderDraft(draft, {
      indexTriggerDataAvailable: false,
    }),
    ["Index trigger data is not connected yet."],
  );
  assert.deepEqual(
    validateTagAlongBuilderDraft(draft, {
      indexTriggerDataAvailable: true,
    }),
    [],
  );
});

test("parseTagAlongCommand parses cross and break-even command", () => {
  const parsed = parseTagAlongCommand("If ETH crosses above 3200, move BTC stop to break even");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.source.sourceSymbol, "ETH-USD");
  assert.equal(parsed.rule.source.type, "price-crosses-above-level");
  assert.equal(parsed.rule.source.level, 3_200);
  assert.equal(parsed.rule.target.targetSymbol, "BTC-USD");
  assert.equal(parsed.rule.target.type, "move-stop-to-break-even");
});

test("parseTagAlongCommand parses cancel all symbol orders", () => {
  const parsed = parseTagAlongCommand("If BTC closes below 76000, cancel all PEPE orders");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.source.sourceSymbol, "BTC-USD");
  assert.equal(parsed.rule.source.timeframe, "1m");
  assert.equal(parsed.rule.source.type, "candle-closes-below-level");
  assert.equal(parsed.rule.target.targetSymbol, "PEPE-USD");
  assert.equal(parsed.rule.target.type, "cancel-all-symbol-orders");
});

test("parseTagAlongCommand parses reduce long percent command", () => {
  const parsed = parseTagAlongCommand("If BTC touches 76780, reduce BTC long by 50 percent");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.source.sourceSymbol, "BTC-USD");
  assert.equal(parsed.rule.source.type, "price-touches-level");
  assert.equal(parsed.rule.source.level, 76_780);
  assert.equal(parsed.rule.target.targetSymbol, "BTC-USD");
  assert.equal(parsed.rule.target.type, "reduce-position-percent");
  assert.equal(parsed.rule.target.positionSide, "long");
  assert.equal(parsed.rule.target.reducePercent, 50);
});

test("parseTagAlongCommand parses reduce long percent-sign command", () => {
  const parsed = parseTagAlongCommand("If BTC touches 76780, reduce BTC long by 50%");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.target.targetSymbol, "BTC-USD");
  assert.equal(parsed.rule.target.type, "reduce-position-percent");
  assert.equal(parsed.rule.target.positionSide, "long");
  assert.equal(parsed.rule.target.reducePercent, 50);
});

test("parseTagAlongCommand parses reduce my long pct command", () => {
  const parsed = parseTagAlongCommand("If BTC touches 76780, reduce my BTC long by 50 pct");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.target.targetSymbol, "BTC-USD");
  assert.equal(parsed.rule.target.type, "reduce-position-percent");
  assert.equal(parsed.rule.target.positionSide, "long");
  assert.equal(parsed.rule.target.reducePercent, 50);
});

test("parseTagAlongCommand parses reduce position by percent command", () => {
  const parsed = parseTagAlongCommand("If BTC touches 76780, reduce BTC position by 25%");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rule.target.targetSymbol, "BTC-USD");
  assert.equal(parsed.rule.target.type, "reduce-position-percent");
  assert.equal(parsed.rule.target.positionSide, undefined);
  assert.equal(parsed.rule.target.reducePercent, 25);
});

test("parseTagAlongCommand reports unsupported reduce percentages", () => {
  const parsed = parseTagAlongCommand("If BTC touches 76780, reduce BTC long by 30%");

  assert.equal(parsed.ok, false);
  assert.equal(parsed.message, "Reduce percent must be 25%, 50%, 75%, or 100%.");
});

test("buildTagAlongPreview includes reduce position side when present", () => {
  const parsed = parseTagAlongCommand("If BTC touches 76780, reduce BTC long by 50%");

  assert.equal(parsed.ok, true);

  const rule = createRuleFromParsedCommand(parsed.rule, {
    createdAt: "2026-04-28T12:00:00.000Z",
    id: "rule-reduce-preview",
  });

  assert.equal(
    buildTagAlongPreview(rule),
    "If BTC touches 76,780, reduce BTC long by 50%. Fires once.",
  );
});

test("parseTagAlongCommand rejects unclear commands", () => {
  const parsed = parseTagAlongCommand("maybe watch bitcoin and do the thing");

  assert.equal(parsed.ok, false);
  assert.equal(parsed.message, "Couldn’t understand rule");
});

test("createRuleFromParsedCommand uses disarm-after-fire by default", () => {
  const parsed = parseTagAlongCommand("When BTC crosses below 76000 then reduce SOL 50%");

  assert.equal(parsed.ok, true);

  const rule = createRuleFromParsedCommand(parsed.rule, {
    createdAt: "2026-04-28T12:00:00.000Z",
    id: "rule-from-command",
  });

  assert.equal(rule.status, "draft");
  assert.equal(rule.safety.executionMode, "simulation-only");
  assert.equal(rule.safety.fireBehavior, "disarm-after-fire");
  assert.equal(rule.target.type, "reduce-position-percent");
  assert.equal(rule.target.reducePercent, 50);
});

test("createRuleFromParsedCommand allows explicit live risk-reducing execution", () => {
  const parsed = parseTagAlongCommand("When BTC crosses below 76000 then reduce SOL 50%");

  assert.equal(parsed.ok, true);

  const rule = createRuleFromParsedCommand(parsed.rule, {
    executionMode: "live-risk-reducing",
    id: "rule-live",
  });

  assert.equal(rule.safety.executionMode, "live-risk-reducing");
  assert.equal(getTagAlongExecutionModeLabel(rule.safety.executionMode), "Live Risk-Reducing");
});

test("live execution is only allowed for risk-reducing target actions", () => {
  assert.equal(isLiveRiskReducingTargetAction({ id: "a", targetSymbol: "BTC-USD", type: "close-position" }), true);
  assert.equal(
    isLiveRiskReducingTargetAction({
      id: "a",
      reducePercent: 50,
      targetSymbol: "BTC-USD",
      type: "reduce-position-percent",
    }),
    true,
  );
  assert.equal(
    isLiveRiskReducingTargetAction({ id: "a", targetSymbol: "BTC-USD", type: "cancel-all-symbol-orders" }),
    true,
  );
  assert.equal(
    isLiveRiskReducingTargetAction({ id: "a", targetSymbol: "BTC-USD", type: "move-stop-to-break-even" }),
    true,
  );
  assert.equal(
    isLiveRiskReducingTargetAction({
      enterDirection: "long",
      id: "a",
      targetSymbol: "BTC-USD",
      type: "enter-market",
    }),
    false,
  );
});

test("live open-position mode is only allowed for Open Position target actions", () => {
  assert.equal(isLiveOpenPositionTargetAction({ id: "a", targetSymbol: "BTC-USD", type: "enter-market" }), true);
  assert.equal(isLiveOpenPositionTargetAction({ id: "a", targetSymbol: "BTC-USD", type: "close-position" }), false);

  const rule = createRuleFromParsedCommand(
    {
      source: {
        level: 3200,
        sourceSymbol: "ETH-USD",
        type: "price-crosses-above-level",
      },
      target: {
        enterDirection: "long",
        enterLeverage: 5,
        enterMarginUsd: 250,
        enterOrderType: "market",
        sizingMode: "margin",
        targetSymbol: "BTC-USD",
        type: "enter-market",
      },
    },
    {
      executionMode: "live-open-position",
      id: "live-open-position-rule",
    },
  );

  assert.equal(rule.safety.executionMode, "live-open-position");
  assert.equal(getTagAlongExecutionModeLabel(rule.safety.executionMode), "Live Open Position");
});

test("resolveRuleAfterSimulatedTrigger applies fire behavior", () => {
  const baseRule = createRule();

  assert.equal(resolveRuleAfterSimulatedTrigger(baseRule).nextRule?.status, "disarmed");
  assert.equal(
    resolveRuleAfterSimulatedTrigger({
      ...baseRule,
      safety: { ...baseRule.safety, fireBehavior: "stay-armed" },
    }).nextRule?.status,
    "armed",
  );
  assert.equal(
    resolveRuleAfterSimulatedTrigger({
      ...baseRule,
      safety: { ...baseRule.safety, fireBehavior: "delete-after-fire" },
    }).nextRule,
    null,
  );
});

test("resolveRuleAfterLiveExecution applies executed, failed, and delete outcomes", () => {
  const baseRule = createRule({
    safety: {
      ...createRule().safety,
      executionMode: "live-risk-reducing",
    },
  });

  const executed = resolveRuleAfterLiveExecution(baseRule, {
    recordId: "record-1",
    status: "executed",
    triggeredAt: "2026-04-28T13:00:00.000Z",
  });
  assert.equal(executed.nextRule?.status, "disarmed");
  assert.equal(executed.nextRule?.execution.executionCount, 1);
  assert.equal(executed.nextRule?.execution.lastExecutionRecordId, "record-1");

  const failed = resolveRuleAfterLiveExecution(baseRule, {
    recordId: "record-2",
    status: "failed",
    triggeredAt: "2026-04-28T13:00:00.000Z",
  });
  assert.equal(failed.nextRule?.status, "failed");

  const failedFromExecuting = resolveRuleAfterLiveExecution(
    {
      ...baseRule,
      status: "executing",
    },
    {
      recordId: "record-failed-open-position",
      status: "failed",
      triggeredAt: "2026-04-28T13:00:00.000Z",
    },
  );
  assert.equal(failedFromExecuting.nextRule?.status, "failed");
  assert.equal(
    failedFromExecuting.nextRule?.execution.lastExecutionRecordId,
    "record-failed-open-position",
  );

  const skipped = resolveRuleAfterLiveExecution(baseRule, {
    recordId: "record-skipped",
    status: "skipped",
    triggeredAt: "2026-04-28T13:00:00.000Z",
  });
  assert.equal(skipped.nextRule?.status, "skipped");
  assert.equal(skipped.nextRule?.execution.lastExecutionRecordId, "record-skipped");

  const deleted = resolveRuleAfterLiveExecution(
    {
      ...baseRule,
      safety: { ...baseRule.safety, fireBehavior: "delete-after-fire" },
    },
    {
      recordId: "record-3",
      status: "executed",
      triggeredAt: "2026-04-28T13:00:00.000Z",
    },
  );
  assert.equal(deleted.nextRule, null);
});

test("evaluateTagAlongLivePrice marks crossed levels as would-trigger without executing", () => {
  const rule = createRule();

  const result = evaluateTagAlongLivePrice(rule, {
    now: 1_000,
    previousPrice: 99,
    price: 101,
    priceUpdatedAt: 1_000,
    symbol: "BTC-USD",
  });

  assert.equal(result.state, "would-trigger");
  assert.equal(result.conditionMet, true);
  assert.equal(result.executionStatus, "would-trigger");
});

test("evaluateTagAlongLivePrice reports near trigger when price approaches level", () => {
  const rule = createRule({
    source: {
      id: "source-1",
      level: 100,
      sourceSymbol: "BTC-USD",
      type: "price-touches-level",
    },
  });

  const result = evaluateTagAlongLivePrice(rule, {
    now: 1_000,
    previousPrice: 97,
    price: 99.96,
    priceUpdatedAt: 1_000,
    symbol: "BTC-USD",
  });

  assert.equal(result.state, "near-trigger");
  assert.equal(result.conditionMet, false);
});

test("evaluateTagAlongCandleClose only triggers matching confirmed timeframe closes", () => {
  const rule = createRule({
    source: {
      id: "source-1",
      level: 100,
      sourceSymbol: "BTC-USD",
      timeframe: "15m",
      type: "candle-closes-below-level",
    },
  });

  const mismatched = evaluateTagAlongCandleClose(rule, {
    candleClose: 99,
    candleTime: 1_000,
    now: 1_000,
    symbol: "BTC-USD",
    timeframe: "5m",
  });
  const matched = evaluateTagAlongCandleClose(rule, {
    candleClose: 99,
    candleTime: 1_000,
    now: 1_000,
    symbol: "BTC-USD",
    timeframe: "15m",
  });

  assert.equal(mismatched.conditionMet, false);
  assert.equal(matched.state, "would-trigger");
  assert.equal(matched.conditionMet, true);
});

test("source trigger snapshot keeps a price touch valid inside the live execution window", () => {
  const rule = createRule({
    source: {
      id: "source-1",
      level: 76_715,
      sourceSymbol: "BTC-USD",
      type: "price-touches-level",
    },
  });
  const triggeredAt = "2026-04-28T13:00:00.000Z";
  const snapshot = createTagAlongSourceTriggerSnapshot(
    rule,
    {
      dataTimestamp: "2026-04-28T12:59:59.950Z",
      price: 76_715.25,
      type: "price",
    },
    triggeredAt,
  );

  assert.deepEqual(
    {
      conditionType: snapshot.conditionType,
      ruleId: snapshot.ruleId,
      sourcePrice: snapshot.sourcePrice,
      sourceSymbol: snapshot.sourceSymbol,
      timeframe: snapshot.timeframe,
      triggerLevel: snapshot.triggerLevel,
      triggerTimestamp: snapshot.triggerTimestamp,
    },
    {
      conditionType: "price-touches-level",
      ruleId: "rule-1",
      sourcePrice: 76_715.25,
      sourceSymbol: "BTC-USD",
      timeframe: undefined,
      triggerLevel: 76_715,
      triggerTimestamp: triggeredAt,
    },
  );

  const result = validateTagAlongSourceTriggerSnapshot(
    rule,
    snapshot,
    Date.parse(triggeredAt) + TAG_ALONG_SOURCE_TRIGGER_VALIDITY_MS - 1,
  );

  assert.deepEqual(result, { ok: true, reason: null });
});

test("source trigger snapshot rejects stale price data captured at trigger time", () => {
  const rule = createRule({
    safety: {
      ...createRule().safety,
      requireFreshSourceDataMs: 1_000,
    },
  });
  const snapshot = createTagAlongSourceTriggerSnapshot(
    rule,
    {
      dataTimestamp: "2026-04-28T12:59:58.000Z",
      price: 100,
      type: "price",
    },
    "2026-04-28T13:00:00.000Z",
  );

  const result = validateTagAlongSourceTriggerSnapshot(
    rule,
    snapshot,
    Date.parse("2026-04-28T13:00:01.000Z"),
  );

  assert.deepEqual(result, { ok: false, reason: "stale source snapshot" });
});

test("source trigger snapshot expires after the live execution window", () => {
  const rule = createRule();
  const triggeredAt = "2026-04-28T13:00:00.000Z";
  const snapshot = createTagAlongSourceTriggerSnapshot(
    rule,
    {
      dataTimestamp: triggeredAt,
      price: 100,
      type: "price",
    },
    triggeredAt,
  );

  const result = validateTagAlongSourceTriggerSnapshot(
    rule,
    snapshot,
    Date.parse(triggeredAt) + TAG_ALONG_SOURCE_TRIGGER_VALIDITY_MS + 1,
  );

  assert.deepEqual(result, { ok: false, reason: "stale source snapshot" });
});

test("source trigger snapshot uses confirmed candle close proof instead of current live price", () => {
  const rule = createRule({
    source: {
      id: "source-1",
      level: 100,
      sourceSymbol: "BTC-USD",
      timeframe: "15m",
      type: "candle-closes-below-level",
    },
  });
  const triggeredAt = "2026-04-28T13:00:00.000Z";
  const snapshot = createTagAlongSourceTriggerSnapshot(
    rule,
    {
      candleClose: 99,
      dataTimestamp: "2026-04-28T12:45:00.000Z",
      timeframe: "15m",
      type: "candle",
    },
    triggeredAt,
  );

  const result = validateTagAlongSourceTriggerSnapshot(
    rule,
    snapshot,
    Date.parse(triggeredAt) + 250,
  );

  assert.deepEqual(result, { ok: true, reason: null });
  assert.equal(snapshot.candleClose, 99);
  assert.equal(snapshot.timeframe, "15m");
});

test("appendRuleExecutionRecord caps simulated trigger history", () => {
  const records: RuleExecutionRecord[] = Array.from(
    { length: MAX_TAG_ALONG_EXECUTION_RECORDS },
    (_, index) => ({
      actionType: "close-position",
      id: `record-${index}`,
      relatedSessionLogIds: [],
      ruleId: "rule-1",
      sourceSnapshot: {
        dataTimestamp: "2026-04-28T12:00:00.000Z",
        price: index,
        symbol: "BTC-USD",
      },
      status: "would-trigger",
      targetAction: {
        id: "target-1",
        targetSymbol: "SOL-USD",
        type: "close-position",
      },
      triggeredAt: "2026-04-28T12:00:00.000Z",
    }),
  );

  const nextRecords = appendRuleExecutionRecord(records, {
    actionType: "close-position",
    id: "new-record",
    relatedSessionLogIds: [],
    ruleId: "rule-1",
    sourceSnapshot: {
      dataTimestamp: "2026-04-28T12:01:00.000Z",
      price: 101,
      symbol: "BTC-USD",
    },
    status: "would-trigger",
    targetAction: {
      id: "target-1",
      targetSymbol: "SOL-USD",
      type: "close-position",
    },
    triggeredAt: "2026-04-28T12:01:00.000Z",
  });

  assert.equal(nextRecords.length, MAX_TAG_ALONG_EXECUTION_RECORDS);
  assert.equal(nextRecords[0].id, "new-record");
  assert.equal(nextRecords.at(-1)?.id, "record-98");
});
