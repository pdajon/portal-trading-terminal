import assert from "node:assert/strict";
import test from "node:test";
import { buildNativeSessions, type NativeJournalEntryLike } from "./native-session-engine";
import {
  summarizeNativeSessionSourceHealth,
  mapNativeSessionsToEvidenceComparisonSummaries,
} from "./native-session-source-health";
import {
  canUseAsPrimaryDiagnosisEvidence,
  createDebugOnlyEvidence,
  createImportedBaselineEvidence,
} from "./diagnosis-evidence";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";

function trade(overrides: Partial<NativeJournalEntryLike> = {}): NativeJournalEntryLike {
  return {
    asset: "BTC",
    closedAt: "2026-05-23T15:00:00.000Z",
    direction: "long",
    entrySource: "manual",
    id: "trade-1",
    openedAt: "2026-05-23T14:00:00.000Z",
    protected: true,
    realizedPnl: 10,
    status: "closed",
    timestamp: "2026-05-23T14:00:00.000Z",
    ...overrides,
  };
}

function nativeSessions(overrides: {
  journalEntries?: NativeJournalEntryLike[];
  timezone?: string;
} = {}) {
  return buildNativeSessions({
    accountAddress: ACCOUNT,
    environment: "mainnet",
    journalEntries: overrides.journalEntries ?? [
      trade({ id: "trade-1" }),
      trade({
        id: "trade-2",
        openedAt: "2026-05-23T14:20:00.000Z",
        closedAt: "2026-05-23T14:30:00.000Z",
        realizedPnl: 20,
      }),
    ],
    timezone: overrides.timezone ?? "America/Chicago",
    walletAddress: WALLET,
  });
}

test("source health summarizes diagnosis-grade sessions", () => {
  const summary = summarizeNativeSessionSourceHealth({
    sessions: nativeSessions(),
  });

  assert.equal(summary.sessionCount, 1);
  assert.equal(summary.diagnosisGradeCount, 1);
  assert.equal(summary.directionalOnlyCount, 0);
  assert.equal(summary.unsafeCount, 0);
  assert.equal(summary.eligibleForFutureDiagnosis, true);
  assert.equal(summary.blocked, false);
  assert.equal(summary.confidenceMix.medium, 1);
  assert.equal(summary.readinessMix.diagnosis_grade, 1);
  assert.equal(summary.displayLines.includes("Native session engine available"), true);
  assert.equal(summary.displayLines.includes("Diagnosis-grade native sessions: 1"), true);
  assert.equal(summary.displayLines.includes("Not yet promoted into Operator Diagnosis"), true);
});

test("source health summarizes blocked sessions and limitations", () => {
  const [directional] = nativeSessions({
    journalEntries: [trade({ id: "single" })],
  });
  const [unsafe] = nativeSessions({
    journalEntries: [
      trade({ id: "tz-1" }),
      trade({
        id: "tz-2",
        openedAt: "2026-05-23T14:20:00.000Z",
        closedAt: "2026-05-23T14:30:00.000Z",
      }),
    ],
    timezone: "",
  });

  const summary = summarizeNativeSessionSourceHealth({
    sessions: [directional, unsafe].filter(Boolean),
  });

  assert.equal(summary.sessionCount, 2);
  assert.equal(summary.diagnosisGradeCount, 0);
  assert.equal(summary.directionalOnlyCount, 1);
  assert.equal(summary.unsafeCount, 1);
  assert.equal(summary.eligibleForFutureDiagnosis, false);
  assert.equal(summary.blocked, true);
  assert.match(summary.blockedReasons.join(" "), /At least 2 closed native trades/i);
  assert.match(summary.blockedReasons.join(" "), /valid IANA timezone/i);
  assert.match(summary.displayLines.join(" "), /Some sessions are blocked/i);
});

test("confidence distribution, tag counts, and source type counts are summarized", () => {
  const summary = summarizeNativeSessionSourceHealth({
    sessions: nativeSessions({
      journalEntries: [
        trade({ entrySource: "limit", id: "loss", realizedPnl: -10 }),
        trade({
          entrySource: "limit",
          id: "reentry",
          openedAt: "2026-05-23T14:10:00.000Z",
          closedAt: "2026-05-23T14:20:00.000Z",
          realizedPnl: 15,
        }),
      ],
    }),
  });

  assert.equal(summary.confidenceMix.medium, 1);
  assert.equal(summary.tagCounts.post_loss, 1);
  assert.equal(summary.tagCounts.rapid_reentry, 1);
  assert.equal(summary.sourceTypeCounts.native_journal, 1);
});

