import type { HyperliquidEnvironment } from "@/lib/hyperliquid/types";
import {
  getPortalTimeParts,
  isTraderLocalWeekend,
  resolvePortalTimezone,
  tradeOverlapsOvernightWindow,
} from "@/features/time/portal-time";
import {
  canBecomeDiagnosisGradeNativeSession,
  createNativeSessionId,
  explainNativeSessionLimitations,
  type NativeSessionDiagnosisReadiness,
  type NativeSessionMix,
  type NativeSessionType,
  type NativeSessionV1,
} from "./native-session-contract";
import {
  createNativeAiWarningEvidence,
  createNativeDisciplineEvidence,
  createNativeExecutionEvidence,
  createNativeJournalEvidence,
  isDebugOnlyEvidence,
  isImportedEvidence,
  isNativeEvidence,
  type DiagnosisEvidence,
  type DiagnosisEvidenceConfidence,
  type DiagnosisEvidenceSourceWarning,
  type EvidenceSourceType,
} from "./diagnosis-evidence";
import {
  summarizeNativeSessionSourceHealth,
  type NativeSessionSourceHealthSummary,
} from "./native-session-source-health";
import type { EvidenceComparisonDebugOutput } from "./evidence-comparison";
import {
  buildEvidenceDrawerForNativeSessionReviewCandidate,
  summarizeEvidenceDrawerDebugOutput,
  type EvidenceDrawerDebugOutput,
} from "./evidence-drawer";
import { mapNativeSessionsToDiagnosisFindings } from "./native-session-diagnosis";

export type NativeJournalEntryLike = {
  asset?: string | null;
  closedAt?: string | number | null;
  dataSource?: string | null;
  diagnosisEvidence?: DiagnosisEvidence;
  direction?: "long" | "short" | string | null;
  entrySource?: string | null;
  fees?: number | null;
  funding?: number | null;
  grossPnlBeforeFees?: number | null;
  id: string;
  openedAt?: string | number | null;
  planFollowed?: "followed" | "broken" | "unclear" | string | null;
  protected?: boolean | null;
  realizedPnl?: number | null;
  sourceType?: string | null;
  status: "open" | "closed" | string;
  symbol?: string | null;
  timestamp: string | number;
};

export type NativeExecutionEventLike = {
  id: string;
  sourceType?: string | null;
  timestamp: string | number;
  tradeId?: string | null;
  type?: string | null;
};

export type NativeDisciplineEventLike = {
  id: string;
  sourceType?: string | null;
  timestamp: string | number;
  tradeId?: string | null;
  type?: string | null;
};

export type NativeAiWarningEventLike = {
  id: string;
  sourceType?: string | null;
  timestamp: string | number;
  tradeId?: string | null;
  type?: "shown" | "dismissed" | "ignored" | "respected" | string | null;
};

export type NativeDiagnosisFindingLike = {
  evidenceEventIds?: string[];
  id: string;
  journalEntryIds?: string[];
};

export type BuildNativeSessionsInput = {
  accountAddress?: string | null;
  aiWarningEvents?: NativeAiWarningEventLike[];
  diagnosisFindings?: NativeDiagnosisFindingLike[];
  disciplineEvents?: NativeDisciplineEventLike[];
  environment: HyperliquidEnvironment;
  executionEvents?: NativeExecutionEventLike[];
  journalEntries?: NativeJournalEntryLike[];
  timezone: string;
  walletAddress?: string | null;
};

export type NativeSessionEngineDebugOutput = {
  comparisonSummary: EvidenceComparisonDebugOutput | null;
  confidenceDistribution: Record<string, number>;
  diagnosisGradeCount: number;
  diagnosisReadinessDistribution: Record<string, number>;
  directionalOnlyCount: number;
  evidenceDrawerSummary: EvidenceDrawerDebugOutput;
  evidenceSourceCounts: Record<string, number>;
  nativeSessionCount: number;
  rejectedDebugEvidenceCount: number;
  rejectedImportedEvidenceCount: number;
  sampleSessions: Array<{
    closedTrades: number;
    confidence: DiagnosisEvidenceConfidence;
    diagnosisReadiness: NativeSessionDiagnosisReadiness;
    endedAt: number;
    localDateKey: string;
    safeId: string;
    startedAt: number;
    tags: string[];
    totalTrades: number;
  }>;
  sourceHealth: NativeSessionSourceHealthSummary;
  tagCounts: Record<string, number>;
  topLimitations: Array<{ count: number; limitation: string }>;
  unsafeCount: number;
};

