# Comparison UX Treatment Phase 4C

## Scope

Phase 4C makes Phase 4B comparison results easier to review in existing Portal surfaces and prepares lightweight native session summaries for future work.

This phase does not promote imported evidence into primary Operator Diagnosis, does not trigger Discipline enforcement, does not create realtime blocking warnings, does not change execution behavior, and does not rewrite trade or session reconstruction.

## Files Changed

- `src/features/diagnosis/lib/evidence-comparison-copy.ts`
- `src/features/diagnosis/lib/evidence-comparison-copy.test.ts`
- `src/features/diagnosis/lib/native-session-summary.ts`
- `src/features/diagnosis/lib/native-session-summary.test.ts`
- `src/features/ai-coach/lib/observational-coach.ts`
- `src/features/ai-coach/lib/observational-coach.test.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-shell-review-workspace.test.ts`
- `docs/implementation/COMPARISON_UX_TREATMENT_PHASE_4C.md`

## Copy And Status Rules

`buildEvidenceComparisonDisplayCopy()` converts comparison results into display-safe copy:

- `aligned`: “Native and imported evidence point in the same direction.”
- `conflict`: “Native Portal evidence and imported history disagree. Treat this as a comparison, not a diagnosis.”
- `imported_only`: “Imported Historical Baseline suggests this is worth watching. Needs native confirmation.”
- `native_only`: “Native Portal evidence exists; imported baseline does not confirm or compare this yet.”
- `not_comparable`: “Sources are not comparable because time range, timezone, confidence, or sample differs.”
- `insufficient_evidence`: suppress strong display and explain that more native or imported evidence is needed.

The helper also produces topic labels, status labels, confidence labels, recommended-use labels, source-warning labels, and a `shouldDisplay` boolean.

## Where Comparison Results Display

Existing surfaces now use the reviewed copy helper:

- AI Coach Historical Baseline card details.
- Historical Baseline modal `Evidence Comparison` section.
- Context Source cards with comparison count plus first status/topic label.

The modal stays compact and shows:

- status label
- topic label
- confidence
- native summary when present
- imported summary when present
- cautious conclusion
- recommended use
- source warnings when present

No new page, full compare panel, or Insight tab redesign was added.

## Native Session Summary Shape

`NativeSessionSummary` prepares future native evidence comparison inputs:

```ts
type NativeSessionSummary = {
  topic: NativeSessionSummaryTopic;
  hasNativeEvidence: boolean;
  trustLevel: EvidenceTrustLevel;
  confidence: DiagnosisEvidenceConfidence;
  sampleSize: number;
  netPnl: number | null;
  winRate: number | null;
  summary: string;
  evidenceIds: string[];
  limitations: string[];
};
```

Supported preparation topics:

- `post_loss_behavior`
- `manual_planned_execution`
- `ai_warning_behavior`
- `discipline_violations`
- `time_window_findings`
- `high_density_sessions`

The adapter reads existing Operator Diagnosis findings only. If a topic has no native finding, it returns `hasNativeEvidence: false`, `trustLevel: insufficient_evidence`, and limitations explaining that no native evidence exists.

## Comparison Integration Safety

The app now derives native comparison inputs from `buildNativeSessionSummariesFromOperatorDiagnosis()` and `mapNativeSessionSummariesToEvidenceComparisonSummaries()`.

Only native summaries with actual native evidence become comparison inputs. Missing native data leaves comparisons as imported-only investigation prompts. Native and imported samples are not merged.

## Why Imported Evidence Remains Supporting Only

Imported evidence remains labeled as:

- `Imported Historical Baseline`
- `Directional context`
- `Not native Journal evidence`
- `Not diagnosis-grade yet`

Comparison display copy does not use imported evidence as diagnosis proof. It never creates Discipline rules, never creates blocking warnings, and never changes Operator Diagnosis primary evidence eligibility.

## Intentionally Not Built

- No full comparison panel or new page.
- No native session intelligence engine.
- No imported evidence promotion into Operator Diagnosis.
- No Discipline Plan activation from imported or comparison output.
- No realtime blocking warning from imported-only evidence.
- No trade/session reconstruction changes.
- No UI redesign.

## Next Recommended Phase

Phase 4D should define the future native session intelligence contract and decide which native Journal/session events are sufficient for diagnosis-grade session claims before allowing stronger Operator Diagnosis language.
