# Native Session Contract Phase 4E

## Scope

Phase 4E defines the diagnosis-grade native session contract before Portal builds the full native session engine.

This phase does not redesign UI, does not promote imported evidence into primary Operator Diagnosis, does not allow imported evidence to trigger Discipline enforcement, does not allow imported-only evidence to fire realtime blocking warnings, does not change execution behavior, and does not rewrite imported trade or session reconstruction.

## Files Changed

- `src/features/diagnosis/lib/native-session-contract.ts`
- `src/features/diagnosis/lib/native-session-contract.test.ts`
- `docs/implementation/NATIVE_SESSION_CONTRACT_PHASE_4E.md`

## NativeSessionV1 Schema

`NativeSessionV1` is the future diagnosis-grade session record for Portal-native evidence.

It includes:

- identity: `id`, `source`, `accountAddress`, `walletAddress`, `environment`
- time: `timezone`, `startedAt`, `endedAt`, `localDateKey`, `sessionType`, `tags`
- related native records: `relatedTradeIds`, `relatedJournalEntryIds`, `relatedExecutionEventIds`, `relatedDisciplineEventIds`, `relatedAiWarningIds`
- trade metrics: `totalTrades`, `closedTrades`, `openTrades`, `wins`, `losses`, `winRate`
- PnL metrics: `grossPnlBeforeFees`, `fees`, `funding`, `netPnlAfterFeesAndFunding`
- trade extremes: `bestTradeId`, `worstTradeId`
- exposure/time metrics: `averageHoldMinutes`, `totalTimeInMarketMinutes`
- mixes: `assetMix`, `directionMix`
- sequence metrics: `firstTradeResult`, `lastTradeResult`, `postLossReentryCount`, `shortGapTradeCount`, `maxConsecutiveLosses`, `maxConsecutiveWins`
- native behavior counts: `disciplineViolationCount`, `aiWarningShownCount`, `aiWarningDismissedCount`, `plannedExecutionCount`, `manualExecutionCount`, `protectedTradeCount`, `unprotectedTradeCount`
- evidence contract: `confidence`, `confidenceReasons`, `diagnosisReadiness`, `allowedUses`, `prohibitedUses`, `evidence`

The schema is intentionally broad enough for the future native engine, but Phase 4E does not construct sessions from live data yet.

## Eligibility Gates

The module adds:

- `canBecomeDiagnosisGradeNativeSession()`
- `canFeedPrimaryOperatorDiagnosis()`
- `canSuggestDisciplinePlanReview()`
- `canTriggerRealtimeWarning()`
- `explainNativeSessionLimitations()`

Diagnosis-grade native session eligibility requires:

- source is `portal_native`
- valid IANA timezone
- at least 2 closed native trades
- native evidence references are present
- confidence is `medium` or `high`
- `diagnosisReadiness` is `diagnosis_grade`
- evidence includes diagnosis-grade native evidence
- imported, external, and debug-only evidence are not used as user-facing native session proof

Primary Operator Diagnosis additionally requires:

- the session allows `operator_diagnosis_primary`
- at least one attached evidence object can be used as primary diagnosis evidence

Discipline Plan review requires diagnosis-grade native evidence, but Phase 4E does not activate or enforce Discipline rules.

Realtime warning eligibility requires:

- diagnosis-grade native session eligibility
- explicit future rule support passed into the gate
- primary diagnosis allowance
- no session-level `automatic_trade_blocking` prohibition
- primary native diagnosis evidence

No realtime warning behavior is wired in this phase.

## Session ID Strategy

`createNativeSessionId()` creates IDs in this format:

```text
native-session:{accountOrWallet}:{environment}:{localDateKey}:{startedAt}:{membershipHash}
```

The membership hash is based on sorted trade IDs and event IDs. This makes the ID:

- stable across reloads for the same membership
- order-independent
- changed when underlying trade/event membership changes
- free of private keys or secrets
- usable before backend persistence

A future backend can replace or alias these IDs after durable persistence exists.

## Evidence Linking

Each `NativeSessionV1` carries `DiagnosisEvidence[]`.

Rules:

- native evidence preserves `sourceType`, `trustLevel`, confidence, labels, and allowed/prohibited uses
- imported evidence may be used later as supporting comparison context, but not as native proof
- debug-only evidence is rejected from user-facing native session eligibility
- imported evidence cannot satisfy native session gates or upgrade native confidence

## What Counts As Diagnosis-Grade Native Evidence

For this contract, diagnosis-grade native evidence means a `DiagnosisEvidence` object that:

- is native Portal evidence
- has `trustLevel: diagnosis_grade`
- has confidence other than `insufficient_evidence`
- is usable as supporting or primary diagnosis evidence depending on the gate
- is not imported, external, or debug-only

## Intentionally Deferred

- No full native session construction engine.
- No durable backend persistence.
- No UI redesign.
- No imported primary Operator Diagnosis.
- No Discipline enforcement from imported evidence or native session summaries.
- No realtime blocking warning behavior.
- No rewrite of imported trade/session reconstruction.

## Next Recommended Phase

Phase 5A should implement the native session construction engine behind this contract:

- build native sessions from Journal, execution, Discipline, and AI warning events
- assign durable native session IDs with `createNativeSessionId()`
- populate `NativeSessionV1` metrics conservatively
- run the Phase 4E gates before allowing any primary Operator Diagnosis use
