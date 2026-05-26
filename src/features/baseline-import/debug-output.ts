import type {
  BaselineImportRequest,
  BaselineImportScanResult,
  BaselineMetricRow,
  HyperliquidPortfolioWire,
  ImportedFill,
  ImportedFundingRecord,
  ImportedLedgerUpdate,
  ImportedOrder,
  ImportedSession,
  ImportedTrade,
} from "@/features/baseline-import/types";
import { buildSessionIntelligenceDebugOutput } from "@/features/baseline-import/session-intelligence";
import { tradeOverlapsOvernightWindow, resolvePortalTimezone } from "@/features/time/portal-time";

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>(
    (counts, value) => ({
      ...counts,
      [value]: (counts[value] ?? 0) + 1,
    }),
    {} as Record<T, number>,
  );
}

function summarizeMetricRows<Key extends string>(rows: BaselineMetricRow<Key>[]) {
  return rows.map((row) => ({
    averageNetPnl: row.averageNetPnl,
    key: row.key,
    lossCount: row.lossCount,
    netPnl: row.netPnl,
    sampleReliable: row.sampleReliable,
    tradeCount: row.tradeCount,
    winCount: row.winCount,
  }));
}

function parseFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function summarizePortfolioPeriod(portfolio: HyperliquidPortfolioWire | null, period: string) {
  const entry = portfolio?.find(([key]) => key === period)?.[1] ?? null;
  if (!entry) {
    return null;
  }

  const accountValueHistory = Array.isArray(entry.accountValueHistory) ? entry.accountValueHistory : [];
  const pnlHistory = Array.isArray(entry.pnlHistory) ? entry.pnlHistory : [];
  const firstAccountValue = accountValueHistory[0] ?? null;
  const latestAccountValue = accountValueHistory[accountValueHistory.length - 1] ?? null;
  const firstPnl = pnlHistory[0] ?? null;
  const latestPnl = pnlHistory[pnlHistory.length - 1] ?? null;

  return {
    accountValueFirst: firstAccountValue ? parseFiniteNumber(firstAccountValue[1]) : null,
    accountValueFirstTime: firstAccountValue?.[0] ?? null,
    accountValueLatest: latestAccountValue ? parseFiniteNumber(latestAccountValue[1]) : null,
    accountValueLatestTime: latestAccountValue?.[0] ?? null,
    points: {
      accountValue: accountValueHistory.length,
      pnl: pnlHistory.length,
    },
    pnlFirst: firstPnl ? parseFiniteNumber(firstPnl[1]) : null,
    pnlFirstTime: firstPnl?.[0] ?? null,
    pnlLatest: latestPnl ? parseFiniteNumber(latestPnl[1]) : null,
    pnlLatestTime: latestPnl?.[0] ?? null,
    volume: parseFiniteNumber(entry.vlm),
  };
}

function extractAccountValueSnapshot(accountSnapshot: BaselineImportScanResult["accountSnapshot"]) {
  if (!accountSnapshot) {
    return null;
  }

  const marginSummary =
    typeof accountSnapshot.marginSummary === "object" && accountSnapshot.marginSummary !== null
      ? (accountSnapshot.marginSummary as Record<string, unknown>)
      : null;

  return {
    accountValue: parseFiniteNumber(marginSummary?.accountValue),
    rawSnapshotPresent: true,
    snapshotScope: "current clearinghouseState at audit runtime",
    totalMarginUsed: parseFiniteNumber(marginSummary?.totalMarginUsed),
    totalNtlPos: parseFiniteNumber(marginSummary?.totalNtlPos),
    totalRawUsd: parseFiniteNumber(marginSummary?.totalRawUsd),
  };
}

function extractOpenPositionSnapshot(accountSnapshot: BaselineImportScanResult["accountSnapshot"]) {
  const assetPositions = Array.isArray(accountSnapshot?.assetPositions) ? accountSnapshot.assetPositions : [];
  const positions = assetPositions
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const position =
        typeof (entry as Record<string, unknown>).position === "object" &&
        (entry as Record<string, unknown>).position !== null
          ? ((entry as Record<string, unknown>).position as Record<string, unknown>)
          : null;

      if (!position) {
        return null;
      }

      return {
        coin: typeof position.coin === "string" ? position.coin : null,
        entryPx: parseFiniteNumber(position.entryPx),
        liquidationPx: parseFiniteNumber(position.liquidationPx),
        marginUsed: parseFiniteNumber(position.marginUsed),
        positionValue: parseFiniteNumber(position.positionValue),
        size: parseFiniteNumber(position.szi),
        unrealizedPnl: parseFiniteNumber(position.unrealizedPnl),
      };
    })
    .filter((position): position is NonNullable<typeof position> => position !== null);

  return {
    positions,
    snapshotScope: "current clearinghouseState at audit runtime",
  };
}

