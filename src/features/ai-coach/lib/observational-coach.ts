import {
  deriveJournalInsightsV1,
  type JournalInsightJournalEntry,
  type JournalInsightReplayFrame,
  type JournalInsightSessionLogEntry,
  type JournalInsightsEntryStyle,
  type JournalInsightsV1,
} from "@/features/journal/lib/journal-insights";
import type {
  BaselineEntryStyleProxy,
  BaselineExecutionMode,
  BaselineMetricRow,
  BaselineProfile,
  HoldTimeBucket,
  SessionIntelligenceResult,
  TimeOfDayBucket,
} from "@/features/baseline-import/types";
import {
  getBaselineSessionInsightSafetyDetails,
  summarizeBaselineSessionInsightConsumption,
  type BaselineSessionInsightConsumptionSummary,
} from "@/features/baseline-import/session-insight-consumption";
import {
  deriveDiagnosisRealtimeWarningsV1,
  type DiagnosisRealtimeWarning,
} from "@/features/diagnosis/lib/diagnosis-realtime-warnings";
import type { JournalMemoryEvent } from "@/features/journal/lib/journal-memory-events";
import type { OperatorDiagnosis } from "@/features/diagnosis/lib/operator-diagnosis";
import type { ImportedSessionSupportingContext } from "@/features/diagnosis/lib/imported-session-supporting-context";
import type { EvidenceComparisonResult } from "@/features/diagnosis/lib/evidence-comparison";
import { buildEvidenceComparisonDisplayCopies } from "@/features/diagnosis/lib/evidence-comparison-copy";

export type AiCoachState = "Watching" | "Insight Available" | "Warning" | "Not Enough Data";

export type AiCoachRealtimeWarningSeverity = "info" | "warning" | "critical";

export type AiCoachRealtimeWarningSource =
  | "discipline"
  | "operator_diagnosis"
  | "risk_gate"
  | "override_bond"
  | "trade_behavior"
  | "position";

export type AiCoachRealtimeWarningTrigger =
  | "risk_increasing_blocked"
  | "cooldown_active"
  | "max_daily_loss_hit"
  | "max_trades_hit"
  | "min_rr_failed"
  | "market_entry_confirmation_required"
  | "no_trade_zone_active"
  | "protection_required"
  | "override_bond_required"
  | "override_bond_posted"
  | "reverse_blocked"
  | "sizing_up_after_loss"
  | "repeated_override"
  | "revenge_risk"
  | "diagnosed_post_loss_pattern"
  | "diagnosed_time_window_weakness"
  | "diagnosed_manual_entry_weakness"
  | "diagnosed_override_pattern"
  | "diagnosed_plan_broken_pattern"
  | "diagnosed_ai_warning_ignored"
  | "activated_plan_rule_relevant"
  | "unsupported_recommendation_warning";

export type AiCoachRealtimeWarning = {
  actionLabel?: string;
  id: string;
  message: string;
  relatedRuleType?: string;
  severity: AiCoachRealtimeWarningSeverity;
  source: AiCoachRealtimeWarningSource;
  symbol?: string;
  timestamp: string;
  title: string;
  trigger: AiCoachRealtimeWarningTrigger;
  ttlMs?: number;
};

export type AiCoachSessionLogEventType =
  | JournalInsightSessionLogEntry["eventType"]
  | "discipline-market-entry-confirmation-required"
  | "discipline-market-entry-confirmed"
  | "discipline-market-entry-canceled"
  | "discipline-rule-blocked"
  | "discipline-rule-edit-blocked"
  | "discipline-override-bond-posted";

export type AiCoachSessionLogEntry = {
  eventType: AiCoachSessionLogEventType;
  id: string;
  metadata?: unknown;
  size?: number | null;
  symbol?: string | null;
  timestamp: string;
};

export type AiCoachJournalEntry = JournalInsightJournalEntry & {
  direction?: "long" | "short" | null;
  entrySource?: string;
  size: number | null;
  symbol?: string | null;
};

export type AiCoachLivePosition = {
  direction: "long" | "short";
  protectionMissing: boolean;
  size: number;
  slStatus: "live" | "missing";
  stopPrice: number | null;
  symbol: string;
  targetPrice: number | null;
  tpStatus: "live" | "missing";
};

export type AiCoachRuleState = {
  activeDisciplineRuleCount: number;
  cooldownRemainingMs: number;
  disciplineCurrentlyBlocked: boolean;
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
  realizedPnlToday: number;
  tradesPlacedToday: number;
};

export type AiCoachCurrentIntent = {
  allocationPercent: number;
  direction: "long" | "short";
  estimatedSize: number | null;
  executionMode: "market" | "limit";
  hasPlanContext?: boolean;
  source?: "manual" | "trigger" | "magic_trade" | string;
  symbol?: string;
};

export type AiCoachCard = {
  body: string;
  details: string[];
  id:
    | "entry-style"
    | "setup-tags"
    | "recent-losses"
    | "discipline"
    | "behavior-risk"
    | "baseline-performance"
    | "baseline-direction"
    | "baseline-assets"
    | "baseline-entry-proxy"
    | "baseline-risk"
    | "baseline-timing"
    | "baseline-vs-portal";
  state: AiCoachState;
  title: string;
};

export type AiCoachV1 = {
  cards: AiCoachCard[];
  state: AiCoachState;
  warnings: AiCoachRealtimeWarning[];
};

type NativeMetricRow<Key extends string = string> = {
  averageRealizedPnl: number | null;
  key: Key;
  lossCount: number;
  totalTrades: number;
  wins: number;
};