type NativeTrade = NativeJournalEntryLike & {
  assetKey: string;
  closeEpochMs: number | null;
  endEpochMs: number;
  grossPnlBeforeFeesValue: number | null;
  isClosed: boolean;
  localDateKey: string;
  nativeEvidence: DiagnosisEvidence | null;
  openEpochMs: number;
  pnl: number | null;
  side: "long" | "short" | "unknown";
};

type RejectionCounters = {
  debug: number;
  imported: number;
};

const DEFAULT_INACTIVITY_GAP_MS = 90 * 60 * 1000;
const SHORT_GAP_MS = 15 * 60 * 1000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toEpochMs(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function isImportedSource(value: { dataSource?: string | null; sourceType?: string | null }) {
  return value.dataSource === "imported" || value.sourceType === "imported";
}

function isNativeEntry(entry: NativeJournalEntryLike, counters: RejectionCounters) {
  if (isImportedSource(entry) || (entry.diagnosisEvidence && isImportedEvidence(entry.diagnosisEvidence))) {
    counters.imported += 1;
    return false;
  }

  if (entry.diagnosisEvidence && isDebugOnlyEvidence(entry.diagnosisEvidence)) {
    counters.debug += 1;
    return false;
  }

  return true;
}

function toNativeTrade(entry: NativeJournalEntryLike, timezone: string, counters: RejectionCounters): NativeTrade | null {
  if (!isNativeEntry(entry, counters)) {
    return null;
  }

  const openEpochMs = toEpochMs(entry.openedAt ?? entry.timestamp);
  const closeEpochMs = toEpochMs(entry.closedAt ?? null);

  if (openEpochMs === null) {
    return null;
  }

  const isClosed = entry.status === "closed";
  const endEpochMs = Math.max(closeEpochMs ?? openEpochMs, openEpochMs);
  const side = entry.direction === "long" || entry.direction === "short" ? entry.direction : "unknown";
  const assetKey = (entry.asset ?? entry.symbol ?? "UNKNOWN").toUpperCase();

  return {
    ...entry,
    assetKey,
    closeEpochMs,
    endEpochMs,
    grossPnlBeforeFeesValue: isFiniteNumber(entry.grossPnlBeforeFees) ? entry.grossPnlBeforeFees : null,
    isClosed,
    localDateKey: getPortalTimeParts(openEpochMs, { timezone }).traderLocalDateKey,
    nativeEvidence: entry.diagnosisEvidence && isNativeEvidence(entry.diagnosisEvidence) ? entry.diagnosisEvidence : null,
    openEpochMs,
    pnl: isFiniteNumber(entry.realizedPnl) ? entry.realizedPnl : null,
    side,
  };
}

function sortTrades(trades: NativeTrade[]) {
  return [...trades].sort((left, right) => left.openEpochMs - right.openEpochMs);
}

function groupTradesIntoSessions(trades: NativeTrade[]) {
  const sessions: NativeTrade[][] = [];

  sortTrades(trades).forEach((trade) => {
    const current = sessions[sessions.length - 1];
    const previous = current?.[current.length - 1];

    if (
      !current ||
      !previous ||
      trade.localDateKey !== previous.localDateKey ||
      trade.openEpochMs - previous.endEpochMs > DEFAULT_INACTIVITY_GAP_MS
    ) {
      sessions.push([trade]);
      return;
    }

    current.push(trade);
  });

  return sessions;
}

function eventTimestamp(event: { timestamp: string | number }) {
  return toEpochMs(event.timestamp);
}

function isImportedEvent(event: { sourceType?: string | null }) {
  return event.sourceType === "imported";
}

function eventInsideWindow(event: { timestamp: string | number }, start: number, end: number) {
  const timestamp = eventTimestamp(event);
  return timestamp !== null && timestamp >= start && timestamp <= end;
}

function getSessionWindow(trades: NativeTrade[]) {
  return {
    endedAt: Math.max(...trades.map((trade) => trade.endEpochMs)),
    startedAt: Math.min(...trades.map((trade) => trade.openEpochMs)),
  };
}

function sumNullable(values: Array<number | null | undefined>) {
  const finite = values.filter(isFiniteNumber);
  return finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) : null;
}

