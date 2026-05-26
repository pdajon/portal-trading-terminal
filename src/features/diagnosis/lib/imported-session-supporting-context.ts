import type {
  BaselineDataQualityWarning,
  ReconstructedSession,
  SessionConfidence,
  SessionIntelligenceResult,
} from "@/features/baseline-import";
import {
  canUseAsSupportingDiagnosisEvidence,
  canUseForDisciplineEnforcement,
  getEvidenceUserFacingLabel,
  isDebugOnlyEvidence,
  isImportedEvidence,
  mapImportedSessionToDiagnosisEvidence,
  type DiagnosisEvidence,
  type DiagnosisEvidenceAllowedUse,
  type DiagnosisEvidenceProhibitedUse,
  type DiagnosisEvidenceSourceWarning,
  type EvidenceSourceType,
  type EvidenceTrustLevel,
} from "@/features/diagnosis/lib/diagnosis-evidence";

export type ImportedSessionSupportingSignalType =
  | "overnight_negative"
  | "weekend_underperformance"
  | "high_density_damage"
  | "post_loss_cluster"
  | "revenge_risk_cluster"
  | "multi_asset_weakness"
  | "long_bias_weakness"
  | "short_bias_weakness"
  | "fee_heavy_session";

export type ImportedSessionSupportingContext = {
  allowedUses: DiagnosisEvidenceAllowedUse[];
  confidence: SessionConfidence;
  confidenceReasons: string[];
  evidenceLabel: string;
  id: string;
  prohibitedUses: DiagnosisEvidenceProhibitedUse[];
  relatedSessionIds: string[];
  relatedTradeIds: string[];
  sourceType: EvidenceSourceType;
  sourceWarnings: DiagnosisEvidenceSourceWarning[];
  summary: string;
  title: string;
  trustLevel: EvidenceTrustLevel;
};

export type ImportedNativeConflictCandidate = {
  conflictCandidate: true;
  signalKey: string;
} | null;

const MAX_CONTEXT_RECORDS = 6;
const SIGNAL_PRIORITY: Record<ImportedSessionSupportingSignalType, number> = {
  revenge_risk_cluster: 0,
  post_loss_cluster: 1,
  high_density_damage: 2,
  overnight_negative: 3,
  weekend_underperformance: 4,
  multi_asset_weakness: 5,
  long_bias_weakness: 6,
  short_bias_weakness: 6,
  fee_heavy_session: 7,
};

function isNegativeSession(session: ReconstructedSession) {
  return (session.netPnlAfterFeesAndFunding ?? 0) < 0;
}

function hasRequiredLabels(label: string) {
  return (
    /Imported Historical Baseline/i.test(label) &&
    /Directional context/i.test(label) &&
    /Not diagnosis-grade yet/i.test(label)
  );
}

function confidenceReasonsFor(session: ReconstructedSession, evidence: DiagnosisEvidence) {
  const reasons = [...session.confidenceReasons, ...evidence.confidenceReasons];

  return reasons.length > 0
    ? Array.from(new Set(reasons))
    : ["Imported Historical Baseline context; needs native confirmation."];
}

function signalTitle(signalType: ImportedSessionSupportingSignalType) {
  switch (signalType) {
    case "overnight_negative":
      return "Directional overnight signal";
    case "weekend_underperformance":
      return "Weekend session context";
    case "high_density_damage":
      return "Imported high-density session signal";
    case "post_loss_cluster":
      return "Post-loss cluster candidate";
    case "revenge_risk_cluster":
      return "Revenge-risk cluster candidate";
    case "multi_asset_weakness":
      return "Multi-asset context";
    case "long_bias_weakness":
      return "Long-bias context";
    case "short_bias_weakness":
      return "Short-bias context";
    case "fee_heavy_session":
      return "Fee-heavy imported session context";
  }
}

function signalSummary(signalType: ImportedSessionSupportingSignalType, session: ReconstructedSession) {
  const pnlCopy =
    session.netPnlAfterFeesAndFunding === null
      ? "had incomplete PnL"
      : `was negative at ${formatSignedUsd(session.netPnlAfterFeesAndFunding)}`;

  switch (signalType) {
    case "overnight_negative":
      return `Imported Historical Baseline shows negative overnight sessions in this scan. Source quality limits diagnosis confidence.`;
    case "weekend_underperformance":
      return `Imported Historical Baseline shows weekend session underperformance in this scan. Needs native confirmation.`;
    case "high_density_damage":
      return `Imported Historical Baseline shows a high-density session that ${pnlCopy}. This is supporting context only.`;
    case "post_loss_cluster":
      return `Imported Historical Baseline shows a post-loss cluster candidate in this scan. Needs native confirmation before diagnosis.`;
    case "revenge_risk_cluster":
      return `Imported Historical Baseline shows a revenge-risk cluster candidate. This cannot enforce Discipline without native evidence.`;
    case "multi_asset_weakness":
      return `Imported Historical Baseline shows multi-asset session weakness in this scan. Source quality limits diagnosis confidence.`;
    case "long_bias_weakness":
      return `Imported Historical Baseline shows long-bias session weakness in this scan. Needs native confirmation.`;
    case "short_bias_weakness":
      return `Imported Historical Baseline shows short-bias session weakness in this scan. Needs native confirmation.`;
    case "fee_heavy_session":
      return `Imported Historical Baseline shows fees were large relative to session PnL. Fee semantics are caveated, so this remains directional context.`;
  }
}

