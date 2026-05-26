# Time Foundation Phase 1

Date: 2026-05-23

## Files Changed

- `src/features/time/portal-time.ts`
- `src/features/time/portal-time.test.ts`
- `src/features/baseline-import/types.ts`
- `src/features/baseline-import/build-baseline-profile.ts`
- `src/features/baseline-import/storage.ts`
- `src/features/baseline-import/debug-output.ts`
- `src/features/baseline-import/baseline-import.test.ts`
- `src/features/ai-coach/lib/evidence-source-mix.test.ts`
- `src/features/ai-coach/lib/observational-coach.test.ts`
- `src/components/layout/app-shell.tsx`

## Timezone Persistence Behavior

- Historical Baseline scan requests now include a `timezone` field.
- The baseline wizard defaults that field to the browser-resolved IANA timezone through `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Invalid or missing timezones fall back to `UTC`.
- Saved Historical Baseline bundles persist timezone on `bundle.request.timezone`.
- Baseline profile date ranges persist timezone on `profile.dateRange.timezone`.
- Legacy stored bundles without timezone hydrate with `UTC` instead of being dropped.
- Hyperliquid source timestamps remain epoch milliseconds and are not mutated or converted before fetch, normalization, or reconstruction.
- Hyperliquid API payloads still send only exchange-required fields such as `startTime` and `endTime`; timezone is Portal scan provenance, not an exchange parameter.

## Helper Functions Added

`src/features/time/portal-time.ts` adds:

- `resolvePortalTimezone()`
- `getBrowserResolvedTimezone()`
- `getPortalLocalDisplayParts()`
- `getPortalTimeParts()`
- `isTraderLocalWeekend()`
- `getOvernightWindowForLocalDate()`
- `isEpochInOvernightWindow()`
- `tradeOverlapsOvernightWindow()`

The default overnight window is trader-local `20:00` to `05:00`. Overnight classification uses any-overlap logic for risk/session tagging only.

## Safe Centralization Completed

- Baseline `byTimeOfDay` buckets now use trader-local hour from the persisted scan timezone.
- Trade reconstruction debug overnight counters now use the persisted scan timezone and any-overlap helper.

## Intentionally Not Changed

- No UI redesign.
- No full session intelligence engine.
- No Operator Diagnosis integration.
- No overnight PnL attribution.
- No majority-duration overnight attribution.
- No native AI Coach time-bucket rewrite.
- No Operator Diagnosis runtime-local hour/day rewrite.
- No Discipline time-window helper rewrite.
- No date-input semantics change; scan start/end remain epoch ms UTC boundaries from the existing date inputs.

## Remaining Risks

- Existing native AI Coach and Operator Diagnosis time bucket logic still has UTC/runtime-local assumptions and should be migrated only with dedicated tests and product copy review.
- Historical Baseline date inputs still map selected dates to UTC day boundaries, while future session reports should distinguish selected range provenance from trader-local reporting days.
- Legacy bundles hydrate to `UTC`; they cannot recover the user's historical browser timezone.
- Timezone changes after a baseline is saved are not supported in Phase 1.

## Next Recommended Step

Phase 2 should build the narrow session-intelligence model on top of this helper: primary activity sessions, trader-local day grouping, weekend/overnight tags, confidence reasons, and explicit non-attribution copy for overnight risk exposure.
