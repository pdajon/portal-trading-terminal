import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";
import {
  isChartOnlyMarketSymbol,
  isIndexTriggerMarketSymbol,
  type IndexTriggerMarketSymbol,
} from "@/lib/markets/portal-market-registry";
import { buildMagicTradeSentenceTextFromRule } from "./magic-trade-sentence";

export const TAG_ALONG_RULES_STORAGE_KEY = "portal.tag-along-rules";
export const TAG_ALONG_EXECUTION_RECORDS_STORAGE_KEY = "portal.tag-along-execution-records";
export const MAX_TAG_ALONG_EXECUTION_RECORDS = 100;
export const TAG_ALONG_NEAR_TRIGGER_BPS = 8;
export const TAG_ALONG_COMMAND_ERROR_MESSAGE = "Couldn’t understand rule";
export const TAG_ALONG_REDUCE_PERCENT_ERROR_MESSAGE = "Reduce percent must be 25%, 50%, 75%, or 100%.";
export const TAG_ALONG_SOURCE_TRIGGER_VALIDITY_MS = 8_000;
export const MAGIC_TRADE_SUPPORTED_TIMEFRAMES = ["1m", "5m", "15m", "1h"] as const;
export const MAGIC_TRADE_UNSUPPORTED_TIMEFRAME_MESSAGE =
  "Magic Trade candle timeframes are limited to 1m, 5m, 15m, and 1h.";
export const INDEX_TRIGGER_DATA_NOT_CONNECTED_MESSAGE =
  "Index trigger data is not connected yet.";

export type TagAlongSymbol = `${string}-USD` | IndexTriggerMarketSymbol;
export type TagAlongTimeframe = ChartTimeframe | "1h" | "4h" | "1d";
export type MagicTradeSupportedTimeframe = (typeof MAGIC_TRADE_SUPPORTED_TIMEFRAMES)[number];
export type FireBehavior = "disarm-after-fire" | "delete-after-fire" | "stay-armed";
export type TagAlongExecutionMode = "simulation-only" | "live-risk-reducing" | "live-open-position";

export type RuleStatus =
  | "draft"
  | "armed"
  | "paused"
  | "triggered"
  | "executing"
  | "would-trigger"
  | "executed"
  | "skipped"
  | "failed"
  | "expired"
  | "disarmed";

export type WatchedConditionType =
  | "price-touches-level"
  | "price-crosses-level"
  | "price-crosses-above-level"
  | "price-crosses-below-level"
  | "candle-closes-above-level"
  | "candle-closes-below-level";

export type TargetActionType =
  | "close-position"
  | "reduce-position-percent"
  | "cancel-all-symbol-orders"
  | "move-stop-to-break-even"
  | "enter-market";

export type RuleExecutionStatus = "simulated" | "skipped" | "would-trigger" | "executed" | "failed";

export type TagAlongWatchState = "watching" | "near-trigger" | "would-trigger" | "feed-stale";

export type WatchedCondition = {
  id: string;
  sourceSymbol: TagAlongSymbol;
  type: WatchedConditionType;
  level: number;
  timeframe?: TagAlongTimeframe;
};

export type TargetAction = {
  id: string;
  targetSymbol: TagAlongSymbol;
  type: TargetActionType;
  positionSide?: "long" | "short";
  reducePercent?: 25 | 50 | 75 | 100;
  enterDirection?: "long" | "short";
  enterLeverage?: number;
  enterMarginUsd?: number;
  enterOrderType?: "market";
  enterSizeUsd?: number;
  sizingMode?: "margin";
  stopLoss?: number;
  takeProfit?: number;
};

export type TagAlongBuilderConditionType =
  | "price-touches-level"
  | "price-crosses-above-level"
  | "price-crosses-below-level"
  | "candle-closes-above-level"
  | "candle-closes-below-level";

export type TagAlongBuilderTargetActionType =
  | "close-position"
  | "reduce-position-percent"
  | "cancel-all-symbol-orders"
  | "move-stop-to-break-even"
  | "enter-market";

export type TagAlongBuilderPositionSide = "long" | "short" | "current" | "";

export type TagAlongRuleBuilderDraft = {
  sourceSymbol: TagAlongSymbol | "";
  sourceConditionType: TagAlongBuilderConditionType;
  level: string;
  timeframe: TagAlongTimeframe | "";
  targetSymbol: TagAlongSymbol | "";
  targetActionType: TagAlongBuilderTargetActionType;
  positionSide: TagAlongBuilderPositionSide;
  reducePercent: 25 | 50 | 75 | 100 | "";
  enterDirection: "long" | "short" | "";
  enterLeverage: number | "";
  enterOrderType: "market";
  enterSizeUsd: string;
  stopLoss: string;
  takeProfit: string;
  targetActions?: TargetAction[];
  fireBehavior: FireBehavior;
  executionMode: TagAlongExecutionMode;
  originalInput?: string;
};

export type TagAlongRule = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: RuleStatus;
  source: WatchedCondition;
  target: TargetAction;
  targetActions?: TargetAction[];
  safety: {
    executionMode: TagAlongExecutionMode;
    requiresConfirmationForRiskIncrease: boolean;
    fireBehavior: FireBehavior;
    maxExecutions: 1;
    duplicateWindowMs: number;
    expiresAt?: string;
    allowedSlippageBps?: number;
    requireTargetStillExists: boolean;
    requireFreshSourceDataMs: number;
  };
  execution: {
    armedAt?: string;
    executionCount: number;
    lastTriggeredAt?: string;
    lastExecutionRecordId?: string;
    idempotencyKey?: string;
  };
  metadata?: {
    originalInput?: string;
  };
};

export type RuleExecutionRecord = {
  id: string;
  ruleId: string;
  triggeredAt: string;
  completedAt?: string;
  sourceSnapshot: {
    symbol: TagAlongSymbol;
    price?: number;
    candleClose?: number;
    timeframe?: TagAlongTimeframe;
    dataTimestamp: string;
  };
  targetSnapshotBefore?: unknown;
  targetSnapshotAfter?: unknown;
  actionType: TargetActionType;
  targetAction: TargetAction;
  status: RuleExecutionStatus;
  reason?: string;
  exchangeRequestId?: never;
  relatedSessionLogIds: string[];
};

