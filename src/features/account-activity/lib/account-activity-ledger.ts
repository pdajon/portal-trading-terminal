import type {
  AvailableToTradeBySide,
  LiveExchangePosition,
  LivePendingOrder,
  PendingLimitOrder,
  TradeDirection,
} from "@/types/trade";
import type { SessionLogEntry } from "@/features/session-log/lib/session-log";
import type { HyperliquidSymbol } from "@/types/market";
import type {
  TagAlongRule,
  TargetAction,
  WatchedCondition,
} from "@/features/tag-along/lib/tag-along-rules";
import {
  getMagicTradeDisplayMarginUsd,
  isMagicTradeMarginReviewRequired,
} from "@/features/tag-along/lib/magic-trade-margin-reservation";

export type AccountActivityFooterTab =
  | "trade"
  | "positions"
  | "open-orders"
  | "trade-history"
  | "funding-history"
  | "order-history"
  | "balances";

export const ACCOUNT_ACTIVITY_FOOTER_TABS: Array<{
  id: AccountActivityFooterTab;
  label: string;
}> = [
  { id: "trade", label: "Trade" },
  { id: "positions", label: "Positions" },
  { id: "open-orders", label: "Open Orders" },
  { id: "trade-history", label: "Trade History" },
  { id: "funding-history", label: "Funding History" },
  { id: "order-history", label: "Order History" },
  { id: "balances", label: "Balances" },
];

export type AccountActivityRowTone =
  | "neutral"
  | "positive"
  | "negative"
  | "warning"
  | "muted"
  | "cyan";

export type PositionLedgerRow = {
  id: string;
  symbol: HyperliquidSymbol;
  direction: TradeDirection;
  share: TradeSharePayload;
  tone: AccountActivityRowTone;
  cells: {
    coin: string;
    size: string;
    positionValue: string;
    entryPrice: string;
    markPrice: string;
    pnlRoe: string;
    liqPrice: string;
    margin: string;
    funding: string;
    tpSl: string;
    actions: string;
  };
  detail: Array<{ label: string; value: string; tone?: AccountActivityRowTone }>;
};

export type OpenOrderLedgerRow = {
  id: string;
  direction?: TradeDirection;
  magicTradeRuleId?: string;
  magicTradeReviewRequired?: boolean;
  orderId: number | null;
  origin: "exchange" | "local" | "magic-trade";
  symbol: HyperliquidSymbol;
  tone: AccountActivityRowTone;
  cells: {
    time: string;
    type: string;
    coin: string;
    direction: string;
    size: string;
    originalSize: string;
    orderValue: string;
    price: string;
    reduceOnly: string;
    triggerConditions: string;
    tpSl: string;
    actions: string;
  };
  detail: Array<{ label: string; value: string; tone?: AccountActivityRowTone }>;
};

export type MagicTradeLedgerRow = {
  id: string;
  tone: AccountActivityRowTone;
  cells: {
    time: string;
    event: string;
    coin: string;
    action: string;
    price: string;
    size: string;
    pnl: string;
    status: string;
  };
  detail: Array<{ label: string; value: string; tone?: AccountActivityRowTone }>;
};

export type TradeHistoryLedgerRow = {
  id: string;
  explorerUrl: string;
  share: TradeSharePayload;
  tone: AccountActivityRowTone;
  cells: {
    time: string;
    coin: string;
    direction: string;
    price: string;
    size: string;
    tradeValue: string;
    fee: string;
    closedPnl: string;
  };
  detail: Array<{ label: string; value: string; tone?: AccountActivityRowTone }>;
};

export type AccountTradeHistoryRecord = {
  closedPnl: number | null;
  coin: string;
  direction: string;
  feeUsdc: number | null;
  hash?: string | null;
  orderId?: number | string | null;
  price: number | null;
  side?: string | null;
  size: number | null;
  time: number | string;
  tradeValueUsdc?: number | null;
};

export type TradeSharePayload = {
  coin: string;
  direction: string;
  entryLabel: string;
  markLabel: string;
  pnlLabel: string;
  priceLabel: string;
  sizeLabel: string;
  timeLabel: string;
  tradeValueLabel: string;
};

export type FundingHistoryLedgerRow = {
  id: string;
  tone: AccountActivityRowTone;
  cells: {
    time: string;
    coin: string;
    size: string;
    positionSide: string;
    payment: string;
    rate: string;
  };
  detail: Array<{ label: string; value: string; tone?: AccountActivityRowTone }>;
};

export type AccountFundingHistoryRecord = {
  coin: string;
  hash?: string | null;
  paymentUsdc: number | null;
  rate: number | null;
  size: number | null;
  time: number | string;
};

export type OrderHistoryLedgerRow = {
  id: string;
  tone: AccountActivityRowTone;
  cells: {
    time: string;
    type: string;
    coin: string;
    direction: string;
    size: string;
    filledSize: string;
    orderValue: string;
    price: string;
    reduceOnly: string;
    triggerConditions: string;
    tpSl: string;
    status: string;
    orderId: string;
  };
  detail: Array<{ label: string; value: string; tone?: AccountActivityRowTone }>;
};

export type AccountOrderHistoryRecord = {
  coin: string;
  direction: string;
  filledSize: number | null;
  orderId: number | string | null;
  orderValueUsdc: number | null;
  price: number | null;
  reduceOnly: boolean | null;
  size: number | null;
  status: string;
  time: number | string;
  triggerConditions: string;
  tpSl: string;
  type: string;
};

export type BalanceLedgerRow = {
  id: string;
  tone: AccountActivityRowTone;
  cells: {
    availableBalance: string;
    coin: string;
    contract: string;
    pnlRoe: string;
    repay: string;
    send: string;
    totalBalance: string;
    transfer: string;
    usdcValue: string;
  };
  detail: Array<{ label: string; value: string; tone?: AccountActivityRowTone }>;
};

export type AccountBalanceRecord = {
  availableBalance: number | null;
  availableBalanceDisplay?: string | null;
  coin: string;
  coinLabel?: string | null;
  contractLabel?: string | null;
  pnlPercent?: number | null;
  pnlUsd?: number | null;
  repayLabel?: string | null;
  sendLabel?: string | null;
  totalBalance: number | null;
  totalBalanceDisplay?: string | null;
  transferLabel?: string | null;
  usdValue: number | null;
};

export type AccountActivityLedger = {
  positions: { count: number; rows: PositionLedgerRow[] };
  openOrders: { count: number; rows: OpenOrderLedgerRow[] };
  magicTrade: { count: number; rows: MagicTradeLedgerRow[] };
  tradeHistory: { count: number; rows: TradeHistoryLedgerRow[] };
  fundingHistory: { count: number; rows: FundingHistoryLedgerRow[] };
  orderHistory: { count: number; rows: OrderHistoryLedgerRow[] };
  balances: { count: number; rows: BalanceLedgerRow[] };
};

