import type { HyperliquidEnvironment } from "@/lib/hyperliquid/types";
import type {
  BaselineDataQualityWarning,
  DiagnosisReadiness,
  ReconstructedSession,
  SessionConfidence,
} from "@/features/baseline-import";

export type EvidenceTrustLevel =
  | "diagnosis_grade"
  | "directional_context"
  | "weak_signal"
  | "debug_only"
  | "insufficient_evidence";

export type EvidenceSourceType =
  | "native_journal"
  | "native_execution"
  | "native_discipline"
  | "native_ai_warning"
  | "imported_historical_baseline"
  | "external_directional_context"
  | "debug_only";

export type EvidenceOrigin = "portal_native" | "historical_import" | "external" | "debug";

export type DiagnosisEvidenceConfidence = "high" | "medium" | "low" | "insufficient_evidence";

export type DiagnosisEvidenceAllowedUse =
  | "operator_diagnosis_primary"
  | "operator_diagnosis_supporting"
  | "ai_coach_context"
  | "investigation_prompt"
  | "debug_audit";

export type DiagnosisEvidenceProhibitedUse =
  | "native_journal_claim"
  | "discipline_enforcement"
  | "automatic_trade_blocking"
  | "high_confidence_diagnosis"
  | "hard_behavior_claim";

export type DiagnosisEvidenceSourceWarning = {
  code: string;
  detail: string;
  severity: "warning" | "info";
};

export type DiagnosisEvidence = {
  accountAddress: string | null;
  allowedUses: DiagnosisEvidenceAllowedUse[];
  confidence: DiagnosisEvidenceConfidence;
  confidenceReasons: string[];
  environment: HyperliquidEnvironment | null;
  id: string;
  label: string;
  origin: EvidenceOrigin;
  prohibitedUses: DiagnosisEvidenceProhibitedUse[];
  relatedSessionIds: string[];
  relatedTradeIds: string[];
  sourceType: EvidenceSourceType;
  sourceWarnings: DiagnosisEvidenceSourceWarning[];
  timeRange: {
    endTime: number;
    startTime: number;
  } | null;
  timezone: string | null;
  trustLevel: EvidenceTrustLevel;
  userFacingLabel: string;
};

type EvidenceInput = {
  accountAddress?: string | null;
  allowedUses?: DiagnosisEvidenceAllowedUse[];
  confidence?: DiagnosisEvidenceConfidence;
  confidenceReasons?: string[];
  environment?: HyperliquidEnvironment | null;
  id: string;
  label?: string;
  origin?: EvidenceOrigin;
  prohibitedUses?: DiagnosisEvidenceProhibitedUse[];
  relatedSessionIds?: string[];
  relatedTradeIds?: string[];
  sourceWarnings?: DiagnosisEvidenceSourceWarning[];
  timeRange?: DiagnosisEvidence["timeRange"];
  timezone?: string | null;
  trustLevel?: EvidenceTrustLevel;
  userFacingLabel?: string;
};

type ImportedEvidenceInput = EvidenceInput & {
  sampleSize?: number;
};

const IMPORTED_PROHIBITED_USES = [
  "native_journal_claim",
  "discipline_enforcement",
  "automatic_trade_blocking",
  "high_confidence_diagnosis",
  "hard_behavior_claim",
] satisfies DiagnosisEvidenceProhibitedUse[];

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizeWarnings(
  warnings: Array<BaselineDataQualityWarning | DiagnosisEvidenceSourceWarning> | undefined,
) {
  return (warnings ?? []).map((warning) => ({
    code: warning.code,
    detail: warning.detail,
    severity: warning.severity,
  }));
}

function assertDiagnosisGradeHasEvidenceConfidence(input: {
  confidence: DiagnosisEvidenceConfidence;
  trustLevel: EvidenceTrustLevel;
}) {
  if (input.trustLevel === "diagnosis_grade" && input.confidence === "insufficient_evidence") {
    throw new Error("diagnosis_grade evidence cannot use insufficient_evidence confidence.");
  }
}

