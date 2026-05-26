import {
  deriveBlockedTimeWindowRuleState,
  type BlockedTimeWindowRule,
} from "@/features/discipline/lib/discipline-time-window";
import type { DisciplineRuleState } from "@/features/discipline/lib/discipline-server-state";

export type ClientOverrideBondConfig = {
  baseAmountUsdc: number;
};

export type ClientOverrideBondPreview = {
  baseAmountUsdc: number;
  finalAmountUsdc: number;
  multiplier: number;
  portalAmountUsdc: number;
  reserveAmountUsdc: number;
  vaultAmountUsdc: number;
};

export type BlockedTimeWindowRulesContainer = {
  blockedTimeWindows?: BlockedTimeWindowRule[];
};

export type BlockedTimeWindowOverridePrompt<TRules extends BlockedTimeWindowRulesContainer> = {
  intendedMinRR: number | null;
  intendedRules: TRules;
  message: string;
  preview: ClientOverrideBondPreview;
  ruleId: string;
  ruleType: "blocked_time_window";
};

export type BlockedTimeWindowServerRuleState = {
  state?: DisciplineRuleState;
};

export function buildClientOverrideBondPreview(
  config: ClientOverrideBondConfig,
): ClientOverrideBondPreview {
  return {
    baseAmountUsdc: config.baseAmountUsdc,
    finalAmountUsdc: config.baseAmountUsdc,
    multiplier: 1,
    portalAmountUsdc: config.baseAmountUsdc * 0.2,
    reserveAmountUsdc: config.baseAmountUsdc * 0.1,
    vaultAmountUsdc: config.baseAmountUsdc * 0.7,
  };
}

export function buildBlockedTimeWindowOverridePrompt<TRules extends BlockedTimeWindowRulesContainer>({
  enabled,
  currentRules,
  minRiskReward,
  overrideBondConfig,
  ruleId,
}: {
  currentRules: TRules;
  enabled: boolean;
  minRiskReward: number | null;
  overrideBondConfig: ClientOverrideBondConfig;
  ruleId: string;
}): BlockedTimeWindowOverridePrompt<TRules> | null {
  const currentRule = currentRules.blockedTimeWindows?.find((rule) => rule.id === ruleId) ?? null;

  if (!currentRule || enabled || deriveBlockedTimeWindowRuleState(currentRule) !== "locked") {
    return null;
  }

  return {
    intendedMinRR: minRiskReward,
    intendedRules: {
      ...currentRules,
      blockedTimeWindows: (currentRules.blockedTimeWindows ?? []).map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: false } : rule,
      ),
    },
    message: "Rule locked. Override Bond required to weaken this rule.",
    preview: buildClientOverrideBondPreview(overrideBondConfig),
    ruleId,
    ruleType: "blocked_time_window",
  };
}

export function resolveBlockedTimeWindowDisplayState(
  rule: BlockedTimeWindowRule,
  serverRuleState?: BlockedTimeWindowServerRuleState | null,
): DisciplineRuleState {
  if (serverRuleState?.state === "overridden") {
    return "overridden";
  }

  return deriveBlockedTimeWindowRuleState(rule);
}
