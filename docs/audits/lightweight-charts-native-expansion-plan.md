# Portal Native Lightweight Charts Expansion Plan

Date: 2026-05-16

## Decision

Portal will keep the main terminal chart on the native `lightweight-charts` layer and expand it as a Portal-owned chart cockpit. TradingView Advanced Charts remains out of scope until TradingView grants access.

This path preserves Portal's core product shape:

- The chart remains sacred and dominant.
- Execution, protection, discipline, Magic Trade, and Journal overlays stay first-party.
- Advanced chart data is reachable through layer controls, drawers, panes, and detail states instead of being jammed into the default screen.
- Glow stays earned by active, armed, live, selected, warning, or AI/system-intelligence states.

## Current Native Chart Layer

Portal already uses TradingView Lightweight Charts through `src/features/chart/components/minimal-price-chart.tsx`.

Built today:

- Candlestick chart rendering
- Hyperliquid REST candle snapshots
- Hyperliquid WebSocket/live price updates
- Last-good candle fallback
- BTC/ETH/SOL and dynamically discovered chart symbols
- 1m, 5m, and 15m timeframes
- Active/live position lines
- Entry, stop, target, and R:R trade plan overlays
- Manual horizontal levels
- Zones and no-trade zones
- Pending order and execution markers
- Magic Trade source overlays
- Journal chart snapshot capture

Upgraded in this pass:

- `lightweight-charts` package upgraded to `5.2.0`
- Explicit right-side default price scale
- Hovered series rendered on top
- Price-scale edge tick marks and lower-density tick labels
- Conservative data conflation enabled for zoomed-out performance
- Crosshair configured to ignore hidden-series indices

## Expansion Phases

### Phase 1: Chart Control Surface

Add a compact chart layer/settings control without changing the default shell layout.

Recommended scope:

- Layer visibility toggles for positions, trade plan, levels, zones, Magic Trade, execution markers, Journal markers, and indicators
- Compact OHLC/current candle readout
- Crosshair data tooltip that stays lightweight and non-obstructive
- Range shortcuts such as session, 1D, 3D, 1W, and all available
- Chart snapshot export using the native screenshot API with top-layer primitives included

### Phase 2: Market Context Panes

Use Lightweight Charts multi-pane support where it adds real trading value.

Recommended scope:

- Optional volume pane when candle volume is available or a reliable volume proxy exists
- Funding or open-interest context pane if the data path is stable
- Pane sizing presets that keep price action dominant
- Persistent per-symbol pane visibility

### Phase 3: Indicator Toolkit

Add first-party indicators as controlled Portal layers, not a giant indicator marketplace.

Recommended V1 indicators:

- EMA/SMA
- VWAP or session VWAP when data supports it
- ATR
- RSI
- MACD

Rules:

- Indicators default off.
- Each indicator must be removable.
- Indicator settings live behind progressive disclosure.
- No Pine Script parity claim.

### Phase 4: Drawing Tools

Finish the Portal-native drawing layer before chasing broad tool parity.

Recommended scope:

- Re-enable and harden trendline drawing
- Add horizontal and vertical rays
- Add measurement / price-range tool
- Add Fibonacci retracement only if it can be implemented as a clean custom primitive
- Add an object list for hiding/removing chart objects

### Phase 5: Reliability And Browser Proof

Every chart expansion should ship with route-level proof.

Required checks:

- `npm test` or targeted chart tests
- `npx tsc --noEmit`
- `npm run build`
- Restart dev server on port 3002
- Verify `http://localhost:3002/terminal`
- Confirm chart canvases mount and browser console has no errors

## Explicit Non-Goals

These are Advanced Charts expectations, not Lightweight Charts promises:

- Pine Script support
- TradingView user accounts, layouts, or cloud sync
- TradingView's full drawing toolbar
- TradingView's full indicator library
- Broker/trading platform integration through TradingView widgets
- Full TradingView UI parity

Portal can still become professional-grade on Lightweight Charts, but the product should frame it as a native Portal chart cockpit rather than "TradingView inside Portal."