export type TagAlongLivePriceSnapshot = {
  symbol: string;
  price: number | null;
  previousPrice?: number | null;
  priceUpdatedAt: number | null;
  now: number;
};

export type TagAlongCandleCloseSnapshot = {
  symbol: string;
  timeframe: TagAlongTimeframe;
  candleClose: number;
  candleTime: number;
  now: number;
};

export type TagAlongSourceTriggerSnapshot = {
  ruleId: string;
  sourceSymbol: TagAlongSymbol;
  conditionType: WatchedConditionType;
  triggerLevel: number;
  triggerTimestamp: string;
  dataTimestamp: string;
  sourcePrice?: number;
  timeframe?: TagAlongTimeframe;
  candleClose?: number;
};

export type TagAlongEvaluation = {
  state: TagAlongWatchState;
  conditionMet: boolean;
  executionStatus?: RuleExecutionStatus;
  reason?: string;
};

export type ParsedTagAlongCommand = {
  source: Omit<WatchedCondition, "id">;
  target: Omit<TargetAction, "id">;
};

export type TagAlongCommandParseResult =
  | {
      ok: true;
      rule: ParsedTagAlongCommand;
    }
  | {
      ok: false;
      message: typeof TAG_ALONG_COMMAND_ERROR_MESSAGE | typeof TAG_ALONG_REDUCE_PERCENT_ERROR_MESSAGE;
    };

export function buildTagAlongPreview(rule: TagAlongRule) {
  return buildMagicTradeSentenceTextFromRule(rule, { includeFireBehavior: true });
}

export function formatWatchedCondition(condition: WatchedCondition) {
  const level = formatRuleLevel(condition.level);

  switch (condition.type) {
    case "price-touches-level":
      return `${formatTagAlongSymbol(condition.sourceSymbol)} touches ${level}`;
    case "price-crosses-level":
      return `${formatTagAlongSymbol(condition.sourceSymbol)} crosses ${level}`;
    case "price-crosses-above-level":
      return `${formatTagAlongSymbol(condition.sourceSymbol)} crosses above ${level}`;
    case "price-crosses-below-level":
      return `${formatTagAlongSymbol(condition.sourceSymbol)} crosses below ${level}`;
    case "candle-closes-above-level":
      return `${formatTagAlongSymbol(condition.sourceSymbol)} closes above ${level} on the ${condition.timeframe ?? "1m"} timeframe`;
    case "candle-closes-below-level":
      return `${formatTagAlongSymbol(condition.sourceSymbol)} closes below ${level} on the ${condition.timeframe ?? "1m"} timeframe`;
  }
}

export function formatTargetAction(action: TargetAction) {
  const targetSymbol = formatTagAlongSymbol(action.targetSymbol);

  switch (action.type) {
    case "close-position":
      return action.positionSide
        ? `close ${targetSymbol} ${action.positionSide}`
        : `close ${targetSymbol} position`;
    case "reduce-position-percent":
      return `reduce ${targetSymbol}${action.positionSide ? ` ${action.positionSide}` : ""} by ${action.reducePercent ?? 50}%`;
    case "cancel-all-symbol-orders":
      return "cancel all orders";
    case "move-stop-to-break-even":
      return `move ${targetSymbol} stop to break-even`;
    case "enter-market":
      return [
        "open",
        targetSymbol,
        action.enterDirection,
        action.enterLeverage ? `at ${action.enterLeverage}x` : undefined,
        getMagicTradeTargetActionDisplayMarginUsd(action)
          ? `using $${formatUsdSize(getMagicTradeTargetActionDisplayMarginUsd(action) ?? 0)} margin`
          : undefined,
      ]
        .filter(Boolean)
        .join(" ");
  }
}

export function getRuleTargetActions(rule: Pick<TagAlongRule, "target" | "targetActions">) {
  return Array.isArray(rule.targetActions) && rule.targetActions.length > 0
    ? rule.targetActions
    : [rule.target];
}

export function formatTargetActions(actions: TargetAction[]) {
  if (actions.length === 0) {
    return "select target action";
  }

  if (actions.length === 1) {
    return formatTargetAction(actions[0]);
  }

  const [firstAction] = actions;

  if (
    firstAction &&
    actions.every((action) => action.type === firstAction.type && action.reducePercent === firstAction.reducePercent)
  ) {
    const formattedTargets = actions
      .map((action) => `${formatTagAlongSymbol(action.targetSymbol)}${action.positionSide ? ` ${action.positionSide}` : ""}`)
      .join(", ");

    if (firstAction.type === "close-position") {
      return `close ${formattedTargets}`;
    }

    if (firstAction.type === "reduce-position-percent") {
      return `reduce ${formattedTargets} by ${firstAction.reducePercent ?? 50}%`;
    }

    if (firstAction.type === "move-stop-to-break-even") {
      return `move ${formattedTargets} stops to break-even`;
    }
  }

  return actions.map(formatTargetAction).join(", ");
}

export function sourceConditionRequiresTimeframe(conditionType: WatchedConditionType) {
  return conditionType === "candle-closes-above-level" || conditionType === "candle-closes-below-level";
}

export function isMagicTradeSupportedTimeframe(
  timeframe: string | undefined,
): timeframe is MagicTradeSupportedTimeframe {
  return MAGIC_TRADE_SUPPORTED_TIMEFRAMES.includes(timeframe as MagicTradeSupportedTimeframe);
}

export function createDefaultTagAlongBuilderDraft(
  defaultSymbol: TagAlongSymbol = "BTC-USD",
): TagAlongRuleBuilderDraft {
  return {
    enterDirection: "",
    enterLeverage: "",
    enterOrderType: "market",
    enterSizeUsd: "",
    executionMode: "simulation-only",
    fireBehavior: "disarm-after-fire",
    level: "",
    positionSide: "current",
    reducePercent: 50,
    stopLoss: "",
    sourceConditionType: "price-touches-level",
    sourceSymbol: defaultSymbol,
    takeProfit: "",
    targetActionType: "close-position",
    targetSymbol: defaultSymbol,
    timeframe: "",
  };
}

