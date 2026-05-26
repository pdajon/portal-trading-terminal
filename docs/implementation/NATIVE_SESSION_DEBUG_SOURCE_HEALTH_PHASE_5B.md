# Native Session Debug Source Health Phase 5B

## Scope

Phase 5B wires the Phase 5A native session engine into observability paths only.

This phase does not promote native sessions into primary Operator Diagnosis, does not promote imported evidence, does not allow imported evidence to trigger Discipline enforcement or realtime blocking warnings, does not change execution behavior, and does not rewrite imported trade/session reconstruction.

## Files Changed

- `src/features/diagnosis/lib/native-session-source-health.ts`
- `src/features/diagnosis/lib/native-session-source-health.test.ts`
- `src/features/diagnosis/lib/native-session-engine.ts`
- `src/features/diagnosis/lib/native-session-engine-debug.ts`
- `src/features/diagnosis/lib/native-session-engine.test.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-shell-review-workspace.test.ts`
- `scripts/write-native-session-audit.ts`
- `docs/implementation/NATIVE_SESSION_DEBUG_SOURCE_HEALTH_PHASE_5B.md`

## Debug Output Path

Native session audit output is written to:

```text
.portal/audits/native-session-engine-latest.json
```

The audit writer now includes:

- native session count
- diagnosis-grade count
- directional-only count
- unsafe count
- confidence distribution
- diagnosis readiness distribution
- tag counts
- evidence source counts
- rejected imported/debug evidence counts when supplied
- top limitations
- safe sample sessions with hashed session IDs
- source-health summary
- comparison summary when supplied

The audit output does not write private keys or raw wallet/account-bearing session IDs.

## Source-Health Summary Fields

`summarizeNativeSessionSourceHealth()` returns:

- `sessionCount`
- `diagnosisGradeCount`
- `directionalOnlyCount`
- `unsafeCount`
- `confidenceMix`
- `readinessMix`
- `tagCounts`
- `sourceTypeCounts`
- `limitations`
- `blockedReasons`
- `eligibleForFutureDiagnosis`
- `blocked`
- `rejectedImportedEvidenceCount`
- `rejectedDebugEvidenceCount`
- `primaryDiagnosisFindingCount`
- `displayLines`

`primaryDiagnosisFindingCount` remains `0` in this phase because source health is not a diagnosis producer.

## Where Visible

Native session source health is visible in the existing AI Coach `Context Sources` area as a compact source card:

- “Native session engine available”
- session count
- diagnosis-grade native session count
- blocked-session reasons when present
- “Not yet promoted into Operator Diagnosis”

This is intentionally a source-health/debug surface, not a primary Operator Diagnosis finding.

## Comparison Preparation

`mapNativeSessionsToEvidenceComparisonSummaries()` adapts native sessions into native-side comparison summaries for existing evidence comparison logic.

Rules preserved:

- comparisons are context only
- native/imported samples are not merged
- imported context remains supporting only
- imported/debug evidence IDs are filtered out of native session comparison summaries
- no native session is passed into `deriveOperatorDiagnosisV1()`

## What Remains Blocked

Blocked or limited native sessions are shown with explicit reasons, including:

- missing or invalid timezone
- fewer than 2 closed native trades
- insufficient native evidence
- non-diagnosis-grade readiness
- imported/debug evidence rejected from native-session source health

## Intentionally Deferred

- No primary Operator Diagnosis wiring.
- No Discipline Plan activation from native sessions.
- No realtime blocking warning behavior.
- No imported evidence promotion.
- No new native session UI page or redesign.
- No backend persistence.
- No full native lifecycle reconstruction beyond the Phase 5A engine.

## Next Recommended Phase

Phase 5C should add a gated, review-only path for selected diagnosis-grade native session summaries to be considered by Operator Diagnosis packaging while keeping imported evidence supporting-only and Discipline enforcement disabled until explicit rule support exists.
