# Portal Session Intelligence Architecture

## 1. Executive Summary

Session intelligence is the missing layer between Portal's reconstructed trades and Operator Diagnosis.

The current trade reconstruction model is directionally correct: it groups Hyperliquid fills into useful position lifecycles instead of treating every fill as a fake trade. That gives Portal a credible trade-level base. But Operator Diagnosis should not reason only from isolated trades. Traders lose edge in sequences: late-night runs, rapid re-entry after loss, high-density decision clusters, weekend sessions, manual impulse chains, and fee-heavy chop.

The future architecture should turn reconstructed trades into diagnosis-ready behavioral sessions. A session is the unit where Portal can say: "This is where the behavior happened, this is what it cost, this is the evidence, and this is how confident we are." Until that layer exists, Insight and Diagnosis should avoid hard claims about overnight trading, time windows, post-loss spirals, fatigue, and flow state.

Core architecture decisions:

- Keep Hyperliquid timestamps as epoch milliseconds and never mutate source truth.
- Persist a trader timezone with every baseline scan.
- Build primary activity sessions first, then add analytical tags and cluster views.
- Give each trade one primary session to avoid PnL double-counting.
- Allow sessions to have multiple tags such as `overnight`, `high_density`, and `post_loss_cluster`.
- Make confidence multi-factor. Sample size alone must never produce high confidence.
- Treat session intelligence as evidence infrastructure first; UI redesign comes later.

## 2. Current State

Current working pieces:

- `reconstructImportedTrades` turns normalized Hyperliquid fills into `ImportedTrade` records.
- Scale-ins and scale-outs are grouped into one net-position lifecycle, which is correct for behavior analysis.
- Reversals are split into a close fragment and a new open trade.
- Boundary fills from positions opened before the selected range are excluded from recommendation-grade trades.
- Historical orders are attached by order id and used for market / limit / mixed classification.
- Funding rows are attached by same coin and trade time window.
- `buildSessions` creates thin sessions with a 90-minute inactivity gap.
- `buildBaselineProfile` derives basic totals, direction/asset/time/hold buckets, size-after-loss, high-density count, and short-gap count.

Current limitations from the audits:

- Sessions only store start, end, dominant asset, trade count, trade IDs, net PnL, wins, losses, and notes.
- There is no true overnight session model.
- Baseline time-of-day buckets use UTC hours.
- Operator Diagnosis time buckets use runtime local hours.
- Baseline scans do not persist user timezone.
- Session metrics do not include fees, funding, gross PnL, best/worst trade, average hold, total time in market, asset mix, direction mix, first trade result, or confidence.
- Historical order enrichment can be capped at 2000 orders.
- Open and boundary positions can make selected-window conclusions incomplete.
- Fee semantics are not independently reconciled.
- Imported baseline evidence can become diagnosis input when external context is enabled, so session confidence must be explicit before broad diagnosis use.

## 3. Core Definitions

**Trade lifecycle**

A reconstructed position lifecycle for one coin, derived from one or more fills. It starts when net exposure opens from zero, grows through scale-ins, shrinks through scale-outs, closes when net exposure returns to zero, and may split on reversal. A trade lifecycle is not the same thing as an exchange fill.

**Session**

A primary time-bounded group of reconstructed trades for one wallet, one environment, and one timezone. A trade should belong to exactly one primary session for PnL accounting.

**Behavioral session**

A session enriched with behavioral tags, PnL, fee/funding aggregation, clustering metrics, completeness markers, and confidence. This is the diagnosis-ready unit.

**Overnight session**

A session that overlaps the trader-local overnight window. Portal's default overnight window should be 8:00 PM to 5:00 AM in the scan's persisted timezone.

**High-density session**

A session with an unusually high number of trades or a high trade rate over a short period. Default V1 trigger: at least 6 closed trades in one primary activity session, or at least 4 trades with average gap <= 15 minutes.

**Post-loss re-entry cluster**

A cluster where a losing closed trade is followed by another risk-increasing trade within a short re-entry window. Default V1 window: next entry begins within 15 minutes of the previous losing trade's close.

**Revenge-risk cluster**

A post-loss re-entry cluster where the next trade increases exposure, notional size, or risk after a loss. Default V1 trigger: next trade's largest notional exposure or max base size is at least 10% greater than the losing trade.

