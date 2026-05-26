import {
  canBecomeDiagnosisGradeNativeSession,
  explainNativeSessionLimitations,
  type NativeSessionV1,
} from "./native-session-contract";
import {
  isDebugOnlyEvidence,
  isImportedEvidence,
  isNativeEvidence,
  type DiagnosisEvidenceConfidence,
  type EvidenceSourceType,
  type EvidenceTrustLevel,
} from "./diagnosis-evidence";
import type {
  EvidenceComparisonDirection,
  EvidenceComparisonTopic,
  NativeEvidenceComparisonSummary,
} from "./evidence-comparison";
import { mapNativeSessionsToDiagnosisFindings } from "./native-session-diagnosis";

export type NativeSessionSourceHealthLimitation = {
  count: number;
  reason: string;
};

export type NativeSessionSourceHealthSummary = {
  blocked: boolean;
  blockedReasons: string[];
  confidenceMix: Record<string, number>;
  diagnosisGradeCount: number;
  directionalOnlyCount: number;
  displayLines: string[];
  eligibleForFutureDiagnosis: boolean;
  limitations: NativeSessionSourceHealthLimitation[];
  nativeDiagnosisCandidateCount: number;
  nativeDiagnosisCandidatesByConfidence: Record<string, number>;
  nativeDiagnosisCandidatesBySeverity: Record<string, number>;
  nativeDiagnosisCandidatesByTopic: Record<string, number>;
  primaryDiagnosisFindingCount: number;
  readinessMix: Record<string, number>;
  rejectedDebugEvidenceCount: number;
  rejectedImportedEvidenceCount: number;
  rejectedSessionCount: number;
  rejectedSessions: Array<{
    reasons: string[];
    safeId: string;
  }>;
  reviewOnlyStatus: "review_only_not_promoted";
  sessionCount: number;
  sourceTypeCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  unsafeCount: number;
};

