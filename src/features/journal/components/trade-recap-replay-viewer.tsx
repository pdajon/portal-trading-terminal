"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";
import type { PriceCandle } from "@/features/chart/types";
import type { TradeDirection } from "@/types/trade";

type ReplayAvailability = "available" | "loading" | "unavailable";

type TradeRecapReplayViewerProps = {
  direction: TradeDirection | null;
  entryPrice: number | null;
  entryTimestamp: string;
  exitPrice: number | null;
  exitTimestamp: string | null;
  onAvailabilityChange?: (availability: ReplayAvailability) => void;
  realizedPnl: number | null;
  size: number | null;
  symbol: string | null;
  timeframe: ChartTimeframe;
};

type ReplayDataset = {
  candles: PriceCandle[];
  entryIndex: number;
  exitIndex: number;
  timeframe: ChartTimeframe;
};

type ReplayOverlayMarker = {
  active: boolean;
  arrowFillTone: string;
  arrowGlowTone: string;
  arrowHeadCenterY: number;
  arrowTipY: number;
  labelText: string;
  labelWidth: number;
  labelY: number;
  lineOpacity: number;
  lineTone: string;
  pinX: number;
  priceY: number;
  stemEndY: number;
  stemTone: string;
  stemTopY: number;
  textTone: string;
  fillTone: string;
};

const SVG_WIDTH = 1440;
const SVG_HEIGHT = 760;
const PLOT_PADDING = {
  top: 26,
  right: 98,
  bottom: 42,
  left: 28,
};
const PLAYBACK_INTERVAL_MS = 700;
const MARKER_LABEL_HEIGHT = 28;
const MARKER_LABEL_GAP = 12;
const MARKER_LINE_END_INSET = 6;

function getReplayCandleStyle(isUpCandle: boolean) {
  if (isUpCandle) {
    return {
      bodyFill: "#22ab94",
      bodyHighlight: "rgba(214,255,248,0.14)",
      bodyStroke: "rgba(69,219,190,0.92)",
      wickStroke: "rgba(101,234,206,0.96)",
    };
  }

  return {
    bodyFill: "#f23645",
    bodyHighlight: "rgba(255,228,232,0.12)",
    bodyStroke: "rgba(255,122,136,0.9)",
    wickStroke: "rgba(255,146,157,0.94)",
  };
}

function getTimeframeMs(timeframe: ChartTimeframe) {
  if (timeframe === "5m") {
    return 5 * 60 * 1000;
  }

  if (timeframe === "15m") {
    return 15 * 60 * 1000;
  }

  return 60 * 1000;
}

function getReplayWindow(timeframe: ChartTimeframe, entryTimestamp: string, exitTimestamp: string | null) {
  const intervalMs = getTimeframeMs(timeframe);
  const entryMs = new Date(entryTimestamp).getTime();
  const rawExitMs = exitTimestamp ? new Date(exitTimestamp).getTime() : entryMs + intervalMs;
  const exitMs = Number.isFinite(rawExitMs) ? Math.max(rawExitMs, entryMs + intervalMs) : entryMs + intervalMs;
  const contextBeforeCandles = timeframe === "15m" ? 30 : 40;
  const contextAfterCandles = timeframe === "15m" ? 10 : 15;

  return {
    endMs: exitMs + contextAfterCandles * intervalMs,
    entryMs,
    exitMs,
    startMs: Math.max(0, entryMs - contextBeforeCandles * intervalMs),
  };
}

function findNearestReplayIndex(candles: PriceCandle[], targetMs: number) {
  if (candles.length === 0) {
    return 0;
  }

  const targetSeconds = Math.floor(targetMs / 1000);
  let nearestIndex = 0;

  for (let index = 0; index < candles.length; index += 1) {
    if (candles[index].time <= targetSeconds) {
      nearestIndex = index;
      continue;
    }

    const previousCandle = candles[index - 1];
    if (!previousCandle) {
      nearestIndex = index;
      break;
    }

    nearestIndex =
      Math.abs(previousCandle.time - targetSeconds) <= Math.abs(candles[index].time - targetSeconds)
        ? index - 1
        : index;
    break;
  }

  return Math.min(candles.length - 1, Math.max(0, nearestIndex));
}

function formatReplayTimestamp(timestampSeconds: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(timestampSeconds * 1000);
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not tracked yet";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 2 : 4,
    minimumFractionDigits: value >= 1000 ? 2 : 2,
  });
}

