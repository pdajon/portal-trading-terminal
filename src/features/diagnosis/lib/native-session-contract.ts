import type { HyperliquidEnvironment } from "@/lib/hyperliquid/types";
import {
  canUseAsPrimaryDiagnosisEvidence,
  canUseAsSupportingDiagnosisEvidence,
  isDebugOnlyEvidence,
  isImportedEvidence,
  isNativeEvidence,
  type DiagnosisEvidence,
  type DiagnosisEvidenceAllowedUse,
  type DiagnosisEvidenceConfidence,
  type DiagnosisEvidenceProhibitedUse,
  type EvidenceTrustLevel,
} from "./diagnosis-evidence";

export type NativeSessionSource = "portal_native";
export type NativeSessionType = "regular" | "overnight" | "weekend" | "high_density" | "review_only";
export type NativeSessionDiagnosisReadiness =
  | "diagnosis_grade"
  | "directional_only"
  | "directional_context"
  | "unsafe_not_enough_evidence"
  | "insufficient_evidence";

export type NativeSessionMix = Record<string, {
  netPnl: number;
  tradeCount: number;
}>;

export type NativeSessionV1 = {
  accountAddress: string | null;
  aiWarningDismissedCount: number;
  aiWarningShownCount: number;
  allowedUses: DiagnosisEvidenceAllowedUse[];
  assetMix: NativeSessionMix;
  averageHoldMinutes: number | null;
  bestTradeId: string | null;
  closedTrades: number;
  confidence: DiagnosisEvidenceConfidence;
  confidenceReasons: string[];
  diagnosisReadiness: NativeSessionDiagnosisReadiness;
  directionMix: NativeSessionMix;
  disciplineViolationCount: number;
  endedAt: number;
  environment: HyperliquidEnvironment | null;
  evidence: DiagnosisEvidence[];
  fees: number | null;
  firstTradeResult: "win" | "loss" | "breakeven" | "open" | null;
  funding: number | null;
  grossPnlBeforeFees: number | null;
  id: string;
  lastTradeResult: "win" | "loss" | "breakeven" | "open" | null;
  localDateKey: string;
  losses: number;
  manualExecutionCount: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  netPnlAfterFeesAndFunding: number | null;
  openTrades: number;
  plannedExecutionCount: number;
  postLossReentryCount: number;
  prohibitedUses: DiagnosisEvidenceProhibitedUse[];
  protectedTradeCount: number;
  relatedAiWarningIds: string[];
  relatedDisciplineEventIds: string[];
  relatedExecutionEventIds: string[];
  relatedJournalEntryIds: string[];
  relatedTradeIds: string[];
  sessionType: NativeSessionType;
  shortGapTradeCount: number;
  source: NativeSessionSource;
  startedAt: number;
  tags: string[];
  timezone: string | null;
  totalTimeInMarketMinutes: number | null;
  totalTrades: number;
  unprotectedTradeCount: number;
  walletAddress: string | null;
  winRate: number | null;
  wins: number;
  worstTradeId: string | null;
};

export type NativeSessionIdInput = {
  accountAddress?: string | null;
  environment: HyperliquidEnvironment | null;
  eventIds?: string[];
  localDateKey: string;
  startedAt: number;
  tradeIds?: string[];
  walletAddress?: string | null;
};

export type RealtimeWarningGateOptions = {
  explicitRuleSupport: boolean;
};

