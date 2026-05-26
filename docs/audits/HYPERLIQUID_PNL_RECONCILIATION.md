# Hyperliquid PNL Reconciliation

Generated: 2026-05-25

## Summary

Portal and Hyperliquid are currently showing different metrics.

For wallet `0x36fF15F480BDbAF92B868B54BB0B9484e82E4b8a`, mainnet:

| Surface | Range / source | Value |
| --- | --- | ---: |
| Hyperliquid 30D screen reference | Portfolio `perpMonth` graph | `-$203.317897` |
| Portal Historical Baseline | Reconstructed in-range closed trades | `+$61.70060178` |
| Raw Hyperliquid fills in Portal range | Sum of all fill `closedPnl` rows | `-$200.12036472` |

Root cause: Portal's Historical Baseline is not an account-level 30D PNL metric. It reconstructs closed position lifecycles from fills and excludes boundary fills from positions opened before the selected range. In this scan, one excluded boundary close was an XPL close at `2026-04-28T07:16:34.766Z` with `closedPnl = -260.82386`. That single excluded pre-range-position close is enough to flip Portal from roughly Hyperliquid-negative to positive.

## Audit Artifacts

- Debug JSON: `.portal/audits/hyperliquid-pnl-reconciliation-latest.json`
- Script: `scripts/write-hyperliquid-pnl-reconciliation-audit.ts`
- UI copy changed from `Net after fees` to `Reconstructed closed-trade net`.

## Date Range Alignment

Portal selected scan range:

- Start: `2026-04-25T00:00:00.000Z`
- End: `2026-05-24T23:59:59.999Z`
- Stored timezone: `America/Chicago`
- Boundary semantics: UTC inclusive day boundaries from the date inputs.

Hyperliquid portfolio graph returned:

- `perpMonth` first sample: `2026-04-24T23:30:00.025Z`
- `perpMonth` latest sample: `2026-05-25T04:33:00.017Z`
- `perpMonth` latest PNL: `-203.317897`

This is close to the same human-facing 30D period, but it is not the same exact window. Portal uses date-input UTC days. Hyperliquid's 30D portfolio graph is rolling and sampled.

## Metric Definitions

Hyperliquid portfolio PNL:

- Account-value based.
- Includes account value changes, and account value includes unrealized PNL from cross and isolated margin positions.
- Adjusts for deposits and withdrawals.
- The graph is sampled, so it is not precise accounting.
- Source: [Hyperliquid Portfolio graphs](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-graphs)

Portal Historical Baseline:

- Fill based.
- Reconstructs position lifecycles from `userFillsByTime`.
- Uses closed reconstructed trades only for the headline metric.
- Formula: `sum(reconstructed closed trade executionClosedPnl) + attributed funding`.
- Excludes open trades at range end.
- Excludes boundary fills from positions opened before the selected range.
- Shows funding and ledger rows as context, not account-level PNL.
- Fetches orders for enrichment, but `historicalOrders` is capped at the latest 2,000 rows.
- Source API references: [Hyperliquid Info endpoint](https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/info-endpoint), [Entry price and PNL](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/entry-price-and-pnl)

## Findings

Portal is not missing the main fill source for this selected range: `userFillsByTime` returned 51 fills, well below the 2,000 response cap. But Portal is intentionally excluding at least one fill from recommendation-grade reconstructed trades because the position existed before the selected range.

The mismatch is mostly explained by boundary/open-position semantics, not by a simple fee bug:

- Portal reconstructed closed-trade net: `+61.70060178`
- Raw fill `closedPnl` sum in the same Portal range: `-200.12036472`
- Hyperliquid `perpMonth` PNL: `-203.317897`
- Excluded boundary close: `-260.82386`
- Closed-trade fees tracked separately: `57.432341`
- Funding rows: 184, funding sum: `0`
- Ledger rows: 8, ledger net flow: `0`
- Current account value snapshot: `333.730495`
- Current open position snapshot: no open positions at audit runtime

So the Portal number is not the Hyperliquid 30D PNL. It is a reconstructed closed-trade lifecycle metric after dropping boundary positions. Calling it `Net after fees` was unsafe.

## Answered Questions

**Why does Portal show +$61.70 while Hyperliquid shows about -$203.32?**

Portal excluded a large in-range close from a position opened before the Portal scan window. Hyperliquid's portfolio PNL includes the account impact; Portal's reconstructed lifecycle metric does not.

**Are they measuring different things?**

Yes. Hyperliquid is account-level portfolio PNL. Portal was showing reconstructed in-range closed-trade PNL.

**Is Portal missing fills?**

Not obviously for this scan. The fill count is below the cap. The issue is exclusion/classification, especially boundary positions.

**Is Portal excluding boundary/open-position PNL?**

Yes. One boundary fill was excluded, and one reconstructed trade was open at the selected range end.

**Is Portal handling fees/funding incorrectly?**

The audit did not prove a fee arithmetic bug as the main cause. But the label was unsafe because Portal does not independently reconcile whether `closedPnl` is fee-inclusive across every fill shape. Fees should stay visible as a separate line until fully reconciled.

**Is Portal using the wrong range/timezone?**

The ranges are not identical. Portal uses UTC inclusive date boundaries. Hyperliquid's 30D graph is rolling/sampled. This matters, but it is secondary to the boundary close exclusion in this case.

**Is Hyperliquid showing account-level PNL while Portal shows reconstructed closed-trade PNL?**

Yes.

## Recommendation

Portal should display `Reconstructed closed-trade net` for the current metric.

Do not present it as account-level 30D PNL. For users, the safer model is:

- `Hyperliquid 30D account PNL`: portfolio graph / account-level context.
- `Reconstructed closed-trade net`: Portal's fill-reconstructed lifecycle context.
- `Excluded boundary PNL`: visible warning when boundary fills exist.
- `Open-position PNL excluded`: visible warning when open reconstructed trades exist at range end.

Before Insight or Operator Intelligence trusts profitability claims, Portal should add an account-level reconciliation layer that compares portfolio `perpMonth`/`month`, raw fill closedPnl, reconstructed closed-trade PNL, excluded boundary fills, open positions, fees, funding, and ledger rows side by side.