export function createTagAlongBuilderDraftFromParsedCommand(
  parsedRule: ParsedTagAlongCommand,
  originalInput?: string,
): TagAlongRuleBuilderDraft {
  return {
    ...createDefaultTagAlongBuilderDraft(parsedRule.source.sourceSymbol),
    level: String(parsedRule.source.level),
    enterDirection: parsedRule.target.type === "enter-market" ? parsedRule.target.enterDirection ?? "" : "",
    enterLeverage: parsedRule.target.type === "enter-market" ? parsedRule.target.enterLeverage ?? "" : "",
    enterOrderType: "market",
    enterSizeUsd:
      parsedRule.target.type === "enter-market" &&
      getMagicTradeTargetActionDisplayMarginUsd(parsedRule.target)
        ? String(getMagicTradeTargetActionDisplayMarginUsd(parsedRule.target))
        : "",
    originalInput,
    positionSide: parsedRule.target.positionSide ?? "current",
    reducePercent:
      parsedRule.target.type === "reduce-position-percent"
        ? parsedRule.target.reducePercent ?? 50
        : 50,
    sourceConditionType: normalizeBuilderConditionType(parsedRule.source.type),
    sourceSymbol: parsedRule.source.sourceSymbol,
    targetActionType: normalizeBuilderTargetActionType(parsedRule.target.type),
    targetActions: [withTargetActionId(parsedRule.target)],
    targetSymbol: parsedRule.target.targetSymbol,
    timeframe: parsedRule.source.timeframe ?? "",
  };
}

export function createTagAlongBuilderDraftFromRule(rule: TagAlongRule): TagAlongRuleBuilderDraft {
  const targetActions = getRuleTargetActions(rule);
  const firstTarget = targetActions[0] ?? rule.target;

  return {
    ...createDefaultTagAlongBuilderDraft(rule.source.sourceSymbol),
    executionMode: rule.safety.executionMode,
    enterDirection: firstTarget.type === "enter-market" ? firstTarget.enterDirection ?? "" : "",
    enterLeverage: firstTarget.type === "enter-market" ? firstTarget.enterLeverage ?? "" : "",
    enterOrderType: firstTarget.type === "enter-market" ? firstTarget.enterOrderType ?? "market" : "market",
    enterSizeUsd:
      firstTarget.type === "enter-market" &&
      getMagicTradeTargetActionDisplayMarginUsd(firstTarget)
        ? String(getMagicTradeTargetActionDisplayMarginUsd(firstTarget))
        : "",
    fireBehavior: rule.safety.fireBehavior,
    level: String(rule.source.level),
    originalInput: rule.metadata?.originalInput,
    positionSide: firstTarget.positionSide ?? "current",
    reducePercent: firstTarget.type === "reduce-position-percent" ? firstTarget.reducePercent ?? 50 : 50,
    sourceConditionType: normalizeBuilderConditionType(rule.source.type),
    sourceSymbol: rule.source.sourceSymbol,
    targetActionType: normalizeBuilderTargetActionType(firstTarget.type),
    targetActions,
    targetSymbol: firstTarget.targetSymbol,
    stopLoss: firstTarget.stopLoss ? String(firstTarget.stopLoss) : "",
    takeProfit: firstTarget.takeProfit ? String(firstTarget.takeProfit) : "",
    timeframe: rule.source.timeframe ?? "",
  };
}

type ValidateTagAlongBuilderDraftOptions = {
  indexTriggerDataAvailable?: boolean;
  indexTriggerDataConnected?: boolean;
};

export function validateTagAlongBuilderDraft(
  draft: TagAlongRuleBuilderDraft,
  options: ValidateTagAlongBuilderDraftOptions = {},
) {
  const messages: string[] = [];
  const level = parseRuleLevel(draft.level);

  if (!draft.sourceSymbol) {
    messages.push("Source asset is required.");
  }

  if (level === null) {
    messages.push("Trigger level is required.");
  }

  if (sourceConditionRequiresTimeframe(draft.sourceConditionType) && !draft.timeframe) {
    messages.push("Candle-close rules require a timeframe.");
  }

  if (
    sourceConditionRequiresTimeframe(draft.sourceConditionType) &&
    draft.timeframe &&
    !isMagicTradeSupportedTimeframe(draft.timeframe)
  ) {
    messages.push(MAGIC_TRADE_UNSUPPORTED_TIMEFRAME_MESSAGE);
  }

  if (!draft.targetSymbol && (!draft.targetActions || draft.targetActions.length === 0)) {
    messages.push("Target asset is required.");
  }

  const targetSymbols = draft.targetActions?.length
    ? draft.targetActions.map((action) => action.targetSymbol)
    : draft.targetSymbol
      ? [draft.targetSymbol]
      : [];

  if (targetSymbols.some((symbol) => isChartOnlyMarketSymbol(symbol))) {
    messages.push("Target asset must be a tradeable Hyperliquid market.");
  }

  const indexTriggerDataAvailabilityWasChecked =
    options.indexTriggerDataAvailable !== undefined ||
    options.indexTriggerDataConnected !== undefined;
  const indexTriggerDataAvailable =
    options.indexTriggerDataAvailable ?? options.indexTriggerDataConnected;

  if (
    isIndexTriggerMarketSymbol(draft.sourceSymbol) &&
    draft.executionMode !== "simulation-only" &&
    indexTriggerDataAvailabilityWasChecked &&
    !indexTriggerDataAvailable
  ) {
    messages.push(INDEX_TRIGGER_DATA_NOT_CONNECTED_MESSAGE);
  }

  if (draft.targetActionType === "reduce-position-percent" && !draft.reducePercent) {
    messages.push("Reduce action requires a percent.");
  }

  if (draft.targetActionType === "enter-market") {
    const enterSizeUsd = parseRuleLevel(draft.enterSizeUsd);
    const enterLeverage = draft.enterLeverage;

    if (draft.enterDirection !== "long" && draft.enterDirection !== "short") {
      messages.push("Open Position requires long or short direction.");
    }

    if (!Number.isFinite(enterLeverage) || typeof enterLeverage !== "number" || enterLeverage <= 0) {
      messages.push("Open Position requires leverage.");
    }

    if (enterSizeUsd === null) {
      messages.push("Open Position requires a size.");
    }

    if (draft.enterOrderType !== "market") {
      messages.push("Open Position only supports market orders right now.");
    }
  }

  if (
    draft.executionMode === "live-risk-reducing" &&
    !isLiveRiskReducingTargetAction({ type: draft.targetActionType })
  ) {
    messages.push("Live execution is limited to risk-reducing actions.");
  }

  if (draft.executionMode === "live-open-position" && draft.targetActionType !== "enter-market") {
    messages.push("Live Open Position is only available for Open Position actions.");
  }

  return messages;
}