**Fatigue-risk session**

A session where duration, late local time, repeated losses, high density, or extended time in market suggests decision quality may be degrading. Default V1 should be conservative: tag only when at least two fatigue signals are present.

**Disciplined session**

A session where trades are mostly planned, protected, and not clustered after losses. For imported baseline data, this may be unavailable unless order/protection/context data exists. For native Portal sessions, it can use Journal, Discipline, protection, and plan-followed evidence.

**Flow-state session**

A profitable, controlled session with positive net PnL, limited churn, reasonable fees, no post-loss spiral, and no major discipline violations. This should require higher confidence and enough repeated evidence before becoming a positive diagnosis.

**Trader-local day**

The calendar date in the trader's persisted timezone, not UTC. This is the day key used for day-by-day performance, weekend classification, same-day sessions, and overnight attribution.

## 4. Session Types

| Session Type | Trigger / Start Condition | End Condition | Required Data | Metrics Calculated | Confidence Requirements | Diagnosis Use Case | Example User-Facing Insight |
|---|---|---|---|---|---|---|---|
| Standard activity session | First trade after inactivity or local-day boundary | Inactivity gap exceeds threshold, local-day split applies, or overnight split applies | Reconstructed trades with entry/end time | Trade count, wins/losses, PnL, fees, funding, hold, gaps | Medium if no cap/boundary warnings and >=2 closed trades | Baseline unit for behavior summaries | "This session had 4 closed trades, +$220 net, and no rapid re-entry after losses." |
| Overnight session | Any primary session overlaps 8:00 PM-5:00 AM trader-local window | Overnight window ends or primary session ends | Timezone, entry/end times, PnL | Overnight trades, win rate, net, fees, funding, worst/best overnight session | Timezone required; low if timezone missing | Night trading expectancy and risk gating | "Across 9 overnight sessions, you lost $1,240 net after fees." |
| High-density session | >=6 trades in session or >=4 trades with avg gap <=15m | Primary session ends or density cluster gap exceeds threshold | Trade entries/exits, local time | Trades/hour, short gaps, PnL after first loss, fees | Medium if complete closed trades and valid timestamps | Overtrading diagnosis | "Your high-density sessions are negative expectancy: 5 sessions, -$840 net, $112 fees." |
| Rapid re-entry cluster | Next trade starts <=15m after previous trade closes | Gap exceeds threshold or cluster ends | Closed trade end times and next entry times | Re-entry count, gap stats, PnL after re-entry | Medium if close and next entry are reliable | Chasing / impulse detection | "You re-entered within 15 minutes 12 times. Those follow-ups lost $410 net." |
| Post-loss re-entry cluster | Losing trade followed by next entry <=15m | Cluster ends when gap exceeds threshold or non-loss reset rule applies | PnL, close time, next entry | Post-loss count, loss-after-loss rate, net after first loss | Medium if PnL and timestamps reliable | Cooldown recommendations | "71% of this session's loss came after the first losing trade." |
| Revenge-risk session | Post-loss re-entry plus size/risk increase >=10% | Primary session ends | Comparable size/notional/risk | Exposure increase, next-trade PnL, fee bleed | Low if only base size exists; medium if notional exists | Size-after-loss warnings | "After losing, you increased exposure by 38% and the next two trades lost $260." |
| Weekend session | Trader-local day is Saturday or Sunday | Session ends by inactivity/local-day rule | Timezone and local-day helper | Weekend PnL, win rate, fees, assets | Timezone required | Weekend performance guardrails | "Weekend sessions are dragging the sample: 6 sessions, -$520 net." |
| Same-day session | Starts and ends within one trader-local day | Inactivity gap or day boundary | Timezone, entry/end times | Daily session stats and day grouping | Medium if timezone and complete data | Day-by-day performance | "Your best same-day sessions came before noon, not after losses." |
| Multi-asset session | Session contains trades in >=2 assets | Primary session ends | Asset IDs per trade | Asset mix, cross-asset PnL, sequencing | Medium if asset normalization reliable | Cross-asset distraction or rotation | "Multi-asset sessions underperformed single-asset sessions by $48 per trade." |
| Directional bias session | >=70% trades or PnL exposure in one direction | Primary session ends | Direction, size/notional | Long/short mix, PnL by direction | Medium if direction and PnL complete | Bias detection | "Long-biased sessions lost money while short-biased sessions were flat-positive." |
| Discipline-violation session | Native session has discipline blocks, overrides, broken plans, or ignored warnings | Primary session ends | Native Journal, Discipline, AI warning events | Violations, PnL after violation, plan status | Imported baseline usually insufficient | Operator Diagnosis and rule review | "Sessions with ignored warnings lost $640 net across 11 trades." |
| Planned execution session | Native session contains planned / trigger / Magic Trade execution with plan followed | Primary session ends | Native plan, Journal, trigger events | Planned vs manual PnL, win rate, drawdown | Native evidence required | Positive behavior packaging | "Planned execution sessions are your edge: +$930 net, 64% win rate." |
| Manual impulse session | Manual market entries dominate and session underperforms | Primary session ends | Entry source, order mode, PnL | Manual count, PnL, fees, gaps | Medium if entry source reliable | Manual entry warnings | "Manual impulse sessions cost $390 net; most losses followed market re-entry." |

