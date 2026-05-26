import type {
  BaselineDataQualityWarning,
  BaselineProfile,
  BaselineMetricRow,
  BuildBaselineProfileInput,
  HoldTimeBucket,
  ImportedTrade,
  TimeOfDayBucket,
} from "@/features/baseline-import/types";
import { getPortalTimeParts, resolvePortalTimezone } from "@/features/time/portal-time";

const RELIABLE_BEHAVIOR_BUCKET_TRADE_COUNT = 10;

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupMetricRows<Key extends string>(trades: ImportedTrade[], getKey: (trade: ImportedTrade) => Key): BaselineMetricRow<Key>[] {
  const grouped = new Map<Key, ImportedTrade[]>();
  trades.forEach((trade) => {
    const key = getKey(trade);
    const existing = grouped.get(key) ?? [];
    existing.push(trade);
    grouped.set(key, existing);
  });

  return Array.from(grouped.entries())
    .map(([key, groupedTrades]) => ({
      averageNetPnl: average(groupedTrades.map((trade) => trade.netPnl)),
      key,
      lossCount: groupedTrades.filter((trade) => trade.netPnl < 0).length,
      netPnl: groupedTrades.reduce((sum, trade) => sum + trade.netPnl, 0),
      sampleReliable: groupedTrades.length >= RELIABLE_BEHAVIOR_BUCKET_TRADE_COUNT,
      tradeCount: groupedTrades.length,
      winCount: groupedTrades.filter((trade) => trade.netPnl > 0).length,
    }))
    .sort((left, right) => right.tradeCount - left.tradeCount || left.key.localeCompare(right.key));
}

function getTimeOfDayBucket(time: number, timezone: string): TimeOfDayBucket {
  const hour = getPortalTimeParts(time, { timezone }).traderLocalHour;

  if (hour < 6) {
    return "overnight";
  }

  if (hour < 13) {
    return "premarket";
  }

  if (hour < 18) {
    return "cash";
  }

  if (hour < 22) {
    return "afternoon";
  }

  return "evening";
}

function getHoldTimeBucket(trade: ImportedTrade): HoldTimeBucket {
  if (trade.durationMinutes === null) {
    return "open";
  }

  if (trade.durationMinutes < 5) {
    return "<5m";
  }

  if (trade.durationMinutes <= 15) {
    return "5-15m";
  }

  if (trade.durationMinutes <= 60) {
    return "15-60m";
  }

  if (trade.durationMinutes <= 240) {
    return "1-4h";
  }

  if (trade.durationMinutes <= 24 * 60) {
    return "4-24h";
  }

  return "24h+";
}

function buildSizeAfterLoss(trades: ImportedTrade[]) {
  const sortedClosedTrades = [...trades]
    .filter((trade) => trade.status !== "open")
    .sort((left, right) => left.entryTime - right.entryTime);
  const events = [];

  for (let index = 0; index < sortedClosedTrades.length - 1; index += 1) {
    const previous = sortedClosedTrades[index];
    const next = sortedClosedTrades[index + 1];

    if (!previous || !next || previous.netPnl >= 0 || previous.maxSize <= 0) {
      continue;
    }

    const increaseRatio = next.maxSize / previous.maxSize - 1;
    events.push({
      flagged: increaseRatio >= 0.1,
      increaseRatio,
      nextTradeId: next.id,
      nextTradeMaxSize: next.maxSize,
      previousTradeId: previous.id,
      previousTradeMaxSize: previous.maxSize,
    });
  }

  return {
    events,
    flaggedCount: events.filter((event) => event.flagged).length,
  };
}

