import {
  getMagicTradeTargetActionDisplayMarginUsd,
} from "./tag-along-rules";
import type {
  FireBehavior,
  TagAlongExecutionMode,
  TagAlongRule,
  TagAlongRuleBuilderDraft,
  TargetAction,
  WatchedCondition,
} from "./tag-along-rules";

export type MagicTradeSentenceTokenKind =
  | "plain"
  | "asset"
  | "condition"
  | "level"
  | "timeframe"
  | "action"
  | "target-asset"
  | "side"
  | "leverage"
  | "percent"
  | "execution-mode"
  | "fire-behavior"
  | "punctuation";

export type MagicTradeSentenceTokenTone = "plain" | "condition" | "action" | "system" | "risk";

export type MagicTradeSentenceToken = {
  editable?: boolean;
  id: string;
  kind: MagicTradeSentenceTokenKind;
  text: string;
  tone: MagicTradeSentenceTokenTone;
};

export type MagicTradeSentenceDraftStage =
  | "source-asset"
  | "source-event"
  | "event-modifier"
  | "level"
  | "timeframe"
  | "target-action"
  | "target-asset"
  | "enter-direction"
  | "enter-leverage"
  | "enter-size"
  | "position-side"
  | "reduce-percent"
  | "fire-behavior"
  | "execution-mode"
  | "review";

type MagicTradeSentenceOptions = {
  includeExecutionMode?: boolean;
  includeFireBehavior?: boolean;
};

type MagicTradeDraftSentenceOptions = MagicTradeSentenceOptions & {
  revealThroughStage?: MagicTradeSentenceDraftStage;
};

const DRAFT_STAGE_INDEX: Record<MagicTradeSentenceDraftStage, number> = {
  "source-asset": 0,
  "source-event": 1,
  "event-modifier": 2,
  level: 3,
  timeframe: 4,
  "target-action": 5,
  "target-asset": 6,
  "enter-direction": 7,
  "enter-leverage": 8,
  "enter-size": 9,
  "position-side": 10,
  "reduce-percent": 11,
  "fire-behavior": 12,
  "execution-mode": 13,
  review: 14,
};

function token(
  id: string,
  text: string,
  kind: MagicTradeSentenceTokenKind,
  tone: MagicTradeSentenceTokenTone,
  editable = false,
): MagicTradeSentenceToken {
  return {
    editable,
    id,
    kind,
    text,
    tone,
  };
}

function plain(id: string, text: string) {
  return token(id, text, "plain", "plain");
}

function punctuation(id: string, text: string) {
  return token(id, text, "punctuation", "plain");
}

export function getMagicTradeSentenceTokensFromRule(
  rule: TagAlongRule,
  options: MagicTradeSentenceOptions = {},
) {
  return [
    ...getSourceConditionTokens(rule.source),
    punctuation("source-comma", ","),
    ...getTargetActionTokens(getRuleActions(rule)),
    punctuation("target-period", "."),
    ...(options.includeFireBehavior ? getFireBehaviorTokens(rule.safety.fireBehavior) : []),
    ...(options.includeExecutionMode ? getExecutionModeTokens(rule.safety.executionMode) : []),
  ];
}

export function getMagicTradeSentenceTokensFromDraft(
  draft: TagAlongRuleBuilderDraft,
  options: MagicTradeDraftSentenceOptions = {},
) {
  const revealIndex = DRAFT_STAGE_INDEX[options.revealThroughStage ?? "source-asset"];
  const isRevealed = (stage: MagicTradeSentenceDraftStage) => revealIndex >= DRAFT_STAGE_INDEX[stage];
  const tokens: MagicTradeSentenceToken[] = [plain("if", "If")];
  const sourceSymbol = formatSymbol(draft.sourceSymbol);
  const conditionRoot = getConditionRoot(draft.sourceConditionType);
  const conditionDirection = getConditionDirection(draft.sourceConditionType);
  const requiresTimeframe = sourceConditionRequiresTimeframe(draft.sourceConditionType);
  const level = formatLevelInput(draft.level);

  if (sourceSymbol && isRevealed("source-event")) {
    tokens.push(token("source-asset", sourceSymbol, "asset", "condition", true));
  }

  if (conditionRoot && isRevealed(conditionRoot === "touches" ? "level" : "event-modifier")) {
    tokens.push(token("source-event", conditionRoot, "condition", "condition", true));
  }

  if (conditionDirection && isRevealed("level")) {
    tokens.push(token("event-modifier", conditionDirection, "condition", "condition", true));
  }

  if (level && (requiresTimeframe ? isRevealed("timeframe") : isRevealed("target-action"))) {
    tokens.push(token("level", level, "level", "condition", true));
  }

  if (requiresTimeframe && level && isRevealed("timeframe")) {
    tokens.push(plain("on-the", "on the"));
    if (draft.timeframe && isRevealed("target-action")) {
      tokens.push(token("timeframe", draft.timeframe, "timeframe", "condition", true));
      tokens.push(plain("timeframe-word", "timeframe"));
      tokens.push(punctuation("source-comma", ","));
    }
  } else if (isRevealed("target-action")) {
    tokens.push(punctuation("source-comma", ","));
  }

  if (isRevealed("target-asset")) {
    tokens.push(
      ...(draft.targetActionType === "enter-market"
        ? getDraftEnterMarketActionTokens(draft, isRevealed)
        : getDraftTargetActionTokens(draft)),
    );
  }

  if (isRevealed("fire-behavior")) {
    tokens.push(punctuation("target-period", "."));
  }

  if (options.includeFireBehavior && isRevealed("execution-mode")) {
    tokens.push(...getFireBehaviorTokens(draft.fireBehavior));
  }

  if (options.includeExecutionMode && isRevealed("review")) {
    tokens.push(...getExecutionModeTokens(draft.executionMode));
  }

  return tokens;
}