function resultForTrade(trade: NativeTrade): NativeSessionV1["firstTradeResult"] {
  if (!trade.isClosed) {
    return "open";
  }

  if (trade.pnl === null || trade.pnl === 0) {
    return "breakeven";
  }

  return trade.pnl > 0 ? "win" : "loss";
}

function maxStreak(results: Array<"win" | "loss" | "breakeven" | "open" | null>, target: "win" | "loss") {
  let current = 0;
  let max = 0;

  results.forEach((result) => {
    if (result === target) {
      current += 1;
      max = Math.max(max, current);
      return;
    }

    current = 0;
  });

  return max;
}

function buildMix(trades: NativeTrade[], getKey: (trade: NativeTrade) => string): NativeSessionMix {
  return trades.reduce<NativeSessionMix>((mix, trade) => {
    const key = getKey(trade);
    const existing = mix[key] ?? { netPnl: 0, tradeCount: 0 };

    return {
      ...mix,
      [key]: {
        netPnl: existing.netPnl + (trade.pnl ?? 0),
        tradeCount: existing.tradeCount + 1,
      },
    };
  }, {});
}

function isManualTrade(trade: NativeTrade) {
  const source = trade.entrySource?.toLowerCase() ?? "";
  return source === "market" || source === "manual" || source.includes("manual");
}

function isPlannedTrade(trade: NativeTrade) {
  const source = trade.entrySource?.toLowerCase() ?? "";
  return trade.planFollowed === "followed" || source.includes("magic") || source.includes("trigger") || source.includes("planned");
}

function isProtectedTrade(trade: NativeTrade) {
  return trade.protected === true;
}

function buildEvidence(input: {
  accountAddress: string | null;
  aiWarnings: NativeAiWarningEventLike[];
  disciplineEvents: NativeDisciplineEventLike[];
  environment: HyperliquidEnvironment;
  executions: NativeExecutionEventLike[];
  sessionId: string;
  timezone: string | null;
  trades: NativeTrade[];
  window: { endedAt: number; startedAt: number };
}) {
  const evidence: DiagnosisEvidence[] = [];
  const tradeIds = input.trades.map((trade) => trade.id);
  const attachedTradeEvidence = input.trades.flatMap((trade) => trade.nativeEvidence ? [trade.nativeEvidence] : []);

  if (attachedTradeEvidence.length > 0) {
    evidence.push(...attachedTradeEvidence);
  } else {
    evidence.push(createNativeJournalEvidence({
      accountAddress: input.accountAddress,
      confidence: input.trades.filter((trade) => trade.isClosed).length >= 2 ? "medium" : "low",
      environment: input.environment,
      id: `native-session-journal-evidence:${input.sessionId}`,
      relatedSessionIds: [input.sessionId],
      relatedTradeIds: tradeIds,
      timeRange: {
        endTime: input.window.endedAt,
        startTime: input.window.startedAt,
      },
      timezone: input.timezone,
    }));
  }

  if (input.executions.length > 0) {
    evidence.push(createNativeExecutionEvidence({
      accountAddress: input.accountAddress,
      confidence: "medium",
      environment: input.environment,
      id: `native-session-execution-evidence:${input.sessionId}`,
      relatedSessionIds: [input.sessionId],
      relatedTradeIds: tradeIds,
      timeRange: {
        endTime: input.window.endedAt,
        startTime: input.window.startedAt,
      },
      timezone: input.timezone,
    }));
  }

  if (input.disciplineEvents.length > 0) {
    evidence.push(createNativeDisciplineEvidence({
      accountAddress: input.accountAddress,
      confidence: "medium",
      environment: input.environment,
      id: `native-session-discipline-evidence:${input.sessionId}`,
      relatedSessionIds: [input.sessionId],
      relatedTradeIds: tradeIds,
      timeRange: {
        endTime: input.window.endedAt,
        startTime: input.window.startedAt,
      },
      timezone: input.timezone,
    }));
  }

  if (input.aiWarnings.length > 0) {
    evidence.push(createNativeAiWarningEvidence({
      accountAddress: input.accountAddress,
      confidence: "medium",
      environment: input.environment,
      id: `native-session-ai-warning-evidence:${input.sessionId}`,
      relatedSessionIds: [input.sessionId],
      relatedTradeIds: tradeIds,
      timeRange: {
        endTime: input.window.endedAt,
        startTime: input.window.startedAt,
      },
      timezone: input.timezone,
    }));
  }

  return evidence.filter((item) => !isImportedEvidence(item) && !isDebugOnlyEvidence(item));
}

