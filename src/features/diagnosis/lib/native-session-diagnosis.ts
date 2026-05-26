import {
  canBecomeDiagnosisGradeNativeSession,
  type NativeSessionV1,
} from "./native-session-contract";
import {
  canUseAsPrimaryDiagnosisEvidence,
  getEvidenceUserFacingLabel,
  isDebugOnlyEvidence,
  isImportedEvidence,
  isNativeEvidence,
  type DiagnosisEvidence,
  type DiagnosisEvidenceConfidence,
} from "./diagnosis-evidence";

export type NativeSessionDiagnosisTopic =
  | "post_loss_reentry_damage"
  | "high_density_session_damage"
  | "discipline_violation_session"
  | "manual_impulse_session"
  | "unprotected_trade_session"
  | "warning_dismissal_session"
  | "overnight_native_session"
  | "weekend_native_session"
  | "planned_execution_edge";

export type NativeSessionDiagnosisProhibitedAction =
  | "automatic_trade_blocking"
  | "automatic_discipline_activation"
  | "imported_only_enforcement";

export type NativeSessionDiagnosisFinding = {
  confidence: Exclude<DiagnosisEvidenceConfidence, "insufficient_evidence">;
  diagnosisReadiness: "diagnosis_grade" | "ready_for_diagnosis";
  evidence: DiagnosisEvidence[];
  id: string;
  labels: string[];
  prohibitedActions: NativeSessionDiagnosisProhibitedAction[];
  relatedSessionIds: string[];
  relatedTradeIds: string[];
  reviewOnly: true;
  severity: "info" | "warning" | "critical" | "positive";
  sourceType: "native";
  summary: string;
  title: string;
  topic: NativeSessionDiagnosisTopic;
};

type FindingTemplate = {
  isMatch: (session: NativeSessionV1) => boolean;
  severity: (session: NativeSessionV1) => NativeSessionDiagnosisFinding["severity"];
  summary: (session: NativeSessionV1) => string;
  title: string;
  topic: NativeSessionDiagnosisTopic;
};

const PROHIBITED_ACTIONS: NativeSessionDiagnosisProhibitedAction[] = [
  "automatic_trade_blocking",
  "automatic_discipline_activation",
  "imported_only_enforcement",
];

const FINDING_TEMPLATES: FindingTemplate[] = [
  {
    isMatch: (session) => session.postLossReentryCount > 0 || session.tags.includes("post_loss"),
    severity: (session) => session.netPnlAfterFeesAndFunding !== null && session.netPnlAfterFeesAndFunding <= -100 ? "critical" : "warning",
    summary: (session) =>
      `Review candidate: native sessions show repeated post-loss re-entry damage across ${session.postLossReentryCount || 1} re-entry signal${(session.postLossReentryCount || 1) === 1 ? "" : "s"}. This is review-only. No rule has been activated.`,
    title: "Review post-loss re-entry damage.",
    topic: "post_loss_reentry_damage",
  },
  {
    isMatch: (session) => session.tags.includes("high_density"),
    severity: (session) => session.netPnlAfterFeesAndFunding !== null && session.netPnlAfterFeesAndFunding <= -100 ? "critical" : "warning",
    summary: (session) =>
      `Review candidate: native session density reached ${session.totalTrades} trades. Native Portal evidence supports reviewing pacing, not activating a rule automatically.`,
    title: "Review high-density session damage.",
    topic: "high_density_session_damage",
  },
  {
    isMatch: (session) => session.disciplineViolationCount > 0 || session.tags.includes("discipline_violation"),
    severity: () => "warning",
    summary: (session) =>
      `Review candidate: native sessions include ${session.disciplineViolationCount || 1} Discipline violation signal${(session.disciplineViolationCount || 1) === 1 ? "" : "s"}. This is review-only. No Discipline rule has been activated.`,
    title: "Review Discipline violation session.",
    topic: "discipline_violation_session",
  },
  {
    isMatch: (session) => session.manualExecutionCount > 0 && session.tags.includes("manual_impulse"),
    severity: () => "warning",
    summary: (session) =>
      `Review candidate: native sessions show ${session.manualExecutionCount} manual impulse trade${session.manualExecutionCount === 1 ? "" : "s"} in this session. Native Portal evidence supports reviewing the entry path.`,
    title: "Review manual impulse session.",
    topic: "manual_impulse_session",
  },
  {
    isMatch: (session) => session.unprotectedTradeCount > 0 || session.tags.includes("unprotected"),
    severity: () => "warning",
    summary: (session) =>
      `Review candidate: native sessions include ${session.unprotectedTradeCount || 1} unprotected trade${(session.unprotectedTradeCount || 1) === 1 ? "" : "s"}. This is review-only and does not enforce protection.`,
    title: "Review unprotected trade session.",
    topic: "unprotected_trade_session",
  },
  {
    isMatch: (session) => session.aiWarningDismissedCount > 0,
    severity: () => "warning",
    summary: (session) =>
      `Review candidate: native sessions show ${session.aiWarningDismissedCount} AI warning dismissal signal${session.aiWarningDismissedCount === 1 ? "" : "s"}. No realtime warning has been created from this candidate.`,
    title: "Review warning dismissal session.",
    topic: "warning_dismissal_session",
  },
  {
    isMatch: (session) => session.tags.includes("overnight"),
    severity: () => "warning",
    summary: () =>
      "Review candidate: native sessions include overnight activity. Native Portal evidence supports reviewing this time window before any rule is considered.",
    title: "Review overnight native session.",
    topic: "overnight_native_session",
  },
  {
    isMatch: (session) => session.tags.includes("weekend"),
    severity: () => "warning",
    summary: () =>
      "Review candidate: native sessions include weekend activity. Native Portal evidence supports reviewing this context before any rule is considered.",
    title: "Review weekend native session.",
    topic: "weekend_native_session",
  },
  {
    isMatch: (session) =>
      session.plannedExecutionCount > 0 &&
      (session.netPnlAfterFeesAndFunding ?? 0) > 0 &&
      (session.winRate ?? 0) >= 0.5,
    severity: () => "positive",
    summary: (session) =>
      `Native Portal evidence supports reviewing planned execution as a positive edge: ${session.plannedExecutionCount} planned execution signal${session.plannedExecutionCount === 1 ? "" : "s"} in a positive native session.`,
    title: "Planned execution may be working.",
    topic: "planned_execution_edge",
  },
];

