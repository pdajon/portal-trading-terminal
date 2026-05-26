import type {
  BaselineDataQualityWarning,
  DiagnosisReadiness,
  SessionConfidence,
  SessionIntelligenceResult,
} from "@/features/baseline-import/types";

export type BaselineSessionInsightConsumptionSummary = {
  bestSessionNetPnl: number | null;
  confidenceDistribution: Record<SessionConfidence, number>;
  confidenceMixLabel: string;
  diagnosisReadinessDistribution: Record<DiagnosisReadiness, number>;
  diagnosisReadinessLabel: string;
  directionalOnlySessionCount: number;
  hasInsufficientEvidence: boolean;
  hasLowConfidence: boolean;
  hasReadyForDiagnosisSession: boolean;
  hasSourceQualityWarnings: boolean;
  highDensitySessionCount: number;
  importedContextLabel: "Imported context only";
  notNativeEvidenceLabel: "Not native Journal evidence";
  overnightSessionCount: number;
  postLossClusterCount: number;
  revengeRiskCount: number;
  sessionCount: number;
  sourceQualityWarningCodes: string[];
  unsafeNotEnoughEvidenceSessionCount: number;
  warningCopy: string | null;
  weekendSessionCount: number;
  worstSessionNetPnl: number | null;
};

function formatDistribution<T extends string>(distribution: Record<T, number>) {
  return (Object.entries(distribution) as [T, number][])
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key} ${count}`)
    .join(" · ");
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function summarizeBaselineSessionInsightConsumption(input: {
  sessionIntelligence?: SessionIntelligenceResult | null;
  sourceWarnings?: BaselineDataQualityWarning[];
}): BaselineSessionInsightConsumptionSummary | null {
  const sessionIntelligence = input.sessionIntelligence ?? null;

  if (!sessionIntelligence) {
    return null;
  }

  const summary = sessionIntelligence.summary;
  const warningCodes = unique((input.sourceWarnings ?? []).map((warning) => warning.code));
  const directionalOnlySessionCount = summary.diagnosisReadinessDistribution.directional_only ?? 0;
  const unsafeNotEnoughEvidenceSessionCount =
    summary.diagnosisReadinessDistribution.unsafe_not_enough_evidence ?? 0;
  const readyForDiagnosisSessionCount =
    summary.diagnosisReadinessDistribution.ready_for_diagnosis ?? 0;
  const hasLowConfidence = (summary.confidenceDistribution.low ?? 0) > 0;
  const hasInsufficientEvidence =
    (summary.confidenceDistribution.insufficient_evidence ?? 0) > 0 ||
    unsafeNotEnoughEvidenceSessionCount > 0;
  const hasSourceQualityWarnings = warningCodes.length > 0;
  const warningCopy = hasInsufficientEvidence
    ? "Needs more complete history before this becomes a strong session read."
    : hasSourceQualityWarnings
      ? "Order/fill completeness limits this read."
      : hasLowConfidence
        ? "Weak signal; imported source quality limits diagnosis confidence."
        : null;

  return {
    bestSessionNetPnl: summary.topPositiveSession?.netPnlAfterFeesAndFunding ?? null,
    confidenceDistribution: summary.confidenceDistribution,
    confidenceMixLabel: formatDistribution(summary.confidenceDistribution) || "no sessions",
    diagnosisReadinessDistribution: summary.diagnosisReadinessDistribution,
    diagnosisReadinessLabel:
      readyForDiagnosisSessionCount > 0
        ? `${readyForDiagnosisSessionCount} ready_for_diagnosis · ${directionalOnlySessionCount} directional_only`
        : `${directionalOnlySessionCount} directional_only · ${unsafeNotEnoughEvidenceSessionCount} unsafe_not_enough_evidence`,
    directionalOnlySessionCount,
    hasInsufficientEvidence,
    hasLowConfidence,
    hasReadyForDiagnosisSession: readyForDiagnosisSessionCount > 0,
    hasSourceQualityWarnings,
    highDensitySessionCount: summary.highDensitySessionCount,
    importedContextLabel: "Imported context only",
    notNativeEvidenceLabel: "Not native Journal evidence",
    overnightSessionCount: summary.overnightSessionCount,
    postLossClusterCount: summary.postLossClusterCount,
    revengeRiskCount: summary.revengeRiskCount,
    sessionCount: summary.sessionCount,
    sourceQualityWarningCodes: warningCodes,
    unsafeNotEnoughEvidenceSessionCount,
    warningCopy,
    weekendSessionCount: summary.weekendSessionCount,
    worstSessionNetPnl: summary.worstNegativeSession?.netPnlAfterFeesAndFunding ?? null,
  };
}

export function getBaselineSessionInsightSafetyDetails(
  summary: BaselineSessionInsightConsumptionSummary | null,
) {
  if (!summary) {
    return ["Historical Baseline", "Imported context only"];
  }

  const details = [
    "Historical Baseline",
    summary.importedContextLabel,
    "Directional context",
    summary.hasReadyForDiagnosisSession ? "Ready for diagnosis review" : "Not diagnosis-grade yet",
    summary.notNativeEvidenceLabel,
    `Sessions ${summary.sessionCount} · Overnight ${summary.overnightSessionCount} · Weekend ${summary.weekendSessionCount}`,
    `Confidence mix ${summary.confidenceMixLabel}`,
    `Readiness ${summary.diagnosisReadinessLabel}`,
  ];

  if (summary.hasLowConfidence) {
    details.push("Weak signal");
  }

  if (summary.hasInsufficientEvidence) {
    details.push("Unsafe: not enough evidence");
  }

  if (summary.hasSourceQualityWarnings) {
    details.push("Order/fill completeness limits this read");
  }

  return details;
}
