# Full History Upload Context Source

Generated: 2026-05-25

## Product Decision

Historical Baseline / Context Source ingestion is upload-first.

Wallet-address API scans are deprecated as a normal user-facing "full history" path because Hyperliquid API history can be capped. A capped recent scan can look complete while silently missing older behavior, which makes session reconstruction, PnL attribution, behavioral sequencing, and Operator Intelligence less trustworthy.

## User-Facing Flow

1. Add Context Source.
2. Choose Hyperliquid.
3. Portal shows export instructions.
4. User uploads Hyperliquid history files.
5. Portal validates row count, date range, detected columns, missing fields, duplicate rows, unsupported rows, and source quality.
6. User confirms import.
7. Portal builds reconstructed trades, session intelligence, supporting context, native/imported comparison, and source quality/confidence.

The normal flow no longer asks the user to scan a wallet address.

## Hyperliquid Exports

Portal asks the user to export:

- Trade History CSV.
- Funding History CSV.
- Deposits/Withdrawals CSV, if available.

Portal copy explains: "These files allow Portal to build a more complete behavioral baseline than the capped API scan."

## Supported Formats

- CSV.
- JSON.

JSON can be a single array of rows or an object containing arrays named `fills`, `trades`, `tradeHistory`, `funding`, `fundingHistory`, `ledger`, or `ledgerUpdates`.

## Supported Columns

Trade/fill rows support these column families:

- Time: `time`, `timestamp`, `date`, `datetime`, `createdAt`.
- Market: `coin`, `asset`, `symbol`, `market`.
- Side/direction: `side`, `directionSide`, `dir`, `direction`, `tradeDirection`.
- Price: `px`, `price`, `fillPrice`.
- Size: `sz`, `size`, `quantity`, `qty`.
- Fees: `fee`, `fees`, `feeUsd`, `feeToken`, `feeCurrency`, `feeAsset`.
- PnL: `closedPnl`, `closedPnlUsd`, `realizedPnl`, `pnl`.
- IDs: `oid`, `orderId`, `orderID`, `tid`, `tradeId`, `tradeID`, `fillId`, `hash`.
- Position context: `startPosition`, `startPos`, `start_position`.

Funding rows support:

- `time`, `timestamp`, `date`, `datetime`, `createdAt`.
- `coin`, `asset`, `symbol`, `market`.
- `delta`, `amount`, `funding`, `fundingDelta`, `fundingPayment`.

Deposits/withdrawals rows support:

- `time`, `timestamp`, `date`, `datetime`, `createdAt`.
- `type`, `kind`, `category`, `action`.
- `delta`, `amount`, `netAmount`.
- `token`, `currency`, `asset`, `hash`.

## Source Quality Rules

Uploaded files are validated for:

- Uploaded file names and detected columns.
- Total, accepted, rejected, duplicate, and unsupported rows.
- Detected date range.
- Missing trade, funding, and deposits/withdrawals coverage.
- Reconstruction counts.
- Session-intelligence confidence and readiness.

Even when the upload is high-confidence, Portal marks it as `directional_only`. Imported history remains:

- Imported Historical Baseline.
- Directional context.
- Not native Journal evidence.
- Not diagnosis-grade by default.

## Wallet API Scan Status

Wallet API scans may remain for development, troubleshooting, recent API parity checks, and audit scripts. If surfaced, the copy must say:

- Recent API Scan.
- Not full history.
- Not recommended for serious baseline analysis.

## Debug Artifact

The local audit script writes:

`.portal/audits/manual-history-import-latest.json`

It includes uploaded files, row counts, detected columns, accepted/rejected rows, warnings, reconstructed trade/session counts, and confidence/readiness distribution.

Run:

```bash
npm run audit:manual-history-import -- --file path/to/trade-history.csv --file path/to/funding-history.csv
```

If no files are passed, the script writes a small sample artifact so the debug schema stays inspectable.