function createEvidence(input: EvidenceInput & {
  defaultAllowedUses: DiagnosisEvidenceAllowedUse[];
  defaultConfidence: DiagnosisEvidenceConfidence;
  defaultLabel: string;
  defaultOrigin: EvidenceOrigin;
  defaultProhibitedUses?: DiagnosisEvidenceProhibitedUse[];
  defaultTrustLevel: EvidenceTrustLevel;
  sourceType: EvidenceSourceType;
  userFacingLabel: string;
}): DiagnosisEvidence {
  const confidence = input.confidence ?? input.defaultConfidence;
  const trustLevel = input.trustLevel ?? input.defaultTrustLevel;

  assertDiagnosisGradeHasEvidenceConfidence({ confidence, trustLevel });

  return {
    accountAddress: input.accountAddress ?? null,
    allowedUses: unique(input.allowedUses ?? input.defaultAllowedUses),
    confidence,
    confidenceReasons: input.confidenceReasons ?? [],
    environment: input.environment ?? null,
    id: input.id,
    label: input.label ?? input.defaultLabel,
    origin: input.origin ?? input.defaultOrigin,
    prohibitedUses: unique(input.prohibitedUses ?? input.defaultProhibitedUses ?? []),
    relatedSessionIds: input.relatedSessionIds ?? [],
    relatedTradeIds: input.relatedTradeIds ?? [],
    sourceType: input.sourceType,
    sourceWarnings: normalizeWarnings(input.sourceWarnings),
    timeRange: input.timeRange ?? null,
    timezone: input.timezone ?? null,
    trustLevel,
    userFacingLabel: input.userFacingLabel ?? input.userFacingLabel,
  };
}

function normalizeImportedTrustLevel(trustLevel: EvidenceTrustLevel | undefined, confidence: DiagnosisEvidenceConfidence) {
  if (trustLevel === "debug_only" || trustLevel === "insufficient_evidence") {
    return trustLevel;
  }

  if (trustLevel === "weak_signal" || confidence === "low") {
    return "weak_signal" satisfies EvidenceTrustLevel;
  }

  return "directional_context" satisfies EvidenceTrustLevel;
}

function createImportedEvidence(input: ImportedEvidenceInput & {
  defaultLabel: string;
  sourceType: "imported_historical_baseline" | "external_directional_context";
}) {
  const confidence = input.confidence ?? "medium";
  const trustLevel = normalizeImportedTrustLevel(input.trustLevel, confidence);
  const origin =
    input.origin === "external" || input.origin === "historical_import"
      ? input.origin
      : "historical_import";
  const allowedUses: DiagnosisEvidenceAllowedUse[] = unique(
    input.allowedUses ?? ["ai_coach_context", "investigation_prompt", "operator_diagnosis_supporting"],
  ).filter((use): use is DiagnosisEvidenceAllowedUse => use !== "operator_diagnosis_primary");

  return createEvidence({
    ...input,
    allowedUses,
    confidence,
    defaultAllowedUses: allowedUses,
    defaultConfidence: confidence,
    defaultLabel: input.defaultLabel,
    defaultOrigin: origin,
    defaultProhibitedUses: IMPORTED_PROHIBITED_USES,
    defaultTrustLevel: trustLevel,
    origin,
    prohibitedUses: unique([...(input.prohibitedUses ?? []), ...IMPORTED_PROHIBITED_USES]),
    sourceType: input.sourceType,
    trustLevel,
    userFacingLabel:
      input.userFacingLabel ?? "Imported Historical Baseline / Directional context / Not diagnosis-grade yet",
  });
}

export function createNativeJournalEvidence(input: EvidenceInput): DiagnosisEvidence {
  return createEvidence({
    ...input,
    defaultAllowedUses: ["operator_diagnosis_primary", "operator_diagnosis_supporting", "ai_coach_context"],
    defaultConfidence: "medium",
    defaultLabel: "Native Journal evidence",
    defaultOrigin: "portal_native",
    defaultTrustLevel: "diagnosis_grade",
    sourceType: "native_journal",
    userFacingLabel: input.userFacingLabel ?? "Native Journal evidence",
  });
}