export function buildBaselineProfile({
  funding,
  ledgerUpdates,
  orders,
  request,
  sessionWarnings,
  trades,
  userFills,
}: BuildBaselineProfileInput) {
  const timezone = resolvePortalTimezone(request.timezone);
  const closedTrades = trades.filter((trade) => trade.status !== "open");
  const openTrades = trades.filter((trade) => trade.status === "open");
  const netPnl = closedTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const closedGrossFees = closedTrades.reduce((sum, trade) => sum + trade.grossFees, 0);
  const dataQuality: BaselineDataQualityWarning[] = [...sessionWarnings];

  if (userFills.length >= 2000) {
    dataQuality.push({
      code: "fill-cap-hit",
      detail: "userFillsByTime returned 2000 fills; the requested range may be truncated.",
      severity: "warning",
    });
  }

  if (orders.length >= 2000) {
    dataQuality.push({
      code: "order-cap-hit",
      detail: "historicalOrders returned 2000 orders; order enrichment may be truncated.",
      severity: "warning",
    });
  }

  if (request.endTime - request.startTime > 90 * 24 * 60 * 60 * 1000) {
    dataQuality.push({
      code: "requested-range-may-exceed-recent-fill-window",
      detail: "Requested range is large enough that Hyperliquid's recent-fill window may omit older fills.",
      severity: "info",
    });
  }

  if (trades.length === 0) {
    dataQuality.push({
      code: "empty-results-possible-wrong-address",
      detail: "No trades were reconstructed. The address may be empty, inactive, or an agent wallet instead of the account address.",
      severity: "warning",
    });
  }

  const profile: BaselineProfile = {
    accountAddress: request.accountAddress,
    byAsset: groupMetricRows(closedTrades, (trade) => trade.coin),
    byDirection: groupMetricRows(closedTrades, (trade) => trade.direction),
    byEntryStyleProxy: groupMetricRows(closedTrades, (trade) => trade.entryStyleProxy),
    byExecutionMode: groupMetricRows(closedTrades, (trade) => trade.executionMode),
    byHoldTimeBucket: groupMetricRows(closedTrades, (trade) => getHoldTimeBucket(trade)),
    byTimeOfDay: groupMetricRows(closedTrades, (trade) => getTimeOfDayBucket(trade.entryTime, timezone)),
    dataQuality,
    dateRange: {
      endTime: request.endTime,
      startTime: request.startTime,
      timezone,
    },
    environment: request.environment,
    fundingContext: {
      ledgerNetFlow: ledgerUpdates.reduce((sum, entry) => sum + (entry.delta ?? 0), 0),
      totalFundingPnl: funding.reduce((sum, entry) => sum + entry.delta, 0),
    },
    sessionBehavior: {
      averageTradesPerSession:
        average(
          Array.from(
            new Set(closedTrades.map((trade) => trade.sessionId).filter((sessionId): sessionId is string => Boolean(sessionId))),
          ).map((sessionId) => closedTrades.filter((trade) => trade.sessionId === sessionId).length),
        ),
      maxTradesInSession:
        Math.max(
          0,
          ...Array.from(
            new Set(closedTrades.map((trade) => trade.sessionId).filter((sessionId): sessionId is string => Boolean(sessionId))),
          ).map((sessionId) => closedTrades.filter((trade) => trade.sessionId === sessionId).length),
        ),
      sessionsOverFiveTrades: Array.from(
        new Set(closedTrades.map((trade) => trade.sessionId).filter((sessionId): sessionId is string => Boolean(sessionId))),
      ).filter((sessionId) => closedTrades.filter((trade) => trade.sessionId === sessionId).length > 5).length,
      shortGapTradeCount: closedTrades
        .slice()
        .sort((left, right) => left.entryTime - right.entryTime)
        .reduce((count, trade, index, sortedTrades) => {
          const previous = sortedTrades[index - 1];
          return previous && trade.entryTime - (previous.endTime ?? previous.entryTime) <= 15 * 60_000 ? count + 1 : count;
        }, 0),
      totalSessions: new Set(
        closedTrades.map((trade) => trade.sessionId).filter((sessionId): sessionId is string => Boolean(sessionId)),
      ).size,
    },
    sizeAfterLoss: buildSizeAfterLoss(closedTrades),
    source: "hyperliquid",
    totals: {
      averageClosedTradeNetPnl: average(closedTrades.map((trade) => trade.netPnl)),
      averageHoldMinutes: average(
        closedTrades.map((trade) => trade.durationMinutes).filter((duration): duration is number => duration !== null),
      ),
      closedGrossFees,
      closedTrades: closedTrades.length,
      executionClosedPnl: closedTrades.reduce((sum, trade) => sum + trade.executionClosedPnl, 0),
      flatCount: closedTrades.filter((trade) => trade.netPnl === 0).length,
      grossPnlBeforeFees: netPnl + closedGrossFees,
      grossFees: trades.reduce((sum, trade) => sum + trade.grossFees, 0),
      lossCount: closedTrades.filter((trade) => trade.netPnl < 0).length,
      netPnl,
      openTradeFees: openTrades.reduce((sum, trade) => sum + trade.grossFees, 0),
      totalTrades: trades.length,
      winCount: closedTrades.filter((trade) => trade.netPnl > 0).length,
      winRate:
        closedTrades.length === 0
          ? null
          : closedTrades.filter((trade) => trade.netPnl > 0).length / closedTrades.length,
    },
    version: "v1",
  };

  return profile;
}
