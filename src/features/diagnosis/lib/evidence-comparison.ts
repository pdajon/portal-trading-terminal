import type {
  DiagnosisFinding,
  OperatorDiagnosis,
} from "@/features/diagnosis/lib/operator-diagnosis";
import type {
  DiagnosisEvidenceConfidence,
  DiagnosisEvidenceSourceWarning,
  EvidenceTrustLevel,
} from "@/features/diagnosis/lib/diagnosis-evidence";
import type { ImportedSessionSupportingContext } from "./imported-session-supporting-context";

export type EvidenceComparisonTopic =
  | "overnight_performance"
  | "weekend_performance"
  | "high_density_sessions"
  | "post_loss_behavior"
  | "revenge_risk_behavior"
  | "long_short_bias"
  | "multi_asset_behavior"
  | "fee_heavy_sessions";

export type EvidenceComparisonStatus =
  | "aligned"
  | "conflict"
  | "native_only"
  | "imported_only"
  | "not_comparable"
  | "insufficient_evidence";

export type EvidenceComparisonRecommendedUse =
  | "show_as_confirmation"
  | "show_as_conflict"
  | "show_as_investigation_prompt"
  | "suppress"
  | "debug_only";

export type EvidenceComparisonDirection = "positive" | "negative" | "neutral" | "unknown";

export type NativeEvidenceComparisonSummary = {
  confidence: DiagnosisEvidenceConfidence;
  direction: EvidenceComparisonDirection;
  id: string;
  label: string;
  relatedEvidenceIds: string[];
  sourceWarnings: DiagnosisEvidenceSourceWarning[];
  strength: "strong" | "moderate" | "weak" | "insufficient";
  summary: string;
  topic: EvidenceComparisonTopic;
  trustLevel: EvidenceTrustLevel;
};

export type EvidenceComparisonResult = {
  confidence: DiagnosisEvidenceConfidence;
  conclusion: string;
  id: string;
  importedSummary: string | null;
  labels: string[];
  nativeSummary: string | null;
  recommendedUse: EvidenceComparisonRecommendedUse;
  relatedImportedEvidenceIds: string[];
  relatedNativeEvidenceIds: string[];
  sourceWarnings: DiagnosisEvidenceSourceWarning[];
  status: EvidenceComparisonStatus;
  topic: EvidenceComparisonTopic;
};

export type EvidenceComparisonDebugOutput = {
  alignedCount: number;
  comparisonCount: number;
  conflictCount: number;
  importedOnlyCount: number;
  nativeOnlyCount: number;
  notComparableCount: number;
  sourceWarnings: DiagnosisEvidenceSourceWarning[];
  suppressedCount: number;
  topicsCompared: EvidenceComparisonTopic[];
};

const TOPIC_LABELS: Record<EvidenceComparisonTopic, string> = {
  fee_heavy_sessions: "fee-heavy sessions",
  high_density_sessions: "high-density sessions",
  long_short_bias: "long/short bias",
  multi_asset_behavior: "multi-asset behavior",
  overnight_performance: "overnight performance",
  post_loss_behavior: "post-loss behavior",
  revenge_risk_behavior: "revenge-risk behavior",
  weekend_performance: "weekend performance",
};

const CONFIDENCE_RANK: Record<DiagnosisEvidenceConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  insufficient_evidence: 0,
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function getLeastConfident(
  nativeEvidence: NativeEvidenceComparisonSummary | null,
  importedContext: ImportedSessionSupportingContext | null,
): DiagnosisEvidenceConfidence {
  const confidences = [
    nativeEvidence?.confidence,
    importedContext?.confidence,
  ].filter((confidence): confidence is DiagnosisEvidenceConfidence => Boolean(confidence));

  return confidences.sort((left, right) => CONFIDENCE_RANK[left] - CONFIDENCE_RANK[right])[0] ?? "low";
}

function warningKey(warning: DiagnosisEvidenceSourceWarning) {
  return `${warning.code}:${warning.detail}:${warning.severity}`;
}

function mergeWarnings(
  nativeEvidence: NativeEvidenceComparisonSummary | null,
  importedContext: ImportedSessionSupportingContext | null,
  sourceWarnings: DiagnosisEvidenceSourceWarning[],
) {
  const warnings = [
    ...(nativeEvidence?.sourceWarnings ?? []),
    ...(importedContext?.sourceWarnings ?? []),
    ...sourceWarnings,
  ];
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = warningKey(warning);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mapImportedTitleToTopic(title: string, id: string): EvidenceComparisonTopic | null {
  const source = `${title} ${id}`.toLowerCase();

  if (source.includes("overnight")) return "overnight_performance";
  if (source.includes("weekend")) return "weekend_performance";
  if (source.includes("high-density")) return "high_density_sessions";
  if (source.includes("post-loss")) return "post_loss_behavior";
  if (source.includes("revenge")) return "revenge_risk_behavior";
  if (source.includes("long-bias") || source.includes("short-bias")) return "long_short_bias";
  if (source.includes("multi-asset")) return "multi_asset_behavior";
  if (source.includes("fee-heavy") || source.includes("fee_heavy")) return "fee_heavy_sessions";

  return null;
}

function getImportedDirection(context: ImportedSessionSupportingContext): EvidenceComparisonDirection {
  if (
    context.title.toLowerCase().includes("weakness") ||
    context.title.toLowerCase().includes("risk") ||
    context.title.toLowerCase().includes("candidate") ||
    context.summary.toLowerCase().includes("negative") ||
    context.summary.toLowerCase().includes("underperformance")
  ) {
    return "negative";
  }

  return "unknown";
}

function selectBestNativeEvidence(nativeEvidence: NativeEvidenceComparisonSummary[]) {
  return [...nativeEvidence].sort((left, right) => {
    const confidenceDelta = CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence];

    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return strengthRank(right.strength) - strengthRank(left.strength);
  })[0] ?? null;
}

