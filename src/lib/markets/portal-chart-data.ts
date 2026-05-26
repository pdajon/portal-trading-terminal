import {
  getTradingViewSymbolForPortalMarket,
  isIndexTriggerMarketSymbol,
} from "@/lib/markets/portal-market-registry";

export type PortalChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type PortalChartInterval = "1m" | "5m" | "15m" | "1h" | "1d";

export type PortalChartDataProvider =
  | {
      kind: "hyperliquid";
    }
  | {
      kind: "tradingview-compatible-index";
      tradingViewSymbol: string;
    };

export function resolvePortalChartDataProvider(
  symbol: string | null | undefined,
): PortalChartDataProvider {
  if (isIndexTriggerMarketSymbol(symbol)) {
    const tradingViewSymbol = getTradingViewSymbolForPortalMarket(symbol);

    if (tradingViewSymbol) {
      return {
        kind: "tradingview-compatible-index",
        tradingViewSymbol,
      };
    }
  }

  return { kind: "hyperliquid" };
}