export type BuildAccountActivityLedgerInput = {
  accountValue: number | null;
  activeSymbol: HyperliquidSymbol;
  accountBalances?: AccountBalanceRecord[];
  accountFundingHistory?: AccountFundingHistoryRecord[];
  accountOrderHistory?: AccountOrderHistoryRecord[];
  accountTradeHistory?: AccountTradeHistoryRecord[];
  availableToTrade: number | null;
  availableToTradeBySide: AvailableToTradeBySide;
  livePendingOrders: LivePendingOrder[];
  magicTradeRules?: TagAlongRule[];
  pendingLimitOrders: PendingLimitOrder[];
  positions: LiveExchangePosition[];
  sessionLogEntries: SessionLogEntry[];
};

type AccountTradeHistoryAggregateBucket = {
  closedPnl: number;
  feeUsdc: number;
  hasClosedPnl: boolean;
  hasFeeUsdc: boolean;
  hasSize: boolean;
  hasTradeValueUsdc: boolean;
  row: AccountTradeHistoryRecord;
  size: number;
  tradeValueUsdc: number;
};

export function aggregateAccountTradeHistoryByTime(
  fills: AccountTradeHistoryRecord[],
): AccountTradeHistoryRecord[] {
  const buckets = new Map<string, AccountTradeHistoryAggregateBucket>();

  fills.forEach((fill) => {
    const coin = fill.coin.trim().toUpperCase();
    const direction = fill.direction.trim();
    const hash = fill.hash?.trim() ?? "";
    const orderId = fill.orderId ?? "";
    const side = fill.side?.trim() ?? "";
    const key = [
      fill.time,
      coin,
      direction,
      side,
      orderId,
      hash,
    ].join("|");
    const size = getFiniteNumber(fill.size);
    const absoluteSize = size !== null ? Math.abs(size) : null;
    const tradeValue = getTradeValueUsdc(fill);
    const feeUsdc = getFiniteNumber(fill.feeUsdc);
    const closedPnl = getFiniteNumber(fill.closedPnl);
    const bucket = buckets.get(key);

    if (!bucket) {
      buckets.set(key, {
        closedPnl: closedPnl ?? 0,
        feeUsdc: feeUsdc ?? 0,
        hasClosedPnl: closedPnl !== null,
        hasFeeUsdc: feeUsdc !== null,
        hasSize: absoluteSize !== null,
        hasTradeValueUsdc: tradeValue !== null,
        row: { ...fill, coin },
        size: absoluteSize ?? 0,
        tradeValueUsdc: tradeValue ?? 0,
      });
      return;
    }

    if (absoluteSize !== null) {
      bucket.hasSize = true;
      bucket.size += absoluteSize;
    }

    if (tradeValue !== null) {
      bucket.hasTradeValueUsdc = true;
      bucket.tradeValueUsdc += tradeValue;
    }

    if (feeUsdc !== null) {
      bucket.hasFeeUsdc = true;
      bucket.feeUsdc += feeUsdc;
    }

    if (closedPnl !== null) {
      bucket.hasClosedPnl = true;
      bucket.closedPnl += closedPnl;
    }
  });

  return Array.from(buckets.values())
    .map((bucket) => {
      const size = bucket.hasSize ? roundAccountNumber(bucket.size) : null;
      const tradeValueUsdc = bucket.hasTradeValueUsdc
        ? roundAccountNumber(bucket.tradeValueUsdc)
        : null;

      return {
        ...bucket.row,
        closedPnl: bucket.hasClosedPnl
          ? roundAccountNumber(bucket.closedPnl)
          : bucket.row.closedPnl,
        feeUsdc: bucket.hasFeeUsdc
          ? roundAccountNumber(bucket.feeUsdc)
          : bucket.row.feeUsdc,
        price:
          size !== null && size > 0 && tradeValueUsdc !== null
            ? roundAccountNumber(tradeValueUsdc / size)
            : bucket.row.price,
        size,
        tradeValueUsdc,
      } satisfies AccountTradeHistoryRecord;
    })
    .sort((left, right) => getEpochTime(right.time) - getEpochTime(left.time));
}

export function buildAccountActivityLedger(
  input: BuildAccountActivityLedgerInput,
): AccountActivityLedger {
  const openOrderRows = buildOpenOrderRows(input);
  const magicTradeRows = buildMagicTradeRows(input.sessionLogEntries);
  const tradeHistoryRows = buildTradeHistoryRows(
    input.sessionLogEntries,
    input.accountTradeHistory ?? [],
  );
  const fundingHistoryRows = buildFundingHistoryRows(
    input.accountFundingHistory ?? [],
    input.positions,
  );
  const orderHistoryRows = buildOrderHistoryRows(input, openOrderRows);
  const balanceRows = buildBalanceRows(input);

  return {
    balances: {
      count: balanceRows.length,
      rows: balanceRows,
    },
    fundingHistory: {
      count: fundingHistoryRows.length,
      rows: fundingHistoryRows,
    },
    magicTrade: {
      count: magicTradeRows.length,
      rows: magicTradeRows,
    },
    openOrders: {
      count: openOrderRows.length,
      rows: openOrderRows,
    },
    orderHistory: {
      count: orderHistoryRows.length,
      rows: orderHistoryRows,
    },
    positions: {
      count: input.positions.length,
      rows: input.positions.map(buildPositionRow),
    },
    tradeHistory: {
      count: tradeHistoryRows.length,
      rows: tradeHistoryRows,
    },
  };
}

