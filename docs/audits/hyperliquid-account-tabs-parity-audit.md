# Hyperliquid Account Tabs Parity Audit

Date: 2026-05-15
Target route: `http://localhost:3002/terminal`

## Scope

Mirror Hyperliquid for the account/activity tabs that are not Portal-native:

- Positions
- Open Orders
- Trade History
- Funding History
- Order History
- Balances

Out of scope for parity:

- Trade
- Magic Trade

Open naming question: the request mentioned "audit history." Portal currently has `Order History`, and Hyperliquid's visible tab is `Order History`. This audit treats "audit history" as `Order History` unless a separate audit-log tab is requested.

## Reference Evidence

Live Hyperliquid web snapshot, unauthenticated/restricted view:

- Bottom tab order visible on Hyperliquid: `Balances`, `Positions`, `Outcomes`, `Open Orders`, `TWAP`, `Trade History`, `Funding History`, `Order History`.
- The visible selected table in that snapshot was `Positions`, with headers:
  `Coin`, `Size`, `Position Value`, `Entry Price`, `Mark Price`, `PNL (ROE %)`, `Liq. Price`, `Margin`, `Funding`.
- Right-side control label: `Filter`.
- Empty state: `No open positions yet`.
- Account summary below the table includes:
  `Account Equity`, `Spot`, `Perps`, `Perps Overview`, `Balance`, `Unrealized PNL`, `Cross Margin Ratio`, `Maintenance Margin`, `Cross Account Leverage`.

Official Hyperliquid API evidence:

- `clearinghouseState` is the source for perpetual account summary, open positions, and margin summary.
- `frontendOpenOrders` is the source for open orders with frontend-oriented fields.
- `userFills` / `userFillsByTime` are the sources for trade history/fills.
- `historicalOrders` is the source for recent historical orders.
- `userFunding` is the source for account funding payments.
- `spotClearinghouseState` is the source of truth for token balances under unified account / portfolio margin.
- `userTwapSliceFills` exists for TWAP slice fills; Hyperliquid also shows a `TWAP` tab.

## Current Portal Implementation

Primary files:

- `src/features/account-activity/lib/account-activity-ledger.ts`
- `src/features/account-activity/components/account-activity-panel.tsx`
- `src/app/api/account/route.ts`
- `src/app/api/live-positions/route.ts`
- `src/app/api/pending-orders/route.ts`
- `src/lib/hyperliquid/testnet_account.py`
- `src/lib/hyperliquid/testnet_live_positions.py`
- `src/lib/hyperliquid/testnet_pending_orders.py`

Portal current account tab order:

`Trade`, `Positions`, `Open Orders`, `Magic Trade`, `Trade History`, `Funding History`, `Order History`, `Balances`

Portal currently builds:

- Positions from `/api/live-positions`, backed by `Info.user_state(...)`, `Info.frontend_open_orders(...)`, and `Info.all_mids()`.
- Open Orders from local pending limit orders plus `/api/pending-orders`, backed by `Info.frontend_open_orders(...)`.
- Trade History from local `sessionLogEntries`, not from Hyperliquid `userFills`.
- Funding History from `/api/account` `fundingHistory`, backed by `Info.user_funding_history(...)`.
- Order History from open order rows plus local `sessionLogEntries`, not from Hyperliquid `historicalOrders`.
- Balances from `/api/account`, backed by `Info.spot_user_state(...)` and `Info.user_state(...)`.

## Gap Matrix

### Tab Strip

Current gap:

- Portal includes `Trade` and `Magic Trade` inside the same strip; these are custom and intentionally not Hyperliquid parity tabs.
- Portal lacks Hyperliquid's `Outcomes` tab.
- Portal lacks Hyperliquid's `TWAP` tab.
- Portal places `Balances` last; Hyperliquid places `Balances` first in the observed web snapshot.

Recommendation:

- Keep `Trade` and `Magic Trade` as Portal-native, but visually separate or clearly protect them from the parity contract.
- For the Hyperliquid-parity run, use Hyperliquid ordering for exchange-native tabs:
  `Balances`, `Positions`, `Outcomes`, `Open Orders`, `TWAP`, `Trade History`, `Funding History`, `Order History`.
- If V1 should not add `Outcomes` / `TWAP`, show them as disabled or omitted by explicit product decision, not by accident.

### Positions

Hyperliquid visible headers:

