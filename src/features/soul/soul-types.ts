export type SoulObservationType =
  | "overtrading"
  | "revenge_trading"
  | "rapid_re_entry"
  | "missing_protection"
  | "weak_protected_rr"
  | "impulsive_execution"
  | "ignored_cooldown_behavior";

export type SoulSeverity = "info" | "warning" | "critical";

export type SoulEvidenceSummary = {
  eventIds?: string[];
  observationIds?: string[];
  summary: string;
  tradeIds?: string[];
};

export type SoulObservation = {
  createdAt: string;
  evidence: SoulEvidenceSummary;
  id: string;
  severity: SoulSeverity;
  type: SoulObservationType;
};

export type SoulTradeSnapshot = {
  closedAt?: string | null;
  hasStopLoss?: boolean;
  hasTakeProfit?: boolean;
  id: string;
  openedAt: string;
  plannedRewardRiskRatio?: number | null;
  pnl?: number | null;
  source?: "market" | "limit" | "order_zone" | "trigger" | "magic_trade" | string | null;
};

export type SoulCooldownWindow = {
  endedAt: string;
  id: string;
  startedAt: string;
};

export type SoulObservationInput = {
  cooldownWindows?: SoulCooldownWindow[];
  now: string;
  trades: SoulTradeSnapshot[];
};

export type SoulSuggestedRuleType =
  | "cooldown_after_loss"
  | "max_trades_per_day"
  | "min_rr"
  | "require_protection"
  | "market_entry_warning"
  | "show_less_warnings";

export type SoulSuggestedRule = {
  parameters?: Record<string, unknown>;
  summary: string;
  type: SoulSuggestedRuleType;
};

export type SoulRecommendationType = SoulSuggestedRuleType;

export type SoulRecommendation = {
  accepted: boolean;
  createdAt: string;
  dismissalCount: number;
  evidence: SoulEvidenceSummary;
  id: string;
  severity: SoulSeverity;
  showLessMode: boolean;
  snoozed: boolean;
  suggestedRule: SoulSuggestedRule;
  type: SoulRecommendationType;
};

export type SoulRecommendationAction =
  | { action: "accept" }
  | { action: "dismiss" }
  | { action: "show_less" }
  | { action: "snooze"; snoozed?: boolean };

export type SoulEscalationState = {
  evidenceRecap: string;
  repeatedDismissals: boolean;
  repeatedIgnoredWarnings: boolean;
  showWarningsLess: boolean;
};

export type SoulAcceptedRule = {
  acceptedAt: string;
  id: string;
  summary: string;
  type: SoulSuggestedRuleType;
};

export type SoulPatternMemory = {
  count: number;
  lastObservedAt: string;
  type: SoulObservationType;
};

export type SoulDismissedRecommendationMemory = {
  dismissalCount: number;
  id: string;
  lastDismissedAt: string;
  recommendationType?: SoulRecommendationType;
  reducedFrequency?: boolean;
};

export type SoulMemory = {
  acceptedRules: SoulAcceptedRule[];
  createdAt: string;
  dismissedRecommendations: SoulDismissedRecommendationMemory[];
  repeatedHarmfulPatterns: SoulPatternMemory[];
  triggeredObservations: SoulObservation[];
  updatedAt: string;
};

export type SoulExpActionType =
  | "journaled_trade_recorded"
  | "magic_trade_used"
  | "trade_execution_logged"
  | "protected_trade_taken"
  | "cooldown_respected"
  | "rule_accepted"
  | "impulse_avoided"
  | "harmful_pattern_repeated";

export type SoulExpEvent = {
  id: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  type: SoulExpActionType;
  weight?: number;
};

export type SoulExpState = {
  events: Array<SoulExpEvent & { exp: number }>;
  level: number;
  totalExp: number;
  updatedAt: string;
};

export type SoulLevelProgress = {
  currentLevelExp: number;
  level: number;
  nextLevelExp: number | null;
};

export type SoulEvolutionStage = "dormant" | "forming" | "stabilizing" | "hardened";

export type SoulEvolutionState = {
  dominantPattern: SoulObservationType | null;
  level: number;
  stage: SoulEvolutionStage;
  unlockedRewards: never[];
  updatedAt: string;
};

export type SoulForceFieldStrength = "none" | "weak" | "full";

export type SoulForceFieldState = {
  hasStopLoss: boolean;
  hasTakeProfit: boolean;
  reason: "no_protection" | "partial_protection" | "stabilized_protection";
  strength: SoulForceFieldStrength;
};
