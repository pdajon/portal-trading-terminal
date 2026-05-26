import assert from "node:assert/strict";
import test from "node:test";
import type { ImportedSessionSupportingContext } from "./imported-session-supporting-context";
import {
  compareEvidenceSources,
  summarizeEvidenceComparisonDebugOutput,
  type NativeEvidenceComparisonSummary,
} from "./evidence-comparison";
import {
  buildNativeSessionSummaries,
  mapNativeSessionSummariesToEvidenceComparisonSummaries,
} from "./native-session-summary";
import { createNativeJournalEvidence } from "./diagnosis-evidence";

function nativeSummary(
  overrides: Partial<NativeEvidenceComparisonSummary> = {},
): NativeEvidenceComparisonSummary {
  return {
    confidence: "high",
    direction: "positive",
    id: "native-overnight",
    label: "Native Portal evidence",
    relatedEvidenceIds: ["native-entry-1"],
    sourceWarnings: [],
    strength: "strong",
    summary: "Native Portal evidence shows this pattern is positive in the Journal sample.",
    topic: "overnight_performance",
    trustLevel: "diagnosis_grade",
    ...overrides,
  };
}

function importedContext(
  overrides: Partial<ImportedSessionSupportingContext> = {},
): ImportedSessionSupportingContext {
  return {
    allowedUses: ["ai_coach_context", "investigation_prompt", "operator_diagnosis_supporting"],
    confidence: "low",
    confidenceReasons: ["Source warnings limit imported session confidence."],
    evidenceLabel: "Imported Historical Baseline / Directional context / Not diagnosis-grade yet",
    id: "imported-session:session-1:overnight_negative",
    prohibitedUses: [
      "native_journal_claim",
      "discipline_enforcement",
      "automatic_trade_blocking",
      "high_confidence_diagnosis",
      "hard_behavior_claim",
    ],
    relatedSessionIds: ["session-1"],
    relatedTradeIds: ["trade-1"],
    sourceType: "imported_historical_baseline",
    sourceWarnings: [],
    summary:
      "Imported Historical Baseline shows negative overnight sessions in this scan. Source quality limits diagnosis confidence.",
    title: "Directional overnight signal",
    trustLevel: "weak_signal",
    ...overrides,
  };
}

test("native diagnosis-grade evidence outranks imported conflict", () => {
  const [comparison] = compareEvidenceSources({
    importedContexts: [importedContext()],
    nativeEvidence: [nativeSummary()],
  });

  assert.equal(comparison?.topic, "overnight_performance");
  assert.equal(comparison?.status, "conflict");
  assert.equal(comparison?.recommendedUse, "show_as_conflict");
  assert.match(comparison?.conclusion ?? "", /native evidence outranks imported context/i);
  assert.match(comparison?.conclusion ?? "", /comparison, not a diagnosis/i);
});

test("imported-only context becomes an investigation prompt, not diagnosis", () => {
  const [comparison] = compareEvidenceSources({
    importedContexts: [importedContext()],
    nativeEvidence: [],
  });

  assert.equal(comparison?.status, "imported_only");
  assert.equal(comparison?.recommendedUse, "show_as_investigation_prompt");
  assert.match(comparison?.conclusion ?? "", /native Portal evidence does not confirm it yet/i);
  assert.ok(comparison?.labels.includes("Imported Historical Baseline"));
  assert.ok(comparison?.labels.includes("Not native Journal evidence"));
});

test("aligned native and imported context becomes confirmation", () => {
  const [comparison] = compareEvidenceSources({
    importedContexts: [
      importedContext({
        id: "imported-session:session-2:post_loss_cluster",
        title: "Post-loss cluster candidate",
        summary:
          "Imported Historical Baseline shows a post-loss cluster candidate in this scan. Needs native confirmation before diagnosis.",
      }),
    ],
    nativeEvidence: [
      nativeSummary({
        direction: "negative",
        id: "native-post-loss",
        summary: "Native Portal evidence shows post-loss trades are negative.",
        topic: "post_loss_behavior",
      }),
    ],
  });

  assert.equal(comparison?.topic, "post_loss_behavior");
  assert.equal(comparison?.status, "aligned");
  assert.equal(comparison?.recommendedUse, "show_as_confirmation");
  assert.match(comparison?.conclusion ?? "", /Native evidence confirms this pattern/i);
});

test("not comparable topics are suppressed", () => {
  const [comparison] = compareEvidenceSources({
    comparabilityWarnings: {
      long_short_bias: "Native and imported samples use different date ranges.",
    },
    importedContexts: [
      importedContext({
        id: "imported-session:session-3:long_bias_weakness",
        title: "Long-bias context",
      }),
    ],
    nativeEvidence: [
      nativeSummary({
        direction: "negative",
        id: "native-long-bias",
        topic: "long_short_bias",
      }),
    ],
  });

  assert.equal(comparison?.status, "not_comparable");
  assert.equal(comparison?.recommendedUse, "suppress");
  assert.match(comparison?.conclusion ?? "", /not comparable/i);
});