function buildPositionRow(position: LiveExchangePosition): PositionLedgerRow {
  const pnlTone = getSignedTone(position.pnlUsd);
  const fundingTone = getSignedTone(position.fundingUsd);
  const baseAsset = getBaseAsset(position.symbol);
  const marginMode = "Cross";
  const leverageLabel =
    position.leverageValue !== null && Number.isFinite(position.leverageValue)
      ? `${position.leverageValue}x`
      : "--";
  const stopLabel = formatPrice(position.stopPrice);
  const targetLabel = formatPrice(position.targetPrice);
  const directionLabel = formatDirection(position.direction);
  const share = {
    coin: baseAsset,
    direction: `${directionLabel} ${leverageLabel}`,
    entryLabel: formatPrice(position.entryPrice),
    markLabel: formatPrice(position.markPrice),
    pnlLabel: formatSignedUsd(position.pnlUsd),
    priceLabel: formatPrice(position.markPrice),
    sizeLabel: `${formatNumber(Math.abs(position.size), 6)} ${baseAsset}`,
    timeLabel: "Open position",
    tradeValueLabel: formatUsdc(position.positionValueUsd),
  };

  return {
    cells: {
      actions: "Limit / Market / Reverse",
      coin: `${baseAsset} ${leverageLabel}`,
      entryPrice: formatPrice(position.entryPrice),
      funding: formatSignedUsdc(position.fundingUsd),
      liqPrice: formatPrice(position.liquidationPrice),
      margin: `${formatUsd(position.marginUsedUsd)} (${marginMode})`,
      markPrice: formatPrice(position.markPrice),
      pnlRoe: `${formatSignedUsd(position.pnlUsd)} (${formatSignedPercent(position.pnlPercent)})`,
      positionValue: formatUsdc(position.positionValueUsd),
      size: `${formatNumber(Math.abs(position.size), 6)} ${baseAsset}`,
      tpSl: `${targetLabel} / ${stopLabel}`,
    },
    detail: [
      { label: "Coin", value: baseAsset },
      { label: "Direction", value: formatDirection(position.direction), tone: getDirectionTone(position.direction) },
      { label: "Leverage", value: leverageLabel },
      { label: "Size", value: `${formatNumber(Math.abs(position.size), 6)} ${baseAsset}` },
      { label: "Position Value", value: formatUsdc(position.positionValueUsd) },
      { label: "Entry Price", value: formatPrice(position.entryPrice) },
      { label: "Mark Price", value: formatPrice(position.markPrice) },
      { label: "Liquidation Price", value: formatPrice(position.liquidationPrice) },
      { label: "Margin Mode", value: marginMode },
      { label: "Margin", value: formatUsdc(position.marginUsedUsd) },
      { label: "PNL", value: formatSignedUsd(position.pnlUsd), tone: pnlTone },
      { label: "ROE %", value: formatSignedPercent(position.pnlPercent), tone: pnlTone },
      { label: "Funding", value: formatSignedUsdc(position.fundingUsd), tone: fundingTone },
      { label: "TP/SL", value: `${targetLabel} / ${stopLabel}` },
    ],
    id: `position-${position.symbol}`,
    direction: position.direction,
    share,
    symbol: position.symbol,
    tone: pnlTone,
  };
}

function buildOpenOrderRows(
  input: BuildAccountActivityLedgerInput,
): OpenOrderLedgerRow[] {
  const pendingRows = input.pendingLimitOrders.map((order) => {
    const price = order.normalizedPrice || order.requestedPrice;
    const size = order.normalizedSize || order.requestedSize;
    const baseAsset = getBaseAsset(order.symbol);
    const orderId = order.orderId !== null ? String(order.orderId) : "--";

    return {
      cells: {
        actions: "Edit / Cancel",
        coin: baseAsset,
        direction: formatOrderDirection(order.direction, order.reduceOnly === true),
        orderValue: formatUsdc(price * size),
        originalSize: formatNumber(order.requestedSize, 6),
        price: formatPrice(price),
        reduceOnly: order.reduceOnly ? "Yes" : "No",
        size: formatNumber(size, 6),
        time: formatTime(order.createdAt),
        tpSl: "--",
        triggerConditions: getPendingOrderSourceLabel(order.source),
        type: "Limit",
      },
      detail: [
        { label: "Order ID", value: orderId },
        { label: "Placement ID", value: order.placementId },
        { label: "Status", value: formatStatus(order.status), tone: getStatusTone(order.status) },
        { label: "Reduce Only", value: order.reduceOnly ? "Yes" : "No" },
        { label: "Trigger Conditions", value: getPendingOrderSourceLabel(order.source) },
        { label: "TP/SL", value: "--" },
      ],
      id: `pending-${order.id}`,
      direction: order.direction,
      orderId: order.orderId,
      origin: "local",
      symbol: order.symbol,
      tone: getDirectionTone(order.direction),
    } satisfies OpenOrderLedgerRow;
  });

  const liveOnlyRows = input.livePendingOrders
    .filter(
      (order) =>
        !input.pendingLimitOrders.some(
          (pendingOrder) => pendingOrder.orderId === order.orderId,
        ),
    )
    .map((order) => {
      const baseAsset = getBaseAsset(order.symbol);

      return {
        cells: {
          actions: "Cancel",
          coin: baseAsset,
          direction: formatOrderDirection(order.direction, order.reduceOnly === true),
          orderValue: formatOpenOrderValue(order),
          originalSize: formatOpenOrderOriginalSize(order),
          price: formatOpenOrderPrice(order),
          reduceOnly: order.reduceOnly ? "Yes" : "No",
          size: formatOpenOrderSize(order),
          time: formatTime(order.createdAt),
          tpSl: "--",
          triggerConditions:
            order.triggerCondition ??
            (order.triggerPrice ? `Trigger ${formatPrice(order.triggerPrice)}` : "Exchange live"),
          type: formatOpenOrderType(order),
        },
        detail: [
          { label: "Order ID", value: String(order.orderId) },
          { label: "Status", value: "Live", tone: "cyan" },
          { label: "Reduce Only", value: order.reduceOnly ? "Yes" : "No" },
          {
            label: "Trigger Conditions",
            value:
              order.triggerCondition ??
              (order.triggerPrice ? `Trigger ${formatPrice(order.triggerPrice)}` : "Exchange live"),
          },
        ],
        id: `live-${order.orderId}`,
        direction: order.direction,
        orderId: order.orderId,
        origin: "exchange",
        symbol: order.symbol,
        tone: getDirectionTone(order.direction),
      } satisfies OpenOrderLedgerRow;
    });

  const magicRows = buildMagicTradeOpenOrderRows(input.magicTradeRules ?? []);

  return [...pendingRows, ...liveOnlyRows, ...magicRows];
}

function buildMagicTradeOpenOrderRows(
  rules: TagAlongRule[],
): OpenOrderLedgerRow[] {
  return rules
    .filter(isActiveMagicTradeRule)
    .slice()
    .sort(
      (left, right) =>
        getEpochTime(getMagicTradeArmedTime(right)) -
        getEpochTime(getMagicTradeArmedTime(left)),
    )
    .map((rule) => {
      const action = getPrimaryMagicTradeAction(rule);
      const targetSymbol = action.targetSymbol as HyperliquidSymbol;
      const directionLabel = formatMagicTradeDirection(action);
      const direction = getMagicTradeRowDirection(directionLabel);
      const tone = getMagicTradeRowTone(directionLabel);
      const targetBaseAsset = getBaseAsset(action.targetSymbol);
      const sourceCondition = formatMagicTradeTriggerCondition(rule.source);
      const marginReviewRequired = isMagicTradeMarginReviewRequired(rule);

      return {
        cells: {
          actions: marginReviewRequired ? "Review / Disarm" : "Edit / Disarm",
          coin: targetBaseAsset,
          direction: directionLabel,
          orderValue: formatMagicTradeOrderValue(action),
          originalSize: "--",
          price: formatMagicTradeExecutionPrice(action),
          reduceOnly: isMagicTradeReduceOnlyAction(action) ? "Yes" : "No",
          size: formatMagicTradeSize(action),
          time: formatTime(getMagicTradeArmedTime(rule)),
          tpSl: formatMagicTradeTpSl(action),
          triggerConditions: sourceCondition,
          type: "Magic Trigger",
        },
        detail: [
          { label: "Origin", value: "Magic Trade", tone: "warning" },
          { label: "Rule ID", value: rule.id },
          ...(marginReviewRequired
            ? [
                {
                  label: "Margin Status",
                  value: "Review required before execution",
                  tone: "warning" as const,
                },
              ]
            : []),
          { label: "Status", value: formatMagicTradeRuleStatus(rule.status), tone: getMagicTradeStatusTone(rule.status) },
          { label: "Execution Mode", value: formatMagicTradeExecutionMode(rule.safety.executionMode) },
          { label: "Source", value: sourceCondition },
          { label: "Target", value: formatMagicTradeDirection(action) },
        ],
        direction,
        id: `magic-trade-open-${rule.id}`,
        magicTradeRuleId: rule.id,
        magicTradeReviewRequired: marginReviewRequired,
        orderId: null,
        origin: "magic-trade",
        symbol: targetSymbol,
        tone,
      } satisfies OpenOrderLedgerRow;
    });
}

