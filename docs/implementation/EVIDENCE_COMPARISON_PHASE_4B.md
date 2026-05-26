# Evidence Comparison Phase 4B

## Scope

Phase 4B adds a comparison layer for native Portal evidence and imported Historical Baseline session context.

This phase does not promote imported session evidence into primary Operator Diagnosis, does not activate Discipline rules, does not create realtime blocking warnings, does not change execution behavior, and does not change trade or session reconstruction.

## Files Changed

- `src/features/diagnosis/lib/evidence-comparison.ts`
- `src/features/diagnosis/lib/evidence-comparison.test.ts`
- `src/features/ai-coach/lib/observational-coach.ts`
- `src/features/ai-coach/lib/observational-coach.test.ts`
- `src/features/ai-coach/lib/ai-warning-aggregation.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-shell-review-workspace.test.ts`
- `src/features/baseline-import/session-intelligence.ts`
- `src/features/baseline-import/session-intelligence.test.ts`
- `scripts/write-session-intelligence-audit.ts`
- `docs/implementation/EVIDENCE_COMPARISON_PHASE_4B.md`

## Comparison Statuses

`EvidenceComparisonResult.status` supports:

- `aligned`
- `conflict`
- `native_only`
- `imported_only`
- `not_comparable`
- `insufficient_evidence`

`recommendedUse` supports:

- `show_as_confirmation`
- `show_as_conflict`
- `show_as_investigation_prompt`
- `suppress`
- `debug_only`

## Topics Compared

The comparison module recognizes:

- `overnight_performance`
- `weekend_performance`
- `high_density_sessions`
- `post_loss_behavior`
- `revenge_risk_behavior`
- `long_short_bias`
- `multi_asset_behavior`
- `fee_heavy_sessions`

Imported topics come from Phase 4A supporting context records. Native topics come from explicit native summaries or the conservative `mapOperatorDiagnosisToNativeEvidenceSummaries()` adapter where current Operator Diagnosis findings map safely.

## Conflict Rules

The V1 rules are intentionally conservative:

- Diagnosis-grade native evidence outranks imported context when they disagree.
- Imported-only context becomes an investigation prompt, not diagnosis.
- Aligned native and imported signals can be shown as confirmation.
- Native-only evidence can be shown as confirmation when native strength is moderate or strong.
- Not-comparable topics are suppressed.
- Insufficient evidence is suppressed and uses cautious language.

Conflict copy is explicit: native and imported evidence are compared side by side and are not merged.

## Visibility

Comparison results are visible only in safe context surfaces:

- AI Coach Historical Baseline card details.
- Historical Baseline saved-source modal under `Evidence Comparison`.
- Context Source cards as a small comparison count.
- `.portal/audits/session-intelligence-latest.json` through the session-intelligence audit writer.

No primary Operator Diagnosis finding is created from imported evidence.

## Why Imported Evidence Remains Supporting Only

Imported comparison inputs still carry Phase 4A labels:

- `Imported Historical Baseline`
- `Directional context`
- `Not native Journal evidence`
- `Not diagnosis-grade yet`

The comparison layer never returns `operator_diagnosis_primary`, never creates Discipline rules, and never creates blocking warnings. It only produces comparison/context records.

## Debug Output

Session-intelligence debug output now accepts and writes comparison summary metadata:

- comparison count
- aligned count
- conflict count
- imported-only count
- native-only count
- not-comparable count
- suppressed count
- topics compared
- source warnings

The audit writer uses imported supporting contexts and no native evidence by default, so audit-only scans report imported-only comparison prompts unless a future caller supplies native summaries.

## Intentionally Deferred

- No full conflict UI or compare panel.
- No imported evidence promotion into Operator Diagnosis.
- No Discipline Plan activation from imported or comparison output.
- No realtime blocking warning from imported-only evidence.
- No richer native session adapter beyond safe current Operator Diagnosis mappings.
- No trade/session reconstruction changes.
- No UI redesign.

## Next Recommended Phase

Phase 4C should add a reviewed comparison UX treatment and richer native session summaries before any stronger Operator Diagnosis language is considered.