export function createRuleFromBuilderDraft(
  draft: TagAlongRuleBuilderDraft,
  options: {
    createdAt?: string;
    id?: string;
    status?: RuleStatus;
  } = {},
): TagAlongRule {
  const validationMessages = validateTagAlongBuilderDraft(draft);

  if (validationMessages.length > 0) {
    throw new Error(validationMessages[0]);
  }

  const level = parseRuleLevel(draft.level);

  if (level === null || !draft.sourceSymbol || (!draft.targetSymbol && (!draft.targetActions || draft.targetActions.length === 0))) {
    throw new Error(TAG_ALONG_COMMAND_ERROR_MESSAGE);
  }

  const source: ParsedTagAlongCommand["source"] = {
    level,
    sourceSymbol: draft.sourceSymbol,
    timeframe: sourceConditionRequiresTimeframe(draft.sourceConditionType) ? draft.timeframe || "1m" : undefined,
    type: draft.sourceConditionType,
  };
  const positionSide =
    draft.positionSide === "long" || draft.positionSide === "short" ? draft.positionSide : undefined;
  const parsedEnterMarginUsd =
    draft.targetActionType === "enter-market"
      ? parseRuleLevel(draft.enterSizeUsd) ?? undefined
      : undefined;
  const target: ParsedTagAlongCommand["target"] = {
    enterDirection: draft.targetActionType === "enter-market" ? draft.enterDirection || undefined : undefined,
    enterLeverage: draft.targetActionType === "enter-market" && typeof draft.enterLeverage === "number"
      ? draft.enterLeverage
      : undefined,
    enterMarginUsd: parsedEnterMarginUsd,
    enterOrderType: draft.targetActionType === "enter-market" ? "market" : undefined,
    positionSide:
      draft.targetActionType === "close-position" || draft.targetActionType === "reduce-position-percent"
        ? positionSide
        : undefined,
    reducePercent:
      draft.targetActionType === "reduce-position-percent"
        ? (draft.reducePercent || 50)
        : undefined,
    targetSymbol: draft.targetSymbol || draft.targetActions?.[0]?.targetSymbol || draft.sourceSymbol,
    stopLoss:
      draft.targetActionType === "enter-market" && draft.stopLoss
        ? parseRuleLevel(draft.stopLoss) ?? undefined
        : undefined,
    takeProfit:
      draft.targetActionType === "enter-market" && draft.takeProfit
        ? parseRuleLevel(draft.takeProfit) ?? undefined
        : undefined,
    sizingMode: draft.targetActionType === "enter-market" ? "margin" : undefined,
    type: draft.targetActionType,
  };
  const targetActions =
    draft.targetActionType === "enter-market"
      ? [withTargetActionId(target)]
      : draft.targetActions && draft.targetActions.length > 0
      ? draft.targetActions.map((action) => ({
          ...action,
          id: action.id || `target-action-${crypto.randomUUID()}`,
          reducePercent:
            draft.targetActionType === "reduce-position-percent"
              ? draft.reducePercent || action.reducePercent || 50
              : action.reducePercent,
          type: draft.targetActionType,
        }))
      : [withTargetActionId(target)];
  const rule = createRuleFromParsedCommand(
    { source, target },
    {
      createdAt: options.createdAt,
      executionMode: draft.executionMode,
      fireBehavior: draft.fireBehavior,
      id: options.id,
      status: options.status,
    },
  );

  const nextRule = {
    ...rule,
    target: targetActions[0] ?? rule.target,
    targetActions,
    name:
      targetActions.length > 1
        ? `${formatTagAlongSymbol(source.sourceSymbol)} controls ${targetActions.length} targets`
        : rule.name,
  };

  return draft.originalInput
    ? {
        ...nextRule,
        metadata: {
          originalInput: draft.originalInput,
        },
      }
    : nextRule;
}

function normalizeBuilderConditionType(conditionType: WatchedConditionType): TagAlongBuilderConditionType {
  return conditionType === "price-crosses-level" ? "price-crosses-above-level" : conditionType;
}

function normalizeBuilderTargetActionType(targetActionType: TargetActionType): TagAlongBuilderTargetActionType {
  return targetActionType;
}

function normalizeParsedTargetAction(
  target: ParsedTagAlongCommand["target"],
): ParsedTagAlongCommand["target"] {
  if (target.type !== "enter-market") {
    return target;
  }

  const enterMarginUsd =
    getFinitePositiveNumber(target.enterMarginUsd) ??
    getFinitePositiveNumber(target.enterSizeUsd);
  const { enterSizeUsd: _legacyEnterSizeUsd, ...restTarget } = target;

  return {
    ...restTarget,
    enterMarginUsd: enterMarginUsd ?? undefined,
    sizingMode: "margin",
  };
}

export function formatFireBehaviorLabel(fireBehavior: FireBehavior) {
  switch (fireBehavior) {
    case "disarm-after-fire":
      return "Disarm after fire";
    case "delete-after-fire":
      return "Delete after fire";
    case "stay-armed":
      return "Stay armed";
  }
}

export function formatFireBehaviorSentence(fireBehavior: FireBehavior) {
  switch (fireBehavior) {
    case "disarm-after-fire":
      return "Fires once.";
    case "delete-after-fire":
      return "Deletes after fire.";
    case "stay-armed":
      return "Stays armed.";
  }
}