function isActiveMagicTradeRule(rule: TagAlongRule) {
  return (
    rule.status === "armed" ||
    rule.status === "triggered" ||
    rule.status === "executing" ||
    rule.status === "would-trigger"
  );
}

function getMagicTradeArmedTime(rule: TagAlongRule) {
  return rule.execution.armedAt ?? rule.updatedAt ?? rule.createdAt;
}

function getPrimaryMagicTradeAction(rule: TagAlongRule) {
  return rule.targetActions?.[0] ?? rule.target;
}

function formatMagicTradeTriggerCondition(condition: WatchedCondition) {
  const sourceAsset = getBaseAsset(condition.sourceSymbol);
  const level = formatNumber(condition.level, 6);

  switch (condition.type) {
    case "price-touches-level":
      return `${sourceAsset} touches ${level}`;
    case "price-crosses-level":
      return `${sourceAsset} crosses ${level}`;
    case "price-crosses-above-level":
      return `${sourceAsset} crosses above ${level}`;
    case "price-crosses-below-level":
      return `${sourceAsset} crosses below ${level}`;
    case "candle-closes-above-level":
      return `${sourceAsset} close above ${level} on ${condition.timeframe ?? "1m"}`;
    case "candle-closes-below-level":
      return `${sourceAsset} close below ${level} on ${condition.timeframe ?? "1m"}`;
  }
}

function formatMagicTradeDirection(action: TargetAction) {
  switch (action.type) {
    case "enter-market":
      return action.enterDirection === "long" ? "Open Long" : "Open Short";
    case "close-position":
      return action.positionSide === "short" ? "Close Short" : "Close Long";
    case "reduce-position-percent":
      return action.positionSide === "short" ? "Reduce Short" : "Reduce Long";
    case "cancel-all-symbol-orders":
      return "Cancel Orders";
    case "move-stop-to-break-even":
      return "Move Stop";
  }
}

function getMagicTradeRowDirection(
  directionLabel: string,
): TradeDirection | undefined {
  const normalized = directionLabel.toLowerCase();

  if (
    normalized.includes("open long") ||
    normalized.includes("close short") ||
    normalized.includes("reduce short")
  ) {
    return "long";
  }

  if (
    normalized.includes("open short") ||
    normalized.includes("close long") ||
    normalized.includes("reduce long")
  ) {
    return "short";
  }

  return undefined;
}

function getMagicTradeRowTone(directionLabel: string): AccountActivityRowTone {
  const direction = getMagicTradeRowDirection(directionLabel);

  return direction ? getDirectionTone(direction) : "muted";
}

function formatMagicTradeSize(action: TargetAction) {
  if (action.type === "enter-market") {
    const marginUsd = getMagicTradeDisplayMarginUsd(action);

    return marginUsd !== null
      ? `${formatMagicTradeUsd(marginUsd)} margin`
      : "--";
  }

  if (action.type === "reduce-position-percent") {
    return typeof action.reducePercent === "number"
      ? `${action.reducePercent}%`
      : "--";
  }

  return "--";
}

function formatMagicTradeUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatMagicTradeOrderValue(action: TargetAction) {
  return action.type === "cancel-all-symbol-orders" ||
    action.type === "move-stop-to-break-even"
    ? "--"
    : "Market";
}

function formatMagicTradeExecutionPrice(action: TargetAction) {
  return action.type === "cancel-all-symbol-orders" ||
    action.type === "move-stop-to-break-even"
    ? "--"
    : "Market";
}

function formatMagicTradeTpSl(action: TargetAction) {
  if (action.type !== "enter-market") {
    return "--";
  }

  const takeProfit = formatPrice(action.takeProfit ?? null);
  const stopLoss = formatPrice(action.stopLoss ?? null);

  if (takeProfit === "--" && stopLoss === "--") {
    return "--";
  }

  return `${takeProfit} / ${stopLoss}`;
}

function isMagicTradeReduceOnlyAction(action: TargetAction) {
  return action.type !== "enter-market";
}

function formatMagicTradeExecutionMode(
  mode: TagAlongRule["safety"]["executionMode"],
) {
  switch (mode) {
    case "live-open-position":
      return "Live Open Position";
    case "live-risk-reducing":
      return "Live Risk-Reducing";
    case "simulation-only":
      return "Simulation Only";
  }
}

function formatMagicTradeRuleStatus(status: TagAlongRule["status"]) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMagicTradeStatusTone(
  status: TagAlongRule["status"],
): AccountActivityRowTone {
  switch (status) {
    case "armed":
    case "triggered":
    case "executing":
    case "would-trigger":
      return "cyan";
    case "failed":
    case "expired":
      return "warning";
    case "disarmed":
    case "paused":
      return "muted";
    default:
      return "neutral";
  }
}

function buildMagicTradeRows(
  entries: SessionLogEntry[],
): MagicTradeLedgerRow[] {
  return entries
    .filter((entry) => {
      const source = entry.source?.toLowerCase() ?? "";

      return (
        source.includes("magic trade") ||
        entry.eventType.startsWith("TAG_ALONG_")
      );
    })
    .slice(0, 60)
    .map((entry) => {
      const tone =
        entry.eventType.includes("FAILED") || entry.eventType.includes("SKIPPED")
          ? "warning"
          : getSignedTone(entry.pnl);
      const action = entry.description || entry.source || entry.eventType;

      return {
        cells: {
          action,
          coin: entry.symbol ? getBaseAsset(entry.symbol) : "--",
          event: formatMagicTradeEvent(entry.eventType),
          pnl: formatSignedUsd(entry.pnl),
          price: formatPrice(entry.price),
          size:
            entry.size !== null
              ? formatNumber(Math.abs(entry.size), 6)
              : "--",
          status: getMagicTradeStatus(entry.eventType),
          time: formatTime(entry.timestamp),
        },
        detail: [
          { label: "Timestamp", value: formatTime(entry.timestamp) },
          { label: "Event", value: formatMagicTradeEvent(entry.eventType) },
          { label: "Status", value: getMagicTradeStatus(entry.eventType), tone },
          { label: "Action", value: action },
          { label: "Source", value: entry.source || "--" },
        ],
        id: `magic-trade-${entry.id}`,
        tone,
      } satisfies MagicTradeLedgerRow;
    });
}

