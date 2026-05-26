import type {
  DiagnosisEvidence,
  DiagnosisEvidenceConfidence,
  DiagnosisEvidenceSourceWarning,
} from "./diagnosis-evidence";
import type { EvidenceComparisonResult } from "./evidence-comparison";
import type { ImportedSessionSupportingContext } from "./imported-session-supporting-context";
import type { NativeSessionDiagnosisFinding } from "./native-session-diagnosis";
import type { DiagnosisFinding, OperatorDiagnosis } from "./operator-diagnosis";

export type EvidenceDrawerStatus =
  | "native_diagnosis"
  | "native_review_candidate"
  | "supporting_context"
  | "comparison";

export type EvidenceDrawerSectionTitle =
  | "Evidence Summary"
  | "Sessions"
  | "Trades"
  | "Source Quality"
  | "Confidence Reasons"
  | "Native vs Imported"
  | "Comparison Notes"
  | "Prohibited Actions"
  | "What this can be used for"
  | "What this cannot be used for"
  | "Next Review Step";

export type EvidenceDrawerSection = {
  items: string[];
  title: EvidenceDrawerSectionTitle;
};

export type EvidenceDrawerModel = {
  confidence: DiagnosisEvidenceConfidence | "low" | "medium" | "high";
  id: string;
  readiness: string;
  reviewOnly: boolean;
  sections: EvidenceDrawerSection[];
  sourceBadges: string[];
  status: EvidenceDrawerStatus;
  summary: string;
  title: string;
};

