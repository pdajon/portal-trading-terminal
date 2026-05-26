"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LiveExchangePosition, ChartTradePlan } from "@/types/trade";
import type { HyperliquidSymbol } from "@/types/market";

type CloseMode = "market" | "limit";

const FULL_RAIL_MIN_HEIGHT_PX = 820;

type LivePositionRailProps = {
  activeTradePlan: ChartTradePlan | null;
  compact?: boolean;
  onBreakEven: (symbol: HyperliquidSymbol) => void;
  onClosePosition: (symbol: HyperliquidSymbol) => void;
  onLimitCloseAtCurrentPrice: (
    symbol: HyperliquidSymbol,
    percent: number,
  ) => void;
  onLimitCloseAtPrice: (
    symbol: HyperliquidSymbol,
    percent: number,
    price: number,
  ) => void;
  onLimitCloseSelectPrice: (symbol: HyperliquidSymbol, percent: number) => void;
  onReversePosition: (symbol: HyperliquidSymbol) => void;
  onReducePosition: (symbol: HyperliquidSymbol, percent: number) => void;
  positionActionInFlightSymbol: HyperliquidSymbol | null;
  positions: LiveExchangePosition[];
};

type CloseDialogState = {
  mode: CloseMode;
  positionKey: string;
};

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPriceOrUnavailable(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return formatPrice(value);
}