`Coin`, `Size`, `Position Value`, `Entry Price`, `Mark Price`, `PNL (ROE %)`, `Liq. Price`, `Margin`, `Funding`

Portal headers:

`Coin`, `Size`, `Position Value`, `Entry Price`, `Mark Price`, `PNL / ROE %`, `Liq. Price`, `Margin`, `Funding`, `TP/SL`, `Actions`

Gaps:

- Label mismatch: `PNL / ROE %` should be `PNL (ROE %)`.
- Portal adds `TP/SL` and `Actions` columns that are not visible in the captured Hyperliquid table.
- Empty copy mismatch: Portal says `No active positions yet`; Hyperliquid says `No open positions yet`.
- Portal hardcodes `Cross` in display detail; should use real leverage/margin mode from position data.
- Portal action text `Limit / Market / Reverse` is Portal-specific and not verified as Hyperliquid-exact.

Data/API gaps:

- Current bridge maps core position fields, but does not preserve the full raw position payload needed for exact Hyperliquid formatting and margin/leverage display.
- Current funding shown in positions is derived from cumulative position funding, not necessarily the exact displayed field semantics.

Recommendation:

- Rename `PNL / ROE %` to `PNL (ROE %)`.
- Change empty state to `No open positions yet`.
- Decide whether Portal should keep risk-management actions in-row. If yes, make them an intentional Portal overlay, not part of the Hyperliquid parity table.
- Preserve raw Hyperliquid position fields in the bridge response so table formatting can match exactly.

### Open Orders

Hyperliquid headers found from live/indexed evidence:

`Time`, `Type`, `Coin`, `Direction`, `Size`, `Original Size`, `Order Value`, `Price`, `Reduce Only`, `Trigger Conditions`, `TP/SL`

Portal headers:

`Time`, `Type`, `Coin`, `Direction`, `Size`, `Original Size`, `Order Value`, `Price`, `Reduce Only`, `Trigger Conditions`, `TP/SL`, `Actions`

Gaps:

- Portal adds an `Actions` column. Hyperliquid actions exist, but the exact presentation needs connected-account verification.
- Portal has a market filter with options like `All Markets`, `Current Market`, `Long Orders`, `Short Orders`, `Reduce Only`, `Trigger Orders`, `TP/SL Orders`; Hyperliquid visible control is simply `Filter`.
- Portal merges local pending orders with exchange live orders; Hyperliquid should be exchange source of truth.

Data/API gaps:

- Portal already uses `frontendOpenOrders`, which is the right source.
- Need to preserve `isPositionTpsl`, `isTrigger`, `orderType`, `origSz`, `sz`, `side`, `timestamp`, `triggerCondition`, `triggerPx`, `reduceOnly`, `oid`, and any `children` exactly.

Recommendation:

- Keep `frontendOpenOrders` as source of truth.
- Match Hyperliquid table columns first; add cancel/edit controls in the exact action affordance style after connected-account verification.
- Replace Portal-specific filter options with a Hyperliquid-style `Filter` control unless user approves Portal-enhanced filtering.

### Trade History

Expected Hyperliquid source:

- `userFills` / `userFillsByTime`
- Fields include fill direction (`dir` such as `Open Long`), side, price, size, fee, closed PnL, order id, hash, time, and crossing/builder metadata depending on response.

Portal headers:

`Time`, `Coin`, `Direction`, `Price`, `Size`, `Trade Value`, `Fee`, `Closed PNL`

Gaps:

- Portal currently uses local `sessionLogEntries`, not Hyperliquid fills.
- Portal fee is hardcoded as `-- USDC`.
- Portal order id / fill id is local, not Hyperliquid `oid` / fill hash.
- Portal has an `Aggregate` toggle, but the current ledger does not actually rebuild from Hyperliquid aggregate-by-time fills.

Recommendation:

- Add an exchange-backed trade-history route using `userFills` and `userFillsByTime`.
- Support `aggregateByTime` through the actual Hyperliquid request body.
- Keep local session log as Portal-native context only, not as the parity table source.

### Funding History

Expected Hyperliquid source:

- `userFunding` for user funding payments.
- `fundingHistory` is market-level historical funding rates, not user payment history.

Portal headers:

`Time`, `Coin`, `Size`, `Position Side`, `Payment`, `Rate`

Gaps:

- Source is mostly correct through `Info.user_funding_history(...)`.
- Portal falls back to live position funding if no history exists. That is useful but not Hyperliquid-exact.
- Filter behavior is not implemented beyond a button shell.

