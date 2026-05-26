# Architecture Notes

## Early structure

- `src/app` owns app entry and the top-level page shell
- `src/components` holds shared UI and layout pieces
- `src/features` holds product-facing feature areas without forcing heavy boundaries too early
- `src/lib` holds integration boundaries, config, market data, utilities, and mock data
- `src/types` is the shared home for common app types during the MVP phase

## MVP architecture decisions

- The chart-first layout is the core product frame and should remain visually dominant
- The tradable market universe is explicitly Hyperliquid-only
- Shared app types live in `src/types` until feature-local types are truly needed
- `src/lib/hyperliquid/client.ts` is only a minimal placeholder boundary for now

## Intentionally deferred

- Live execution is intentionally deferred until local planning state is stable
- The early chart integration path should remain swappable so we can upgrade later without large refactors
- Backend orchestration, websockets, and database work are not part of this milestone
- AI, discipline, social, and progression systems are intentionally kept out of the MVP scaffold

## Design principle

Prefer clear boundaries and simple modules over early abstraction. The MVP should be easy to extend later without letting future systems pollute the current build.