## 5. Timezone Model

Correct time architecture:

- Hyperliquid source timestamps remain epoch milliseconds.
- Every baseline scan persists a `timezone` field, defaulting to the browser-resolved IANA timezone when available.
- The scan request stores `startTime` and `endTime` as epoch milliseconds plus user-facing local date inputs.
- All session grouping uses trader-local time derived from epoch milliseconds and the persisted timezone.
- One shared time helper should serve baseline, AI Coach, Operator Diagnosis, Discipline, realtime warnings, and UI display.
- The system must distinguish source timestamp, UTC day, trader-local day, and display time.

Recommended shared helper shape:

```ts
type PortalTimeContext = {
  timezone: string;
};

type PortalTimeParts = {
  epochMs: number;
  utcDateKey: string;
  traderLocalDateKey: string;
  traderLocalHour: number;
  traderLocalMinute: number;
  traderLocalDayOfWeek: number;
  displayIso: string;
};
```

Time concepts:

| Concept | Meaning | Usage |
|---|---|---|
| Exchange timestamp | Epoch ms from Hyperliquid | Source truth for order and fill chronology |
| UTC day | `YYYY-MM-DD` in UTC | Debugging, API ranges, source provenance |
| Trader-local day | `YYYY-MM-DD` in persisted timezone | Session grouping, weekend, day-by-day diagnosis |
| Display time | Formatted in selected/user timezone | UI labels and evidence drawers |

Default overnight:

- Trader-local 8:00 PM to 5:00 AM.
- Stored as `{ startTime: "20:00", endTime: "05:00", timezone }`.
- Overnight spans two trader-local dates and should be assigned to the date on which it starts unless a report explicitly says otherwise.

Trade overlap classification options:

| Option | Description | Pros | Cons |
|---|---|---|---|
| Entry-time based | Trade is overnight if entry occurs inside overnight window | Simple, predictable | Misses trades opened before 8 PM and held through the night |
| Exit-time based | Trade is overnight if close occurs inside overnight window | Captures realized outcome timing | Mislabels trades mostly held earlier |
| Majority-duration based | Trade is overnight if most duration overlaps overnight | Best for hold-time attribution | Harder for open trades and very short trades |
| Any-overlap based | Trade is overnight if any part overlaps overnight | Best for risk exposure detection | Can overinclude trades with tiny overlap |

Recommended Portal default:

- Use **any-overlap based** for session tagging and risk exposure.
- Use **majority-duration based** as a secondary metric for PnL attribution when enough duration data exists.
- Show confidence lower when overnight membership depends on an open trade or incomplete boundary.

Why: Portal is a risk and behavior terminal. If a trader carries exposure into the overnight window, the session should be eligible for overnight diagnosis. But PnL attribution should remain cautious when only a small part of the trade overlaps the window.

## 6. Session Construction Algorithm

Inputs:

- Reconstructed trades.
- Baseline request with account, environment, range, and timezone.
- Data-quality warnings from intake and trade reconstruction.
- Optional native context: Journal, Discipline, AI warnings, Session Logs, protection state.

Algorithm:

