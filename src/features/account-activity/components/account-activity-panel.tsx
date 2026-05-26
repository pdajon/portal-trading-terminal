"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AccountActivityFooterTab,
  AccountActivityLedger,
  AccountActivityRowTone,
  TradeSharePayload,
} from "../lib/account-activity-ledger";
import {
  formatProtectionOffsetInput,
  formatProtectionPriceInput,
  parseProtectionNumber,
  resolveProtectionOffsetFromPrice,
  resolveProtectionPriceFromOffset,
  type ProtectionOffsetKind,
  type ProtectionOffsetUnit,
} from "../lib/protection-offset";
import type { TradeDirection } from "@/types/trade";
import type { HyperliquidSymbol } from "@/types/market";

type LedgerState = "loading" | "error" | "ready";

type AccountActivityPanelProps = {
  activeSymbol?: HyperliquidSymbol;
  hideSmallBalances?: boolean;
  ledger: AccountActivityLedger;
  marketFilter?: string;
  positionFilter?: AccountActivityPositionFilter;
  selectedTab: Exclude<AccountActivityFooterTab, "trade">;
  state?: LedgerState;
  errorMessage?: string;
  onCancelAllOrders?: () => void;
  onCancelOpenOrder?: (
    symbol: HyperliquidSymbol,
    direction: TradeDirection,
    orderId: number,
  ) => void;
  onDisarmMagicTradeRule?: (ruleId: string) => void;
  onEditMagicTradeRule?: (ruleId: string) => void;
  onFocusMagicTradeRule?: (ruleId: string) => void;
  onCloseAllPositions?: () => void;
  onClosePosition?: (symbol: HyperliquidSymbol) => void;
  onLimitCloseAtCurrentPrice?: (symbol: HyperliquidSymbol, percent: number) => void;
  onLimitCloseSelectPrice?: (symbol: HyperliquidSymbol, percent: number) => void;
  onReducePosition?: (symbol: HyperliquidSymbol, percent: number) => void;
  onReversePosition?: (symbol: HyperliquidSymbol) => void;
  onSelectSymbol?: (symbol: HyperliquidSymbol) => void;
  onUpdateProtectionLevels?: (
    symbol: HyperliquidSymbol,
    levels: { stop: number; target: number },
  ) => void;
  positionActionInFlightSymbol?: HyperliquidSymbol | null;
};

type DetailItem = {
  label: string;
  value: string;
  tone?: AccountActivityRowTone;
};

type LedgerRow = {
  id: string;
  cells: Record<string, string>;
  detail: DetailItem[];
  direction?: TradeDirection;
  explorerUrl?: string;
  magicTradeRuleId?: string;
  magicTradeReviewRequired?: boolean;
  orderId?: number | null;
  origin?: "exchange" | "local" | "magic-trade";
  share?: TradeSharePayload;
  symbol?: HyperliquidSymbol;
  tone: AccountActivityRowTone;
};

type Column = {
  id: string;
  label: string;
  align?: "left" | "right";
  headerAction?: "cancel-all" | "close-all";
  primary?: boolean;
  mono?: boolean;
  minWidth?: string;
};

type PositionActionModal =
  | { kind: "market"; percent: number; row: LedgerRow }
  | { kind: "limit"; percent: number; row: LedgerRow }
  | { kind: "tpsl"; row: LedgerRow; stop: string; target: string };

type TradeShareModal = {
  row: LedgerRow;
  selectedOverlay: string;
};

type TableConfig = {
  columns: Column[];
  control: AccountActivityPanelControl;
  emptyLabel: string;
  rows: LedgerRow[];
  title: string;
};

export type AccountActivityPanelControl =
  | "none"
  | "positions-filter"
  | "activity-filter"
  | "trade-history"
  | "balance-filter"
  | "filter";

export type AccountActivityPositionFilter = "all" | "active" | "long" | "short";

export type AccountActivityPanelControlsState = {
  aggregateTrades: boolean;
  hideSmallBalances: boolean;
  marketFilter: string;
  marketFilterHasSelection?: boolean;
  positionFilter: AccountActivityPositionFilter;
  positionFilterHasSelection?: boolean;
  setAggregateTrades: (value: boolean) => void;
  setHideSmallBalances: (value: boolean) => void;
  setMarketFilter: (value: string) => void;
  setPositionFilter: (value: AccountActivityPositionFilter) => void;
};

const TONE_CLASS: Record<AccountActivityRowTone, string> = {
  cyan: "text-cyan-100",
  muted: "text-white/28",
  negative: "text-[#FF4F8A]",
  neutral: "text-white/74",
  positive: "text-[#22C55E]",
  warning: "text-amber-100",
};

const PORTAL_TEXT_BUTTON_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.11em] transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40";

const PORTAL_ACTION_TEXT_STYLE = { color: "#8B5CF6" };

const ACCOUNT_ACTIVITY_FILTER_TRIGGER_CLASS =
  "inline-flex h-8 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/86 transition group-hover:text-white";

const ACCOUNT_ACTIVITY_FILTER_SELECT_CLASS =
  "absolute inset-0 h-full w-full cursor-pointer appearance-none border-0 bg-transparent p-0 opacity-0 outline-none";

const ACCOUNT_ACTIVITY_FILTER_LABELS: Record<string, string> = {
  active: "Active",
  all: "All",
  long: "Long",
  short: "Short",
};

const PROTECTION_OFFSET_FIELD_CLASS =
  "mt-2 flex h-12 w-full overflow-hidden rounded-portal-control border border-cyan-100/[0.12] bg-white/[0.035] transition focus-within:border-cyan-200/40";

const PROTECTION_TEXT_INPUT_CLASS =
  "h-12 w-full min-w-0 bg-transparent px-3 font-mono text-white/86 outline-none placeholder:text-white/34 disabled:cursor-not-allowed disabled:opacity-45";

const PROTECTION_UNIT_SELECT_CLASS =
  "h-full appearance-none bg-transparent pl-3 pr-7 font-mono text-[13px] font-semibold text-cyan-50/78 outline-none disabled:cursor-not-allowed disabled:opacity-45";

const VALUE_TONE_COLUMNS = new Set([
  "closedPnl",
  "direction",
  "funding",
  "payment",
  "pnlRoe",
  "positionSide",
  "status",
]);

const TRADE_SHARE_OVERLAYS = [
  { id: "portal-core", label: "Core", mark: "O" },
  { id: "signal", label: "Signal", mark: "*" },
  { id: "shield", label: "Shield", mark: "+" },
  { id: "void", label: "Void", mark: "/" },
] as const;