function confidenceForSession(input: {
  closedTrades: number;
  hasInvalidTimezone: boolean;
  hasNativeEvidence: boolean;
}) : DiagnosisEvidenceConfidence {
  if (input.hasInvalidTimezone || !input.hasNativeEvidence) {
    return "insufficient_evidence";
  }

  if (input.closedTrades >= 5) {
    return "high";
  }

  if (input.closedTrades >= 2) {
    return "medium";
  }

  return "low";
}

function readinessForSession(input: {
  closedTrades: number;
  confidence: DiagnosisEvidenceConfidence;
  hasInvalidTimezone: boolean;
}) : NativeSessionDiagnosisReadiness {
  if (input.hasInvalidTimezone || input.confidence === "insufficient_evidence") {
    return "unsafe_not_enough_evidence";
  }

  if (input.closedTrades >= 2 && (input.confidence === "medium" || input.confidence === "high")) {
    return "diagnosis_grade";
  }

  return "directional_only";
}

function buildTags(input: {
  aiWarningCount: number;
  disciplineViolationCount: number;
  isHighDensity: boolean;
  isOvernight: boolean;
  isWeekend: boolean;
  manualExecutionCount: number;
  plannedExecutionCount: number;
  postLossReentryCount: number;
  protectedTradeCount: number;
  shortGapTradeCount: number;
  unprotectedTradeCount: number;
}) {
  const tags: string[] = [];

  if (input.postLossReentryCount > 0) tags.push("post_loss");
  if (input.shortGapTradeCount > 0) tags.push("rapid_reentry");
  if (input.isHighDensity) tags.push("high_density");
  if (input.disciplineViolationCount > 0) tags.push("discipline_violation");
  if (input.manualExecutionCount > 0) tags.push("manual_impulse");
  if (input.plannedExecutionCount > 0) tags.push("planned_execution");
  if (input.aiWarningCount > 0) tags.push("ai_warning");
  if (input.protectedTradeCount > 0) tags.push("protected");
  if (input.unprotectedTradeCount > 0) tags.push("unprotected");
  if (input.isOvernight) tags.push("overnight");
  if (input.isWeekend) tags.push("weekend");

  return tags;
}

function sessionTypeForTags(tags: string[]): NativeSessionType {
  if (tags.includes("high_density")) return "high_density";
  if (tags.includes("overnight")) return "overnight";
  if (tags.includes("weekend")) return "weekend";
  return "regular";
}

function countPostLossReentries(trades: NativeTrade[]) {
  return trades.reduce((count, trade, index) => {
    const nextTrade = trades[index + 1];
    if (!nextTrade || trade.pnl === null || trade.pnl >= 0) {
      return count;
    }

    return nextTrade.openEpochMs - trade.endEpochMs <= SHORT_GAP_MS ? count + 1 : count;
  }, 0);
}

