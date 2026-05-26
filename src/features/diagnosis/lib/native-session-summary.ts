import type {
  DiagnosisFinding,
  OperatorDiagnosis,
  OperatorDiagnosisConfidence,
  OperatorDiagnosisJournalEntry,
  OperatorDiagnosisSessionLogEntry,
} from "./operator-diagnosis";
import type { JournalMemoryEvent } from "@/features/journal/lib/journal-memory-events";
import type {
  DiagnosisEvidenceAllowedUse,
  DiagnosisEvidenceConfidence,
  DiagnosisEvidenceProhibitedUse,
  DiagnosisEvidenceSourceWarning,
  EvidenceSourceType,
  EvidenceTrustLevel,
} from "./diagnosis-evidence";
import {
  canUseAsPrimaryDiagnosisEvidence,
  isDebugOnlyEvidence,
  isImportedEvidence,
  isNativeEvidence,
} from "./diagnosis-evidence";
import type {
  EvidenceComparisonDirection,
  EvidenceComparisonTopic,
  NativeEvidenceComparisonSummary,
} from "./evidence-comparison";

export type NativeSessionSummaryTopic =
  | "post_loss_behavior"
  | "manual_planned_execution"
  | "ai_warning_behavior"
  | "discipline_violations"
  | "time_window_findings"
  | "high_density_sessions";

export type NativeSessionSummary = {
  allowedUses: DiagnosisEvidenceAllowedUse[];
  confidence: DiagnosisEvidenceConfidence;
  evidenceIds: string[];
  hasNativeEvidence: boolean;
  limitations: string[];
  netPnl: number | null;
  prohibitedUses: DiagnosisEvidenceProhibitedUse[];
  relatedSessionIds: string[];
  relatedTradeIds: string[];
  sampleSize: number;
  sourceTypes: EvidenceSourceType[];
  sourceWarnings: DiagnosisEvidenceSourceWarning[];
  summary: string;
  topic: NativeSessionSummaryTopic;
  trustLevel: EvidenceTrustLevel;
  winRate: number | null;
};

export type NativeSessionSummaryInput = {
  diagnosis?: OperatorDiagnosis | null;
  journalEntries?: OperatorDiagnosisJournalEntry[];
  journalMemoryEvents?: JournalMemoryEvent[];
  sessionLogs?: OperatorDiagnosisSessionLogEntry[];
};

const DEFAULT_TOPICS: NativeSessionSummaryTopic[] = [
  "post_loss_behavior",
  "manual_planned_execution",
  "ai_warning_behavior",
  "discipline_violations",
  "time_window_findings",
  "high_density_sessions",
];

const NATIVE_SUMMARY_ALLOWED_USES = [
  "operator_diagnosis_supporting",
  "ai_coach_context",
  "investigation_prompt",
] satisfies DiagnosisEvidenceAllowedUse[];

const NATIVE_SUMMARY_PROHIBITED_USES = [
  "discipline_enforcement",
  "automatic_trade_blocking",
] satisfies DiagnosisEvidenceProhibitedUse[];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function confidenceFromDiagnosis(confidence: OperatorDiagnosisConfidence): DiagnosisEvidenceConfidence {
  return confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";
}

function confidenceFromSampleSize(sampleSize: number): DiagnosisEvidenceConfidence {
  if (sampleSize >= 20) {
    return "high";
  }

  if (sampleSize >= 5) {
    return "medium";
  }

  if (sampleSize > 0) {
    return "low";
  }

  return "insufficient_evidence";
}

function findFindingForTopic(
  diagnosis: OperatorDiagnosis | null | undefined,
  topic: NativeSessionSummaryTopic,
) {
  const findings = [...(diagnosis?.profitLeaks ?? []), ...(diagnosis?.profitableBehaviors ?? [])];

  return findings.find((finding) => findingMatchesTopic(finding, topic)) ?? null;
}

