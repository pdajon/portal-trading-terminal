import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultTagAlongBuilderDraft, createRuleFromBuilderDraft } from "./tag-along-rules";
import {
  getMagicTradeDataSubscriptions,
  isMagicTradeSupportedTimeframe,
  MAGIC_TRADE_SUPPORTED_TIMEFRAMES,
} from "./magic-trade-data-engine";

test("plans one shared price stream per armed source asset", () => {
  const firstRule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76500",
    sourceSymbol: "BTC-USD",
    targetSymbol: "SOL-USD",
  });
  const secondRule = {
    ...createRuleFromBuilderDraft({
      ...createDefaultTagAlongBuilderDraft("BTC-USD"),
      level: "77000",
      sourceSymbol: "BTC-USD",
      targetSymbol: "ETH-USD",
    }),
    id: "second-rule",
  };

  const subscriptions = getMagicTradeDataSubscriptions([
    { ...firstRule, status: "armed" },
    { ...secondRule, status: "armed" },
  ]);

  assert.deepEqual(subscriptions.priceSymbols, ["BTC-USD"]);
});

test("plans candle streams by source asset and supported timeframe", () => {
  const btcRule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76500",
    sourceConditionType: "candle-closes-below-level",
    sourceSymbol: "BTC-USD",
    targetSymbol: "SOL-USD",
    timeframe: "15m",
  });
  const ethRule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("ETH-USD"),
    level: "3200",
    sourceConditionType: "candle-closes-above-level",
    sourceSymbol: "ETH-USD",
    targetSymbol: "BTC-USD",
    timeframe: "5m",
  });

  const subscriptions = getMagicTradeDataSubscriptions([
    { ...btcRule, status: "armed" },
    { ...ethRule, status: "armed" },
  ]);

  assert.deepEqual(subscriptions.candleStreams, [
    { sourceSymbol: "BTC-USD", timeframe: "15m" },
    { sourceSymbol: "ETH-USD", timeframe: "5m" },
  ]);
});

test("routes index trigger sources to TradingView-compatible polling streams", () => {
  const priceRule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("TOTAL"),
    level: "2500000000000",
    sourceConditionType: "price-crosses-below-level",
    sourceSymbol: "TOTAL",
    targetActionType: "enter-market",
    targetSymbol: "SOL-USD",
    enterDirection: "long",
    enterLeverage: 3,
    enterOrderType: "market",
    enterSizeUsd: "100",
  });
  const candleRule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("BTC.D"),
    level: "55",
    sourceConditionType: "candle-closes-below-level",
    sourceSymbol: "BTC.D",
    targetActionType: "enter-market",
    targetSymbol: "ETH-USD",
    enterDirection: "short",
    enterLeverage: 2,
    enterOrderType: "market",
    enterSizeUsd: "100",
    timeframe: "15m",
  });

  const subscriptions = getMagicTradeDataSubscriptions([
    { ...priceRule, status: "armed" },
    { ...candleRule, status: "armed" },
  ]);

  assert.deepEqual(subscriptions.priceSymbols, []);
  assert.deepEqual(subscriptions.candleStreams, []);
  assert.deepEqual(subscriptions.indexPriceSymbols, ["TOTAL"]);
  assert.deepEqual(subscriptions.indexCandleStreams, [
    { sourceSymbol: "BTC.D", timeframe: "15m" },
  ]);
});

test("does not subscribe unsupported candle timeframes", () => {
  const rule = createRuleFromBuilderDraft({
    ...createDefaultTagAlongBuilderDraft("BTC-USD"),
    level: "76500",
    sourceConditionType: "candle-closes-below-level",
    sourceSymbol: "BTC-USD",
    targetSymbol: "SOL-USD",
    timeframe: "15m",
  });
  const unsupportedRule = {
    ...rule,
    source: {
      ...rule.source,
      timeframe: "4h" as const,
    },
  };

  const subscriptions = getMagicTradeDataSubscriptions([{ ...unsupportedRule, status: "armed" }]);

  assert.deepEqual(MAGIC_TRADE_SUPPORTED_TIMEFRAMES, ["1m", "5m", "15m", "1h"]);
  assert.equal(isMagicTradeSupportedTimeframe("4h"), false);
  assert.deepEqual(subscriptions.candleStreams, []);
  assert.deepEqual(subscriptions.unsupportedRuleIds, [rule.id]);
});