function buildTradeHistoryRows(
  entries: SessionLogEntry[],
  exchangeFills: AccountTradeHistoryRecord[],
): TradeHistoryLedgerRow[] {
  if (exchangeFills.length > 0) {
    return exchangeFills
      .filter((fill) => fill.coin.trim())
      .slice(0, 80)
      .map((fill, index) => {
        const coin = fill.coin.trim().toUpperCase();
        const price = formatPrice(fill.price);
        const size = fill.size !== null ? formatNumber(Math.abs(fill.size), 6) : "--";
        const tradeValue =
          fill.tradeValueUsdc !== null && fill.tradeValueUsdc !== undefined
            ? formatUsdc(fill.tradeValueUsdc)
            : fill.price !== null && fill.size !== null
              ? formatUsdc(Math.abs(fill.price * fill.size))
              : "--";
        const timeLabel = formatTimeFromEpoch(fill.time);
        const closedPnlValue = getFeeAdjustedClosedPnl(fill.closedPnl, fill.feeUsdc);
        const closedPnl = formatSignedUsdc(closedPnlValue);
        const tone = getSignedTone(closedPnlValue);
        const direction = fill.direction.trim() || "--";
        const explorerUrl = fill.hash?.trim()
          ? `https://app.hyperliquid.xyz/explorer/tx/${encodeURIComponent(fill.hash.trim())}`
          : "https://app.hyperliquid.xyz/explorer";
        const share = {
          coin,
          direction,
          entryLabel: price,
          markLabel: price,
          pnlLabel: closedPnl,
          priceLabel: price,
          sizeLabel: size,
          timeLabel,
          tradeValueLabel: tradeValue,
        };

        return {
          cells: {
            closedPnl,
            coin,
            direction,
            fee: formatFeeUsdc(fill.feeUsdc),
            price,
            size,
            time: timeLabel,
            tradeValue,
          },
          detail: [
            { label: "Timestamp", value: timeLabel },
            { label: "Explorer", value: explorerUrl },
            { label: "Coin", value: coin },
            { label: "Direction", value: direction, tone: getExchangeDirectionTone(direction) },
            { label: "Price", value: price },
            { label: "Size", value: size },
            { label: "Trade Value", value: tradeValue },
            { label: "Fee", value: formatFeeUsdc(fill.feeUsdc) },
            { label: "Closed PNL", value: closedPnl, tone },
            { label: "Order ID", value: formatDisplayOrderId(fill.orderId) },
            { label: "Fill Hash", value: fill.hash?.trim() || "--" },
          ],
          explorerUrl,
          id: buildTradeHistoryRowId(fill, coin, index),
          share,
          tone,
        } satisfies TradeHistoryLedgerRow;
      });
  }

  return entries
    .filter((entry) =>
      [
        "market-order-placed",
        "pending-order-filled",
        "position-opened",
        "position-reduced",
        "position-reversed",
        "position-closed",
      ].includes(entry.eventType),
    )
    .slice(0, 60)
    .map((entry) => {
      const tone = getSignedTone(entry.pnl);
      const coin = entry.symbol ? getBaseAsset(entry.symbol) : "--";
      const direction = formatSessionDirection(entry);
      const size = entry.size !== null ? formatNumber(Math.abs(entry.size), 6) : "--";
      const price = formatPrice(entry.price);
      const tradeValue =
        entry.price !== null && entry.size !== null
          ? formatUsdc(Math.abs(entry.price * entry.size))
          : "--";
      const timeLabel = formatTime(entry.timestamp);
      const explorerUrl = getExplorerUrl(entry);
      const share = {
        coin,
        direction,
        entryLabel: price,
        markLabel: price,
        pnlLabel: formatSignedUsd(entry.pnl),
        priceLabel: price,
        sizeLabel: size,
        timeLabel,
        tradeValueLabel: tradeValue,
      };

      return {
        cells: {
          closedPnl: share.pnlLabel,
          coin,
          direction,
          fee: "-- USDC",
          price,
          size,
          time: timeLabel,
          tradeValue,
        },
        detail: [
          { label: "Timestamp", value: timeLabel },
          { label: "Explorer", value: explorerUrl },
          { label: "Coin", value: coin },
          { label: "Direction", value: direction, tone: entry.direction ? getDirectionTone(entry.direction) : "neutral" },
          { label: "Price", value: price },
          { label: "Size", value: size },
          { label: "Trade Value", value: tradeValue },
          { label: "Fee", value: "-- USDC" },
          { label: "Closed PNL", value: share.pnlLabel, tone },
          { label: "Order ID", value: "--" },
          { label: "Fill ID", value: entry.id },
        ],
        explorerUrl,
        id: `trade-${entry.id}`,
        share,
        tone,
      };
    });
}

function buildTradeHistoryRowId(
  fill: AccountTradeHistoryRecord,
  coin: string,
  index: number,
) {
  return [
    "trade",
    fill.hash?.trim() || "no-hash",
    fill.orderId ?? "no-order",
    fill.time,
    coin,
    fill.direction.trim() || "no-direction",
    fill.side?.trim() || "no-side",
    fill.price ?? "no-price",
    fill.size ?? "no-size",
    index,
  ].join("-");
}

function getFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getTradeValueUsdc(fill: AccountTradeHistoryRecord) {
  const explicitTradeValue = getFiniteNumber(fill.tradeValueUsdc);

  if (explicitTradeValue !== null) {
    return Math.abs(explicitTradeValue);
  }

  const price = getFiniteNumber(fill.price);
  const size = getFiniteNumber(fill.size);

  if (price === null || size === null) {
    return null;
  }

  return Math.abs(price * size);
}

function getEpochTime(value: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

function roundAccountNumber(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000_000_000) / 1_000_000_000_000;
}