function findingMatchesTopic(finding: DiagnosisFinding, topic: NativeSessionSummaryTopic) {
  switch (topic) {
    case "post_loss_behavior":
      return finding.category === "post_loss_behavior";
    case "manual_planned_execution":
      return finding.category === "manual_entry" || finding.category === "magic_trade" || finding.category === "plan_broken";
    case "ai_warning_behavior":
      return finding.category === "ai_warning_ignored";
    case "discipline_violations":
      return finding.category === "discipline_block" || finding.category === "override_bond";
    case "time_window_findings":
      return finding.category === "time_window";
    case "high_density_sessions":
      return finding.id.includes("overtrading") || finding.recommendedRule?.ruleType === "max_trades_per_day";
  }
}

function emptySummary(topic: NativeSessionSummaryTopic): NativeSessionSummary {
  return {
    allowedUses: [],
    confidence: "insufficient_evidence",
    evidenceIds: [],
    hasNativeEvidence: false,
    limitations: [`No native evidence is available for ${topic.replaceAll("_", " ")}.`],
    netPnl: null,
    prohibitedUses: NATIVE_SUMMARY_PROHIBITED_USES,
    relatedSessionIds: [],
    relatedTradeIds: [],
    sampleSize: 0,
    sourceTypes: [],
    sourceWarnings: [],
    summary: "No native Portal evidence is available yet.",
    topic,
    trustLevel: "insufficient_evidence",
    winRate: null,
  };
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function isNativeJournalEntry(entry: OperatorDiagnosisJournalEntry) {
  if (entry.diagnosisEvidence) {
    return (
      isNativeEvidence(entry.diagnosisEvidence) &&
      !isImportedEvidence(entry.diagnosisEvidence) &&
      !isDebugOnlyEvidence(entry.diagnosisEvidence) &&
      canUseAsPrimaryDiagnosisEvidence(entry.diagnosisEvidence)
    );
  }

  return entry.dataSource !== "imported" && entry.sourceType !== "imported";
}

function getEntryTimestampMs(entry: OperatorDiagnosisJournalEntry) {
  const timestamp = entry.openedAt ?? entry.timestamp;
  const timestampMs = new Date(timestamp).getTime();

  return Number.isFinite(timestampMs) ? timestampMs : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type NativeTrade = OperatorDiagnosisJournalEntry & {
  pnl: number;
  timestampMs: number;
};

function getNativeClosedTrades(entries: OperatorDiagnosisJournalEntry[] | undefined): NativeTrade[] {
  return (entries ?? [])
    .filter((entry) => entry.status === "closed" && isNativeJournalEntry(entry) && isFiniteNumber(entry.realizedPnl))
    .map((entry) => ({
      ...entry,
      pnl: entry.realizedPnl as number,
      timestampMs: getEntryTimestampMs(entry) ?? Number.NaN,
    }))
    .filter((entry) => Number.isFinite(entry.timestampMs))
    .sort((left, right) => left.timestampMs - right.timestampMs);
}

function isNativeMemoryEvent(event: JournalMemoryEvent) {
  return event.source !== "system";
}

function getNativeEvents(events: JournalMemoryEvent[] | undefined) {
  return (events ?? []).filter(isNativeMemoryEvent);
}

function winRateFromTrades(trades: NativeTrade[]) {
  return trades.length > 0 ? trades.filter((trade) => trade.pnl > 0).length / trades.length : null;
}

function netPnlFromTrades(trades: NativeTrade[]) {
  return trades.length > 0 ? trades.reduce((sum, trade) => sum + trade.pnl, 0) : null;
}

function createNativeSummary(input: {
  confidence?: DiagnosisEvidenceConfidence;
  evidenceIds: string[];
  limitations?: string[];
  netPnl: number | null;
  relatedSessionIds?: string[];
  relatedTradeIds: string[];
  sampleSize: number;
  sourceTypes: EvidenceSourceType[];
  sourceWarnings?: DiagnosisEvidenceSourceWarning[];
  summary: string;
  topic: NativeSessionSummaryTopic;
  winRate: number | null;
}): NativeSessionSummary {
  const confidence = input.confidence ?? confidenceFromSampleSize(input.sampleSize);

  if (input.sampleSize <= 0 || confidence === "insufficient_evidence") {
    return emptySummary(input.topic);
  }

  return {
    allowedUses: [...NATIVE_SUMMARY_ALLOWED_USES],
    confidence,
    evidenceIds: unique(input.evidenceIds),
    hasNativeEvidence: true,
    limitations: input.limitations ?? [],
    netPnl: input.netPnl,
    prohibitedUses: [...NATIVE_SUMMARY_PROHIBITED_USES],
    relatedSessionIds: unique(input.relatedSessionIds ?? []),
    relatedTradeIds: unique(input.relatedTradeIds),
    sampleSize: input.sampleSize,
    sourceTypes: unique(input.sourceTypes),
    sourceWarnings: input.sourceWarnings ?? [],
    summary: input.summary,
    topic: input.topic,
    trustLevel: "diagnosis_grade",
    winRate: input.winRate,
  };
}

function sourceTypesForFinding(finding: DiagnosisFinding): EvidenceSourceType[] {
  switch (finding.category) {
    case "ai_warning_ignored":
      return ["native_ai_warning"];
    case "discipline_block":
    case "override_bond":
      return ["native_discipline"];
    case "magic_trade":
    case "trigger":
      return ["native_execution"];
    case "time_window":
    case "post_loss_behavior":
    case "manual_entry":
    case "plan_broken":
    case "setup_quality":
    case "asset":
    case "risk_reward":
      return ["native_journal"];
  }
}

function findingHasNativeEvidence(input: {
  finding: DiagnosisFinding;
  journalEntries?: OperatorDiagnosisJournalEntry[];
  journalMemoryEvents?: JournalMemoryEvent[];
}) {
  const entries = input.journalEntries ?? [];
  const events = input.journalMemoryEvents ?? [];

  if (entries.length === 0 && events.length === 0) {
    return true;
  }

  const matchingNativeEntries = entries.filter(
    (entry) => input.finding.journalEntryIds.includes(entry.id) && isNativeJournalEntry(entry),
  );
  const matchingNativeEvents = events.filter(
    (event) => input.finding.evidenceEventIds.includes(event.id) && isNativeMemoryEvent(event),
  );

  return matchingNativeEntries.length > 0 || matchingNativeEvents.length > 0;
}

function summaryFromFinding(input: {
  diagnosis: OperatorDiagnosis;
  finding: DiagnosisFinding;
  journalEntries?: OperatorDiagnosisJournalEntry[];
  journalMemoryEvents?: JournalMemoryEvent[];
  topic: NativeSessionSummaryTopic;
}) {
  if (!findingHasNativeEvidence(input)) {
    return null;
  }

  return createNativeSummary({
    confidence: confidenceFromDiagnosis(input.diagnosis.confidence),
    evidenceIds: [...input.finding.evidenceEventIds, ...input.finding.journalEntryIds],
    netPnl: input.finding.impact.netPnl ?? null,
    relatedTradeIds: input.finding.journalEntryIds,
    sampleSize: input.finding.impact.tradeCount ?? input.finding.journalEntryIds.length,
    sourceTypes: sourceTypesForFinding(input.finding),
    summary: input.finding.summary,
    topic: input.topic,
    winRate: input.finding.impact.winRate ?? null,
  });
}

function buildPostLossSummaryFromJournal(input: NativeSessionSummaryInput) {
  const trades = getNativeClosedTrades(input.journalEntries);
  const postLossTrades: NativeTrade[] = [];

  trades.forEach((trade, index) => {
    const nextTrade = trades[index + 1];

    if (!nextTrade || trade.pnl >= 0 || nextTrade.timestampMs - trade.timestampMs > ONE_DAY_MS) {
      return;
    }

    postLossTrades.push(nextTrade);
  });

  if (postLossTrades.length === 0) {
    return null;
  }

  return createNativeSummary({
    evidenceIds: postLossTrades.map((trade) => trade.id),
    netPnl: netPnlFromTrades(postLossTrades),
    relatedTradeIds: postLossTrades.map((trade) => trade.id),
    sampleSize: postLossTrades.length,
    sourceTypes: ["native_journal"],
    summary: `Native Journal shows ${postLossTrades.length} post-loss re-entry trade${postLossTrades.length === 1 ? "" : "s"} in the Portal sample.`,
    topic: "post_loss_behavior",
    winRate: winRateFromTrades(postLossTrades),
  });
}

function isManualEntry(entry: OperatorDiagnosisJournalEntry) {
  const source = entry.entrySource?.toLowerCase() ?? "";

  return source === "market" || source.includes("manual");
}

function isPlannedEntry(entry: OperatorDiagnosisJournalEntry) {
  const source = entry.entrySource?.toLowerCase() ?? "";

  return entry.planFollowed === "followed" || source.includes("magic") || source.includes("trigger") || source.includes("planned");
}

function buildManualVsPlannedSummaryFromJournal(input: NativeSessionSummaryInput) {
  const trades = getNativeClosedTrades(input.journalEntries);
  const manualTrades = trades.filter(isManualEntry);
  const plannedTrades = trades.filter(isPlannedEntry);

  if (manualTrades.length === 0 && plannedTrades.length === 0) {
    return null;
  }

  const sampleTrades = manualTrades.length > 0 ? manualTrades : plannedTrades;
  const manualNetPnl = netPnlFromTrades(manualTrades);
  const plannedNetPnl = netPnlFromTrades(plannedTrades);

  return createNativeSummary({
    evidenceIds: sampleTrades.map((trade) => trade.id),
    limitations: plannedTrades.length === 0 ? ["No native planned-entry comparison sample is available yet."] : [],
    netPnl: manualNetPnl ?? plannedNetPnl,
    relatedTradeIds: sampleTrades.map((trade) => trade.id),
    sampleSize: sampleTrades.length,
    sourceTypes: ["native_journal", ...(plannedTrades.length > 0 ? (["native_execution"] as const) : [])],
    summary: `Native Journal has ${manualTrades.length} manual trade${manualTrades.length === 1 ? "" : "s"} and ${plannedTrades.length} planned or trigger-based trade${plannedTrades.length === 1 ? "" : "s"} available for review.`,
    topic: "manual_planned_execution",
    winRate: winRateFromTrades(sampleTrades),
  });
}

function buildAiWarningSummaryFromEvents(input: NativeSessionSummaryInput) {
  const warningEvents = getNativeEvents(input.journalMemoryEvents).filter((event) =>
    event.type === "ai_warning_ignored" ||
    event.type === "ai_warning_dismissed" ||
    event.type === "ai_warning_respected" ||
    event.type === "ai_warning_shown"
  );

  if (warningEvents.length === 0) {
    return null;
  }

  const ignoredCount = warningEvents.filter(
    (event) => event.type === "ai_warning_ignored" || event.type === "ai_warning_dismissed",
  ).length;

  return createNativeSummary({
    evidenceIds: warningEvents.map((event) => event.id),
    netPnl: null,
    relatedTradeIds: unique(warningEvents.map((event) => event.journalEntryId ?? event.tradeId).filter(Boolean) as string[]),
    sampleSize: warningEvents.length,
    sourceTypes: ["native_ai_warning"],
    summary: `Native AI warning history has ${warningEvents.length} warning event${warningEvents.length === 1 ? "" : "s"}, including ${ignoredCount} ignored or dismissed warning${ignoredCount === 1 ? "" : "s"}.`,
    topic: "ai_warning_behavior",
    winRate: null,
  });
}

function buildDisciplineSummaryFromEvents(input: NativeSessionSummaryInput) {
  const memoryEvents = getNativeEvents(input.journalMemoryEvents).filter((event) =>
    event.type === "discipline_rule_blocked" ||
    event.type === "discipline_rule_edit_blocked" ||
    event.type === "discipline_override_bond_posted"
  );
  const sessionLogEvents = (input.sessionLogs ?? []).filter((entry) =>
    entry.eventType === "discipline-rule-blocked" ||
    entry.eventType === "discipline-rule-edit-blocked" ||
    entry.eventType === "discipline-override-bond-posted"
  );

  if (memoryEvents.length === 0 && sessionLogEvents.length === 0) {
    return null;
  }

  return createNativeSummary({
    evidenceIds: [...memoryEvents.map((event) => event.id), ...sessionLogEvents.map((event) => event.id)],
    netPnl: null,
    relatedSessionIds: unique(memoryEvents.map((event) => event.sessionLogId).filter(Boolean) as string[]),
    relatedTradeIds: unique(memoryEvents.map((event) => event.journalEntryId ?? event.tradeId).filter(Boolean) as string[]),
    sampleSize: memoryEvents.length + sessionLogEvents.length,
    sourceTypes: ["native_discipline"],
    summary: `Native Discipline history has ${memoryEvents.length + sessionLogEvents.length} rule block or override event${memoryEvents.length + sessionLogEvents.length === 1 ? "" : "s"} available for review.`,
    topic: "discipline_violations",
    winRate: null,
  });
}

function buildTimeWindowSummaryFromJournal(input: NativeSessionSummaryInput) {
  const trades = getNativeClosedTrades(input.journalEntries);
  const buckets = new Map<string, NativeTrade[]>();

  trades.forEach((trade) => {
    const hour = new Date(trade.timestampMs).getHours();
    const key = `${String(hour).padStart(2, "0")}:00`;
    buckets.set(key, [...(buckets.get(key) ?? []), trade]);
  });

  const weakest = Array.from(buckets.entries())
    .map(([bucket, bucketTrades]) => ({ bucket, netPnl: netPnlFromTrades(bucketTrades) ?? 0, trades: bucketTrades }))
    .filter((bucket) => bucket.trades.length >= 2 && bucket.netPnl < 0)
    .sort((left, right) => left.netPnl - right.netPnl)[0];

  if (!weakest) {
    return null;
  }

  return createNativeSummary({
    evidenceIds: weakest.trades.map((trade) => trade.id),
    netPnl: weakest.netPnl,
    relatedTradeIds: weakest.trades.map((trade) => trade.id),
    sampleSize: weakest.trades.length,
    sourceTypes: ["native_journal"],
    summary: `Native Journal shows a weak ${weakest.bucket} time-window sample.`,
    topic: "time_window_findings",
    winRate: winRateFromTrades(weakest.trades),
  });
}

function buildHighDensitySummaryFromJournal(input: NativeSessionSummaryInput) {
  const trades = getNativeClosedTrades(input.journalEntries);
  const days = new Map<string, NativeTrade[]>();

  trades.forEach((trade) => {
    const key = new Date(trade.timestampMs).toISOString().slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), trade]);
  });

  const busiestNegativeDay = Array.from(days.entries())
    .map(([day, dayTrades]) => ({ day, netPnl: netPnlFromTrades(dayTrades) ?? 0, trades: dayTrades }))
    .filter((day) => day.trades.length > 3 && day.netPnl < 0)
    .sort((left, right) => left.netPnl - right.netPnl)[0];

  if (!busiestNegativeDay) {
    return null;
  }

  return createNativeSummary({
    evidenceIds: busiestNegativeDay.trades.map((trade) => trade.id),
    netPnl: busiestNegativeDay.netPnl,
    relatedTradeIds: busiestNegativeDay.trades.map((trade) => trade.id),
    sampleSize: busiestNegativeDay.trades.length,
    sourceTypes: ["native_journal"],
    summary: `Native Journal shows ${busiestNegativeDay.trades.length} trades on ${busiestNegativeDay.day}, and that high-density day was negative.`,
    topic: "high_density_sessions",
    winRate: winRateFromTrades(busiestNegativeDay.trades),
  });
}

