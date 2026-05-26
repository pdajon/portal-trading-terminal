# Imported Session Supporting Context Phase 4A

## Scope

Phase 4A allows selected imported session intelligence signals to appear as labeled supporting context in AI Coach and Historical Baseline source surfaces.

It does not promote imported evidence into native Operator Diagnosis evidence, does not trigger Discipline enforcement, does not create realtime blocking warnings, and does not change trade or session reconstruction.

## Files Changed

- `src/features/diagnosis/lib/imported-session-supporting-context.ts`
- `src/features/diagnosis/lib/imported-session-supporting-context.test.ts`
- `src/features/diagnosis/lib/diagnosis-evidence.ts`
- `src/features/ai-coach/lib/observational-coach.ts`
- `src/features/ai-coach/lib/observational-coach.test.ts`
- `src/features/ai-coach/lib/ai-warning-aggregation.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-shell-review-workspace.test.ts`
- `docs/implementation/IMPORTED_SESSION_SUPPORTING_CONTEXT_PHASE_4A.md`

## Supporting Signals Selected

The supporting-context selector emits conservative records for imported sessions when evidence is not `unsafe_not_enough_evidence`.

Supported signal candidates:

- `overnight_negative`
- `weekend_underperformance`
- `high_density_damage`
- `post_loss_cluster`
- `revenge_risk_cluster`
- `multi_asset_weakness`
- `long_bias_weakness`
- `short_bias_weakness`
- `fee_heavy_session`

The selector suppresses debug-only evidence and evidence missing required imported/context labels. It also caps output volume so supporting context stays compact.

## Why Supporting Only

Every imported session supporting context record carries:

- `sourceType: imported_historical_baseline`
- imported user-facing label: `Imported Historical Baseline / Directional context / Not diagnosis-grade yet`
- allowed uses without `operator_diagnosis_primary`
- prohibited uses including `discipline_enforcement`, `automatic_trade_blocking`, `high_confidence_diagnosis`, and `hard_behavior_claim`

Imported session evidence can appear as AI Coach context, investigation prompt context, and supporting diagnosis-adjacent context. It cannot become the primary basis for Operator Diagnosis in this phase.

## Label Enforcement

The selector requires the evidence label to include:

- `Imported Historical Baseline`
- `Directional context`
- `Not diagnosis-grade yet`

Historical Baseline source surfaces also show `Not native Journal evidence` where supporting context is listed.

## Primary Diagnosis Block

The Phase 3C evidence guards remain the hard boundary:

- `canUseAsPrimaryDiagnosisEvidence()` only passes native diagnosis-grade evidence.
- Imported evidence is filtered away from `operator_diagnosis_primary`.
- Imported evidence keeps prohibited uses that block Discipline enforcement and automatic blocking.
- Debug-only evidence is never user-facing diagnosis evidence.

Phase 4A only widened non-insufficient imported session evidence so it may be selected as supporting context. It did not add any path that treats imported sessions as native Journal evidence.

## Visible Surfaces

Imported session supporting context is visible in compact form in:

- AI Coach Historical Baseline cards as cautious detail text.
- Historical Baseline saved-source modal under `Supporting Context`.
- Context Source cards as a small supporting-signal count.

No new major page or design system was added.

## Conflict Placeholder

`detectImportedNativeConflictCandidate()` marks the future case where native evidence and imported evidence point in opposite directions. It does not merge or resolve conflicts yet.

Future UI should show those cases as conflicts instead of silently blending them.

## Intentionally Deferred

- No imported session signal is promoted into native Operator Diagnosis.
- No imported-only signal can fire realtime blocking warnings.
- No imported signal can enforce Discipline rules.
- No full conflict UI is implemented.
- No trade reconstruction or session reconstruction changes were made.
- No visual redesign was attempted.

## Next Recommended Phase

Phase 4B should implement explicit native-vs-imported conflict handling and evidence comparison rules before any imported supporting context is allowed to influence stronger Operator Diagnosis language.
