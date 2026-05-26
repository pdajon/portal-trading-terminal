import assert from "node:assert/strict";
import test from "node:test";
import {
  createImportedBaselineEvidence,
  createNativeJournalEvidence,
} from "./diagnosis-evidence";
import type { EvidenceComparisonResult } from "./evidence-comparison";
import type { ImportedSessionSupportingContext } from "./imported-session-supporting-context";
import type { NativeSessionDiagnosisFinding } from "./native-session-diagnosis";
import type { DiagnosisFinding, OperatorDiagnosis } from "./operator-diagnosis";
import {
  buildEvidenceDrawerForComparison,
  buildEvidenceDrawerForImportedSupportingContext,
  buildEvidenceDrawerForNativeSessionReviewCandidate,
  buildEvidenceDrawerForOperatorFinding,
  summarizeEvidenceDrawerDebugOutput,
} from "./evidence-drawer";

function sectionText(model: { sections: Array<{ items: string[]; title: string }> }, title: string) {
  return model.sections
    .filter((section) => section.title === title)
    .flatMap((section) => section.items)
    .join(" ");
}

function allDrawerText(model: { summary: string; sections: Array<{ items: string[]; title: string }> }) {
  return [model.summary, ...model.sections.flatMap((section) => section.items)].join(" ");
}

function nativeEvidence() {
  return createNativeJournalEvidence({
    confidence: "high",
    confidenceReasons: ["Closed native Journal trades show repeated post-loss re-entry losses."],
    id: "native-evidence-1",
    relatedSessionIds: ["native-session-1"],
    relatedTradeIds: ["trade-1", "trade-2"],
    sourceWarnings: [{ code: "native_complete", detail: "Native lifecycle evidence present.", severity: "info" }],
  });
}

function diagnosisFinding(overrides: Partial<DiagnosisFinding> = {}): DiagnosisFinding {
  return {
    category: "post_loss_behavior",
    evidenceEventIds: ["event-1"],
    id: "finding-1",
    impact: { netPnl: -120, tradeCount: 2 },
    journalEntryIds: ["journal-1", "journal-2"],
    recommendation: "Review cooldown after loss before changing rules.",
    severity: "warning",
    summary: "Native Journal evidence shows post-loss losses in the current Portal sample.",
    title: "Post-loss behavior needs review.",
    ...overrides,
  };
}

function operatorDiagnosis(overrides: Partial<OperatorDiagnosis> = {}): OperatorDiagnosis {
  return {
    confidence: "medium",
    generatedAt: "2026-05-24T20:00:00.000Z",
    nativeSessionReviewCandidates: [],
    profitableBehaviors: [],
    profitLeaks: [diagnosisFinding()],
    recommendedPlan: {
      expectedBenefit: "Review only.",
      id: "plan-1",
      rules: [],
      status: "draft",
      summary: "No rule is activated from this drawer.",
      title: "Review plan",
    },
    sampleSize: 6,
    ...overrides,
  };
}

function nativeSessionCandidate(overrides: Partial<NativeSessionDiagnosisFinding> = {}): NativeSessionDiagnosisFinding {
  return {
    confidence: "high",
    diagnosisReadiness: "diagnosis_grade",
    evidence: [nativeEvidence()],
    id: "native-candidate-1",
    labels: ["Native Portal evidence", "Review-only", "No automatic enforcement"],
    prohibitedActions: [
      "automatic_trade_blocking",
      "automatic_discipline_activation",
      "imported_only_enforcement",
    ],
    relatedSessionIds: ["native-session-1"],
    relatedTradeIds: ["trade-1", "trade-2"],
    reviewOnly: true,
    severity: "warning",
    sourceType: "native",
    summary: "Review candidate: native sessions show repeated post-loss re-entry damage. This is review-only. No rule has been activated.",
    title: "Review post-loss re-entry damage.",
    topic: "post_loss_reentry_damage",
    ...overrides,
  };
}

function importedContext(overrides: Partial<ImportedSessionSupportingContext> = {}): ImportedSessionSupportingContext {
  const evidence = createImportedBaselineEvidence({
    confidence: "low",
    confidenceReasons: ["Imported session reconstruction is directional only."],
    id: "imported-evidence-1",
    relatedSessionIds: ["imported-session-1"],
    relatedTradeIds: ["imported-trade-1"],
    sourceWarnings: [{ code: "fill_cap", detail: "Fill cap may limit this scan.", severity: "warning" }],
  });

  return {
    allowedUses: evidence.allowedUses,
    confidence: "low",
    confidenceReasons: evidence.confidenceReasons,
    evidenceLabel: evidence.userFacingLabel,
    id: "imported-context-1",
    prohibitedUses: evidence.prohibitedUses,
    relatedSessionIds: evidence.relatedSessionIds,
    relatedTradeIds: evidence.relatedTradeIds,
    sourceType: evidence.sourceType,
    sourceWarnings: evidence.sourceWarnings,
    summary: "Imported Historical Baseline shows negative overnight sessions in this scan. Source quality limits diagnosis confidence.",
    title: "Directional overnight signal",
    trustLevel: evidence.trustLevel,
    ...overrides,
  };
}