1. Validate every trade has `entryTime`, source completeness, and confidence.
2. Sort trades by `entryTime`, then `endTime`, coin, and trade id.
3. Convert every trade's entry and end into trader-local time parts.
4. Build primary activity sessions:
   - Start a new session at the first trade.
   - Start a new session if the gap from previous trade end/entry exceeds 90 minutes.
   - Start a new session if trader-local day changes and neither trade overlaps the same overnight window.
   - Preserve a configurable inactivity gap, default 90 minutes.
5. Apply overnight logic:
   - Detect whether each trade overlaps the trader-local 8 PM-5 AM window.
   - Tag the primary session `overnight` if any included trade overlaps overnight.
   - Optionally split a long primary session at overnight boundaries only if needed for reporting, but do not double-count trade PnL.
6. Compute cluster tags inside primary sessions:
   - `high_density`: session trade count >=6 or >=4 trades with average gap <=15 minutes.
   - `rapid_reentry_cluster`: at least two re-entry gaps <=15 minutes.
   - `post_loss_cluster`: losing trade followed by next entry <=15 minutes.
   - `revenge_risk`: post-loss cluster plus exposure increase.
   - `fatigue_risk`: at least two fatigue signals such as late local hour, long duration, high density, consecutive losses, or high fee bleed.
7. Add contextual tags:
   - `weekend` if local day is Saturday/Sunday.
   - `multi_asset` if asset mix includes more than one asset.
   - `directional_bias_long` or `directional_bias_short` if one side dominates count/exposure.
   - `manual_impulse` when manual market entries dominate and underperform.
   - `planned_execution` when native plan/trigger evidence dominates.
   - `discipline_violation` when native Discipline or AI warning events occur in session.
8. Aggregate metrics once per primary session:
   - Sum PnL, fees, funding, and counts only across unique trade IDs.
   - Derived cluster views can reference the same trade IDs but must not add independent PnL into account totals.
9. Handle open trades:
   - Include in `openTrades`.
   - Exclude from closed win rate.
   - Include known fees if collected.
   - Mark `openAtSessionEnd`.
   - Lower confidence for PnL-dependent metrics.
10. Handle boundary trades:
   - Keep boundary counts visible.
   - If boundary fills were excluded before trade reconstruction, mark the session/range source completeness as partial.
   - Do not use boundary-affected sessions for high-confidence PnL diagnosis.
11. Handle incomplete/capped data:
   - Propagate fill cap, order cap, unmatched orders, invalid timestamps, duplicate fills, and fee uncertainty into session confidence reasons.
   - A capped source can still produce directional insights, but not high-confidence diagnosis.

Multi-session tagging:

- One trade has one `primarySessionId`.
- A session can have many tags.
- Derived clusters can be separate analytical records that reference a subset of `tradeIds`.
- Account-level totals should sum only primary sessions.
- Diagnosis can use either primary sessions or derived clusters, but the evidence must show which view was used.

## 7. Diagnosis-Ready Session Schema

Future TypeScript shape:

```ts
export type SessionType =
  | "standard_activity"
  | "overnight"
  | "high_density"
  | "rapid_reentry_cluster"
  | "post_loss_reentry_cluster"
  | "revenge_risk"
  | "weekend"
  | "same_day"
  | "multi_asset"
  | "directional_bias"
  | "discipline_violation"
  | "planned_execution"
  | "manual_impulse";

export type SessionTag =
  | "overnight"
  | "high_density"
  | "rapid_reentry"
  | "post_loss"
  | "revenge_risk"
  | "fatigue_risk"
  | "weekend"
  | "multi_asset"
  | "long_bias"
  | "short_bias"
  | "discipline_violation"
  | "planned_execution"
  | "manual_impulse"
  | "flow_state";

export type SessionConfidence = "high" | "medium" | "low" | "insufficient_evidence";

export type SourceCompleteness =
  | "complete"
  | "partial_boundary"
  | "partial_open"
  | "possibly_truncated"
  | "order_enrichment_incomplete"
  | "invalid_timestamps"
  | "insufficient_source";

export type DiagnosisReadiness =
  | "ready_for_diagnosis"
  | "directional_only"
  | "unsafe_not_enough_evidence";

export type ReconstructedSession = {
  id: string;
  accountAddress: string;
  environment: "mainnet" | "testnet";
  timezone: string;
  startedAt: number;
  endedAt: number;
  localDateKey: string;
  sessionType: SessionType;
  tags: SessionTag[];
  tradeIds: string[];
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  grossPnlBeforeFees: number | null;
  fees: number;
  funding: number;
  netPnlAfterFeesAndFunding: number | null;
  bestTradeId: string | null;
  worstTradeId: string | null;
  averageHoldMinutes: number | null;
  totalTimeInMarketMinutes: number;
  largestBaseSize: number | null;
  largestNotionalExposure: number | null;
  assetMix: Record<string, { tradeCount: number; netPnl: number | null }>;
  directionMix: {
    long: { tradeCount: number; netPnl: number | null };
    short: { tradeCount: number; netPnl: number | null };
  };
  firstTradeResult: "win" | "loss" | "flat" | "open" | "unknown";
  lastTradeResult: "win" | "loss" | "flat" | "open" | "unknown";
  postLossReentryCount: number;
  shortGapTradeCount: number;
  avgGapBetweenTrades: number | null;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  isHighDensity: boolean;
  isOvernight: boolean;
  isWeekend: boolean;
  isPostLossCluster: boolean;
  isRevengeRisk: boolean;
  boundaryTradeCount: number;
  openAtSessionEnd: boolean;
  orderMatchCompleteness: {
    matchedOrderIds: number;
    unmatchedOrderIds: number;
    fullyMatchedTrades: number;
    partiallyMatchedTrades: number;
    unmatchedTrades: number;
  };
  sourceCompleteness: SourceCompleteness[];
  confidence: SessionConfidence;
  confidenceReasons: string[];
  diagnosisReadiness: DiagnosisReadiness;
};
```

