import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvidenceComparisonDisplayCopy,
  getEvidenceComparisonTopicLabel,
} from "./evidence-comparison-copy";
import type { EvidenceComparisonResult } from "./evidence-comparison";

function comparison(overrides: Partial<EvidenceComparisonResult> = {}): EvidenceComparisonResult {
  return {
    confidence: "low",
    conclusion: "Imported baseline suggests overnight performance is worth investigating.",
    id: "evidence-comparison:overnight_performance",
    importedSummary:
      "Imported Historical Baseline shows negative overnight sessions in this scan. Source quality limits diagnosis confidence.",
    labels: [
      "Comparison only",
      "Imported Historical Baseline",
      "Directional context",
      "Not native Journal evidence",
      "Not diagnosis-grade yet",
    ],
    nativeSummary: null,
    recommendedUse: "show_as_investigation_prompt",
    relatedImportedEvidenceIds: ["imported-session:session-1:overnight_negative"],
    relatedNativeEvidenceIds: [],
    sourceWarnings: [],
    status: "imported_only",
    topic: "overnight_performance",
    ...overrides,
  };
}

test("aligned copy is cautious and clear", () => {
  const copy = buildEvidenceComparisonDisplayCopy(
    comparison({
      confidence: "medium",
      importedSummary: "Imported history shows a similar directional signal.",
      nativeSummary: "Native Portal evidence confirms the same direction.",
      recommendedUse: "show_as_confirmation",
      status: "aligned",
    }),
  );

  assert.equal(copy.statusLabel, "Aligned");
  assert.equal(copy.conclusion, "Native and imported evidence point in the same direction.");
  assert.equal(copy.topicLabel, "Overnight performance");
});

test("conflict copy says comparison, not diagnosis", () => {
  const copy = buildEvidenceComparisonDisplayCopy(
    comparison({
      recommendedUse: "show_as_conflict",
      status: "conflict",
    }),
  );

  assert.equal(
    copy.conclusion,
    "Native Portal evidence and imported history disagree. Treat this as a comparison, not a diagnosis.",
  );
  assert.match(copy.recommendedUseLabel, /conflict/i);
});

test("imported-only copy requires native confirmation", () => {
  const copy = buildEvidenceComparisonDisplayCopy(comparison());

  assert.equal(
    copy.conclusion,
    "Imported Historical Baseline suggests this is worth watching. Needs native confirmation.",
  );
  assert.match(copy.labels.join(" "), /Not native Journal evidence/);
});

test("not-comparable copy explains why", () => {
  const copy = buildEvidenceComparisonDisplayCopy(
    comparison({
      recommendedUse: "suppress",
      sourceWarnings: [
        {
          code: "date-range-mismatch",
          detail: "Native and imported samples use different date ranges.",
          severity: "warning",
        },
      ],
      status: "not_comparable",
    }),
  );

  assert.match(copy.conclusion, /time range, timezone, confidence, or sample differs/i);
  assert.match(copy.sourceWarningLabels[0] ?? "", /date-range-mismatch/);
});

test("insufficient evidence suppresses strong copy", () => {
  const copy = buildEvidenceComparisonDisplayCopy(
    comparison({
      confidence: "insufficient_evidence",
      importedSummary: null,
      recommendedUse: "suppress",
      status: "insufficient_evidence",
    }),
  );

  assert.equal(copy.shouldDisplay, false);
  assert.match(copy.conclusion, /needs more native or imported evidence/i);
  assert.doesNotMatch(copy.conclusion, /proves|definitely|always|diagnosed/i);
});

test("copy helper never says imported data proves behavior", () => {
  const statuses: EvidenceComparisonResult["status"][] = [
    "aligned",
    "conflict",
    "native_only",
    "imported_only",
    "not_comparable",
    "insufficient_evidence",
  ];

  for (const status of statuses) {
    const copy = buildEvidenceComparisonDisplayCopy(comparison({ status }));
    assert.doesNotMatch(`${copy.conclusion} ${copy.importedSummary ?? ""}`, /imported data proves|proves the diagnosis/i);
  }
});

test("topic labels are readable", () => {
  assert.equal(getEvidenceComparisonTopicLabel("high_density_sessions"), "High-density sessions");
  assert.equal(getEvidenceComparisonTopicLabel("long_short_bias"), "Long/short bias");
});