function formatDollar(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatSignedDollar(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${formatDollar(value)}`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getLiquidationLabel(liquidationPrice: number | null) {
  if (liquidationPrice !== null && Number.isFinite(liquidationPrice)) {
    return formatPrice(liquidationPrice);
  }

  return formatPriceOrUnavailable(liquidationPrice);
}

function getTradePlanRr(
  tradePlan: Pick<ChartTradePlan, "entry" | "stop" | "target">,
) {
  const risk = Math.abs(tradePlan.entry - tradePlan.stop);
  if (!Number.isFinite(risk) || risk <= 0) {
    return 0;
  }

  return Math.abs(tradePlan.target - tradePlan.entry) / risk;
}

function getBaseAssetLabel(symbol: HyperliquidSymbol) {
  return symbol.split("-")[0] ?? symbol;
}

function getLeverageLabel(leverageValue: number | null) {
  if (
    leverageValue === null ||
    !Number.isFinite(leverageValue) ||
    leverageValue <= 0
  ) {
    return "--x";
  }

  return `${Number.isInteger(leverageValue) ? leverageValue.toFixed(0) : leverageValue.toFixed(1)}x`;
}

function getMarkTone(position: LiveExchangePosition) {
  const { direction, entryPrice, markPrice } = position;

  if (!Number.isFinite(entryPrice) || !Number.isFinite(markPrice)) {
    return "text-white/86";
  }

  const markIsFavorable =
    direction === "long" ? markPrice >= entryPrice : markPrice <= entryPrice;

  return markIsFavorable ? "text-[#22C55E]" : "text-[#EF4444]";
}

function getFundingTone(fundingUsd: number | null) {
  if (fundingUsd === null || !Number.isFinite(fundingUsd) || fundingUsd === 0) {
    return "text-white/76";
  }

  return fundingUsd > 0 ? "text-[#22C55E]" : "text-[#EF4444]";
}

function clampClosePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function getCloseModeLabel(mode: CloseMode) {
  return mode === "market" ? "Market" : "Limit";
}

function getClosePriceLabel(mode: CloseMode) {
  return mode === "market" ? "Market" : "Limit price";
}

function getCloseDialogCopy(mode: CloseMode) {
  return mode === "market"
    ? "This will attempt to immediately close the selected size."
    : "Send a reduce-only order to close at the limit price.";
}

function formatCloseSize(value: number, baseAssetLabel: string) {
  if (!Number.isFinite(value) || value <= 0) {
    return `0.00000 ${baseAssetLabel}`;
  }

  return `${value.toFixed(5)} ${baseAssetLabel}`;
}

function formatLimitPriceInput(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  return value.toFixed(2);
}

function parseLimitPriceInput(value: string) {
  const normalizedValue = value.replace(/,/g, "").trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getPositionKey(
  position: Pick<LiveExchangePosition, "direction" | "symbol">,
) {
  return `${position.symbol}-${position.direction}`;
}

type PositionDetailRow = {
  label: string;
  value: string;
  valueClassName?: string;
};

function buildPositionDetailRows({
  fundingTone,
  markTone,
  matchingTradePlan,
  position,
  rr,
}: {
  fundingTone: string;
  markTone: string;
  matchingTradePlan: ChartTradePlan | null;
  position: LiveExchangePosition;
  rr: number;
}): PositionDetailRow[] {
  const rows: PositionDetailRow[] = [
    {
      label: "Liquidation Price",
      value: getLiquidationLabel(position.liquidationPrice),
    },
    {
      label: "Entry",
      value: formatPrice(position.entryPrice),
    },
    {
      label: "Mark",
      value: formatPrice(position.markPrice),
      valueClassName: markTone,
    },
    {
      label: "Position Value",
      value: formatDollar(position.positionValueUsd),
    },
    {
      label: "Margin Used",
      value: formatDollar(position.marginUsedUsd),
    },
    {
      label: "Funding",
      value: formatSignedDollar(position.fundingUsd),
      valueClassName: fundingTone,
    },
  ];

  if (matchingTradePlan) {
    rows.push(
      {
        label: "Plan R:R",
        value: rr.toFixed(2),
        valueClassName: "text-cyan-100/82",
      },
      {
        label: "Plan Risk",
        value: formatDollar(matchingTradePlan.riskAmount),
      },
    );
  }

  return rows;
}

function PositionDetailLedger({
  compact,
  rows,
}: {
  compact: boolean;
  rows: PositionDetailRow[];
}) {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-portal-panel border border-cyan-100/[0.07] bg-[linear-gradient(180deg,rgba(8,16,24,0.52),rgba(4,8,14,0.42))] ${compact ? "px-3 py-2.5" : "px-3.5 py-3"} shadow-[0_14px_38px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-[16px] portal-clip-panel`}
    >
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/16 to-transparent" />
      <dl className="relative grid gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3"
          >
            <dt className="min-w-0">
              <span className="border-b border-dashed border-cyan-100/[0.09] text-[12px] font-normal leading-none text-[rgba(142,160,172,0.54)]">
                {row.label}
              </span>
            </dt>
            <dd
              className={`portal-value-number min-w-0 max-w-[132px] truncate text-right text-[13px] font-semibold leading-snug ${row.valueClassName ?? "text-white/82"}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LivePositionRail({
  activeTradePlan,
  compact = false,
  onBreakEven,
  onClosePosition,
  onLimitCloseAtCurrentPrice,
  onLimitCloseAtPrice,
  onLimitCloseSelectPrice,
  onReversePosition,
  onReducePosition,
  positionActionInFlightSymbol,
  positions,
}: LivePositionRailProps) {
  const [closeModeByPosition, setCloseModeByPosition] = useState<
    Record<string, CloseMode>
  >({});
  const [closePercentByPosition, setClosePercentByPosition] = useState<
    Record<string, number>
  >({});
  const [limitClosePriceByPosition, setLimitClosePriceByPosition] = useState<
    Record<string, string>
  >({});
  const [closeDialog, setCloseDialog] = useState<CloseDialogState | null>(null);
  const [heightCompact, setHeightCompact] = useState(false);
  const railRef = useRef<HTMLElement | null>(null);
  const railCompact = compact || heightCompact;

  const closeDialogPosition = closeDialog
    ? (positions.find(
        (position) => getPositionKey(position) === closeDialog.positionKey,
      ) ?? null)
    : null;
  const closeDialogPercent = closeDialog
    ? clampClosePercent(closePercentByPosition[closeDialog.positionKey] ?? 100)
    : 100;
  const closeDialogBaseAssetLabel = closeDialogPosition
    ? getBaseAssetLabel(closeDialogPosition.symbol)
    : "";
  const closeDialogSize = closeDialogPosition
    ? closeDialogPosition.size * (closeDialogPercent / 100)
    : 0;
  const closeDialogModeLabel = closeDialog
    ? getCloseModeLabel(closeDialog.mode)
    : "Market";
  const closeDialogBusy =
    closeDialogPosition !== null &&
    positionActionInFlightSymbol === closeDialogPosition.symbol;
  const closeDialogLimitPriceInput = closeDialog
    ? (limitClosePriceByPosition[closeDialog.positionKey] ?? "")
    : "";
  const closeDialogLimitPrice = parseLimitPriceInput(
    closeDialogLimitPriceInput,
  );

  function setClosePercentForPosition(positionKey: string, value: number) {
    setClosePercentByPosition((currentPercents) => ({
      ...currentPercents,
      [positionKey]: clampClosePercent(value),
    }));
  }

  function setLimitClosePriceForPosition(positionKey: string, value: string) {
    setLimitClosePriceByPosition((currentPrices) => ({
      ...currentPrices,
      [positionKey]: value,
    }));
  }

  function getMidPriceForPosition(position: LiveExchangePosition) {
    return Number.isFinite(position.markPrice) && position.markPrice > 0
      ? position.markPrice
      : null;
  }

  function applyMidLimitPrice(position: LiveExchangePosition) {
    const midPrice = getMidPriceForPosition(position);

    if (midPrice === null) {
      return;
    }

    setLimitClosePriceForPosition(
      getPositionKey(position),
      formatLimitPriceInput(midPrice),
    );
  }

  function openCloseDialog(positionKey: string, mode: CloseMode) {
    setClosePercentByPosition((currentPercents) => ({
      ...currentPercents,
      [positionKey]: currentPercents[positionKey] ?? 100,
    }));
    if (mode === "limit") {
      const position = positions.find(
        (visiblePosition) => getPositionKey(visiblePosition) === positionKey,
      );

      if (position) {
        setLimitClosePriceByPosition((currentPrices) => ({
          ...currentPrices,
          [positionKey]:
            currentPrices[positionKey] ??
            formatLimitPriceInput(getMidPriceForPosition(position)),
        }));
      }
    }
    setCloseDialog({ mode, positionKey });
  }

  function closeCloseDialog() {
    setCloseDialog(null);
  }

  function confirmCloseDialog() {
    if (!closeDialog || !closeDialogPosition || closeDialogPercent <= 0) {
      return;
    }

    closeCloseDialog();

    if (closeDialog.mode === "market") {
      if (closeDialogPercent >= 100) {
        onClosePosition(closeDialogPosition.symbol);
      } else {
        onReducePosition(closeDialogPosition.symbol, closeDialogPercent);
      }
      return;
    }

    if (closeDialogLimitPrice !== null) {
      onLimitCloseAtPrice(
        closeDialogPosition.symbol,
        closeDialogPercent,
        closeDialogLimitPrice,
      );
      return;
    }

    onLimitCloseSelectPrice(closeDialogPosition.symbol, closeDialogPercent);
  }

  useEffect(() => {
    const railElement = railRef.current;

    if (!railElement) {
      return;
    }

    const updateRailDensity = () => {
      setHeightCompact(railElement.clientHeight < FULL_RAIL_MIN_HEIGHT_PX);
    };

    updateRailDensity();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateRailDensity);
      return () => window.removeEventListener("resize", updateRailDensity);
    }

    const observer = new ResizeObserver(updateRailDensity);
    observer.observe(railElement);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!closeDialog) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCloseDialog();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog]);

  useEffect(() => {
    if (!closeDialog) {
      return;
    }

    const closeDialogPositionStillVisible = positions.some(
      (position) => getPositionKey(position) === closeDialog.positionKey,
    );

    if (!closeDialogPositionStillVisible) {
      closeCloseDialog();
    }
  }, [closeDialog, positions]);

  return (
    <>
      <aside
        ref={railRef}
        className={`relative flex h-full w-[292px] shrink-0 flex-col gap-3 overflow-visible border-l border-cyan-100/[0.085] bg-[linear-gradient(180deg,rgba(6,12,21,0.92),rgba(3,6,12,0.88))] px-4 backdrop-blur-[18px] ${railCompact ? "py-3" : "py-5"}`}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pr-1">
          {positions.map((position) => {
            const matchingTradePlan =
              activeTradePlan?.symbol === position.symbol
                ? activeTradePlan
                : null;
            const rr = matchingTradePlan
              ? getTradePlanRr(matchingTradePlan)
              : 0;
            const pnlPositive = position.pnlUsd >= 0;
            const actionBusy = positionActionInFlightSymbol === position.symbol;
            const positionTone =
              position.direction === "long" ? "text-cyan-100" : "text-rose-100";
            const pnlTone = pnlPositive ? "text-[#22C55E]" : "text-[#EF4444]";
            const markTone = getMarkTone(position);
            const fundingTone = getFundingTone(position.fundingUsd);
            const baseAssetLabel = getBaseAssetLabel(position.symbol);
            const positionKey = getPositionKey(position);
            const closeMode = closeModeByPosition[positionKey] ?? "market";
            const detailRows = buildPositionDetailRows({
              fundingTone,
              markTone,
              matchingTradePlan,
              position,
              rr,
            });
            const cardToneClass =
              "border-cyan-100/[0.13] shadow-[0_24px_62px_rgba(0,0,0,0.42),0_0_0_1px_rgba(255,255,255,0.025),inset_0_1px_0_rgba(255,255,255,0.095)]";
            const cardTintClass =
              "bg-[linear-gradient(180deg,rgba(8,15,25,0.78),rgba(4,8,15,0.64))]";
            const edgeLineClass = "via-cyan-100/20";
            const perimeterRingClass = "ring-1 ring-cyan-100/[0.075]";
            return (
              <div
                key={`${position.symbol}-${position.direction}`}
                className="relative grid gap-2.5 overflow-visible"
              >
                <div
                  className={`relative isolate overflow-hidden rounded-portal-panel border ${cardTintClass} ${cardToneClass} ${perimeterRingClass} p-4 backdrop-blur-[22px] portal-clip-panel`}
                >
                  <div
                    className={`pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent ${edgeLineClass} to-transparent`}
                  />
                  <div className="pointer-events-none absolute -left-10 top-8 h-px w-[150%] -rotate-6 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                  <div className="relative">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span
                            className={`text-[22px] font-semibold leading-none tracking-normal ${positionTone}`}
                          >
                            {position.direction === "long" ? "Long" : "Short"}
                          </span>
                          <span className="rounded-portal-control border border-white/[0.08] bg-white/[0.035] px-2 py-1 font-mono text-[12px] font-semibold leading-none text-white/58">
                            {getLeverageLabel(position.leverageValue)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={railCompact ? "mt-5" : "mt-6"}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                        Unrealized PnL
                      </div>
                      <div className="mt-1 flex items-end justify-between gap-3">
                        <div
                          className={`portal-value-number text-[38px] font-semibold leading-none ${pnlTone}`}
                        >
                          {formatDollar(position.pnlUsd)}
                        </div>
                        <div
                          className={`portal-value-number pb-1.5 text-[15px] font-semibold leading-none ${pnlTone}`}
                        >
                          {formatPercent(position.pnlPercent)}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`${railCompact ? "mt-4" : "mt-5"} border-t border-cyan-100/[0.065] pt-3`}
                    >
                      <div className="grid grid-cols-2 gap-x-5">
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium uppercase tracking-[0.17em] text-white/46">
                            Coin
                          </div>
                          <div className="mt-1 flex min-w-0 items-center gap-2 font-mono uppercase tracking-normal">
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-[linear-gradient(180deg,#fb923c,#f97316)] text-[11px] font-black text-white shadow-[0_0_10px_rgba(249,115,22,0.18)]"
                              aria-hidden="true"
                            >
                              {baseAssetLabel.slice(0, 1)}
                            </span>
                            <span className="text-[14px] text-white/86">
                              {baseAssetLabel}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 text-right">
                          <div className="text-[10px] font-medium uppercase tracking-[0.17em] text-white/46">
                            Size
                          </div>
                          <div className="portal-value-number mt-1 text-[14px] font-medium text-white/82">
                            {position.size.toFixed(5)} {baseAssetLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-cyan-100/[0.065] pt-3">
                    <div className="relative grid h-[48px] grid-cols-2 overflow-hidden rounded-portal-control border border-cyan-100/[0.075] bg-black/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.050)]">
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute bottom-1.5 top-1.5 w-[calc(50%-6px)] rounded-portal-control border border-[#8B5CF6]/90 bg-[linear-gradient(180deg,rgba(16,18,34,0.94),rgba(6,10,22,0.86))] shadow-[0_0_0_1px_rgba(139,92,246,0.46),0_0_12px_rgba(139,92,246,0.42),0_0_24px_rgba(124,58,237,0.24),inset_0_0_14px_rgba(139,92,246,0.09)] transition-transform duration-200 ease-out ${
                          closeMode === "limit"
                            ? "translate-x-full"
                            : "translate-x-0"
                        }`}
                        style={{ left: "6px" }}
                      />
                      {(["market", "limit"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={`relative z-10 rounded-portal-control px-3 py-1 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                            closeMode === mode
                              ? "text-white [text-shadow:0_0_9px_rgba(139,92,246,0.58)]"
                              : "text-white/42 hover:text-white/72"
                          }`}
                          disabled={actionBusy}
                          onClick={() =>
                            setCloseModeByPosition((currentModes) => ({
                              ...currentModes,
                              [positionKey]: mode,
                            }))
                          }
                        >
                          {getCloseModeLabel(mode)}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="portal-market-close-command"
                      disabled={actionBusy}
                      onClick={() => openCloseDialog(positionKey, closeMode)}
                    >
                      {getCloseModeLabel(closeMode)} Close
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4 px-1">
                    <button
                      type="button"
                      className="min-h-7 flex-1 px-0 text-[11px] font-semibold text-white/54 transition hover:text-amber-50 focus-visible:outline-none focus-visible:text-amber-50 focus-visible:[text-shadow:0_0_10px_rgba(251,191,36,0.34)] disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={actionBusy}
                      onClick={() => onReversePosition(position.symbol)}
                    >
                      Reverse
                    </button>
                    <button
                      type="button"
                      className="min-h-7 flex-1 px-0 text-[11px] font-semibold leading-tight text-cyan-50/58 transition hover:text-cyan-50 focus-visible:outline-none focus-visible:text-cyan-50 focus-visible:[text-shadow:0_0_10px_rgba(103,232,249,0.34)] disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={actionBusy}
                      onClick={() => onBreakEven(position.symbol)}
                    >
                      Break Even
                    </button>
                  </div>
                </div>
                <PositionDetailLedger compact={railCompact} rows={detailRows} />
              </div>
            );
          })}
        </div>
      </aside>
      {closeDialog && closeDialogPosition
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/68 px-4 py-8 backdrop-blur-[9px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeCloseDialog();
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="portal-close-dialog-title"
                className="relative isolate w-full max-w-[720px] overflow-hidden rounded-portal-modal border border-cyan-100/[0.16] bg-[radial-gradient(circle_at_16%_0%,rgba(51,245,255,0.13),transparent_31%),radial-gradient(circle_at_84%_12%,rgba(139,92,246,0.13),transparent_34%),linear-gradient(180deg,rgba(9,18,28,0.97),rgba(4,8,15,0.96))] p-5 text-white shadow-[0_30px_96px_rgba(0,0,0,0.64),0_0_0_1px_rgba(51,245,255,0.06),0_0_54px_rgba(51,245,255,0.10),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-[30px] portal-clip-modal sm:p-8"
              >
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/28 to-transparent" />
                <div className="pointer-events-none absolute -left-16 top-12 h-px w-[150%] -rotate-6 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                <button
                  type="button"
                  aria-label="Close close-position dialog"
                  className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-portal-panel border border-white/[0.075] bg-white/[0.035] text-[26px] font-light leading-none text-white/72 transition hover:border-cyan-200/24 hover:bg-cyan-300/[0.07] hover:text-cyan-50"
                  onClick={closeCloseDialog}
                >
                  ×
                </button>

                <div className="relative">
                  <div className="mx-auto max-w-[480px] text-center">
                    <h2
                      id="portal-close-dialog-title"
                      className="text-[32px] font-semibold leading-tight tracking-normal text-white sm:text-[40px]"
                    >
                      {closeDialogModeLabel} Close
                    </h2>
                    <p className="mt-3 text-[17px] font-medium leading-snug text-white/66">
                      {getCloseDialogCopy(closeDialog.mode)}
                    </p>
                  </div>

                  <div className="mt-8 grid gap-4">
                    {closeDialog.mode === "limit" ? (
                      <label className="group flex min-h-[64px] items-center justify-between gap-4 rounded-portal-panel border border-cyan-100/[0.13] bg-[linear-gradient(180deg,rgba(7,16,24,0.56),rgba(3,8,14,0.42))] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.060)] transition focus-within:border-cyan-200/42 focus-within:bg-cyan-300/[0.045] focus-within:shadow-[0_0_22px_rgba(34,211,238,0.11),inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <span className="shrink-0 text-[17px] font-medium text-white/50">
                          Price (USDC)
                        </span>
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                          <input
                            aria-label="Limit close price"
                            className="portal-value-number min-w-0 flex-1 bg-transparent text-right text-[18px] font-semibold text-white/92 outline-none placeholder:text-white/28 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            disabled={closeDialogBusy}
                            inputMode="decimal"
                            onChange={(event) =>
                              setLimitClosePriceForPosition(
                                closeDialog.positionKey,
                                event.currentTarget.value,
                              )
                            }
                            placeholder="Type price"
                            type="text"
                            value={closeDialogLimitPriceInput}
                          />
                          <button
                            type="button"
                            className="shrink-0 rounded-portal-control border border-cyan-100/[0.10] bg-cyan-300/[0.045] px-3 py-2 text-[14px] font-semibold text-cyan-100 transition hover:border-cyan-100/30 hover:bg-cyan-300/[0.10] hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={
                              closeDialogBusy ||
                              getMidPriceForPosition(closeDialogPosition) ===
                                null
                            }
                            onClick={() =>
                              applyMidLimitPrice(closeDialogPosition)
                            }
                          >
                            Mid
                          </button>
                        </div>
                      </label>
                    ) : (
                      <div className="flex min-h-[64px] items-center justify-between gap-4 rounded-portal-panel border border-cyan-100/[0.13] bg-[linear-gradient(180deg,rgba(7,16,24,0.56),rgba(3,8,14,0.42))] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.060)]">
                        <span className="text-[17px] font-medium text-white/50">
                          Price
                        </span>
                        <span className="font-semibold text-white/90">
                          {getClosePriceLabel(closeDialog.mode)}
                        </span>
                      </div>
                    )}

                    <div className="flex min-h-[64px] items-center justify-between gap-4 rounded-portal-panel border border-cyan-100/[0.13] bg-[linear-gradient(180deg,rgba(7,16,24,0.56),rgba(3,8,14,0.42))] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.060)]">
                      <span className="text-[17px] font-medium text-white/50">
                        Size
                      </span>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="portal-value-number truncate text-[17px] font-semibold text-white/92">
                          {formatCloseSize(
                            closeDialogSize,
                            closeDialogBaseAssetLabel,
                          )}
                        </span>
                        <span
                          className="text-[18px] text-white/42"
                          aria-hidden="true"
                        >
                          ⌄
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_96px] items-center gap-4">
                      <div>
                        <input
                          aria-label={`${closeDialogModeLabel} close percentage`}
                          className="portal-close-slider w-full disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={closeDialogBusy}
                          max={100}
                          min={0}
                          onChange={(event) =>
                            setClosePercentForPosition(
                              closeDialog.positionKey,
                              Number(event.currentTarget.value),
                            )
                          }
                          onInput={(event) =>
                            setClosePercentForPosition(
                              closeDialog.positionKey,
                              Number(event.currentTarget.value),
                            )
                          }
                          style={
                            {
                              "--portal-close-progress": `${closeDialogPercent}%`,
                            } as CSSProperties
                          }
                          step={1}
                          type="range"
                          value={closeDialogPercent}
                        />
                        <div className="relative mt-1 h-5 font-mono text-[10px] font-semibold text-white/38">
                          {[25, 50, 75, 100].map((percent) => (
                            <button
                              key={percent}
                              type="button"
                              aria-label={`Set close size to ${percent}%`}
                              className={`absolute rounded-portal-chip px-1 py-0.5 transition disabled:cursor-not-allowed disabled:opacity-45 ${
                                closeDialogPercent === percent
                                  ? "text-cyan-50"
                                  : "hover:bg-cyan-300/[0.08] hover:text-cyan-50/80"
                              } ${percent === 100 ? "right-0" : "-translate-x-1/2"}`}
                              disabled={closeDialogBusy}
                              onClick={() =>
                                setClosePercentForPosition(
                                  closeDialog.positionKey,
                                  percent,
                                )
                              }
                              style={
                                percent < 100
                                  ? { left: `${percent}%` }
                                  : undefined
                              }
                            >
                              {percent}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="portal-value-number flex h-14 items-center justify-center rounded-portal-panel border border-cyan-100/[0.12] bg-white/[0.035] px-3 text-[20px] font-semibold text-white/94 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] focus-within:border-cyan-200/34 focus-within:bg-cyan-300/[0.055] focus-within:shadow-[0_0_18px_rgba(34,211,238,0.10),inset_0_1px_0_rgba(255,255,255,0.075)]">
                        <span className="sr-only">
                          {closeDialogModeLabel} close percentage
                        </span>
                        <input
                          aria-label={`${closeDialogModeLabel} close percentage value`}
                          className="w-12 bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          disabled={closeDialogBusy}
                          inputMode="numeric"
                          max={100}
                          min={0}
                          onChange={(event) =>
                            setClosePercentForPosition(
                              closeDialog.positionKey,
                              Number(event.currentTarget.value),
                            )
                          }
                          step={1}
                          type="number"
                          value={closeDialogPercent}
                        />
                        <span className="ml-1">%</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      className="portal-market-close-command !mt-6 !h-14 !text-[14px] disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={
                        closeDialogBusy ||
                        closeDialogPercent <= 0 ||
                        (closeDialog.mode === "limit" &&
                          closeDialogLimitPrice === null)
                      }
                      onClick={confirmCloseDialog}
                    >
                      {closeDialogModeLabel} Close
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