function formatPnl(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not tracked yet";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function getEntryMarkerTone(direction: TradeDirection | null) {
  if (direction === "short") {
    return {
      fill: "rgba(251,113,133,0.92)",
      line: "rgba(251,113,133,0.68)",
      text: "#27070f",
    };
  }

  return {
    fill: "rgba(125,211,252,0.92)",
    line: "rgba(103,232,249,0.68)",
    text: "#04131a",
  };
}

function getExitMarkerTone(realizedPnl: number | null) {
  if (realizedPnl !== null && realizedPnl > 0) {
    return {
      fill: "rgba(134,239,172,0.92)",
      line: "rgba(134,239,172,0.66)",
      text: "#08210f",
    };
  }

  if (realizedPnl !== null && realizedPnl < 0) {
    return {
      fill: "rgba(254,205,211,0.94)",
      line: "rgba(251,113,133,0.66)",
      text: "#23050f",
    };
  }

  return {
    fill: "rgba(253,230,138,0.92)",
    line: "rgba(253,224,71,0.62)",
    text: "#261902",
  };
}

function getEntryArrowTone() {
  return {
    fill: "rgba(247, 249, 252, 0.98)",
    glow: "rgba(255,255,255,0.78)",
    stem: "rgba(255,255,255,0.88)",
  };
}

