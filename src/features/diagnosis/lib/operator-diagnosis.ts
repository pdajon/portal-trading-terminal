import type { JournalMemoryEvent } from "@/features/journal/lib/journal-memory-events";
import {
  canUseAsPrimaryDiagnosisEvidence,
  type DiagnosisEvidence,
} from "@/features/diagnosis/lib/diagnosis-evidence";
import {
  mapNativeSessionsToDiagnosisFindings,
  type NativeSessionDiagnosisFinding,
} from "./native-session-diagnosis";
import type { NativeSessionV1 } from "./native-session-contract";

export type OperatorDiagnosisConfidence = "low" | "medium" | "high";

export type DiagnosisFindingCategory =
  | "time_window"
  | "post_loss_behavior"
  | "override_bond"
  | "ai_warning_ignored"
  | "discipline_block"
  | "manual_entry"
  | "magic_trade"
  | "trigger"
  | "plan_broken"
  | "setup_quality"
  | "asset"
  | "risk_reward";

export type RecommendedDisciplineRuleType =
  | "cooldown_after_loss"
  | "blocked_time_window"
  | "max_trades_per_day"
  | "override_bond_warning";

export type RecommendedDisciplineRule = {
  id: string;
  proposedValue: Record<string, unknown>;
  reason: string;
  ruleType: RecommendedDisciplineRuleType;
  sourceFindingId?: string;
  title: string;
};

export type DiagnosisFinding = {
  category: DiagnosisFindingCategory;
  evidenceEventIds: string[];
  id: string;
  impact: {
    avgRr?: number;
    drawdownContribution?: number;
    netPnl?: number;
    tradeCount?: number;
    winRate?: number;
  };
  journalEntryIds: string[];
  recommendation: string;
  recommendedRule?: RecommendedDisciplineRule;
  severity: "info" | "warning" | "critical" | "positive";
  summary: string;
  title: string;
};

export type RecommendedDisciplinePlan = {
  expectedBenefit: string;
  id: string;
  rules: RecommendedDisciplineRule[];
  status: "draft" | "review_ready" | "activated";
  summary: string;
  title: string;
};

export type OperatorDiagnosis = {
  confidence: OperatorDiagnosisConfidence;
  generatedAt: string;
  nativeSessionReviewCandidates: NativeSessionDiagnosisFinding[];
  profitableBehaviors: DiagnosisFinding[];
  profitLeaks: DiagnosisFinding[];
  recommendedPlan: RecommendedDisciplinePlan;
  sampleSize: number;
};

export type OperatorDiagnosisJournalEntry = {
  closedAt?: string | null;
  dataSource?: "native" | "imported" | string;
  diagnosisEvidence?: DiagnosisEvidence;
  entrySource?: string | null;
  exitPrice?: number | null;
  id: string;
  openedAt?: string | null;
  planFollowed?: "followed" | "broken" | "unclear" | null;
  realizedPnl?: number | null;
  relatedSessionLogIds?: string[];
  replayMetadata?: {
    frames?: Array<{ event?: string; capturedAt?: string; pnl?: number | null }>;
  };
  setupQualityRating?: number | null;
  sourceType?: "native" | "imported" | string;
  status: "open" | "closed";
  symbol?: string | null;
  timestamp: string;
  userFacingLabel?: string;
};

export type OperatorDiagnosisSessionLogEntry = {
  eventType: string;
  id: string;
  metadata?: unknown;
  pnl?: number | null;
  source?: string;
  timestamp: string;
};

export type OperatorDiagnosisInput = {
  generatedAt?: string;
  includeImportedEntries?: boolean;
  journalEntries: OperatorDiagnosisJournalEntry[];
  journalMemoryEvents: JournalMemoryEvent[];
  nativeSessions?: NativeSessionV1[];
  sessionLogs?: OperatorDiagnosisSessionLogEntry[];
};