function buildFundingHistoryRows(
  fundingHistory: AccountFundingHistoryRecord[],
  positions: LiveExchangePosition[],
): FundingHistoryLedgerRow[] {
  if (fundingHistory.length > 0) {
    return fundingHistory
      .filter((record) => record.coin.trim())
      .map((record) => {
        const size = record.size;
        const direction = getFundingPositionSide(size);
        const payment = formatFundingPaymentUsdc(record.paymentUsdc);
        const rate = formatFundingRate(record.rate);
        const timestamp = formatTimeFromEpoch(record.time);
        const sizeLabel =
          size !== null && Number.isFinite(size)
            ? `${formatNumber(Math.abs(size), 6)} ${record.coin}`
            : "--";
        const tone = getSignedTone(record.paymentUsdc);

        return {
          cells: {
            coin: record.coin,
            payment,
            positionSide: direction,
            rate,
            size: sizeLabel,
            time: timestamp,
          },
          detail: [
            { label: "Timestamp", value: timestamp },
            { label: "Coin", value: record.coin },
            { label: "Size", value: sizeLabel },
            { label: "Position Side", value: direction, tone: getFundingSideTone(size) },
            { label: "Funding Rate", value: rate },
            { label: "Payment", value: payment, tone },
            { label: "Hash", value: record.hash ?? "--" },
          ],
          id: `funding-${record.coin}-${record.time}-${record.hash ?? payment}`,
          tone,
        } satisfies FundingHistoryLedgerRow;
      });
  }

  return positions
    .filter(
      (position) =>
        position.fundingUsd !== null && Number.isFinite(position.fundingUsd),
    )
    .map((position) => {
      const tone = getSignedTone(position.fundingUsd);
      const baseAsset = getBaseAsset(position.symbol);

      return {
        cells: {
          coin: baseAsset,
          payment: formatSignedUsdc(position.fundingUsd),
          positionSide: formatDirection(position.direction),
          rate: "--",
          size: `${formatNumber(Math.abs(position.size), 6)} ${baseAsset}`,
          time: "Live",
        },
        detail: [
          { label: "Timestamp", value: "Live position funding" },
          { label: "Coin", value: baseAsset },
          { label: "Size", value: `${formatNumber(Math.abs(position.size), 6)} ${baseAsset}` },
          { label: "Position Side", value: formatDirection(position.direction), tone: getDirectionTone(position.direction) },
          { label: "Funding Rate", value: "--" },
          { label: "Payment", value: formatSignedUsdc(position.fundingUsd), tone },
          { label: "Linked Position", value: position.symbol },
        ],
        id: `funding-${position.symbol}`,
        tone,
      };
    });
}

function buildOrderHistoryRows(
  input: BuildAccountActivityLedgerInput,
  openOrderRows: OpenOrderLedgerRow[],
): OrderHistoryLedgerRow[] {
  if (input.accountOrderHistory && input.accountOrderHistory.length > 0) {
    return input.accountOrderHistory
      .filter((order) => order.coin.trim())
      .slice(0, 120)
      .map((order, index) => {
        const coin = order.coin.trim().toUpperCase();
        const absoluteFilledSize =
          order.filledSize !== null ? Math.abs(order.filledSize) : null;
        const hasFilledSize =
          absoluteFilledSize !== null && absoluteFilledSize > 0;
        const size =
          hasFilledSize && order.size !== null
            ? `${formatNumber(Math.abs(order.size), 6)} ${coin}`
            : "--";
        const filledSize =
          absoluteFilledSize !== null && absoluteFilledSize > 0
            ? `${formatNumber(absoluteFilledSize, 6)} ${coin}`
            : "--";
        const orderValue =
          hasFilledSize && order.orderValueUsdc !== null
            ? formatUsdc(order.orderValueUsdc)
            : hasFilledSize && order.price !== null && order.size !== null
              ? formatUsdc(Math.abs(order.price * order.size))
              : "--";
        const status = formatExchangeStatus(order.status);
        const tpSl = formatOrderHistoryTpSl(order.tpSl);
        const time = formatTimeFromEpoch(order.time);

        return {
          cells: {
            coin,
            direction: order.direction.trim() || "--",
            filledSize,
            orderId: formatDisplayOrderId(order.orderId),
            orderValue,
            price: formatPrice(order.price),
            reduceOnly: formatNullableBoolean(order.reduceOnly),
            size,
            status,
            time,
            tpSl,
            triggerConditions: order.triggerConditions.trim() || "--",
            type: order.type.trim() || "--",
          },
          detail: [
            { label: "Created", value: time },
            { label: "Status", value: status, tone: getOrderStatusTone(status) },
            { label: "Display Order ID", value: formatDisplayOrderId(order.orderId) },
            { label: "Full Order ID", value: String(order.orderId ?? "--") },
            { label: "Order Type", value: order.type.trim() || "--" },
            { label: "Reduce Only", value: formatNullableBoolean(order.reduceOnly) },
            { label: "Trigger Conditions", value: order.triggerConditions.trim() || "--" },
            { label: "TP/SL", value: tpSl },
            { label: "Filled Size", value: filledSize },
            { label: "Linked Trade Fills", value: "--" },
          ],
          id: buildHistoricalOrderRowId(order, coin, index),
          tone: getOrderStatusTone(status),
        } satisfies OrderHistoryLedgerRow;
      });
  }

  const openRows = openOrderRows.map((row) => ({
    cells: {
      coin: row.cells.coin,
      direction: row.cells.direction,
      filledSize: "0",
      orderId: formatDisplayOrderId(
        row.detail.find((detail) => detail.label === "Order ID")?.value,
      ),
      orderValue: row.cells.orderValue,
      price: row.cells.price,
      reduceOnly: row.cells.reduceOnly,
      size: row.cells.size,
      status: "Open",
      time: row.cells.time,
      tpSl: row.cells.tpSl,
      triggerConditions: row.cells.triggerConditions,
      type: row.cells.type,
    },
    detail: [
      ...row.detail,
      { label: "Created", value: row.cells.time },
      { label: "Opened", value: "Open" },
      { label: "Filled Size", value: "0" },
      { label: "Remaining Size", value: row.cells.size },
      { label: "Linked Trade Fills", value: "--" },
    ],
    id: `order-history-${row.id}`,
    tone: "cyan",
  })) satisfies OrderHistoryLedgerRow[];

  const eventRows = input.sessionLogEntries
    .filter((entry) =>
      [
        "market-order-placed",
        "limit-order-placed",
        "limit-order-canceled",
        "pending-order-filled",
        "cancel-all-orders-used",
      ].includes(entry.eventType),
    )
    .map((entry) => {
      const baseAsset = entry.symbol ? getBaseAsset(entry.symbol) : "--";
      const size = entry.size !== null ? formatNumber(Math.abs(entry.size), 6) : "--";
      const price = formatPrice(entry.price);
      const orderValue =
        entry.price !== null && entry.size !== null
          ? formatUsdc(Math.abs(entry.price * entry.size))
          : "--";
      const status = getOrderEventStatus(entry.eventType);

      return {
        cells: {
          coin: baseAsset,
          direction: entry.direction ? formatDirection(entry.direction) : "--",
          filledSize: entry.eventType === "pending-order-filled" ? size : "--",
          orderId: formatDisplayOrderId(entry.id),
          orderValue,
          price,
          reduceOnly: "--",
          size,
          status,
          time: formatTime(entry.timestamp),
          tpSl: "--",
          triggerConditions: entry.source || "--",
          type: entry.eventType === "market-order-placed" ? "Market" : "Limit",
        },
        detail: [
          { label: "Created", value: formatTime(entry.timestamp) },
          { label: "Status", value: status, tone: getOrderStatusTone(status) },
          { label: "Display Order ID", value: formatDisplayOrderId(entry.id) },
          { label: "Full Order ID", value: entry.id },
          { label: "Order Type", value: entry.eventType === "market-order-placed" ? "Market" : "Limit" },
          { label: "Reduce Only", value: "--" },
          { label: "Trigger Conditions", value: entry.source || "--" },
          { label: "TP/SL", value: "--" },
          { label: "Filled Size", value: entry.eventType === "pending-order-filled" ? size : "--" },
          { label: "Remaining Size", value: "--" },
          { label: "Linked Trade Fills", value: entry.id },
        ],
        id: `order-event-${entry.id}`,
        tone: getOrderStatusTone(status),
      } satisfies OrderHistoryLedgerRow;
    });

  return [...openRows, ...eventRows].slice(0, 80);
}