export function buildNativeSessionSummaryForTopic(input: {
  diagnosis?: OperatorDiagnosis | null;
  journalEntries?: OperatorDiagnosisJournalEntry[];
  journalMemoryEvents?: JournalMemoryEvent[];
  sessionLogs?: OperatorDiagnosisSessionLogEntry[];
  topic: NativeSessionSummaryTopic;
}): NativeSessionSummary {
  const finding = findFindingForTopic(input.diagnosis, input.topic);

  if (input.diagnosis && finding) {
    const findingSummary = summaryFromFinding({
      diagnosis: input.diagnosis,
      finding,
      journalEntries: input.journalEntries,
      journalMemoryEvents: input.journalMemoryEvents,
      topic: input.topic,
    });

    if (findingSummary) {
      return findingSummary;
    }
  }

  switch (input.topic) {
    case "post_loss_behavior":
      return buildPostLossSummaryFromJournal(input) ?? emptySummary(input.topic);
    case "manual_planned_execution":
      return buildManualVsPlannedSummaryFromJournal(input) ?? emptySummary(input.topic);
    case "ai_warning_behavior":
      return buildAiWarningSummaryFromEvents(input) ?? emptySummary(input.topic);
    case "discipline_violations":
      return buildDisciplineSummaryFromEvents(input) ?? emptySummary(input.topic);
    case "time_window_findings":
      return buildTimeWindowSummaryFromJournal(input) ?? emptySummary(input.topic);
    case "high_density_sessions":
      return buildHighDensitySummaryFromJournal(input) ?? emptySummary(input.topic);
  }
}