function currentDayCoverage(request: BaselineImportRequest, generatedAtMs: number) {
  const endDay = new Date(request.endTime).toISOString().slice(0, 10);
  const generatedDay = new Date(generatedAtMs).toISOString().slice(0, 10);

  if (endDay !== generatedDay) {
    return "range-ended-before-current-day";
  }

  if (request.endTime > generatedAtMs) {
    return "current-day-partial-api-results";
  }

  return "current-day-ended-at-or-before-audit-time";
}

export function buildHyperliquidPnlReconciliationDebugOutput(
  request: BaselineImportRequest,
  result: BaselineImportScanResult,
  options: {
    hyperliquidPortfolio?: HyperliquidPortfolioWire | null;
    hyperliquidScreenPnlApproxUsd?: number | null;
  } = {},
) {
  const generatedAtMs = Date.now();
  const timezone = resolvePortalTimezone(request.timezone);
  const closedTrades = result.trades.filter((trade) => trade.status !== "open");
  const openTrades = result.trades.filter((trade) => trade.status === "open");
  const closedPnlSum = closedTrades.reduce((sum, trade) => sum + trade.executionClosedPnl, 0);
  const allRawFillClosedPnlSum = result.fills.reduce((sum, fill) => sum + fill.closedPnl, 0);
  const feeSum = closedTrades.reduce((sum, trade) => sum + trade.grossFees, 0);
  const fundingSum = result.funding.reduce((sum, record) => sum + record.delta, 0);
  const attributedFundingSum = closedTrades.reduce((sum, trade) => sum + trade.fundingPnl, 0);
  const netPnl = closedTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const hasBoundaryFills = result.sourceHealth.boundaryFillCount > 0;
  const hasOpenTrades = openTrades.length > 0;
  const portfolio = options.hyperliquidPortfolio ?? null;

  return {
    version: "v1",
    generatedAt: new Date(generatedAtMs).toISOString(),
    kind: "portal-hyperliquid-pnl-reconciliation",
    wallet: request.accountAddress,
    environment: request.environment,
    range: {
      hyperliquid30dAssumption: {
        source: "Hyperliquid portfolio month/perpMonth graph when available",
        boundarySemantics: "rolling sampled portfolio window, not Portal date-input UTC days",
        samplingNote: "Hyperliquid docs describe 15-minute graph samples and deposit/withdrawal samples.",
      },
      portalScanRange: {
        boundarySemantics: "UTC inclusive day boundaries",
        currentDayCoverage: currentDayCoverage(request, generatedAtMs),
        endIso: new Date(request.endTime).toISOString(),
        endTime: request.endTime,
        startIso: new Date(request.startTime).toISOString(),
        startTime: request.startTime,
        timezone,
      },
    },
    rawSourceCounts: {
      fills: result.fills.length,
      fundingRows: result.funding.length,
      ledgerRows: result.ledgerUpdates.length,
      orders: result.orders.length,
    },
    reconstruction: {
      boundaryFillsExcluded: result.sourceHealth.boundaryFillCount,
      closedTradeCount: closedTrades.length,
      openTradeCount: openTrades.length,
      reconstructedTradeCount: result.trades.length,
      reversedFragmentCount: result.trades.filter((trade) => trade.status === "reversed-fragment").length,
    },
    totals: {
      allRawFillClosedPnlSum,
      attributedFundingSum,
      closedPnlSum,
      feeSum,
      fundingSum,
      ledgerNetFlow: result.ledgerUpdates.reduce((sum, entry) => sum + (entry.delta ?? 0), 0),
      netPnl,
      reconstructedVsRawClosedPnlDelta: closedPnlSum - allRawFillClosedPnlSum,
    },
    portalMetric: {
      label: "Reconstructed closed-trade net",
      netPnlFormulaUsed: "closed trades: sum(fill.closedPnl) + attributed funding",
      value: netPnl,
      includes: [
        "reconstructed in-range closed trades",
        "Hyperliquid fill closedPnl",
        "funding attributed to reconstructed trade windows",
      ],
      excludes: [
        "unrealized PnL",
        "account value changes",
        "deposits and withdrawals",
        "open trades at range end",
        "boundary fills from positions opened before the range",
      ],
      feeSemanticsNote:
        "Fees are reported separately. Portal does not independently prove whether Hyperliquid closedPnl is already fee-inclusive for every fill shape.",
    },
    hyperliquidPortfolio: portfolio
      ? {
          month: summarizePortfolioPeriod(portfolio, "month"),
          perpMonth: summarizePortfolioPeriod(portfolio, "perpMonth"),
          screenPnlApproxUsd: options.hyperliquidScreenPnlApproxUsd ?? null,
        }
      : null,
    accountValueSnapshot: extractAccountValueSnapshot(result.accountSnapshot),
    openPositionSnapshot: extractOpenPositionSnapshot(result.accountSnapshot),
    warnings: {
      boundaryFillsExcluded: hasBoundaryFills,
      openTradesExcluded: hasOpenTrades,
      feeMathLabelUnsafe: true,
      rangeMayNotMatchHyperliquidThirtyDay: true,
    },
    possibleCausesOfMismatch: [
      "Hyperliquid 30D PNL is portfolio/account-value based; Portal is reconstructed closed-trade based.",
      "Hyperliquid portfolio graphs include unrealized PnL through account value; Portal excludes open-trade unrealized PnL.",
      "Hyperliquid adjusts portfolio PNL with net deposits and withdrawals; Portal only reports ledger rows as context.",
      "Portal excludes boundary fills from positions opened before the selected range.",
      "Portal uses UTC inclusive date-input boundaries; Hyperliquid 30D is a rolling sampled graph window.",
      "Portal fee labeling was unsafe unless closedPnl fee semantics are independently reconciled.",
    ],
  };
}