## 8. Metrics by Level

Trade-level metrics:

- Open time.
- Close time.
- Asset.
- Direction.
- Entry and exit price.
- Gross PnL, fees, funding, and net PnL after fees/funding.
- Duration.
- Scale-ins and scale-outs.
- Max base size.
- Max notional exposure.
- Reversal status.
- Boundary/open status.
- Order match confidence.
- Entry source and proxy classification.

Session-level metrics:

- Total PnL.
- Fees.
- Funding.
- Trade count.
- Closed/open trade count.
- Win rate.
- Best and worst trade.
- Average hold time.
- Total time in market.
- Rapid re-entry count.
- Post-loss behavior.
- Overnight performance.
- High-density behavior.
- Day/weekend behavior.
- Asset mix.
- Direction mix.
- First and last trade result.
- Consecutive win/loss streaks.
- Fee bleed as percent of gross opportunity.
- Confidence and diagnosis readiness.

Diagnosis-level metrics:

- Repeated negative overnight sessions.
- Post-loss spirals.
- Profitable flow-state sessions.
- Time windows where the trader becomes dangerous.
- Strategy/time combinations that produce edge.
- Manual impulse versus planned execution outcomes.
- Fee bleed sessions.
- Weekend underperformance.
- Asset-specific session weakness.
- Long/short session bias.
- Rule or warning violations that precede losses.

## 9. Confidence Model

Session confidence must combine multiple dimensions. Sample size alone must never produce high confidence.

Inputs:

- Sample size: number of comparable sessions and number of closed trades.
- Data completeness: fill caps, order caps, boundary fills, open trades, invalid timestamps, duplicates.
- Source quality: Hyperliquid source completeness, native Journal quality, Session Log completeness.
- Order enrichment quality: fully matched, partially matched, unmatched.
- Boundary/open trade impact: whether incomplete positions materially affect PnL.
- Timezone validity: persisted IANA timezone required for local-day and overnight claims.
- Fee/funding reliability: whether fee semantics and funding attribution are confirmed.
- Metric-specific reliability: market/limit proxy, size-after-loss notional availability, native plan evidence, etc.

Confidence levels:

| Level | Requirements | Allowed Language |
|---|---|---|
| High confidence | Adequate sample, complete source, valid timezone, reconciled PnL/fees, order enrichment adequate for metric, no material boundary/open impact | Direct claims with numbers |
| Medium confidence | Adequate sample, minor warnings, metric not highly dependent on missing source, timezone valid for time metrics | Directional but evidence-backed claims |
| Low confidence | Thin sample, capped orders/fills, incomplete order enrichment, fee/funding uncertainty, or weak proxy metric | "Early signal" and cautious framing |
| Insufficient evidence | Missing required data, no valid timezone for time metric, too few sessions, invalid timestamps, material boundary/open impact | Do not generate diagnosis; show what is missing |