export function createNativeExecutionEvidence(input: EvidenceInput): DiagnosisEvidence {
  return createEvidence({
    ...input,
    defaultAllowedUses: ["operator_diagnosis_primary", "operator_diagnosis_supporting", "ai_coach_context"],
    defaultConfidence: "medium",
    defaultLabel: "Native execution evidence",
    defaultOrigin: "portal_native",
    defaultTrustLevel: "diagnosis_grade",
    sourceType: "native_execution",
    userFacingLabel: input.userFacingLabel ?? "Native execution evidence",
  });
}

export function createNativeDisciplineEvidence(input: EvidenceInput): DiagnosisEvidence {
  return createEvidence({
    ...input,
    defaultAllowedUses: ["operator_diagnosis_primary", "operator_diagnosis_supporting", "ai_coach_context"],
    defaultConfidence: "medium",
    defaultLabel: "Native Discipline evidence",
    defaultOrigin: "portal_native",
    defaultTrustLevel: "diagnosis_grade",
    sourceType: "native_discipline",
    userFacingLabel: input.userFacingLabel ?? "Native Discipline evidence",
  });
}

export function createNativeAiWarningEvidence(input: EvidenceInput): DiagnosisEvidence {
  return createEvidence({
    ...input,
    defaultAllowedUses: ["operator_diagnosis_supporting", "ai_coach_context"],
    defaultConfidence: "medium",
    defaultLabel: "Native AI warning evidence",
    defaultOrigin: "portal_native",
    defaultTrustLevel: "diagnosis_grade",
    sourceType: "native_ai_warning",
    userFacingLabel: input.userFacingLabel ?? "Native AI warning evidence",
  });
}

export function createImportedBaselineEvidence(input: ImportedEvidenceInput): DiagnosisEvidence {
  return createImportedEvidence({
    ...input,
    defaultLabel: "Imported Historical Baseline",
    sourceType: "imported_historical_baseline",
  });
}

export function createImportedSessionEvidence(input: ImportedEvidenceInput): DiagnosisEvidence {
  return createImportedEvidence({
    ...input,
    defaultLabel: "Imported session intelligence",
    sourceType: "imported_historical_baseline",
  });
}

export function createDebugOnlyEvidence(input: EvidenceInput): DiagnosisEvidence {
  const allowedUses: DiagnosisEvidenceAllowedUse[] = unique(input.allowedUses ?? ["debug_audit"]).filter(
    (use): use is DiagnosisEvidenceAllowedUse =>
      use !== "operator_diagnosis_primary" && use !== "operator_diagnosis_supporting",
  );

  return createEvidence({
    ...input,
    allowedUses,
    defaultAllowedUses: allowedUses,
    defaultConfidence: input.confidence ?? "low",
    defaultLabel: "Debug-only evidence",
    defaultOrigin: "debug",
    defaultTrustLevel: "debug_only",
    sourceType: "debug_only",
    trustLevel: input.trustLevel ?? "debug_only",
    userFacingLabel: input.userFacingLabel ?? "Debug-only evidence",
  });
}

export function isNativeEvidence(evidence: DiagnosisEvidence) {
  return evidence.origin === "portal_native" && evidence.sourceType.startsWith("native_");
}

export function isImportedEvidence(evidence: DiagnosisEvidence) {
  return (
    evidence.origin === "historical_import" ||
    evidence.origin === "external" ||
    evidence.sourceType === "imported_historical_baseline" ||
    evidence.sourceType === "external_directional_context"
  );
}

export function isDebugOnlyEvidence(evidence: DiagnosisEvidence) {
  return evidence.origin === "debug" || evidence.sourceType === "debug_only" || evidence.trustLevel === "debug_only";
}

export function canUseAsPrimaryDiagnosisEvidence(evidence: DiagnosisEvidence) {
  return (
    isNativeEvidence(evidence) &&
    evidence.trustLevel === "diagnosis_grade" &&
    evidence.confidence !== "insufficient_evidence" &&
    evidence.allowedUses.includes("operator_diagnosis_primary")
  );
}