export function buildNativeSessionSummaries(
  input: NativeSessionSummaryInput,
  topics: NativeSessionSummaryTopic[] = DEFAULT_TOPICS,
) {
  return topics.map((topic) =>
    buildNativeSessionSummaryForTopic({
      ...input,
      topic,
    }),
  );
}

export function buildNativeSessionSummariesFromOperatorDiagnosis(
  diagnosis: OperatorDiagnosis | null | undefined,
  input: Omit<NativeSessionSummaryInput, "diagnosis"> = {},
  topics: NativeSessionSummaryTopic[] = DEFAULT_TOPICS,
) {
  return buildNativeSessionSummaries({ ...input, diagnosis }, topics);
}

function comparisonTopicForNativeSummary(
  topic: NativeSessionSummaryTopic,
): EvidenceComparisonTopic | null {
  switch (topic) {
    case "post_loss_behavior":
      return "post_loss_behavior";
    case "high_density_sessions":
      return "high_density_sessions";
    case "time_window_findings":
      return "overnight_performance";
    case "manual_planned_execution":
    case "ai_warning_behavior":
    case "discipline_violations":
      return null;
  }
}

function directionForSummary(summary: NativeSessionSummary): EvidenceComparisonDirection {
  if (summary.netPnl === null) {
    return "unknown";
  }

  if (summary.netPnl > 0) {
    return "positive";
  }

  if (summary.netPnl < 0) {
    return "negative";
  }

  return "neutral";
}

function strengthForSummary(summary: NativeSessionSummary): NativeEvidenceComparisonSummary["strength"] {
  if (!summary.hasNativeEvidence) {
    return "insufficient";
  }

  if (summary.confidence === "high") {
    return "strong";
  }

  if (summary.confidence === "medium") {
    return "moderate";
  }

  return "weak";
}

export function mapNativeSessionSummariesToEvidenceComparisonSummaries(
  summaries: NativeSessionSummary[],
): NativeEvidenceComparisonSummary[] {
  return summaries.flatMap((summary): NativeEvidenceComparisonSummary[] => {
    const topic = comparisonTopicForNativeSummary(summary.topic);

    if (!summary.hasNativeEvidence || !topic) {
      return [];
    }

    return [
      {
        confidence: summary.confidence,
        direction: directionForSummary(summary),
        id: `native-session-summary:${summary.topic}`,
        label: "Native Portal evidence",
        relatedEvidenceIds: summary.evidenceIds,
        sourceWarnings: summary.sourceWarnings,
        strength: strengthForSummary(summary),
        summary: summary.summary,
        topic,
        trustLevel: summary.trustLevel,
      },
    ];
  });
}
