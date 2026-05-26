# Evidence Schema Guards Phase 3C

Date: 2026-05-23

## Files Changed

- `src/features/diagnosis/lib/diagnosis-evidence.ts`
- `src/features/diagnosis/lib/diagnosis-evidence.test.ts`
- `src/features/diagnosis/lib/operator-diagnosis.ts`
- `src/features/diagnosis/lib/operator-diagnosis.test.ts`
- `src/features/ai-coach/lib/evidence-source-mix.ts`
- `src/features/ai-coach/lib/evidence-source-mix.test.ts`

## Evidence Types Added

`diagnosis-evidence.ts` adds the shared evidence contract from `docs/architecture/OPERATOR_DIAGNOSIS_EVIDENCE_BOUNDARY.md`.

Trust levels:

- `diagnosis_grade`
- `directional_context`
- `weak_signal`
- `debug_only`
- `insufficient_evidence`

Source types:

- `native_journal`
- `native_execution`
- `native_discipline`
- `native_ai_warning`
- `imported_historical_baseline`
- `external_directional_context`
- `debug_only`

`DiagnosisEvidence` includes provenance, labels, account/environment, time range, timezone, related trade/session ids, confidence, confidence reasons, source warnings, allowed uses, prohibited uses, and `userFacingLabel`.

## Constructors Added

Safe constructors now exist for:

- `createNativeJournalEvidence()`
- `createNativeExecutionEvidence()`
- `createNativeDisciplineEvidence()`
- `createNativeAiWarningEvidence()`
- `createImportedBaselineEvidence()`
- `createImportedSessionEvidence()`
- `createDebugOnlyEvidence()`

Imported constructors force `origin` to `historical_import` or `external`, default to `directional_context` or `weak_signal`, require a user-facing imported label, and add prohibitions for native claims, Discipline enforcement, automatic blocking, high-confidence diagnosis, and hard behavior claims.

Debug evidence strips user-facing diagnosis uses and remains `debug_only`.

## Guard Rules

Guard helpers added:

- `isNativeEvidence()`
- `isImportedEvidence()`
- `isDebugOnlyEvidence()`
- `canUseAsPrimaryDiagnosisEvidence()`
- `canUseAsSupportingDiagnosisEvidence()`
- `canUseForDisciplineEnforcement()`
- `assertNoImportedPrimaryDiagnosis()`
- `assertNoDebugUserFacingDiagnosis()`
- `getEvidenceUserFacingLabel()`

Rules enforced:

- Only native `diagnosis_grade` evidence can be primary diagnosis evidence.
- Imported evidence can only be supporting context unless a future explicit gate is added.
- Debug evidence is never user-facing diagnosis.
- Discipline enforcement requires native `diagnosis_grade` evidence.
- `diagnosis_grade` cannot use `insufficient_evidence` confidence.
- Sample size alone cannot upgrade imported evidence to `diagnosis_grade`.

## Imported Evidence Blocking

`mapBaselineImportTradesForDiagnosis()` still preserves the legacy diagnosis-shaped imported trade mapping for compatibility, but each mapped entry now carries:

- `dataSource: "imported"`
- `sourceType: "imported"`
- `userFacingLabel: "Imported Historical Baseline / Directional context / Not diagnosis-grade yet"`
- `diagnosisEvidence` with imported source type, directional trust, source warnings, and prohibited uses

`deriveOperatorDiagnosisV1()` now computes diagnosis confidence from primary native diagnosis evidence, not imported sample size. Imported entries can still be explicitly included in the old compatibility path, but imported-only history cannot create high-confidence diagnosis by volume.

## Session Evidence Adapter

`mapImportedSessionToDiagnosisEvidence()` converts a `ReconstructedSession` into `DiagnosisEvidence` without wiring it into Operator Diagnosis consumption.

Adapter behavior:

- `sourceType: "imported_historical_baseline"`
- `origin: "historical_import"`
- `weak_signal` for low-confidence sessions
- `directional_context` for medium-confidence directional sessions
- `insufficient_evidence` for unsafe or insufficient sessions
- preserves related session/trade ids, source warnings, confidence reasons, timezone, and time range
- prohibits native Journal claims, Discipline enforcement, automatic trade blocking, high-confidence diagnosis, and hard behavior claims

## Intentionally Deferred

- No UI redesign.
- No imported session promotion into Operator Diagnosis.
- No execution behavior changes.
- No trade reconstruction or session reconstruction changes.
- No new finding rendering for imported context.
- No Discipline activation from imported evidence.
- No realtime warning activation from imported-only evidence.

## Next Recommended Phase

Phase 4 should cautiously allow selected imported session signals into AI Coach and Operator Diagnosis as supporting context only, using the new `DiagnosisEvidence` contract. Native evidence should remain the primary source for hard findings and Discipline review.
