# Evidence Drawers

## Scope

This phase adds reviewable evidence drawers for Operator Diagnosis findings, native session review candidates, imported supporting context, and evidence comparisons.

It does not redesign the UI, add Discipline enforcement, add realtime blocking, promote imported evidence into primary diagnosis, or change execution behavior.

## Files Changed

- `src/features/diagnosis/lib/evidence-drawer.ts`
- `src/features/diagnosis/lib/evidence-drawer.test.ts`
- `src/features/diagnosis/lib/native-session-engine.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-shell-review-workspace.test.ts`
- `docs/implementation/EVIDENCE_DRAWERS.md`

## Drawer Model Shape

`EvidenceDrawerModel` includes:

- `id`
- `title`
- `summary`
- `status`
- `sourceBadges`
- `confidence`
- `readiness`
- `reviewOnly`
- `sections`

Drawer sections support:

- Evidence Summary
- Sessions
- Trades
- Source Quality
- Confidence Reasons
- Native vs Imported
- Comparison Notes
- Prohibited Actions
- What this can be used for
- What this cannot be used for
- Next Review Step

## Where Drawers Appear

Drawers are available through compact `View evidence` / `Why?` affordances in existing surfaces:

- Operator Diagnosis profit leak cards
- Operator Diagnosis positive behavior cards
- Native Session Review Candidates
- Historical Baseline imported supporting-context rows
- Historical Baseline evidence-comparison rows

The drawer uses the existing dark glass modal treatment and does not introduce a new page or redesign the Insight/Diagnosis layout.

## Safety Copy Rules

Allowed drawer language includes:

- "This finding is based on native Portal evidence."
- "Imported Historical Baseline appears only as supporting context."
- "This is review-only. No rule has been activated."
- "Source quality limits confidence."
- "Portal is showing this as a comparison, not a diagnosis."

Disallowed drawer language remains:

- "Rule activated."
- "Trade blocked."
- "Imported history proves this."
- "You definitely always do this."

## Imported Evidence Treatment

Imported Historical Baseline drawers are labeled:

- Imported Historical Baseline
- Directional context
- Not native Journal evidence
- Not diagnosis-grade yet

Imported context drawers expose allowed and prohibited uses. They do not include `operator_diagnosis_primary` as an allowed use, and they explicitly say imported context cannot be used for primary Operator Diagnosis evidence, Discipline enforcement, or realtime blocking.

## Debug Output

Native session audit output now includes `evidenceDrawerSummary`:

- drawer model count
- drawer models by source type
- drawer models with warnings
- review-only drawer count

This is observability only and does not promote native session review candidates into enforcement.

## Intentionally Deferred

- Full Operator Intelligence visual redesign.
- Evidence drawer deep links.
- Backend persistence for drawer state.
- Discipline activation from drawer review.
- Realtime blocking from drawer review.
- Imported evidence promotion.

## Next Recommended Phase

Operator Intelligence visual redesign: once evidence is explainable and safely labeled, redesign the broader intelligence surface around native findings, review candidates, supporting imported context, and comparison drawers.