export function formatMagicTradeSentenceText(tokens: MagicTradeSentenceToken[]) {
  return tokens.reduce((sentence, currentToken) => {
    if (!sentence) {
      return currentToken.text;
    }

    if (currentToken.kind === "punctuation") {
      return `${sentence}${currentToken.text}`;
    }

    return `${sentence} ${currentToken.text}`;
  }, "");
}

export function buildMagicTradeSentenceTextFromRule(
  rule: TagAlongRule,
  options: MagicTradeSentenceOptions = {},
) {
  return formatMagicTradeSentenceText(getMagicTradeSentenceTokensFromRule(rule, options));
}

export function buildMagicTradeSentenceTextFromDraft(
  draft: TagAlongRuleBuilderDraft,
  options: MagicTradeDraftSentenceOptions = {},
) {
  return formatMagicTradeSentenceText(getMagicTradeSentenceTokensFromDraft(draft, options));
}

function getSourceConditionTokens(condition: WatchedCondition) {
  const tokens: MagicTradeSentenceToken[] = [
    plain("if", "If"),
    token("source-asset", formatSymbol(condition.sourceSymbol), "asset", "condition", true),
  ];
  const level = formatRuleLevel(condition.level);

  switch (condition.type) {
    case "price-touches-level":
      tokens.push(token("source-event", "touches", "condition", "condition", true));
      tokens.push(token("level", level, "level", "condition", true));
      break;
    case "price-crosses-level":
      tokens.push(token("source-event", "crosses", "condition", "condition", true));
      tokens.push(token("level", level, "level", "condition", true));
      break;
    case "price-crosses-above-level":
      tokens.push(token("source-event", "crosses", "condition", "condition", true));
      tokens.push(token("event-modifier", "above", "condition", "condition", true));
      tokens.push(token("level", level, "level", "condition", true));
      break;
    case "price-crosses-below-level":
      tokens.push(token("source-event", "crosses", "condition", "condition", true));
      tokens.push(token("event-modifier", "below", "condition", "condition", true));
      tokens.push(token("level", level, "level", "condition", true));
      break;
    case "candle-closes-above-level":
      tokens.push(token("source-event", "closes", "condition", "condition", true));
      tokens.push(token("event-modifier", "above", "condition", "condition", true));
      tokens.push(token("level", level, "level", "condition", true));
      tokens.push(plain("on-the", "on the"));
      tokens.push(token("timeframe", condition.timeframe ?? "1m", "timeframe", "condition", true));
      tokens.push(plain("timeframe-word", "timeframe"));
      break;
    case "candle-closes-below-level":
      tokens.push(token("source-event", "closes", "condition", "condition", true));
      tokens.push(token("event-modifier", "below", "condition", "condition", true));
      tokens.push(token("level", level, "level", "condition", true));
      tokens.push(plain("on-the", "on the"));
      tokens.push(token("timeframe", condition.timeframe ?? "1m", "timeframe", "condition", true));
      tokens.push(plain("timeframe-word", "timeframe"));
      break;
  }

  return tokens;
}

function getTargetActionTokens(actions: TargetAction[]) {
  if (actions.length === 0) {
    return [token("target-action", "select target action", "action", "action", true)];
  }

  if (actions.length > 1) {
    return getMultipleTargetActionTokens(actions);
  }

  return getSingleTargetActionTokens(actions[0]);
}