type NativePerformanceMetrics = {
  averagePnl: number | null;
  byAsset: NativeMetricRow[];
  byDirection: NativeMetricRow<"long" | "short">[];
  byEntrySource: NativeMetricRow[];
  byHoldTime: NativeMetricRow<HoldTimeBucket>[];
  byTimeOfDay: NativeMetricRow<TimeOfDayBucket>[];
  closedTrades: AiCoachJournalEntry[];
  overtradingSignal: {
    sessionsOverFiveTrades: number;
    shortGapTradeCount: number;
  };
  sizeAfterLossFlaggedCount: number;
  winRate: number | null;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMetadataString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getMetadataNumber(metadata: unknown, key: string) {
  if (!isRecord(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatUsd(value: number | null | undefined) {
  if (!isFiniteNumber(value)) {
    return "Not enough data yet";
  }

  const absoluteValue = Math.abs(value);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}$${absoluteValue.toFixed(2)}`;
}

function formatPercent(value: number | null | undefined) {
  if (!isFiniteNumber(value)) {
    return "Not enough data yet";
  }

  return `${Math.round(value * 100)}%`;
}

function formatProxyLabel(proxy: BaselineEntryStyleProxy) {
  switch (proxy) {
    case "likely-hunted":
      return "Likely hunted proxy";
    case "likely-chased":
      return "Likely chased proxy";
    default:
      return "Proxy unavailable";
  }
}

function formatExecutionModeLabel(mode: BaselineExecutionMode) {
  switch (mode) {
    case "market":
      return "Market";
    case "limit":
      return "Limit";
    case "mixed":
      return "Mixed";
    default:
      return "Unknown";
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function topMetricRow<Key extends string>(rows: BaselineMetricRow<Key>[]) {
  return rows[0] ?? null;
}

function bottomMetricRow<Key extends string>(rows: BaselineMetricRow<Key>[]) {
  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => left.averageNetPnl === null ? 1 : right.averageNetPnl === null ? -1 : left.averageNetPnl - right.averageNetPnl)[0] ?? null;
}

function getExitTimestamp(
  entry: AiCoachJournalEntry,
  sessionLogsById: Map<string, AiCoachSessionLogEntry>,
) {
  const exitFrame = (entry.replayMetadata?.frames ?? []).find((frame) => frame.event === "exit");

  if (exitFrame?.capturedAt) {
    return exitFrame.capturedAt;
  }

  const exitLog = entry.relatedSessionLogIds
    .map((id) => sessionLogsById.get(id) ?? null)
    .find(
      (log): log is AiCoachSessionLogEntry =>
        log !== null &&
        (log.eventType === "position-closed" ||
          log.eventType === "position-reversed" ||
          log.eventType === "close-all-used"),
    );

  return exitLog?.timestamp ?? entry.timestamp;
}

function compareRecentFirst(left: AiCoachJournalEntry, right: AiCoachJournalEntry, sessionLogsById: Map<string, AiCoachSessionLogEntry>) {
  return getExitTimestamp(right, sessionLogsById).localeCompare(getExitTimestamp(left, sessionLogsById));
}

function getTimeOfDayBucket(time: number): TimeOfDayBucket {
  const hour = new Date(time).getUTCHours();

  if (hour < 6) {
    return "overnight";
  }

  if (hour < 13) {
    return "premarket";
  }

  if (hour < 18) {
    return "cash";
  }

  if (hour < 22) {
    return "afternoon";
  }

  return "evening";
}

function getHoldTimeBucket(durationMinutes: number | null): HoldTimeBucket {
  if (durationMinutes === null) {
    return "open";
  }

  if (durationMinutes < 5) {
    return "<5m";
  }

  if (durationMinutes <= 15) {
    return "5-15m";
  }

  if (durationMinutes <= 60) {
    return "15-60m";
  }

  if (durationMinutes <= 240) {
    return "1-4h";
  }

  if (durationMinutes <= 24 * 60) {
    return "4-24h";
  }

  return "24h+";
}

function buildNativeMetricRows<Key extends string, Entry extends AiCoachJournalEntry = AiCoachJournalEntry>(
  entries: Entry[],
  getKey: (entry: Entry) => Key,
): NativeMetricRow<Key>[] {
  const grouped = new Map<Key, Entry[]>();

  entries.forEach((entry) => {
    const key = getKey(entry);
    const existing = grouped.get(key) ?? [];
    existing.push(entry);
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries()).map(([key, groupedEntries]) => ({
    averageRealizedPnl: average(groupedEntries.map((entry) => entry.realizedPnl).filter(isFiniteNumber)),
    key,
    lossCount: groupedEntries.filter((entry) => (entry.realizedPnl ?? 0) < 0).length,
    totalTrades: groupedEntries.length,
    wins: groupedEntries.filter((entry) => (entry.realizedPnl ?? 0) > 0).length,
  }));
}

function getDurationMinutes(startTimestamp: string, endTimestamp: string | null) {
  if (!endTimestamp) {
    return null;
  }

  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return Math.max(1, Math.round((end - start) / 60_000));
}

function buildNativePerformanceMetrics(
  entries: AiCoachJournalEntry[],
  sessionLogsById: Map<string, AiCoachSessionLogEntry>,
): NativePerformanceMetrics {
  const closedTrades = entries.filter((entry) => entry.status === "closed" && isFiniteNumber(entry.realizedPnl));
  const enrichedClosedTrades = closedTrades.map((entry) => {
    const durationMinutes = getDurationMinutes(entry.timestamp, getExitTimestamp(entry, sessionLogsById));

    return {
      ...entry,
      durationMinutes,
      endTimestamp: getExitTimestamp(entry, sessionLogsById),
    };
  });

  const sortedByEntry = [...enrichedClosedTrades].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  const sizeAfterLossFlaggedCount = sortedByEntry.reduce((count, entry, index, trades) => {
    const previous = trades[index - 1];

    if (
      !previous ||
      (previous.realizedPnl ?? 0) >= 0 ||
      !isFiniteNumber(previous.size) ||
      !isFiniteNumber(entry.size) ||
      previous.size <= 0
    ) {
      return count;
    }

    return entry.size > previous.size * 1.1 ? count + 1 : count;
  }, 0);

  const overtradingSignal = sortedByEntry.reduce(
    (state, entry, index, trades) => {
      const previous = trades[index - 1];
      const previousEnd = previous ? new Date(previous.endTimestamp ?? previous.timestamp).getTime() : null;
      const currentStart = new Date(entry.timestamp).getTime();

      if (previousEnd !== null && currentStart - previousEnd <= 15 * 60_000) {
        state.shortGapTradeCount += 1;
      }

      return state;
    },
    { sessionsOverFiveTrades: 0, shortGapTradeCount: 0 },
  );

  let sessionTradeCount = 0;
  let lastAnchor: number | null = null;
  sortedByEntry.forEach((entry) => {
    const currentStart = new Date(entry.timestamp).getTime();

    if (lastAnchor === null || currentStart - lastAnchor > 90 * 60_000) {
      if (sessionTradeCount > 5) {
        overtradingSignal.sessionsOverFiveTrades += 1;
      }
      sessionTradeCount = 1;
    } else {
      sessionTradeCount += 1;
    }

    lastAnchor = new Date(entry.endTimestamp ?? entry.timestamp).getTime();
  });
  if (sessionTradeCount > 5) {
    overtradingSignal.sessionsOverFiveTrades += 1;
  }

  return {
    averagePnl: average(closedTrades.map((entry) => entry.realizedPnl).filter(isFiniteNumber)),
    byAsset: buildNativeMetricRows(closedTrades, (entry) => entry.symbol?.trim() || "Unknown"),
    byDirection: buildNativeMetricRows(
      closedTrades.filter(
        (entry): entry is AiCoachJournalEntry & { direction: "long" | "short" } =>
          entry.direction === "long" || entry.direction === "short",
      ),
      (entry) => entry.direction,
    ),
    byEntrySource: buildNativeMetricRows(
      closedTrades.filter((entry): entry is AiCoachJournalEntry & { entrySource: string } =>
        "entrySource" in entry && typeof (entry as AiCoachJournalEntry & { entrySource?: string }).entrySource === "string",
      ),
      (entry) => (entry as AiCoachJournalEntry & { entrySource: string }).entrySource,
    ),
    byHoldTime: buildNativeMetricRows(enrichedClosedTrades, (entry) => getHoldTimeBucket(entry.durationMinutes)),
    byTimeOfDay: buildNativeMetricRows(
      closedTrades,
      (entry) => getTimeOfDayBucket(new Date(entry.timestamp).getTime()),
    ),
    closedTrades,
    overtradingSignal,
    sizeAfterLossFlaggedCount,
    winRate: closedTrades.length > 0 ? closedTrades.filter((entry) => (entry.realizedPnl ?? 0) > 0).length / closedTrades.length : null,
  };
}

function buildEntryStyleCard(insights: JournalInsightsV1): AiCoachCard {
  const hunted = insights.entryStyleComparison.hunted;
  const chased = insights.entryStyleComparison.chased;

  return {
    body: insights.entryStyleComparison.message,
    details: [
      `Hunted ${hunted.totalTrades}T · ${hunted.wins}W/${hunted.losses}L`,
      `Chased ${chased.totalTrades}T · ${chased.wins}W/${chased.losses}L`,
    ],
    id: "entry-style",
    state:
      insights.entryStyleComparison.status === "not-enough-data"
        ? "Not Enough Data"
        : "Insight Available",
    title: "Entry Style",
  };
}

function buildSetupTagCard(insights: JournalInsightsV1): AiCoachCard {
  const bestTag = insights.setupTagPerformance.bestTag;
  const worstTag = insights.setupTagPerformance.worstTag;
  const hasRanking = bestTag !== null || worstTag !== null;

  return {
    body: insights.setupTagPerformance.message,
    details: [
      bestTag ? `Best ${bestTag.tag} · avg ${bestTag.averageRealizedPnl?.toFixed(2)}` : "Best tag not established",
      worstTag ? `Worst ${worstTag.tag} · avg ${worstTag.averageRealizedPnl?.toFixed(2)}` : "Worst tag not established",
    ],
    id: "setup-tags",
    state: hasRanking ? "Insight Available" : "Not Enough Data",
    title: "Setup Tags",
  };
}

function buildRecentLossesCard(
  closedEntries: AiCoachJournalEntry[],
  sessionLogsById: Map<string, AiCoachSessionLogEntry>,
): AiCoachCard {
  const sortedEntries = [...closedEntries].sort((left, right) => compareRecentFirst(left, right, sessionLogsById));
  let streak = 0;

  for (const entry of sortedEntries) {
    if ((entry.realizedPnl ?? 0) < 0) {
      streak += 1;
      continue;
    }
    break;
  }

  if (sortedEntries.length === 0) {
    return {
      body: "Not enough data yet.",
      details: ["No closed trades"],
      id: "recent-losses",
      state: "Not Enough Data",
      title: "Recent Losses",
    };
  }

  if (streak >= 2) {
    return {
      body: `Recent losing streak: ${streak} closed losses in a row.`,
      details: ["Review entry quality before sizing up"],
      id: "recent-losses",
      state: "Warning",
      title: "Recent Losses",
    };
  }

  if (streak === 1) {
    return {
      body: "Last closed trade was a loss.",
      details: ["No active losing streak beyond one trade"],
      id: "recent-losses",
      state: "Insight Available",
      title: "Recent Losses",
    };
  }

  return {
    body: "No active losing streak.",
    details: ["Recent closed flow is stable"],
    id: "recent-losses",
    state: "Watching",
    title: "Recent Losses",
  };
}

function buildDisciplineCard(
  sessionLogEntries: AiCoachSessionLogEntry[],
  rules: AiCoachRuleState,
): AiCoachCard {
  const blockedCount = sessionLogEntries.filter((entry) => entry.eventType === "discipline-rule-blocked").length;

  if (rules.disciplineCurrentlyBlocked) {
    return {
      body: "Discipline rules are currently blocking new entries.",
      details: [
        `${rules.activeDisciplineRuleCount} active rule${rules.activeDisciplineRuleCount === 1 ? "" : "s"}`,
        rules.cooldownRemainingMs > 0 ? "Cooldown is active" : "Check daily loss or trade-count rule",
      ],
      id: "discipline",
      state: "Warning",
      title: "Discipline",
    };
  }

  if (blockedCount > 0) {
    return {
      body: `Discipline rules have blocked ${blockedCount} entr${blockedCount === 1 ? "y" : "ies"} locally.`,
      details: [
        `${rules.activeDisciplineRuleCount} active rule${rules.activeDisciplineRuleCount === 1 ? "" : "s"}`,
        `${rules.tradesPlacedToday} trades placed today`,
      ],
      id: "discipline",
      state: "Insight Available",
      title: "Discipline",
    };
  }

  if (rules.activeDisciplineRuleCount > 0) {
    return {
      body: "Discipline rules are active and watching.",
      details: [
        `${rules.activeDisciplineRuleCount} active rule${rules.activeDisciplineRuleCount === 1 ? "" : "s"}`,
        `${rules.tradesPlacedToday} trades placed today`,
      ],
      id: "discipline",
      state: "Watching",
      title: "Discipline",
    };
  }

  return {
    body: "Not enough data yet.",
    details: ["No active discipline rules"],
    id: "discipline",
    state: "Not Enough Data",
    title: "Discipline",
  };
}

function buildBehaviorRiskCard(
  closedEntries: AiCoachJournalEntry[],
  sessionLogsById: Map<string, AiCoachSessionLogEntry>,
  currentIntent: AiCoachCurrentIntent | null,
  rules: AiCoachRuleState,
): AiCoachCard {
  const sortedEntries = [...closedEntries].sort((left, right) => compareRecentFirst(left, right, sessionLogsById));
  const mostRecentClosedTrade = sortedEntries[0] ?? null;
  const mostRecentLoss =
    mostRecentClosedTrade && (mostRecentClosedTrade.realizedPnl ?? 0) < 0 ? mostRecentClosedTrade : null;

  const overtradeLimit = rules.maxTradesPerDay;
  const nearTradeLimit =
    overtradeLimit !== null && overtradeLimit > 0
      ? rules.tradesPlacedToday / overtradeLimit >= 0.8
      : false;

  const sizingUpAfterLoss =
    mostRecentLoss !== null &&
    currentIntent !== null &&
    isFiniteNumber(currentIntent.estimatedSize) &&
    isFiniteNumber(mostRecentLoss.size) &&
    currentIntent.estimatedSize > mostRecentLoss.size * 1.05;

  if (sizingUpAfterLoss) {
    return {
      body: "You are trading after a loss. Size discipline matters here.",
      details: [
        `${currentIntent?.executionMode === "limit" ? "Limit" : "Market"} flow ${currentIntent?.direction ?? "long"}`,
        `${currentIntent?.allocationPercent ?? 0}% allocation selected`,
      ],
      id: "behavior-risk",
      state: "Warning",
      title: "Behavior Risk",
    };
  }

  if (overtradeLimit !== null && rules.tradesPlacedToday >= overtradeLimit) {
    return {
      body: "You are at your max trades for the session.",
      details: [`${rules.tradesPlacedToday}/${overtradeLimit} trades used`, "Stand down until the next session"],
      id: "behavior-risk",
      state: "Warning",
      title: "Behavior Risk",
    };
  }

  if (nearTradeLimit && overtradeLimit !== null) {
    return {
      body: "You are near your max trades for the session.",
      details: [`${rules.tradesPlacedToday}/${overtradeLimit} trades used`, "Overtrading risk is rising"],
      id: "behavior-risk",
      state: "Warning",
      title: "Behavior Risk",
    };
  }

  if (mostRecentLoss !== null) {
    return {
      body: "You are trading after a loss.",
      details: ["No size-up signal detected", "Stay selective on the next entry"],
      id: "behavior-risk",
      state: "Insight Available",
      title: "Behavior Risk",
    };
  }

  return {
    body: "Not enough data yet.",
    details: ["No recent loss or trade-limit pressure"],
    id: "behavior-risk",
    state: "Not Enough Data",
    title: "Behavior Risk",
  };
}

function buildWarningId(
  trigger: AiCoachRealtimeWarningTrigger,
  relatedRuleType?: string,
  symbol?: string,
) {
  return `${trigger}:${relatedRuleType ?? "any"}:${symbol ?? "any"}`;
}

function createRealtimeWarning(
  warning: Omit<AiCoachRealtimeWarning, "id">,
): AiCoachRealtimeWarning {
  return {
    ...warning,
    id: buildWarningId(warning.trigger, warning.relatedRuleType, warning.symbol),
  };
}

function buildSizingUpAfterLossWarning(
  closedEntries: AiCoachJournalEntry[],
  sessionLogsById: Map<string, AiCoachSessionLogEntry>,
  currentIntent: AiCoachCurrentIntent | null,
  now: string,
): AiCoachRealtimeWarning | null {
  const sortedEntries = [...closedEntries].sort((left, right) => compareRecentFirst(left, right, sessionLogsById));
  const mostRecentClosedTrade = sortedEntries[0] ?? null;

  if (
    mostRecentClosedTrade === null ||
    (mostRecentClosedTrade.realizedPnl ?? 0) >= 0 ||
    currentIntent === null ||
    !isFiniteNumber(currentIntent.estimatedSize) ||
    !isFiniteNumber(mostRecentClosedTrade.size) ||
    currentIntent.estimatedSize <= mostRecentClosedTrade.size * 1.05
  ) {
    return null;
  }

  return createRealtimeWarning({
    actionLabel: "Reduce size",
    message: "You are sizing up after a loss. That is revenge risk.",
    severity: "warning",
    source: "trade_behavior",
    symbol: mostRecentClosedTrade.symbol ?? undefined,
    timestamp: now,
    title: "Revenge risk.",
    trigger: "sizing_up_after_loss",
    ttlMs: 90_000,
  });
}

function buildWarningFromDisciplineBlock(entry: AiCoachSessionLogEntry): AiCoachRealtimeWarning | null {
  const actionType = getMetadataString(entry.metadata, "actionType");
  const reasonCode = getMetadataString(entry.metadata, "reasonCode");
  const relatedRuleType = getMetadataString(entry.metadata, "ruleType") ?? undefined;
  const symbol = entry.symbol ?? undefined;

  if (actionType === "reverse_position") {
    return createRealtimeWarning({
      actionLabel: "Close instead",
      message: "Reverse blocked. You can close risk, but you cannot open new opposite exposure.",
      relatedRuleType,
      severity: "critical",
      source: "position",
      symbol,
      timestamp: entry.timestamp,
      title: "Reverse blocked.",
      trigger: "reverse_blocked",
    });
  }

  switch (reasonCode) {
    case "cooldown_active":
      return createRealtimeWarning({
        actionLabel: "Wait it out",
        message: "You already locked this rule. Wait it out or post an Override Bond.",
        relatedRuleType: relatedRuleType ?? "cooldown_after_loss",
        severity: "critical",
        source: "risk_gate",
        symbol,
        timestamp: entry.timestamp,
        title: "Cooldown active.",
        trigger: "cooldown_active",
      });
    case "max_daily_loss_hit":
      return createRealtimeWarning({
        actionLabel: "Reduce only",
        message: "New risk is blocked. Closing or reducing exposure is still allowed.",
        relatedRuleType: relatedRuleType ?? "max_daily_loss",
        severity: "critical",
        source: "risk_gate",
        symbol,
        timestamp: entry.timestamp,
        title: "Daily loss limit hit.",
        trigger: "max_daily_loss_hit",
      });
    case "max_trades_per_day_hit":
      return createRealtimeWarning({
        actionLabel: "Stand down",
        message: "You reached your trade limit. New risk is blocked for this session.",
        relatedRuleType: relatedRuleType ?? "max_trades_per_day",
        severity: "critical",
        source: "risk_gate",
        symbol,
        timestamp: entry.timestamp,
        title: "Max trades hit.",
        trigger: "max_trades_hit",
      });
    case "min_rr_failed":
      return createRealtimeWarning({
        actionLabel: "Review plan",
        message: "Wait for a cleaner setup or adjust the plan before adding risk.",
        relatedRuleType: relatedRuleType ?? "min_risk_reward",
        severity: "warning",
        source: "risk_gate",
        symbol,
        timestamp: entry.timestamp,
        title: "Minimum R:R failed.",
        trigger: "min_rr_failed",
        ttlMs: 90_000,
      });
    case "no_trade_zone_active":
      return createRealtimeWarning({
        actionLabel: "Wait for price",
        message: "No-trade zone active. Portal is blocking new risk here.",
        relatedRuleType: relatedRuleType ?? "no_trade_zone",
        severity: "critical",
        source: "risk_gate",
        symbol,
        timestamp: entry.timestamp,
        title: "No-trade zone active.",
        trigger: "no_trade_zone_active",
      });
    case "blocked_time_window_active":
      return createRealtimeWarning({
        actionLabel: "Stand down",
        message: "This time window is locked by your Discipline Plan. Reduce risk only.",
        relatedRuleType: relatedRuleType ?? "blocked_time_window",
        severity: "critical",
        source: "risk_gate",
        symbol,
        timestamp: entry.timestamp,
        title: "Time window locked.",
        trigger: "risk_increasing_blocked",
      });
    case "protection_required":
      return createRealtimeWarning({
        actionLabel: "Add stop",
        message: "Add a stop loss before taking new risk.",
        relatedRuleType: relatedRuleType ?? "require_protection",
        severity: "critical",
        source: "risk_gate",
        symbol,
        timestamp: entry.timestamp,
        title: "Protection required.",
        trigger: "protection_required",
        ttlMs: 90_000,
      });
    case "market_entry_confirmation_required":
      return createRealtimeWarning({
        actionLabel: "Confirm entry",
        message: "This matches your diagnosed weak pattern. Confirm before adding risk.",
        relatedRuleType: relatedRuleType ?? "market_entry_confirmation",
        severity: "warning",
        source: "operator_diagnosis",
        symbol,
        timestamp: entry.timestamp,
        title: "Manual entry risk.",
        trigger: "market_entry_confirmation_required",
        ttlMs: 90_000,
      });
    case "discipline_locked":
      return createRealtimeWarning({
        actionLabel: "Review lock",
        message: "Portal is blocking new risk while Discipline protection is locked.",
        relatedRuleType,
        severity: "critical",
        source: "discipline",
        symbol,
        timestamp: entry.timestamp,
        title: "Discipline locked.",
        trigger: "risk_increasing_blocked",
      });
    case "unknown_risk_action":
    default:
      return createRealtimeWarning({
        actionLabel: "Review action",
        message: "Portal blocked this because the action's risk was unclear.",
        relatedRuleType,
        severity: "warning",
        source: "risk_gate",
        symbol,
        timestamp: entry.timestamp,
        title: "Risk could not be classified.",
        trigger: "risk_increasing_blocked",
        ttlMs: 90_000,
      });
  }
}

function buildWarningFromOverrideRequired(entry: AiCoachSessionLogEntry): AiCoachRealtimeWarning {
  const relatedRuleType = getMetadataString(entry.metadata, "ruleType") ?? undefined;

  return createRealtimeWarning({
    actionLabel: "Post bond",
    message: "Override Bond required to weaken this rule.",
    relatedRuleType,
    severity: "warning",
    source: "discipline",
    timestamp: entry.timestamp,
    title: "Rule locked.",
    trigger: "override_bond_required",
    ttlMs: 90_000,
  });
}

function buildWarningFromOverridePosted(entry: AiCoachSessionLogEntry): AiCoachRealtimeWarning {
  const relatedRuleType = getMetadataString(entry.metadata, "ruleType") ?? undefined;
  const multiplier = getMetadataNumber(entry.metadata, "multiplier") ?? 1;

  if (multiplier >= 2) {
    return createRealtimeWarning({
      actionLabel: "Step back",
      message: "This Override Bond is now more expensive because this is not your first override today.",
      relatedRuleType,
      severity: "warning",
      source: "override_bond",
      timestamp: entry.timestamp,
      title: "Override pattern detected.",
      trigger: "repeated_override",
      ttlMs: 90_000,
    });
  }

  return createRealtimeWarning({
    actionLabel: "Review later",
    message: "You paid to break discipline. This will count against your discipline streak.",
    relatedRuleType,
    severity: "info",
    source: "override_bond",
    timestamp: entry.timestamp,
    title: "Override logged.",
    trigger: "override_bond_posted",
    ttlMs: 90_000,
  });
}

function addOrUpdateWarning(
  warningsById: Map<string, AiCoachRealtimeWarning>,
  warning: AiCoachRealtimeWarning | null,
) {
  if (!warning) {
    return;
  }

  const existingWarning = warningsById.get(warning.id);
  if (!existingWarning || warning.timestamp >= existingWarning.timestamp) {
    warningsById.set(warning.id, warning);
  }
}

function buildRepeatedBlockWarnings(warnings: AiCoachRealtimeWarning[]): AiCoachRealtimeWarning[] {
  const countsById = warnings.reduce<Map<string, number>>((counts, warning) => {
    if (warning.source !== "risk_gate" && warning.source !== "discipline") {
      return counts;
    }

    counts.set(warning.id, (counts.get(warning.id) ?? 0) + 1);
    return counts;
  }, new Map());

  return warnings.flatMap((warning) => {
    if ((countsById.get(warning.id) ?? 0) < 3) {
      return [];
    }

    return createRealtimeWarning({
      actionLabel: "Step back",
      message: "You keep trying to bypass the same rule. Step back.",
      relatedRuleType: warning.relatedRuleType,
      severity: "warning",
      source: "trade_behavior",
      symbol: warning.symbol,
      timestamp: warning.timestamp,
      title: "Repeated block.",
      trigger: "revenge_risk",
      ttlMs: 90_000,
    });
  });
}

function convertDiagnosisWarning(warning: DiagnosisRealtimeWarning): AiCoachRealtimeWarning {
  return {
    actionLabel:
      warning.trigger === "activated_plan_rule_relevant"
        ? "Review plan"
        : warning.trigger === "unsupported_recommendation_warning"
          ? "Warning only"
          : "Review action",
    id: warning.id,
    message: warning.message,
    relatedRuleType: warning.sourcePlanRuleId,
    severity: warning.severity,
    source: "operator_diagnosis",
    symbol: warning.symbol,
    timestamp: warning.timestamp,
    title: warning.title,
    trigger: warning.trigger,
    ttlMs: warning.ttlMs,
  };
}

function isWarningExpired(warning: AiCoachRealtimeWarning, now: string) {
  if (!warning.ttlMs) {
    return false;
  }

  const warningTime = Date.parse(warning.timestamp);
  const nowTime = Date.parse(now);

  if (!Number.isFinite(warningTime) || !Number.isFinite(nowTime)) {
    return false;
  }

  return nowTime - warningTime > warning.ttlMs;
}

function compareWarnings(left: AiCoachRealtimeWarning, right: AiCoachRealtimeWarning) {
  const severityRank: Record<AiCoachRealtimeWarningSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return severityRank[left.severity] - severityRank[right.severity] || right.timestamp.localeCompare(left.timestamp);
}

function buildRealtimeWarnings({
  closedEntries,
  currentIntent,
  dismissedWarningIds,
  journalMemoryEvents,
  now,
  operatorDiagnosis,
  ruleState,
  sessionLogEntries,
  sessionLogsById,
}: {
  closedEntries: AiCoachJournalEntry[];
  currentIntent: AiCoachCurrentIntent | null;
  dismissedWarningIds: string[];
  journalMemoryEvents: JournalMemoryEvent[];
  now: string;
  operatorDiagnosis: OperatorDiagnosis | null;
  ruleState: AiCoachRuleState;
  sessionLogEntries: AiCoachSessionLogEntry[];
  sessionLogsById: Map<string, AiCoachSessionLogEntry>;
}): AiCoachRealtimeWarning[] {
  const rawWarnings: AiCoachRealtimeWarning[] = [];

  for (const entry of sessionLogEntries) {
    switch (entry.eventType) {
      case "discipline-rule-blocked": {
        const warning = buildWarningFromDisciplineBlock(entry);
        if (warning) {
          rawWarnings.push(warning);
        }
        break;
      }
      case "discipline-market-entry-confirmation-required": {
        const warning = buildWarningFromDisciplineBlock(entry);
        if (warning) {
          rawWarnings.push(warning);
        }
        break;
      }
      case "discipline-rule-edit-blocked":
        rawWarnings.push(buildWarningFromOverrideRequired(entry));
        break;
      case "discipline-override-bond-posted":
        rawWarnings.push(buildWarningFromOverridePosted(entry));
        break;
      default:
        break;
    }
  }

  const sizingWarning = buildSizingUpAfterLossWarning(closedEntries, sessionLogsById, currentIntent, now);
  if (sizingWarning) {
    rawWarnings.push(sizingWarning);
  }

  rawWarnings.push(...buildRepeatedBlockWarnings(rawWarnings));

  if (operatorDiagnosis) {
    rawWarnings.push(
      ...deriveDiagnosisRealtimeWarningsV1({
        activeDisciplineState: {
          cooldownAfterLossMinutes: ruleState.cooldownRemainingMs > 0 ? Math.ceil(ruleState.cooldownRemainingMs / 60_000) : null,
          maxTradesPerDay: ruleState.maxTradesPerDay,
          minRiskReward: null,
          tradesPlacedToday: ruleState.tradesPlacedToday,
        },
        currentAction: currentIntent
          ? {
              actionType: "open_risk",
              hasPlanContext: currentIntent.hasPlanContext,
              orderType: currentIntent.executionMode,
              riskIncreasing: true,
              side: currentIntent.direction,
              source: currentIntent.source ?? "manual",
              symbol: currentIntent.symbol,
            }
          : null,
        diagnosis: operatorDiagnosis,
        existingAiWarningCount: rawWarnings.length,
        journalEntries: closedEntries.map((entry) => ({
          id: entry.id,
          realizedPnl: entry.realizedPnl,
          status: entry.status,
          timestamp: entry.timestamp,
        })),
        journalMemoryEvents,
        now: operatorDiagnosis.generatedAt || now,
      }).map(convertDiagnosisWarning),
    );
  }

  const dismissed = new Set(dismissedWarningIds);
  const warningsById = new Map<string, AiCoachRealtimeWarning>();
  for (const warning of rawWarnings) {
    if (dismissed.has(warning.id) || isWarningExpired(warning, now)) {
      continue;
    }
    addOrUpdateWarning(warningsById, warning);
  }

  return [...warningsById.values()].sort(compareWarnings);
}

function getImportedSessionSupportingContextDetails(
  supportingContexts: ImportedSessionSupportingContext[],
) {
  return supportingContexts.slice(0, 2).map(
    (context) =>
      `${context.title}: ${context.summary} ${context.evidenceLabel}`,
  );
}

function getEvidenceComparisonDetails(comparisons: EvidenceComparisonResult[]) {
  return buildEvidenceComparisonDisplayCopies(comparisons)
    .filter((copy) => copy.shouldDisplay)
    .slice(0, 2)
    .flatMap((copy) => [
      copy.labels.join(" / "),
      `${copy.statusLabel} · ${copy.topicLabel} · ${copy.confidenceLabel}: ${copy.conclusion}`,
      `Recommended use: ${copy.recommendedUseLabel}`,
      ...copy.sourceWarningLabels.map((warning) => `Source warning: ${warning}`),
    ]);
}

function buildBaselinePerformanceCard(
  baselineProfile: BaselineProfile | null,
  sessionInsightSummary: BaselineSessionInsightConsumptionSummary | null,
  supportingContexts: ImportedSessionSupportingContext[],
  evidenceComparisons: EvidenceComparisonResult[],
): AiCoachCard {
  if (!baselineProfile || baselineProfile.totals.totalTrades === 0) {
    return {
      body: "Not enough historical data yet.",
      details: ["Historical Baseline", "Run Baseline Scan to build context"],
      id: "baseline-performance",
      state: "Not Enough Data",
      title: "Historical Performance",
    };
  }

  if (sessionInsightSummary?.hasInsufficientEvidence) {
    return {
      body:
        "Imported baseline sessions are missing complete session evidence. Portal will show what is missing instead of a strong insight.",
      details: getBaselineSessionInsightSafetyDetails(sessionInsightSummary),
      id: "baseline-performance",
      state: "Not Enough Data",
      title: "Historical Performance",
    };
  }

  if (sessionInsightSummary) {
    const cautionCopy =
      sessionInsightSummary.hasSourceQualityWarnings || sessionInsightSummary.hasLowConfidence
        ? "source quality limits diagnosis confidence."
        : "imported context only; not diagnosis-grade yet.";

    return {
      body: `Directional baseline signal: imported sessions show ${formatUsd(
        sessionInsightSummary.worstSessionNetPnl,
      )} worst session and ${formatUsd(sessionInsightSummary.bestSessionNetPnl)} best session; ${cautionCopy}`,
      details: [
        ...getBaselineSessionInsightSafetyDetails(sessionInsightSummary),
        ...getImportedSessionSupportingContextDetails(supportingContexts),
        ...getEvidenceComparisonDetails(evidenceComparisons),
      ],
      id: "baseline-performance",
      state: "Insight Available",
      title: "Historical Performance",
    };
  }

  return {
    body: `Historical baseline shows ${baselineProfile.totals.totalTrades} trades with ${formatPercent(baselineProfile.totals.winRate)} win rate.`,
    details: [
      "Historical Baseline",
      `Net ${formatUsd(baselineProfile.totals.netPnl)}`,
      `Closed fees ${formatUsd(baselineProfile.totals.closedGrossFees)}`,
    ],
    id: "baseline-performance",
    state: "Insight Available",
    title: "Historical Performance",
  };
}

function buildBaselineDirectionCard(baselineProfile: BaselineProfile | null): AiCoachCard {
  if (!baselineProfile || baselineProfile.byDirection.length === 0) {
    return {
      body: "Not enough historical data yet.",
      details: ["Historical Baseline", "No long/short split available"],
      id: "baseline-direction",
      state: "Not Enough Data",
      title: "Long vs Short Bias",
    };
  }

  const longRow = baselineProfile.byDirection.find((row) => row.key === "long") ?? null;
  const shortRow = baselineProfile.byDirection.find((row) => row.key === "short") ?? null;
  const dominantDirection =
    !longRow && !shortRow
      ? null
      : (longRow?.averageNetPnl ?? Number.NEGATIVE_INFINITY) >= (shortRow?.averageNetPnl ?? Number.NEGATIVE_INFINITY)
        ? "long"
        : "short";

  return {
    body:
      dominantDirection === null
        ? "Not enough historical data yet."
        : dominantDirection === "long"
          ? "Historical baseline favors long-side performance."
          : "Historical baseline favors short-side performance.",
    details: [
      "Historical Baseline",
      `Long ${longRow?.tradeCount ?? 0}T · avg ${formatUsd(longRow?.averageNetPnl ?? null)}`,
      `Short ${shortRow?.tradeCount ?? 0}T · avg ${formatUsd(shortRow?.averageNetPnl ?? null)}`,
    ],
    id: "baseline-direction",
    state: dominantDirection === null ? "Not Enough Data" : "Insight Available",
    title: "Long vs Short Bias",
  };
}

function buildBaselineAssetCard(baselineProfile: BaselineProfile | null): AiCoachCard {
  if (!baselineProfile || baselineProfile.byAsset.length === 0) {
    return {
      body: "Not enough historical data yet.",
      details: ["Historical Baseline", "Asset mix unavailable"],
      id: "baseline-assets",
      state: "Not Enough Data",
      title: "Assets",
    };
  }

  const bestAsset = topMetricRow(
    [...baselineProfile.byAsset].sort((left, right) =>
      (right.averageNetPnl ?? Number.NEGATIVE_INFINITY) - (left.averageNetPnl ?? Number.NEGATIVE_INFINITY),
    ),
  );
  const worstAsset = bottomMetricRow(baselineProfile.byAsset);

  return {
    body:
      bestAsset && worstAsset
        ? `Best historical asset is ${bestAsset.key}. Worst is ${worstAsset.key}.`
        : "Not enough historical data yet.",
    details: [
      "Historical Baseline",
      bestAsset ? `Best ${bestAsset.key} · avg ${formatUsd(bestAsset.averageNetPnl)}` : "Best asset unavailable",
      worstAsset ? `Worst ${worstAsset.key} · avg ${formatUsd(worstAsset.averageNetPnl)}` : "Worst asset unavailable",
    ],
    id: "baseline-assets",
    state: bestAsset && worstAsset ? "Insight Available" : "Not Enough Data",
    title: "Assets",
  };
}

function buildBaselineProxyCard(baselineProfile: BaselineProfile | null): AiCoachCard {
  if (!baselineProfile || baselineProfile.byEntryStyleProxy.length === 0) {
    return {
      body: "Not enough historical data yet.",
      details: ["Historical Baseline", "Proxy classification unavailable"],
      id: "baseline-entry-proxy",
      state: "Not Enough Data",
      title: "Entry Proxy",
    };
  }

  const bestProxy = topMetricRow(
    [...baselineProfile.byEntryStyleProxy].sort((left, right) =>
      (right.averageNetPnl ?? Number.NEGATIVE_INFINITY) - (left.averageNetPnl ?? Number.NEGATIVE_INFINITY),
    ),
  );

  return {
    body:
      bestProxy && bestProxy.key !== "unknown"
        ? `${formatProxyLabel(bestProxy.key)} is the stronger historical proxy.`
        : "Historical proxy data is still thin.",
    details: [
      "Historical Baseline",
      ...baselineProfile.byEntryStyleProxy.map(
        (row) => `${formatProxyLabel(row.key)} ${row.tradeCount}T · avg ${formatUsd(row.averageNetPnl)}`,
      ),
    ],
    id: "baseline-entry-proxy",
    state: bestProxy && bestProxy.key !== "unknown" ? "Insight Available" : "Not Enough Data",
    title: "Entry Proxy",
  };
}

function buildBaselineRiskCard(
  baselineProfile: BaselineProfile | null,
  sessionInsightSummary: BaselineSessionInsightConsumptionSummary | null,
  supportingContexts: ImportedSessionSupportingContext[],
  evidenceComparisons: EvidenceComparisonResult[],
): AiCoachCard {
  if (!baselineProfile) {
    return {
      body: "Not enough historical data yet.",
      details: ["Historical Baseline", "No overtrading or size-after-loss context"],
      id: "baseline-risk",
      state: "Not Enough Data",
      title: "Behavior Signals",
    };
  }

  if (sessionInsightSummary) {
    const hasSessionRiskSignal =
      sessionInsightSummary.highDensitySessionCount > 0 ||
      sessionInsightSummary.postLossClusterCount > 0 ||
      sessionInsightSummary.revengeRiskCount > 0;

    return {
      body: hasSessionRiskSignal
        ? `Early session pattern: imported context shows ${sessionInsightSummary.highDensitySessionCount} high-density sessions, ${sessionInsightSummary.postLossClusterCount} post-loss clusters, and ${sessionInsightSummary.revengeRiskCount} revenge-risk sessions.`
        : "No imported session risk signal is active yet.",
      details: [
        ...getBaselineSessionInsightSafetyDetails(sessionInsightSummary),
        ...getImportedSessionSupportingContextDetails(supportingContexts),
        ...getEvidenceComparisonDetails(evidenceComparisons),
        sessionInsightSummary.warningCopy ?? "Keep imported sessions directional until native evidence confirms them.",
      ],
      id: "baseline-risk",
      state: hasSessionRiskSignal ? "Warning" : "Watching",
      title: "Behavior Signals",
    };
  }

  const hasOvertradingSignal =
    baselineProfile.sessionBehavior.sessionsOverFiveTrades > 0 ||
    baselineProfile.sessionBehavior.shortGapTradeCount > 0;
  const hasSizeAfterLossSignal = baselineProfile.sizeAfterLoss.flaggedCount > 0;

  if (hasOvertradingSignal || hasSizeAfterLossSignal) {
    return {
      body: hasSizeAfterLossSignal
        ? "Historical baseline shows size-after-loss risk."
        : "Historical baseline shows overtrading pressure.",
      details: [
        "Historical Baseline",
        hasOvertradingSignal
          ? `${baselineProfile.sessionBehavior.sessionsOverFiveTrades} high-density sessions · ${baselineProfile.sessionBehavior.shortGapTradeCount} short-gap trades`
          : "No overtrading signal",
        hasSizeAfterLossSignal
          ? `${baselineProfile.sizeAfterLoss.flaggedCount} size-up-after-loss events`
          : "No size-after-loss signal",
      ],
      id: "baseline-risk",
      state: "Warning",
      title: "Behavior Signals",
    };
  }

  return {
    body: "No baseline overtrading or size-after-loss warning is active.",
    details: [
      "Historical Baseline",
      `${baselineProfile.sessionBehavior.totalSessions} sessions analyzed`,
      "No flagged size-after-loss events",
    ],
    id: "baseline-risk",
    state: "Watching",
    title: "Behavior Signals",
  };
}

function buildBaselineTimingCard(baselineProfile: BaselineProfile | null): AiCoachCard {
  if (!baselineProfile || (baselineProfile.byTimeOfDay.length === 0 && baselineProfile.byHoldTimeBucket.length === 0)) {
    return {
      body: "Not enough historical data yet.",
      details: ["Historical Baseline", "Timing behavior unavailable"],
      id: "baseline-timing",
      state: "Not Enough Data",
      title: "Timing",
    };
  }

  const bestTimeOfDay = topMetricRow(
    [...baselineProfile.byTimeOfDay].sort((left, right) =>
      (right.averageNetPnl ?? Number.NEGATIVE_INFINITY) - (left.averageNetPnl ?? Number.NEGATIVE_INFINITY),
    ),
  );
  const bestHold = topMetricRow(
    [...baselineProfile.byHoldTimeBucket].sort((left, right) =>
      (right.averageNetPnl ?? Number.NEGATIVE_INFINITY) - (left.averageNetPnl ?? Number.NEGATIVE_INFINITY),
    ),
  );

  return {
    body:
      bestTimeOfDay || bestHold
        ? "Historical baseline highlights timing edges."
        : "Not enough historical data yet.",
    details: [
      "Historical Baseline",
      bestTimeOfDay ? `Time of day ${bestTimeOfDay.key} · avg ${formatUsd(bestTimeOfDay.averageNetPnl)}` : "Time of day unavailable",
      bestHold ? `Hold ${bestHold.key} · avg ${formatUsd(bestHold.averageNetPnl)}` : "Hold-time unavailable",
    ],
    id: "baseline-timing",
    state: bestTimeOfDay || bestHold ? "Insight Available" : "Not Enough Data",
    title: "Timing",
  };
}

function buildBaselineComparisonCard(
  baselineProfile: BaselineProfile | null,
  closedEntries: AiCoachJournalEntry[],
  insights: JournalInsightsV1,
): AiCoachCard {
  if (!baselineProfile || closedEntries.length === 0 || baselineProfile.totals.closedTrades === 0) {
    return {
      body: "Not enough historical data yet.",
      details: ["Before Portal / In Portal comparison needs both datasets"],
      id: "baseline-vs-portal",
      state: "Not Enough Data",
      title: "Before Portal / In Portal",
    };
  }

  const portalWinRate = closedEntries.filter((entry) => (entry.realizedPnl ?? 0) > 0).length / closedEntries.length;
  const portalAveragePnl = average(
    closedEntries.map((entry) => entry.realizedPnl).filter(isFiniteNumber),
  );

  return {
    body: "Before Portal / In Portal comparison is available.",
    details: [
      `Before Portal win rate ${formatPercent(baselineProfile.totals.winRate)} · avg ${formatUsd(
        baselineProfile.totals.netPnl / Math.max(1, baselineProfile.totals.closedTrades),
      )}`,
      `In Portal win rate ${formatPercent(portalWinRate)} · avg ${formatUsd(portalAveragePnl)}`,
      `True journal style ${insights.entryStyleComparison.message} · imported style is proxy-only`,
    ],
    id: "baseline-vs-portal",
    state: "Insight Available",
    title: "Before Portal / In Portal",
  };
}

function getOverallState(cards: AiCoachCard[], warnings: AiCoachRealtimeWarning[]): AiCoachState {
  if (warnings.some((warning) => warning.severity === "critical" || warning.severity === "warning")) {
    return "Warning";
  }

  if (cards.some((card) => card.state === "Warning")) {
    return "Warning";
  }

  if (warnings.length > 0) {
    return "Insight Available";
  }

  if (cards.some((card) => card.state === "Insight Available")) {
    return "Insight Available";
  }

  if (cards.every((card) => card.state === "Not Enough Data")) {
    return "Not Enough Data";
  }

  return "Watching";
}

export function deriveObservationalCoachV1({
  baselineProfile,
  baselineEvidenceComparisons = [],
  baselineSessionIntelligence = null,
  baselineSessionSupportingContexts = [],
  currentIntent,
  dismissedWarningIds = [],
  journalMemoryEvents = [],
  journalEntries,
  livePosition,
  now,
  operatorDiagnosis = null,
  ruleState,
  sessionLogEntries,
}: {
  baselineProfile: BaselineProfile | null;
  baselineEvidenceComparisons?: EvidenceComparisonResult[];
  baselineSessionIntelligence?: SessionIntelligenceResult | null;
  baselineSessionSupportingContexts?: ImportedSessionSupportingContext[];
  currentIntent: AiCoachCurrentIntent | null;
  dismissedWarningIds?: string[];
  journalMemoryEvents?: JournalMemoryEvent[];
  journalEntries: AiCoachJournalEntry[];
  livePosition: AiCoachLivePosition | null;
  now?: string;
  operatorDiagnosis?: OperatorDiagnosis | null;
  ruleState: AiCoachRuleState;
  sessionLogEntries: AiCoachSessionLogEntry[];
}): AiCoachV1 {
  const coachRelevantLogs = sessionLogEntries.filter(
    (entry): entry is JournalInsightSessionLogEntry =>
      entry.eventType !== "discipline-rule-blocked",
  );

  const insights = deriveJournalInsightsV1(
    journalEntries.map((entry) => ({
      entryStyle: entry.entryStyle,
      id: entry.id,
      realizedPnl: entry.realizedPnl,
      relatedSessionLogIds: entry.relatedSessionLogIds,
      replayMetadata: entry.replayMetadata,
      setupTag: entry.setupTag,
      status: entry.status,
      timestamp: entry.timestamp,
    })),
    coachRelevantLogs,
  );

  const sessionLogsById = new Map(sessionLogEntries.map((entry) => [entry.id, entry]));
  const effectiveNow =
    now ??
    [...sessionLogEntries]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0]?.timestamp ??
    new Date().toISOString();
  const closedEntries = journalEntries.filter(
    (entry) => entry.status === "closed" && isFiniteNumber(entry.realizedPnl),
  );
  const baselineSessionInsightSummary = summarizeBaselineSessionInsightConsumption({
    sessionIntelligence: baselineSessionIntelligence,
    sourceWarnings: baselineProfile?.dataQuality ?? [],
  });

  const cards: AiCoachCard[] = [
    buildEntryStyleCard(insights),
    buildSetupTagCard(insights),
    buildBaselinePerformanceCard(
      baselineProfile,
      baselineSessionInsightSummary,
      baselineSessionSupportingContexts,
      baselineEvidenceComparisons,
    ),
    buildBaselineDirectionCard(baselineProfile),
    buildBaselineAssetCard(baselineProfile),
    buildBaselineProxyCard(baselineProfile),
    buildBaselineRiskCard(
      baselineProfile,
      baselineSessionInsightSummary,
      baselineSessionSupportingContexts,
      baselineEvidenceComparisons,
    ),
    buildBaselineTimingCard(baselineProfile),
    buildBaselineComparisonCard(baselineProfile, closedEntries, insights),
    buildRecentLossesCard(closedEntries, sessionLogsById),
    buildDisciplineCard(sessionLogEntries, ruleState),
    buildBehaviorRiskCard(closedEntries, sessionLogsById, currentIntent, ruleState),
  ];
  const warnings = buildRealtimeWarnings({
    closedEntries,
    currentIntent,
    dismissedWarningIds,
    journalMemoryEvents,
    now: effectiveNow,
    operatorDiagnosis,
    ruleState,
    sessionLogEntries,
    sessionLogsById,
  });

  return {
    cards,
    state: getOverallState(cards, warnings),
    warnings,
  };
}
