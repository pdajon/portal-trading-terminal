export type ChartStatus =
  | "loading"
  | "ready"
  | "provider-missing"
  | "provider-limited"
  | "unsupported-timeframe"
  | "fetch-failed"
  | "no-data";

export function getChartStatusLabel({
  baseAsset,
  status,
}: {
  baseAsset: string;
  status: ChartStatus;
}) {
  if (status === "loading") {
    return {
      detail: null,
      title: `Loading ${baseAsset} chart`,
    };
  }

  if (status === "provider-missing") {
    return {
      detail:
        "This chart is registered for Magic Trade triggers, but needs a live index candle provider before candles can render.",
      title: "Index data source not connected yet.",
    };
  }

  if (status === "unsupported-timeframe") {
    return {
      detail:
        "CoinGecko index data is live only on supported index timeframes. Switch to 1h or 1d to render real candles.",
      title: "Index timeframe not supported",
    };
  }

  if (status === "provider-limited") {
    return {
      detail:
        "TOTAL and dominance candles require CoinGecko global market-cap history. Connect an API plan or provider with that endpoint before signal candles can render.",
      title: "CoinGecko index history unavailable",
    };
  }

  if (status === "no-data") {
    return {
      detail: null,
      title: "No chart data returned",
    };
  }

  return {
    detail: null,
    title: "Chart unavailable",
  };
}