test("imported and debug evidence rejection counts are preserved", () => {
  const summary = summarizeNativeSessionSourceHealth({
    rejectedDebugEvidenceCount: 1,
    rejectedImportedEvidenceCount: 2,
    sessions: nativeSessions(),
  });

  assert.equal(summary.rejectedImportedEvidenceCount, 2);
  assert.equal(summary.rejectedDebugEvidenceCount, 1);
  assert.match(summary.blockedReasons.join(" "), /Rejected 2 imported/i);
  assert.match(summary.blockedReasons.join(" "), /Rejected 1 debug-only/i);
});

test("source health does not create primary diagnosis findings", () => {
  const sessions = nativeSessions();
  const summary = summarizeNativeSessionSourceHealth({ sessions });

  assert.equal(summary.primaryDiagnosisFindingCount, 0);
  assert.equal(sessions.some((session) => session.evidence.some(canUseAsPrimaryDiagnosisEvidence)), true);
  assert.equal(summary.displayLines.includes("Not yet promoted into Operator Diagnosis"), true);
});

test("source health summarizes review-only native diagnosis candidates and rejected sessions", () => {
  const sessions = [
    ...nativeSessions({
      journalEntries: [
        trade({ entrySource: "limit", id: "loss", realizedPnl: -10 }),
        trade({
          entrySource: "limit",
          id: "reentry",
          openedAt: "2026-05-23T14:10:00.000Z",
          closedAt: "2026-05-23T14:20:00.000Z",
          realizedPnl: -15,
        }),
      ],
    }),
    ...nativeSessions({ journalEntries: [trade({ id: "single" })] }),
  ];

  const summary = summarizeNativeSessionSourceHealth({ sessions });

  assert.equal(summary.nativeDiagnosisCandidateCount, 2);
  assert.equal(summary.nativeDiagnosisCandidatesByTopic.post_loss_reentry_damage, 1);
  assert.equal(summary.nativeDiagnosisCandidatesByTopic.weekend_native_session, 1);
  assert.equal(summary.nativeDiagnosisCandidatesBySeverity.warning, 2);
  assert.equal(summary.nativeDiagnosisCandidatesByConfidence.medium, 2);
  assert.equal(summary.reviewOnlyStatus, "review_only_not_promoted");
  assert.equal(summary.rejectedSessionCount, 1);
  assert.match(summary.rejectedSessions[0]?.reasons.join(" ") ?? "", /At least 2 closed native trades/i);
});

test("comparison adapter maps native sessions as context-only native summaries", () => {
  const summaries = mapNativeSessionsToEvidenceComparisonSummaries(
    nativeSessions({
      journalEntries: [
        trade({ id: "loss", realizedPnl: -10 }),
        trade({
          id: "reentry",
          openedAt: "2026-05-23T14:10:00.000Z",
          closedAt: "2026-05-23T14:20:00.000Z",
          realizedPnl: 5,
        }),
      ],
    }),
  );

  assert.equal(summaries.some((summary) => summary.topic === "post_loss_behavior"), true);
  assert.equal(summaries.every((summary) => summary.label === "Native session engine"), true);
  assert.match(summaries.map((summary) => summary.summary).join(" "), /Not yet promoted into Operator Diagnosis/i);
});

test("comparison adapter ignores imported and debug-only evidence references", () => {
  const sessions = nativeSessions();
  const pollutedSession = {
    ...sessions[0],
    evidence: [
      ...sessions[0].evidence,
      createImportedBaselineEvidence({ id: "imported-evidence" }),
      createDebugOnlyEvidence({ id: "debug-evidence" }),
    ],
  };

  const summaries = mapNativeSessionsToEvidenceComparisonSummaries([pollutedSession]);

  assert.equal(
    summaries.some((summary) =>
      summary.relatedEvidenceIds.includes("imported-evidence") ||
      summary.relatedEvidenceIds.includes("debug-evidence"),
    ),
    false,
  );
});
