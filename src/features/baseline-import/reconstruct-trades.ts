import type {
  BaselineDataQualityWarning,
  BaselineEntryStyleProxy,
  BaselineExecutionMode,
  ImportedFill,
  ImportedFundingRecord,
  ImportedOrder,
  ImportedSession,
  ImportedTrade,
  ReconstructImportedTradesInput,
  ReconstructImportedTradesResult,
} from "@/features/baseline-import/types";

type MutableTrade = ImportedTrade & {
  _entryVolume: number;
  _entryVolumeValue: number;
  _exitVolume: number;
  _exitVolumeValue: number;
  _position: number;
};

function sign(value: number) {
  if (value > 0) {
    return 1;
  }

  if (value < 0) {
    return -1;
  }

  return 0;
}

function roundPosition(value: number) {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function averagePrice(totalValue: number, totalVolume: number) {
  if (totalVolume <= 0) {
    return null;
  }

  return totalValue / totalVolume;
}

function buildOpeningTrade(fill: ImportedFill, positionAfter: number): MutableTrade {
  const size = Math.abs(fill.size ?? 0);
  const value = (fill.price ?? 0) * size;

  return {
    _entryVolume: size,
    _entryVolumeValue: value,
    _exitVolume: 0,
    _exitVolumeValue: 0,
    _position: positionAfter,
    accountAddress: fill.accountAddress,
    addFills: [],
    closeFills: [],
    coin: fill.coin,
    direction: positionAfter >= 0 ? "long" : "short",
    durationMinutes: null,
    endTime: null,
    entryPrice: fill.price,
    entryStyleProxy: "unknown",
    entryTime: fill.time,
    environment: fill.environment,
    executionClosedPnl: 0,
    executionMode: "unknown",
    exitPrice: null,
    fundingPnl: 0,
    grossFees: fill.fee,
    id: `imported-trade-${fill.coin}-${fill.time}-${fill.orderId ?? "no-order"}-${fill.tradeId ?? "no-trade"}`,
    maxSize: Math.abs(positionAfter),
    netPnl: 0,
    openFills: [fill],
    orderIds: fill.orderId === null ? [] : [fill.orderId],
    rawOrderMatches: [],
    reconstructionConfidence: "medium",
    reduceFills: [],
    sessionId: null,
    sourceLabel: "Historical Import",
    status: "open",
  };
}

function cloneFillWithSize(fill: ImportedFill, size: number, signedSize: number, suffix: string): ImportedFill {
  return {
    ...fill,
    closedPnl: fill.size && fill.size !== 0 ? fill.closedPnl * (size / fill.size) : fill.closedPnl,
    fee: fill.size && fill.size !== 0 ? fill.fee * (size / fill.size) : fill.fee,
    id: `${fill.id}-${suffix}`,
    signedSize,
    size,
  };
}

function addExit(fill: ImportedFill, trade: MutableTrade, bucket: "reduceFills" | "closeFills") {
  const size = Math.abs(fill.size ?? 0);
  trade[bucket].push(fill);
  trade._exitVolume += size;
  trade._exitVolumeValue += (fill.price ?? 0) * size;
  trade.executionClosedPnl += fill.closedPnl;
  trade.grossFees += fill.fee;
  if (fill.orderId !== null && !trade.orderIds.includes(fill.orderId)) {
    trade.orderIds.push(fill.orderId);
  }
}

function addEntry(fill: ImportedFill, trade: MutableTrade, bucket: "openFills" | "addFills", nextPosition: number) {
  const size = Math.abs(fill.size ?? 0);
  trade[bucket].push(fill);
  trade._entryVolume += size;
  trade._entryVolumeValue += (fill.price ?? 0) * size;
  trade.grossFees += fill.fee;
  trade._position = nextPosition;
  trade.maxSize = Math.max(trade.maxSize, Math.abs(nextPosition));
  if (fill.orderId !== null && !trade.orderIds.includes(fill.orderId)) {
    trade.orderIds.push(fill.orderId);
  }
}

function finalizeTrade(trade: MutableTrade, endTime: number | null, status: ImportedTrade["status"]) {
  trade.endTime = endTime;
  trade.status = status;
  trade.entryPrice = averagePrice(trade._entryVolumeValue, trade._entryVolume) ?? trade.entryPrice;
  trade.exitPrice = averagePrice(trade._exitVolumeValue, trade._exitVolume);
  trade.durationMinutes =
    endTime === null ? null : Math.max(1, Math.round((endTime - trade.entryTime) / 60_000));
  trade._position = 0;
}

function deriveExecutionMode(orderMatches: ImportedOrder[]): BaselineExecutionMode {
  const entryModes = orderMatches
    .filter((order) => !order.reduceOnly && !order.isPositionTpsl)
    .map((order) => order.orderType)
    .filter((orderType): orderType is BaselineExecutionMode => orderType === "market" || orderType === "limit" || orderType === "unknown");

  if (entryModes.length === 0) {
    return "unknown";
  }

  const hasMarket = entryModes.includes("market");
  const hasLimit = entryModes.includes("limit");

  if (hasMarket && hasLimit) {
    return "mixed";
  }

  if (hasMarket) {
    return "market";
  }

  if (hasLimit) {
    return "limit";
  }

  return "unknown";
}

function deriveEntryStyleProxy(
  executionMode: BaselineExecutionMode,
): BaselineEntryStyleProxy {
  if (executionMode === "limit") {
    return "likely-hunted";
  }

  if (executionMode === "market") {
    return "likely-chased";
  }

  return "unknown";
}

function buildSessions(trades: ImportedTrade[]): ImportedSession[] {
  const sortedTrades = [...trades].sort((left, right) => left.entryTime - right.entryTime);
  const sessions: ImportedSession[] = [];
  let current: ImportedSession | null = null;
  let currentTrades: ImportedTrade[] = [];

  for (const trade of sortedTrades) {
    const lastTrade = currentTrades[currentTrades.length - 1] ?? null;
    const previousAnchor = lastTrade?.endTime ?? lastTrade?.entryTime ?? null;
    const startsNewSession =
      current === null || previousAnchor === null || trade.entryTime - previousAnchor > 90 * 60_000;

    if (startsNewSession) {
      if (current !== null) {
        current.tradeCount = currentTrades.length;
        current.tradeIds = currentTrades.map((item) => item.id);
        current.netPnl = currentTrades.reduce((sum, item) => sum + item.netPnl, 0);
        current.winCount = currentTrades.filter((item) => item.netPnl > 0).length;
        current.lossCount = currentTrades.filter((item) => item.netPnl < 0).length;
        current.dominantAsset =
          Object.entries(
            currentTrades.reduce<Record<string, number>>((accumulator, item) => {
              accumulator[item.coin] = (accumulator[item.coin] ?? 0) + 1;
              return accumulator;
            }, {}),
          ).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
        sessions.push(current);
      }

      currentTrades = [trade];
      current = {
        accountAddress: trade.accountAddress,
        dominantAsset: trade.coin,
        endedAt: trade.endTime ?? trade.entryTime,
        environment: trade.environment,
        id: `imported-session-${trade.entryTime}-${trade.coin}`,
        lossCount: 0,
        netPnl: 0,
        notes: [],
        startedAt: trade.entryTime,
        tradeCount: 0,
        tradeIds: [],
        winCount: 0,
      };
      continue;
    }

    currentTrades.push(trade);
    if (current) {
      current.endedAt = trade.endTime ?? trade.entryTime;
    }
  }

  if (current !== null) {
    current.tradeCount = currentTrades.length;
    current.tradeIds = currentTrades.map((item) => item.id);
    current.netPnl = currentTrades.reduce((sum, item) => sum + item.netPnl, 0);
    current.winCount = currentTrades.filter((item) => item.netPnl > 0).length;
    current.lossCount = currentTrades.filter((item) => item.netPnl < 0).length;
    current.dominantAsset =
      Object.entries(
        currentTrades.reduce<Record<string, number>>((accumulator, item) => {
          accumulator[item.coin] = (accumulator[item.coin] ?? 0) + 1;
          return accumulator;
        }, {}),
      ).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    sessions.push(current);
  }

  const tradeToSessionId = new Map<string, string>();
  sessions.forEach((session) => {
    session.tradeIds.forEach((tradeId) => {
      tradeToSessionId.set(tradeId, session.id);
    });
  });
  trades.forEach((trade) => {
    trade.sessionId = tradeToSessionId.get(trade.id) ?? null;
  });

  return sessions;
}

function attachFunding(trades: ImportedTrade[], funding: ImportedFundingRecord[]) {
  trades.forEach((trade) => {
    const windowEnd = trade.endTime ?? trade.entryTime;
    const fundingPnl = funding
      .filter((record) => record.coin === trade.coin && record.time >= trade.entryTime && record.time <= windowEnd)
      .reduce((sum, record) => sum + record.delta, 0);
    trade.fundingPnl = fundingPnl;
    trade.netPnl = trade.executionClosedPnl + trade.fundingPnl;
  });
}

export function reconstructImportedTrades({
  fills,
  funding,
  orders,
}: ReconstructImportedTradesInput): ReconstructImportedTradesResult {
  const sortedFills = [...fills].sort(
    (left, right) =>
      left.coin.localeCompare(right.coin) ||
      left.time - right.time ||
      (left.orderId ?? Number.MAX_SAFE_INTEGER) - (right.orderId ?? Number.MAX_SAFE_INTEGER) ||
      (left.tradeId ?? Number.MAX_SAFE_INTEGER) - (right.tradeId ?? Number.MAX_SAFE_INTEGER),
  );
  const orderMap = new Map<number, ImportedOrder>();
  const trades: ImportedTrade[] = [];
  const activeTrades = new Map<string, MutableTrade>();
  const warnings: BaselineDataQualityWarning[] = [];
  const missingOrderIds = new Set<number>();
  let boundaryFillCount = 0;

  orders.forEach((order) => {
    if (order.orderId !== null) {
      orderMap.set(order.orderId, order);
    }
  });

  sortedFills.forEach((fill) => {
    if (fill.size === null || fill.signedSize === null) {
      return;
    }

    const currentTrade = activeTrades.get(fill.coin) ?? null;
    const before = fill.startPosition ?? currentTrade?._position ?? 0;
    const after = roundPosition(before + fill.signedSize);
    const beforeSign = sign(before);
    const afterSign = sign(after);
    const matchedOrder = fill.orderId === null ? null : orderMap.get(fill.orderId) ?? null;

    if (fill.orderId !== null && matchedOrder === null) {
      missingOrderIds.add(fill.orderId);
    }

    if (currentTrade === null && beforeSign !== 0) {
      boundaryFillCount += 1;

      if (afterSign !== 0 && afterSign !== beforeSign) {
        const openingFragment = cloneFillWithSize(
          fill,
          Math.abs(after),
          after,
          "boundary-reverse-open",
        );
        const nextTrade = buildOpeningTrade(openingFragment, after);
        activeTrades.set(fill.coin, nextTrade);
      }

      return;
    }

    if (beforeSign === 0 || currentTrade === null) {
      const nextTrade = buildOpeningTrade(fill, after);
      activeTrades.set(fill.coin, nextTrade);
      return;
    }

    if (afterSign === beforeSign && Math.abs(after) > Math.abs(before)) {
      addEntry(fill, currentTrade, "addFills", after);
      return;
    }

    if (afterSign === beforeSign && Math.abs(after) < Math.abs(before)) {
      addExit(fill, currentTrade, "reduceFills");
      currentTrade._position = after;
      return;
    }

    if (afterSign === 0) {
      addExit(fill, currentTrade, "closeFills");
      finalizeTrade(currentTrade, fill.time, "closed");
      trades.push({
        ...currentTrade,
      });
      activeTrades.delete(fill.coin);
      return;
    }

    if (afterSign !== beforeSign) {
      const closingSize = Math.abs(before);
      const openingSize = Math.abs(after);
      const closeSignedSize = -before;
      const openSignedSize = after;
      const closingFragment = cloneFillWithSize(fill, closingSize, closeSignedSize, "reverse-close");
      const openingFragment = cloneFillWithSize(fill, openingSize, openSignedSize, "reverse-open");

      addExit(closingFragment, currentTrade, "closeFills");
      finalizeTrade(currentTrade, fill.time, "reversed-fragment");
      trades.push({
        ...currentTrade,
      });

      const nextTrade = buildOpeningTrade(openingFragment, after);
      activeTrades.set(fill.coin, nextTrade);
      return;
    }
  });

  activeTrades.forEach((trade) => {
    trade.entryPrice = averagePrice(trade._entryVolumeValue, trade._entryVolume) ?? trade.entryPrice;
    trade.exitPrice = averagePrice(trade._exitVolumeValue, trade._exitVolume);
    trade.netPnl = trade.executionClosedPnl;
    trades.push({
      ...trade,
    });
  });

  trades.forEach((trade) => {
    trade.rawOrderMatches = trade.orderIds
      .map((orderId) => orderMap.get(orderId) ?? null)
      .filter((order): order is ImportedOrder => order !== null);
    trade.executionMode = deriveExecutionMode(trade.rawOrderMatches);
    trade.entryStyleProxy = deriveEntryStyleProxy(trade.executionMode);
    trade.reconstructionConfidence =
      trade.rawOrderMatches.length === trade.orderIds.length &&
      trade.rawOrderMatches.length > 0 &&
      trade.executionMode !== "unknown" &&
      trade.entryStyleProxy !== "unknown"
        ? "high"
        : trade.rawOrderMatches.length > 0
          ? "medium"
          : "low";
  });

  attachFunding(trades, funding);

  if (missingOrderIds.size > 0) {
    warnings.push({
      code: "missing-order-matches",
      detail: `${missingOrderIds.size} fill-linked orders were not present in historicalOrders.`,
      severity: "warning",
    });
  }

  if (boundaryFillCount > 0) {
    warnings.push({
      code: "boundary-position-fills-excluded",
      detail: `${boundaryFillCount} aggregated fills belonged to positions opened before the selected window and were excluded from recommendation-grade trades.`,
      severity: "warning",
    });
  }

  if (trades.some((trade) => trade.executionMode === "unknown" || trade.entryStyleProxy === "unknown")) {
    warnings.push({
      code: "inferred-only-classifications",
      detail: "Some imported trades rely on fill-only inference for execution mode or entry-style proxy.",
      severity: "info",
    });
  }

  const sessions = buildSessions(trades);
  return { boundaryFillCount, sessions, trades, warnings };
}