export type NativeSessionSourceHealthInput = {
  rejectedDebugEvidenceCount?: number;
  rejectedImportedEvidenceCount?: number;
  sessions: NativeSessionV1[];
};

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function countLimitations(sessions: NativeSessionV1[]) {
  const counts = new Map<string, number>();

  sessions.flatMap(explainNativeSessionLimitations).forEach((reason) => {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ count, reason }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function buildBlockedReasons(input: {
  limitations: NativeSessionSourceHealthLimitation[];
  rejectedDebugEvidenceCount: number;
  rejectedImportedEvidenceCount: number;
  sessionCount: number;
}) {
  const reasons = input.limitations.map((limitation) => limitation.reason);

  if (input.sessionCount === 0) {
    reasons.push("No native sessions are available yet.");
  }

  if (input.rejectedImportedEvidenceCount > 0) {
    reasons.push(
      `Rejected ${input.rejectedImportedEvidenceCount} imported evidence item${
        input.rejectedImportedEvidenceCount === 1 ? "" : "s"
      } from native-session source health.`,
    );
  }

  if (input.rejectedDebugEvidenceCount > 0) {
    reasons.push(
      `Rejected ${input.rejectedDebugEvidenceCount} debug-only evidence item${
        input.rejectedDebugEvidenceCount === 1 ? "" : "s"
      } from user-facing native-session source health.`,
    );
  }

  return unique(reasons);
}

function buildDisplayLines(input: {
  blockedReasons: string[];
  diagnosisGradeCount: number;
  sessionCount: number;
}) {
  const lines = [
    "Native session engine available",
    `Diagnosis-grade native sessions: ${input.diagnosisGradeCount}`,
  ];

  if (input.blockedReasons.length > 0) {
    lines.push(`Some sessions are blocked: ${input.blockedReasons.slice(0, 3).join(" / ")}`);
  }

  lines.push("Not yet promoted into Operator Diagnosis");

  return lines;
}

function stableAuditHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function summarizeNativeSessionSourceHealth(
  input: NativeSessionSourceHealthInput,
): NativeSessionSourceHealthSummary {
  const confidenceMix: Record<string, number> = {};
  const readinessMix: Record<string, number> = {};
  const sourceTypeCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const nativeDiagnosisCandidatesByConfidence: Record<string, number> = {};
  const nativeDiagnosisCandidatesBySeverity: Record<string, number> = {};
  const nativeDiagnosisCandidatesByTopic: Record<string, number> = {};
  const rejectedDebugEvidenceCount = input.rejectedDebugEvidenceCount ?? 0;
  const rejectedImportedEvidenceCount = input.rejectedImportedEvidenceCount ?? 0;
  const nativeDiagnosisCandidates = mapNativeSessionsToDiagnosisFindings(input.sessions);

  input.sessions.forEach((session) => {
    increment(confidenceMix, session.confidence);
    increment(readinessMix, session.diagnosisReadiness);
    session.tags.forEach((tag) => increment(tagCounts, tag));
    session.evidence.forEach((evidence) => increment(sourceTypeCounts, evidence.sourceType));
  });

  nativeDiagnosisCandidates.forEach((candidate) => {
    increment(nativeDiagnosisCandidatesByConfidence, candidate.confidence);
    increment(nativeDiagnosisCandidatesBySeverity, candidate.severity);
    increment(nativeDiagnosisCandidatesByTopic, candidate.topic);
  });

  const limitations = countLimitations(input.sessions);
  const eligibleCandidateSessionIds = new Set(
    nativeDiagnosisCandidates.flatMap((candidate) => candidate.relatedSessionIds),
  );
  const rejectedSessions = input.sessions
    .filter((session) => !eligibleCandidateSessionIds.has(session.id))
    .map((session) => ({
      reasons: explainNativeSessionLimitations(session),
      safeId: `native-session:${stableAuditHash(session.id)}`,
    }))
    .filter((session) => session.reasons.length > 0);
  const blockedReasons = buildBlockedReasons({
    limitations,
    rejectedDebugEvidenceCount,
    rejectedImportedEvidenceCount,
    sessionCount: input.sessions.length,
  });
  const diagnosisGradeCount = input.sessions.filter(canBecomeDiagnosisGradeNativeSession).length;
  const directionalOnlyCount = input.sessions.filter(
    (session) =>
      session.diagnosisReadiness === "directional_only" ||
      session.diagnosisReadiness === "directional_context",
  ).length;
  const unsafeCount = input.sessions.filter(
    (session) =>
      session.diagnosisReadiness === "unsafe_not_enough_evidence" ||
      session.diagnosisReadiness === "insufficient_evidence",
  ).length;

  return {
    blocked: blockedReasons.length > 0,
    blockedReasons,
    confidenceMix,
    diagnosisGradeCount,
    directionalOnlyCount,
    displayLines: buildDisplayLines({
      blockedReasons,
      diagnosisGradeCount,
      sessionCount: input.sessions.length,
    }),
    eligibleForFutureDiagnosis: diagnosisGradeCount > 0,
    limitations,
    nativeDiagnosisCandidateCount: nativeDiagnosisCandidates.length,
    nativeDiagnosisCandidatesByConfidence,
    nativeDiagnosisCandidatesBySeverity,
    nativeDiagnosisCandidatesByTopic,
    primaryDiagnosisFindingCount: 0,
    readinessMix,
    rejectedDebugEvidenceCount,
    rejectedImportedEvidenceCount,
    rejectedSessionCount: rejectedSessions.length,
    rejectedSessions,
    reviewOnlyStatus: "review_only_not_promoted",
    sessionCount: input.sessions.length,
    sourceTypeCounts,
    tagCounts,
    unsafeCount,
  };
}

function directionForSession(session: NativeSessionV1): EvidenceComparisonDirection {
  if (session.netPnlAfterFeesAndFunding === null) {
    return "unknown";
  }

  if (session.netPnlAfterFeesAndFunding > 0) {
    return "positive";
  }

  if (session.netPnlAfterFeesAndFunding < 0) {
    return "negative";
  }

  return "neutral";
}

function strengthForConfidence(
  confidence: DiagnosisEvidenceConfidence,
): NativeEvidenceComparisonSummary["strength"] {
  switch (confidence) {
    case "high":
      return "strong";
    case "medium":
      return "moderate";
    case "low":
      return "weak";
    case "insufficient_evidence":
      return "insufficient";
  }
}

function trustLevelForSession(session: NativeSessionV1): EvidenceTrustLevel {
  if (canBecomeDiagnosisGradeNativeSession(session)) {
    return "diagnosis_grade";
  }

  if (session.confidence === "insufficient_evidence") {
    return "insufficient_evidence";
  }

  return "weak_signal";
}

function nativeEvidenceIds(session: NativeSessionV1) {
  return session.evidence
    .filter((evidence) => isNativeEvidence(evidence) && !isImportedEvidence(evidence) && !isDebugOnlyEvidence(evidence))
    .map((evidence) => evidence.id);
}

function topicCandidatesForSession(session: NativeSessionV1): EvidenceComparisonTopic[] {
  const topics: EvidenceComparisonTopic[] = [];
  const assetCount = Object.keys(session.assetMix).length;
  const directionCounts = Object.values(session.directionMix).reduce(
    (total, item) => total + item.tradeCount,
    0,
  );
  const largestDirectionShare = directionCounts > 0
    ? Math.max(...Object.values(session.directionMix).map((item) => item.tradeCount / directionCounts))
    : 0;

  if (session.tags.includes("overnight")) topics.push("overnight_performance");
  if (session.tags.includes("weekend")) topics.push("weekend_performance");
  if (session.tags.includes("high_density")) topics.push("high_density_sessions");
  if (session.tags.includes("post_loss")) topics.push("post_loss_behavior");
  if (assetCount >= 2) topics.push("multi_asset_behavior");
  if (largestDirectionShare >= 0.7 && directionCounts >= 2) topics.push("long_short_bias");
  if (
    session.fees !== null &&
    Math.abs(session.fees) > 0 &&
    session.netPnlAfterFeesAndFunding !== null &&
    Math.abs(session.fees) >= Math.max(Math.abs(session.netPnlAfterFeesAndFunding) * 0.1, 1)
  ) {
    topics.push("fee_heavy_sessions");
  }

  return unique(topics);
}

function summaryForSession(session: NativeSessionV1, topic: EvidenceComparisonTopic) {
  const pnl = session.netPnlAfterFeesAndFunding;
  const pnlLabel = pnl === null ? "without native net PnL" : `with native net PnL ${pnl.toFixed(2)}`;

  return `Native session engine has Portal-native ${topic.replaceAll("_", " ")} context ${pnlLabel}. Not yet promoted into Operator Diagnosis.`;
}

export function mapNativeSessionsToEvidenceComparisonSummaries(
  sessions: NativeSessionV1[],
): NativeEvidenceComparisonSummary[] {
  return sessions.flatMap((session) => {
    const relatedEvidenceIds = nativeEvidenceIds(session);

    if (relatedEvidenceIds.length === 0) {
      return [];
    }

    return topicCandidatesForSession(session).map((topic) => ({
      confidence: session.confidence,
      direction: directionForSession(session),
      id: `native-session-engine:${session.id}:${topic}`,
      label: "Native session engine",
      relatedEvidenceIds,
      sourceWarnings: [],
      strength: strengthForConfidence(session.confidence),
      summary: summaryForSession(session, topic),
      topic,
      trustLevel: trustLevelForSession(session),
    }));
  });
}