test("insufficient evidence suppresses hard copy", () => {
  const [comparison] = compareEvidenceSources({
    importedContexts: [importedContext()],
    nativeEvidence: [
      nativeSummary({
        confidence: "insufficient_evidence",
        direction: "unknown",
        strength: "insufficient",
      }),
    ],
  });

  assert.equal(comparison?.status, "insufficient_evidence");
  assert.equal(comparison?.recommendedUse, "suppress");
  assert.doesNotMatch(comparison?.conclusion ?? "", /definitely|proves|merged/i);
});

test("imported evidence remains supporting-only and cannot enforce Discipline", () => {
  const [comparison] = compareEvidenceSources({
    importedContexts: [importedContext()],
    nativeEvidence: [],
  });

  assert.equal(comparison?.recommendedUse, "show_as_investigation_prompt");
  assert.equal(comparison?.relatedNativeEvidenceIds.length, 0);
  assert.ok(comparison?.labels.includes("Directional context"));
  assert.equal(importedContext().allowedUses.includes("operator_diagnosis_primary"), false);
  assert.ok(importedContext().prohibitedUses.includes("discipline_enforcement"));
  assert.ok(importedContext().prohibitedUses.includes("automatic_trade_blocking"));
});

test("debug summary counts comparison outcomes and warnings", () => {
  const comparisons = compareEvidenceSources({
    importedContexts: [importedContext()],
    nativeEvidence: [nativeSummary()],
    sourceWarnings: [{ code: "order-cap-hit", detail: "Historical orders capped.", severity: "warning" }],
  });
  const debugOutput = summarizeEvidenceComparisonDebugOutput(comparisons);

  assert.equal(debugOutput.comparisonCount, 1);
  assert.equal(debugOutput.conflictCount, 1);
  assert.equal(debugOutput.alignedCount, 0);
  assert.equal(debugOutput.topicsCompared[0], "overnight_performance");
  assert.equal(debugOutput.sourceWarnings[0]?.code, "order-cap-hit");
});

test("native session summaries align with imported context without merging samples", () => {
  const nativeEvidence = mapNativeSessionSummariesToEvidenceComparisonSummaries(
    buildNativeSessionSummaries({
      journalEntries: [
        {
          diagnosisEvidence: createNativeJournalEvidence({ id: "native-loss", relatedTradeIds: ["loss-1"] }),
          id: "loss-1",
          openedAt: "2026-05-23T14:00:00.000Z",
          realizedPnl: -20,
          status: "closed",
          timestamp: "2026-05-23T14:00:00.000Z",
        },
        {
          diagnosisEvidence: createNativeJournalEvidence({ id: "native-reentry", relatedTradeIds: ["reentry-1"] }),
          id: "reentry-1",
          openedAt: "2026-05-23T14:10:00.000Z",
          realizedPnl: -45,
          status: "closed",
          timestamp: "2026-05-23T14:10:00.000Z",
        },
      ],
      journalMemoryEvents: [],
    }),
  );

  const [comparison] = compareEvidenceSources({
    importedContexts: [
      importedContext({
        id: "imported-session:session-4:post_loss_cluster",
        title: "Post-loss cluster candidate",
        summary: "Imported Historical Baseline shows a negative post-loss cluster candidate. Needs native confirmation.",
      }),
    ],
    nativeEvidence,
  });

  assert.equal(comparison?.status, "aligned");
  assert.equal(comparison?.recommendedUse, "show_as_confirmation");
  assert.deepEqual(comparison?.relatedNativeEvidenceIds, ["reentry-1"]);
  assert.deepEqual(comparison?.relatedImportedEvidenceIds, ["imported-session:session-4:post_loss_cluster"]);
});

test("native session summaries conflict with imported context without promoting imported evidence", () => {
  const nativeEvidence = mapNativeSessionSummariesToEvidenceComparisonSummaries(
    buildNativeSessionSummaries({
      journalEntries: [
        {
          diagnosisEvidence: createNativeJournalEvidence({ id: "native-loss-positive", relatedTradeIds: ["loss-2"] }),
          id: "loss-2",
          openedAt: "2026-05-23T14:00:00.000Z",
          realizedPnl: -20,
          status: "closed",
          timestamp: "2026-05-23T14:00:00.000Z",
        },
        {
          diagnosisEvidence: createNativeJournalEvidence({ id: "native-reentry-positive", relatedTradeIds: ["reentry-2"] }),
          id: "reentry-2",
          openedAt: "2026-05-23T14:10:00.000Z",
          realizedPnl: 65,
          status: "closed",
          timestamp: "2026-05-23T14:10:00.000Z",
        },
      ],
      journalMemoryEvents: [],
    }),
  );

  const [comparison] = compareEvidenceSources({
    importedContexts: [
      importedContext({
        id: "imported-session:session-5:post_loss_cluster",
        title: "Post-loss cluster candidate",
        summary: "Imported Historical Baseline shows a negative post-loss cluster candidate. Needs native confirmation.",
      }),
    ],
    nativeEvidence,
  });

  assert.equal(comparison?.status, "conflict");
  assert.equal(comparison?.recommendedUse, "show_as_conflict");
  assert.match(comparison?.conclusion ?? "", /native evidence outranks imported context/i);
  assert.ok(comparison?.labels.includes("Directional context"));
});
