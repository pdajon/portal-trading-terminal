import type { RecommendedDisciplineRule } from "./operator-diagnosis";
import {
  parseBlockedTimeWindowValue,
  type BlockedTimeWindowRule,
} from "@/features/discipline/lib/discipline-time-window";

export type ActivatableDisciplineRules = {
  blockedTimeWindows?: BlockedTimeWindowRule[];
  cooldownAfterLossMinutes: number | null;
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
};

export type DisciplinePlanActivationResult = {
  accepted: boolean;
  activatedRules: ActivatedDisciplineRule[];
  blockedRules: BlockedDisciplineRule[];
  message: string;
  nextMinRiskReward: number | null;
  nextRules: ActivatableDisciplineRules;
  skippedRules: SkippedDisciplineRule[];
};

export type ActivatedDisciplineRule = {
  appliedValue: Record<string, unknown>;
  recommendedRuleId: string;
  ruleType: string;
};

export type SkippedDisciplineRule = {
  message: string;
  reasonCode: "user_unselected" | "unsupported_rule_type" | "missing_rule_data";
  recommendedRuleId: string;
  ruleType: string;
};

export type BlockedDisciplineRule = {
  message: string;
  reasonCode: "locked_rule_cannot_be_weakened" | "activation_failed";
  recommendedRuleId: string;
  ruleType: string;
};

export type RecommendedDisciplineRuleSupportStatus = {
  message: string;
  status: "ready" | "unsupported" | "blocked";
};

export type DisciplinePlanActivationInput = {
  currentMinRiskReward: number | null;
  currentRules: ActivatableDisciplineRules;
  lockedRuleIds?: string[];
  recommendedRules: RecommendedDisciplineRule[];
  selectedRuleIds: string[];
};

type MappedRule =
  | {
      clientRuleId: "cooldownAfterLossMinutes" | "maxTradesPerDay";
      proposedValue: number;
      value: Record<string, unknown>;
    }
  | {
      clientRuleId: "blockedTimeWindows";
      proposedValue: BlockedTimeWindowRule;
      value: Record<string, unknown>;
    }
  | null;

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getNumberValue(rule: RecommendedDisciplineRule, keys: string[]) {
  for (const key of keys) {
    const value = rule.proposedValue[key];

    if (isFinitePositiveNumber(value)) {
      return value;
    }
  }

  return null;
}

function mapRecommendedRule(rule: RecommendedDisciplineRule): MappedRule {
  switch (rule.ruleType) {
    case "cooldown_after_loss": {
      const minutes = getNumberValue(rule, ["minutes", "cooldownMinutes"]);
      return minutes === null
        ? null
        : {
            clientRuleId: "cooldownAfterLossMinutes",
            proposedValue: Math.floor(minutes),
            value: { minutes: Math.floor(minutes) },
          };
    }
    case "max_trades_per_day": {
      const maxTrades = getNumberValue(rule, ["maxTrades", "trades"]);
      return maxTrades === null
        ? null
        : {
            clientRuleId: "maxTradesPerDay",
            proposedValue: Math.floor(maxTrades),
            value: { maxTrades: Math.floor(maxTrades) },
          };
    }
    case "blocked_time_window":
      return mapBlockedTimeWindowRule(rule);
    case "override_bond_warning":
      return null;
  }
}

function mapBlockedTimeWindowRule(rule: RecommendedDisciplineRule): MappedRule {
  const parsed = parseBlockedTimeWindowValue(rule.proposedValue);

  if (!parsed) {
    return null;
  }

  const id = `blocked-window:${rule.sourceFindingId ?? rule.id}`;
  const windowRule: BlockedTimeWindowRule = {
    daysOfWeek: parsed.daysOfWeek,
    enabled: true,
    endTime: parsed.endTime,
    id,
    label: parsed.label ?? rule.title,
    source: "operator_diagnosis",
    sourceFindingId: rule.sourceFindingId,
    startTime: parsed.startTime,
    timezone: parsed.timezone,
  };

  return {
    clientRuleId: "blockedTimeWindows",
    proposedValue: windowRule,
    value: {
      endTime: windowRule.endTime,
      id: windowRule.id,
      source: windowRule.source,
      sourceFindingId: windowRule.sourceFindingId,
      startTime: windowRule.startTime,
    },
  };
}

function isLockedRuleWeakened(input: {
  clientRuleId: "blockedTimeWindows" | "cooldownAfterLossMinutes" | "maxTradesPerDay";
  currentMinRiskReward: number | null;
  currentRules: ActivatableDisciplineRules;
  lockedRuleIds: Set<string>;
  proposedValue: number | BlockedTimeWindowRule;
}) {
  void input.currentMinRiskReward;
  if (!input.lockedRuleIds.has(input.clientRuleId)) {
    return false;
  }

  switch (input.clientRuleId) {
    case "blockedTimeWindows":
      return false;
    case "cooldownAfterLossMinutes":
      return typeof input.proposedValue === "number" &&
        input.currentRules.cooldownAfterLossMinutes !== null &&
        input.proposedValue < input.currentRules.cooldownAfterLossMinutes;
    case "maxTradesPerDay":
      return typeof input.proposedValue === "number" &&
        input.currentRules.maxTradesPerDay !== null &&
        input.proposedValue > input.currentRules.maxTradesPerDay;
  }
}

function upsertBlockedTimeWindow(
  windows: BlockedTimeWindowRule[],
  nextWindow: BlockedTimeWindowRule,
) {
  const existingIndex = windows.findIndex((window) => window.id === nextWindow.id);

  if (existingIndex === -1) {
    return [...windows, nextWindow];
  }

  return windows.map((window, index) => index === existingIndex ? { ...window, ...nextWindow } : window);
}