Recommended scoring model:

1. Start at `high`.
2. Downgrade for each material issue.
3. Force `insufficient_evidence` when a required input for that metric is absent.
4. Force no higher than `medium` when fee semantics are unresolved for PnL claims.
5. Force no higher than `low` for hunted/chased proxy unless market-context evidence exists.
6. Force no higher than `low` for overnight/time-window claims without persisted timezone.

## 10. Diagnosis Rules

Only session insights with adequate confidence should feed Operator Diagnosis. Low-confidence sessions can still appear in debug/evidence views, but should not create recommendations or warnings.

| Session Insight | Required Confidence | Required Sample | Allowed in Diagnosis? | Notes |
|---|---|---|---|---|
| Overnight negative expectancy | Medium minimum, high preferred | >=5 overnight sessions and >=10 closed trades | Yes, if timezone persisted | Must use trader-local 8 PM-5 AM and net after fees/funding confidence |
| Post-loss re-entry damage | Medium | >=5 post-loss re-entry events | Yes | Strong candidate for cooldown recommendations |
| High-density session damage | Medium | >=3 high-density sessions or >=15 trades in high-density sessions | Yes | Should report fees and PnL after first loss |
| Weekend performance | Medium | >=4 weekend sessions | Yes | Timezone required; otherwise no diagnosis |
| Late-night underperformance | Medium | >=5 sessions or >=10 trades in late-night bucket | Yes | Use trader-local hours, not UTC |
| Manual impulse sessions | Medium | >=5 manual trades or >=3 manual-dominant sessions | Yes | Imported baseline needs order/source confidence; native evidence stronger |
| Planned execution sessions | Medium | >=5 planned trades or >=3 planned sessions | Yes | Can feed positive diagnosis if net positive |
| Asset-specific sessions | Medium | >=5 sessions or >=10 trades for asset | Yes | Avoid hard claims for one-off assets |
| Long/short bias sessions | Medium | >=10 closed trades across comparable sessions | Yes | Better with notional exposure than trade count |
| Fee bleed sessions | Medium | >=5 sessions and fee semantics confirmed | Yes | Must separate fee total from PnL ambiguity |
| Chased/hunted proxy sessions | Low/medium depending evidence | >=10 trades per proxy bucket | Directional only by default | Do not hard-diagnose without market-context enrichment |
| Fatigue-risk sessions | Medium | >=3 fatigue-tagged negative sessions | Yes, cautiously | Requires at least two fatigue signals per session |
| Flow-state sessions | High preferred | >=3 positive controlled sessions | Yes as positive behavior | Should be conservative; avoid fake certainty |

## 11. User-Facing Insight Examples

Good future Portal phrasing:

- "Your overnight sessions are negative expectancy. Across 9 overnight sessions, you lost $1,240 net after fees. 71% of the losses came after the first losing trade."
- "Your post-loss re-entries are the leak. You re-entered within 15 minutes of a loss 14 times; those trades lost $680 net."
- "High-density sessions are where fees start eating the edge. In 5 high-density sessions, you paid $112 in fees and finished -$840 net."
- "Manual market sessions underperformed planned sessions by $73 per trade. The worst losses came when manual entries followed a losing close."
- "Your best sessions are controlled and boring: 3 to 4 trades, no rapid re-entry, average hold under 2 hours, +$410 net."
- "Weekend sessions are not paying you. 6 weekend sessions, 18 trades, -$520 net, 39% win rate."
- "Long-biased sessions are the problem in this sample: 11 long sessions lost $336 net while short-biased sessions were slightly positive."
- "The 8 PM to 5 AM window is not just noisy; it is where your decision quality breaks. 8 of 12 losses occurred after a first losing trade."

Avoid weak, vague phrasing:

- "You may want to be more careful trading at night."
- "Consider improving discipline."
- "Your trading could be better."
- "Maybe avoid overtrading."

Portal should sound evidence-backed, direct, and appropriately cautious. When confidence is low, the insight should say why.

## 12. Implementation Plan

### Phase 1: Time and Schema Foundation

- Persist timezone in baseline scan requests and stored baseline bundles.
- Add a shared time-bucket helper for trader-local day, hour, weekend, and overnight overlap.
- Define richer `ReconstructedSession` / `BehavioralSession` types.
- Add confidence and diagnosis-readiness enums.
- Keep UI unchanged.

