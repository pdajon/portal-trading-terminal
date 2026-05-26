# Current Execution Market Contract

Date: 2026-05-09

## Current Selector Markets

Portal now discovers Hyperliquid testnet perp markets dynamically from the
Hyperliquid testnet `info` endpoint using the `meta` request. The terminal
market selector shows every normalized market whose Hyperliquid universe record
is not delisted.

Manual verification on 2026-05-09 found:

| Source | Count | Selector behavior |
| --- | ---: | --- |
| Hyperliquid testnet universe records | `208` | Normalized into Portal market metadata |
| Non-delisted / enabled records | `169` | Shown in the terminal selector |
| Delisted records | `39` | Kept in metadata as disabled, hidden from selection |

BTC, ETH, and SOL remain pinned fallback markets and keep their reviewed V1
precision/safety metadata:

| UI symbol | Hyperliquid coin | Enabled in V1 UI | Quantity precision | V1 testnet max base size |
| --- | --- | --- | --- | --- |
| `BTC-USD` | `BTC` | Yes | `5` | `0.01` |
| `ETH-USD` | `ETH` | Yes | `4` | `0.25` |
| `SOL-USD` | `SOL` | Yes | `2` | `5` |

If live metadata cannot be fetched, Portal degrades to the pinned BTC/ETH/SOL
fallback list and marks the `/api/market-metadata` response as fallback through
headers.

## Market Resolution

The shared market contract lives in `src/lib/markets/hyperliquid-market-registry.ts`.

It owns:

- Portal UI symbol, for example `ETH-USD`
- Hyperliquid bridge coin, for example `ETH`
- base and quote asset display metadata
- price and quantity precision
- UI selector enablement
- V1 testnet safety limit metadata

The resolver accepts common operator inputs such as `BTC`, `BTC-USD`, and `BTC/USDC`, normalizes them to Portal's `*-USD` symbol convention, and returns either a market record or `null`. Unsupported markets reject before exchange bridge execution.

Dynamic markets are normalized from Hyperliquid universe records with:

- `name` as Hyperliquid coin
- uppercased alphanumeric base asset
- `*-USD` Portal symbol and `*-USDC` display ticker
- Hyperliquid asset index as `assetId`
- `szDecimals` as size/quantity precision when available
- `maxLeverage` when available
- `enabled: false` when `isDelisted: true`

## Routes Using The Shared Resolver

These routes now resolve market coin metadata through the shared registry instead of their own BTC-only map:

| Route / flow | Shared resolver use |
| --- | --- |
| `/api/execute` | market order execution resolves `symbol -> coin` through the registry |
| `/api/limit-order` | limit order placement resolves `symbol -> coin` through the registry |
| `/api/order-zone` | order-zone placement resolves `symbol -> coin` through the registry |
| `/api/protection` | SL/TP protection resolves active position `symbol -> coin` through the registry |
| `/api/close-position` | close-position resolves `symbol -> coin` through the registry |
| `/api/reduce-position` | reduce-position resolves `symbol -> coin` through the registry |
| `/api/reverse-position` | reverse-position resolves `symbol -> coin` through the registry |
| `/api/cancel-order` | single-order cancel resolves `symbol -> coin` through the registry |
| `/api/cancel-zone-orders` | zone-derived cancel resolves `symbol -> coin` through the registry |
| `/api/replace-order` | order replacement resolves `symbol -> coin` through the registry |
| `/api/update-zone-orders` | zone-derived order update resolves `symbol -> coin` through the registry |

Chart data helpers, account context, market stats, order book, recent trades,
and Magic Trade Open Position also route through the registry-backed market
metadata path.

## Filtering Rules

- `/api/market-metadata` returns the normalized Hyperliquid metadata list,
  including disabled/delisted records.
- The terminal selector filters to `enabled === true`, which means active
  non-delisted Hyperliquid universe records.
- The selector no longer applies a fixed display cap; search narrows the full
  enabled list.
- Asset icon availability is not a market-discovery filter. Missing local logos
  must never hide an otherwise enabled Hyperliquid market.
- Magic Trade quick chips intentionally show a compact subset of enabled
  markets. The custom symbol input can still target other discovered markets,
  and execution validates through the shared resolver.
- Invalid symbols reject cleanly; Portal must not fall back to BTC for invalid
  user-supplied market symbols.

## Asset Icon Contract

Hyperliquid testnet metadata does not provide reviewed asset logos. Portal
treats market icons as a local UI layer, not as exchange metadata and not as a
requirement for market discovery.

Reviewed local icons:

| Base asset | Local asset |
| --- | --- |
| `BTC` | `/asset-icons/btc.svg` |
| `ETH` | `/asset-icons/eth.svg` |
| `SOL` | `/asset-icons/sol.svg` |

All other dynamically discovered markets use the premium fallback token mark
from `src/lib/markets/asset-icon-resolver.ts`. Portal does not hotlink random
third-party logos and does not install a broad icon package for long-tail
markets. Add more reviewed icons intentionally by adding a local SVG, updating
`REVIEWED_LOCAL_ASSET_ICONS`, and adding resolver coverage.

## Chart vs Execution Support

- Chart-supported markets: all enabled markets returned by dynamic Hyperliquid
  metadata. Chart candles resolve `symbol -> coin` through the shared metadata
  resolver before requesting `candleSnapshot`.
- Execution-enabled markets: enabled markets that pass the shared resolver and
  V1 testnet safety checks. BTC, ETH, and SOL retain pinned safety limits.
  Other discovered markets use conservative default testnet sizing metadata and
  the global V1 notional cap.
- Live validation coverage is still deeper for BTC/ETH/SOL than for the full
  long-tail market list. Do not present every long-tail market as production
  wallet-ready or beta-grade execution.

## Remaining Intentional V1 Limitations

- Hyperliquid is still the only exchange path.
- V1 remains testnet only.
- Production wallet connection, backend persistence, and background automation are still deferred.
- TradingView Advanced Charts are still not integrated.

## Future Market Enablement

Most Hyperliquid testnet perp markets now become chart-selectable
automatically when Hyperliquid metadata exposes them as non-delisted.

For stronger execution support on a specific market:

1. Confirm the Python bridge accepts the market coin.
2. Add reviewed price precision if the default display precision is insufficient.
3. Add reviewed V1 testnet safety size metadata if the default base-size limit
   is too loose or too strict for that market.
4. Add resolver and route tests for the market-specific behavior before
   highlighting it in demo flows.

The intended path remains registry-first: routes, chart subscriptions, Magic
Trade, discipline gates, session logging, and Journal capture receive a resolved
symbol/coin contract instead of introducing feature-local market maps.
