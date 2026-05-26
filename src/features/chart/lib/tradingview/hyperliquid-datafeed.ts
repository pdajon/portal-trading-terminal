"use client";

import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";
import {
  formatHyperliquidChartSymbolLabel,
  getHyperliquidChartCoin,
  isSupportedHyperliquidChartSymbol,
} from "@/features/chart/lib/hyperliquid-chart-symbols";

const HYPERLIQUID_TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws";
const SUPPORTED_RESOLUTIONS = ["1", "5", "15", "60", "1D"] as const;
const DEFAULT_SYMBOL = "BTC-USD";

type SupportedResolution = (typeof SUPPORTED_RESOLUTIONS)[number];

type TradingViewLibrarySymbolInfo = {
  data_status: "streaming";
  description: string;
  exchange: string;
  format: "price";
  has_intraday: boolean;
  has_no_volume: boolean;
  minmov: number;
  name: string;
  pricescale: number;
  session: string;
  supported_resolutions: readonly string[];
  ticker: string;
  timezone: string;
  type: string;
  volume_precision: number;
};

type TradingViewHistoryMetadata = {
  nextTime?: number;
  noData?: boolean;
};

type TradingViewBar = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: number;
};

type TradingViewPeriodParams = {
  countBack: number;
  firstDataRequest: boolean;
  from: number;
  to: number;
};

type TradingViewDatafeedConfiguration = {
  exchanges: Array<{
    desc: string;
    name: string;
    value: string;
  }>;
  supported_resolutions: readonly string[];
  supports_group_request: boolean;
  supports_marks: boolean;
  supports_search: boolean;
  supports_time: boolean;
  supports_timescale_marks: boolean;
  symbols_types: Array<{
    name: string;
    value: string;
  }>;
};

type TradingViewDatafeed = {
  getBars: (
    symbolInfo: TradingViewLibrarySymbolInfo,
    resolution: string,
    periodParams: TradingViewPeriodParams,
    onHistoryCallback: (bars: TradingViewBar[], meta: TradingViewHistoryMetadata) => void,
    onErrorCallback: (error: string) => void,
  ) => void;
  onReady: (callback: (configuration: TradingViewDatafeedConfiguration) => void) => void;
  resolveSymbol: (
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: TradingViewLibrarySymbolInfo) => void,
    onResolveErrorCallback: (reason: string) => void,
  ) => void;
  searchSymbols?: (
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: (symbols: Array<Record<string, string>>) => void,
  ) => void;
  subscribeBars: (
    symbolInfo: TradingViewLibrarySymbolInfo,
    resolution: string,
    onRealtimeCallback: (bar: TradingViewBar) => void,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void,
  ) => void;
  unsubscribeBars: (subscriberUID: string) => void;
};

type ChartApiCandle = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: number;
};

type WsCandleMessage = {
  channel: "candle";
  data:
    | WsCandleEntry
    | WsCandleEntry[];
};

type WsCandleEntry = {
  T: number;
  c: number | string;
  h: number | string;
  i: string;
  l: number | string;
  o: number | string;
  s: string;
  t: number;
};

type WsActiveAssetCtxMessage = {
  channel: "activeAssetCtx";
  data: {
    ctx: {
      markPx: number | string;
    };
  };
};

type RealtimeSubscription = {
  interval: ChartTimeframe;
  lastBar: TradingViewBar | null;
  onRealtimeCallback: (bar: TradingViewBar) => void;
  onResetCacheNeededCallback: () => void;
  symbol: string;
  websocket: WebSocket | null;
};

type HyperliquidTradingViewDatafeedOptions = {
  onCandleClose: (closePrice: number, candleTime: number, timeframe: ChartTimeframe) => void;
  onCurrentPriceChange: (price: number) => void;
  symbol: string;
};

function isSupportedResolution(resolution: string): resolution is SupportedResolution {
  return SUPPORTED_RESOLUTIONS.includes(resolution as SupportedResolution);
}

function resolutionToTimeframe(resolution: string): ChartTimeframe {
  if (resolution === "5") {
    return "5m";
  }

  if (resolution === "15") {
    return "15m";
  }

  if (resolution === "60") {
    return "1h";
  }

  if (resolution === "1D") {
    return "1d";
  }

  return "1m";
}

