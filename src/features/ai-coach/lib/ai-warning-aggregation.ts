import type { BaselineProfile, SessionIntelligenceResult } from "@/features/baseline-import/types";
import type { OperatorDiagnosis } from "@/features/diagnosis/lib/operator-diagnosis";
import type { ImportedSessionSupportingContext } from "@/features/diagnosis/lib/imported-session-supporting-context";
import type { EvidenceComparisonResult } from "@/features/diagnosis/lib/evidence-comparison";
import type { JournalMemoryEvent } from "@/features/journal/lib/journal-memory-events";
import type { JournalInsightReplayFrame } from "@/features/journal/lib/journal-insights";

import {
  deriveObservationalCoachV1,
  type AiCoachCurrentIntent,
  type AiCoachJournalEntry,
  type AiCoachLivePosition,
  type AiCoachRuleState,
  type AiCoachSessionLogEntry,
  type AiCoachSessionLogEventType,
  type AiCoachV1,
} from "./observational-coach";

export type AiWarningAggregationJournalEntry = {
  direction?: "long" | "short" | null;
  entrySource?: string;
  entryStyle: AiCoachJournalEntry["entryStyle"];
  id: string;
  realizedPnl: number | null;
  relatedSessionLogIds: string[];
  replayMetadata: {
    frames: JournalInsightReplayFrame[];
  };
  setupTag: string | null;
  size: number | null;
  status: "open" | "closed";
  symbol?: string | null;
  timestamp: string;
};

export type AiWarningAggregationLivePosition = AiCoachLivePosition;

export type AiWarningAggregationSessionLogEntry = {
  eventType: string;
  id: string;
  metadata?: unknown;
  size?: number | null;
  symbol?: string | null;
  timestamp: string;
};

export type AiWarningAggregationInput = {
  activeDisciplineRuleCount: number;
  activeSymbol: string;
  baselineProfile: BaselineProfile | null;
  baselineEvidenceComparisons?: EvidenceComparisonResult[];
  baselineSessionIntelligence?: SessionIntelligenceResult | null;
  baselineSessionSupportingContexts?: ImportedSessionSupportingContext[];
  collateralAllocationPercent: number;
  cooldownRemainingMs: number;
  dismissedWarningIds: string[];
  disciplineCurrentlyBlocked: boolean;
  executableMarketSize: number | null;
  hasPlanContext: boolean;
  journalEntries: AiWarningAggregationJournalEntry[];
  journalMemoryEvents: JournalMemoryEvent[];
  liveExchangePositions: AiWarningAggregationLivePosition[];
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
  now?: string;
  operatorDiagnosis: OperatorDiagnosis | null;
  realizedPnlToday: number;
  selectedTradeDirection: "long" | "short";
  sessionLogEntries: AiWarningAggregationSessionLogEntry[];
  tradesPlacedToday: number;
  tradeExecutionMode: "market" | "limit";
};

const AI_WARNING_SESSION_EVENT_TYPES = [
  "position-closed",
  "position-reversed",
  "close-all-used",
  "protection-attached",
  "protection-updated",
  "break-even-used",
  "position-reduced",
  "discipline-rule-blocked",
  "discipline-market-entry-confirmation-required",
  "discipline-market-entry-confirmed",
  "discipline-market-entry-canceled",
  "discipline-rule-edit-blocked",
  "discipline-override-bond-posted",
] as const satisfies readonly AiCoachSessionLogEventType[];

const aiWarningSessionEventTypeSet = new Set<string>(
  AI_WARNING_SESSION_EVENT_TYPES,
);

function isAiWarningSessionEventType(
  eventType: string,
): eventType is AiCoachSessionLogEventType {
  return aiWarningSessionEventTypeSet.has(eventType);
}

export function mapSessionLogsForAiWarnings(
  sessionLogEntries: AiWarningAggregationSessionLogEntry[],
): AiCoachSessionLogEntry[] {
  return sessionLogEntries.flatMap((entry): AiCoachSessionLogEntry[] => {
    if (!isAiWarningSessionEventType(entry.eventType)) {
      return [];
    }

    return [
      {
        eventType: entry.eventType,
        id: entry.id,
        metadata: entry.metadata,
        size: entry.size,
        symbol: entry.symbol,
        timestamp: entry.timestamp,
      },
    ];
  });
}

