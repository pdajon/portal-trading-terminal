# Portal V1 Known Limitations

Portal V1 is ready for clean demo and launch-readiness review with these boundaries stated up front.

## Trading And Settlement

- Portal V1 is testnet only.
- Override Bond uses local simulated accounting only.
- No real USDC Override Bond settlement exists yet.
- The confirmation token is a v1 first-party execution-safety flag, not a cryptographic token yet.

## Persistence

- Discipline and Override Bond state are local file-backed state in `.portal/`.
- Browser demo state uses local storage and session storage.
- There is no production database or cross-device persistence layer in V1.
- Imported baseline trades remain separate from native Journal entries.

## Market Data And Charting

- Hyperliquid is the only exchange path in V1.
- TradingView Advanced Charts are not integrated yet.
- The current chart layer remains the V1 chart implementation.

## Deferred Product Layers

- No Hyperliquid leaderboard benchmark layer exists yet.
- No Smart Objects exist yet.
- No external AI system is connected in V1.
- Operator Diagnosis is deterministic/local and review-first.

## Demo Framing

Use the V1 demo as a proof of the core loop: execution, protection, automation, discipline, warnings, journaling, and diagnosis. Do not present V1 as production-money settlement, external AI, leaderboard scoring, or full TradingView parity.