function timeframeToResolution(timeframe: ChartTimeframe): SupportedResolution {
  if (timeframe === "5m") {
    return "5";
  }

  if (timeframe === "15m") {
    return "15";
  }

  if (timeframe === "1h") {
    return "60";
  }

  if (timeframe === "1d") {
    return "1D";
  }

  return "1";
}

function normalizeSymbol(symbol: string) {
  return symbol.toUpperCase().replace("/", "-");
}

function normalizeBar(candle: ChartApiCandle): TradingViewBar {
  return {
    close: candle.close,
    high: candle.high,
    low: candle.low,
    open: candle.open,
    time: candle.time * 1000,
  };
}

function normalizeWsBar(candle: WsCandleEntry): TradingViewBar | null {
  const close = Number(candle.c);
  const high = Number(candle.h);
  const low = Number(candle.l);
  const open = Number(candle.o);
  const time = Number(candle.t);

  if (![close, high, low, open, time].every(Number.isFinite)) {
    return null;
  }

  return {
    close,
    high,
    low,
    open,
    time,
  };
}

function isWsCandleMessage(payload: unknown): payload is WsCandleMessage {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "channel" in payload &&
    payload.channel === "candle" &&
    "data" in payload
  );
}

function isWsActiveAssetCtxMessage(payload: unknown): payload is WsActiveAssetCtxMessage {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "channel" in payload &&
    payload.channel === "activeAssetCtx" &&
    "data" in payload
  );
}

