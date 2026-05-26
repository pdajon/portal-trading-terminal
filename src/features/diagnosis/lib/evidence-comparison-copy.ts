import type {
  EvidenceComparisonRecommendedUse,
  EvidenceComparisonResult,
  EvidenceComparisonStatus,
  EvidenceComparisonTopic,
} from "./evidence-comparison";

export type EvidenceComparisonDisplayCopy = {
  confidenceLabel: string;
  conclusion: string;
  importedSummary: string | null;
  labels: string[];
  nativeSummary: string | null;
  recommendedUse: EvidenceComparisonRecommendedUse;
  recommendedUseLabel: string;
  shouldDisplay: boolean;
  sourceWarningLabels: string[];
  status: EvidenceComparisonStatus;
  statusLabel: string;
  topic: EvidenceComparisonTopic;
  topicLabel: string;
};

const TOPIC_LABELS: Record<EvidenceComparisonTopic, string> = {
  fee_heavy_sessions: "Fee-heavy sessions",
  high_density_sessions: "High-density sessions",
  long_short_bias: "Long/short bias",
  multi_asset_behavior: "Multi-asset behavior",
  overnight_performance: "Overnight performance",
  post_loss_behavior: "Post-loss behavior",
  revenge_risk_behavior: "Revenge-risk behavior",
  weekend_performance: "Weekend performance",
};

const STATUS_LABELS: Record<EvidenceComparisonStatus, string> = {
  aligned: "Aligned",
  conflict: "Conflict",
  imported_only: "Imported only",
  insufficient_evidence: "Insufficient evidence",
  native_only: "Native only",
  not_comparable: "Not comparable",
};

const RECOMMENDED_USE_LABELS: Record<EvidenceComparisonRecommendedUse, string> = {
  debug_only: "Debug only",
  show_as_confirmation: "Show as confirmation",
  show_as_conflict: "Show as conflict",
  show_as_investigation_prompt: "Show as investigation prompt",
  suppress: "Suppress",
};

const STATUS_CONCLUSIONS: Record<EvidenceComparisonStatus, string> = {
  aligned: "Native and imported evidence point in the same direction.",
  conflict:
    "Native Portal evidence and imported history disagree. Treat this as a comparison, not a diagnosis.",
  imported_only:
    "Imported Historical Baseline suggests this is worth watching. Needs native confirmation.",
  insufficient_evidence:
    "Comparison needs more native or imported evidence before Portal should show a strong read.",
  native_only:
    "Native Portal evidence exists; imported baseline does not confirm or compare this yet.",
  not_comparable:
    "Sources are not comparable because time range, timezone, confidence, or sample differs.",
};

export function getEvidenceComparisonTopicLabel(topic: EvidenceComparisonTopic) {
  return TOPIC_LABELS[topic];
}

function confidenceLabel(confidence: EvidenceComparisonResult["confidence"]) {
  return confidence === "insufficient_evidence"
    ? "Insufficient evidence"
    : `${confidence[0]?.toUpperCase()}${confidence.slice(1)} confidence`;
}

function sourceWarningLabels(comparison: EvidenceComparisonResult) {
  return comparison.sourceWarnings.map((warning) => `${warning.code}: ${warning.detail}`);
}

export function buildEvidenceComparisonDisplayCopy(
  comparison: EvidenceComparisonResult,
): EvidenceComparisonDisplayCopy {
  const shouldDisplay =
    comparison.recommendedUse !== "suppress" &&
    comparison.recommendedUse !== "debug_only" &&
    comparison.status !== "insufficient_evidence" &&
    comparison.status !== "not_comparable";

  return {
    confidenceLabel: confidenceLabel(comparison.confidence),
    conclusion: STATUS_CONCLUSIONS[comparison.status],
    importedSummary: comparison.importedSummary,
    labels: comparison.labels,
    nativeSummary: comparison.nativeSummary,
    recommendedUse: comparison.recommendedUse,
    recommendedUseLabel: RECOMMENDED_USE_LABELS[comparison.recommendedUse],
    shouldDisplay,
    sourceWarningLabels: sourceWarningLabels(comparison),
    status: comparison.status,
    statusLabel: STATUS_LABELS[comparison.status],
    topic: comparison.topic,
    topicLabel: getEvidenceComparisonTopicLabel(comparison.topic),
  };
}

export function buildEvidenceComparisonDisplayCopies(
  comparisons: EvidenceComparisonResult[],
) {
  return comparisons.map(buildEvidenceComparisonDisplayCopy);
}