function getSingleTargetActionTokens(action: TargetAction) {
  const targetSymbol = formatSymbol(action.targetSymbol);

  switch (action.type) {
    case "close-position":
      return [
        token("target-action", "close", "action", "action", true),
        token("target-asset", targetSymbol, "target-asset", "action", true),
        ...(action.positionSide ? [token("position-side", action.positionSide, "side", "action", true)] : []),
        plain("position-word", action.positionSide ? "" : "position"),
      ].filter((currentToken) => currentToken.text);
    case "reduce-position-percent":
      return [
        token("target-action", "reduce", "action", "action", true),
        token("target-asset", targetSymbol, "target-asset", "action", true),
        ...(action.positionSide ? [token("position-side", action.positionSide, "side", "action", true)] : []),
        plain("by-word", "by"),
        token("reduce-percent", `${action.reducePercent ?? 50}%`, "percent", "action", true),
      ];
    case "cancel-all-symbol-orders":
      return [
        token("target-action", "cancel", "action", "action", true),
        plain("all-word", "all"),
        plain("orders-word", "orders"),
      ];
    case "move-stop-to-break-even":
      return [
        token("target-action", "move", "action", "action", true),
        token("target-asset", targetSymbol, "target-asset", "action", true),
        plain("stop-word", "stop"),
        plain("to-word", "to"),
        token("break-even", "break-even", "action", "action", true),
      ];
    case "enter-market":
      const marginUsd = getMagicTradeTargetActionDisplayMarginUsd(action);
      return [
        token("target-action", "open", "action", "risk", true),
        token("target-asset", targetSymbol, "target-asset", "risk", true),
        ...(action.enterDirection ? [token("enter-direction", action.enterDirection, "side", "risk", true)] : []),
        ...(action.enterLeverage
          ? [plain("at-word", "at"), token("enter-leverage", `${action.enterLeverage}x`, "leverage", "risk", true)]
          : []),
        ...(marginUsd
          ? [plain("using-word", "using"), token("enter-size", `$${formatUsdSize(marginUsd)}`, "level", "risk", true), plain("margin-word", "margin")]
          : []),
      ];
  }
}

function getMultipleTargetActionTokens(actions: TargetAction[]) {
  const firstAction = actions[0];
  const targetsText = actions
    .map((action) => `${formatSymbol(action.targetSymbol)}${action.positionSide ? ` ${action.positionSide}` : ""}`)
    .join(", ");

  if (
    firstAction &&
    actions.every((action) => action.type === firstAction.type && action.reducePercent === firstAction.reducePercent)
  ) {
    if (firstAction.type === "close-position") {
      return [
        token("target-action", "close", "action", "action", true),
        token("target-asset", targetsText, "target-asset", "action", true),
      ];
    }

    if (firstAction.type === "reduce-position-percent") {
      return [
        token("target-action", "reduce", "action", "action", true),
        token("target-asset", targetsText, "target-asset", "action", true),
        plain("by-word", "by"),
        token("reduce-percent", `${firstAction.reducePercent ?? 50}%`, "percent", "action", true),
      ];
    }

    if (firstAction.type === "move-stop-to-break-even") {
      return [
        token("target-action", "move", "action", "action", true),
        token("target-asset", targetsText, "target-asset", "action", true),
        plain("stops-word", "stops"),
        plain("to-word", "to"),
        token("break-even", "break-even", "action", "action", true),
      ];
    }
  }

  return [token("target-action", actions.map((action) => formatMagicTradeSentenceText(getSingleTargetActionTokens(action))).join(", "), "action", "action", true)];
}

function getDraftTargetActionTokens(draft: TagAlongRuleBuilderDraft) {
  const targetActions = draft.targetActions ?? [];

  if (targetActions.length > 0) {
    return getTargetActionTokens(
      targetActions.map((action) => ({
        ...action,
        reducePercent:
          draft.targetActionType === "reduce-position-percent"
            ? draft.reducePercent || action.reducePercent || 50
            : action.reducePercent,
        type: draft.targetActionType,
      })),
    );
  }

  return getSingleTargetActionTokens({
    id: "draft-target",
    positionSide:
      draft.positionSide === "long" || draft.positionSide === "short" ? draft.positionSide : undefined,
    reducePercent: draft.targetActionType === "reduce-position-percent" ? draft.reducePercent || 50 : undefined,
    enterDirection: draft.targetActionType === "enter-market" ? draft.enterDirection || undefined : undefined,
    enterLeverage:
      draft.targetActionType === "enter-market" && typeof draft.enterLeverage === "number"
        ? draft.enterLeverage
        : undefined,
    enterOrderType: draft.targetActionType === "enter-market" ? "market" : undefined,
    enterMarginUsd:
      draft.targetActionType === "enter-market" && draft.enterSizeUsd
        ? Number(draft.enterSizeUsd.replaceAll(",", ""))
        : undefined,
    sizingMode: draft.targetActionType === "enter-market" ? "margin" : undefined,
    targetSymbol: draft.targetSymbol || draft.sourceSymbol || "BTC-USD",
    type: draft.targetActionType,
  });
}