export function createHyperliquidTradingViewDatafeed({
  onCandleClose,
  onCurrentPriceChange,
  symbol,
}: HyperliquidTradingViewDatafeedOptions): TradingViewDatafeed {
  const lastBars = new Map<string, TradingViewBar>();
  const subscriptions = new Map<string, RealtimeSubscription>();
  const normalizedSymbol = normalizeSymbol(symbol || DEFAULT_SYMBOL);

  function getCacheKey(nextSymbol: string, timeframe: ChartTimeframe) {
    return `${normalizeSymbol(nextSymbol)}:${timeframe}`;
  }

  async function fetchBars(nextSymbol: string, timeframe: ChartTimeframe, from: number, to: number) {
    const response = await fetch(
      `/api/chart?symbol=${encodeURIComponent(nextSymbol)}&interval=${encodeURIComponent(timeframe)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Chart data request failed with ${response.status}`);
    }

    const candles = (await response.json()) as ChartApiCandle[];
    return candles.map(normalizeBar);
  }

  return {
    onReady(callback) {
      window.setTimeout(() => {
        callback({
          exchanges: [
            {
              desc: "Hyperliquid Testnet",
              name: "Hyperliquid",
              value: "Hyperliquid",
            },
          ],
          supported_resolutions: SUPPORTED_RESOLUTIONS,
          supports_group_request: false,
          supports_marks: false,
          supports_search: false,
          supports_time: true,
          supports_timescale_marks: false,
          symbols_types: [
            {
              name: "crypto",
              value: "crypto",
            },
          ],
        });
      }, 0);
    },

    resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
      const nextSymbol = normalizeSymbol(symbolName);

      if (nextSymbol !== normalizedSymbol || !isSupportedHyperliquidChartSymbol(nextSymbol)) {
        onResolveErrorCallback(`Unsupported symbol: ${symbolName}`);
        return;
      }

      window.setTimeout(() => {
        onSymbolResolvedCallback({
          data_status: "streaming",
          description: formatHyperliquidChartSymbolLabel(nextSymbol),
          exchange: "Hyperliquid",
          format: "price",
          has_intraday: true,
          has_no_volume: true,
          minmov: 1,
          name: normalizedSymbol,
          pricescale: 100,
          session: "24x7",
          supported_resolutions: SUPPORTED_RESOLUTIONS,
          ticker: normalizedSymbol,
          timezone: "Etc/UTC",
          type: "crypto",
          volume_precision: 4,
        });
      }, 0);
    },

    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
      if (!isSupportedResolution(resolution)) {
        onErrorCallback(`Unsupported resolution: ${resolution}`);
        return;
      }

      const timeframe = resolutionToTimeframe(resolution);

      try {
        const bars = await fetchBars(
          symbolInfo.ticker || normalizedSymbol,
          timeframe,
          periodParams.from,
          periodParams.to,
        );

        if (bars.length === 0) {
          onHistoryCallback([], { noData: true });
          return;
        }

        lastBars.set(getCacheKey(symbolInfo.ticker || normalizedSymbol, timeframe), bars[bars.length - 1]);
        onHistoryCallback(bars, { noData: false });
      } catch (error) {
        onErrorCallback(error instanceof Error ? error.message : "Unable to load chart data");
      }
    },

    subscribeBars(
      symbolInfo,
      resolution,
      onRealtimeCallback,
      subscriberUID,
      onResetCacheNeededCallback,
    ) {
      if (!isSupportedResolution(resolution)) {
        return;
      }

      const timeframe = resolutionToTimeframe(resolution);
      const subscriptionSymbol = symbolInfo.ticker || normalizedSymbol;
      const hyperliquidCoin = getHyperliquidChartCoin(subscriptionSymbol);

      if (!hyperliquidCoin) {
        onResetCacheNeededCallback();
        return;
      }

      const subscription: RealtimeSubscription = {
        interval: timeframe,
        lastBar: lastBars.get(getCacheKey(symbolInfo.ticker || normalizedSymbol, timeframe)) ?? null,
        onRealtimeCallback,
        onResetCacheNeededCallback,
        symbol: subscriptionSymbol,
        websocket: null,
      };

      const websocket = new WebSocket(HYPERLIQUID_TESTNET_WS_URL);
      subscription.websocket = websocket;
      subscriptions.set(subscriberUID, subscription);

      websocket.addEventListener("open", () => {
        websocket.send(
          JSON.stringify({
            method: "subscribe",
            subscription: {
              coin: hyperliquidCoin,
              interval: timeframe,
              type: "candle",
            },
          }),
        );
        websocket.send(
          JSON.stringify({
            method: "subscribe",
            subscription: {
              coin: hyperliquidCoin,
              type: "activeAssetCtx",
            },
          }),
        );
      });

      websocket.addEventListener("message", (event) => {
        const activeSubscription = subscriptions.get(subscriberUID);

        if (!activeSubscription) {
          return;
        }

        const payload = JSON.parse(String(event.data)) as unknown;

        if (isWsCandleMessage(payload)) {
          const entries = Array.isArray(payload.data) ? payload.data : [payload.data];

          for (const entry of entries) {
            const nextBar = normalizeWsBar(entry);

            if (!nextBar) {
              continue;
            }

            const previousBar = activeSubscription.lastBar;

            if (previousBar && nextBar.time > previousBar.time) {
              onCandleClose(previousBar.close, Math.floor(previousBar.time / 1000), timeframe);
            }

            activeSubscription.lastBar = nextBar;
            lastBars.set(getCacheKey(activeSubscription.symbol, timeframe), nextBar);
            onCurrentPriceChange(nextBar.close);
            activeSubscription.onRealtimeCallback(nextBar);
          }

          return;
        }

        if (isWsActiveAssetCtxMessage(payload)) {
          const livePrice = Number(payload.data.ctx.markPx);

          if (Number.isFinite(livePrice)) {
            onCurrentPriceChange(livePrice);
          }
        }
      });

      websocket.addEventListener("error", () => {
        const activeSubscription = subscriptions.get(subscriberUID);
        activeSubscription?.onResetCacheNeededCallback();
      });

      websocket.addEventListener("close", () => {
        subscriptions.delete(subscriberUID);
      });
    },

    unsubscribeBars(subscriberUID) {
      const subscription = subscriptions.get(subscriberUID);

      if (!subscription) {
        return;
      }

      subscription.websocket?.close();
      subscriptions.delete(subscriberUID);
    },

    searchSymbols(_userInput, _exchange, _symbolType, onResultReadyCallback) {
      onResultReadyCallback([]);
    },
  };
}

export { timeframeToResolution };