export function buildInsightBaselineDebugOutput(
  request: BaselineImportRequest,
  result: BaselineImportScanResult,
) {
  const timezone = resolvePortalTimezone(request.timezone);
  const matchedOrderCount = result.trades.reduce(
    (count, trade) => count + trade.rawOrderMatches.length,
    0,
  );
  const unmatchedTradeCount = result.trades.filter(
    (trade) => trade.rawOrderMatches.length === 0,
  ).length;
  const closedTrades = result.trades.filter((trade) => trade.status !== "open");

  return {
    version: "v1",
    generatedAt: new Date().toISOString(),
    kind: "portal-insight-baseline-debug",
    request: {
      accountAddress: request.accountAddress,
      endIso: new Date(request.endTime).toISOString(),
      endTime: request.endTime,
      environment: request.environment,
      startIso: new Date(request.startTime).toISOString(),
      startTime: request.startTime,
      timezone,
    },
    rawSourceCounts: {
      accountSnapshotPresent: result.accountSnapshot !== null,
      fills: result.fills.length,
      funding: result.funding.length,
      ledgerUpdates: result.ledgerUpdates.length,
      orders: result.orders.length,
    },
    reconstruction: {
      boundaryFillsExcluded: result.sourceHealth.boundaryFillCount,
      closedTrades: closedTrades.length,
      matchedOrderCount,
      openTrades: result.trades.filter((trade) => trade.status === "open").length,
      reconstructedTrades: result.trades.length,
      reversedFragments: result.trades.filter((trade) => trade.status === "reversed-fragment").length,
      sessions: result.sessions.length,
      unmatchedTradeCount,
    },
    sourceHealth: result.sourceHealth,
    warningsGenerated: result.warnings.map((warning) => ({
      code: warning.code,
      detail: warning.detail,
      severity: warning.severity,
    })),
    classifierOutputs: {
      assetBreakdown: summarizeMetricRows(result.profile.byAsset),
      directionBreakdown: summarizeMetricRows(result.profile.byDirection),
      entryStyleProxyBreakdown: summarizeMetricRows(result.profile.byEntryStyleProxy),
      executionModeBreakdown: summarizeMetricRows(result.profile.byExecutionMode),
      holdTimeBreakdown: summarizeMetricRows(result.profile.byHoldTimeBucket),
      sizeAfterLoss: result.profile.sizeAfterLoss,
      timeOfDayBreakdown: summarizeMetricRows(result.profile.byTimeOfDay),
      tradeReconstructionConfidence: countBy(
        result.trades.map((trade) => trade.reconstructionConfidence),
      ),
    },
    confidenceNotes: {
      dataQualityWarningCodes: result.profile.dataQuality.map((warning) => warning.code),
      inferredOnlyTradeCount: result.trades.filter(
        (trade) =>
          trade.executionMode === "unknown" ||
          trade.entryStyleProxy === "unknown" ||
          trade.reconstructionConfidence !== "high",
      ).length,
      recommendationTradeCount: result.sourceHealth.recommendationTradeCount,
      reliableBehaviorBucketMinimum: 10,
      summary:
        result.profile.dataQuality.length > 0
          ? "Use as directional history; data-quality warnings are present."
          : "No source warnings were generated for this scan.",
    },
    headlineMetrics: result.profile.totals,
    sessionIntelligence: result.sessionIntelligence
      ? buildSessionIntelligenceDebugOutput(request, result.sessionIntelligence, {
          sourceQualityWarnings: result.warnings,
        })
      : null,
  };
}

