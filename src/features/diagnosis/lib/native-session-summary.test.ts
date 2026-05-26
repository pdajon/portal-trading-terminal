import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNativeSessionSummaries,
  buildNativeSessionSummariesFromOperatorDiagnosis,
  buildNativeSessionSummaryForTopic,
  mapNativeSessionSummariesToEvidenceComparisonSummaries,
  type NativeSessionSummary,
} from "./native-session-summary";
import type { OperatorDiagnosis } from "./operator-diagnosis";
import { createImportedBaselineEvidence, createNativeJournalEvidence } from "./diagnosis-evidence";

function diagnosis(overrides: Partial<OperatorDiagnosis> = {}): OperatorDiagnosis {
  return {
    confidence: "medium",
    generatedAt: "2026-05-24T12:00:00.000Z",
    profitableBehaviors: [],
    profitLeaks: [
      {
        category: "post_loss_behavior",
        evidenceEventIds: ["event-1"],
        id: "finding:post-loss-behavior",
        impact: {
          netPnl: -120,
          tradeCount: 4,
          winRate: 0.25,
        },
        journalEntryIds: ["journal-1", "journal-2"],
        recommendation: "Add a cooldown after realized losses.",
        severity: "warning",
        summary: "Trades placed soon after realized losses are underperforming the rest of the sample.",
        title: "Post-loss trading is hurting you.",
      },
    ],
    recommendedPlan: {
      expectedBenefit: "Review only.",
      id: "plan",
      rules: [],
      status: "review_ready",
      summary: "No activation.",
      title: "Recommended Discipline Plan",
    },
    sampleSize: 6,
    ...overrides,
    nativeSessionReviewCandidates: overrides.nativeSessionReviewCandidates ?? [],
  };
}

test("native session summary maps existing post-loss evidence without inventing data", () => {
  const summary = buildNativeSessionSummaryForTopic({
    diagnosis: diagnosis(),
    topic: "post_loss_behavior",
  });

  assert.equal(summary.hasNativeEvidence, true);
  assert.equal(summary.trustLevel, "diagnosis_grade");
  assert.equal(summary.confidence, "medium");
  assert.equal(summary.sampleSize, 4);
  assert.equal(summary.netPnl, -120);
  assert.equal(summary.winRate, 0.25);
  assert.deepEqual(summary.evidenceIds, ["event-1", "journal-1", "journal-2"]);
});

test("native session summary does not invent missing evidence", () => {
  const summary = buildNativeSessionSummaryForTopic({
    diagnosis: diagnosis({ profitLeaks: [] }),
    topic: "ai_warning_behavior",
  });

  assert.equal(summary.hasNativeEvidence, false);
  assert.equal(summary.trustLevel, "insufficient_evidence");
  assert.equal(summary.confidence, "insufficient_evidence");
  assert.equal(summary.sampleSize, 0);
  assert.equal(summary.netPnl, null);
  assert.equal(summary.winRate, null);
  assert.match(summary.limitations[0] ?? "", /No native evidence/);
});

test("native session summary supports current native diagnosis topics", () => {
  const summaries = buildNativeSessionSummariesFromOperatorDiagnosis(
    diagnosis({
      profitLeaks: [
        ...diagnosis().profitLeaks,
        {
          category: "manual_entry",
          evidenceEventIds: ["manual-event"],
          id: "finding:manual-entry-weakness",
          impact: { netPnl: -80, tradeCount: 3, winRate: 0.33 },
          journalEntryIds: ["manual-journal"],
          recommendation: "Treat manual market entries as a review signal.",
          severity: "warning",
          summary: "Manual market entries are underperforming planned or trigger-based entries.",
          title: "Manual entries underperform.",
        },
        {
          category: "ai_warning_ignored",
          evidenceEventIds: ["warning-event"],
          id: "finding:ai-warning-ignored",
          impact: { tradeCount: 2 },
          journalEntryIds: ["warning-journal"],
          recommendation: "Review critical AI warnings before the next trade.",
          severity: "warning",
          summary: "AI warnings appeared near this trade.",
          title: "You traded through warnings.",
        },
      ],
    }),
  );

  assert.equal(summaries.find((summary) => summary.topic === "post_loss_behavior")?.hasNativeEvidence, true);
  assert.equal(summaries.find((summary) => summary.topic === "manual_planned_execution")?.hasNativeEvidence, true);
  assert.equal(summaries.find((summary) => summary.topic === "ai_warning_behavior")?.hasNativeEvidence, true);
});

test("comparison adapter uses only native summaries with evidence", () => {
  const summaries: NativeSessionSummary[] = [
    buildNativeSessionSummaryForTopic({
      diagnosis: diagnosis(),
      topic: "post_loss_behavior",
    }),
    buildNativeSessionSummaryForTopic({
      diagnosis: diagnosis({ profitLeaks: [] }),
      topic: "high_density_sessions",
    }),
  ];
  const comparisonSummaries = mapNativeSessionSummariesToEvidenceComparisonSummaries(summaries);

  assert.equal(comparisonSummaries.length, 1);
  assert.equal(comparisonSummaries[0]?.topic, "post_loss_behavior");
  assert.equal(comparisonSummaries[0]?.trustLevel, "diagnosis_grade");
});