export function parseTagAlongCommand(command: string): TagAlongCommandParseResult {
  const normalizedCommand = command.trim().replace(/\s+/g, " ");
  const commandMatch = normalizedCommand.match(/^(?:if|when)\s+(.+?)\s*(?:,|\bthen\b)\s*(.+)$/i);

  if (!commandMatch) {
    return { ok: false, message: TAG_ALONG_COMMAND_ERROR_MESSAGE };
  }

  const source = parseWatchedCondition(commandMatch[1]);
  const target = parseTargetAction(commandMatch[2]);

  if (!source || !target) {
    return { ok: false, message: TAG_ALONG_COMMAND_ERROR_MESSAGE };
  }

  if ("message" in target) {
    return { ok: false, message: target.message };
  }

  return {
    ok: true,
    rule: {
      source,
      target,
    },
  };
}

export function createRuleFromParsedCommand(
  parsedRule: ParsedTagAlongCommand,
  options: {
    createdAt?: string;
    fireBehavior?: FireBehavior;
    id?: string;
    executionMode?: TagAlongExecutionMode;
    status?: RuleStatus;
  } = {},
): TagAlongRule {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const ruleId = options.id ?? `tag-along-${Date.now()}-${crypto.randomUUID()}`;
  const fireBehavior = options.fireBehavior ?? "disarm-after-fire";
  const target = normalizeParsedTargetAction(parsedRule.target);
  const executionMode =
    options.executionMode === "live-risk-reducing" && isLiveRiskReducingTargetAction(target)
      ? "live-risk-reducing"
      : options.executionMode === "live-open-position" && isLiveOpenPositionTargetAction(target)
        ? "live-open-position"
      : "simulation-only";

  return {
    createdAt,
    execution: {
      armedAt: options.status === "armed" ? createdAt : undefined,
      executionCount: 0,
      idempotencyKey: `tag-along-${executionMode}-${ruleId}`,
    },
    id: ruleId,
    name: `${formatTagAlongSymbol(parsedRule.source.sourceSymbol)} controls ${formatTagAlongSymbol(target.targetSymbol)}`,
    safety: {
      duplicateWindowMs: 60_000,
      executionMode,
      fireBehavior,
      maxExecutions: 1,
      requireFreshSourceDataMs: 15_000,
      requireTargetStillExists: true,
      requiresConfirmationForRiskIncrease: target.type === "enter-market",
    },
    source: {
      ...parsedRule.source,
      id: `${ruleId}-source`,
    },
    status: options.status ?? "draft",
    target: {
      ...target,
      id: `${ruleId}-target`,
    },
    updatedAt: createdAt,
  };
}

export function isLiveRiskReducingTargetAction(action: Partial<TargetAction> & Pick<TargetAction, "type">) {
  return (
    action.type === "close-position" ||
    action.type === "reduce-position-percent" ||
    action.type === "cancel-all-symbol-orders" ||
    action.type === "move-stop-to-break-even"
  );
}

export function isLiveOpenPositionTargetAction(action: Partial<TargetAction> & Pick<TargetAction, "type">) {
  return action.type === "enter-market";
}

export function getMagicTradeTargetActionMarginUsd(
  action: Partial<TargetAction> & Pick<TargetAction, "type">,
) {
  if (action.type !== "enter-market" || action.sizingMode !== "margin") {
    return null;
  }

  return getFinitePositiveNumber(action.enterMarginUsd);
}

export function getMagicTradeTargetActionDisplayMarginUsd(
  action: Partial<TargetAction> & Pick<TargetAction, "type">,
) {
  return (
    getMagicTradeTargetActionMarginUsd(action) ??
    (action.type === "enter-market"
      ? getFinitePositiveNumber(action.enterSizeUsd)
      : null)
  );
}

export function isLegacyMagicTradeOpenPositionAction(
  action: Partial<TargetAction> & Pick<TargetAction, "type">,
) {
  return (
    action.type === "enter-market" &&
    action.sizingMode !== "margin" &&
    getFinitePositiveNumber(action.enterSizeUsd) !== null
  );
}

function withTargetActionId(action: Omit<TargetAction, "id"> | TargetAction): TargetAction {
  return {
    ...action,
    id: "id" in action && action.id ? action.id : `target-action-${crypto.randomUUID()}`,
  };
}

export function getTagAlongExecutionModeLabel(executionMode: TagAlongExecutionMode) {
  switch (executionMode) {
    case "live-open-position":
      return "Live Open Position";
    case "live-risk-reducing":
      return "Live Risk-Reducing";
    case "simulation-only":
      return "Simulation Only";
  }
}

export function resolveRuleAfterSimulatedTrigger(rule: TagAlongRule): { nextRule: TagAlongRule | null } {
  const triggeredAt = new Date().toISOString();
  const nextExecution = {
    ...rule.execution,
    executionCount: rule.execution.executionCount + 1,
    lastTriggeredAt: triggeredAt,
  };

  if (rule.safety.fireBehavior === "delete-after-fire") {
    return { nextRule: null };
  }

  return {
    nextRule: {
      ...rule,
      execution: nextExecution,
      status: rule.safety.fireBehavior === "stay-armed" ? "armed" : "disarmed",
      updatedAt: triggeredAt,
    },
  };
}

export function resolveRuleAfterLiveExecution(
  rule: TagAlongRule,
  result: {
    recordId: string;
    status: Extract<RuleExecutionStatus, "executed" | "failed" | "skipped">;
    triggeredAt: string;
  },
): { nextRule: TagAlongRule | null } {
  const nextExecution = {
    ...rule.execution,
    executionCount: rule.execution.executionCount + (result.status === "executed" ? 1 : 0),
    lastExecutionRecordId: result.recordId,
    lastTriggeredAt: result.triggeredAt,
  };

  if (result.status === "executed" && rule.safety.fireBehavior === "delete-after-fire") {
    return { nextRule: null };
  }

  return {
    nextRule: {
      ...rule,
      execution: nextExecution,
      status:
        result.status === "executed"
          ? rule.safety.fireBehavior === "stay-armed"
            ? "armed"
            : "disarmed"
          : result.status,
      updatedAt: result.triggeredAt,
    },
  };
}