export function canUseAsSupportingDiagnosisEvidence(evidence: DiagnosisEvidence) {
  return (
    !isDebugOnlyEvidence(evidence) &&
    evidence.trustLevel !== "insufficient_evidence" &&
    evidence.confidence !== "insufficient_evidence" &&
    evidence.allowedUses.includes("operator_diagnosis_supporting")
  );
}

export function canUseForDisciplineEnforcement(evidence: DiagnosisEvidence) {
  return (
    canUseAsPrimaryDiagnosisEvidence(evidence) &&
    !evidence.prohibitedUses.includes("discipline_enforcement")
  );
}

export function assertNoImportedPrimaryDiagnosis(evidenceList: DiagnosisEvidence[]) {
  const invalidEvidence = evidenceList.find(
    (evidence) => isImportedEvidence(evidence) && evidence.allowedUses.includes("operator_diagnosis_primary"),
  );

  if (invalidEvidence) {
    throw new Error(`Imported evidence cannot be primary diagnosis evidence: ${invalidEvidence.id}`);
  }
}

export function assertNoDebugUserFacingDiagnosis(evidenceList: DiagnosisEvidence[]) {
  const invalidEvidence = evidenceList.find(
    (evidence) =>
      isDebugOnlyEvidence(evidence) &&
      (evidence.allowedUses.includes("operator_diagnosis_primary") ||
        evidence.allowedUses.includes("operator_diagnosis_supporting")),
  );

  if (invalidEvidence) {
    throw new Error(`Debug-only evidence cannot be user-facing diagnosis evidence: ${invalidEvidence.id}`);
  }
}

export function getEvidenceUserFacingLabel(evidence: DiagnosisEvidence) {
  if (isImportedEvidence(evidence)) {
    return evidence.userFacingLabel || "Imported Historical Baseline / Directional context / Not diagnosis-grade yet";
  }

  return evidence.userFacingLabel || evidence.label;
}

function trustLevelForImportedSession(input: {
  confidence: SessionConfidence;
  diagnosisReadiness: DiagnosisReadiness;
}) {
  if (input.confidence === "insufficient_evidence" || input.diagnosisReadiness === "unsafe_not_enough_evidence") {
    return "insufficient_evidence" satisfies EvidenceTrustLevel;
  }

  if (input.confidence === "low") {
    return "weak_signal" satisfies EvidenceTrustLevel;
  }

  return "directional_context" satisfies EvidenceTrustLevel;
}

function confidenceForSession(confidence: SessionConfidence): DiagnosisEvidenceConfidence {
  return confidence;
}

export function mapImportedSessionToDiagnosisEvidence(
  session: ReconstructedSession,
  options: {
    sourceWarnings?: BaselineDataQualityWarning[];
  } = {},
) {
  const trustLevel = trustLevelForImportedSession({
    confidence: session.confidence,
    diagnosisReadiness: session.diagnosisReadiness,
  });
  const allowedUses: DiagnosisEvidenceAllowedUse[] = ["ai_coach_context", "investigation_prompt"];

  if (trustLevel !== "insufficient_evidence") {
    allowedUses.push("operator_diagnosis_supporting");
  }

  return createImportedSessionEvidence({
    accountAddress: session.accountAddress,
    allowedUses,
    confidence: confidenceForSession(session.confidence),
    confidenceReasons: session.confidenceReasons,
    environment: session.environment,
    id: `imported-session:${session.id}`,
    relatedSessionIds: [session.id],
    relatedTradeIds: session.tradeIds,
    sourceWarnings: normalizeWarnings(options.sourceWarnings),
    timeRange: {
      endTime: session.endedAt,
      startTime: session.startedAt,
    },
    timezone: session.timezone,
    trustLevel,
    userFacingLabel: "Imported Historical Baseline / Directional context / Not diagnosis-grade yet",
  });
}