const MEDIUM_OR_HIGH = new Set<DiagnosisEvidenceConfidence>(["medium", "high"]);

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function normalizeIdPart(value: string | null | undefined, fallback: string) {
  const source = value?.trim();

  if (!source) {
    return fallback;
  }

  return source.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

function uniqueSorted(values: string[] | undefined) {
  return Array.from(new Set(values ?? [])).sort();
}

export function createNativeSessionId(input: NativeSessionIdInput) {
  const accountOrWallet = normalizeIdPart(input.accountAddress ?? input.walletAddress, "unknown-account");
  const environment = normalizeIdPart(input.environment, "unknown-env");
  const membership = JSON.stringify({
    eventIds: uniqueSorted(input.eventIds),
    tradeIds: uniqueSorted(input.tradeIds),
  });
  const membershipHash = stableHash(membership);

  return `native-session:${accountOrWallet}:${environment}:${input.localDateKey}:${input.startedAt}:${membershipHash}`;
}

function isValidTimezone(timezone: string | null | undefined) {
  if (!timezone) {
    return false;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function hasNativeDiagnosisGradeEvidence(session: NativeSessionV1) {
  return session.evidence.some(
    (evidence) =>
      isNativeEvidence(evidence) &&
      evidence.trustLevel === "diagnosis_grade" &&
      evidence.confidence !== "insufficient_evidence" &&
      canUseAsSupportingDiagnosisEvidence(evidence),
  );
}

function hasImportedOrDebugUserFacingEvidence(session: NativeSessionV1) {
  return session.evidence.some((evidence) => isImportedEvidence(evidence) || isDebugOnlyEvidence(evidence));
}

function hasNativeEvidenceReferences(session: NativeSessionV1) {
  return (
    session.relatedTradeIds.length > 0 ||
    session.relatedJournalEntryIds.length > 0 ||
    session.relatedExecutionEventIds.length > 0 ||
    session.relatedDisciplineEventIds.length > 0 ||
    session.relatedAiWarningIds.length > 0 ||
    session.evidence.some((evidence) => evidence.relatedTradeIds.length > 0 || evidence.relatedSessionIds.length > 0)
  );
}

export function explainNativeSessionLimitations(session: NativeSessionV1) {
  const limitations: string[] = [];

  if (session.source !== "portal_native") {
    limitations.push("Session source must be portal-native for diagnosis-grade native session claims.");
  }

  if (!isValidTimezone(session.timezone)) {
    limitations.push("A valid IANA timezone is required for time and session diagnosis.");
  }

  if (session.closedTrades < 2) {
    limitations.push("At least 2 closed native trades are required for session-level diagnosis.");
  }

  if (!hasNativeEvidenceReferences(session)) {
    limitations.push("Native evidence references are required; imported-only references cannot prove a native session.");
  }

  if (!MEDIUM_OR_HIGH.has(session.confidence)) {
    limitations.push("Native session confidence must be medium or high for diagnosis-grade use.");
  }

  if (session.diagnosisReadiness !== "diagnosis_grade") {
    limitations.push("Session diagnosisReadiness must be diagnosis_grade before primary diagnosis use.");
  }

  if (!hasNativeDiagnosisGradeEvidence(session)) {
    limitations.push("Diagnosis-grade native evidence is required for native session eligibility.");
  }

  if (hasImportedOrDebugUserFacingEvidence(session)) {
    limitations.push("Imported, external, or debug-only evidence cannot be included as user-facing native session proof.");
  }

  return limitations;
}

export function canBecomeDiagnosisGradeNativeSession(session: NativeSessionV1) {
  return explainNativeSessionLimitations(session).length === 0;
}

export function canFeedPrimaryOperatorDiagnosis(session: NativeSessionV1) {
  return (
    canBecomeDiagnosisGradeNativeSession(session) &&
    session.allowedUses.includes("operator_diagnosis_primary") &&
    session.evidence.some(canUseAsPrimaryDiagnosisEvidence)
  );
}

export function canSuggestDisciplinePlanReview(session: NativeSessionV1) {
  return (
    canBecomeDiagnosisGradeNativeSession(session) &&
    session.evidence.some(
      (evidence) =>
        isNativeEvidence(evidence) &&
        evidence.trustLevel === "diagnosis_grade" &&
        evidence.confidence !== "insufficient_evidence",
    )
  );
}

export function canTriggerRealtimeWarning(
  session: NativeSessionV1,
  options: RealtimeWarningGateOptions,
) {
  return (
    options.explicitRuleSupport &&
    canBecomeDiagnosisGradeNativeSession(session) &&
    session.allowedUses.includes("operator_diagnosis_primary") &&
    !session.prohibitedUses.includes("automatic_trade_blocking") &&
    session.evidence.some(canUseAsPrimaryDiagnosisEvidence)
  );
}