test("native Journal evidence can create a native post-loss summary without imported evidence", () => {
  const summaries = buildNativeSessionSummaries({
    journalEntries: [
      {
        diagnosisEvidence: createNativeJournalEvidence({ id: "native-journal-evidence-1", relatedTradeIds: ["loss-1"] }),
        id: "loss-1",
        openedAt: "2026-05-23T14:00:00.000Z",
        realizedPnl: -40,
        status: "closed",
        timestamp: "2026-05-23T14:00:00.000Z",
      },
      {
        diagnosisEvidence: createNativeJournalEvidence({ id: "native-journal-evidence-2", relatedTradeIds: ["reentry-1"] }),
        id: "reentry-1",
        openedAt: "2026-05-23T14:08:00.000Z",
        realizedPnl: -90,
        status: "closed",
        timestamp: "2026-05-23T14:08:00.000Z",
      },
    ],
    journalMemoryEvents: [],
  });
  const summary = summaries.find((candidate) => candidate.topic === "post_loss_behavior");

  assert.equal(summary?.hasNativeEvidence, true);
  assert.equal(summary?.trustLevel, "diagnosis_grade");
  assert.equal(summary?.sampleSize, 1);
  assert.equal(summary?.netPnl, -90);
  assert.deepEqual(summary?.sourceTypes, ["native_journal"]);
  assert.deepEqual(summary?.relatedTradeIds, ["reentry-1"]);
  assert.ok(summary?.allowedUses.includes("operator_diagnosis_supporting"));
  assert.ok(summary?.prohibitedUses.includes("discipline_enforcement"));
});

test("imported evidence cannot create or upgrade a native summary", () => {
  const summaries = buildNativeSessionSummaries({
    diagnosis: diagnosis(),
    journalEntries: [
      {
        dataSource: "imported",
        diagnosisEvidence: createImportedBaselineEvidence({ id: "imported-baseline-evidence", relatedTradeIds: ["journal-1"] }),
        id: "journal-1",
        realizedPnl: -120,
        sourceType: "imported",
        status: "closed",
        timestamp: "2026-05-23T14:00:00.000Z",
      },
      {
        dataSource: "imported",
        id: "journal-2",
        realizedPnl: -25,
        sourceType: "imported",
        status: "closed",
        timestamp: "2026-05-23T14:10:00.000Z",
      },
    ],
    journalMemoryEvents: [],
  });
  const summary = summaries.find((candidate) => candidate.topic === "post_loss_behavior");

  assert.equal(summary?.hasNativeEvidence, false);
  assert.equal(summary?.confidence, "insufficient_evidence");
  assert.equal(summary?.trustLevel, "insufficient_evidence");
  assert.equal(summary?.sourceTypes.length, 0);
});

test("insufficient native summary cannot become diagnosis grade", () => {
  const summary = buildNativeSessionSummaryForTopic({
    diagnosis: diagnosis({ confidence: "low", profitLeaks: [] }),
    journalEntries: [],
    journalMemoryEvents: [],
    topic: "time_window_findings",
  });

  assert.equal(summary.hasNativeEvidence, false);
  assert.equal(summary.trustLevel, "insufficient_evidence");
  assert.equal(summary.confidence, "insufficient_evidence");
});

test("native summary covers AI warning and Discipline event sources without enabling enforcement", () => {
  const summaries = buildNativeSessionSummaries({
    journalEntries: [],
    journalMemoryEvents: [
      {
        id: "warning-ignored-1",
        source: "ai_coach",
        timestamp: "2026-05-23T14:00:00.000Z",
        type: "ai_warning_ignored",
      },
      {
        id: "discipline-block-1",
        source: "discipline",
        timestamp: "2026-05-23T14:05:00.000Z",
        type: "discipline_rule_blocked",
      },
    ],
  });
  const warningSummary = summaries.find((candidate) => candidate.topic === "ai_warning_behavior");
  const disciplineSummary = summaries.find((candidate) => candidate.topic === "discipline_violations");

  assert.equal(warningSummary?.hasNativeEvidence, true);
  assert.deepEqual(warningSummary?.sourceTypes, ["native_ai_warning"]);
  assert.equal(disciplineSummary?.hasNativeEvidence, true);
  assert.deepEqual(disciplineSummary?.sourceTypes, ["native_discipline"]);
  assert.ok(disciplineSummary?.prohibitedUses.includes("discipline_enforcement"));
  assert.equal(disciplineSummary?.allowedUses.includes("operator_diagnosis_primary"), false);
});

test("native summary adapter keeps native and imported samples separate", () => {
  const summaries = buildNativeSessionSummaries({
    journalEntries: [
      {
        diagnosisEvidence: createNativeJournalEvidence({ id: "native-journal-evidence-3", relatedTradeIds: ["loss-2"] }),
        id: "loss-2",
        openedAt: "2026-05-23T14:00:00.000Z",
        realizedPnl: -40,
        status: "closed",
        timestamp: "2026-05-23T14:00:00.000Z",
      },
      {
        dataSource: "imported",
        id: "imported-reentry",
        openedAt: "2026-05-23T14:08:00.000Z",
        realizedPnl: -90,
        sourceType: "imported",
        status: "closed",
        timestamp: "2026-05-23T14:08:00.000Z",
      },
    ],
    journalMemoryEvents: [],
  });
  const summary = summaries.find((candidate) => candidate.topic === "post_loss_behavior");

  assert.equal(summary?.hasNativeEvidence, false);
  assert.equal(summary?.sampleSize, 0);
  assert.deepEqual(summary?.relatedTradeIds, []);
});
