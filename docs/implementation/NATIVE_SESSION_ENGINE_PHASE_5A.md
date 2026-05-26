# Native Session Engine Phase 5A

## Scope

Phase 5A implements the first native session construction engine behind the Phase 4E `NativeSessionV1` contract.

This phase does not redesign UI, does not promote imported evidence into primary Operator Diagnosis, does not allow imported evidence to trigger Discipline enforcement, does not allow imported-only evidence to fire realtime blocking warnings, does not change execution behavior, and does not rewrite imported trade/session reconstruction.

## Files Changed

- `src/features/diagnosis/lib/native-session-engine.ts`
- `src/features/diagnosis/lib/native-session-engine.test.ts`
- `src/features/diagnosis/lib/native-session-contract.ts`
- `docs/implementation/NATIVE_SESSION_ENGINE_PHASE_5A.md`

## Native Input Sources

The engine accepts native-like adapter inputs:

- native Journal entries
- native execution events
- native Discipline events
- native AI warning events
- native diagnosis finding references for future use

Sessions are created only from native Journal-like trade lifecycles with valid opened timestamps. Execution, Discipline, and AI warning events can attach to an existing session window, but they do not create sessions by themselves in V1.

Imported Journal-shaped entries, imported evidence, and debug-only evidence are rejected from native session construction.

## Session Grouping Rules

V1 grouping uses:

- trader-local timezone through `portal-time`
- trader-local local date key
- a 90-minute inactivity gap
- one primary session per trade
- durable `createNativeSessionId()`

The durable session ID uses:

```text
native-session:{accountOrWallet}:{environment}:{localDateKey}:{startedAt}:{membershipHash}
```

The membership hash is based on sorted trade and event IDs, so IDs are stable for the same session membership and change when membership changes.

## Metrics Implemented

The engine safely calculates:

- `totalTrades`
- `closedTrades`
- `openTrades`
- `wins`
- `losses`
- `winRate`
- `grossPnlBeforeFees`
- `fees`
- `funding`
- `netPnlAfterFeesAndFunding`
- `bestTradeId`
- `worstTradeId`
- `averageHoldMinutes`
- `totalTimeInMarketMinutes`
- `assetMix`
- `directionMix`
- `firstTradeResult`
- `lastTradeResult`
- `postLossReentryCount`
- `shortGapTradeCount`
- `maxConsecutiveLosses`
- `maxConsecutiveWins`
- `disciplineViolationCount`
- `aiWarningShownCount`
- `aiWarningDismissedCount`
- `plannedExecutionCount`
- `manualExecutionCount`
- `protectedTradeCount`
- `unprotectedTradeCount`

Unavailable numeric metrics remain `null` when the native input does not provide enough information.

## Tags Implemented

V1 tags:

- `post_loss`
- `rapid_reentry`
- `high_density`
- `discipline_violation`
- `manual_impulse`
- `planned_execution`
- `ai_warning`
- `protected`
- `unprotected`
- `overnight`
- `weekend`

Overnight and weekend tags are only applied when timezone handling is safe.

## Evidence Rules

Each session attaches Phase 3C `DiagnosisEvidence` objects:

- native Journal evidence
- native execution evidence
- native Discipline evidence
- native AI warning evidence

Imported evidence is not attached as native proof. Debug-only evidence is not user-facing native session evidence. Imported evidence cannot create native sessions or raise native confidence.

## Confidence And Readiness Rules

The engine uses Phase 4E gates:

- valid timezone, 2+ closed native trades, native evidence, and medium/high confidence can produce `diagnosis_grade`
- fewer than 2 closed native trades produce `directional_only`
- missing/invalid timezone or missing native evidence produces `unsafe_not_enough_evidence`
- imported evidence never upgrades confidence

Eligible sessions pass `canBecomeDiagnosisGradeNativeSession()`.

## Debug Output

The module includes:

- `summarizeNativeSessionEngineDebugOutput()`
- `writeNativeSessionEngineDebugOutput()`

The default debug path is:

```text
.portal/audits/native-session-engine-latest.json
```

The debug output includes:

- native session count
- diagnosis-grade count
- directional-only count
- unsafe count
- tag counts
- evidence source counts
- rejected imported/debug evidence counts when supplied
- confidence distribution
- top limitations

No private keys or secrets are written.

## Intentionally Deferred

- No UI display changes.
- No primary Operator Diagnosis wiring.
- No Discipline Plan activation or enforcement.
- No realtime blocking warning behavior.
- No native backend persistence.
- No full native lifecycle reconciliation beyond the adapter inputs.
- No imported trade/session reconstruction changes.

## Next Recommended Phase

Phase 5B should wire this native engine into a non-promotional debug/source-health path first, then compare native sessions against imported supporting context without making imported evidence primary.