test("native finding drawer shows native source label", () => {
  const model = buildEvidenceDrawerForOperatorFinding({
    diagnosis: operatorDiagnosis(),
    finding: diagnosisFinding(),
  });

  assert.equal(model.sourceBadges.includes("Native Portal evidence"), true);
  assert.match(sectionText(model, "Native vs Imported"), /based on native Portal evidence/i);
  assert.equal(model.reviewOnly, false);
});

test("native session review candidate drawer shows review-only and prohibited actions", () => {
  const model = buildEvidenceDrawerForNativeSessionReviewCandidate(nativeSessionCandidate());

  assert.equal(model.reviewOnly, true);
  assert.match(sectionText(model, "Evidence Summary"), /review-only/i);
  assert.match(sectionText(model, "Prohibited Actions"), /automatic_trade_blocking/);
  assert.match(sectionText(model, "Prohibited Actions"), /automatic_discipline_activation/);
  assert.match(sectionText(model, "Prohibited Actions"), /imported_only_enforcement/);
});

test("imported context drawer shows imported directional labels and not diagnosis grade", () => {
  const model = buildEvidenceDrawerForImportedSupportingContext(importedContext());

  assert.equal(model.sourceBadges.includes("Imported Historical Baseline"), true);
  assert.equal(model.sourceBadges.includes("Directional context"), true);
  assert.equal(model.reviewOnly, true);
  assert.match(sectionText(model, "Native vs Imported"), /Not native Journal evidence/i);
  assert.match(sectionText(model, "Native vs Imported"), /Not diagnosis-grade yet/i);
  assert.doesNotMatch(sectionText(model, "What this can be used for"), /operator_diagnosis_primary/);
});

test("drawer includes confidence reasons and source warnings", () => {
  const model = buildEvidenceDrawerForImportedSupportingContext(importedContext());

  assert.match(sectionText(model, "Confidence Reasons"), /directional only/i);
  assert.match(sectionText(model, "Source Quality"), /Fill cap may limit this scan/i);
});

test("drawer never uses enforcement or blocking copy", () => {
  const drawers = [
    buildEvidenceDrawerForOperatorFinding({
      diagnosis: operatorDiagnosis(),
      finding: diagnosisFinding(),
    }),
    buildEvidenceDrawerForNativeSessionReviewCandidate(nativeSessionCandidate()),
    buildEvidenceDrawerForImportedSupportingContext(importedContext()),
  ];

  drawers.forEach((drawer) => {
    const text = allDrawerText(drawer);

    assert.doesNotMatch(text, /Rule activated/i);
    assert.doesNotMatch(text, /Trade blocked/i);
    assert.doesNotMatch(text, /Imported history proves/i);
    assert.doesNotMatch(text, /You definitely always/i);
  });
});

test("drawer does not treat imported context as primary evidence", () => {
  const model = buildEvidenceDrawerForImportedSupportingContext(importedContext());

  assert.equal(model.status, "supporting_context");
  assert.match(sectionText(model, "What this cannot be used for"), /Primary Operator Diagnosis evidence/i);
  assert.match(sectionText(model, "What this cannot be used for"), /Discipline enforcement/i);
});

test("comparison drawer shows comparison status without diagnosis promotion", () => {
  const comparison: EvidenceComparisonResult = {
    confidence: "medium",
    conclusion: "Native Portal evidence and imported history disagree. Portal is treating this as a comparison, not a diagnosis.",
    id: "comparison-1",
    importedSummary: "Imported baseline suggests overnight weakness.",
    labels: ["Comparison only", "Imported Historical Baseline", "Directional context"],
    nativeSummary: "Native evidence does not confirm overnight weakness.",
    recommendedUse: "show_as_conflict",
    relatedImportedEvidenceIds: ["imported-context-1"],
    relatedNativeEvidenceIds: ["finding-1"],
    sourceWarnings: [{ code: "date_range", detail: "Date ranges differ.", severity: "warning" }],
    status: "conflict",
    topic: "overnight_performance",
  };
  const model = buildEvidenceDrawerForComparison(comparison);

  assert.equal(model.status, "comparison");
  assert.match(sectionText(model, "Comparison Notes"), /comparison, not a diagnosis/i);
  assert.match(sectionText(model, "Source Quality"), /Date ranges differ/i);
});

test("drawer debug summary counts review-only and warning models", () => {
  const models = [
    buildEvidenceDrawerForNativeSessionReviewCandidate(nativeSessionCandidate()),
    buildEvidenceDrawerForImportedSupportingContext(importedContext()),
  ];
  const summary = summarizeEvidenceDrawerDebugOutput(models);

  assert.equal(summary.drawerModelCount, 2);
  assert.equal(summary.reviewOnlyCount, 2);
  assert.equal(summary.modelsWithWarningsCount, 1);
  assert.equal(summary.modelsBySourceType.native, 1);
  assert.equal(summary.modelsBySourceType.imported, 1);
});