function hasOnlyNativeEvidence(session: NativeSessionV1) {
  return session.evidence.length > 0 &&
    session.evidence.every((evidence) =>
      isNativeEvidence(evidence) &&
      !isImportedEvidence(evidence) &&
      !isDebugOnlyEvidence(evidence),
    );
}

function hasPrimaryNativeEvidence(session: NativeSessionV1) {
  return session.evidence.some(canUseAsPrimaryDiagnosisEvidence);
}

function isEligibleNativeSession(session: NativeSessionV1) {
  return (
    canBecomeDiagnosisGradeNativeSession(session) &&
    hasOnlyNativeEvidence(session) &&
    hasPrimaryNativeEvidence(session) &&
    session.closedTrades >= 2 &&
    (session.confidence === "medium" || session.confidence === "high") &&
    session.diagnosisReadiness === "diagnosis_grade"
  );
}

function findingId(session: NativeSessionV1, topic: NativeSessionDiagnosisTopic) {
  return `native-session-review:${topic}:${session.id}`;
}

function labelsForEvidence(evidence: DiagnosisEvidence[]) {
  return Array.from(new Set([
    "Native Portal evidence",
    "Native Session Review Candidates",
    "Review-only",
    "No automatic enforcement",
    ...evidence.map(getEvidenceUserFacingLabel),
  ]));
}

export function mapNativeSessionsToDiagnosisFindings(
  sessions: NativeSessionV1[],
): NativeSessionDiagnosisFinding[] {
  return sessions.flatMap((session) => {
    if (!isEligibleNativeSession(session)) {
      return [];
    }

    return FINDING_TEMPLATES
      .filter((template) => template.isMatch(session))
      .map((template) => ({
        confidence: session.confidence as Exclude<DiagnosisEvidenceConfidence, "insufficient_evidence">,
        diagnosisReadiness: "diagnosis_grade",
        evidence: session.evidence,
        id: findingId(session, template.topic),
        labels: labelsForEvidence(session.evidence),
        prohibitedActions: PROHIBITED_ACTIONS,
        relatedSessionIds: [session.id],
        relatedTradeIds: session.relatedTradeIds,
        reviewOnly: true,
        severity: template.severity(session),
        sourceType: "native",
        summary: template.summary(session),
        title: template.title,
        topic: template.topic,
      }));
  });
}
