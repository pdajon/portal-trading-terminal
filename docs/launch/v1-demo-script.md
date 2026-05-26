# Portal V1 Demo Script

Core loop: Trade -> Protect -> Automate -> Discipline -> Warn -> Diagnose -> Review.

## Preflight

- Start from the reset state in `docs/launch/v1-demo-reset.md`.
- Open `http://localhost:3002/terminal`.
- Confirm live positions and pending orders are empty before the demo begins.
- Keep the framing explicit: Hyperliquid testnet, simulated Override Bond, local V1 state.

## 1. Trade

Show Trade mode with the chart dominant.

- Select the market for the demo, preferably `BTC-USD`.
- Open a market-entry flow.
- Point out the explicit sizing display: direction, leverage, USD size, available funds context, and estimated position size.
- Confirm the market entry through the V1 confirmation step.
- Confirm the Session Log records the exchange-confirmed action.

## 2. Protect

Show SL/TP protection as part of the trade lifecycle.

- Add stop loss and take profit protection.
- Confirm the protection request is exchange-backed on testnet.
- Use Break Even after entry is live.
- Confirm the chart/rail reflects the protected state.

## 3. Automate

Show Magic Trade as chart-driven automation, not a separate bot dashboard.

- Open Magic Trade.
- Create a one-shot rule from a clear chart/source condition to a target action.
- Keep the action reviewable before arming.
- Arm the rule and show that the rule has a visible, bounded state.

## 4. Discipline

Show that Portal can block risky behavior before it reaches execution.

- Enable Require Protection.
- Attempt a risk-increasing entry without protection and show the block.
- Show Blocked Time Window as a discipline rule.
- For a locked rule, open the Override Bond modal.
- State clearly that Override Bond is simulated V1 accounting, not real USDC settlement.

## 5. Warn

Show AI Coach as the real-time warning layer.

- Trigger or surface an AI Coach warning tied to the current action context.
- Point out that thin data stays cautious and V1 does not fake certainty.
- Dismiss or acknowledge the warning only after showing the reason.

## 6. Diagnose

Show Operator Diagnosis as decision-packaging, not the raw evidence layer.

- Open Operator Diagnosis.
- Show the finding summary and the evidence-backed recommendation.
- Use `Review Plan` to show the review-first Discipline Plan path.
- Do not claim unsupported recommendations are active if they are warning-only in V1.

## 7. Review

Close the loop in Journal.

- Open Journal Trade Review.
- Show plan followed/broken/unclear, setup notes, PnL context, and replay/review context if available.
- Confirm imported baseline trades are not mixed into native Journal entries.
- End by returning to Trade mode with a clean chart-first shell.
