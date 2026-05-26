import assert from "node:assert/strict";
import test from "node:test";

import { getMagicTradeOpenPositionInFlightBlockReason } from "./magic-trade-live-open-position";

test("getMagicTradeOpenPositionInFlightBlockReason blocks duplicate execution for the same rule", () => {
  const result = getMagicTradeOpenPositionInFlightBlockReason({
    bulkSafetyActionInFlight: null,
    inFlightRuleIds: { "rule-1": true },
    limitOrderRequestState: "idle",
    manualInFlightSymbols: [],
    ruleId: "rule-1",
  });

  assert.equal(result, "duplicate execution");
});

test("getMagicTradeOpenPositionInFlightBlockReason does not block separate rules for the same target", () => {
  const result = getMagicTradeOpenPositionInFlightBlockReason({
    bulkSafetyActionInFlight: null,
    inFlightRuleIds: { "rule-1": true },
    limitOrderRequestState: "idle",
    manualInFlightSymbols: [],
    ruleId: "rule-2",
  });

  assert.equal(result, null);
});

test("getMagicTradeOpenPositionInFlightBlockReason still respects manual trading conflicts", () => {
  const result = getMagicTradeOpenPositionInFlightBlockReason({
    bulkSafetyActionInFlight: null,
    inFlightRuleIds: {},
    limitOrderRequestState: "idle",
    manualInFlightSymbols: ["SOL-USD"],
    ruleId: "rule-2",
    targetSymbols: ["SOL-USD"],
  });

  assert.equal(result, "conflicting in-flight action");
});

test("getMagicTradeOpenPositionInFlightBlockReason scopes manual conflicts by target symbol", () => {
  const result = getMagicTradeOpenPositionInFlightBlockReason({
    bulkSafetyActionInFlight: null,
    inFlightRuleIds: {},
    limitOrderRequestState: "idle",
    manualInFlightSymbols: ["ETH-USD"],
    ruleId: "rule-2",
    targetSymbols: ["SOL-USD"],
  });

  assert.equal(result, null);
});
