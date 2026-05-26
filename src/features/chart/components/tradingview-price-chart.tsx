"use client";

import { timeframeToResolution } from "@/features/chart/lib/tradingview/hyperliquid-datafeed";
import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";
import { getHyperliquidChartCoin } from "@/features/chart/lib/hyperliquid-chart-symbols";
import type { HyperliquidSymbol } from "@/types/market";
import { useEffect, useRef, useState } from "react";

const HYPERLIQUID_TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws";

type PriceCandle = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: number;
};

type WsCandleEntry = {
  c: number | string;
  h: number | string;
  l: number | string;
  o: number | string;
  t: number;
};

type WsCandleMessage = {
  channel: "candle";
  data: WsCandleEntry | WsCandleEntry[];
};

type WsActiveAssetCtxMessage = {
  channel: "activeAssetCtx";
  data: {
    ctx: {
      markPx: number | string;
    };
  };
};

type TradingViewPriceChartProps = {
  onCandleClose: (closePrice: number, candleTime: number, timeframe: ChartTimeframe) => void;
  onCurrentPriceChange: (price: number) => void;
  symbol: HyperliquidSymbol;
  timeframe: ChartTimeframe;
};

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

function normalizeCandle(entry: WsCandleEntry): PriceCandle | null {
  const close = Number(entry.c);
  const high = Number(entry.h);
  const low = Number(entry.l);
  const open = Number(entry.o);
  const time = Number(entry.t);

  if (![close, high, low, open, time].every(Number.isFinite)) {
    return null;
  }

  return {
    close,
    high,
    low,
    open,
    time: Math.floor(time / 1000),
  };
}

function getTradingViewSymbol(symbol: HyperliquidSymbol) {
  if (symbol === "ETH-USD") {
    return "BITSTAMP:ETHUSD";
  }

  if (symbol === "SOL-USD") {
    return "BINANCE:SOLUSDT";
  }

  return "BITSTAMP:BTCUSD";
}

function getTradingViewIframeSrc(symbol: HyperliquidSymbol, timeframe: ChartTimeframe) {
  const params = new URLSearchParams({
    interval: timeframeToResolution(timeframe),
    locale: "en",
    symbol: getTradingViewSymbol(symbol),
    theme: "dark",
    toolbarbg: "#09101a",
  });

  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

export function TradingViewPriceChart({
  onCandleClose,
  onCurrentPriceChange,
  symbol,
  timeframe,
}: TradingViewPriceChartProps) {
  const onCandleCloseRef = useRef(onCandleClose);
  const onCurrentPriceChangeRef = useRef(onCurrentPriceChange);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onCandleCloseRef.current = onCandleClose;
  }, [onCandleClose]);

  useEffect(() => {
    onCurrentPriceChangeRef.current = onCurrentPriceChange;
  }, [onCurrentPriceChange]);

  useEffect(() => {
    setStatus("loading");
    setErrorMessage(null);
  }, [symbol, timeframe]);

  useEffect(() => {
    let cancelled = false;
    let websocket: WebSocket | null = null;
    let lastClosedCandleTime: number | null = null;
    let lastOpenCandle: PriceCandle | null = null;
    const hyperliquidCoin = getHyperliquidChartCoin(symbol);

    async function loadSnapshot() {
      const response = await fetch(
        `/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Chart data request failed with ${response.status}`);
      }

      const candles = (await response.json()) as PriceCandle[];
      const latestCandle = candles.at(-1) ?? null;
      const latestClosedCandle = candles.length > 1 ? candles[candles.length - 2] : null;

      if (latestCandle) {
        onCurrentPriceChangeRef.current(latestCandle.close);
        lastOpenCandle = latestCandle;
      }

      if (latestClosedCandle) {
        lastClosedCandleTime = latestClosedCandle.time;
      }
    }

    function connectWebSocket() {
      if (!hyperliquidCoin) {
        setStatus("error");
        setErrorMessage(`No Hyperliquid data path configured for ${symbol}`);
        return;
      }

      websocket = new WebSocket(HYPERLIQUID_TESTNET_WS_URL);

      websocket.addEventListener("open", () => {
        websocket?.send(
          JSON.stringify({
            method: "subscribe",
            subscription: {
              coin: hyperliquidCoin,
              interval: timeframe,
              type: "candle",
            },
          }),
        );
        websocket?.send(
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
        if (cancelled) {
          return;
        }

        const payload = JSON.parse(String(event.data)) as unknown;

        if (isWsCandleMessage(payload)) {
          const entries = Array.isArray(payload.data) ? payload.data : [payload.data];

          for (const entry of entries) {
            const candle = normalizeCandle(entry);

            if (!candle) {
              continue;
            }

            if (lastOpenCandle && candle.time > lastOpenCandle.time) {
              if (lastClosedCandleTime !== lastOpenCandle.time) {
                onCandleCloseRef.current(lastOpenCandle.close, lastOpenCandle.time, timeframe);
                lastClosedCandleTime = lastOpenCandle.time;
              }
            }

            lastOpenCandle = candle;
            onCurrentPriceChangeRef.current(candle.close);
          }

          return;
        }

        if (isWsActiveAssetCtxMessage(payload)) {
          const livePrice = Number(payload.data.ctx.markPx);

          if (Number.isFinite(livePrice)) {
            onCurrentPriceChangeRef.current(livePrice);
          }
        }
      });
    }

    void loadSnapshot().catch(() => {
      // The chart surface itself should keep rendering even if Hyperliquid snapshot retries.
    });
    connectWebSocket();

    return () => {
      cancelled = true;
      websocket?.close();
    };
  }, [symbol, timeframe]);

  return (
    <div className="relative h-full min-h-0">
      <iframe
        key={`${symbol}-${timeframe}`}
        className="h-full w-full border-0"
        onError={() => {
          setStatus("error");
          setErrorMessage("Unable to load TradingView chart");
        }}
        onLoad={() => {
          setStatus("ready");
        }}
        src={getTradingViewIframeSrc(symbol, timeframe)}
        title="Portal TradingView Chart"
      />
      {status !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(9,16,26,0.72)]">
          <div className="rounded-full border border-white/10 bg-[rgba(7,11,18,0.9)] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-300">
            {status === "error" ? errorMessage ?? "TradingView unavailable" : "Loading chart"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
