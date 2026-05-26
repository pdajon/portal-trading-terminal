# Portal Insight Legitimacy Validation

Date: 2026-05-22  
Route: `http://localhost:3002/terminal`  
Wallet: `0x36fF15F480BDbAF92B868B54BB0B9484e82E4b8a`  
Primary scan range: `2026-02-21T00:00:00.000Z` to `2026-05-22T23:59:59.999Z`  
Mode: read-only Hyperliquid mainnet validation

## Verdict

Portal's existing insight pipeline is working and useful, but the result is not yet fully trustable without surfacing data-quality warnings more clearly.

The scanner collected real Hyperliquid data, reconstructed trades, generated concrete AI Coach baseline cards, and kept the source labeled as `Historical Baseline`. The strongest product issue is that the requested 90-day range hits Hyperliquid result caps, so the system must avoid implying the profile is complete. A smaller UI wizard scan rendered correctly in AI Coach, and cleanup returned the browser to no saved baseline source.

## Validation Results

| Area | Result | Evidence |
| --- | --- | --- |
| Test suite | Pass | `npm test` completed with `610` passing, `0` failing. |
| Address/environment | Pass | Address validated as Hyperliquid format; scan used `mainnet`. |
| Collection | Pass with warnings | 2,000 fills, 2,000 historical orders, 250 funding records, 15 ledger updates, account snapshot present. |
| Reconstruction | Pass with warnings | 46 reconstructed trades, 44 closed, 1 open, 1 reversed fragment, 19 sessions, 154 matched orders. |
| Insight generation | Pass | AI Coach produced historical performance, direction, asset, proxy, behavior, timing, and comparison cards. |
| UI presentation | Pass for default UI scan | Saved source rendered as `Historical Baseline`, `Hyperliquid`, `mainnet`; AI Coach cards updated from empty state. |
| Journal boundary | Pass | UI copy preserved: `Historical context only. Portal Journal stays native.` No imported rows were shown as native Journal entries during this pass. |
| Cleanup | Pass via reset page | `http://localhost:3002/portal-demo-reset.html` cleared the saved baseline source; AI Coach returned to `+ Add Source` and empty baseline cards. |
| Browser console | Pass | No browser `error`, `warning`, or `warn` logs were captured after UI proof and cleanup. |

## Primary 90-Day Scan

Raw collection:

- Fills fetched: `2000`
- Historical orders fetched: `2000`
- Funding records fetched: `250`
- Ledger updates fetched: `15`
- Account snapshot: present

Reconstruction:

- Reconstructed trades: `46`
- Closed trades: `44`
- Open trades: `1`
- Reversed fragments: `1`
- Sessions: `19`
- Matched order count: `154`

Data-quality warnings:

- `fill-cap-hit`: `userFillsByTime` returned 2,000 fills; range may be truncated.
- `order-cap-hit`: `historicalOrders` returned 2,000 orders; enrichment may be truncated.
- `requested-range-may-exceed-recent-fill-window`: requested range may omit older fills.
- `inferred-only-classifications`: some execution mode or entry-style proxy classifications rely on fill-only inference.

## Produced Insights

Historical performance:

- Total trades: `46`
- Closed trades: `45`
- Win rate: `46.67%`
- Net PnL: `+$1,014.13`
- Gross fees: `$676.50`
- Average hold: `446.11 minutes`

Behavior and structure:

- Best asset by average PnL: `XPL`, 19 trades, avg `+$47.90`
- Worst asset by average PnL: `HYPE`, 26 trades, avg `+$4.00`
- Short side: 28 trades, avg `+$31.68`
- Long side: 17 trades, avg `+$7.48`
- Market entries: 44 trades, avg `-$2.94`
- Entry proxy: 44 `likely-chased`, 1 `unknown`; proxy is correctly labeled as proxy-only.
- Size-after-loss: 4 flagged events from 24 post-loss comparisons.
- Session pressure: 3 high-density sessions, 18 short-gap trades.
- Best timing bucket: `afternoon`, avg `+$213.03`.
- Best hold bucket: `1-4h`, avg `+$281.78`.

AI Coach card output from the 90-day profile:

- `Historical Performance`: Insight Available.
- `Long vs Short Bias`: Insight Available, favors short-side performance.
- `Assets`: Insight Available, XPL strongest and HYPE weakest among reconstructed assets.
- `Entry Proxy`: Not Enough Data, because proxy evidence is thin/unknown-skewed.
- `Behavior Signals`: Warning, size-after-loss and overtrading pressure detected.
- `Timing`: Insight Available.
- `Before Portal / In Portal`: Not Enough Data because there were no native Portal Journal trades in this validation context.

## UI Proof

Because the 90-day date entry reset during browser automation, the UI wizard proof used the wizard's default mainnet range, `2026-04-23` to `2026-05-22`, for presentation only. The authoritative data-legitimacy pass is the 90-day scan above.

Default UI wizard scan:

- Fills: `290`
- Matched orders: `57`
- Reconstructed trades: `29`
- Win rate: `30%`
- Net PnL: `-$90.85`
- Gross fees: `$45.88`
- Execution summary: short `15`, long `12`; market `22`, limit `4`, unknown `1`
- Proxy summary: likely chased `22`, likely hunted `4`, unavailable `1`
- Data-quality warnings: unmatched fills, inferred classifications, historical order cap reached.

Screenshots:

- `output/validation/insight-source-modal-mainnet.png`
- `output/validation/ai-coach-source-cards-mainnet-wide.png`

## Issues Found

1. The 90-day date range did not complete through the browser wizard during automation. After setting `2026-02-21` to `2026-05-22`, the date inputs reset blank and the Next button disabled. This should be retested manually and fixed if reproducible.
2. The default 30-day wizard save worked, but the `Delete Baseline` button did not remove the source during automation. Cleanup succeeded through `portal-demo-reset.html`. This should be manually checked as a likely UI action bug.
3. The 90-day insight itself is useful, but capped raw data means the UI should make truncation harder to miss. The cards are readable, but users could over-trust the baseline if they do not open the full profile warnings.

## Recommendation

Keep the current insight system, but add a small audit/quality layer before treating it as legitimate trader intelligence:

- Show a compact `Data quality` state on the AI Coach source orb when fill/order caps are hit.
- Surface `partial scan` or `capped history` inside baseline-powered AI Coach cards, not only inside the profile modal.
- Fix or verify the date-range wizard reset and baseline deletion behavior.
- Keep the current source labeling model: `Historical Baseline`, `Hyperliquid`, `mainnet`, proxy-only entry labels, and native Journal separation.