function formatOrderHistoryTpSl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "--";
  }

  const normalizedValue = trimmedValue.toLowerCase();

  if (
    normalizedValue === "no" ||
    normalizedValue === "false" ||
    normalizedValue === "n/a" ||
    normalizedValue === "--"
  ) {
    return "--";
  }

  return trimmedValue;
}

function buildHistoricalOrderRowId(
  order: AccountOrderHistoryRecord,
  coin: string,
  index: number,
) {
  return [
    "order-history",
    order.orderId ?? order.time,
    coin,
    order.time,
    order.status.trim() || "unknown",
    order.type.trim() || "unknown",
    order.filledSize ?? "unfilled",
    index,
  ].join("-");
}

function buildBalanceRows(
  input: BuildAccountActivityLedgerInput,
): BalanceLedgerRow[] {
  if (input.accountBalances && input.accountBalances.length > 0) {
    return input.accountBalances
      .filter((balance) => balance.coin.trim())
      .map((balance) => {
        const pnlTone = getSignedTone(balance.pnlUsd ?? null);
        const pnlRoe =
          balance.pnlUsd === null || balance.pnlUsd === undefined
            ? "--"
            : `${formatSignedUsd(balance.pnlUsd)} (${formatSignedPercent(balance.pnlPercent ?? null)})`;
        const coin = balance.coinLabel?.trim() || balance.coin;

        return {
          cells: {
            availableBalance:
              balance.availableBalanceDisplay?.trim() ||
              formatBalanceQuantity(balance.availableBalance, balance.coin),
            coin,
            contract: balance.contractLabel?.trim() || "--",
            pnlRoe,
            repay: balance.repayLabel?.trim() || "--",
            send: balance.sendLabel?.trim() || "--",
            totalBalance:
              balance.totalBalanceDisplay?.trim() ||
              formatBalanceQuantity(balance.totalBalance, balance.coin),
            transfer: balance.transferLabel?.trim() || "--",
            usdcValue: formatUsd(balance.usdValue),
          },
          detail: [
            { label: "Coin", value: coin },
            { label: "Total Balance", value: balance.totalBalanceDisplay?.trim() || formatBalanceQuantity(balance.totalBalance, balance.coin) },
            { label: "Available Balance", value: balance.availableBalanceDisplay?.trim() || formatBalanceQuantity(balance.availableBalance, balance.coin), tone: "cyan" },
            { label: "USDC Value", value: formatUsd(balance.usdValue) },
            { label: "PNL (ROE %)", value: pnlRoe, tone: pnlTone },
            { label: "Send", value: balance.sendLabel?.trim() || "--" },
            { label: "Transfer", value: balance.transferLabel?.trim() || "--" },
            { label: "Repay", value: balance.repayLabel?.trim() || "--" },
            { label: "Contract", value: balance.contractLabel?.trim() || "--" },
          ],
          id: `balance-${balance.coin}`,
          tone: "neutral",
        } satisfies BalanceLedgerRow;
      });
  }

  const usedLocked = input.positions.reduce(
    (total, position) => total + (position.marginUsedUsd ?? 0),
    0,
  );
  const hasBalance =
    input.accountValue !== null ||
    input.availableToTrade !== null ||
    usedLocked > 0;

  if (!hasBalance) {
    return [];
  }

  return [
    {
      cells: {
        availableBalance: formatUsdc(input.availableToTrade),
        coin: "USDC",
        contract: "--",
        pnlRoe: "--",
        repay: "--",
        send: "Not available in your jurisdiction",
        totalBalance: formatUsd(input.accountValue),
        transfer: "Transfer to Spot",
        usdcValue: formatUsd(input.accountValue),
      },
      detail: [
        { label: "Coin", value: "USDC" },
        { label: "Total Balance", value: formatUsd(input.accountValue) },
        { label: "Available Balance", value: formatUsdc(input.availableToTrade), tone: "cyan" },
        { label: "Margin Used", value: formatUsd(usedLocked), tone: usedLocked > 0 ? "warning" : "muted" },
        { label: "USDC Value", value: formatUsd(input.accountValue) },
        { label: "Long Available", value: formatUsd(input.availableToTradeBySide.long) },
        { label: "Short Available", value: formatUsd(input.availableToTradeBySide.short) },
      ],
      id: "balance-usdc",
      tone: "neutral",
    },
  ];
}

function getExplorerUrl(entry: SessionLogEntry) {
  const txHash = getMetadataString(entry.metadata, [
    "txHash",
    "transactionHash",
    "hash",
    "explorerHash",
  ]);

  if (txHash) {
    return `https://app.hyperliquid.xyz/explorer/tx/${encodeURIComponent(txHash)}`;
  }

  const explorerUrl = getMetadataString(entry.metadata, [
    "explorerUrl",
    "transactionUrl",
  ]);

  return explorerUrl ?? "https://app.hyperliquid.xyz/explorer";
}

function getMetadataString(metadata: unknown, keys: string[]) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getMetadataBoolean(metadata: unknown, keys: string[]) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

function getBaseAsset(symbol: string) {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/-USDC$/i, "")
    .replace(/-USD$/i, "");
}

function formatNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: value % 1 === 0 ? 0 : Math.min(2, maximumFractionDigits),
  }).format(value);
}

function formatUsd(value: number | null) {
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

function formatUsdc(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${formatNumber(value, 2)} USDC`;
}

function formatBalanceQuantity(value: number | null, coin: string) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const decimals = coin.toUpperCase().includes("USD") ? 2 : 8;
  return `${formatNumber(value, decimals)} ${coin}`;
}

function formatSignedUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

function formatSignedUsdc(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatUsdc(Math.abs(value))}`;
}

function formatFundingPaymentUsdc(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(value), 6)} USDC`;
}

function formatFundingRate(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${formatNumber(value * 100, 4)}%`;
}