### Phase 2: Session Construction Engine

- Build a standalone session construction module from reconstructed trades.
- Preserve the current trade lifecycle reconstruction behavior.
- Compute primary activity sessions with local-day and inactivity rules.
- Add overnight tags and metrics.
- Add high-density tags and metrics.
- Add rapid re-entry and post-loss cluster metrics.
- Add local-only debug output for session counts, tags, confidence, and PnL.

### Phase 3: Diagnosis Readiness and Consumers

- Add session confidence scoring.
- Add diagnosis-readiness filtering.
- Feed only allowed session insights into AI Coach and Operator Diagnosis.
- Add evidence drawer data structures so each diagnosis can cite sessions, trades, warnings, and source-quality notes.
- Keep Journal native-only and imported baseline clearly labeled as external context.

### Phase 4: Visual Redesign of Insight / Operator Intelligence

- Redesign Insight and Operator Diagnosis around session evidence.
- Move from text-heavy analytics to operator-grade behavioral intelligence.
- Add compact session cards, evidence drilldowns, and confidence labels.
- Keep chart dominance and Portal's mode-based command deck intact.

## 13. Tests Needed

Required test coverage:

- Overnight local timezone classification.
- Trade crossing midnight.
- Trade overlapping overnight by entry, exit, majority duration, and any-overlap rules.
- Local-day key differs from UTC day key.
- Rapid re-entry cluster.
- Post-loss re-entry cluster.
- Revenge-risk cluster using notional or fallback base size.
- High-density session by count.
- High-density session by average gap.
- Weekend session.
- Same-day session.
- Multi-asset session.
- Directional bias session.
- Boundary trade confidence downgrade.
- Open trade handling and `openAtSessionEnd`.
- Fee/funding aggregation.
- Duplicate fill handling.
- Invalid timestamp rejection.
- UTC/local mismatch prevention across baseline, diagnosis, warning, and Discipline helpers.
- Session PnL is not double-counted across tags or derived clusters.
- Capped order/fill source downgrades confidence.
- Imported baseline sessions do not become native Journal evidence.

## 14. Files Likely Affected Later

Likely future files/modules:

- `src/features/baseline-import/reconstruct-trades.ts`
- `src/features/baseline-import/build-baseline-profile.ts`
- `src/features/baseline-import/types.ts`
- `src/features/baseline-import/debug-output.ts`
- `src/features/baseline-import/storage.ts`
- `src/features/diagnosis/lib/operator-diagnosis.ts`
- `src/features/diagnosis/lib/diagnosis-realtime-warnings.ts`
- `src/features/ai-coach/lib/observational-coach.ts`
- `src/features/ai-coach/lib/evidence-source-mix.ts`
- `src/features/discipline/lib/discipline-time-window.ts`
- `src/features/session-log/lib/session-log.ts`
- `src/features/journal/lib/journal-insights.ts`
- `src/components/layout/app-shell.tsx`

Recommended new modules:

- `src/features/baseline-import/session-intelligence.ts`
- `src/features/baseline-import/session-confidence.ts`
- `src/features/time/portal-time.ts`
- `src/features/time/portal-time.test.ts`
- `src/features/baseline-import/session-intelligence.test.ts`

## 15. Open Questions

- Should the default timezone be browser timezone, user profile timezone, or explicit per-scan selection?
- Should historical scans allow changing timezone after save, or should timezone be immutable scan provenance?
- Should overnight PnL be assigned to the date the overnight window starts or the date it ends?
- Should the 90-minute inactivity threshold remain fixed or become configurable?
- Should high-density thresholds differ by asset, account size, or user-selected trading style?
- Should post-loss re-entry use 15 minutes, 30 minutes, or user-configured cooldown windows?
- Should revenge-risk require notional exposure, base size, margin used, or stop-distance risk?
- How should Portal handle sessions that cross both a local-day boundary and an overnight window?
- Should native Portal sessions and imported historical sessions share one session schema with different source confidence, or separate schemas with an adapter?
- What proof is required before fee-net PnL can be labeled "after fees"?
- Should Operator Diagnosis include imported baseline sessions by default, or require a separate "external context" label in every finding?
- Should session evidence eventually include chart screenshots or market structure context for hunted/chased claims?
