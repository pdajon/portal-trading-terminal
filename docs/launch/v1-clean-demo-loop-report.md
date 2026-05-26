# V1 Clean Demo Loop Report

Date: 2026-05-09
Route: `http://localhost:3002/terminal`

## Summary

Portal passed the clean V1 demo loop without feature-code fixes. The reset path returned local file-backed state, browser storage, and testnet-facing live/pending state to neutral. `/terminal` loaded, the chart rendered, dynamic Hyperliquid market discovery exposed a broad market list, selected markets updated the terminal, non-trade footer modes hid trade controls, Magic Trade surfaces opened, and full test/build validation passed.

One manual warning-card seed was intentionally not forced through browser storage because the in-app browser blocked `javascript:` storage mutation. Seeded AI warning behavior remains covered by deterministic tests.

## Demo Loop Checklist

| Step | Result | Notes |
|---|---:|---|
| Reset Portal demo/local state | Pass | `npm run demo:reset -- --base-url http://localhost:3002 --strict-exchange` completed. Discipline state neutral, Override Bond ledger cleared, live positions `[]`, pending orders `[]`. |
| Load `/terminal` | Pass | In-app browser landed on `http://localhost:3002/terminal`; title `Portal \| Execution-first crypto trading`. |
| Confirm chart renders | Pass | Browser saw 7 chart canvases and TradingView attribution. |
| Confirm dynamic market selector opens | Pass | Selector opened with many Hyperliquid markets; `/api/market-metadata` returned 208 markets. |
| Select BTC | Pass | UI selected `BTC-USDC 40x`; chart canvases remained mounted. |
| Select SOL | Pass | UI selected `SOL-USDC 10x`; chart canvases remained mounted. |
| Select HYPE | Pass | UI selected `HYPE-USDC 10x`; chart canvases remained mounted. |
| Select long-tail market | Pass | UI selected `DOGE-USDC 10x`; chart canvases remained mounted. |
| Confirm chart data attempts/loads | Pass | `/api/chart` returned 15m candles: BTC 2881, SOL 2881, HYPE 2879, DOGE 2881. |
| Trade mode shows trade controls | Pass | Trade mode showed order size input and `Place Market Buy`. |
| Discipline hides trade controls | Pass | Discipline mode active; no order size or market execution controls visible. |
| Journal hides trade controls | Pass | Journal mode active; empty Journal state rendered; trade controls hidden. |
| AI Coach hides trade controls | Pass | AI Coach mode active; trade controls hidden. |
| Diagnosis hides trade controls | Pass | Diagnosis mode active; trade controls hidden. |
| Session Logs hides trade controls | Pass | Session Logs mode active; trade controls hidden. |
| Settings hides trade controls | Pass | Settings mode opened from the settings control; trade controls hidden. |
| Magic Trade composer opens | Pass | `Magic Trade` opened the composer surface. |
| Armed Magic surface opens if present | Pass | `Armed Magic 0 active` was present and responsive; no armed rules existed after reset. |
| Discipline mode opens/syncs | Pass | Discipline mode showed `Status: Off`; final state file confirmed all v1 rules inactive. |
| AI Coach opens/warning cards when seeded | Partial | AI Coach opened and showed the warning area. Browser storage seeding was blocked by browser policy; deterministic tests cover seeded warnings including `market_entry_confirmation_required` and `protection_required`. |
| Journal opens | Pass | Journal opened and showed empty native state after reset. |
| Session Logs opens | Pass | Session Logs opened after reset. |
| Demo reset page/script still works | Pass | Script reset worked twice; `portal-demo-reset.html` redirected back to `/terminal`. |
| Browser console fresh errors/warnings | Pass | Fresh warning/error count after browser reset and smoke: `0`. |
| Full test/build validation | Pass | `npm test` and `npm run build` passed. |

## Fixes Made

None. No demo-breaking product bug required a code fix during this pass.

## Tests / Validation

Commands run:

```bash
curl -I --max-time 5 http://localhost:3002/terminal
npm run demo:reset -- --base-url http://localhost:3002 --strict-exchange
curl -sS --max-time 10 "http://localhost:3002/api/live-positions?fresh=1"
curl -sS --max-time 10 "http://localhost:3002/api/pending-orders?fresh=1"
curl -sS --max-time 20 "http://localhost:3002/api/chart?symbol=BTC-USD&interval=15m&fresh=1"
curl -sS --max-time 20 "http://localhost:3002/api/chart?symbol=SOL-USD&interval=15m&fresh=1"
curl -sS --max-time 20 "http://localhost:3002/api/chart?symbol=HYPE-USD&interval=15m&fresh=1"
curl -sS --max-time 20 "http://localhost:3002/api/chart?symbol=DOGE-USD&interval=15m&fresh=1"
npm test
npm run build
```

Results:

- `/terminal`: `200 OK`.
- Demo reset: passed twice.
- Strict exchange verification: live positions `[]`, pending orders `[]`.
- Browser reset page: loaded and redirected back to `/terminal`.
- Market metadata: 208 markets.
- Chart API: BTC 2881 candles, SOL 2881 candles, HYPE 2879 candles, DOGE 2881 candles.
- `npm test`: 385 tests passed, 0 failed.
- `npm run build`: passed; `/terminal` built at 203 kB route size, 305 kB first-load JS.

## Console / Runtime Issues

Fresh browser console warnings/errors during the smoke: none.

Observed but not treated as a product failure:

- Direct `javascript:` URL localStorage seeding was blocked by the in-app browser security policy, so seeded AI warning cards were not forced manually in browser storage.
- The Magic Trade composer close `×` did not close during automation, but the visible `Cancel` control closed the composer successfully. This did not block the demo loop, but it is worth rechecking with a human click before a recorded demo.

## Remaining Demo Risks

- Long-tail markets can be selected and chart API data loaded for DOGE in this pass, but execution safety remains intentionally governed by existing market metadata and route-level guards.
- AI warning seeded-state UI was validated by tests, not by forced browser localStorage seeding.
- Magic Trade composer `×` close behavior may be automation-sensitive or a minor UI bug; `Cancel` works.

## Recommended Next Step

Run one human-in-the-browser rehearsal of the exact demo script using the final clean state.
