# Session Intelligence Phase 2

Date: 2026-05-23

## Files Changed

- `src/features/baseline-import/session-intelligence.ts`
- `src/features/baseline-import/session-intelligence.test.ts`
- `src/features/baseline-import/types.ts`
- `src/features/baseline-import/index.ts`
- `src/features/baseline-import/storage.ts`
- `src/features/baseline-import/debug-output.ts`
- `src/features/baseline-import/baseline-import.test.ts`
- `scripts/write-session-intelligence-audit.ts`
- `scripts/write-insight-baseline-audit.ts`
- `scripts/write-trade-reconstruction-audit.ts`
- `package.json`
- `.portal/audits/session-intelligence-latest.json`

## Session Schema Implemented

`ReconstructedSession` now includes the Phase 2 diagnosis-ready fields:

- identity and context: `id`, `accountAddress`, `environment`, `timezone`, `startedAt`, `endedAt`, `localDateKey`, `sessionType`
- classification: `tags`, `isHighDensity`, `isOvernight`, `isWeekend`, `isPostLossCluster`, `isRevengeRisk`
- counts: `tradeIds`, `totalTrades`, `closedTrades`, `openTrades`, `wins`, `losses`, `winRate`
- PnL and exposure: `grossPnlBeforeFees`, `fees`, `funding`, `netPnlAfterFeesAndFunding`, `largestBaseSize`, `largestNotionalExposure`
- trade quality metrics: `bestTradeId`, `worstTradeId`, `firstTradeResult`, `lastTradeResult`, `averageHoldMinutes`, `totalTimeInMarketMinutes`
- behavior metrics: `postLossReentryCount`, `shortGapTradeCount`, `avgGapBetweenTrades`, `maxConsecutiveLosses`, `maxConsecutiveWins`
- mix metrics: `assetMix`, `directionMix`
- source quality: `boundaryTradeCount`, `openAtSessionEnd`, `orderMatchCompleteness`, `sourceCompleteness`, `confidence`, `confidenceReasons`, `diagnosisReadiness`

## Tag Logic

- `overnight`: any trade overlaps the trader-local `20:00` to `05:00` overnight window.
- `weekend`: any trade starts on Saturday or Sunday in the scan timezone.
- `high_density`: at least 6 trades in the session, or at least 4 trades with average gap `<= 15` minutes.
- `rapid_reentry`: at least 2 gaps `<= 15` minutes.
- `post_loss`: a losing closed trade is followed by another entry within 15 minutes.
- `revenge_risk`: post-loss re-entry where the next trade max size or derived notional exposure is at least 10% larger.
- `multi_asset`: 2 or more assets inside one primary session.
- `long_bias` / `short_bias`: 70% or more of trades in one direction.

Each trade belongs to exactly one primary session. Tags do not create extra PnL buckets, so account-level PnL is summed once per primary session.

## Confidence Logic

V1 confidence is conservative:

- `high` is defined but not currently emitted for imported baseline sessions.
- Fee semantics cap PnL confidence at `medium`.
- Missing timezone caps confidence at `low`.
- Fewer than 2 closed trades caps confidence at `low`.
- Open trades cap confidence at `low` for PnL-sensitive claims.
- Boundary fills, fill/order caps, large range warnings, or order-match gaps cap confidence at `low`.
- Invalid timestamps produce `insufficient_evidence`.

Diagnosis readiness remains conservative:

- Imported baseline sessions are `directional_only` unless evidence is unsafe.
- Invalid timestamp or insufficient evidence sessions are `unsafe_not_enough_evidence`.
- `ready_for_diagnosis` is reserved for a later phase after source-quality and diagnosis integration rules are reviewed.

## Directional-Only Fields

- `largestNotionalExposure` is derived from `entryPrice * maxSize` when entry price exists; it is not leverage-adjusted.
- `boundaryTradeCount` is scan-level source-health context, not a per-session repaired boundary count.
- `orderMatchCompleteness` uses current `orderIds` and `rawOrderMatches`; it does not repair capped historical order data.
- `grossPnlBeforeFees` follows the existing baseline convention of `netPnl + fees`; fee semantics remain unresolved.
- `sourceCompleteness` is derived from scan warnings and session shape, not a full per-trade provenance graph.

## Intentionally Not Connected Yet

- No UI redesign.
- No visible AI Coach or Baseline Profile surface changes.
- No Operator Diagnosis integration.
- No native Journal integration.
- No PnL attribution by overnight duration.
- No rewrite of trade lifecycle reconstruction.
- No automatic Discipline or warning behavior changes.

## Debug Output

`scripts/write-session-intelligence-audit.ts` writes `.portal/audits/session-intelligence-latest.json`.

The debug file includes:

- session count
- tag counts
- overnight, weekend, high-density, post-loss, and revenge-risk counts
- total session net PnL, fees, and funding
- confidence and diagnosis-readiness distributions
- top positive session and worst negative session

The generated audit file contains no private keys or secrets.

## Next Recommended Phase

Phase 3 should add source-quality-adjusted baseline insight consumption: keep the UI compact, surface confidence/source warnings in existing context-source areas, and still avoid Operator Diagnosis integration until imported evidence labeling is reviewed separately.