type TradeSummary = OperatorDiagnosisJournalEntry & {
  events: JournalMemoryEvent[];
  pnl: number;
  timestampMs: number;
};

type GroupStats = {
  averagePnl: number;
  eventIds: string[];
  journalEntryIds: string[];
  losses: number;
  netPnl: number;
  tradeCount: number;
  wins: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_GROUP_SAMPLE = 2;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getConfidence(sampleSize: number): OperatorDiagnosisConfidence {
  if (sampleSize >= 20) {
    return "high";
  }

  if (sampleSize >= 5) {
    return "medium";
  }

  return "low";
}

function isNativeEntry(entry: OperatorDiagnosisJournalEntry) {
  return entry.dataSource !== "imported" && entry.sourceType !== "imported";
}

function isPrimaryNativeDiagnosisEntry(entry: OperatorDiagnosisJournalEntry) {
  if (entry.diagnosisEvidence) {
    return canUseAsPrimaryDiagnosisEvidence(entry.diagnosisEvidence);
  }

  return isNativeEntry(entry);
}

function getEntryTimestamp(entry: OperatorDiagnosisJournalEntry) {
  return entry.openedAt ?? entry.timestamp;
}

function toTradeSummaries(
  entries: OperatorDiagnosisJournalEntry[],
  events: JournalMemoryEvent[],
  options: { includeImportedEntries?: boolean } = {},
): TradeSummary[] {
  return entries
    .filter(
      (entry) =>
        entry.status === "closed" &&
        (options.includeImportedEntries || isNativeEntry(entry)) &&
        isFiniteNumber(entry.realizedPnl),
    )
    .map((entry) => {
      const relatedSessionLogIds = new Set(entry.relatedSessionLogIds ?? []);
      const entryEvents = events.filter(
        (event) =>
          event.journalEntryId === entry.id ||
          event.tradeId === entry.id ||
          (event.sessionLogId ? relatedSessionLogIds.has(event.sessionLogId) : false),
      );

      return {
        ...entry,
        events: entryEvents,
        pnl: entry.realizedPnl as number,
        timestampMs: new Date(getEntryTimestamp(entry)).getTime(),
      };
    })
    .filter((entry) => Number.isFinite(entry.timestampMs))
    .sort((left, right) => left.timestampMs - right.timestampMs);
}

function summarizeTrades(trades: TradeSummary[]): GroupStats {
  const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);

  return {
    averagePnl: trades.length > 0 ? netPnl / trades.length : 0,
    eventIds: Array.from(new Set(trades.flatMap((trade) => trade.events.map((event) => event.id)))),
    journalEntryIds: trades.map((trade) => trade.id),
    losses: trades.filter((trade) => trade.pnl < 0).length,
    netPnl,
    tradeCount: trades.length,
    wins: trades.filter((trade) => trade.pnl > 0).length,
  };
}

function getWinRate(stats: GroupStats) {
  return stats.tradeCount > 0 ? stats.wins / stats.tradeCount : 0;
}

function getDrawdownContribution(stats: GroupStats) {
  return Math.abs(
    stats.tradeCount > 0
      ? stats.netPnl < 0
        ? stats.netPnl
        : stats.losses
      : 0,
  );
}

function createRule(rule: RecommendedDisciplineRule): RecommendedDisciplineRule {
  return rule;
}

function createFinding(details: DiagnosisFinding): DiagnosisFinding {
  return details;
}

function getHourBucket(timestampMs: number) {
  const hour = new Date(timestampMs).getHours();
  return `${String(hour).padStart(2, "0")}:00-${String((hour + 1) % 24).padStart(2, "0")}:00`;
}