export function createTagAlongSourceTriggerSnapshot(
  rule: TagAlongRule,
  snapshot:
    | { type: "price"; price: number; dataTimestamp: string }
    | { type: "candle"; candleClose: number; timeframe: TagAlongTimeframe; dataTimestamp: string },
  triggeredAt: string,
): TagAlongSourceTriggerSnapshot {
  return {
    candleClose: snapshot.type === "candle" ? snapshot.candleClose : undefined,
    conditionType: rule.source.type,
    dataTimestamp: snapshot.dataTimestamp,
    ruleId: rule.id,
    sourcePrice: snapshot.type === "price" ? snapshot.price : undefined,
    sourceSymbol: rule.source.sourceSymbol,
    timeframe: snapshot.type === "candle" ? snapshot.timeframe : rule.source.timeframe,
    triggerLevel: rule.source.level,
    triggerTimestamp: triggeredAt,
  };
}

export function validateTagAlongSourceTriggerSnapshot(
  rule: TagAlongRule,
  snapshot: TagAlongSourceTriggerSnapshot,
  now: number,
  validityWindowMs = TAG_ALONG_SOURCE_TRIGGER_VALIDITY_MS,
): { ok: true; reason: null } | { ok: false; reason: string } {
  if (
    snapshot.ruleId !== rule.id ||
    snapshot.sourceSymbol !== rule.source.sourceSymbol ||
    snapshot.conditionType !== rule.source.type ||
    snapshot.triggerLevel !== rule.source.level
  ) {
    return { ok: false, reason: "source trigger snapshot mismatch" };
  }

  const triggerTimestamp = Date.parse(snapshot.triggerTimestamp);

  if (!Number.isFinite(triggerTimestamp)) {
    return { ok: false, reason: "stale source snapshot" };
  }

  if (now - triggerTimestamp > validityWindowMs) {
    return { ok: false, reason: "stale source snapshot" };
  }

  if (rule.source.type === "candle-closes-above-level" || rule.source.type === "candle-closes-below-level") {
    if (
      !Number.isFinite(snapshot.candleClose) ||
      snapshot.timeframe !== (rule.source.timeframe ?? "1m")
    ) {
      return { ok: false, reason: "source trigger snapshot mismatch" };
    }

    return { ok: true, reason: null };
  }

  const dataTimestamp = Date.parse(snapshot.dataTimestamp);

  if (!Number.isFinite(dataTimestamp)) {
    return { ok: false, reason: "stale source snapshot" };
  }

  if (triggerTimestamp - dataTimestamp > rule.safety.requireFreshSourceDataMs) {
    return { ok: false, reason: "stale source snapshot" };
  }

  if (!Number.isFinite(snapshot.sourcePrice)) {
    return { ok: false, reason: "source trigger snapshot mismatch" };
  }

  return { ok: true, reason: null };
}

export function evaluateTagAlongLivePrice(
  rule: TagAlongRule,
  snapshot: TagAlongLivePriceSnapshot,
): TagAlongEvaluation {
  if (!canEvaluateRule(rule) || snapshot.symbol !== rule.source.sourceSymbol) {
    return { conditionMet: false, state: "watching" };
  }

  const source = rule.source;

  if (source.type === "candle-closes-above-level" || source.type === "candle-closes-below-level") {
    return { conditionMet: false, state: "watching" };
  }

  if (!Number.isFinite(snapshot.price) || snapshot.price === null || snapshot.priceUpdatedAt === null) {
    return { conditionMet: false, reason: "No fresh source price.", state: "feed-stale" };
  }

  if (snapshot.now - snapshot.priceUpdatedAt > rule.safety.requireFreshSourceDataMs) {
    return { conditionMet: false, reason: "Source price is stale.", state: "feed-stale" };
  }

  const currentPrice = snapshot.price;
  const previousPrice = snapshot.previousPrice;
  const level = source.level;
  const touchThreshold = getPriceThreshold(level);

  const touched = Math.abs(currentPrice - level) <= touchThreshold;
  const crossed =
    typeof previousPrice === "number" &&
    Number.isFinite(previousPrice) &&
    ((previousPrice < level && currentPrice >= level) ||
      (previousPrice > level && currentPrice <= level));

  if (source.type === "price-touches-level" && (touched || crossed)) {
    return { conditionMet: true, executionStatus: "would-trigger", state: "would-trigger" };
  }

  if (source.type === "price-crosses-level" && crossed) {
    return { conditionMet: true, executionStatus: "would-trigger", state: "would-trigger" };
  }

  if (
    source.type === "price-crosses-above-level" &&
    typeof previousPrice === "number" &&
    previousPrice < level &&
    currentPrice >= level
  ) {
    return { conditionMet: true, executionStatus: "would-trigger", state: "would-trigger" };
  }

  if (
    source.type === "price-crosses-below-level" &&
    typeof previousPrice === "number" &&
    previousPrice > level &&
    currentPrice <= level
  ) {
    return { conditionMet: true, executionStatus: "would-trigger", state: "would-trigger" };
  }

  if (Math.abs(currentPrice - level) <= getNearTriggerThreshold(level)) {
    return { conditionMet: false, state: "near-trigger" };
  }

  return { conditionMet: false, state: "watching" };
}

export function evaluateTagAlongCandleClose(
  rule: TagAlongRule,
  snapshot: TagAlongCandleCloseSnapshot,
): TagAlongEvaluation {
  if (!canEvaluateRule(rule) || snapshot.symbol !== rule.source.sourceSymbol) {
    return { conditionMet: false, state: "watching" };
  }

  const source = rule.source;

  if (source.type !== "candle-closes-above-level" && source.type !== "candle-closes-below-level") {
    return { conditionMet: false, state: "watching" };
  }

  if ((source.timeframe ?? "1m") !== snapshot.timeframe) {
    return { conditionMet: false, state: "watching" };
  }

  const conditionMet =
    source.type === "candle-closes-above-level"
      ? snapshot.candleClose > source.level
      : snapshot.candleClose < source.level;

  return conditionMet
    ? { conditionMet: true, executionStatus: "would-trigger", state: "would-trigger" }
    : { conditionMet: false, state: "watching" };
}

export function appendRuleExecutionRecord(
  records: RuleExecutionRecord[],
  record: RuleExecutionRecord,
) {
  return [record, ...records].slice(0, MAX_TAG_ALONG_EXECUTION_RECORDS);
}