function getRawTimestampValid(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric > 0;
    }

    return Number.isFinite(Date.parse(value));
  }

  return false;
}

function getOrderTimestampFields(order: ImportedOrder) {
  const rawOrder =
    typeof order.raw.order === "object" && order.raw.order !== null
      ? order.raw.order
      : order.raw;

  return [
    rawOrder.timestamp,
    order.raw.statusTimestamp,
  ].filter((value) => value !== undefined);
}

function countInvalidTimestamps(input: {
  fills: ImportedFill[];
  funding: ImportedFundingRecord[];
  ledgerUpdates: ImportedLedgerUpdate[];
  orders: ImportedOrder[];
}) {
  const fillCount = input.fills.filter((fill) => !getRawTimestampValid(fill.raw.time)).length;
  const orderCount = input.orders.filter((order) => {
    const timestampFields = getOrderTimestampFields(order);
    return timestampFields.length > 0 && timestampFields.some((value) => !getRawTimestampValid(value));
  }).length;
  const fundingCount = input.funding.filter((record) => !getRawTimestampValid(record.raw.time)).length;
  const ledgerCount = input.ledgerUpdates.filter((record) => !getRawTimestampValid(record.raw.time)).length;

  return {
    fills: fillCount,
    funding: fundingCount,
    ledgerUpdates: ledgerCount,
    orders: orderCount,
    total: fillCount + orderCount + fundingCount + ledgerCount,
  };
}

function countDuplicateFills(fills: ImportedFill[]) {
  const ids = new Set<string>();
  const semanticKeys = new Set<string>();
  let duplicateIds = 0;
  let duplicateSemanticKeys = 0;

  fills.forEach((fill) => {
    if (ids.has(fill.id)) {
      duplicateIds += 1;
    }
    ids.add(fill.id);

    const semanticKey = [
      fill.coin,
      fill.time,
      fill.orderId ?? "no-order",
      fill.tradeId ?? "no-trade",
      fill.side,
      fill.size ?? "no-size",
      fill.price ?? "no-price",
      fill.closedPnl,
      fill.fee,
    ].join("|");

    if (semanticKeys.has(semanticKey)) {
      duplicateSemanticKeys += 1;
    }
    semanticKeys.add(semanticKey);
  });

  return {
    duplicateIds,
    duplicateSemanticKeys,
    total: duplicateIds + duplicateSemanticKeys,
  };
}

function countUnmatchedFillOrderIds(fills: ImportedFill[], orders: ImportedOrder[]) {
  const orderIds = new Set(
    orders
      .map((order) => order.orderId)
      .filter((orderId): orderId is number => orderId !== null),
  );

  return new Set(
    fills
      .map((fill) => fill.orderId)
      .filter((orderId): orderId is number => orderId !== null && !orderIds.has(orderId)),
  ).size;
}

function sessionTrades(session: ImportedSession, trades: ImportedTrade[]) {
  const tradeIds = new Set(session.tradeIds);
  return trades.filter((trade) => tradeIds.has(trade.id));
}

function countPostLossReentryClusters(trades: ImportedTrade[]) {
  const closedTrades = [...trades]
    .filter((trade) => trade.status !== "open")
    .sort((left, right) => left.entryTime - right.entryTime);
  let clusterCount = 0;

  for (let index = 0; index < closedTrades.length - 1; index += 1) {
    const previous = closedTrades[index];
    const next = closedTrades[index + 1];

    if (
      previous &&
      next &&
      previous.netPnl < 0 &&
      next.entryTime - (previous.endTime ?? previous.entryTime) <= 15 * 60_000
    ) {
      clusterCount += 1;
    }
  }

  return clusterCount;
}