function getExitArrowTone() {
  return {
    fill: "rgba(255, 228, 92, 0.98)",
    glow: "rgba(255, 222, 89, 0.84)",
    stem: "rgba(255, 222, 89, 0.92)",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getReplayFrameLabel(currentIndex: number, entryIndex: number, exitIndex: number) {
  if (currentIndex === entryIndex) {
    return "Entry";
  }

  if (currentIndex === exitIndex) {
    return "Exit";
  }

  return "Replay";
}

function estimateReplayPnl(
  direction: TradeDirection | null,
  entryPrice: number | null,
  latestPrice: number | null,
  realizedPnl: number | null,
  size: number | null,
  atExit: boolean,
) {
  if (atExit && realizedPnl !== null && Number.isFinite(realizedPnl)) {
    return realizedPnl;
  }

  if (
    !direction ||
    entryPrice === null ||
    latestPrice === null ||
    size === null ||
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(latestPrice) ||
    !Number.isFinite(size)
  ) {
    return null;
  }

  return direction === "long" ? (latestPrice - entryPrice) * size : (entryPrice - latestPrice) * size;
}

export function TradeRecapReplayViewer({
  direction,
  entryPrice,
  entryTimestamp,
  exitPrice,
  exitTimestamp,
  onAvailabilityChange,
  realizedPnl,
  size,
  symbol,
  timeframe,
}: TradeRecapReplayViewerProps) {
  const [dataset, setDataset] = useState<ReplayDataset | null>(null);
  const [status, setStatus] = useState<ReplayAvailability>("loading");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadReplayCandles() {
      if (!symbol) {
        setDataset(null);
        setStatus("unavailable");
        return;
      }

      setStatus("loading");
      setDataset(null);

      try {
        const { endMs, entryMs, exitMs, startMs } = getReplayWindow(timeframe, entryTimestamp, exitTimestamp);
        const response = await fetch(
          `/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&from=${encodeURIComponent(startMs)}&to=${encodeURIComponent(endMs)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Replay candle request failed with ${response.status}`);
        }

        const candles = (await response.json()) as PriceCandle[];

        if (cancelled || candles.length === 0) {
          if (!cancelled) {
            setStatus("unavailable");
            setDataset(null);
          }
          return;
        }

        const entryIndex = findNearestReplayIndex(candles, entryMs);
        const exitIndex = findNearestReplayIndex(candles, exitMs);

        setDataset({
          candles,
          entryIndex,
          exitIndex: Math.max(entryIndex, exitIndex),
          timeframe,
        });
        setStatus("available");
      } catch (error) {
        if (!cancelled) {
          console.warn("[portal] unable to load journal replay candles", {
            entryTimestamp,
            exitTimestamp,
            symbol,
            timeframe,
            error,
          });
          setDataset(null);
          setStatus("unavailable");
        }
      }
    }

    void loadReplayCandles();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entryTimestamp, exitTimestamp, symbol, timeframe]);

  useEffect(() => {
    onAvailabilityChange?.(status);
  }, [onAvailabilityChange, status]);

  useEffect(() => {
    if (!dataset) {
      setCurrentIndex(0);
      setIsPlaying(false);
      return;
    }

    setCurrentIndex(dataset.entryIndex);
    setIsPlaying(false);
  }, [dataset]);

  useEffect(() => {
    if (!dataset || !isPlaying) {
      return;
    }

    if (currentIndex >= dataset.exitIndex) {
      setIsPlaying(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((currentValue) => {
        const nextValue = Math.min(currentValue + 1, dataset.exitIndex);
        if (nextValue >= dataset.exitIndex) {
          setIsPlaying(false);
        }
        return nextValue;
      });
    }, PLAYBACK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentIndex, dataset, isPlaying]);

  const replayView = useMemo(() => {
    if (!dataset) {
      return null;
    }

    const fullCandles = dataset.candles;
    const visibleCandles = fullCandles.slice(0, currentIndex + 1);
    const prices = fullCandles.flatMap((candle) => [candle.high, candle.low]);

    if (entryPrice !== null) {
      prices.push(entryPrice);
    }

    if (exitPrice !== null) {
      prices.push(exitPrice);
    }

    const rawMinPrice = Math.min(...prices);
    const rawMaxPrice = Math.max(...prices);
    const priceSpan = Math.max(rawMaxPrice - rawMinPrice, rawMaxPrice * 0.005, 1);
    const pricePadding = priceSpan * 0.08;
    const minPrice = rawMinPrice - pricePadding;
    const maxPrice = rawMaxPrice + pricePadding;
    const plotWidth = SVG_WIDTH - PLOT_PADDING.left - PLOT_PADDING.right;
    const plotHeight = SVG_HEIGHT - PLOT_PADDING.top - PLOT_PADDING.bottom;
    const xStep = fullCandles.length > 1 ? plotWidth / (fullCandles.length - 1) : plotWidth;
    const candleWidth = Math.max(4, Math.min(14, xStep * 0.62));
    const tickCount = Math.min(6, fullCandles.length);

    const mapX = (index: number) => PLOT_PADDING.left + index * xStep;
    const mapY = (price: number) =>
      PLOT_PADDING.top + ((maxPrice - price) / (maxPrice - minPrice || 1)) * plotHeight;

    const currentCandle = fullCandles[currentIndex] ?? null;
    const frameLabel = getReplayFrameLabel(currentIndex, dataset.entryIndex, dataset.exitIndex);
    const framePnl = estimateReplayPnl(
      direction,
      entryPrice,
      currentCandle?.close ?? null,
      realizedPnl,
      size,
      currentIndex >= dataset.exitIndex,
    );

    return {
      candleWidth,
      currentCandle,
      frameLabel,
      framePnl,
      fullCandles,
      mapX,
      mapY,
      maxPrice,
      minPrice,
      plotBottom: SVG_HEIGHT - PLOT_PADDING.bottom,
      plotHeight,
      plotLeft: PLOT_PADDING.left,
      plotRight: SVG_WIDTH - PLOT_PADDING.right,
      plotTop: PLOT_PADDING.top,
      plotWidth,
      timeEnd: fullCandles[fullCandles.length - 1]?.time ?? null,
      timeStart: fullCandles[0]?.time ?? null,
      priceTicks: Array.from({ length: 5 }, (_, index) => maxPrice - ((maxPrice - minPrice) / 4) * index),
      timeTicks: Array.from({ length: tickCount }, (_, index) => {
        if (tickCount === 1) {
          return 0;
        }

        return Math.round(((fullCandles.length - 1) * index) / (tickCount - 1));
      }),
      visibleCandles,
    };
  }, [currentIndex, dataset, direction, entryPrice, exitPrice, realizedPnl, size]);

  const entryLineY = replayView && entryPrice !== null ? replayView.mapY(entryPrice) : null;
  const exitLineY = replayView && exitPrice !== null ? replayView.mapY(exitPrice) : null;
  const showEntryMarker = Boolean(replayView && entryLineY !== null && dataset && currentIndex >= dataset.entryIndex);
  const showExitLine = Boolean(replayView && exitLineY !== null && dataset && currentIndex >= dataset.exitIndex);
  const canStepBack = Boolean(dataset && currentIndex > dataset.entryIndex);
  const canStepForward = Boolean(dataset && currentIndex < dataset.exitIndex);
  const entryTone = getEntryMarkerTone(direction);
  const exitTone = getExitMarkerTone(realizedPnl);
  const entryLabelText = `ENTRY ${direction === "short" ? "SHORT" : "LONG"} ${formatPrice(entryPrice)}`;
  const exitLabelText = `EXIT ${formatPrice(exitPrice)}`;
  const entryLabelWidth = Math.max(156, 102 + entryLabelText.length * 7.1);
  const exitLabelWidth = Math.max(126, 94 + exitLabelText.length * 7.1);
  const minMarkerLabelY = PLOT_PADDING.top + 8;
  const maxMarkerLabelY = SVG_HEIGHT - PLOT_PADDING.bottom - MARKER_LABEL_HEIGHT - 8;
  const entryLabelYBase =
    entryLineY !== null
      ? clamp(entryLineY - MARKER_LABEL_HEIGHT / 2, minMarkerLabelY, maxMarkerLabelY)
      : null;
  const exitLabelYBase =
    exitLineY !== null
      ? clamp(exitLineY - MARKER_LABEL_HEIGHT / 2, minMarkerLabelY, maxMarkerLabelY)
      : null;
  let entryLabelY = entryLabelYBase;
  let exitLabelY = exitLabelYBase;

  if (entryLabelY !== null && exitLabelY !== null && Math.abs(entryLabelY - exitLabelY) < MARKER_LABEL_HEIGHT + MARKER_LABEL_GAP) {
    const overlapOffset = (MARKER_LABEL_HEIGHT + MARKER_LABEL_GAP - Math.abs(entryLabelY - exitLabelY)) / 2;
    if (entryLabelY <= exitLabelY) {
      entryLabelY = clamp(entryLabelY - overlapOffset, minMarkerLabelY, maxMarkerLabelY);
      exitLabelY = clamp(exitLabelY + overlapOffset, minMarkerLabelY, maxMarkerLabelY);
    } else {
      entryLabelY = clamp(entryLabelY + overlapOffset, minMarkerLabelY, maxMarkerLabelY);
      exitLabelY = clamp(exitLabelY - overlapOffset, minMarkerLabelY, maxMarkerLabelY);
    }
  }

  const entryMarkerX = replayView && dataset ? replayView.mapX(dataset.entryIndex) : null;
  const exitMarkerX = replayView && dataset ? replayView.mapX(dataset.exitIndex) : null;
  const entryArrowTone = getEntryArrowTone();
  const exitArrowTone = getExitArrowTone();
  const entryCandleHighY =
    replayView && dataset ? replayView.mapY(dataset.candles[dataset.entryIndex]?.high ?? entryPrice ?? replayView.maxPrice) : null;
  const exitCandleHighY =
    replayView && dataset ? replayView.mapY(dataset.candles[dataset.exitIndex]?.high ?? exitPrice ?? replayView.maxPrice) : null;
  const entryLineStrokeOpacity = replayView && dataset && currentIndex === dataset.entryIndex ? 0.96 : 0.72;
  const exitLineStrokeOpacity = replayView && dataset && currentIndex === dataset.exitIndex ? 0.94 : 0.7;
  const overlayMarkers = useMemo(() => {
    if (!replayView || !dataset) {
      return [] as ReplayOverlayMarker[];
    }

    const markers: ReplayOverlayMarker[] = [];

    const buildArrowLayout = (candleHighY: number) => {
      const arrowTipY = clamp(candleHighY - 6, replayView.plotTop + 52, replayView.plotBottom - 22);
      const stemEndY = clamp(arrowTipY - 5, replayView.plotTop + 28, replayView.plotBottom - 26);
      const stemTopY = clamp(stemEndY - 32, replayView.plotTop + 10, replayView.plotBottom - 64);
      const arrowHeadCenterY = clamp(stemTopY - 8, replayView.plotTop + 12, replayView.plotBottom - 74);

      return {
        arrowHeadCenterY,
        arrowTipY,
        stemEndY,
        stemTopY,
      };
    };

    if (showEntryMarker && entryLineY !== null && entryLabelY !== null && entryCandleHighY !== null && entryMarkerX !== null) {
      const arrowLayout = buildArrowLayout(entryCandleHighY);
      markers.push({
        active: currentIndex === dataset.entryIndex,
        arrowFillTone: entryArrowTone.fill,
        arrowGlowTone: entryArrowTone.glow,
        arrowHeadCenterY: arrowLayout.arrowHeadCenterY,
        arrowTipY: arrowLayout.arrowTipY,
        fillTone: entryTone.fill,
        labelText: entryLabelText,
        labelWidth: entryLabelWidth,
        labelY: entryLabelY,
        lineOpacity: entryLineStrokeOpacity,
        lineTone: entryTone.line,
        pinX: clamp(entryMarkerX, replayView.plotLeft, replayView.plotRight),
        priceY: clamp(entryLineY, replayView.plotTop, replayView.plotBottom),
        stemEndY: arrowLayout.stemEndY,
        stemTone: entryArrowTone.stem,
        stemTopY: arrowLayout.stemTopY,
        textTone: entryTone.text,
      });
    }

    if (showExitLine && exitLineY !== null && exitLabelY !== null && exitCandleHighY !== null && exitMarkerX !== null) {
      const arrowLayout = buildArrowLayout(exitCandleHighY);
      markers.push({
        active: currentIndex === dataset.exitIndex,
        arrowFillTone: exitArrowTone.fill,
        arrowGlowTone: exitArrowTone.glow,
        arrowHeadCenterY: arrowLayout.arrowHeadCenterY,
        arrowTipY: arrowLayout.arrowTipY,
        fillTone: exitTone.fill,
        labelText: exitLabelText,
        labelWidth: exitLabelWidth,
        labelY: exitLabelY,
        lineOpacity: exitLineStrokeOpacity,
        lineTone: exitTone.line,
        pinX: clamp(exitMarkerX, replayView.plotLeft, replayView.plotRight),
        priceY: clamp(exitLineY, replayView.plotTop, replayView.plotBottom),
        stemEndY: arrowLayout.stemEndY,
        stemTone: exitArrowTone.stem,
        stemTopY: arrowLayout.stemTopY,
        textTone: exitTone.text,
      });
    }

    return markers;
  }, [
    currentIndex,
    dataset,
    entryArrowTone.fill,
    entryArrowTone.glow,
    entryArrowTone.stem,
    entryCandleHighY,
    entryLabelText,
    entryLabelWidth,
    entryLabelY,
    entryLineStrokeOpacity,
    entryLineY,
    entryMarkerX,
    entryTone.fill,
    entryTone.line,
    entryTone.text,
    exitArrowTone.fill,
    exitArrowTone.glow,
    exitArrowTone.stem,
    exitCandleHighY,
    exitLabelText,
    exitLabelWidth,
    exitLabelY,
    exitLineStrokeOpacity,
    exitLineY,
    exitMarkerX,
    exitTone.fill,
    exitTone.line,
    exitTone.text,
    replayView,
    showEntryMarker,
    showExitLine,
  ]);

  if (status === "loading") {
    return (
      <div className="flex h-[460px] items-center justify-center text-center">
        <div>
          <div className="text-lg font-medium text-white/84">Loading replay</div>
          <div className="mt-2 text-sm text-white/42">Portal is rebuilding the trade from candle data.</div>
        </div>
      </div>
    );
  }

  if (!dataset || !replayView) {
    return (
      <div className="flex h-[460px] items-center justify-center text-center">
        <div>
          <div className="text-lg font-medium text-white/84">Replay unavailable</div>
          <div className="mt-2 max-w-md text-sm text-white/42">
            Portal could not load enough candle data for a fixed-viewport replay, so snapshots stay available instead.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-white/76 transition hover:bg-white/[0.08] hover:text-white"
            onClick={() => setIsPlaying((currentValue) => !currentValue)}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[12px] text-white/54 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:text-white/22"
            disabled={!canStepBack}
            onClick={() => setCurrentIndex((currentValue) => Math.max(dataset.entryIndex, currentValue - 1))}
          >
            Step Back
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[12px] text-white/54 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:text-white/22"
            disabled={!canStepForward}
            onClick={() => setCurrentIndex((currentValue) => Math.min(dataset.exitIndex, currentValue + 1))}
          >
            Step Forward
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[12px] text-white/54 transition hover:bg-white/[0.05] hover:text-white"
            onClick={() => {
              setIsPlaying(false);
              setCurrentIndex(dataset.entryIndex);
            }}
          >
            Reset
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[12px] text-white/54 transition hover:bg-white/[0.05] hover:text-white"
            onClick={() => {
              setIsPlaying(false);
              setCurrentIndex(dataset.entryIndex);
            }}
          >
            Entry
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[12px] text-white/54 transition hover:bg-white/[0.05] hover:text-white"
            onClick={() => {
              setIsPlaying(false);
              setCurrentIndex(dataset.exitIndex);
            }}
          >
            Exit
          </button>
          <div className="font-mono text-[12px] text-white/44">
            {replayView.frameLabel} · {formatReplayTimestamp(replayView.currentCandle?.time ?? dataset.candles[dataset.entryIndex].time)}
          </div>
        </div>
      </div>

      <div className="relative h-[460px] bg-[#070b12]">
        <svg
          aria-label="Trade replay chart"
          className="h-full w-full"
          style={{ imageRendering: "auto" }}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        >
          <rect fill="#070b12" height={SVG_HEIGHT} width={SVG_WIDTH} x={0} y={0} />

          {replayView.priceTicks.map((tickPrice) => {
            const y = replayView.mapY(tickPrice);
            return (
              <g key={tickPrice}>
                <line
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 12"
                  strokeWidth="1"
                  x1={PLOT_PADDING.left}
                  x2={SVG_WIDTH - PLOT_PADDING.right}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="rgba(255,255,255,0.42)"
                  fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace"
                  fontSize="20"
                  textAnchor="start"
                  x={SVG_WIDTH - PLOT_PADDING.right + 14}
                  y={y + 6}
                >
                  {formatPrice(tickPrice)}
                </text>
              </g>
            );
          })}

          {replayView.timeTicks.map((tickIndex) => {
            const candle = replayView.fullCandles[tickIndex];
            if (!candle) {
              return null;
            }

            const x = replayView.mapX(tickIndex);

            return (
              <g key={`${tickIndex}-${candle.time}`}>
                <line
                  stroke="rgba(255,255,255,0.035)"
                  strokeWidth="1"
                  x1={x}
                  x2={x}
                  y1={PLOT_PADDING.top}
                  y2={SVG_HEIGHT - PLOT_PADDING.bottom}
                />
                <text
                  fill="rgba(255,255,255,0.34)"
                  fontFamily="ui-monospace,SFMono-Regular,Menlo,monospace"
                  fontSize="20"
                  textAnchor={tickIndex === 0 ? "start" : tickIndex === replayView.fullCandles.length - 1 ? "end" : "middle"}
                  x={x}
                  y={SVG_HEIGHT - 10}
                >
                  {formatReplayTimestamp(candle.time)}
                </text>
              </g>
            );
          })}

          {replayView.visibleCandles.map((candle, index) => {
            const x = replayView.mapX(index);
            const openY = replayView.mapY(candle.open);
            const closeY = replayView.mapY(candle.close);
            const highY = replayView.mapY(candle.high);
            const lowY = replayView.mapY(candle.low);
            const isUpCandle = candle.close >= candle.open;
            const tone = getReplayCandleStyle(isUpCandle);
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(3, Math.abs(closeY - openY));
            const bodyX = x - replayView.candleWidth / 2;
            const highlightHeight = Math.max(2, bodyHeight * 0.42);

            return (
              <g key={`${candle.time}-${index}`}>
                <line
                  stroke={tone.wickStroke}
                  strokeLinecap="round"
                  strokeOpacity="0.98"
                  strokeWidth="2.2"
                  x1={x}
                  x2={x}
                  y1={highY}
                  y2={lowY}
                />
                <rect
                  fill={tone.bodyFill}
                  fillOpacity="0.98"
                  height={bodyHeight}
                  rx="1.5"
                  width={replayView.candleWidth}
                  x={bodyX}
                  y={bodyTop}
                />
                <rect
                  fill={tone.bodyHighlight}
                  height={highlightHeight}
                  rx="1.5"
                  width={Math.max(2, replayView.candleWidth - 2.2)}
                  x={bodyX + 1.1}
                  y={bodyTop + 1}
                />
                <rect
                  fill="none"
                  height={bodyHeight}
                  rx="1.5"
                  stroke={tone.bodyStroke}
                  strokeOpacity="0.78"
                  strokeWidth="0.9"
                  width={replayView.candleWidth}
                  x={bodyX}
                  y={bodyTop}
                />
              </g>
            );
          })}
        </svg>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        >
          <defs>
            <filter id="portal-replay-overlay-glow" height="220%" width="220%" x="-60%" y="-60%">
              <feGaussianBlur result="blur" stdDeviation="4.2" />
              <feColorMatrix
                in="blur"
                result="glow"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.82 0"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {overlayMarkers.map((marker) => (
            <g
              key={marker.labelText}
              className="portal-replay-marker-pulse"
              style={{
                transformOrigin: `${marker.pinX}px ${marker.arrowHeadCenterY}px`,
              }}
            >
              <line
                filter="url(#portal-replay-overlay-glow)"
                stroke={marker.lineTone}
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeOpacity={marker.lineOpacity}
                strokeWidth="1.45"
                x1={replayView.plotLeft}
                x2={replayView.plotRight + MARKER_LINE_END_INSET}
                y1={marker.priceY}
                y2={marker.priceY}
              />
              <line
                filter="url(#portal-replay-overlay-glow)"
                stroke={marker.stemTone}
                strokeLinecap="round"
                strokeOpacity={marker.active ? 0.96 : 0.84}
                strokeWidth="1.7"
                x1={marker.pinX}
                x2={marker.pinX}
                y1={marker.stemTopY}
                y2={marker.stemEndY}
              />
              <polygon
                fill={marker.arrowFillTone}
                filter="url(#portal-replay-overlay-glow)"
                opacity={marker.active ? 1 : 0.9}
                points={`${marker.pinX - 9},${marker.arrowHeadCenterY - 5} ${marker.pinX + 9},${marker.arrowHeadCenterY - 5} ${marker.pinX},${marker.arrowHeadCenterY + 8}`}
                stroke={marker.arrowGlowTone}
                strokeWidth="1.25"
              />
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {overlayMarkers.map((marker) => (
            <div
              key={`${marker.labelText}-line`}
              className="absolute"
              style={{
                left: `${(replayView.plotLeft / SVG_WIDTH) * 100}%`,
                top: `${(marker.priceY / SVG_HEIGHT) * 100}%`,
                transform: "translateY(-50%)",
                width: `${((replayView.plotRight + MARKER_LINE_END_INSET - replayView.plotLeft) / SVG_WIDTH) * 100}%`,
              }}
            >
              <div
                className="w-full border-t-2 border-dashed"
                style={{
                  borderTopColor: marker.lineTone,
                  opacity: marker.lineOpacity,
                }}
              />
            </div>
          ))}
          {overlayMarkers.map((marker) => (
            <div
              key={`${marker.labelText}-label`}
              className="absolute"
              style={{
                right: "14px",
                top: `${(marker.labelY / SVG_HEIGHT) * 100}%`,
                transform: "translateY(-50%)",
                width: `${marker.labelWidth}px`,
              }}
            >
              <div
                className="relative h-7 rounded-full px-3 font-mono text-[14px] font-semibold tracking-[0.02em] shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
                style={{
                  backgroundColor: marker.fillTone,
                  color: marker.textTone,
                  lineHeight: "28px",
                }}
              >
                <span
                  className="absolute -left-2 top-1/2 h-0 w-0 -translate-y-1/2 border-b-[5px] border-r-[8px] border-t-[5px] border-b-transparent border-t-transparent"
                  style={{
                    borderRightColor: marker.fillTone,
                  }}
                />
                {marker.labelText}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.06] px-5 py-4 font-mono text-[12px] text-white/44">
        <span>{replayView.frameLabel}</span>
        <span>{formatReplayTimestamp(replayView.currentCandle?.time ?? dataset.candles[dataset.entryIndex].time)}</span>
        <span>price {formatPrice(replayView.currentCandle?.close ?? null)}</span>
        <span>{currentIndex >= dataset.exitIndex ? "realized" : "unrealized"} {formatPnl(replayView.framePnl)}</span>
      </div>

      <style jsx>{`
        .portal-replay-marker-pulse {
          animation: portalReplayMarkerPulse 2.4s ease-in-out infinite;
        }

        @keyframes portalReplayMarkerPulse {
          0%,
          100% {
            opacity: 0.9;
            transform: translateY(0) scale(0.98);
          }

          35% {
            opacity: 1;
            transform: translateY(-3px) scale(1.045);
          }

          65% {
            opacity: 1;
            transform: translateY(-1px) scale(1.02);
          }
        }
      `}</style>
    </div>
  );
}