export function createRuleExecutionRecord(
  rule: TagAlongRule,
  snapshot:
    | { type: "price"; price: number; dataTimestamp: string }
    | { type: "candle"; candleClose: number; timeframe: TagAlongTimeframe; dataTimestamp: string },
): RuleExecutionRecord {
  return {
    actionType: rule.target.type,
    id: `tag-along-record-${Date.now()}-${crypto.randomUUID()}`,
    relatedSessionLogIds: [],
    ruleId: rule.id,
    sourceSnapshot:
      snapshot.type === "price"
        ? {
            dataTimestamp: snapshot.dataTimestamp,
            price: snapshot.price,
            symbol: rule.source.sourceSymbol,
          }
        : {
            candleClose: snapshot.candleClose,
            dataTimestamp: snapshot.dataTimestamp,
            symbol: rule.source.sourceSymbol,
            timeframe: snapshot.timeframe,
          },
    status: "would-trigger",
    targetAction: rule.target,
    triggeredAt: new Date().toISOString(),
  };
}

export function sanitizeTagAlongRules(value: unknown): TagAlongRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isTagAlongRule).map((rule) => ({
    ...rule,
    execution: {
      ...rule.execution,
      armedAt:
        typeof rule.execution.armedAt === "string"
          ? rule.execution.armedAt
          : rule.status === "armed"
            ? rule.updatedAt || rule.createdAt
            : undefined,
    },
    safety: {
      ...rule.safety,
      executionMode: rule.safety.executionMode ?? "simulation-only",
    },
  }));
}

export function sanitizeRuleExecutionRecords(value: unknown): RuleExecutionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRuleExecutionRecord).slice(0, MAX_TAG_ALONG_EXECUTION_RECORDS);
}

function canEvaluateRule(rule: TagAlongRule) {
  return (
    rule.status === "armed" &&
    (rule.safety.fireBehavior === "stay-armed" || rule.execution.executionCount < rule.safety.maxExecutions)
  );
}

function getPriceThreshold(level: number) {
  return Math.max(Math.abs(level) * 0.000005, 0.01);
}

function getNearTriggerThreshold(level: number) {
  return Math.max(Math.abs(level) * (TAG_ALONG_NEAR_TRIGGER_BPS / 10_000), getPriceThreshold(level));
}

function formatRuleLevel(level: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: level >= 1000 ? 0 : 4,
  }).format(level);
}

function formatUsdSize(sizeUsd: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: sizeUsd >= 100 ? 0 : 2,
  }).format(sizeUsd);
}

function parseWatchedCondition(value: string): ParsedTagAlongCommand["source"] | null {
  const sourceMatch = value.trim().match(
    /^([a-z0-9.-]+)(?:\s+(1m|5m|15m|1h|4h|1d))?\s+(touches?|crosses?|closes?)\s*(?:(above|below)\s+)?([0-9][0-9,]*(?:\.[0-9]+)?)(?:\s+on\s+(1m|5m|15m|1h|4h|1d))?$/i,
  );

  if (!sourceMatch) {
    return null;
  }

  const sourceSymbol = normalizeTagAlongSymbol(sourceMatch[1]);
  const timeframe = (sourceMatch[2] ?? sourceMatch[6])?.toLowerCase() as
    | TagAlongTimeframe
    | undefined;
  const verb = sourceMatch[3].toLowerCase();
  const direction = sourceMatch[4]?.toLowerCase();
  const level = parseRuleLevel(sourceMatch[5]);

  if (!sourceSymbol || level === null) {
    return null;
  }

  if (verb.startsWith("touch")) {
    return {
      level,
      sourceSymbol,
      type: "price-touches-level",
    };
  }

  if (verb.startsWith("cross")) {
    return {
      level,
      sourceSymbol,
      type:
        direction === "above"
          ? "price-crosses-above-level"
          : direction === "below"
            ? "price-crosses-below-level"
            : "price-crosses-level",
    };
  }

  if (verb.startsWith("close") && (direction === "above" || direction === "below")) {
    return {
      level,
      sourceSymbol,
      timeframe: timeframe ?? "1m",
      type: direction === "above" ? "candle-closes-above-level" : "candle-closes-below-level",
    };
  }

  return null;
}

function parseTargetAction(
  value: string,
): ParsedTagAlongCommand["target"] | { message: typeof TAG_ALONG_REDUCE_PERCENT_ERROR_MESSAGE } | null {
  const trimmedValue = value.trim();
  const closeMatch = trimmedValue.match(/^close\s+([a-z0-9-]+)(?:\s+(long|short))?(?:\s+position)?$/i);

  if (closeMatch) {
    const targetSymbol = normalizeTagAlongSymbol(closeMatch[1]);

    return targetSymbol
      ? {
          positionSide: closeMatch[2]?.toLowerCase() as "long" | "short" | undefined,
          targetSymbol,
          type: "close-position",
        }
      : null;
  }

  const reduceMatch = trimmedValue.match(
    /^reduce\s+(?:my\s+)?([a-z0-9-]+)\s+(?:(?:(long|short)|position)\s+by\s+)?([0-9]{1,3})\s*(?:%|percent|pct)?$/i,
  );

  if (reduceMatch) {
    const targetSymbol = normalizeTagAlongSymbol(reduceMatch[1]);
    const positionSide = reduceMatch[2]?.toLowerCase() as "long" | "short" | undefined;
    const reducePercent = Number(reduceMatch[3]);

    if (!targetSymbol) {
      return null;
    }

    if (![25, 50, 75, 100].includes(reducePercent)) {
      return { message: TAG_ALONG_REDUCE_PERCENT_ERROR_MESSAGE };
    }

    return {
      positionSide,
      reducePercent: reducePercent as 25 | 50 | 75 | 100,
      targetSymbol,
      type: "reduce-position-percent",
    };
  }

  const cancelAllMatch = trimmedValue.match(/^cancel\s+all\s+([a-z0-9-]+)\s+orders$/i);

  if (cancelAllMatch) {
    const targetSymbol = normalizeTagAlongSymbol(cancelAllMatch[1]);

    return targetSymbol
      ? {
          targetSymbol,
          type: "cancel-all-symbol-orders",
        }
      : null;
  }

  const breakEvenMatch = trimmedValue.match(/^move\s+([a-z0-9-]+)\s+stop\s+to\s+break[-\s]?even$/i);

  if (breakEvenMatch) {
    const targetSymbol = normalizeTagAlongSymbol(breakEvenMatch[1]);

    return targetSymbol
      ? {
          targetSymbol,
          type: "move-stop-to-break-even",
        }
      : null;
  }

  const enterMarketMatch = trimmedValue.match(
    /^(?:(buy|long|sell|short)\s+([a-z0-9.-]+)|open\s+([a-z0-9.-]+)\s+(long|short))$/i,
  );

  if (enterMarketMatch) {
    const directionToken = (
      enterMarketMatch[1] ?? enterMarketMatch[4] ?? ""
    ).toLowerCase();
    const targetSymbol = normalizeTagAlongSymbol(
      enterMarketMatch[2] ?? enterMarketMatch[3] ?? "",
    );
    const enterDirection =
      directionToken === "buy" || directionToken === "long"
        ? "long"
        : directionToken === "sell" || directionToken === "short"
          ? "short"
          : undefined;

    return targetSymbol && enterDirection
      ? {
          enterDirection,
          enterOrderType: "market",
          targetSymbol,
          type: "enter-market",
        }
      : null;
  }

  return null;
}