export function AccountActivityPanel({
  activeSymbol,
  errorMessage = "Unable to load account activity.",
  hideSmallBalances = false,
  ledger,
  marketFilter = "all",
  onCancelAllOrders,
  onCancelOpenOrder,
  onDisarmMagicTradeRule,
  onEditMagicTradeRule,
  onFocusMagicTradeRule,
  onCloseAllPositions,
  onClosePosition,
  onLimitCloseAtCurrentPrice,
  onLimitCloseSelectPrice,
  onReducePosition,
  onReversePosition,
  onSelectSymbol,
  onUpdateProtectionLevels,
  positionFilter = "all",
  positionActionInFlightSymbol = null,
  selectedTab,
  state = "ready",
}: AccountActivityPanelProps) {
  const [positionActionModal, setPositionActionModal] =
    useState<PositionActionModal | null>(null);
  const [tradeShareModal, setTradeShareModal] =
    useState<TradeShareModal | null>(null);
  const table = useMemo(
    () =>
      getTableConfig(
        selectedTab,
        ledger,
        positionFilter,
        marketFilter,
        activeSymbol,
        hideSmallBalances,
      ),
    [
      activeSymbol,
      hideSmallBalances,
      ledger,
      marketFilter,
      positionFilter,
      selectedTab,
    ],
  );

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden rounded-portal-panel border border-cyan-100/[0.075] bg-[linear-gradient(180deg,rgba(7,14,25,0.72),rgba(3,7,14,0.58))] shadow-[0_18px_48px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.07)] portal-clip-panel">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto px-0 pb-4 pt-0">
          <table className="min-w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(5,10,18,0.995),rgba(5,10,18,0.982))] shadow-[0_10px_22px_rgba(0,0,0,0.34),0_1px_0_rgba(125,211,252,0.08)] backdrop-blur-[22px]">
              <tr>
                {table.columns.map((column) => (
                  <th
                    key={column.id}
                    className={`border-b border-cyan-100/[0.055] px-4 py-3 text-[12px] font-semibold text-white/40 ${
                      column.align === "right" ? "text-right" : ""
                    }`}
                    style={{ minWidth: column.minWidth }}
                  >
                    {renderActivityHeader({
                      column,
                      onCancelAllOrders,
                      onCloseAllPositions,
                      selectedTab,
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state === "loading" ? (
                <tr>
                  <td colSpan={table.columns.length}>
                    <LoadingRows columns={table.columns} />
                  </td>
                </tr>
              ) : state === "error" ? (
                <tr>
                  <td colSpan={table.columns.length}>
                    <StateMessage label={errorMessage} tone="warning" />
                  </td>
                </tr>
              ) : table.rows.length === 0 ? (
                <tr>
                  <td colSpan={table.columns.length}>
                    <StateMessage label={table.emptyLabel} tone="muted" />
                  </td>
                </tr>
              ) : (
                table.rows.map((row) => {
                  return (
                    <tr key={row.id} className="group">
                      {table.columns.map((column) => {
                        const value = row.cells[column.id] ?? "--";
                        const toneClass = getCellToneClass({
                          column,
                          row,
                          selectedTab,
                        });

                        return (
                          <td
                            key={column.id}
                            className={`${getActivityRowCellClass()} ${
                              column.align === "right" ? "text-right" : ""
                            } ${column.mono ? "font-mono" : ""} ${
                              column.id === "coin" ? "font-bold" : ""
                            } ${toneClass}`}
                            style={{ minWidth: column.minWidth }}
                          >
                            {renderActivityCell({
                              column,
                              onCancelOpenOrder,
                              onDisarmMagicTradeRule,
                              onEditMagicTradeRule,
                              onFocusMagicTradeRule,
                              onClosePosition,
                              onLimitCloseAtCurrentPrice,
                              onLimitCloseSelectPrice,
                              onReducePosition,
                              onReversePosition,
                              onSelectSymbol,
                              positionActionInFlightSymbol,
                              row,
                              selectedTab,
                              setTradeShareModal,
                              setPositionActionModal,
                              value,
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PositionActivityModal
        modal={positionActionModal}
        onClose={() => setPositionActionModal(null)}
        onClosePosition={onClosePosition}
        onLimitCloseAtCurrentPrice={onLimitCloseAtCurrentPrice}
        onLimitCloseSelectPrice={onLimitCloseSelectPrice}
        onReducePosition={onReducePosition}
        onUpdateProtectionLevels={onUpdateProtectionLevels}
        positionActionInFlightSymbol={positionActionInFlightSymbol}
      />
      <TradeShareModalView
        modal={tradeShareModal}
        onClose={() => setTradeShareModal(null)}
        onOverlayChange={(selectedOverlay) =>
          setTradeShareModal((currentModal) =>
            currentModal ? { ...currentModal, selectedOverlay } : currentModal,
          )
        }
      />
    </div>
  );
}

export function AccountActivityPanelControls({
  aggregateTrades,
  hideSmallBalances,
  marketFilter,
  marketFilterHasSelection = false,
  positionFilter,
  positionFilterHasSelection = false,
  selectedTab,
  setAggregateTrades,
  setHideSmallBalances,
  setMarketFilter,
  setPositionFilter,
}: AccountActivityPanelControlsState & {
  selectedTab: Exclude<AccountActivityFooterTab, "trade">;
}) {
  return renderControls({
    aggregateTrades,
    control: getAccountActivityControl(selectedTab),
    hideSmallBalances,
    marketFilter,
    marketFilterHasSelection,
    positionFilter,
    positionFilterHasSelection,
    setAggregateTrades,
    setHideSmallBalances,
    setMarketFilter,
    setPositionFilter,
  });
}

function getActivityRowCellClass() {
  return "border-b border-cyan-100/[0.045] px-4 py-3 align-middle transition-colors duration-150 group-hover:bg-white/[0.085]";
}

function getCellToneClass({
  column,
  row,
  selectedTab,
}: {
  column: Column;
  row: LedgerRow;
  selectedTab: Exclude<AccountActivityFooterTab, "trade">;
}) {
  const cellValue = row.cells[column.id];

  if (isUnavailableValue(cellValue)) {
    return TONE_CLASS.muted;
  }

  if (column.id === "coin") {
    return getCoinToneClass(selectedTab, row);
  }

  if (column.id === "funding" || column.id === "payment") {
    return getSignedValueTone(cellValue) ?? TONE_CLASS[row.tone];
  }

  if (
    (selectedTab === "trade-history" || selectedTab === "order-history") &&
    column.id === "direction"
  ) {
    return getTradeHistoryDirectionToneClass(row.cells.direction);
  }

  if (selectedTab === "funding-history" && column.id === "positionSide") {
    return getTradeHistoryDirectionToneClass(row.cells.positionSide);
  }

  if (
    selectedTab === "trade-history" &&
    column.id === "closedPnl" &&
    !isClosedTradeRow(row)
  ) {
    return "text-white/68";
  }

  if (column.id === "pnlRoe" || column.id === "closedPnl") {
    return getSignedValueTone(cellValue) ?? TONE_CLASS[row.tone];
  }

  if (selectedTab === "positions" && column.id === "coin") {
    return "text-[#63E6BE]";
  }

  if (selectedTab === "positions" && column.id === "size") {
    if (row.direction === "long") {
      return TONE_CLASS.positive;
    }

    if (row.direction === "short") {
      return TONE_CLASS.negative;
    }
  }

  if (VALUE_TONE_COLUMNS.has(column.id)) {
    return TONE_CLASS[row.tone];
  }

  if (column.primary) {
    return "text-white/90";
  }

  return "text-white/68";
}

function renderActivityHeader({
  column,
  onCancelAllOrders,
  onCloseAllPositions,
  selectedTab,
}: {
  column: Column;
  onCancelAllOrders?: () => void;
  onCloseAllPositions?: () => void;
  selectedTab: Exclude<AccountActivityFooterTab, "trade">;
}) {
  if (
    selectedTab === "open-orders" &&
    column.headerAction === "cancel-all" &&
    onCancelAllOrders
  ) {
    return (
      <button
        type="button"
        className="text-[12px] font-semibold transition hover:brightness-125"
        style={PORTAL_ACTION_TEXT_STYLE}
        onClick={onCancelAllOrders}
      >
        Cancel All
      </button>
    );
  }

  if (
    selectedTab === "positions" &&
    column.headerAction === "close-all" &&
    onCloseAllPositions
  ) {
    return (
      <button
        type="button"
        className="text-[12px] font-semibold transition hover:brightness-125"
        style={PORTAL_ACTION_TEXT_STYLE}
        onClick={onCloseAllPositions}
      >
        Close All
      </button>
    );
  }

  return column.label;
}

function getSignedValueTone(value?: string) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("-")) {
    return TONE_CLASS.negative;
  }

  if (trimmedValue.startsWith("+")) {
    return TONE_CLASS.positive;
  }

  return null;
}

function getTradeHistoryDirectionToneClass(direction?: string) {
  const normalized = direction?.toLowerCase() ?? "";

  if (
    normalized.includes("open long") ||
    normalized.includes("close short") ||
    normalized === "long"
  ) {
    return TONE_CLASS.positive;
  }

  if (
    normalized.includes("open short") ||
    normalized.includes("close long") ||
    normalized === "short"
  ) {
    return TONE_CLASS.negative;
  }

  return TONE_CLASS.neutral;
}

function getCoinToneClass(
  selectedTab: Exclude<AccountActivityFooterTab, "trade">,
  row: LedgerRow,
) {
  if (selectedTab === "trade-history") {
    return getTradeHistoryDirectionToneClass(row.cells.direction);
  }

  if (selectedTab === "open-orders" || selectedTab === "order-history") {
    return getTradeHistoryDirectionToneClass(row.cells.direction);
  }

  if (selectedTab === "positions") {
    if (row.direction === "long") {
      return TONE_CLASS.positive;
    }

    if (row.direction === "short") {
      return TONE_CLASS.negative;
    }
  }

  if (selectedTab === "funding-history") {
    return getTradeHistoryDirectionToneClass(row.cells.positionSide);
  }

  return "text-white/90";
}

function isUnavailableValue(value?: string) {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toUpperCase();

  return (
    normalizedValue === "--" ||
    normalizedValue === "N/A" ||
    normalizedValue === "-- / --" ||
    /^--(?:\s+(?:USD|USDC|BTC|ETH|SOL))?$/.test(normalizedValue)
  );
}

function renderActivityCell({
  column,
  onClosePosition,
  onCancelOpenOrder,
  onDisarmMagicTradeRule,
  onEditMagicTradeRule,
  onFocusMagicTradeRule,
  onLimitCloseAtCurrentPrice,
  onLimitCloseSelectPrice,
  onReducePosition,
  onReversePosition,
  onSelectSymbol,
  positionActionInFlightSymbol,
  row,
  selectedTab,
  setTradeShareModal,
  setPositionActionModal,
  value,
}: {
  column: Column;
  onClosePosition?: (symbol: HyperliquidSymbol) => void;
  onCancelOpenOrder?: (
    symbol: HyperliquidSymbol,
    direction: TradeDirection,
    orderId: number,
  ) => void;
  onDisarmMagicTradeRule?: (ruleId: string) => void;
  onEditMagicTradeRule?: (ruleId: string) => void;
  onFocusMagicTradeRule?: (ruleId: string) => void;
  onLimitCloseAtCurrentPrice?: (symbol: HyperliquidSymbol, percent: number) => void;
  onLimitCloseSelectPrice?: (symbol: HyperliquidSymbol, percent: number) => void;
  onReducePosition?: (symbol: HyperliquidSymbol, percent: number) => void;
  onReversePosition?: (symbol: HyperliquidSymbol) => void;
  onSelectSymbol?: (symbol: HyperliquidSymbol) => void;
  positionActionInFlightSymbol?: HyperliquidSymbol | null;
  row: LedgerRow;
  selectedTab: Exclude<AccountActivityFooterTab, "trade">;
  setTradeShareModal: (modal: TradeShareModal | null) => void;
  setPositionActionModal: (modal: PositionActionModal | null) => void;
  value: string;
}) {
  if (
    selectedTab === "open-orders" &&
    column.id === "type" &&
    row.origin === "magic-trade" &&
    row.magicTradeRuleId &&
    onFocusMagicTradeRule
  ) {
    return (
      <button
        type="button"
        className="inline-flex max-w-full items-center text-left font-semibold text-violet-200/88 transition hover:text-cyan-100 focus:outline-none focus-visible:text-cyan-100"
        aria-label="Show Magic trigger on chart"
        onClick={() => onFocusMagicTradeRule(row.magicTradeRuleId as string)}
      >
        <span className="truncate border-b border-violet-300/24 pb-0.5 transition group-hover:border-cyan-200/42">
          {value}
        </span>
      </button>
    );
  }

  if (selectedTab === "trade-history" && column.id === "time") {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{value}</span>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center text-[#A78BFA]/88 transition hover:text-[#C4B5FD]"
          aria-label={`Open explorer for trade ${value}`}
          onClick={() => {
            window.open(row.explorerUrl ?? "https://app.hyperliquid.xyz/explorer", "_blank", "noopener,noreferrer");
          }}
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </button>
      </span>
    );
  }

  if (selectedTab === "trade-history" && column.id === "closedPnl") {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{value}</span>
        {row.share && isClosedTradeRow(row) && !isUnavailableValue(value) ? (
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center text-[#A78BFA]/88 transition hover:text-[#C4B5FD]"
            aria-label={`Share trade result ${value}`}
            onClick={() =>
              setTradeShareModal({
                row,
                selectedOverlay: TRADE_SHARE_OVERLAYS[0]?.id ?? "portal-core",
              })
            }
          >
            <ExternalLinkIcon className="h-4 w-4" />
          </button>
        ) : null}
      </span>
    );
  }

  if (selectedTab === "positions" && column.id === "pnlRoe") {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{value}</span>
        {row.share && !isUnavailableValue(row.share.pnlLabel) ? (
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center text-cyan-200/84 transition hover:text-cyan-100"
            aria-label={`Share position PNL ${row.share.pnlLabel}`}
            onClick={() =>
              setTradeShareModal({
                row,
                selectedOverlay: TRADE_SHARE_OVERLAYS[0]?.id ?? "portal-core",
              })
            }
          >
            <ExternalLinkIcon className="h-4 w-4" />
          </button>
        ) : null}
      </span>
    );
  }

  if (selectedTab === "open-orders" && column.id === "actions") {
    if (row.origin === "magic-trade") {
      const canEdit = Boolean(row.magicTradeRuleId && onEditMagicTradeRule);
      const canDisarm = Boolean(row.magicTradeRuleId && onDisarmMagicTradeRule);
      const editLabel = row.magicTradeReviewRequired ? "Review" : "Edit";

      return (
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            className={PORTAL_TEXT_BUTTON_CLASS}
            style={PORTAL_ACTION_TEXT_STYLE}
            disabled={!canEdit}
            onClick={() => {
              if (!row.magicTradeRuleId) {
                return;
              }

              onEditMagicTradeRule?.(row.magicTradeRuleId);
            }}
          >
            {editLabel}
          </button>
          <button
            type="button"
            className={PORTAL_TEXT_BUTTON_CLASS}
            style={PORTAL_ACTION_TEXT_STYLE}
            disabled={!canDisarm}
            onClick={() => {
              if (!row.magicTradeRuleId) {
                return;
              }

              onDisarmMagicTradeRule?.(row.magicTradeRuleId);
            }}
          >
            Disarm
          </button>
        </div>
      );
    }

    const canCancelOrder =
      Boolean(row.symbol && row.direction && row.orderId) && Boolean(onCancelOpenOrder);

    return (
      <button
        type="button"
        className={PORTAL_TEXT_BUTTON_CLASS}
        style={PORTAL_ACTION_TEXT_STYLE}
        disabled={!canCancelOrder}
        onClick={() => {
          if (!row.symbol || !row.direction || !row.orderId) {
            return;
          }

          onCancelOpenOrder?.(row.symbol, row.direction, row.orderId);
        }}
      >
        Cancel
      </button>
    );
  }

  if (selectedTab === "positions" && column.id === "actions" && row.symbol) {
    const isClosing = positionActionInFlightSymbol === row.symbol;

    return (
      <div className="inline-flex items-center gap-3">
        <button
          type="button"
          className={PORTAL_TEXT_BUTTON_CLASS}
          style={PORTAL_ACTION_TEXT_STYLE}
          disabled={
            isClosing ||
            (!onLimitCloseAtCurrentPrice && !onLimitCloseSelectPrice)
          }
          onClick={() =>
            setPositionActionModal({ kind: "limit", percent: 100, row })
          }
        >
          Limit
        </button>
        <button
          type="button"
          className={PORTAL_TEXT_BUTTON_CLASS}
          style={PORTAL_ACTION_TEXT_STYLE}
          disabled={isClosing || (!onReducePosition && !onClosePosition)}
          onClick={() =>
            setPositionActionModal({ kind: "market", percent: 100, row })
          }
        >
          Market
        </button>
        <button
          type="button"
          className={PORTAL_TEXT_BUTTON_CLASS}
          style={PORTAL_ACTION_TEXT_STYLE}
          disabled={isClosing || !onReversePosition}
          onClick={() => onReversePosition?.(row.symbol as HyperliquidSymbol)}
        >
          {isClosing ? "Working" : "Reverse"}
        </button>
      </div>
    );
  }

  if (selectedTab === "positions" && column.id === "coin") {
    return renderCoinCell(value, row.symbol, onSelectSymbol);
  }

  if (selectedTab === "positions" && column.id === "tpSl" && row.symbol) {
    const [target = "", stop = ""] = value.split("/").map((part) => part.trim());
    const shouldStackProtectionValues =
      Boolean(target) &&
      Boolean(stop) &&
      !isUnavailableValue(target) &&
      !isUnavailableValue(stop);

    return (
      <span className="inline-flex w-fit max-w-max items-center gap-2 align-middle">
        {shouldStackProtectionValues ? (
          <span className="inline-flex flex-col gap-1 leading-tight">
            <span>{target}</span>
            <span>{stop}</span>
          </span>
        ) : (
          <span>{value}</span>
        )}
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center transition hover:brightness-125"
          style={PORTAL_ACTION_TEXT_STYLE}
          aria-label={`Edit TP/SL for ${row.cells.coin ?? row.symbol}`}
          onClick={() => {
            setPositionActionModal({
              kind: "tpsl",
              row,
              stop: isUnavailableValue(stop) ? "" : stop,
              target: isUnavailableValue(target) ? "" : target,
            });
          }}
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M5 19.25 6.25 14 16.9 3.35a2.05 2.05 0 0 1 2.9 0l.85.85a2.05 2.05 0 0 1 0 2.9L10 17.75 5 19.25Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.1"
            />
            <path
              d="m15.25 5 3.75 3.75"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.1"
            />
          </svg>
        </button>
      </span>
    );
  }

  if (column.id === "actions") {
    return renderActionText(value);
  }

  if (column.id === "margin" && value.includes(" / ")) {
    const [amount, mode] = value.split(" / ");

    return (
      <span className="inline-flex flex-col gap-1 leading-tight">
        <span
          className={`font-mono ${
            isUnavailableValue(amount) ? TONE_CLASS.muted : "text-white/82"
          }`}
        >
          {amount}
        </span>
        <span className="text-[12px] text-white/48">{mode}</span>
      </span>
    );
  }

  return value;
}

function isClosedTradeRow(row: LedgerRow) {
  return row.cells.direction?.toLowerCase().startsWith("close") ?? false;
}

function renderActionText(value: string) {
  if (isUnavailableValue(value)) {
    return value;
  }

  return (
    <span
      className="font-semibold uppercase tracking-[0.11em]"
      style={PORTAL_ACTION_TEXT_STYLE}
    >
      {value}
    </span>
  );
}

function renderCoinCell(
  value: string,
  symbol?: HyperliquidSymbol,
  onSelectSymbol?: (symbol: HyperliquidSymbol) => void,
) {
  if (isUnavailableValue(value)) {
    return value;
  }

  const match = value.match(/^(.+?)\s+(\d+(?:\.\d+)?x)$/i);
  const coin = match?.[1] ?? value;
  const leverage = match?.[2] ?? null;

  const content = (
    <span className="inline-flex items-center gap-3">
      <span className="sr-only">{value}</span>
      <span className="text-[18px] font-semibold text-current">
        {coin}
      </span>
      {leverage ? (
        <span className="rounded-portal-chip border border-current/30 bg-white/[0.035] px-2 py-0.5 font-mono text-[13px] font-semibold text-current shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          {leverage}
        </span>
      ) : null}
    </span>
  );

  if (!symbol || !onSelectSymbol) {
    return content;
  }

  return (
    <button
      type="button"
      aria-label={`Open ${coin} chart`}
      className="inline-flex items-center text-current transition hover:brightness-125 focus:outline-none focus-visible:rounded-portal-control focus-visible:ring-1 focus-visible:ring-cyan-200/45"
      onClick={() => onSelectSymbol(symbol)}
    >
      {content}
    </button>
  );
}

export function PositionActivityModal({
  modal,
  onClose,
  onClosePosition,
  onLimitCloseAtCurrentPrice,
  onLimitCloseSelectPrice,
  onReducePosition,
  onUpdateProtectionLevels,
  positionActionInFlightSymbol,
}: {
  modal: PositionActionModal | null;
  onClose: () => void;
  onClosePosition?: (symbol: HyperliquidSymbol) => void;
  onLimitCloseAtCurrentPrice?: (symbol: HyperliquidSymbol, percent: number) => void;
  onLimitCloseSelectPrice?: (symbol: HyperliquidSymbol, percent: number) => void;
  onReducePosition?: (symbol: HyperliquidSymbol, percent: number) => void;
  onUpdateProtectionLevels?: (
    symbol: HyperliquidSymbol,
    levels: { stop: number; target: number },
  ) => void;
  positionActionInFlightSymbol?: HyperliquidSymbol | null;
}) {
  if (!modal || !modal.row.symbol) {
    return null;
  }

  const symbol = modal.row.symbol;
  const isWorking = positionActionInFlightSymbol === symbol;

  const overlay = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050A]/72 p-6 backdrop-blur-[10px]">
      <div
        className={`relative isolate w-full ${modal.kind === "tpsl" ? "max-w-[640px]" : "max-w-[560px]"} overflow-hidden rounded-portal-modal border border-cyan-100/[0.14] bg-[radial-gradient(circle_at_12%_8%,rgba(51,245,255,0.12),transparent_30%),radial-gradient(circle_at_82%_100%,rgba(139,92,246,0.12),transparent_34%),linear-gradient(180deg,rgba(9,18,29,0.92),rgba(5,8,14,0.88))] p-6 shadow-[0_26px_80px_rgba(0,0,0,0.58),0_0_0_1px_rgba(51,245,255,0.04),inset_0_1px_0_rgba(255,255,255,0.10)] portal-clip-modal`}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/48 to-transparent" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/54">
                {modal.kind === "tpsl" ? "Position Protection" : "Position Close"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white/92">
                {modal.kind === "market"
                  ? "Market Close"
                  : modal.kind === "limit"
                    ? "Limit Close"
                    : "Edit TP/SL"}
              </h2>
            </div>
            <button
              type="button"
              className="text-[22px] leading-none text-white/46 transition hover:text-white"
              onClick={onClose}
              aria-label="Close modal"
            >
              x
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-y border-white/[0.07] py-4 text-sm">
            <ModalStat label="Coin" value={modal.row.cells.coin ?? symbol} />
            <ModalStat label="Size" value={modal.row.cells.size ?? "--"} align="right" />
            <ModalStat label="Entry" value={modal.row.cells.entryPrice ?? "--"} />
            <ModalStat label="Mark" value={modal.row.cells.markPrice ?? "--"} align="right" />
          </div>

          {modal.kind === "tpsl" ? (
            <TpSlEditor
              modal={modal}
              onConfirm={(nextLevels) => {
                const stop = parseModalNumber(nextLevels.stop);
                const target = parseModalNumber(nextLevels.target);

                if (stop === null || target === null) {
                  return;
                }

                onUpdateProtectionLevels?.(symbol, { stop, target });
                onClose();
              }}
              disabled={isWorking || !onUpdateProtectionLevels}
            />
          ) : (
            <ClosePositionEditor
              modal={modal}
              onConfirmMarket={(percent) => {
                if (modal.kind !== "market") {
                  return;
                }

                if (percent >= 100) {
                  onClosePosition?.(symbol);
                } else {
                  onReducePosition?.(symbol, percent);
                }
                onClose();
              }}
              onLimitCurrent={(percent) => {
                if (modal.kind !== "limit") {
                  return;
                }

                onLimitCloseAtCurrentPrice?.(symbol, percent);
                onClose();
              }}
              onLimitPick={(percent) => {
                if (modal.kind !== "limit") {
                  return;
                }

                onLimitCloseSelectPrice?.(symbol, percent);
                onClose();
              }}
              disabled={isWorking}
              canMarket={Boolean(onClosePosition || onReducePosition)}
              canLimitCurrent={Boolean(onLimitCloseAtCurrentPrice)}
              canLimitPick={Boolean(onLimitCloseSelectPrice)}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
}

function TradeShareModalView({
  modal,
  onClose,
  onOverlayChange,
}: {
  modal: TradeShareModal | null;
  onClose: () => void;
  onOverlayChange: (selectedOverlay: string) => void;
}) {
  if (!modal?.row.share) {
    return null;
  }

  const share = modal.row.share;
  const selectedOverlay =
    TRADE_SHARE_OVERLAYS.find((overlay) => overlay.id === modal.selectedOverlay) ??
    TRADE_SHARE_OVERLAYS[0];
  const shareText = buildTradeShareText(share);

  const overlay = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050A]/76 p-6 backdrop-blur-[12px]">
      <div className="relative isolate grid w-full max-w-[1180px] grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)] gap-6 overflow-hidden rounded-portal-modal border border-cyan-100/[0.13] bg-[radial-gradient(circle_at_10%_8%,rgba(51,245,255,0.10),transparent_30%),radial-gradient(circle_at_84%_100%,rgba(139,92,246,0.12),transparent_34%),linear-gradient(180deg,rgba(9,18,29,0.92),rgba(5,8,14,0.90))] p-6 shadow-[0_26px_84px_rgba(0,0,0,0.60),inset_0_1px_0_rgba(255,255,255,0.10)] portal-clip-modal max-lg:grid-cols-1">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/46 to-transparent" />
        <button
          type="button"
          className="absolute right-5 top-4 z-10 text-[22px] leading-none text-white/46 transition hover:text-white"
          onClick={onClose}
          aria-label="Close trade share"
        >
          x
        </button>

        <div className="relative overflow-hidden rounded-portal-panel border border-cyan-100/[0.12] bg-[radial-gradient(circle_at_82%_52%,rgba(51,245,255,0.12),transparent_30%),radial-gradient(circle_at_16%_12%,rgba(139,92,246,0.18),transparent_32%),linear-gradient(135deg,rgba(6,24,24,0.72),rgba(4,8,16,0.92))] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] portal-clip-panel">
          <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:repeating-radial-gradient(circle_at_72%_52%,transparent_0,transparent_18px,rgba(51,245,255,0.42)_19px,transparent_20px)]" />
          <div className="relative flex min-h-[520px] flex-col justify-between">
            <div>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-portal-panel border border-[#8B5CF6]/46 bg-[#8B5CF6]/10 font-mono text-2xl font-semibold text-[#C4B5FD]">
                  {selectedOverlay.mark}
                </div>
                <div className="font-mono text-[22px] font-semibold uppercase tracking-[0.22em] text-cyan-50/88">
                  Portal Trade
                </div>
              </div>
              <div className="mt-10 flex items-center gap-3">
                <span className="text-3xl font-semibold text-white">
                  {share.coin}
                </span>
                <span className="rounded-portal-control border border-cyan-300/24 bg-cyan-300/[0.10] px-3 py-1 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-50">
                  {share.direction}
                </span>
              </div>
              <div className={`mt-8 font-mono text-[72px] font-semibold leading-none ${getSharePnlToneClass(share.pnlLabel)}`}>
                {share.pnlLabel}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-5 border-t border-white/[0.08] pt-6">
              <SharePreviewStat label="Price" value={share.priceLabel} />
              <SharePreviewStat label="Size" value={share.sizeLabel} />
              <SharePreviewStat label="Value" value={share.tradeValueLabel} />
            </div>
          </div>
        </div>

        <div className="relative flex flex-col justify-between gap-6 py-2">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/42">
              Customize Text
            </div>
            <div className="mt-3 rounded-portal-control border border-white/[0.10] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-white/82">
              {shareText}
            </div>

            <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/42">
              Overlay
            </div>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {TRADE_SHARE_OVERLAYS.map((overlayOption) => (
                <button
                  key={overlayOption.id}
                  type="button"
                  className={`flex aspect-square items-center justify-center rounded-portal-control border font-mono text-xl font-semibold transition ${
                    selectedOverlay.id === overlayOption.id
                      ? "border-cyan-300/70 bg-cyan-300/[0.10] text-cyan-50"
                      : "border-white/[0.10] bg-white/[0.025] text-white/42 hover:border-cyan-200/32 hover:text-white/70"
                  }`}
                  onClick={() => onOverlayChange(overlayOption.id)}
                  aria-label={`Use ${overlayOption.label} overlay`}
                >
                  {overlayOption.mark}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              className="h-12 rounded-portal-control border border-cyan-100/40 bg-cyan-300/[0.12] text-sm font-semibold text-white/90 transition hover:bg-cyan-300/[0.18]"
              onClick={() => saveTradeShareImage(share, selectedOverlay)}
            >
              Save Image
            </button>
            <button
              type="button"
              className="h-12 rounded-portal-control border border-cyan-100/24 bg-white/[0.035] text-sm font-semibold text-white/80 transition hover:border-cyan-100/40 hover:text-white"
              onClick={() => copyTradeShareText(shareText)}
            >
              Copy Link
            </button>
            <button
              type="button"
              className="h-12 rounded-portal-control border border-[#8B5CF6]/28 bg-[#8B5CF6]/10 text-sm font-semibold text-white/88 transition hover:bg-[#8B5CF6]/16"
              onClick={() => shareTradeOnX(shareText)}
            >
              Share on X
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
}

function SharePreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-white/42">{label}</div>
      <div className="mt-2 font-mono text-lg font-semibold text-white/90">
        {value}
      </div>
    </div>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M14 4h6v6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M20 4 11 13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function getSharePnlToneClass(pnlLabel: string) {
  return pnlLabel.trim().startsWith("-")
    ? "text-[#FF6B8E]"
    : "text-[#22C55E]";
}

function buildTradeShareText(share: TradeSharePayload) {
  return `Trade ${share.coin} ${share.direction} on Portal: ${share.pnlLabel}`;
}

function copyTradeShareText(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(text);
}

function shareTradeOnX(text: string) {
  window.open(
    `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
}

function saveTradeShareImage(
  share: TradeSharePayload,
  overlay: (typeof TRADE_SHARE_OVERLAYS)[number],
) {
  if (typeof document === "undefined") {
    return;
  }

  const svg = buildTradeShareSvg(share, overlay);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `portal-${share.coin.toLowerCase()}-trade.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildTradeShareSvg(
  share: TradeSharePayload,
  overlay: (typeof TRADE_SHARE_OVERLAYS)[number],
) {
  const pnlColor = share.pnlLabel.trim().startsWith("-") ? "#FF6B8E" : "#22C55E";
  const escapedDirection = escapeSvgText(share.direction);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <defs>
    <radialGradient id="cyan" cx="78%" cy="52%" r="48%">
      <stop offset="0%" stop-color="#33F5FF" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#33F5FF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="purple" cx="14%" cy="12%" r="42%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="760" rx="34" fill="#05060A"/>
  <rect width="1200" height="760" rx="34" fill="url(#cyan)"/>
  <rect width="1200" height="760" rx="34" fill="url(#purple)"/>
  <rect x="1.5" y="1.5" width="1197" height="757" rx="34" fill="none" stroke="#33F5FF" stroke-opacity="0.22" stroke-width="3"/>
  <text x="74" y="104" fill="#CFFAFE" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="34" font-weight="700" letter-spacing="10">PORTAL TRADE</text>
  <rect x="74" y="148" width="82" height="82" rx="18" fill="#8B5CF6" fill-opacity="0.11" stroke="#8B5CF6" stroke-opacity="0.55"/>
  <text x="115" y="202" text-anchor="middle" fill="#C4B5FD" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="42" font-weight="700">${escapeSvgText(overlay.mark)}</text>
  <text x="74" y="308" fill="#FFFFFF" font-family="Inter, ui-sans-serif, system-ui" font-size="52" font-weight="700">${escapeSvgText(share.coin)}</text>
  <rect x="210" y="262" width="260" height="58" rx="14" fill="#33F5FF" fill-opacity="0.11" stroke="#33F5FF" stroke-opacity="0.28"/>
  <text x="340" y="301" text-anchor="middle" fill="#ECFEFF" font-family="Inter, ui-sans-serif, system-ui" font-size="27" font-weight="700" letter-spacing="5">${escapedDirection}</text>
  <text x="74" y="466" fill="${pnlColor}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="112" font-weight="800">${escapeSvgText(share.pnlLabel)}</text>
  <line x1="74" y1="570" x2="1126" y2="570" stroke="#FFFFFF" stroke-opacity="0.10"/>
  <text x="74" y="632" fill="#94A3B8" font-family="Inter, ui-sans-serif, system-ui" font-size="24" font-weight="700">Price</text>
  <text x="74" y="680" fill="#FFFFFF" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="32">${escapeSvgText(share.priceLabel)}</text>
  <text x="390" y="632" fill="#94A3B8" font-family="Inter, ui-sans-serif, system-ui" font-size="24" font-weight="700">Size</text>
  <text x="390" y="680" fill="#FFFFFF" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="32">${escapeSvgText(share.sizeLabel)}</text>
  <text x="720" y="632" fill="#94A3B8" font-family="Inter, ui-sans-serif, system-ui" font-size="24" font-weight="700">Trade Value</text>
  <text x="720" y="680" fill="#FFFFFF" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="32">${escapeSvgText(share.tradeValueLabel)}</text>
</svg>`;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ModalStat({
  align = "left",
  label,
  value,
}: {
  align?: "left" | "right";
  label: string;
  value: string;
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">
        {label}
      </div>
      <div className="mt-1 font-mono text-[15px] text-white/86">{value}</div>
    </div>
  );
}

function ClosePositionEditor({
  canLimitCurrent,
  canLimitPick,
  canMarket,
  disabled,
  modal,
  onConfirmMarket,
  onLimitCurrent,
  onLimitPick,
}: {
  canLimitCurrent: boolean;
  canLimitPick: boolean;
  canMarket: boolean;
  disabled: boolean;
  modal: Extract<PositionActionModal, { kind: "market" | "limit" }>;
  onConfirmMarket: (percent: number) => void;
  onLimitCurrent: (percent: number) => void;
  onLimitPick: (percent: number) => void;
}) {
  const [percent, setPercent] = useState(modal.percent);

  function updatePercent(nextPercent: number) {
    const snappedPercent = snapClosePercent(nextPercent);
    setPercent(snappedPercent);
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/66">
          Size
        </div>
        <div className="font-mono text-lg font-semibold text-cyan-50">
          {percent}%
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        value={percent}
        onChange={(event) => updatePercent(Number(event.target.value))}
        className="portal-close-slider mt-4 w-full"
        style={
          {
            "--portal-close-progress": `${percent}%`,
          } as React.CSSProperties
        }
      />
      <div className="mt-2 grid grid-cols-3 text-center font-mono text-[12px] font-semibold text-white/46">
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
      </div>

      {modal.kind === "market" ? (
        <button
          type="button"
          className="mt-6 h-12 w-full rounded-portal-panel border border-cyan-100/54 bg-cyan-300/[0.08] text-sm font-semibold text-white/90 transition hover:bg-cyan-300/[0.14] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={disabled || !canMarket}
          onClick={() => onConfirmMarket(percent)}
        >
          Market Close
        </button>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-portal-panel border border-cyan-100/42 bg-cyan-300/[0.07] text-sm font-semibold text-white/88 transition hover:bg-cyan-300/[0.13] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={disabled || !canLimitCurrent}
            onClick={() => onLimitCurrent(percent)}
          >
            Current Price
          </button>
          <button
            type="button"
            className="h-12 rounded-portal-panel border border-white/[0.12] bg-white/[0.035] text-sm font-semibold text-white/72 transition hover:border-cyan-100/28 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={disabled || !canLimitPick}
            onClick={() => onLimitPick(percent)}
          >
            Pick On Chart
          </button>
        </div>
      )}
    </div>
  );
}

function TpSlEditor({
  disabled,
  modal,
  onConfirm,
}: {
  disabled: boolean;
  modal: Extract<PositionActionModal, { kind: "tpsl" }>;
  onConfirm: (levels: { stop: string; target: string }) => void;
}) {
  const offsetContext = getProtectionOffsetContext(modal.row);
  const [target, setTarget] = useState(modal.target);
  const [stop, setStop] = useState(modal.stop);
  const [targetOffsetUnit, setTargetOffsetUnit] =
    useState<ProtectionOffsetUnit>("percent");
  const [stopOffsetUnit, setStopOffsetUnit] =
    useState<ProtectionOffsetUnit>("percent");
  const [targetOffset, setTargetOffset] = useState(() =>
    getProtectionOffsetInputValue({
      context: offsetContext,
      kind: "target",
      priceInput: modal.target,
      unit: "percent",
    }),
  );
  const [stopOffset, setStopOffset] = useState(() =>
    getProtectionOffsetInputValue({
      context: offsetContext,
      kind: "stop",
      priceInput: modal.stop,
      unit: "percent",
    }),
  );

  const canUseOffsets = offsetContext !== null;

  function updatePriceFromOffset(input: {
    kind: ProtectionOffsetKind;
    offsetInput: string;
    setPrice: (value: string) => void;
    unit: ProtectionOffsetUnit;
  }) {
    if (!offsetContext) {
      return;
    }

    const offset = parseProtectionNumber(input.offsetInput);

    if (offset === null) {
      return;
    }

    const price = resolveProtectionPriceFromOffset({
      ...offsetContext,
      kind: input.kind,
      offset,
      unit: input.unit,
    });

    if (price !== null) {
      input.setPrice(formatProtectionPriceInput(price));
    }
  }

  function updateOffsetFromPrice(input: {
    kind: ProtectionOffsetKind;
    priceInput: string;
    setOffset: (value: string) => void;
    unit: ProtectionOffsetUnit;
  }) {
    input.setOffset(
      getProtectionOffsetInputValue({
        context: offsetContext,
        kind: input.kind,
        priceInput: input.priceInput,
        unit: input.unit,
      }),
    );
  }

  return (
    <div className="mt-5">
      <div className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(140px,0.95fr)] gap-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              TP Price
            </span>
            <input
              className="mt-2 h-12 w-full rounded-portal-control border border-cyan-100/[0.12] bg-white/[0.035] px-3 font-mono text-white/86 outline-none transition placeholder:text-white/34 focus:border-cyan-200/40"
              inputMode="decimal"
              placeholder="TP Price"
              value={target}
              onChange={(event) => {
                const nextTarget = event.target.value;

                setTarget(nextTarget);
                updateOffsetFromPrice({
                  kind: "target",
                  priceInput: nextTarget,
                  setOffset: setTargetOffset,
                  unit: targetOffsetUnit,
                });
              }}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Gain
            </span>
            <div className={PROTECTION_OFFSET_FIELD_CLASS}>
              <input
                aria-label="Take-profit gain"
                className={PROTECTION_TEXT_INPUT_CLASS}
                disabled={disabled || !canUseOffsets}
                inputMode="decimal"
                placeholder="Gain"
                value={targetOffset}
                onChange={(event) => {
                  const nextOffset = event.target.value;

                  setTargetOffset(nextOffset);
                  updatePriceFromOffset({
                    kind: "target",
                    offsetInput: nextOffset,
                    setPrice: setTarget,
                    unit: targetOffsetUnit,
                  });
                }}
              />
              <div className="relative flex h-full shrink-0 items-center border-l border-cyan-100/[0.10]">
                <select
                  aria-label="Take-profit gain unit"
                  className={PROTECTION_UNIT_SELECT_CLASS}
                  disabled={disabled || !canUseOffsets}
                  value={targetOffsetUnit}
                  onChange={(event) => {
                    const nextUnit = event.target.value as ProtectionOffsetUnit;

                    setTargetOffsetUnit(nextUnit);
                    updateOffsetFromPrice({
                      kind: "target",
                      priceInput: target,
                      setOffset: setTargetOffset,
                      unit: nextUnit,
                    });
                  }}
                >
                  <option value="percent">%</option>
                  <option value="usdc">$</option>
                </select>
                <span className="pointer-events-none absolute right-2 text-[10px] text-cyan-50/44">
                  v
                </span>
              </div>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(140px,0.95fr)] gap-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              SL Price
            </span>
            <input
              className="mt-2 h-12 w-full rounded-portal-control border border-cyan-100/[0.12] bg-white/[0.035] px-3 font-mono text-white/86 outline-none transition placeholder:text-white/34 focus:border-cyan-200/40"
              inputMode="decimal"
              placeholder="SL Price"
              value={stop}
              onChange={(event) => {
                const nextStop = event.target.value;

                setStop(nextStop);
                updateOffsetFromPrice({
                  kind: "stop",
                  priceInput: nextStop,
                  setOffset: setStopOffset,
                  unit: stopOffsetUnit,
                });
              }}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Loss
            </span>
            <div className={PROTECTION_OFFSET_FIELD_CLASS}>
              <input
                aria-label="Stop-loss loss"
                className={PROTECTION_TEXT_INPUT_CLASS}
                disabled={disabled || !canUseOffsets}
                inputMode="decimal"
                placeholder="Loss"
                value={stopOffset}
                onChange={(event) => {
                  const nextOffset = event.target.value;

                  setStopOffset(nextOffset);
                  updatePriceFromOffset({
                    kind: "stop",
                    offsetInput: nextOffset,
                    setPrice: setStop,
                    unit: stopOffsetUnit,
                  });
                }}
              />
              <div className="relative flex h-full shrink-0 items-center border-l border-cyan-100/[0.10]">
                <select
                  aria-label="Stop-loss loss unit"
                  className={PROTECTION_UNIT_SELECT_CLASS}
                  disabled={disabled || !canUseOffsets}
                  value={stopOffsetUnit}
                  onChange={(event) => {
                    const nextUnit = event.target.value as ProtectionOffsetUnit;

                    setStopOffsetUnit(nextUnit);
                    updateOffsetFromPrice({
                      kind: "stop",
                      priceInput: stop,
                      setOffset: setStopOffset,
                      unit: nextUnit,
                    });
                  }}
                >
                  <option value="percent">%</option>
                  <option value="usdc">$</option>
                </select>
                <span className="pointer-events-none absolute right-2 text-[10px] text-cyan-50/44">
                  v
                </span>
              </div>
            </div>
          </label>
        </div>
      </div>
      <button
        type="button"
        className="mt-6 h-12 w-full rounded-portal-panel border border-cyan-100/54 bg-cyan-300/[0.10] text-sm font-semibold text-white/90 transition hover:bg-cyan-300/[0.16] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={
          disabled ||
          parseModalNumber(target) === null ||
          parseModalNumber(stop) === null
        }
        onClick={() => onConfirm({ stop, target })}
      >
        Confirm Protection
      </button>
      <p className="mt-4 border-t border-white/[0.07] pt-4 text-center text-[12px] leading-relaxed text-white/42">
        TP/SL orders apply to the live position and sync to Hyperliquid
        testnet.
      </p>
    </div>
  );
}

function getProtectionOffsetContext(row: LedgerRow) {
  const entryPrice = parseProtectionNumber(row.cells.entryPrice ?? "");
  const positionSize = Math.abs(parseProtectionNumber(row.cells.size ?? "") ?? 0);

  if (!row.direction || entryPrice === null || positionSize <= 0) {
    return null;
  }

  return {
    direction: row.direction,
    entryPrice,
    positionSize,
  };
}

function getProtectionOffsetInputValue({
  context,
  kind,
  priceInput,
  unit,
}: {
  context: ReturnType<typeof getProtectionOffsetContext>;
  kind: ProtectionOffsetKind;
  priceInput: string;
  unit: ProtectionOffsetUnit;
}) {
  if (!context) {
    return "";
  }

  const price = parseProtectionNumber(priceInput);

  if (price === null) {
    return "";
  }

  return formatProtectionOffsetInput(
    resolveProtectionOffsetFromPrice({
      ...context,
      kind,
      price,
      unit,
    }),
    unit,
  );
}

function snapClosePercent(value: number) {
  const roundedValue = Math.min(100, Math.max(1, Math.round(value)));
  const snapPoints = [25, 50, 75, 100];
  const snapPoint = snapPoints.find(
    (point) => Math.abs(point - roundedValue) <= 3,
  );

  return snapPoint ?? roundedValue;
}

function parseModalNumber(value: string) {
  const parsedValue = Number(value.replace(/,/g, "").trim());

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function getTableConfig(
  selectedTab: Exclude<AccountActivityFooterTab, "trade">,
  ledger: AccountActivityLedger,
  positionFilter: AccountActivityPositionFilter,
  marketFilter: string,
  activeSymbol?: HyperliquidSymbol,
  hideSmallBalances = false,
): TableConfig {
  switch (selectedTab) {
    case "positions":
      return {
        columns: [
          col("coin", "Coin", { primary: true, minWidth: "128px" }),
          col("size", "Size", { primary: true, mono: true, minWidth: "150px" }),
          col("positionValue", "Position Value", { mono: true, minWidth: "150px" }),
          col("entryPrice", "Entry Price", { mono: true, minWidth: "132px" }),
          col("markPrice", "Mark Price", { mono: true, minWidth: "132px" }),
          col("pnlRoe", "PNL (ROE %)", { primary: true, mono: true, minWidth: "150px" }),
          col("liqPrice", "Liq. Price", { mono: true, minWidth: "126px" }),
          col("margin", "Margin", { mono: true, minWidth: "160px" }),
          col("funding", "Funding", { mono: true, minWidth: "120px" }),
          col("tpSl", "TP/SL", { mono: true, minWidth: "150px" }),
          col("actions", "Actions", { headerAction: "close-all", minWidth: "170px" }),
        ],
        control: getAccountActivityControl(selectedTab),
        emptyLabel: "No open positions yet",
        rows: filterPositionRows(ledger.positions.rows, positionFilter),
        title: "Positions",
      };
    case "open-orders":
      return {
        columns: [
          col("time", "Time", { mono: true, minWidth: "112px" }),
          col("type", "Type", { minWidth: "94px" }),
          col("coin", "Coin", { primary: true, minWidth: "94px" }),
          col("direction", "Direction", { minWidth: "110px" }),
          col("size", "Size", { mono: true, minWidth: "120px" }),
          col("originalSize", "Original Size", { mono: true, minWidth: "140px" }),
          col("orderValue", "Order Value", { mono: true, minWidth: "132px" }),
          col("price", "Price", { mono: true, minWidth: "120px" }),
          col("reduceOnly", "Reduce Only", { minWidth: "112px" }),
          col("triggerConditions", "Trigger Conditions", { minWidth: "170px" }),
          col("tpSl", "TP/SL", { mono: true, minWidth: "110px" }),
          col("actions", "Actions", { headerAction: "cancel-all", minWidth: "130px" }),
        ],
        control: getAccountActivityControl(selectedTab),
        emptyLabel: "No open orders yet",
        rows: filterAccountActivityRows(
          ledger.openOrders.rows,
          marketFilter,
          activeSymbol,
        ),
        title: "Open Orders",
      };
    case "trade-history":
      return {
        columns: [
          col("time", "Time", { mono: true, minWidth: "112px" }),
          col("coin", "Coin", { primary: true, minWidth: "94px" }),
          col("direction", "Direction", { minWidth: "124px" }),
          col("price", "Price", { mono: true, minWidth: "120px" }),
          col("size", "Size", { mono: true, minWidth: "120px" }),
          col("tradeValue", "Trade Value", { mono: true, minWidth: "132px" }),
          col("fee", "Fee", { mono: true, minWidth: "110px" }),
          col("closedPnl", "Closed PNL", { primary: true, mono: true, minWidth: "132px" }),
        ],
        control: getAccountActivityControl(selectedTab),
        emptyLabel: "No trade history yet",
        rows: filterAccountActivityRows(
          ledger.tradeHistory.rows,
          marketFilter,
          activeSymbol,
        ),
        title: "Trade History",
      };
    case "funding-history":
      return {
        columns: [
          col("time", "Time", { mono: true, minWidth: "112px" }),
          col("coin", "Coin", { primary: true, minWidth: "94px" }),
          col("size", "Size", { mono: true, minWidth: "130px" }),
          col("positionSide", "Position Side", { minWidth: "132px" }),
          col("payment", "Payment", { primary: true, mono: true, minWidth: "132px" }),
          col("rate", "Rate", { mono: true, minWidth: "110px" }),
        ],
        control: getAccountActivityControl(selectedTab),
        emptyLabel: "No funding history yet",
        rows: filterAccountActivityRows(
          ledger.fundingHistory.rows,
          marketFilter,
          activeSymbol,
        ),
        title: "Funding History",
      };
    case "order-history":
      return {
        columns: [
          col("time", "Time", { mono: true, minWidth: "112px" }),
          col("type", "Type", { minWidth: "94px" }),
          col("coin", "Coin", { primary: true, minWidth: "94px" }),
          col("direction", "Direction", { minWidth: "110px" }),
          col("size", "Size", { mono: true, minWidth: "120px" }),
          col("filledSize", "Filled Size", { mono: true, minWidth: "130px" }),
          col("orderValue", "Order Value", { mono: true, minWidth: "132px" }),
          col("price", "Price", { mono: true, minWidth: "120px" }),
          col("reduceOnly", "Reduce Only", { minWidth: "112px" }),
          col("triggerConditions", "Trigger Conditions", { minWidth: "170px" }),
          col("tpSl", "TP/SL", { mono: true, minWidth: "110px" }),
          col("status", "Status", { minWidth: "116px" }),
          col("orderId", "Order ID", { mono: true, minWidth: "120px" }),
        ],
        control: getAccountActivityControl(selectedTab),
        emptyLabel: "No order history yet",
        rows: filterAccountActivityRows(
          ledger.orderHistory.rows,
          marketFilter,
          activeSymbol,
        ),
        title: "Order History",
      };
    case "balances":
      return {
        columns: [
          col("coin", "Coin", { primary: true, minWidth: "140px" }),
          col("totalBalance", "Total Balance", { mono: true, minWidth: "150px" }),
          col("availableBalance", "Available Balance", { primary: true, mono: true, minWidth: "170px" }),
          col("usdcValue", "USDC Value", { mono: true, minWidth: "140px" }),
          col("pnlRoe", "PNL (ROE %)", { primary: true, mono: true, minWidth: "150px" }),
          col("send", "Send", { minWidth: "210px" }),
          col("transfer", "Transfer", { minWidth: "170px" }),
          col("repay", "Repay", { minWidth: "100px" }),
          col("contract", "Contract", { mono: true, minWidth: "150px" }),
        ],
        control: getAccountActivityControl(selectedTab),
        emptyLabel: "No balances found",
        rows: filterBalanceRows(ledger.balances.rows, hideSmallBalances),
        title: "Balances",
      };
  }
}

function getAccountActivityControl(
  selectedTab: Exclude<AccountActivityFooterTab, "trade">,
): AccountActivityPanelControl {
  switch (selectedTab) {
    case "open-orders":
      return "activity-filter";
    case "trade-history":
      return "trade-history";
    case "funding-history":
    case "order-history":
      return "filter";
    case "positions":
      return "positions-filter";
    case "balances":
      return "balance-filter";
  }
}

function filterPositionRows(
  rows: LedgerRow[],
  positionFilter: AccountActivityPositionFilter,
) {
  if (positionFilter === "all" || positionFilter === "active") {
    return rows;
  }

  return rows.filter((row) => row.direction === positionFilter);
}

function filterAccountActivityRows(
  rows: LedgerRow[],
  marketFilter: string,
  activeSymbol?: HyperliquidSymbol,
) {
  if (marketFilter === "all" || marketFilter === "active") {
    return rows;
  }

  if (marketFilter === "current") {
    const activeCoin = getCoinFromSymbol(activeSymbol);

    if (!activeCoin) {
      return rows;
    }

    return rows.filter((row) => rowMatchesCoin(row, activeCoin));
  }

  if (marketFilter === "long" || marketFilter === "short") {
    return rows.filter((row) => {
      const directionValue = row.cells.direction ?? row.cells.positionSide;

      return directionValue?.toLowerCase().includes(marketFilter);
    });
  }

  if (marketFilter === "reduce-only") {
    return rows.filter((row) => row.cells.reduceOnly === "Yes");
  }

  if (marketFilter === "trigger") {
    return rows.filter((row) => {
      const trigger = row.cells.triggerConditions;
      const type = row.cells.type;

      return (
        (trigger !== undefined && !isUnavailableValue(trigger) && trigger !== "N/A") ||
        type?.toLowerCase().includes("stop") ||
        type?.toLowerCase().includes("take profit")
      );
    });
  }

  if (marketFilter === "tp-sl") {
    return rows.filter((row) => row.cells.tpSl === "Yes");
  }

  return rows;
}

function filterBalanceRows(rows: LedgerRow[], hideSmallBalances: boolean) {
  if (!hideSmallBalances) {
    return rows;
  }

  return rows.filter((row) => {
    const coin = row.cells.coin?.toUpperCase() ?? "";

    if (coin.includes("USDC") || coin.includes("USDT") || coin.includes("USD")) {
      return true;
    }

    const usdcValue = parseUsdValue(row.cells.usdcValue);

    return usdcValue === null || usdcValue >= 1;
  });
}

function getCoinFromSymbol(symbol?: HyperliquidSymbol) {
  if (!symbol) {
    return null;
  }

  return symbol.split("-")[0]?.toUpperCase() || null;
}

function rowMatchesCoin(row: LedgerRow, coin: string) {
  const rowCoin = row.cells.coin?.toUpperCase() ?? "";

  return row.symbol === `${coin}-USD` || rowCoin === coin || rowCoin.startsWith(`${coin} `);
}

function parseUsdValue(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[$,\s]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function col(id: string, label: string, options: Omit<Column, "id" | "label"> = {}): Column {
  return { id, label, ...options };
}

function renderControls(details: {
  aggregateTrades: boolean;
  control: AccountActivityPanelControl;
  hideSmallBalances: boolean;
  marketFilter: string;
  marketFilterHasSelection?: boolean;
  positionFilter: AccountActivityPositionFilter;
  positionFilterHasSelection?: boolean;
  setAggregateTrades: (value: boolean) => void;
  setHideSmallBalances: (value: boolean) => void;
  setMarketFilter: (value: string) => void;
  setPositionFilter: (value: AccountActivityPositionFilter) => void;
}) {
  if (details.control === "positions-filter") {
    return renderHyperliquidFilterSelect({
      hasSelection: details.positionFilterHasSelection,
      value: details.positionFilter,
      onChange: (value) =>
        details.setPositionFilter(value as AccountActivityPositionFilter),
    });
  }

  if (details.control === "activity-filter" || details.control === "filter") {
    return renderHyperliquidFilterSelect({
      hasSelection: details.marketFilterHasSelection,
      value: details.marketFilter,
      onChange: details.setMarketFilter,
    });
  }

  if (details.control === "trade-history") {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {renderHyperliquidFilterSelect({
          hasSelection: details.marketFilterHasSelection,
          value: details.marketFilter,
          onChange: details.setMarketFilter,
        })}
        <button
          type="button"
          aria-pressed={details.aggregateTrades}
          className="flex h-8 items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-white/90 transition hover:text-white"
          onClick={() => details.setAggregateTrades(!details.aggregateTrades)}
        >
          <span
            aria-hidden="true"
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border transition ${
              details.aggregateTrades
                ? "border-[#33F5FF] bg-[#33F5FF]/[0.035] shadow-[0_0_0_1px_rgba(51,245,255,0.18),0_0_14px_rgba(51,245,255,0.12),inset_0_0_10px_rgba(51,245,255,0.08)]"
                : "border-white/20 bg-transparent opacity-70"
            }`}
          >
            {details.aggregateTrades ? (
              <span className="h-[10px] w-[10px] rounded-[2px] bg-[#33F5FF] shadow-[0_0_10px_rgba(51,245,255,0.28)]" />
            ) : null}
          </span>
          Aggregate
        </button>
      </div>
    );
  }

  if (details.control === "balance-filter") {
    return (
      <div className="flex shrink-0 items-center gap-3">
        {renderHyperliquidFilterSelect({
          hasSelection: details.marketFilterHasSelection,
          value: details.marketFilter,
          onChange: details.setMarketFilter,
        })}
        <label className="flex h-8 items-center gap-2 text-[13px] font-semibold text-white/82">
          <input
            type="checkbox"
            className="sr-only"
            checked={details.hideSmallBalances}
            onChange={(event) => details.setHideSmallBalances(event.target.checked)}
          />
          <span
            aria-hidden="true"
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border transition ${
              details.hideSmallBalances
                ? "border-[#33F5FF] bg-[#33F5FF]/[0.035] shadow-[0_0_0_1px_rgba(51,245,255,0.18),0_0_14px_rgba(51,245,255,0.12),inset_0_0_10px_rgba(51,245,255,0.08)]"
                : "border-white/20 bg-transparent opacity-70"
            }`}
          >
            {details.hideSmallBalances ? (
              <span className="h-[10px] w-[10px] rounded-[2px] bg-[#33F5FF] shadow-[0_0_10px_rgba(51,245,255,0.28)]" />
            ) : null}
          </span>
          Hide Small Balances
        </label>
      </div>
    );
  }

  return null;
}

function renderHyperliquidFilterSelect(details: {
  hasSelection?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const hasSelection = Boolean(details.hasSelection);
  const triggerLabel = getAccountActivityFilterTriggerLabel(
    details.value,
    hasSelection,
  );
  const selectValue = !hasSelection && details.value === "all" ? "" : details.value;

  return (
    <label className="group relative flex h-8 shrink-0 items-center">
      <span className="sr-only">Filter</span>
      <span aria-hidden="true" className={ACCOUNT_ACTIVITY_FILTER_TRIGGER_CLASS}>
        {triggerLabel}
        <svg
          className="h-3 w-3 text-white/64 transition group-hover:text-white/82"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <select
        aria-label="Filter"
        className={ACCOUNT_ACTIVITY_FILTER_SELECT_CLASS}
        value={selectValue}
        onChange={(event) => details.onChange(event.target.value || "all")}
      >
        <option value="" hidden>
          Filter
        </option>
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
      </select>
    </label>
  );
}

function getAccountActivityFilterTriggerLabel(
  value: string,
  hasSelection: boolean,
) {
  if (!hasSelection && value === "all") {
    return "Filter";
  }

  return ACCOUNT_ACTIVITY_FILTER_LABELS[value] ?? "Filter";
}

function renderMarketFilterSelect(details: {
  marketFilter: string;
  setMarketFilter: (value: string) => void;
}) {
  return (
    <label className="group relative flex h-8 shrink-0 items-center">
      <span className="sr-only">Filter</span>
      <span aria-hidden="true" className={ACCOUNT_ACTIVITY_FILTER_TRIGGER_CLASS}>
        Filter
        <svg
          className="h-3 w-3 text-white/64 transition group-hover:text-white/82"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <select
        aria-label="Filter"
        className={ACCOUNT_ACTIVITY_FILTER_SELECT_CLASS}
        value={details.marketFilter}
        onChange={(event) => details.setMarketFilter(event.target.value)}
      >
        <option value="all">All Markets</option>
        <option value="current">Current Market</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
        <option value="reduce-only">Reduce Only</option>
        <option value="trigger">Trigger Orders</option>
        <option value="tp-sl">TP/SL Orders</option>
      </select>
    </label>
  );
}

function LoadingRows({ columns }: { columns: Column[] }) {
  return (
    <div className="p-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 6)}, minmax(96px, 1fr))` }}>
        {Array.from({ length: Math.min(columns.length, 6) * 4 }, (_, index) => (
          <span
            key={index}
            className="h-8 rounded-portal-control border border-white/[0.04] bg-white/[0.035]"
          />
        ))}
      </div>
    </div>
  );
}

function StateMessage({
  label,
  tone,
}: {
  label: string;
  tone: AccountActivityRowTone;
}) {
  return (
    <div className={`px-4 py-5 text-left text-[13px] ${TONE_CLASS[tone]}`}>
      {label}
    </div>
  );
}
