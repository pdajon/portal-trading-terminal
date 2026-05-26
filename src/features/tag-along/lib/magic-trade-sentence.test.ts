import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultTagAlongBuilderDraft, createRuleFromBuilderDraft, type TagAlongRuleBuilderDraft } from "./tag-along-rules";
import {
  formatMagicTradeSentenceText,
  getMagicTradeSentenceTokensFromDraft,
  getMagicTradeSentenceTokensFromRule,
} from "./magic-trade-sentence";

test("formats close-position Magic Trade sentence tokens", () => {
  const rule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76500",
    positionSide: "long",
    sourceConditionType: "candle-closes-below-level",
    targetActionType: "close-position",
    targetSymbol: "SOL-USD",
    timeframe: "15m",
  });

  assert.equal(
    formatMagicTradeSentenceText(getMagicTradeSentenceTokensFromRule(rule, { includeFireBehavior: true })),
    "If BTC closes below 76,500 on the 15m timeframe, close SOL long. Fires once.",
  );
});

test("formats reduce-position Magic Trade sentence tokens", () => {
  const rule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76780",
    positionSide: "long",
    reducePercent: 50,
    targetActionType: "reduce-position-percent",
    targetSymbol: "BTC-USD",
  });

  assert.equal(
    formatMagicTradeSentenceText(getMagicTradeSentenceTokensFromRule(rule, { includeFireBehavior: true })),
    "If BTC touches 76,780, reduce BTC long by 50%. Fires once.",
  );
});

test("formats cancel-orders Magic Trade sentence tokens", () => {
  const rule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76000",
    sourceConditionType: "candle-closes-below-level",
    targetActionType: "cancel-all-symbol-orders",
    targetSymbol: "PEPE-USD",
    timeframe: "5m",
  });

  assert.equal(
    formatMagicTradeSentenceText(getMagicTradeSentenceTokensFromRule(rule, { includeFireBehavior: true })),
    "If BTC closes below 76,000 on the 5m timeframe, cancel all orders. Fires once.",
  );
});

test("formats move-stop-to-break-even Magic Trade sentence tokens", () => {
  const rule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("ETH-USD"),
    level: "3200",
    sourceConditionType: "price-crosses-above-level",
    targetActionType: "move-stop-to-break-even",
    targetSymbol: "BTC-USD",
  });

  assert.equal(
    formatMagicTradeSentenceText(getMagicTradeSentenceTokensFromRule(rule, { includeFireBehavior: true })),
    "If ETH crosses above 3,200, move BTC stop to break-even. Fires once.",
  );
});

test("formats open-position Magic Trade sentence tokens", () => {
  const rule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("ETH-USD"),
    enterDirection: "long",
    enterLeverage: 5,
    enterOrderType: "market",
    enterSizeUsd: "250",
    level: "3200",
    sourceConditionType: "price-crosses-above-level",
    targetActionType: "enter-market",
    targetSymbol: "BTC-USD",
  });

  assert.equal(
    formatMagicTradeSentenceText(getMagicTradeSentenceTokensFromRule(rule, { includeFireBehavior: true })),
    "If ETH crosses above 3,200, open BTC long at 5x using $250 margin. Fires once.",
  );
});

test("reveals selected condition root before direction is selected", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    sourceConditionType: "candle-closes-above-level",
  };

  assert.equal(
    formatMagicTradeSentenceText(
      getMagicTradeSentenceTokensFromDraft(draft, {
        revealThroughStage: "event-modifier",
      }),
    ),
    "If BTC closes",
  );
});

test("formats incomplete draft tokens without future sentence text", () => {
  const draft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    sourceSymbol: "" as const,
  };

  assert.equal(formatMagicTradeSentenceText(getMagicTradeSentenceTokensFromDraft(draft)), "If");
});

test("reveals open-position draft details only after each input is selected", () => {
  const draft: TagAlongRuleBuilderDraft = {
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "64000",
    sourceConditionType: "price-touches-level",
    targetActionType: "enter-market",
  };

  assert.equal(
    formatMagicTradeSentenceText(
      getMagicTradeSentenceTokensFromDraft(draft, {
        revealThroughStage: "target-asset",
      }),
    ),
    "If BTC touches 64,000, open",
  );

  assert.equal(
    formatMagicTradeSentenceText(
      getMagicTradeSentenceTokensFromDraft(
        {
          ...draft,
          targetSymbol: "BTC-USD",
        },
        {
          revealThroughStage: "enter-direction",
        },
      ),
    ),
    "If BTC touches 64,000, open BTC",
  );

  assert.equal(
    formatMagicTradeSentenceText(
      getMagicTradeSentenceTokensFromDraft(
        {
          ...draft,
          enterDirection: "long",
          targetSymbol: "BTC-USD",
        },
        {
          revealThroughStage: "enter-leverage",
        },
      ),
    ),
    "If BTC touches 64,000, open BTC long",
  );

  assert.equal(
    formatMagicTradeSentenceText(
      getMagicTradeSentenceTokensFromDraft(
        {
          ...draft,
          enterDirection: "long",
          enterLeverage: 5,
          targetSymbol: "BTC-USD",
        },
        {
          revealThroughStage: "enter-size",
        },
      ),
    ),
    "If BTC touches 64,000, open BTC long at 5x",
  );

  assert.equal(
    formatMagicTradeSentenceText(
      getMagicTradeSentenceTokensFromDraft(
        {
          ...draft,
          enterDirection: "long",
          enterLeverage: 5,
          enterSizeUsd: "250",
          targetSymbol: "BTC-USD",
        },
        {
          revealThroughStage: "fire-behavior",
        },
      ),
    ),
    "If BTC touches 64,000, open BTC long at 5x using $250 margin.",
  );
});