function getDraftEnterMarketActionTokens(
  draft: TagAlongRuleBuilderDraft,
  isRevealed: (stage: MagicTradeSentenceDraftStage) => boolean,
) {
  const tokens: MagicTradeSentenceToken[] = [token("target-action", "open", "action", "risk", true)];
  const targetSymbol = formatSymbol(draft.targetSymbol);

  if (targetSymbol && isRevealed("enter-direction")) {
    tokens.push(token("target-asset", targetSymbol, "target-asset", "risk", true));
  }

  if (draft.enterDirection && isRevealed("enter-leverage")) {
    tokens.push(token("enter-direction", draft.enterDirection, "side", "risk", true));
  }

  if (typeof draft.enterLeverage === "number" && isRevealed("enter-size")) {
    tokens.push(plain("at-word", "at"));
    tokens.push(token("enter-leverage", `${draft.enterLeverage}x`, "leverage", "risk", true));
  }

  const parsedSize = draft.enterSizeUsd ? Number(draft.enterSizeUsd.replaceAll(",", "")) : NaN;

  if (Number.isFinite(parsedSize) && parsedSize > 0 && isRevealed("fire-behavior")) {
    tokens.push(plain("using-word", "using"));
    tokens.push(token("enter-size", `$${formatUsdSize(parsedSize)}`, "level", "risk", true));
    tokens.push(plain("margin-word", "margin"));
  }

  return tokens;
}

function getFireBehaviorTokens(fireBehavior: FireBehavior) {
  const text =
    fireBehavior === "stay-armed"
      ? "Stays armed."
      : fireBehavior === "delete-after-fire"
        ? "Deletes after fire."
        : "Fires once.";

  return [token("fire-behavior", text, "fire-behavior", "system", true)];
}

function getExecutionModeTokens(executionMode: TagAlongExecutionMode) {
  return [
    token(
      "execution-mode",
      executionMode === "live-risk-reducing"
        ? "Live Risk-Reducing"
        : executionMode === "live-open-position"
          ? "Live Open Position"
          : "Simulation Only",
      "execution-mode",
      executionMode === "live-risk-reducing" || executionMode === "live-open-position" ? "risk" : "system",
      true,
    ),
  ];
}

function getRuleActions(rule: Pick<TagAlongRule, "target" | "targetActions">) {
  return Array.isArray(rule.targetActions) && rule.targetActions.length > 0 ? rule.targetActions : [rule.target];
}

function sourceConditionRequiresTimeframe(conditionType: WatchedCondition["type"]) {
  return conditionType === "candle-closes-above-level" || conditionType === "candle-closes-below-level";
}

function getConditionRoot(conditionType: WatchedCondition["type"]) {
  if (conditionType === "price-touches-level") {
    return "touches";
  }

  if (conditionType === "price-crosses-level" || conditionType === "price-crosses-above-level" || conditionType === "price-crosses-below-level") {
    return "crosses";
  }

  return "closes";
}

function getConditionDirection(conditionType: WatchedCondition["type"]) {
  if (conditionType === "price-crosses-above-level" || conditionType === "candle-closes-above-level") {
    return "above";
  }

  if (conditionType === "price-crosses-below-level" || conditionType === "candle-closes-below-level") {
    return "below";
  }

  return "";
}

function formatSymbol(symbol: string) {
  return symbol ? symbol.replace(/-USD$/i, "") : "";
}

function formatLevelInput(levelInput: string) {
  const parsedLevel = levelInput ? Number(levelInput.replace(/,/g, "")) : NaN;
  return Number.isFinite(parsedLevel) ? formatRuleLevel(parsedLevel) : "";
}

function formatRuleLevel(level: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(level);
}

function formatUsdSize(sizeUsd: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: sizeUsd >= 100 ? 0 : 2,
  }).format(sizeUsd);
}
