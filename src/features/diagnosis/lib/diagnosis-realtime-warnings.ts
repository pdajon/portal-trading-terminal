import type { JournalMemoryEvent } from "@/features/journal/lib/journal-memory-events";
import type {
  DiagnosisFinding,
  OperatorDiagnosis,
  OperatorDiagnosisJournalEntry,
  RecommendedDisciplineRuleType,
} from "./operator-diagnosis";

export type DiagnosisRealtimeWarningSeverity = "info" | "warning" | "critical";

export type DiagnosisRealtimeWarningTrigger =
  | "diagnosed_post_loss_pattern"
  | "diagnosed_time_window_weakness"
  | "diagnosed_manual_entry_weakness"
  | "diagnosed_override_pattern"
  | "diagnosed_plan_broken_pattern"
  | "diagnosed_ai_warning_ignored"
  | "activated_plan_rule_relevant"
  | "unsupported_recommendation_warning";

export type DiagnosisRealtimeWarning = {
  actionType?: string;
  id: string;
  message: string;
  severity: DiagnosisRealtimeWarningSeverity;
  sourceFindingId?: string;
  sourcePlanRuleId?: string;
  symbol?: string;
  timestamp: string;
  title: string;
  trigger: DiagnosisRealtimeWarningTrigger;
  ttlMs?: number;
};

export type DiagnosisRealtimeAction = {
  actionType?: string;
  hasPlanContext?: boolean;
  orderType?: "market" | "limit" | string;
  riskIncreasing?: boolean;
  side?: "long" | "short" | null;
  source?: "manual" | "trigger" | "magic_trade" | string;
  symbol?: string | null;
};

export type DiagnosisRealtimeActiveDisciplineState = {
  cooldownAfterLossMinutes: number | null;
  maxTradesPerDay: number | null;
  minRiskReward: number | null;
  tradesPlacedToday: number;
};

export type DiagnosisRealtimeWarningInput = {
  activeDisciplineState: DiagnosisRealtimeActiveDisciplineState;
  currentAction: DiagnosisRealtimeAction | null;
  diagnosis: OperatorDiagnosis;
  existingAiWarningCount?: number;
  journalEntries: Pick<OperatorDiagnosisJournalEntry, "id" | "realizedPnl" | "status" | "timestamp" | "closedAt" | "openedAt">[];
  journalMemoryEvents: JournalMemoryEvent[];
  now?: string;
};

type ActivatedPlanRule = {
  recommendedRuleId: string;
  ruleType: string;
};