function countShortGaps(trades: NativeTrade[]) {
  return trades.reduce((count, trade, index) => {
    const nextTrade = trades[index + 1];
    if (!nextTrade) {
      return count;
    }

    return nextTrade.openEpochMs - trade.endEpochMs <= SHORT_GAP_MS ? count + 1 : count;
  }, 0);
}

function buildSession(
  trades: NativeTrade[],
  input: BuildNativeSessionsInput,
  rejectedCounters: RejectionCounters,
) {
  const timezone = input.timezone?.trim() ? resolvePortalTimezone(input.timezone, "") : "";
  const hasInvalidTimezone = !timezone;
  const window = getSessionWindow(trades);
  const localDateKey = hasInvalidTimezone ? new Date(window.startedAt).toISOString().slice(0, 10) : getPortalTimeParts(window.startedAt, { timezone }).traderLocalDateKey;
  const relatedTradeIds = trades.map((trade) => trade.id);
  const executionEvents = (input.executionEvents ?? [])
    .filter((event) => !isImportedEvent(event) && eventInsideWindow(event, window.startedAt, window.endedAt));
  const disciplineEvents = (input.disciplineEvents ?? [])
    .filter((event) => !isImportedEvent(event) && eventInsideWindow(event, window.startedAt, window.endedAt));
  const aiWarningEvents = (input.aiWarningEvents ?? [])
    .filter((event) => !isImportedEvent(event) && eventInsideWindow(event, window.startedAt, window.endedAt));
  const sessionId = createNativeSessionId({
    accountAddress: input.accountAddress ?? null,
    environment: input.environment,
    eventIds: [
      ...executionEvents.map((event) => event.id),
      ...disciplineEvents.map((event) => event.id),
      ...aiWarningEvents.map((event) => event.id),
    ],
    localDateKey,
    startedAt: window.startedAt,
    tradeIds: relatedTradeIds,
    walletAddress: input.walletAddress ?? null,
  });
  const closedTrades = trades.filter((trade) => trade.isClosed).length;
  const openTrades = trades.length - closedTrades;
  const pnlTrades = trades.filter((trade) => trade.pnl !== null);
  const wins = pnlTrades.filter((trade) => (trade.pnl ?? 0) > 0).length;
  const losses = pnlTrades.filter((trade) => (trade.pnl ?? 0) < 0).length;
  const results = trades.map(resultForTrade);
  const netPnl = sumNullable(trades.map((trade) => trade.pnl));
  const grossPnl = sumNullable(trades.map((trade) => trade.grossPnlBeforeFeesValue));
  const fees = sumNullable(trades.map((trade) => trade.fees));
  const funding = sumNullable(trades.map((trade) => trade.funding));
  const bestTrade = [...pnlTrades].sort((left, right) => (right.pnl ?? 0) - (left.pnl ?? 0))[0] ?? null;
  const worstTrade = [...pnlTrades].sort((left, right) => (left.pnl ?? 0) - (right.pnl ?? 0))[0] ?? null;
  const holdDurations = trades
    .map((trade) => trade.closeEpochMs !== null ? Math.max(trade.closeEpochMs - trade.openEpochMs, 0) / 60_000 : null)
    .filter(isFiniteNumber);
  const manualExecutionCount = trades.filter(isManualTrade).length;
  const plannedExecutionCount = trades.filter(isPlannedTrade).length + executionEvents.length;
  const protectedTradeCount = trades.filter(isProtectedTrade).length;
  const unprotectedTradeCount = trades.filter((trade) => trade.protected === false).length;
  const postLossReentryCount = countPostLossReentries(trades);
  const shortGapTradeCount = countShortGaps(trades);
  const isHighDensity = trades.length >= 6 || (trades.length >= 4 && shortGapTradeCount >= 3);
  const isOvernight = !hasInvalidTimezone && trades.some((trade) =>
    tradeOverlapsOvernightWindow({ endEpochMs: trade.closeEpochMs, startEpochMs: trade.openEpochMs }, { timezone }),
  );
  const isWeekend = !hasInvalidTimezone && trades.some((trade) => isTraderLocalWeekend(trade.openEpochMs, { timezone }));
  const aiWarningShownCount = aiWarningEvents.filter((event) => event.type === "shown").length;
  const aiWarningDismissedCount = aiWarningEvents.filter((event) => event.type === "dismissed" || event.type === "ignored").length;
  const tags = buildTags({
    aiWarningCount: aiWarningEvents.length,
    disciplineViolationCount: disciplineEvents.length,
    isHighDensity,
    isOvernight,
    isWeekend,
    manualExecutionCount,
    plannedExecutionCount,
    postLossReentryCount,
    protectedTradeCount,
    shortGapTradeCount,
    unprotectedTradeCount,
  });
  const evidence = buildEvidence({
    accountAddress: input.accountAddress ?? null,
    aiWarnings: aiWarningEvents,
    disciplineEvents,
    environment: input.environment,
    executions: executionEvents,
    sessionId,
    timezone: hasInvalidTimezone ? null : timezone,
    trades,
    window,
  });
  const confidence = confidenceForSession({
    closedTrades,
    hasInvalidTimezone,
    hasNativeEvidence: evidence.length > 0,
  });
  const diagnosisReadiness = readinessForSession({ closedTrades, confidence, hasInvalidTimezone });
  const preliminary: NativeSessionV1 = {
    accountAddress: input.accountAddress ?? null,
    aiWarningDismissedCount,
    aiWarningShownCount,
    allowedUses: ["operator_diagnosis_primary", "operator_diagnosis_supporting", "ai_coach_context", "investigation_prompt"],
    assetMix: buildMix(trades, (trade) => trade.assetKey),
    averageHoldMinutes: holdDurations.length > 0 ? holdDurations.reduce((sum, value) => sum + value, 0) / holdDurations.length : null,
    bestTradeId: bestTrade?.id ?? null,
    closedTrades,
    confidence,
    confidenceReasons: [],
    diagnosisReadiness,
    directionMix: buildMix(trades, (trade) => trade.side),
    disciplineViolationCount: disciplineEvents.length,
    endedAt: window.endedAt,
    environment: input.environment,
    evidence,
    fees,
    firstTradeResult: results[0] ?? null,
    funding,
    grossPnlBeforeFees: grossPnl,
    id: sessionId,
    lastTradeResult: results[results.length - 1] ?? null,
    localDateKey,
    losses,
    manualExecutionCount,
    maxConsecutiveLosses: maxStreak(results, "loss"),
    maxConsecutiveWins: maxStreak(results, "win"),
    netPnlAfterFeesAndFunding: netPnl,
    openTrades,
    plannedExecutionCount,
    postLossReentryCount,
    prohibitedUses: ["discipline_enforcement"],
    protectedTradeCount,
    relatedAiWarningIds: aiWarningEvents.map((event) => event.id),
    relatedDisciplineEventIds: disciplineEvents.map((event) => event.id),
    relatedExecutionEventIds: executionEvents.map((event) => event.id),
    relatedJournalEntryIds: relatedTradeIds,
    relatedTradeIds,
    sessionType: sessionTypeForTags(tags),
    shortGapTradeCount,
    source: "portal_native",
    startedAt: window.startedAt,
    tags,
    timezone: hasInvalidTimezone ? null : timezone,
    totalTimeInMarketMinutes: holdDurations.length > 0 ? holdDurations.reduce((sum, value) => sum + value, 0) : null,
    totalTrades: trades.length,
    unprotectedTradeCount,
    walletAddress: input.walletAddress ?? null,
    winRate: closedTrades > 0 ? wins / closedTrades : null,
    wins,
    worstTradeId: worstTrade?.id ?? null,
  };
  const limitations = explainNativeSessionLimitations(preliminary);

  return {
    ...preliminary,
    confidenceReasons: [
      ...limitations,
      ...(rejectedCounters.imported > 0 ? [`Rejected ${rejectedCounters.imported} imported evidence item${rejectedCounters.imported === 1 ? "" : "s"} from native session construction.`] : []),
      ...(rejectedCounters.debug > 0 ? [`Rejected ${rejectedCounters.debug} debug-only evidence item${rejectedCounters.debug === 1 ? "" : "s"} from user-facing native session evidence.`] : []),
      ...(limitations.length === 0 ? ["Native session satisfies diagnosis-grade contract gates."] : []),
    ],
  };
}

