# Safe Native Diagnosis Integration

## Scope

This phase allows diagnosis-grade Portal-native sessions to produce review-only Operator Diagnosis candidates.

It does not redesign UI, does not promote imported evidence into primary diagnosis, does not trigger Discipline enforcement, does not fire realtime blocking warnings, does not change execution behavior, and does not auto-activate Discipline rules.

## Files Changed

- `src/features/diagnosis/lib/native-session-diagnosis.ts`
- `src/features/diagnosis/lib/native-session-diagnosis.test.ts`
- `src/features/diagnosis/lib/operator-diagnosis.ts`
- `src/features/diagnosis/lib/operator-diagnosis.test.ts`
- `src/features/diagnosis/lib/native-session-source-health.ts`
- `src/features/diagnosis/lib/native-session-source-health.test.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-shell-review-workspace.test.ts`
- `docs/implementation/SAFE_NATIVE_DIAGNOSIS_INTEGRATION.md`

## Supported Finding Topics

Review-only native session topics:

- `post_loss_reentry_damage`
- `high_density_session_damage`
- `discipline_violation_session`
- `manual_impulse_session`
- `unprotected_trade_session`
- `warning_dismissal_session`
- `overnight_native_session`
- `weekend_native_session`
- `planned_execution_edge`

## Safety Gates

`mapNativeSessionsToDiagnosisFindings()` only creates findings when a session:

- passes `canBecomeDiagnosisGradeNativeSession()`
- has Portal-native evidence only
- has at least one primary native diagnosis evidence object
- has medium or high confidence
- has `diagnosisReadiness: "diagnosis_grade"`
- has at least 2 closed native trades
- has no imported or debug-only evidence

Imported baseline/session evidence may still appear elsewhere as supporting comparison context, but it cannot create these native session review candidates.

## Where Findings Appear

Operator Diagnosis now includes a separate `nativeSessionReviewCandidates` array.

In the terminal, candidates appear in a compact existing Operator Diagnosis area labeled:

```text
Native Session Review Candidates
```

They are not merged into `profitLeaks`, `profitableBehaviors`, or `recommendedPlan.rules`.

## Why Review-Only

Every native session diagnosis candidate includes:

- `reviewOnly: true`
- `sourceType: "native"`
- native evidence labels
- `prohibitedActions`
  - `automatic_trade_blocking`
  - `automatic_discipline_activation`
  - `imported_only_enforcement`

The UI copy says no rule has been activated. The candidates are for review and packaging only.

## Imported Evidence Boundary

Imported or debug-only evidence fails the mapper gate. Imported evidence cannot satisfy the native session contract, cannot create review candidates, and cannot be used for Discipline enforcement or realtime blocking warnings.

## Debug And Source Health

Native session source health now includes:

- native diagnosis candidate count
- candidates by topic
- candidates by severity
- candidates by confidence
- rejected sessions and reasons
- imported/debug rejection counts
- `reviewOnlyStatus: "review_only_not_promoted"`

The audit file remains:

```text
.portal/audits/native-session-engine-latest.json
```

## Intentionally Deferred

- Evidence drawers.
- Full Operator Intelligence redesign.
- Discipline rule activation from native session candidates.
- Realtime warning generation from native session candidates.
- Imported evidence promotion.
- Backend persistence of native session candidates.

## Next Recommended Phase

Evidence Drawers: add inspectable evidence details for each native session review candidate, with source labels, related sessions/trades, confidence reasons, and prohibited actions visible before any stronger diagnosis workflow is considered.