const DEFAULT_TTL_MS = 90_000;
const RECENT_LOSS_WINDOW_MS = 24 * 60 * 60 * 1000;
const UNSUPPORTED_RULE_TYPES = new Set<RecommendedDisciplineRuleType>([
  "blocked_time_window",
  "override_bond_warning",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getActionRiskIncreasing(action: DiagnosisRealtimeAction | null) {
  return action?.riskIncreasing !== false;
}

function getFindingByCategory(diagnosis: OperatorDiagnosis, category: DiagnosisFinding["category"]) {
  return diagnosis.profitLeaks.find((finding) => finding.category === category) ?? null;
}

function getNow(inputNow?: string) {
  return inputNow ?? new Date().toISOString();
}

function getEntryTime(entry: Pick<OperatorDiagnosisJournalEntry, "timestamp" | "closedAt" | "openedAt">) {
  return entry.closedAt ?? entry.openedAt ?? entry.timestamp;
}

function hasRecentLoss(
  entries: DiagnosisRealtimeWarningInput["journalEntries"],
  now: string,
) {
  const nowMs = Date.parse(now);

  if (!Number.isFinite(nowMs)) {
    return false;
  }

  return entries.some((entry) => {
    if (entry.status !== "closed" || typeof entry.realizedPnl !== "number" || entry.realizedPnl >= 0) {
      return false;
    }

    const entryMs = Date.parse(getEntryTime(entry));
    return Number.isFinite(entryMs) && nowMs - entryMs >= 0 && nowMs - entryMs <= RECENT_LOSS_WINDOW_MS;
  });
}

function getFindingHour(finding: DiagnosisFinding) {
  const rawHour = finding.recommendedRule?.proposedValue.hour;

  if (typeof rawHour === "number" && Number.isInteger(rawHour) && rawHour >= 0 && rawHour <= 23) {
    return rawHour;
  }

  const label = typeof finding.recommendedRule?.proposedValue.label === "string"
    ? finding.recommendedRule.proposedValue.label
    : `${finding.title} ${finding.summary} ${finding.recommendation}`;
  const match = label.match(/\b([01]?\d|2[0-3]):00\b/);

  return match ? Number(match[1]) : null;
}

function isCurrentWeakHour(finding: DiagnosisFinding, now: string) {
  const findingHour = getFindingHour(finding);
  const nowMs = Date.parse(now);

  if (findingHour === null || !Number.isFinite(nowMs)) {
    return false;
  }

  return new Date(nowMs).getHours() === findingHour;
}

function isManualMarketAction(action: DiagnosisRealtimeAction | null) {
  return action?.source === "manual" && action.orderType === "market" && getActionRiskIncreasing(action);
}

function createWarning(details: Omit<DiagnosisRealtimeWarning, "id" | "timestamp" | "ttlMs"> & {
  now: string;
  ttlMs?: number;
}) {
  const { now, ttlMs, ...warningDetails } = details;
  const id = [
    "diagnosis",
    warningDetails.trigger,
    warningDetails.sourceFindingId ?? warningDetails.sourcePlanRuleId ?? "any",
    warningDetails.symbol ?? "any",
    warningDetails.actionType ?? "any",
  ].join(":");

  return {
    ...warningDetails,
    id,
    timestamp: now,
    ttlMs: ttlMs ?? DEFAULT_TTL_MS,
  };
}

function getActivatedPlanRules(events: JournalMemoryEvent[]) {
  return events.flatMap((event): ActivatedPlanRule[] => {
    if (event.type !== "plan_changed" || event.metadata?.source !== "operator_diagnosis") {
      return [];
    }

    const activatedRules = event.metadata.activatedRules;

    if (!Array.isArray(activatedRules)) {
      return [];
    }

    return activatedRules.flatMap((rule): ActivatedPlanRule[] => {
      if (!isRecord(rule)) {
        return [];
      }

      const recommendedRuleId = rule.recommendedRuleId;
      const ruleType = rule.ruleType;

      return typeof recommendedRuleId === "string" && typeof ruleType === "string"
        ? [{ recommendedRuleId, ruleType }]
        : [];
    });
  });
}

function isActivatedRuleRelevant(input: {
  action: DiagnosisRealtimeAction | null;
  activeDisciplineState: DiagnosisRealtimeActiveDisciplineState;
  hasRecentLoss: boolean;
  rule: ActivatedPlanRule;
}) {
  if (!getActionRiskIncreasing(input.action)) {
    return false;
  }

  switch (input.rule.ruleType) {
    case "cooldown_after_loss":
      return input.hasRecentLoss || input.activeDisciplineState.cooldownAfterLossMinutes !== null;
    case "max_trades_per_day":
      return input.activeDisciplineState.maxTradesPerDay !== null;
    case "min_rr":
      return input.activeDisciplineState.minRiskReward !== null || input.action?.hasPlanContext === false;
    default:
      return false;
  }
}

function addWarning(
  warningsById: Map<string, DiagnosisRealtimeWarning>,
  warning: DiagnosisRealtimeWarning | null,
) {
  if (!warning) {
    return;
  }

  warningsById.set(warning.id, warning);
}

export function deriveDiagnosisRealtimeWarningsV1(
  input: DiagnosisRealtimeWarningInput,
): DiagnosisRealtimeWarning[] {
  const now = getNow(input.now);
  const warningsById = new Map<string, DiagnosisRealtimeWarning>();
  const action = input.currentAction;
  const riskIncreasing = getActionRiskIncreasing(action);
  const recentLoss = hasRecentLoss(input.journalEntries, now);
  const symbol = action?.symbol ?? undefined;
  const actionType = action?.actionType;

  const postLossFinding = getFindingByCategory(input.diagnosis, "post_loss_behavior");
  if (postLossFinding && riskIncreasing && recentLoss) {
    addWarning(
      warningsById,
      createWarning({
        actionType,
        message: "This matches your diagnosed weak pattern: trades after losses have hurt your Net PnL.",
        now,
        severity: "warning",
        sourceFindingId: postLossFinding.id,
        symbol,
        title: "Post-loss risk.",
        trigger: "diagnosed_post_loss_pattern",
      }),
    );
  }

  const timeWindowFinding = getFindingByCategory(input.diagnosis, "time_window");
  if (timeWindowFinding && riskIncreasing && isCurrentWeakHour(timeWindowFinding, now)) {
    addWarning(
      warningsById,
      createWarning({
        actionType,
        message: "You underperform during this time window. Portal recommends standing down. This is a warning only in v1.",
        now,
        severity: "warning",
        sourceFindingId: timeWindowFinding.id,
        symbol,
        title: "Weak time window.",
        trigger: "diagnosed_time_window_weakness",
      }),
    );

    if (timeWindowFinding.recommendedRule?.ruleType === "blocked_time_window") {
      addWarning(
        warningsById,
        createWarning({
          actionType,
          message: "Portal has diagnosed this time window as weak. Time-window blocking is not active in v1, so this is a warning only.",
          now,
          severity: "info",
          sourceFindingId: timeWindowFinding.id,
          sourcePlanRuleId: timeWindowFinding.recommendedRule.id,
          symbol,
          title: "Warning only.",
          trigger: "unsupported_recommendation_warning",
        }),
      );
    }
  }

  const manualEntryFinding = getFindingByCategory(input.diagnosis, "manual_entry");
  if (manualEntryFinding && isManualMarketAction(action)) {
    addWarning(
      warningsById,
      createWarning({
        actionType,
        message: "Your manual entries underperform planned or automated trades.",
        now,
        severity: "warning",
        sourceFindingId: manualEntryFinding.id,
        symbol,
        title: "Manual entry risk.",
        trigger: "diagnosed_manual_entry_weakness",
      }),
    );
  }

  const overrideFinding = getFindingByCategory(input.diagnosis, "override_bond");
  if (overrideFinding && action?.actionType === "override_bond") {
    addWarning(
      warningsById,
      createWarning({
        actionType,
        message: "Override Bonds are becoming a pattern. That usually means pressure trading.",
        now,
        severity: "critical",
        sourceFindingId: overrideFinding.id,
        symbol,
        title: "Override pattern.",
        trigger: "diagnosed_override_pattern",
      }),
    );
  }

  const planBrokenFinding = getFindingByCategory(input.diagnosis, "plan_broken");
  if (planBrokenFinding && riskIncreasing && action?.hasPlanContext === false) {
    addWarning(
      warningsById,
      createWarning({
        actionType,
        message: "Broken plans are showing up in your trade history. Confirm the plan before adding risk.",
        now,
        severity: "warning",
        sourceFindingId: planBrokenFinding.id,
        symbol,
        title: "Plan risk.",
        trigger: "diagnosed_plan_broken_pattern",
      }),
    );
  }

  const aiWarningIgnoredFinding = getFindingByCategory(input.diagnosis, "ai_warning_ignored");
  if (aiWarningIgnoredFinding && (input.existingAiWarningCount ?? 0) > 0) {
    addWarning(
      warningsById,
      createWarning({
        actionType,
        message: "You have dismissed warnings before. Review this before acting.",
        now,
        severity: "warning",
        sourceFindingId: aiWarningIgnoredFinding.id,
        symbol,
        title: "Don't ignore this one.",
        trigger: "diagnosed_ai_warning_ignored",
      }),
    );
  }

  for (const rule of getActivatedPlanRules(input.journalMemoryEvents)) {
    if (!isActivatedRuleRelevant({ action, activeDisciplineState: input.activeDisciplineState, hasRecentLoss: recentLoss, rule })) {
      continue;
    }

    addWarning(
      warningsById,
      createWarning({
        actionType,
        message: "This action touches a rule from your recommended plan.",
        now,
        severity: "info",
        sourcePlanRuleId: rule.recommendedRuleId,
        symbol,
        title: "Discipline Plan active.",
        trigger: "activated_plan_rule_relevant",
      }),
    );
  }

  for (const finding of input.diagnosis.profitLeaks) {
    const recommendedRule = finding.recommendedRule;

    if (!recommendedRule || !UNSUPPORTED_RULE_TYPES.has(recommendedRule.ruleType)) {
      continue;
    }

    if (recommendedRule.ruleType === "blocked_time_window" && !isCurrentWeakHour(finding, now)) {
      continue;
    }

    if (recommendedRule.ruleType === "override_bond_warning" && action?.actionType !== "override_bond") {
      continue;
    }

    addWarning(
      warningsById,
      createWarning({
        actionType,
        message: "This recommendation is warning-only in v1. Portal is not enforcing it.",
        now,
        severity: "info",
        sourceFindingId: finding.id,
        sourcePlanRuleId: recommendedRule.id,
        symbol,
        title: "Warning only.",
        trigger: "unsupported_recommendation_warning",
      }),
    );
  }

  const severityRank: Record<DiagnosisRealtimeWarningSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return [...warningsById.values()].sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      left.trigger.localeCompare(right.trigger),
  );
}