## Execution Status

Implemented on 2026-05-16:

- Upgraded `lightweight-charts` to `5.2.0`.
- Added the compact native chart control surface: OHLC readout, crosshair readout, range shortcuts, layer toggles, and native snapshot export.
- Added persistent layer visibility for Portal overlays.
- Preserved candle volume through `/api/chart` and WebSocket normalization.
- Added optional native volume pane through Lightweight Charts multi-pane support.
- Added tested first-party indicator math for EMA, SMA, VWAP, ATR, RSI, and MACD.
- Wired EMA 20, EMA 50, VWAP, RSI, ATR, and MACD as optional chart layers/panes, default off.
- Re-enabled the existing Portal-native trendline drawing path behind the Drawings layer.
- Continued the native drawing-tool pass with vertical rays, compact measurement labels, and validated local persistence for chart drawing objects.
- Added compact drawing object management so chart drawings can be selected, hidden as a layer group, or removed from the chart surface.
- Added native Fibonacci retracement drawings with persisted storage, chart rendering, and object-list management.
- Added per-object drawing controls for rename, hide/show, and lock/unlock with persisted metadata.
- Added a cached native market-context route and optional Funding / Open Interest chart context layers. Funding uses documented historical funding rates; Open Interest uses current/live-session asset context without pretending historical OI exists.
- Added compact Funding / Open Interest chart readouts plus quiet loading, empty, and offline states for the market-context route.
- Added chart layer presets for Execution, Clean, Trend, Context, and All states, with per-symbol/timeframe persistence preserved through the existing layer storage.
- Added a compact active-stack summary and widened Layers / Objects drawers so chart tooling is easier to scan without adding default chart clutter.
- Started the Hyperliquid chart chrome parity pass:
  - Added a tested native chart chrome option map for the top interval strip, inline symbol/timeframe title, and Lightweight Charts-supported style selector.
  - Expanded Portal chart intervals through the native `/api/chart` path to include `1h` and `1d` alongside `1m`, `5m`, and `15m`.
  - Added the first chart-top toolbar slice: Hyperliquid-style `5m / 1h / D` controls, more-interval dropdown, chart style selector, and Indicators entrypoint.
  - Wired Lightweight Charts-native display styles for Candles, Bars, Line, Area, and Baseline while preserving Portal overlays on the primary price scale.
  - Added the compact left drawing toolbar rail with cursor, trendline, vertical ray, measure, Fibonacci, zone, trade-plan, and object-manager entrypoints.
  - Added bottom-right chart utility controls for local time / UTC offset, percentage scale, log scale, and autoscale refit/toggle.
  - Added a compact chart settings drawer for grid, crosshair, price-axis, and volume-pane display preferences.
  - Made the Indicators entrypoint useful with a compact native indicator drawer for volume, EMA, VWAP, RSI, MACD, ATR, funding, and open interest.
  - Tightened the Layers drawer into grouped Core, Studies, Context, Drawings, and Automation sections with active-stack counts and an active-only filter, keeping the default chart surface unchanged.
  - Expanded the bottom range strip toward Hyperliquid parity with `5y / 1y / 6m / 3m / 1m / 5d / 1d` controls and a compact calendar button for Session / All ranges.
  - Tightened the bottom-right price-axis utility cluster with a tested Scale Normal / Percent / Log status readout and a compact Axis settings entrypoint with active setting count.
  - Completed a chart chrome cleanup/audit pass for spacing and accessibility labels across interval, indicator, range, layers, snapshot, and axis controls.

Still intentionally staged:

- More advanced drawing organization, such as folders or multi-select actions, should wait until the drawing workflow proves it needs them.
- Full historical Open Interest requires a stable historical OI data path, likely separate from the lightweight API route.
- Quick-symbol / chart search is intentionally skipped for now because Portal already has a market selector and duplicating that control would add chart chrome without enough navigation value.
- The next Hyperliquid parity slice should stay evidence-led: only add more chart chrome when browser proof or a trader workflow shows a specific gap.