function formatFeeUsdc(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-- USDC";
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Math.abs(value))} USDC`;
}

function getFeeAdjustedClosedPnl(
  closedPnl: number | null,
  feeUsdc: number | null,
) {
  if (closedPnl === null || !Number.isFinite(closedPnl)) {
    return null;
  }

  return closedPnl - (feeUsdc !== null && Number.isFinite(feeUsdc) ? Math.abs(feeUsdc) : 0);
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(value), 2)}%`;
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  const decimals = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function formatTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value || "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

function formatTimeFromEpoch(value: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatTime(new Date(value).toISOString());
  }

  return formatTime(String(value));
}

function getFundingPositionSide(size: number | null) {
  if (size === null || !Number.isFinite(size)) {
    return "--";
  }

  return size >= 0 ? "Long" : "Short";
}

function getFundingSideTone(size: number | null): AccountActivityRowTone {
  if (size === null || !Number.isFinite(size)) {
    return "muted";
  }

  return size >= 0 ? "positive" : "negative";
}

function formatDisplayOrderId(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "--";
  }

  const rawValue = String(value).trim();

  if (!rawValue || rawValue === "--") {
    return "--";
  }

  const suffix = rawValue.split("-").filter(Boolean).at(-1);

  return suffix ?? rawValue;
}

function formatNullableBoolean(value: boolean | null) {
  if (value === null) {
    return "--";
  }

  return value ? "Yes" : "No";
}

function formatExchangeStatus(status: string) {
  const normalized = status.trim();

  if (!normalized) {
    return "--";
  }

  return normalized
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getExchangeDirectionTone(direction: string): AccountActivityRowTone {
  if (/open long|close short|buy/i.test(direction)) {
    return "positive";
  }

  if (/open short|close long|sell/i.test(direction)) {
    return "negative";
  }

  return "neutral";
}

function formatDirection(direction: TradeDirection) {
  return direction === "long" ? "Long" : "Short";
}

function formatOrderDirection(direction: TradeDirection, reduceOnly: boolean) {
  if (!reduceOnly) {
    return direction === "long" ? "Open Long" : "Open Short";
  }

  return direction === "long" ? "Close Short" : "Close Long";
}

function formatOpenOrderType(order: LivePendingOrder) {
  if (order.triggerType?.trim()) {
    return normalizeOpenOrderType(order.triggerType);
  }

  return "Limit";
}

function normalizeOpenOrderType(type: string) {
  const normalized = type.trim();

  if (/^stop\s+loss$/i.test(normalized)) {
    return "Stop Market";
  }

  if (/^take\s+profit$/i.test(normalized)) {
    return "Take Profit Market";
  }

  return normalized;
}

function isTriggerMarketOrder(order: LivePendingOrder) {
  return Boolean(order.triggerType && /market/i.test(formatOpenOrderType(order)));
}

function formatOpenOrderSize(order: LivePendingOrder) {
  return formatNumber(Math.abs(order.size), 6);
}

function formatOpenOrderOriginalSize(order: LivePendingOrder) {
  const originalSize = order.originalSize ?? order.size;

  return formatNumber(Math.abs(originalSize), 6);
}

function formatOpenOrderValue(order: LivePendingOrder) {
  if (isTriggerMarketOrder(order)) {
    return "Market";
  }

  return formatUsdc(order.price * order.size);
}

function formatOpenOrderPrice(order: LivePendingOrder) {
  if (isTriggerMarketOrder(order)) {
    return "Market";
  }

  return formatPrice(order.price);
}

function formatMagicTradeEvent(eventType: SessionLogEntry["eventType"]) {
  if (eventType.startsWith("TAG_ALONG_")) {
    return eventType
      .replace(/^TAG_ALONG_/, "")
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return eventType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMagicTradeStatus(eventType: SessionLogEntry["eventType"]) {
  if (eventType.includes("FAILED")) {
    return "Failed";
  }

  if (eventType.includes("SKIPPED")) {
    return "Skipped";
  }

  if (eventType.includes("WOULD_TRIGGER")) {
    return "Watching";
  }

  if (
    eventType.includes("EXECUTED") ||
    eventType === "position-opened" ||
    eventType === "limit-order-placed"
  ) {
    return "Executed";
  }

  return "Logged";
}

function getDirectionTone(direction: TradeDirection): AccountActivityRowTone {
  return direction === "long" ? "positive" : "negative";
}

function getSignedTone(value: number | null): AccountActivityRowTone {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}

function getStatusTone(status: PendingLimitOrder["status"]): AccountActivityRowTone {
  if (status === "rejected") {
    return "warning";
  }

  if (status === "canceled") {
    return "muted";
  }

  if (status === "live" || status === "filled") {
    return "cyan";
  }

  return "neutral";
}

function getOrderStatusTone(status: string): AccountActivityRowTone {
  switch (status) {
    case "Open":
    case "Triggered":
      return "cyan";
    case "Partially Filled":
    case "Rejected":
    case "Expired":
      return "warning";
    case "Canceled":
      return "muted";
    default:
      return "neutral";
  }
}

function formatStatus(status: PendingLimitOrder["status"]) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPendingOrderSourceLabel(source: PendingLimitOrder["source"]) {
  switch (source) {
    case "horizontal-line":
      return "Chart line";
    case "mid-zone":
      return "Mid-zone";
    case "order-zone":
      return "Order zone";
    case "limit-close":
      return "Limit close";
  }
}

function formatSessionDirection(entry: SessionLogEntry) {
  if (!entry.direction) {
    return "--";
  }

  const reduceOnly = getMetadataBoolean(entry.metadata, [
    "reduceOnly",
    "isReduceOnly",
  ]);

  if (
    entry.eventType === "position-closed" ||
    entry.eventType === "position-reduced" ||
    reduceOnly === true ||
    /close|reduce|stop|take profit|tp\/sl/i.test(entry.source)
  ) {
    return entry.direction === "long" ? "Close Long" : "Close Short";
  }

  if (
    entry.eventType === "position-opened" ||
    entry.eventType === "market-order-placed" ||
    entry.eventType === "limit-order-placed" ||
    entry.eventType === "pending-order-filled"
  ) {
    return entry.direction === "long" ? "Open Long" : "Open Short";
  }

  if (entry.eventType === "position-reversed") {
    return entry.direction === "long" ? "Open Long" : "Open Short";
  }

  return formatDirection(entry.direction);
}

function getOrderEventStatus(eventType: SessionLogEntry["eventType"]) {
  switch (eventType) {
    case "pending-order-filled":
      return "Filled";
    case "cancel-all-orders-used":
    case "limit-order-canceled":
      return "Canceled";
    case "limit-order-placed":
    case "market-order-placed":
      return "Filled";
    default:
      return "Open";
  }
}
