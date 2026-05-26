# Index Candle Provider

Portal index / trigger charts are chart-only sources. They can arm Magic Trade
triggers when live candle data is available, but they are never execution
markets.

## CoinGecko V1

The first real provider is CoinGecko, enabled with `COINGECKO_API_KEY`.
`COINGECKO_API_BASE_URL` can override the API base URL for tests or private
proxies. Requests are cached and rate-limited in-process.

CoinGecko global market-cap history is used for `TOTAL`. Coin market-cap
history is used to derive the remaining symbols:

- `TOTAL = total crypto market cap`
- `TOTAL2 = TOTAL - BTC market cap`
- `TOTAL3 = TOTAL - BTC market cap - ETH market cap`
- `OTHERS = TOTAL - BTC market cap - ETH market cap - USDT market cap`
- `BTC.D = BTC market cap / TOTAL * 100`
- `ETH.D = ETH market cap / TOTAL * 100`
- `USDT.D = USDT market cap / TOTAL * 100`

`OTHERS` is not treated as a TradingView-native top-assets exclusion in this
provider. CoinGecko V1 uses the explicit formula above until a provider with a
native `OTHERS` series is connected.

CoinGecko V1 exposes real sampled market-cap candles for `1h` and `1d`.
Lower chart intervals return `unsupported-timeframe`; they do not return mock
or synthetic production candles.