export type EvidenceDrawerDebugOutput = {
  drawerModelCount: number;
  modelsBySourceType: Record<string, number>;
  modelsWithWarningsCount: number;
  reviewOnlyCount: number;
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function nonEmpty(items: Array<string | null | undefined>, fallback: string) {
  const compact = items.filter((item): item is string => Boolean(item && item.trim()));

  return compact.length > 0 ? compact : [fallback];
}

function formatList(prefix: string, values: string[]) {
  return values.length > 0 ? `${prefix}: ${values.join(", ")}` : `${prefix}: none listed.`;
}

function warningText(warnings: DiagnosisEvidenceSourceWarning[]) {
  return nonEmpty(
    warnings.map((warning) => `${warning.severity}: ${warning.code}: ${warning.detail}`),
    "No source-quality warnings were attached to this drawer.",
  );
}

function evidenceLabels(evidence: DiagnosisEvidence[]) {
  return unique(evidence.map((item) => item.userFacingLabel || item.label));
}

function evidenceConfidenceReasons(evidence: DiagnosisEvidence[]) {
  return unique(evidence.flatMap((item) => item.confidenceReasons));
}

function evidenceWarnings(evidence: DiagnosisEvidence[]) {
  return evidence.flatMap((item) => item.sourceWarnings);
}

function evidenceAllowedUses(evidence: DiagnosisEvidence[]) {
  return unique(evidence.flatMap((item) => item.allowedUses));
}

function evidenceProhibitedUses(evidence: DiagnosisEvidence[]) {
  return unique(evidence.flatMap((item) => item.prohibitedUses));
}

function sourceTypeForModel(model: EvidenceDrawerModel) {
  if (model.sourceBadges.some((badge) => /Imported Historical Baseline|Directional context/i.test(badge))) {
    return "imported";
  }

  if (model.status === "comparison") {
    return "comparison";
  }

  return "native";
}

function hasWarnings(model: EvidenceDrawerModel) {
  return model.sections.some(
    (section) =>
      section.title === "Source Quality" &&
      section.items.some((item) => /^warning:/i.test(item)),
  );
}

export function buildEvidenceDrawerForOperatorFinding(input: {
  diagnosis: OperatorDiagnosis;
  finding: DiagnosisFinding;
}): EvidenceDrawerModel {
  const signalCount = input.finding.evidenceEventIds.length + input.finding.journalEntryIds.length;

  return {
    confidence: input.diagnosis.confidence,
    id: `evidence-drawer:operator-finding:${input.finding.id}`,
    readiness: "diagnosis_grade_native_sample",
    reviewOnly: false,
    sections: [
      {
        title: "Evidence Summary",
        items: [
          "This finding is based on native Portal evidence.",
          input.finding.summary,
          `${signalCount} native signal${signalCount === 1 ? "" : "s"} are linked to this finding.`,
        ],
      },
      {
        title: "Sessions",
        items: ["No native session ID is attached to this legacy Operator Diagnosis finding yet."],
      },
      {
        title: "Trades",
        items: nonEmpty(
          input.finding.journalEntryIds.map((id) => `Native Journal trade: ${id}`),
          "No related native Journal trade IDs were attached.",
        ),
      },
      {
        title: "Source Quality",
        items: ["Native Journal evidence is the primary source. Imported Historical Baseline is not primary evidence here."],
      },
      {
        title: "Confidence Reasons",
        items: [
          `Operator Diagnosis confidence: ${input.diagnosis.confidence}.`,
          `Sample size: ${input.diagnosis.sampleSize} closed native trade${input.diagnosis.sampleSize === 1 ? "" : "s"}.`,
        ],
      },
      {
        title: "Native vs Imported",
        items: [
          "This finding is based on native Portal evidence.",
          "Imported Historical Baseline may appear nearby only as supporting context.",
        ],
      },
      {
        title: "Comparison Notes",
        items: ["No imported comparison is attached to this drawer."],
      },
      {
        title: "Prohibited Actions",
        items: [
          "This drawer does not activate Discipline rules.",
          "This drawer does not create realtime blocking warnings.",
        ],
      },
      {
        title: "What this can be used for",
        items: ["Operator Diagnosis review.", "Manual review of a recommended plan before any rule change."],
      },
      {
        title: "What this cannot be used for",
        items: ["Automatic Discipline activation.", "Realtime trade blocking.", "Imported-only enforcement."],
      },
      {
        title: "Next Review Step",
        items: [input.finding.recommendation],
      },
    ],
    sourceBadges: ["Native Portal evidence", "Operator Diagnosis", "Review required"],
    status: "native_diagnosis",
    summary: input.finding.summary,
    title: input.finding.title,
  };
}

export function buildEvidenceDrawerForNativeSessionReviewCandidate(
  candidate: NativeSessionDiagnosisFinding,
): EvidenceDrawerModel {
  const confidenceReasons = unique([
    ...candidate.evidence.flatMap((item) => item.confidenceReasons),
    `${candidate.diagnosisReadiness} readiness from native session gates.`,
  ]);

  return {
    confidence: candidate.confidence,
    id: `evidence-drawer:native-session-candidate:${candidate.id}`,
    readiness: candidate.diagnosisReadiness,
    reviewOnly: true,
    sections: [
      {
        title: "Evidence Summary",
        items: [
          "This is a review-only native session candidate.",
          candidate.summary,
          "This is review-only. No rule has been activated.",
        ],
      },
      {
        title: "Sessions",
        items: nonEmpty(
          candidate.relatedSessionIds.map((id) => `Native session: ${id}`),
          "No related native session IDs were attached.",
        ),
      },
      {
        title: "Trades",
        items: nonEmpty(
          candidate.relatedTradeIds.map((id) => `Native trade: ${id}`),
          "No related native trade IDs were attached.",
        ),
      },
      {
        title: "Source Quality",
        items: warningText(evidenceWarnings(candidate.evidence)),
      },
      {
        title: "Confidence Reasons",
        items: nonEmpty(confidenceReasons, "Native session gates passed with medium/high confidence."),
      },
      {
        title: "Native vs Imported",
        items: [
          "Primary evidence is native Portal evidence.",
          "Imported Historical Baseline is not primary evidence for this candidate.",
        ],
      },
      {
        title: "Comparison Notes",
        items: ["Imported context can be compared later, but it is not merged into this native candidate."],
      },
      {
        title: "Prohibited Actions",
        items: [
          ...candidate.prohibitedActions,
          ...evidenceProhibitedUses(candidate.evidence),
          "No automatic enforcement.",
        ],
      },
      {
        title: "What this can be used for",
        items: unique([
          "Review-only Operator Diagnosis context.",
          ...evidenceAllowedUses(candidate.evidence),
        ]),
      },
      {
        title: "What this cannot be used for",
        items: [
          "Automatic Discipline activation.",
          "Realtime trade blocking.",
          "Imported-only enforcement.",
        ],
      },
      {
        title: "Next Review Step",
        items: ["Review the linked native sessions and trades before deciding whether any future rule proposal is warranted."],
      },
    ],
    sourceBadges: unique([
      "Native Portal evidence",
      "Native Session Review Candidate",
      "Review-only",
      ...candidate.labels,
      ...evidenceLabels(candidate.evidence),
    ]),
    status: "native_review_candidate",
    summary: candidate.summary,
    title: candidate.title,
  };
}

export function buildEvidenceDrawerForImportedSupportingContext(
  context: ImportedSessionSupportingContext,
): EvidenceDrawerModel {
  return {
    confidence: context.confidence,
    id: `evidence-drawer:imported-context:${context.id}`,
    readiness: context.trustLevel === "weak_signal" ? "weak_signal" : "directional_context",
    reviewOnly: true,
    sections: [
      {
        title: "Evidence Summary",
        items: [
          context.summary,
          "Imported Historical Baseline appears only as supporting context.",
        ],
      },
      {
        title: "Sessions",
        items: nonEmpty(
          context.relatedSessionIds.map((id) => `Imported baseline session: ${id}`),
          "No imported session IDs were attached.",
        ),
      },
      {
        title: "Trades",
        items: nonEmpty(
          context.relatedTradeIds.map((id) => `Imported baseline trade: ${id}`),
          "No imported trade IDs were attached.",
        ),
      },
      {
        title: "Source Quality",
        items: warningText(context.sourceWarnings),
      },
      {
        title: "Confidence Reasons",
        items: nonEmpty(context.confidenceReasons, "Imported context needs native confirmation."),
      },
      {
        title: "Native vs Imported",
        items: [
          "Imported Historical Baseline.",
          "Directional context.",
          "Not native Journal evidence.",
          "Not diagnosis-grade yet.",
        ],
      },
      {
        title: "Comparison Notes",
        items: ["Portal can show this near native evidence as a comparison, not a diagnosis."],
      },
      {
        title: "Prohibited Actions",
        items: unique([...context.prohibitedUses, "No automatic enforcement."]),
      },
      {
        title: "What this can be used for",
        items: context.allowedUses.filter((use) => use !== "operator_diagnosis_primary"),
      },
      {
        title: "What this cannot be used for",
        items: [
          "Primary Operator Diagnosis evidence.",
          "Native Journal claims.",
          "Discipline enforcement.",
          "Realtime trade blocking.",
        ],
      },
      {
        title: "Next Review Step",
        items: ["Look for native Portal confirmation before making this a stronger diagnosis claim."],
      },
    ],
    sourceBadges: unique([
      "Imported Historical Baseline",
      "Directional context",
      "Not native Journal evidence",
      "Not diagnosis-grade yet",
      context.evidenceLabel,
    ]),
    status: "supporting_context",
    summary: context.summary,
    title: context.title,
  };
}

export function buildEvidenceDrawerForComparison(
  comparison: EvidenceComparisonResult,
): EvidenceDrawerModel {
  return {
    confidence: comparison.confidence,
    id: `evidence-drawer:comparison:${comparison.id}`,
    readiness: comparison.status,
    reviewOnly: true,
    sections: [
      {
        title: "Evidence Summary",
        items: [
          comparison.conclusion,
          "Portal is showing this as a comparison, not a diagnosis.",
        ],
      },
      {
        title: "Sessions",
        items: ["Comparison records reference evidence IDs rather than session membership in V1."],
      },
      {
        title: "Trades",
        items: [
          formatList("Native evidence IDs", comparison.relatedNativeEvidenceIds),
          formatList("Imported evidence IDs", comparison.relatedImportedEvidenceIds),
        ],
      },
      {
        title: "Source Quality",
        items: warningText(comparison.sourceWarnings),
      },
      {
        title: "Confidence Reasons",
        items: [`Comparison confidence: ${comparison.confidence}.`, `Recommended use: ${comparison.recommendedUse}.`],
      },
      {
        title: "Native vs Imported",
        items: unique([
          ...comparison.labels,
          "Native evidence and imported context are not merged.",
        ]),
      },
      {
        title: "Comparison Notes",
        items: nonEmpty(
          [comparison.nativeSummary ? `Native: ${comparison.nativeSummary}` : null,
            comparison.importedSummary ? `Imported: ${comparison.importedSummary}` : null,
            comparison.conclusion],
          "No comparison notes were attached.",
        ),
      },
      {
        title: "Prohibited Actions",
        items: [
          "No automatic Discipline activation.",
          "No realtime trade blocking.",
          "Imported context cannot become primary evidence from this comparison.",
        ],
      },
      {
        title: "What this can be used for",
        items: ["Context review.", "Source comparison.", "Investigation prompt when recommended by the comparison model."],
      },
      {
        title: "What this cannot be used for",
        items: ["Discipline enforcement.", "Realtime trade blocking.", "Silent merging of native and imported samples."],
      },
      {
        title: "Next Review Step",
        items: ["Review source ranges, confidence, and whether native evidence confirms imported context."],
      },
    ],
    sourceBadges: unique(["Comparison only", ...comparison.labels]),
    status: "comparison",
    summary: comparison.conclusion,
    title: `Evidence comparison: ${comparison.topic.replaceAll("_", " ")}`,
  };
}

export function summarizeEvidenceDrawerDebugOutput(
  models: EvidenceDrawerModel[],
): EvidenceDrawerDebugOutput {
  const modelsBySourceType: Record<string, number> = {};

  models.forEach((model) => {
    const sourceType = sourceTypeForModel(model);
    modelsBySourceType[sourceType] = (modelsBySourceType[sourceType] ?? 0) + 1;
  });

  return {
    drawerModelCount: models.length,
    modelsBySourceType,
    modelsWithWarningsCount: models.filter(hasWarnings).length,
    reviewOnlyCount: models.filter((model) => model.reviewOnly).length,
  };
}
