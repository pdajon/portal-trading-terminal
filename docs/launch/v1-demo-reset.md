# Portal V1 Demo Reset

Use this before a clean Portal V1 demo or launch-readiness review.

## Local And Testnet Reset

Run from the Portal app checkout:

```bash
npm run demo:reset -- --base-url http://localhost:3002 --strict-exchange
```

This reset is intentionally narrow:

- writes neutral file-backed Discipline state to `.portal/discipline-state.json`
- clears the simulated Override Bond ledger at `.portal/override-bond-ledger.json`
- backs up the previous local state under `.portal/demo-reset-backups/`
- removes orphan `.tmp` Discipline state files
- calls local testnet cleanup APIs when `--base-url` is provided
- verifies final `livePositions` and `pendingOrders` are empty when `--strict-exchange` is provided

If the dev server is not running, use the local-only form:

```bash
npm run demo:reset -- --local-only
```

## Browser Storage Reset

The app also stores demo surface state in browser storage. After the server is running, open:

```text
http://localhost:3002/portal-demo-reset.html
```

That same-origin reset page clears Portal browser storage and redirects back to `/terminal`.

If the reset page is unavailable, run this once in the browser console from the open `/terminal` tab:

```js
for (const key of [
  "portal.chart-levels",
  "portal.chart-line-triggers",
  "portal.chart-trend-lines",
  "portal.chart-zones",
  "portal.active-position",
  "portal.active-trade-plan",
  "portal.pending-limit-orders",
  "portal.min-rr",
  "portal.discipline-rules",
  "portal.discipline-tracking",
  "portal.session-log",
  "portal.journal",
  "portal.journal.memoryEvents",
  "portal.journal-setup-tags",
  "portal.journal-settings",
  "portal.baseline-import",
  "portal.tag-along-rules",
  "portal.tag-along-execution-records",
]) localStorage.removeItem(key);
for (const key of ["portal.footer-tab"]) sessionStorage.removeItem(key);
location.reload();
```

This clears optional Journal demo data, stale Session Logs, stale AI warning memory events, saved Magic Trade rules, and footer tab state. Imported baseline bundles remain separate from native Journal data by design, but this demo reset clears the saved browser bundle so the review starts clean.

## Expected Neutral State

- Discipline state is unlocked and all v1 rules are inactive.
- Override Bond ledger is `[]`.
- Journal and Session Logs can start empty unless the demo intentionally seeds examples.
- AI Coach warnings should be absent unless generated during the demo; any warning shown after reset is newly derived from current demo actions.
- `/api/live-positions?fresh=1` returns `positions: []`.
- `/api/pending-orders?fresh=1` returns `pendingOrders: []`.
- `/terminal` renders without stuck loading states or console errors.