function groupBy<T>(items: T[], getKey: (item: T) => string | null) {
  const groups = new Map<string, T[]>();

  items.forEach((item) => {
    const key = getKey(item);

    if (!key) {
      return;
    }

    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return groups;
}

function buildPostLossFinding(trades: TradeSummary[], allStats: GroupStats): DiagnosisFinding | null {
  const postLossTrades: TradeSummary[] = [];

  trades.forEach((trade, index) => {
    const nextTrade = trades[index + 1];

    if (!nextTrade || trade.pnl >= 0 || nextTrade.timestampMs - trade.timestampMs > ONE_DAY_MS) {
      return;
    }

    postLossTrades.push(nextTrade);
  });

  const stats = summarizeTrades(postLossTrades);

  if (stats.tradeCount < MIN_GROUP_SAMPLE || stats.netPnl >= 0) {
    return null;
  }

  const id = "finding:post-loss-behavior";
  const recommendedRule = createRule({
    id: "rule:cooldown-after-loss",
    proposedValue: { minutes: 30 },
    reason: "Trades placed soon after realized losses are underperforming the rest of the sample.",
    ruleType: "cooldown_after_loss",
    sourceFindingId: id,
    title: "Cooldown after realized losses",
  });

  return createFinding({
    category: "post_loss_behavior",
    evidenceEventIds: stats.eventIds,
    id,
    impact: {
      drawdownContribution: getDrawdownContribution(stats),
      netPnl: stats.netPnl,
      tradeCount: stats.tradeCount,
      winRate: getWinRate(stats),
    },
    journalEntryIds: stats.journalEntryIds,
    recommendation: "Add a cooldown after realized losses.",
    recommendedRule,
    severity: stats.netPnl <= -100 ? "critical" : "warning",
    summary: "Your trades after losses are underperforming your normal trades.",
    title: "Post-loss trading is hurting you.",
  });
}

function buildOverrideBondFinding(events: JournalMemoryEvent[]): DiagnosisFinding | null {
  const overrideEvents = events.filter((event) => event.type === "discipline_override_bond_posted");

  if (overrideEvents.length < 2) {
    return null;
  }

  const id = "finding:override-bond-pattern";
  const recommendedRule = createRule({
    id: "rule:override-bond-warning",
    proposedValue: { cooldownMinutesAfterOverride: 30, keepLockedOverridesExpensive: true },
    reason: "Repeated Override Bonds usually mean rules are being broken under pressure.",
    ruleType: "override_bond_warning",
    sourceFindingId: id,
    title: "Override review and cooldown",
  });

  return createFinding({
    category: "override_bond",
    evidenceEventIds: overrideEvents.map((event) => event.id),
    id,
    impact: {
      tradeCount: overrideEvents.length,
    },
    journalEntryIds: Array.from(new Set(overrideEvents.map((event) => event.journalEntryId).filter(Boolean))) as string[],
    recommendation: "Keep locked-rule overrides expensive and add a cooldown after overrides.",
    recommendedRule,
    severity: "warning",
    summary: "You posted multiple Override Bonds in this sample. That usually means rules are being broken under pressure.",
    title: "Override Bonds are becoming a pattern.",
  });
}

function buildAiWarningFinding(trades: TradeSummary[], events: JournalMemoryEvent[]): DiagnosisFinding | null {
  const warningEvents = events.filter(
    (event) => event.type === "ai_warning_ignored" || event.type === "ai_warning_dismissed",
  );

  if (warningEvents.length === 0) {
    return null;
  }

  const warningTradeIds = new Set(warningEvents.map((event) => event.journalEntryId ?? event.tradeId).filter(Boolean));
  const warningTrades = trades.filter((trade) => warningTradeIds.has(trade.id) || trade.events.some((event) => warningEvents.includes(event)));
  const stats = summarizeTrades(warningTrades);

  const id = "finding:ai-warning-ignored";
  return createFinding({
    category: "ai_warning_ignored",
    evidenceEventIds: warningEvents.map((event) => event.id),
    id,
    impact: {
      netPnl: stats.tradeCount > 0 ? stats.netPnl : undefined,
      tradeCount: Math.max(stats.tradeCount, warningEvents.length),
      winRate: stats.tradeCount > 0 ? getWinRate(stats) : undefined,
    },
    journalEntryIds: Array.from(warningTradeIds) as string[],
    recommendation: "Review critical AI warnings before the next trade.",
    severity: warningEvents.some((event) => event.severity === "critical") ? "critical" : "warning",
    summary: "AI warnings appeared near this trade. Review whether you followed the plan.",
    title: "You traded through warnings.",
  });
}

function buildBrokenPlanFinding(trades: TradeSummary[]): DiagnosisFinding | null {
  const brokenTrades = trades.filter((trade) => trade.planFollowed === "broken");
  const stats = summarizeTrades(brokenTrades);

  if (stats.tradeCount < MIN_GROUP_SAMPLE || stats.netPnl >= 0) {
    return null;
  }

  const id = "finding:plan-broken";
  return createFinding({
    category: "plan_broken",
    evidenceEventIds: stats.eventIds,
    id,
    impact: {
      drawdownContribution: getDrawdownContribution(stats),
      netPnl: stats.netPnl,
      tradeCount: stats.tradeCount,
      winRate: getWinRate(stats),
    },
    journalEntryIds: stats.journalEntryIds,
    recommendation: "Review the plan before adding new risk.",
    severity: "critical",
    summary: "Trades marked as broken-plan trades are underperforming your sample.",
    title: "Broken plans are costing you.",
  });
}

function buildTimeWindowFinding(trades: TradeSummary[], allStats: GroupStats): DiagnosisFinding | null {
  const weakest = Array.from(groupBy(trades, (trade) => getHourBucket(trade.timestampMs)).entries())
    .map(([bucket, bucketTrades]) => ({ bucket, stats: summarizeTrades(bucketTrades) }))
    .filter(({ stats }) => stats.tradeCount >= MIN_GROUP_SAMPLE && stats.netPnl < 0 && stats.averagePnl < allStats.averagePnl)
    .sort((left, right) => left.stats.netPnl - right.stats.netPnl)[0];

  if (!weakest) {
    return null;
  }

  const id = `finding:time-window:${weakest.bucket}`;
  const recommendedRule = createRule({
    id: `rule:blocked-time-window:${weakest.bucket}`,
    proposedValue: { window: weakest.bucket, mode: "warn_or_block" },
    reason: `${weakest.bucket} is the weakest time bucket in this sample.`,
    ruleType: "blocked_time_window",
    sourceFindingId: id,
    title: `Warn or block ${weakest.bucket}`,
  });

  return createFinding({
    category: "time_window",
    evidenceEventIds: weakest.stats.eventIds,
    id,
    impact: {
      drawdownContribution: getDrawdownContribution(weakest.stats),
      netPnl: weakest.stats.netPnl,
      tradeCount: weakest.stats.tradeCount,
      winRate: getWinRate(weakest.stats),
    },
    journalEntryIds: weakest.stats.journalEntryIds,
    recommendation: "Block or warn during this window.",
    recommendedRule,
    severity: "warning",
    summary: `${weakest.bucket} is underperforming the rest of your Portal sample.`,
    title: "This time window underperforms.",
  });
}

function isManualEntry(trade: TradeSummary) {
  const source = trade.entrySource?.toLowerCase() ?? "";
  return source === "market" || source.includes("manual");
}

function buildManualEntryFinding(trades: TradeSummary[], allStats: GroupStats): DiagnosisFinding | null {
  const manualTrades = trades.filter(isManualEntry);
  const stats = summarizeTrades(manualTrades);

  if (stats.tradeCount < MIN_GROUP_SAMPLE || stats.netPnl >= 0 || stats.averagePnl >= allStats.averagePnl) {
    return null;
  }

  const id = "finding:manual-entry-weakness";
  return createFinding({
    category: "manual_entry",
    evidenceEventIds: stats.eventIds,
    id,
    impact: {
      drawdownContribution: getDrawdownContribution(stats),
      netPnl: stats.netPnl,
      tradeCount: stats.tradeCount,
      winRate: getWinRate(stats),
    },
    journalEntryIds: stats.journalEntryIds,
    recommendation: "Treat manual market entries as a review signal.",
    severity: "warning",
    summary: "Manual market entries are underperforming planned or trigger-based entries in this sample.",
    title: "Manual entries underperform.",
  });
}

function buildOvertradingFinding(trades: TradeSummary[]): DiagnosisFinding | null {
  const weakestDay = Array.from(
    groupBy(trades, (trade) => new Date(trade.timestampMs).toISOString().slice(0, 10)).entries(),
  )
    .map(([day, dayTrades]) => ({ day, stats: summarizeTrades(dayTrades) }))
    .filter(({ stats }) => stats.tradeCount > 3 && stats.netPnl < 0)
    .sort((left, right) => left.stats.netPnl - right.stats.netPnl)[0];

  if (!weakestDay) {
    return null;
  }

  const id = `finding:overtrading:${weakestDay.day}`;
  const recommendedRule = createRule({
    id: "rule:max-trades-per-day",
    proposedValue: { maxTrades: 3 },
    reason: "A high-trade-count day in this sample finished negative.",
    ruleType: "max_trades_per_day",
    sourceFindingId: id,
    title: "Max trades per day",
  });

  return createFinding({
    category: "trigger",
    evidenceEventIds: weakestDay.stats.eventIds,
    id,
    impact: {
      drawdownContribution: getDrawdownContribution(weakestDay.stats),
      netPnl: weakestDay.stats.netPnl,
      tradeCount: weakestDay.stats.tradeCount,
      winRate: getWinRate(weakestDay.stats),
    },
    journalEntryIds: weakestDay.stats.journalEntryIds,
    recommendation: "Cap trade count after the third trade unless a plan is confirmed.",
    recommendedRule,
    severity: "warning",
    summary: "One or more high-frequency trading days finished negative.",
    title: "Too many trades in one day is hurting you.",
  });
}

function buildPositiveFindings(trades: TradeSummary[]): DiagnosisFinding[] {
  const findings: DiagnosisFinding[] = [];
  const allStats = summarizeTrades(trades);
  const followedTrades = trades.filter((trade) => trade.planFollowed === "followed");
  const followedStats = summarizeTrades(followedTrades);

  if (followedStats.tradeCount >= MIN_GROUP_SAMPLE && followedStats.netPnl > 0 && followedStats.averagePnl > allStats.averagePnl) {
    findings.push(
      createFinding({
        category: "setup_quality",
        evidenceEventIds: followedStats.eventIds,
        id: "finding:plan-followed-working",
        impact: {
          avgRr: undefined,
          netPnl: followedStats.netPnl,
          tradeCount: followedStats.tradeCount,
          winRate: getWinRate(followedStats),
        },
        journalEntryIds: followedStats.journalEntryIds,
        recommendation: "Keep making plan confirmation part of the trade, not the recap.",
        severity: "positive",
        summary: "Trades where the plan was followed are outperforming your broader sample.",
        title: "This behavior is working.",
      }),
    );
  }

  const magicTrades = trades.filter((trade) => trade.events.some((event) => event.type === "magic_trade_executed"));
  const magicStats = summarizeTrades(magicTrades);

  if (magicStats.tradeCount >= MIN_GROUP_SAMPLE && magicStats.netPnl > 0) {
    findings.push(
      createFinding({
        category: "magic_trade",
        evidenceEventIds: magicStats.eventIds,
        id: "finding:magic-trade-working",
        impact: {
          netPnl: magicStats.netPnl,
          tradeCount: magicStats.tradeCount,
          winRate: getWinRate(magicStats),
        },
        journalEntryIds: magicStats.journalEntryIds,
        recommendation: "Keep using planned Magic Trade execution when the setup is clear.",
        severity: "positive",
        summary: "Magic Trade-linked decisions are positive in this sample.",
        title: "Planned automation is helping.",
      }),
    );
  }

  return findings.slice(0, 3);
}

function sortFindingsByPriority(findings: DiagnosisFinding[]) {
  return [...findings].sort((left, right) => {
    const leftPnl = left.impact.netPnl ?? 0;
    const rightPnl = right.impact.netPnl ?? 0;

    if (leftPnl !== rightPnl) {
      return leftPnl - rightPnl;
    }

    const leftDrawdown = left.impact.drawdownContribution ?? 0;
    const rightDrawdown = right.impact.drawdownContribution ?? 0;

    if (leftDrawdown !== rightDrawdown) {
      return rightDrawdown - leftDrawdown;
    }

    const leftWinRate = left.impact.winRate ?? 1;
    const rightWinRate = right.impact.winRate ?? 1;

    if (leftWinRate !== rightWinRate) {
      return leftWinRate - rightWinRate;
    }

    return (right.impact.tradeCount ?? 0) - (left.impact.tradeCount ?? 0);
  });
}

function buildRecommendedPlan(findings: DiagnosisFinding[], confidence: OperatorDiagnosisConfidence): RecommendedDisciplinePlan {
  const rulesByType = new Map<RecommendedDisciplineRuleType, RecommendedDisciplineRule>();

  sortFindingsByPriority(findings).forEach((finding) => {
    if (finding.recommendedRule && !rulesByType.has(finding.recommendedRule.ruleType)) {
      rulesByType.set(finding.recommendedRule.ruleType, finding.recommendedRule);
    }
  });

  const rules = Array.from(rulesByType.values()).slice(0, 4);

  return {
    expectedBenefit:
      rules.length === 0
        ? confidence === "low"
          ? "Not enough data yet. Portal needs more completed trades, warnings, or Discipline events before recommending a plan."
          : "No clear Discipline change is recommended from this sample yet."
        : confidence === "low"
          ? "Early signal only. Review these rules before trusting the pattern."
          : "Built to protect Net PnL first, then reduce drawdown, improve win rate, reduce emotional trading, and improve average R:R.",
    id: "operator-diagnosis-plan-v1",
    rules,
    status: "review_ready",
    summary:
      rules.length === 0
        ? "No Discipline Plan is ready yet."
        : "Draft rules generated from the strongest Portal-native Journal, Discipline, and AI warning evidence.",
    title: "Recommended Discipline Plan",
  };
}

export function deriveOperatorDiagnosisV1(input: OperatorDiagnosisInput): OperatorDiagnosis {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const trades = toTradeSummaries(input.journalEntries, input.journalMemoryEvents, {
    includeImportedEntries: input.includeImportedEntries,
  });
  const sampleSize = trades.length;
  const primaryNativeSampleSize = trades.filter(isPrimaryNativeDiagnosisEntry).length;
  const confidence = getConfidence(primaryNativeSampleSize);
  const allStats = summarizeTrades(trades);

  const candidateLeaks = [
    buildPostLossFinding(trades, allStats),
    buildOverrideBondFinding(input.journalMemoryEvents),
    buildAiWarningFinding(trades, input.journalMemoryEvents),
    buildBrokenPlanFinding(trades),
    buildTimeWindowFinding(trades, allStats),
    buildManualEntryFinding(trades, allStats),
    buildOvertradingFinding(trades),
  ].filter((finding): finding is DiagnosisFinding => finding !== null);

  const profitLeaks = sampleSize === 0 ? [] : sortFindingsByPriority(candidateLeaks).slice(0, 6);
  const profitableBehaviors = sampleSize === 0 ? [] : buildPositiveFindings(trades);
  const nativeSessionReviewCandidates = mapNativeSessionsToDiagnosisFindings(input.nativeSessions ?? []);

  return {
    confidence,
    generatedAt,
    nativeSessionReviewCandidates,
    profitableBehaviors,
    profitLeaks,
    recommendedPlan: buildRecommendedPlan(profitLeaks, confidence),
    sampleSize,
  };
}