export function buildNativeSessions(input: BuildNativeSessionsInput): NativeSessionV1[] {
  const rejectedCounters: RejectionCounters = { debug: 0, imported: 0 };
  const timezone = input.timezone?.trim() ? resolvePortalTimezone(input.timezone, "") : "UTC";
  const trades = (input.journalEntries ?? [])
    .map((entry) => toNativeTrade(entry, timezone, rejectedCounters))
    .filter((trade): trade is NativeTrade => trade !== null);

  if (trades.length === 0) {
    return [];
  }

  return groupTradesIntoSessions(trades).map((group) => buildSession(group, input, rejectedCounters));
}

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function stableAuditHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function summarizeWarnings(sessions: NativeSessionV1[]) {
  const counts = new Map<string, number>();

  sessions.flatMap((session) => session.confidenceReasons).forEach((reason) => {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([limitation, count]) => ({ count, limitation }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

export function summarizeNativeSessionEngineDebugOutput(input: {
  comparisonSummary?: EvidenceComparisonDebugOutput | null;
  rejectedDebugEvidenceCount?: number;
  rejectedImportedEvidenceCount?: number;
  sessions: NativeSessionV1[];
}): NativeSessionEngineDebugOutput {
  const tagCounts: Record<string, number> = {};
  const evidenceSourceCounts: Record<string, number> = {};
  const confidenceDistribution: Record<string, number> = {};
  const diagnosisReadinessDistribution: Record<string, number> = {};
  const sourceHealth = summarizeNativeSessionSourceHealth(input);
  const evidenceDrawerSummary = summarizeEvidenceDrawerDebugOutput(
    mapNativeSessionsToDiagnosisFindings(input.sessions).map(
      buildEvidenceDrawerForNativeSessionReviewCandidate,
    ),
  );

  input.sessions.forEach((session) => {
    session.tags.forEach((tag) => increment(tagCounts, tag));
    increment(confidenceDistribution, session.confidence);
    increment(diagnosisReadinessDistribution, session.diagnosisReadiness);
    session.evidence.forEach((evidence) => increment(evidenceSourceCounts, evidence.sourceType));
  });

  return {
    comparisonSummary: input.comparisonSummary ?? null,
    confidenceDistribution,
    diagnosisGradeCount: input.sessions.filter(canBecomeDiagnosisGradeNativeSession).length,
    diagnosisReadinessDistribution,
    directionalOnlyCount: input.sessions.filter((session) => session.diagnosisReadiness === "directional_only").length,
    evidenceDrawerSummary,
    evidenceSourceCounts,
    nativeSessionCount: input.sessions.length,
    rejectedDebugEvidenceCount: input.rejectedDebugEvidenceCount ?? 0,
    rejectedImportedEvidenceCount: input.rejectedImportedEvidenceCount ?? 0,
    sampleSessions: input.sessions.slice(0, 5).map((session) => ({
      closedTrades: session.closedTrades,
      confidence: session.confidence,
      diagnosisReadiness: session.diagnosisReadiness,
      endedAt: session.endedAt,
      localDateKey: session.localDateKey,
      safeId: `native-session:${stableAuditHash(session.id)}`,
      startedAt: session.startedAt,
      tags: session.tags,
      totalTrades: session.totalTrades,
    })),
    sourceHealth,
    tagCounts,
    topLimitations: summarizeWarnings(input.sessions),
    unsafeCount: input.sessions.filter((session) => session.diagnosisReadiness === "unsafe_not_enough_evidence").length,
  };
}
