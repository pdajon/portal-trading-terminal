# Magic Trade Signal Market Planning

Portal V1 keeps Magic Trade signal markets tied to Hyperliquid perp metadata plus a small anchor set in the composer.

Future Magic Trade should support chart-only signal/index markets such as:

- TOTAL
- TOTAL2
- TOTAL3
- OTHERS

These should be treated as IF/signal markets, not execution markets by default. They may require a separate market-data source outside Hyperliquid metadata and should resolve through a separate chart-only signal registry before becoming available in Magic Trade.