export function buildTradeReconstructionDebugOutput(
  request: BaselineImportRequest,
  result: BaselineImportScanResult,
) {
  const timezone = resolvePortalTimezone(request.timezone);
  const closedTrades = result.trades.filter((trade) => trade.status !== "open");
  const openTrades = result.trades.filter((trade) => trade.status === "open");
  const matchedOrderCount = result.trades.reduce(
    (count, trade) => count + trade.rawOrderMatches.length,
    0,
  );
  const unmatchedTradeCount = result.trades.filter((trade) => trade.rawOrderMatches.length === 0).length;
  const invalidTimestamps = countInvalidTimestamps({
    fills: result.fills,
    funding: result.funding,
    ledgerUpdates: result.ledgerUpdates,
    orders: result.orders,
  });
  const duplicateFills = countDuplicateFills(result.fills);
  const highDensitySessions = result.sessions.filter(
    (session) => sessionTrades(session, result.trades).filter((trade) => trade.status !== "open").length > 5,
  ).length;
  const overnightSessions = result.sessions.filter((session) =>
    tradeOverlapsOvernightWindow(
      {
        endEpochMs: session.endedAt,
        startEpochMs: session.startedAt,
      },
      { timezone },
    ),
  ).length;
  const confidenceWarnings = [
    ...result.warnings.map((warning) => warning.detail),
    duplicateFills.total > 0
      ? `${duplicateFills.total} duplicate fill signals detected in normalized fill history.`
      : null,
    invalidTimestamps.total > 0
      ? `${invalidTimestamps.total} invalid source timestamps detected before normalization.`
      : null,
    `Overnight counters use the scan timezone (${timezone}) with any-overlap logic and remain audit-only until the session engine is built.`,
    "Net PnL uses Hyperliquid closedPnl plus funding; fee treatment depends on Hyperliquid closedPnl semantics and is not independently reconciled.",
  ].filter((warning): warning is string => Boolean(warning));

  return {
    version: "v1",
    generatedAt: new Date().toISOString(),
    kind: "portal-trade-reconstruction-debug",
    request: {
      accountAddress: request.accountAddress,
      endIso: new Date(request.endTime).toISOString(),
      endTime: request.endTime,
      environment: request.environment,
      startIso: new Date(request.startTime).toISOString(),
      startTime: request.startTime,
      timezone,
    },
    rawSourceCounts: {
      accountSnapshotPresent: result.accountSnapshot !== null,
      fills: result.fills.length,
      funding: result.funding.length,
      ledgerUpdates: result.ledgerUpdates.length,
      orders: result.orders.length,
    },
    reconstructionCounts: {
      boundaryFillsExcluded: result.sourceHealth.boundaryFillCount,
      closedTrades: closedTrades.length,
      duplicateFillsDetected: duplicateFills,
      invalidTimestampsDetected: invalidTimestamps,
      matchedOrders: matchedOrderCount,
      openTrades: openTrades.length,
      reconstructedTrades: result.trades.length,
      reversedFragments: result.trades.filter((trade) => trade.status === "reversed-fragment").length,
      unmatchedFillOrderIds: countUnmatchedFillOrderIds(result.fills, result.orders),
      unmatchedTrades: unmatchedTradeCount,
    },
    sessionCounts: {
      highDensitySessions,
      overnightDefinition: {
        endTime: "05:00",
        note: "Audit-only session counter using persisted scan timezone. Not PnL attribution.",
        startTime: "20:00",
        timezone,
      },
      overnightSessions,
      postLossReentryClusters: countPostLossReentryClusters(result.trades),
      sessions: result.sessions.length,
    },
    pnlTotals: {
      totalFees: result.profile.totals.grossFees,
      totalFunding: result.profile.fundingContext.totalFundingPnl,
      totalGrossPnl: result.profile.totals.grossPnlBeforeFees,
      totalNetPnl: result.profile.totals.netPnl,
    },
    classifierOutputs: {
      directionBreakdown: summarizeMetricRows(result.profile.byDirection),
      entryStyleProxyBreakdown: summarizeMetricRows(result.profile.byEntryStyleProxy),
      executionModeBreakdown: summarizeMetricRows(result.profile.byExecutionMode),
      holdTimeBreakdown: summarizeMetricRows(result.profile.byHoldTimeBucket),
      sessionBehavior: result.profile.sessionBehavior,
      sizeAfterLoss: result.profile.sizeAfterLoss,
      timeOfDayBreakdown: summarizeMetricRows(result.profile.byTimeOfDay),
      tradeReconstructionConfidence: countBy(
        result.trades.map((trade) => trade.reconstructionConfidence),
      ),
    },
    confidenceWarnings,
    sessionIntelligence: result.sessionIntelligence
      ? buildSessionIntelligenceDebugOutput(request, result.sessionIntelligence, {
          sourceQualityWarnings: result.warnings,
        })
      : null,
  };
}
