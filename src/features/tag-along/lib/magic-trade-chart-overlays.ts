import { buildMagicTradeSentenceTextFromRule } from "./magic-trade-sentence";
import {
  formatTargetActions,
  formatTagAlongSymbol,
  getRuleTargetActions,
  type RuleExecutionRecord,
  type TagAlongRule,
  type TagAlongSymbol,
  type TagAlongWatchState,
  type WatchedCondition,
} from "./tag-along-rules";

export type MagicTradeChartOverlayStatus =
  | "armed"
  | "near-trigger"
  | "triggered"
  | "executing"
  | "executed"
  | "failed"
  | "skipped";

export type MagicTradeChartOverlay = {
  actionLabel: string;
  compactLabel: string;
  conditionLabel: string;
  executionResult?: string;
  id: string;
  level: number;
  ruleId: string;
  sentence: string;
  sourceSymbol: TagAlongSymbol;
  status: MagicTradeChartOverlayStatus;
  statusLabel: string;
  targetLabel: string;
  timeframe?: string;
};

type BuildMagicTradeChartOverlaysInput = {
  activeSymbol: TagAlongSymbol;
  executionRecords?: RuleExecutionRecord[];
  rules: TagAlongRule[];
  watchStateByRuleId?: Map<string, TagAlongWatchState>;
};

export function buildMagicTradeChartOverlays({
  activeSymbol,
  executionRecords = [],
  rules,
  watchStateByRuleId,
}: BuildMagicTradeChartOverlaysInput): MagicTradeChartOverlay[] {
  return rules.flatMap((rule) => {
    if (rule.source.sourceSymbol !== activeSymbol) {
      return [];
    }

    const status = getMagicTradeChartOverlayStatus(rule, watchStateByRuleId?.get(rule.id));

    if (!status) {
      return [];
    }

    const actions = getRuleTargetActions(rule);
    const targetLabel = formatOverlayTargetLabel(rule);
    const lastRecord = findLastExecutionRecord(executionRecords, rule.execution.lastExecutionRecordId, rule.id);

    return [
      {
        actionLabel: formatTargetActions(actions),
        compactLabel: `Magic: ${formatTagAlongSymbol(rule.source.sourceSymbol)} → ${targetLabel}`,
        conditionLabel: formatOverlayConditionLabel(rule.source),
        executionResult: lastRecord?.reason,
        id: `magic-trade-overlay-${rule.id}`,
        level: rule.source.level,
        ruleId: rule.id,
        sentence: buildMagicTradeSentenceTextFromRule(rule),
        sourceSymbol: rule.source.sourceSymbol,
        status,
        statusLabel: formatOverlayStatusLabel(status),
        targetLabel,
        timeframe: rule.source.timeframe,
      },
    ];
  });
}

function getMagicTradeChartOverlayStatus(
  rule: TagAlongRule,
  watchState?: TagAlongWatchState,
): MagicTradeChartOverlayStatus | null {
  if (rule.status === "draft" || rule.status === "paused" || rule.status === "expired" || rule.status === "disarmed") {
    return null;
  }

  if (rule.status === "armed") {
    return watchState === "near-trigger" ? "near-trigger" : "armed";
  }

  if (rule.status === "would-trigger" || rule.status === "triggered") {
    return "triggered";
  }

  if (
    rule.status === "executing" ||
    rule.status === "executed" ||
    rule.status === "failed" ||
    rule.status === "skipped"
  ) {
    return rule.status;
  }

  return null;
}

function formatOverlayConditionLabel(condition: WatchedCondition) {
  const timeframe = condition.timeframe ? ` ${condition.timeframe}` : "";

  switch (condition.type) {
    case "price-touches-level":
      return "touches";
    case "price-crosses-level":
      return "crosses";
    case "price-crosses-above-level":
      return "crosses above";
    case "price-crosses-below-level":
      return "crosses below";
    case "candle-closes-above-level":
      return `closes above${timeframe}`;
    case "candle-closes-below-level":
      return `closes below${timeframe}`;
  }
}

function formatOverlayTargetLabel(rule: TagAlongRule) {
  const targets = Array.from(
    new Set(getRuleTargetActions(rule).map((action) => formatTagAlongSymbol(action.targetSymbol))),
  );

  if (targets.length === 0) {
    return formatTagAlongSymbol(rule.target.targetSymbol);
  }

  if (targets.length === 1) {
    return targets[0];
  }

  return `${targets[0]} +${targets.length - 1}`;
}

function formatOverlayStatusLabel(status: MagicTradeChartOverlayStatus) {
  switch (status) {
    case "armed":
      return "Armed";
    case "near-trigger":
      return "Near trigger";
    case "triggered":
      return "Triggered";
    case "executing":
      return "Executing";
    case "executed":
      return "Executed";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
  }
}

function findLastExecutionRecord(
  executionRecords: RuleExecutionRecord[],
  preferredRecordId: string | undefined,
  ruleId: string,
) {
  if (preferredRecordId) {
    const preferredRecord = executionRecords.find((record) => record.id === preferredRecordId);

    if (preferredRecord) {
      return preferredRecord;
    }
  }

  return executionRecords.findLast((record) => record.ruleId === ruleId);
}