function parseRuleLevel(value: string) {
  const parsedValue = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function normalizeTagAlongSymbol(value: string): TagAlongSymbol | null {
  const normalizedValue = value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");

  if (!normalizedValue) {
    return null;
  }

  if (isIndexTriggerMarketSymbol(normalizedValue)) {
    return normalizedValue;
  }

  const baseSymbol = normalizedValue.replace(/-(USD|USDC)$/, "");

  if (!/^[A-Z0-9]{2,12}$/.test(baseSymbol)) {
    return null;
  }

  return `${baseSymbol}-USD`;
}

export function formatTagAlongSymbol(symbol: string) {
  return symbol.replace(/-(USD|USDC)$/, "");
}

function isTagAlongRule(value: unknown): value is TagAlongRule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rule = value as TagAlongRule;

  return (
    typeof rule.id === "string" &&
    typeof rule.name === "string" &&
    typeof rule.createdAt === "string" &&
    typeof rule.updatedAt === "string" &&
    isRuleStatus(rule.status) &&
    isWatchedCondition(rule.source) &&
    isTargetAction(rule.target) &&
    (!Array.isArray(rule.targetActions) || rule.targetActions.every(isTargetAction)) &&
    typeof rule.safety === "object" &&
    rule.safety !== null &&
    isTagAlongExecutionMode(rule.safety.executionMode ?? "simulation-only") &&
    rule.safety.maxExecutions === 1 &&
    typeof rule.safety.duplicateWindowMs === "number" &&
    typeof rule.safety.requireFreshSourceDataMs === "number" &&
    typeof rule.safety.requireTargetStillExists === "boolean" &&
    typeof rule.safety.requiresConfirmationForRiskIncrease === "boolean" &&
    typeof rule.execution === "object" &&
    rule.execution !== null &&
    typeof rule.execution.executionCount === "number"
  );
}

function isWatchedCondition(value: unknown): value is WatchedCondition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const condition = value as WatchedCondition;

  return (
    typeof condition.id === "string" &&
    isTagAlongSymbol(condition.sourceSymbol) &&
    isWatchedConditionType(condition.type) &&
    typeof condition.level === "number" &&
    Number.isFinite(condition.level)
  );
}

function isTargetAction(value: unknown): value is TargetAction {
  if (!value || typeof value !== "object") {
    return false;
  }

  const action = value as TargetAction;

  return (
    typeof action.id === "string" &&
    isTagAlongSymbol(action.targetSymbol) &&
    isTargetActionType(action.type)
  );
}

function isRuleExecutionRecord(value: unknown): value is RuleExecutionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as RuleExecutionRecord;

  return (
    typeof record.id === "string" &&
    typeof record.ruleId === "string" &&
    typeof record.triggeredAt === "string" &&
    (record.status === "simulated" ||
      record.status === "skipped" ||
      record.status === "would-trigger" ||
      record.status === "executed" ||
      record.status === "failed") &&
    isTargetActionType(record.actionType) &&
    isTargetAction(record.targetAction) &&
    Array.isArray(record.relatedSessionLogIds) &&
    typeof record.sourceSnapshot === "object" &&
    record.sourceSnapshot !== null &&
    isTagAlongSymbol(record.sourceSnapshot.symbol) &&
    typeof record.sourceSnapshot.dataTimestamp === "string"
  );
}

function isRuleStatus(value: unknown): value is RuleStatus {
  return (
    value === "draft" ||
    value === "armed" ||
    value === "paused" ||
    value === "triggered" ||
    value === "executing" ||
    value === "would-trigger" ||
    value === "executed" ||
    value === "skipped" ||
    value === "failed" ||
    value === "expired" ||
    value === "disarmed"
  );
}

function isTagAlongExecutionMode(value: unknown): value is TagAlongExecutionMode {
  return value === "simulation-only" || value === "live-risk-reducing" || value === "live-open-position";
}

function isWatchedConditionType(value: unknown): value is WatchedConditionType {
  return (
    value === "price-touches-level" ||
    value === "price-crosses-level" ||
    value === "price-crosses-above-level" ||
    value === "price-crosses-below-level" ||
    value === "candle-closes-above-level" ||
    value === "candle-closes-below-level"
  );
}

function isTargetActionType(value: unknown): value is TargetActionType {
  return (
    value === "close-position" ||
    value === "reduce-position-percent" ||
    value === "cancel-all-symbol-orders" ||
    value === "move-stop-to-break-even" ||
    value === "enter-market"
  );
}

function getFinitePositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isTagAlongSymbol(value: unknown): value is TagAlongSymbol {
  return (
    typeof value === "string" &&
    (isIndexTriggerMarketSymbol(value) || /^[A-Z0-9]{2,12}-USD$/.test(value))
  );
}