function formatSignedUsd(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}

function getSignalTypeFromContext(context: ImportedSessionSupportingContext) {
  return context.id.split(":").at(-1) as ImportedSessionSupportingSignalType;
}

function getSignalTypes(session: ReconstructedSession): ImportedSessionSupportingSignalType[] {
  const signals: ImportedSessionSupportingSignalType[] = [];
  const negative = isNegativeSession(session);
  const fees = Math.abs(session.fees);
  const net = Math.abs(session.netPnlAfterFeesAndFunding ?? 0);

  if (session.isOvernight && negative) signals.push("overnight_negative");
  if (session.isWeekend && negative) signals.push("weekend_underperformance");
  if (session.isHighDensity && negative) signals.push("high_density_damage");
  if (session.isPostLossCluster) signals.push("post_loss_cluster");
  if (session.isRevengeRisk) signals.push("revenge_risk_cluster");
  if (session.tags.includes("multi_asset") && negative) signals.push("multi_asset_weakness");
  if (session.tags.includes("long_bias") && negative) signals.push("long_bias_weakness");
  if (session.tags.includes("short_bias") && negative) signals.push("short_bias_weakness");
  if (fees > 0 && (net === 0 ? fees >= 10 : fees / net >= 0.25)) signals.push("fee_heavy_session");

  return signals;
}

export function buildImportedSessionSupportingContextFromEvidence(input: {
  evidence: DiagnosisEvidence;
  session: ReconstructedSession;
  signalType: ImportedSessionSupportingSignalType;
}): ImportedSessionSupportingContext | null {
  if (
    isDebugOnlyEvidence(input.evidence) ||
    !isImportedEvidence(input.evidence) ||
    !canUseAsSupportingDiagnosisEvidence(input.evidence) ||
    canUseForDisciplineEnforcement(input.evidence)
  ) {
    return null;
  }

  const evidenceLabel = getEvidenceUserFacingLabel(input.evidence);

  if (!hasRequiredLabels(evidenceLabel) || input.evidence.allowedUses.includes("operator_diagnosis_primary")) {
    return null;
  }

  return {
    allowedUses: input.evidence.allowedUses.filter((use) => use !== "operator_diagnosis_primary"),
    confidence: input.session.confidence,
    confidenceReasons: confidenceReasonsFor(input.session, input.evidence),
    evidenceLabel,
    id: `${input.evidence.id}:${input.signalType}`,
    prohibitedUses: input.evidence.prohibitedUses,
    relatedSessionIds: input.evidence.relatedSessionIds,
    relatedTradeIds: input.evidence.relatedTradeIds,
    sourceType: input.evidence.sourceType,
    sourceWarnings: input.evidence.sourceWarnings,
    summary: signalSummary(input.signalType, input.session),
    title: signalTitle(input.signalType),
    trustLevel: input.evidence.trustLevel,
  };
}

export function selectImportedSessionSupportingContext(input: {
  maxRecords?: number;
  sessionIntelligence: SessionIntelligenceResult | null | undefined;
  sourceWarnings?: BaselineDataQualityWarning[];
}): ImportedSessionSupportingContext[] {
  const sessionIntelligence = input.sessionIntelligence ?? null;

  if (!sessionIntelligence) {
    return [];
  }

  return sessionIntelligence.sessions
    .filter((session) => session.diagnosisReadiness !== "unsafe_not_enough_evidence")
    .flatMap((session) => {
      const evidence = mapImportedSessionToDiagnosisEvidence(session, {
        sourceWarnings: input.sourceWarnings,
      });

      return getSignalTypes(session)
        .map((signalType) =>
          buildImportedSessionSupportingContextFromEvidence({
            evidence,
            session,
            signalType,
          }),
        )
        .filter((context): context is ImportedSessionSupportingContext => context !== null);
    })
    .sort((left, right) => {
      const leftPriority = SIGNAL_PRIORITY[getSignalTypeFromContext(left)] ?? 99;
      const rightPriority = SIGNAL_PRIORITY[getSignalTypeFromContext(right)] ?? 99;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftWarnings = left.sourceWarnings.length;
      const rightWarnings = right.sourceWarnings.length;

      if (leftWarnings !== rightWarnings) {
        return rightWarnings - leftWarnings;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, input.maxRecords ?? MAX_CONTEXT_RECORDS);
}

export function detectImportedNativeConflictCandidate(input: {
  importedSignalDirection: "negative" | "positive" | "neutral" | null;
  nativeSignalDirection: "negative" | "positive" | "neutral" | null;
  signalKey: string;
}): ImportedNativeConflictCandidate {
  if (
    (input.importedSignalDirection === "negative" && input.nativeSignalDirection === "positive") ||
    (input.importedSignalDirection === "positive" && input.nativeSignalDirection === "negative")
  ) {
    return {
      conflictCandidate: true,
      signalKey: input.signalKey,
    };
  }

  return null;
}