function applyMappedRule(input: {
  mappedRule: NonNullable<MappedRule>;
  nextMinRiskReward: number | null;
  nextRules: ActivatableDisciplineRules;
}) {
  switch (input.mappedRule.clientRuleId) {
    case "blockedTimeWindows": {
      const existingWindows = input.nextRules.blockedTimeWindows ?? [];
      return {
        nextMinRiskReward: input.nextMinRiskReward,
        nextRules: {
          ...input.nextRules,
          blockedTimeWindows: upsertBlockedTimeWindow(existingWindows, input.mappedRule.proposedValue),
        },
      };
    }
    case "cooldownAfterLossMinutes":
      return {
        nextMinRiskReward: input.nextMinRiskReward,
        nextRules: {
          ...input.nextRules,
          cooldownAfterLossMinutes: input.mappedRule.proposedValue,
        },
      };
    case "maxTradesPerDay":
      return {
        nextMinRiskReward: input.nextMinRiskReward,
        nextRules: {
          ...input.nextRules,
          maxTradesPerDay: input.mappedRule.proposedValue,
        },
      };
  }
}

export function getRecommendedDisciplineRuleSupportStatus(
  rule: RecommendedDisciplineRule,
  context: Pick<DisciplinePlanActivationInput, "currentMinRiskReward" | "currentRules" | "lockedRuleIds">,
): RecommendedDisciplineRuleSupportStatus {
  const mappedRule = mapRecommendedRule(rule);

  if (!mappedRule) {
    if (rule.ruleType === "blocked_time_window") {
      return {
        message: "Missing time window data.",
        status: "unsupported",
      };
    }

    return {
      message: "Unsupported in v1.",
      status: "unsupported",
    };
  }

  if (
    isLockedRuleWeakened({
      clientRuleId: mappedRule.clientRuleId,
      currentMinRiskReward: context.currentMinRiskReward,
      currentRules: context.currentRules,
      lockedRuleIds: new Set(context.lockedRuleIds ?? []),
      proposedValue: mappedRule.proposedValue,
    })
  ) {
    return {
      message: "Blocked by locked rule.",
      status: "blocked",
    };
  }

  return {
    message: "Ready.",
    status: "ready",
  };
}

export function activateRecommendedDisciplinePlanV1(
  input: DisciplinePlanActivationInput,
): DisciplinePlanActivationResult {
  let nextRules = { ...input.currentRules };
  let nextMinRiskReward = input.currentMinRiskReward;
  const selectedRuleIds = new Set(input.selectedRuleIds);
  const lockedRuleIds = new Set(input.lockedRuleIds ?? []);
  const activatedRules: ActivatedDisciplineRule[] = [];
  const skippedRules: SkippedDisciplineRule[] = [];
  const blockedRules: BlockedDisciplineRule[] = [];

  input.recommendedRules.forEach((rule) => {
    if (!selectedRuleIds.has(rule.id)) {
      skippedRules.push({
        message: "Rule was not selected for activation.",
        reasonCode: "user_unselected",
        recommendedRuleId: rule.id,
        ruleType: rule.ruleType,
      });
      return;
    }

    const mappedRule = mapRecommendedRule(rule);

    if (!mappedRule) {
      skippedRules.push({
        message:
          rule.ruleType === "blocked_time_window"
            ? "Time-window recommendation is missing a usable time range."
            : "This recommendation is not supported for activation in v1.",
        reasonCode: rule.ruleType === "blocked_time_window" ? "missing_rule_data" : "unsupported_rule_type",
        recommendedRuleId: rule.id,
        ruleType: rule.ruleType,
      });
      return;
    }

    if (
      isLockedRuleWeakened({
        clientRuleId: mappedRule.clientRuleId,
        currentMinRiskReward: input.currentMinRiskReward,
        currentRules: input.currentRules,
        lockedRuleIds,
        proposedValue: mappedRule.proposedValue,
      })
    ) {
      blockedRules.push({
        message: "Rule blocked. Existing locked rule is stricter.",
        reasonCode: "locked_rule_cannot_be_weakened",
        recommendedRuleId: rule.id,
        ruleType: rule.ruleType,
      });
      return;
    }

    const applied = applyMappedRule({ mappedRule, nextMinRiskReward, nextRules });
    nextRules = applied.nextRules;
    nextMinRiskReward = applied.nextMinRiskReward;
    activatedRules.push({
      appliedValue: mappedRule.value,
      recommendedRuleId: rule.id,
      ruleType: rule.ruleType,
    });
  });

  const accepted = activatedRules.length > 0;
  let message = "No selected rules were activated.";

  if (activatedRules.length > 0 && blockedRules.length > 0) {
    message = "Some rules were not activated because existing locked rules are stricter.";
  } else if (activatedRules.length > 0 && skippedRules.some((rule) => rule.reasonCode === "unsupported_rule_type")) {
    message = `${activatedRules.length} rules activated. ${skippedRules.filter((rule) => rule.reasonCode === "unsupported_rule_type").length} skipped because it is not supported in v1.`;
  } else if (activatedRules.length > 0) {
    message = "Plan activated.";
  } else if (blockedRules.length > 0) {
    message = "Rule blocked. Existing locked rule is stricter.";
  }

  return {
    accepted,
    activatedRules,
    blockedRules,
    message,
    nextMinRiskReward,
    nextRules,
    skippedRules,
  };
}