function selectBestImportedContext(importedContexts: ImportedSessionSupportingContext[]) {
  return [...importedContexts].sort(
    (left, right) => CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence],
  )[0] ?? null;
}

function strengthRank(strength: NativeEvidenceComparisonSummary["strength"]) {
  switch (strength) {
    case "strong":
      return 3;
    case "moderate":
      return 2;
    case "weak":
      return 1;
    case "insufficient":
      return 0;
  }
}

function hasInsufficientEvidence(
  nativeEvidence: NativeEvidenceComparisonSummary | null,
  importedContext: ImportedSessionSupportingContext | null,
) {
  return (
    nativeEvidence?.confidence === "insufficient_evidence" ||
    nativeEvidence?.strength === "insufficient" ||
    importedContext?.confidence === "insufficient_evidence" ||
    nativeEvidence?.trustLevel === "insufficient_evidence" ||
    importedContext?.trustLevel === "insufficient_evidence"
  );
}

function getLabels(input: {
  importedContext: ImportedSessionSupportingContext | null;
  nativeEvidence: NativeEvidenceComparisonSummary | null;
}) {
  const labels = ["Comparison only"];

  if (input.nativeEvidence) {
    labels.push(input.nativeEvidence.label || "Native Portal evidence");
  }

  if (input.importedContext) {
    labels.push("Imported Historical Baseline", "Directional context", "Not native Journal evidence", "Not diagnosis-grade yet");
  }

  return unique(labels);
}

function createComparison(input: {
  comparabilityWarning?: string;
  importedContext: ImportedSessionSupportingContext | null;
  nativeEvidence: NativeEvidenceComparisonSummary | null;
  sourceWarnings: DiagnosisEvidenceSourceWarning[];
  topic: EvidenceComparisonTopic;
}): EvidenceComparisonResult {
  const topicLabel = TOPIC_LABELS[input.topic];
  const nativeDirection = input.nativeEvidence?.direction ?? "unknown";
  const importedDirection = input.importedContext ? getImportedDirection(input.importedContext) : "unknown";
  const sourceWarnings = mergeWarnings(input.nativeEvidence, input.importedContext, input.sourceWarnings);
  const relatedNativeEvidenceIds = input.nativeEvidence?.relatedEvidenceIds ?? [];
  const relatedImportedEvidenceIds = input.importedContext ? [input.importedContext.id] : [];
  const base = {
    confidence: getLeastConfident(input.nativeEvidence, input.importedContext),
    id: `evidence-comparison:${input.topic}`,
    importedSummary: input.importedContext?.summary ?? null,
    labels: getLabels(input),
    nativeSummary: input.nativeEvidence?.summary ?? null,
    relatedImportedEvidenceIds,
    relatedNativeEvidenceIds,
    sourceWarnings,
    topic: input.topic,
  };

  if (input.comparabilityWarning) {
    return {
      ...base,
      conclusion: `Native Portal evidence and imported history are not comparable for ${topicLabel}: ${input.comparabilityWarning}`,
      recommendedUse: "suppress",
      status: "not_comparable",
    };
  }

  if (hasInsufficientEvidence(input.nativeEvidence, input.importedContext)) {
    return {
      ...base,
      conclusion: `Portal does not have enough comparable evidence for ${topicLabel}. This comparison is suppressed until source quality is stronger.`,
      recommendedUse: "suppress",
      status: "insufficient_evidence",
    };
  }

  if (input.nativeEvidence && input.importedContext && nativeDirection !== "unknown" && importedDirection !== "unknown") {
    if (nativeDirection !== importedDirection) {
      return {
        ...base,
        conclusion:
          "Native Portal evidence and imported history disagree. Portal is treating this as a comparison, not a diagnosis; native evidence outranks imported context.",
        recommendedUse: "show_as_conflict",
        status: "conflict",
      };
    }

    return {
      ...base,
      conclusion: "Native evidence confirms this pattern; imported history shows a similar directional signal.",
      recommendedUse: "show_as_confirmation",
      status: "aligned",
    };
  }

  if (input.importedContext && !input.nativeEvidence) {
    return {
      ...base,
      conclusion: `Imported baseline suggests ${topicLabel} is worth investigating, but native Portal evidence does not confirm it yet.`,
      recommendedUse: "show_as_investigation_prompt",
      status: "imported_only",
    };
  }

  if (input.nativeEvidence && !input.importedContext) {
    const recommendedUse =
      input.nativeEvidence.strength === "strong" || input.nativeEvidence.strength === "moderate"
        ? "show_as_confirmation"
        : "suppress";

    return {
      ...base,
      conclusion:
        recommendedUse === "show_as_confirmation"
          ? `Native Portal evidence is available for ${topicLabel}; imported history has no comparable signal.`
          : `Native Portal evidence for ${topicLabel} is weak, so Portal is suppressing the comparison.`,
      recommendedUse,
      status: "native_only",
    };
  }

  return {
    ...base,
    conclusion: `No comparable native or imported evidence exists for ${topicLabel}.`,
    recommendedUse: "debug_only",
    status: "not_comparable",
  };
}