Recommendation:

- Use only `userFunding` rows for the Hyperliquid parity table.
- If no account funding history exists, use Hyperliquid-style empty state rather than live-position fallback.
- Keep live funding accumulator in a separate Portal detail surface if needed.

### Order History

Expected Hyperliquid source:

- `historicalOrders`, up to 2000 recent historical orders.
- `orderStatus` for exact status lookup by oid/cloid when needed.

Portal headers:

`Time`, `Type`, `Coin`, `Direction`, `Size`, `Filled Size`, `Order Value`, `Price`, `Reduce Only`, `Trigger Conditions`, `TP/SL`, `Status`, `Order ID`

Gaps:

- Portal builds order history from currently open rows plus local session logs.
- It does not use `historicalOrders`.
- Statuses are Portal-normalized (`Open`, `Filled`, `Canceled`) and miss Hyperliquid's richer status/reject/cancel reasons.

Recommendation:

- Add an exchange-backed order-history route using `historicalOrders`.
- Use `orderStatus` to hydrate exact status/reason when the raw historical order response is insufficient.
- Stop synthesizing order history from session logs for the parity tab.

### Balances

Expected Hyperliquid sources:

- `spotClearinghouseState` for token balances and unified-account trading balance.
- `clearinghouseState` for perps/cross account summary where applicable.

Portal headers:

`Coin`, `Total Balance`, `Available Balance`, `USDC Value`, `PNL (ROE %)`, `Send`, `Transfer`, `Repay`, `Contract`

Gaps:

- Portal balance rows are partly fabricated for jurisdiction-safe copy (`Not available in your jurisdiction`, `Transfer to Spot`).
- Hyperliquid's visible account-summary area is not a simple balances-only table; it also shows account equity and perps overview below the bottom tabs.
- Portal currently places `Balances` as a table tab only, not the full Hyperliquid balance/account overview experience.

Recommendation:

- Separate `Balances` table rows from account overview metrics.
- Use `spotClearinghouseState` as source of truth for token rows.
- Use `clearinghouseState` for perps overview metrics.
- Do not fabricate unavailable actions in the parity surface; either wire the actual action or disable it with exact reason copy.

## API Work Required

New or revised server routes:

- `GET /api/hyperliquid/fills`
  - source: `userFills` / `userFillsByTime`
  - supports `aggregateByTime`, `startTime`, `endTime`, `coin`

- `GET /api/hyperliquid/order-history`
  - source: `historicalOrders`
  - optional detail hydration from `orderStatus`

- `GET /api/hyperliquid/account-tabs`
  - combined read model for:
    - `clearinghouseState`
    - `spotClearinghouseState`
    - `frontendOpenOrders`
    - `userFunding`
    - `historicalOrders`
    - `userFills`

Existing routes to refactor:

- `/api/account`
- `/api/live-positions`
- `/api/pending-orders`

The refactor should preserve current testnet safety rules and not affect trade execution routes.

## Recommended V1 Build Plan

1. Create pure mappers for Hyperliquid account tab rows.
   - Input is raw API payloads.
   - Output is table rows with exact labels and stable empty states.

2. Add exchange-backed read routes.
   - No trading behavior changes.
   - Keep caching short and explicit.
   - Fail with visible table error states, not silent local fallbacks.

3. Replace data source for parity tabs.
   - Positions: `clearinghouseState` / current live-position bridge, with fuller raw field preservation.
   - Open Orders: `frontendOpenOrders`.
   - Trade History: `userFills`.
   - Funding History: `userFunding`.
   - Order History: `historicalOrders`.
   - Balances: `spotClearinghouseState` plus perps account summary.

4. Align labels and empty states.
   - Do this before visual polish.
   - Avoid redesigning the footer or chart.

5. Verify against Hyperliquid.
   - Browser compare unauthenticated labels.
   - Testnet wallet compare connected account rows.
   - Confirm no trade execution route changed.

## Product Decision Needed

The phrase "1:1 mirror" can mean either:

- Recommended: exact Hyperliquid tab labels, row fields, data sources, filters, empty states, and actions, rendered with Portal's premium dark-glass visual system.
- Literal clone: match Hyperliquid's visual styling as closely as possible inside Portal.

The second path conflicts with Portal's brand instructions unless explicitly approved. The recommended path preserves Portal identity while making the exchange-native account tabs functionally and semantically Hyperliquid-exact.