export function selectAiCoachLivePosition(
  liveExchangePositions: AiWarningAggregationLivePosition[],
  activeSymbol: string,
): AiCoachLivePosition | null {
  return (
    liveExchangePositions.find((position) => position.symbol === activeSymbol) ??
    liveExchangePositions[0] ??
    null
  );
}

export function mapJournalEntriesForAiWarnings(
  journalEntries: AiWarningAggregationJournalEntry[],
): AiCoachJournalEntry[] {
  return journalEntries.map((entry) => ({
    direction: entry.direction,
    entrySource: entry.entrySource,
    entryStyle: entry.entryStyle,
    id: entry.id,
    realizedPnl: entry.realizedPnl,
    relatedSessionLogIds: entry.relatedSessionLogIds,
    replayMetadata: {
      frames: entry.replayMetadata.frames.map((frame) => ({
        capturedAt: frame.capturedAt,
        event: frame.event,
      })),
    },
    setupTag: entry.setupTag,
    size: entry.size,
    status: entry.status,
    symbol: entry.symbol,
    timestamp: entry.timestamp,
  }));
}

export function buildAiWarningCurrentIntent(
  input: Pick<
    AiWarningAggregationInput,
    | "activeSymbol"
    | "collateralAllocationPercent"
    | "executableMarketSize"
    | "hasPlanContext"
    | "selectedTradeDirection"
    | "tradeExecutionMode"
  >,
): AiCoachCurrentIntent {
  return {
    allocationPercent: input.collateralAllocationPercent,
    direction: input.selectedTradeDirection,
    estimatedSize: input.executableMarketSize,
    executionMode: input.tradeExecutionMode,
    hasPlanContext: input.hasPlanContext,
    source: "manual",
    symbol: input.activeSymbol,
  };
}

export function buildAiWarningRuleState(
  input: Pick<
    AiWarningAggregationInput,
    | "activeDisciplineRuleCount"
    | "cooldownRemainingMs"
    | "disciplineCurrentlyBlocked"
    | "maxDailyLoss"
    | "maxTradesPerDay"
    | "realizedPnlToday"
    | "tradesPlacedToday"
  >,
): AiCoachRuleState {
  return {
    activeDisciplineRuleCount: input.activeDisciplineRuleCount,
    cooldownRemainingMs: input.cooldownRemainingMs,
    disciplineCurrentlyBlocked: input.disciplineCurrentlyBlocked,
    maxDailyLoss: input.maxDailyLoss,
    maxTradesPerDay: input.maxTradesPerDay,
    realizedPnlToday: input.realizedPnlToday,
    tradesPlacedToday: input.tradesPlacedToday,
  };
}

export function deriveAiWarningAggregation(
  input: AiWarningAggregationInput,
): AiCoachV1 {
  return deriveObservationalCoachV1({
    baselineProfile: input.baselineProfile,
    baselineEvidenceComparisons: input.baselineEvidenceComparisons ?? [],
    baselineSessionIntelligence: input.baselineSessionIntelligence ?? null,
    baselineSessionSupportingContexts: input.baselineSessionSupportingContexts ?? [],
    currentIntent: buildAiWarningCurrentIntent(input),
    dismissedWarningIds: input.dismissedWarningIds,
    journalEntries: mapJournalEntriesForAiWarnings(input.journalEntries),
    journalMemoryEvents: input.journalMemoryEvents,
    livePosition: selectAiCoachLivePosition(
      input.liveExchangePositions,
      input.activeSymbol,
    ),
    now: input.now,
    operatorDiagnosis: input.operatorDiagnosis,
    ruleState: buildAiWarningRuleState(input),
    sessionLogEntries: mapSessionLogsForAiWarnings(input.sessionLogEntries),
  });
}

export function getNextDismissedAiWarningIds(
  currentIds: string[],
  warningId: string,
) {
  return currentIds.includes(warningId)
    ? currentIds
    : [...currentIds, warningId];
}