export function compareEvidenceSources(input: {
  comparabilityWarnings?: Partial<Record<EvidenceComparisonTopic, string>>;
  importedContexts: ImportedSessionSupportingContext[];
  nativeEvidence: NativeEvidenceComparisonSummary[];
  sourceWarnings?: DiagnosisEvidenceSourceWarning[];
}): EvidenceComparisonResult[] {
  const importedByTopic = new Map<EvidenceComparisonTopic, ImportedSessionSupportingContext[]>();
  const nativeByTopic = new Map<EvidenceComparisonTopic, NativeEvidenceComparisonSummary[]>();

  input.importedContexts.forEach((context) => {
    const topic = mapImportedTitleToTopic(context.title, context.id);

    if (!topic) {
      return;
    }

    importedByTopic.set(topic, [...(importedByTopic.get(topic) ?? []), context]);
  });

  input.nativeEvidence.forEach((summary) => {
    nativeByTopic.set(summary.topic, [...(nativeByTopic.get(summary.topic) ?? []), summary]);
  });

  const topics = unique([
    ...Array.from(importedByTopic.keys()),
    ...Array.from(nativeByTopic.keys()),
    ...(Object.keys(input.comparabilityWarnings ?? {}) as EvidenceComparisonTopic[]),
  ]);

  return topics.map((topic) =>
    createComparison({
      comparabilityWarning: input.comparabilityWarnings?.[topic],
      importedContext: selectBestImportedContext(importedByTopic.get(topic) ?? []),
      nativeEvidence: selectBestNativeEvidence(nativeByTopic.get(topic) ?? []),
      sourceWarnings: input.sourceWarnings ?? [],
      topic,
    }),
  );
}

function mapFindingToTopic(finding: DiagnosisFinding): EvidenceComparisonTopic | null {
  if (finding.category === "post_loss_behavior") return "post_loss_behavior";
  if (finding.id.includes("overtrading") || finding.recommendedRule?.ruleType === "max_trades_per_day") {
    return "high_density_sessions";
  }
  if (finding.category === "time_window" && /overnight/i.test(`${finding.title} ${finding.summary}`)) {
    return "overnight_performance";
  }
  if (finding.category === "asset") return "multi_asset_behavior";

  return null;
}

export function mapOperatorDiagnosisToNativeEvidenceSummaries(
  diagnosis: OperatorDiagnosis | null | undefined,
): NativeEvidenceComparisonSummary[] {
  if (!diagnosis) {
    return [];
  }

  const findings = [...diagnosis.profitLeaks, ...diagnosis.profitableBehaviors];

  return findings.flatMap((finding): NativeEvidenceComparisonSummary[] => {
    const topic = mapFindingToTopic(finding);

    if (!topic) {
      return [];
    }

    return [
      {
        confidence: diagnosis.confidence === "high" ? "high" : diagnosis.confidence === "medium" ? "medium" : "low",
        direction: finding.severity === "positive" ? "positive" : "negative",
        id: finding.id,
        label: "Native Portal evidence",
        relatedEvidenceIds: [...finding.evidenceEventIds, ...finding.journalEntryIds],
        sourceWarnings: [],
        strength: diagnosis.confidence === "high" ? "strong" : diagnosis.confidence === "medium" ? "moderate" : "weak",
        summary: finding.summary,
        topic,
        trustLevel: "diagnosis_grade",
      },
    ];
  });
}

export function summarizeEvidenceComparisonDebugOutput(
  comparisons: EvidenceComparisonResult[],
): EvidenceComparisonDebugOutput {
  return {
    alignedCount: comparisons.filter((comparison) => comparison.status === "aligned").length,
    comparisonCount: comparisons.length,
    conflictCount: comparisons.filter((comparison) => comparison.status === "conflict").length,
    importedOnlyCount: comparisons.filter((comparison) => comparison.status === "imported_only").length,
    nativeOnlyCount: comparisons.filter((comparison) => comparison.status === "native_only").length,
    notComparableCount: comparisons.filter((comparison) => comparison.status === "not_comparable").length,
    sourceWarnings: unique(comparisons.flatMap((comparison) => comparison.sourceWarnings)),
    suppressedCount: comparisons.filter((comparison) =>
      comparison.recommendedUse === "suppress" || comparison.recommendedUse === "debug_only"
    ).length,
    topicsCompared: unique(comparisons.map((comparison) => comparison.topic)),
  };
}
