# Portal Performance Audit

Date: 2026-05-03
Scope: `/terminal` runtime, chart data, live rail state, and supporting API/data paths.

## Summary

This pass focused on the two user-visible latency failures: charts getting stuck on `Chart unavailable`, and the live-position rail appearing late after confirmed fills.

The fix makes the chart and rail optimistic where the exchange has already given Portal enough proof, while keeping exchange state as the final source of truth. UI changes were intentionally minimal: no new dashboards, no shell redesign, no extra persistent panels.

## Before

- Chart REST snapshots could take 1s+ before the WebSocket was allowed to connect.
- `/api/account` was repeatedly observed around 3.2s to 4.5s, and this local run also exposed connection-reset cases that left older bridge requests hanging for many minutes.
- `/api/live-positions` fresh/cache-miss calls were commonly around 2.5s+.
- Chart cache keys were too specific for default requests, so near-identical chart requests often missed cache.
- `Chart unavailable` could show after the REST snapshot failed even if live WebSocket data was still viable.
- Post-fill rail display waited for slower exchange refresh/account work instead of using the confirmed execution response immediately.

## Implemented

- `minimal-price-chart.tsx`
  - Starts the Hyperliquid WebSocket immediately, in parallel with `/api/chart`.
  - Keeps last-good candles by `symbol + timeframe` so asset switching does not blank the chart unnecessarily.
  - Treats `Chart unavailable` as final only after both snapshot and live WebSocket paths fail.
  - Seeds a live-price fallback candle when realtime data arrives before the snapshot.
  - Replaces the hardcoded loading label with active-asset copy such as `Loading ETH chart`.

- `src/app/api/chart/route.ts`
  - Buckets default chart `to` timestamps into stable 10s windows so default requests share cache/in-flight work.
  - Preserves explicit `from`/`to` behavior for replay and historical requests.
  - Adds stale-if-error behavior using latest known good candles.
  - Adds `X-Portal-Chart-Cache: hit | miss | stale | bypass`.

- `src/components/layout/app-shell.tsx`
  - Builds an immediate confirmed local `LiveExchangePosition` after confirmed market fills and instant limit/order-zone fills.
  - Marks synthetic rail positions with `syncStatus: "confirmed-execution"`.
  - Preserves confirmed positions during the short exchange reconciliation grace window, then lets exchange snapshots replace them.
  - Clears the confirmed-execution grace state on close, full reduce, reverse, and close-all so synthetic rails cannot reappear after flattening.
  - Splits post-mutation refresh into critical live state first, account refresh second.
  - Removes account refresh from the active live-position polling path.
  - Coalesces duplicate non-fresh account reads instead of queueing extra account bridge calls.
  - Adds backoff-aware background polling for account, live-position, and pending-order reads.
  - Keeps critical post-mutation refreshes immediate while still recording failures for later background backoff.
  - Moves account polling to a lower-priority cadence: 60s while visible, 5 minutes while hidden.

- Read-only live-state APIs
  - `/api/live-positions?fresh=1`, `/api/pending-orders?fresh=1`, and `/api/account?fresh=1` bypass route caches.
  - Read-only Python bridge routes now have an 8s timeout to prevent hung exchange calls from tying up the terminal runtime indefinitely.
  - `/api/account`, `/api/live-positions`, and `/api/pending-orders` now return `X-Portal-Route-Duration-Ms` and `X-Portal-Bridge-Duration-Ms`.
  - Bridge timeout responses include `X-Portal-Bridge-Timed-Out: 1`.
  - If a timed-out bridge already printed valid JSON to stdout, the route now salvages that payload instead of returning a generic `502`.

## After

Local verification on `http://localhost:3002/terminal`:

- `HEAD /terminal`: `200 OK`.
- Browser render: title `Portal | Execution-first crypto trading`.
- Browser DOM: `Chart unavailable` absent after reload.
- Browser console: 0 error logs.
- Asset switching check: BTC -> ETH -> SOL -> BTC completed without permanent `Chart unavailable`.
- Existing live-position rail: visible for the current BTC testnet position.
- During final restart, several Hyperliquid testnet bridge calls hit the new timeout and returned `502` in roughly 8s to 9s instead of hanging for many minutes. Subsequent live-state refreshes recovered.

Measured API timings from the final local run:

- `/api/chart?symbol=BTC-USD&interval=1m`: first request `1664ms`, `X-Portal-Chart-Cache: miss`.
- Same chart request immediately after: `8ms`, `X-Portal-Chart-Cache: hit`.
- `/api/live-positions?fresh=1`: `2278ms`, `X-Portal-Live-Positions-Cache: bypass`, `X-Portal-Bridge-Duration-Ms: 2270`.
- `/api/pending-orders?fresh=1`: `1399ms`, `X-Portal-Pending-Orders-Cache: bypass`, `X-Portal-Bridge-Duration-Ms: 1392`.
- `/api/account?symbol=BTC-USD&fresh=1`: `3453ms`, `X-Portal-Account-Cache: bypass`, `X-Portal-Bridge-Duration-Ms: 3445`.

Live order validation was not run in this pass because the testnet account already had an open BTC position and no pending orders. Placing and then cleaning up another test order would have risked altering or closing pre-existing testnet state.

## Remaining Slow Paths

- Fresh account/live-position/pending-order reads still depend on Python bridge startup and Hyperliquid network calls. They are bounded now, but still slow on true misses.
- Mutating actions still use Python bridge scripts. They should remain exchange-backed, but future work should profile each bridge and consider shared bridge process/client reuse.
- Hyperliquid testnet connection resets still happen. The UI now backs off noisy background reads after repeated failures, but backend retry policy could be improved.
- The TradingView datafeed path still has its own snapshot/WebSocket flow. The active minimal chart path is hardened; TradingView should get the same stale/cache/realtime treatment if it becomes primary again.

## Deferred Improvements

- Explore a long-lived server-side Hyperliquid read bridge for account/live/pending state to avoid repeated Python interpreter startup.
- Profile each mutating bridge script and keep the refactor bounded around confirmed bottlenecks.
- Add route-level timing to mutating bridge actions if their measured latency becomes user-visible.
