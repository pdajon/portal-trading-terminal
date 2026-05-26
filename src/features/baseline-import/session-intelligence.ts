import type {
  BaselineDataQualityWarning,
  BaselineImportRequest,
  DiagnosisReadiness,
  ImportedTrade,
  ReconstructedSession,
  SessionConfidence,
  SessionIntelligenceResult,
  SessionIntelligenceSummary,
  SessionTag,
  SessionType,
  SourceCompleteness,
  TradeResult,
} from "@/features/baseline-import/types";
import {
  getPortalTimeParts,
  isTraderLocalWeekend,
  resolvePortalTimezone,
  tradeOverlapsOvernightWindow,
} from "@/features/time/portal-time";

const DEFAULT_SESSION_GAP_MINUTES = 90;
const SHORT_GAP_MINUTES = 15;

type SourceHealthInput = {
  aggregatedFillCount: number;
  boundaryFillCount: number;
  recommendationTradeCount: number;
};

export type BuildSessionIntelligenceInput = {
  request: BaselineImportRequest;
  sessionGapMinutes?: number;
  sourceHealth?: SourceHealthInput;
  trades: ImportedTrade[];
  warnings?: BaselineDataQualityWarning[];
};

type GapStats = {
  avgGapBetweenTrades: number | null;
  postLossReentryCount: number;
  revengeRiskCount: number;
  shortGapTradeCount: number;
};

function sortTrades(trades: ImportedTrade[]) {
  return [...trades].sort(
    (left, right) =>
      left.entryTime - right.entryTime ||
      (left.endTime ?? left.entryTime) - (right.endTime ?? right.entryTime) ||
      left.coin.localeCompare(right.coin) ||
      left.id.localeCompare(right.id),
  );
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function tradeEnd(trade: ImportedTrade) {
  return trade.endTime ?? trade.entryTime;
}

function tradeResult(trade: ImportedTrade | undefined): TradeResult {
  if (!trade) {
    return "unknown";
  }

  if (trade.status === "open") {
    return "open";
  }

  if (trade.netPnl > 0) {
    return "win";
  }

  if (trade.netPnl < 0) {
    return "loss";
  }

  return "flat";
}

function tradeNotionalExposure(trade: ImportedTrade) {
  return trade.entryPrice === null ? null : Math.abs(trade.maxSize * trade.entryPrice);
}

function shouldStartNewSession(input: {
  current: ImportedTrade;
  gapMinutes: number;
  previous: ImportedTrade;
  sessionGapMinutes: number;
  timezone: string;
}) {
  if (input.gapMinutes > input.sessionGapMinutes) {
    return true;
  }

  const previousLocalDate = getPortalTimeParts(input.previous.entryTime, {
    timezone: input.timezone,
  }).traderLocalDateKey;
  const currentLocalDate = getPortalTimeParts(input.current.entryTime, {
    timezone: input.timezone,
  }).traderLocalDateKey;

  if (previousLocalDate === currentLocalDate) {
    return false;
  }

  const previousOvernight = tradeOverlapsOvernightWindow(
    {
      endEpochMs: input.previous.endTime,
      startEpochMs: input.previous.entryTime,
    },
    { timezone: input.timezone },
  );
  const currentOvernight = tradeOverlapsOvernightWindow(
    {
      endEpochMs: input.current.endTime,
      startEpochMs: input.current.entryTime,
    },
    { timezone: input.timezone },
  );

  return !(previousOvernight && currentOvernight);
}

function buildPrimarySessionGroups(input: {
  sessionGapMinutes: number;
  timezone: string;
  trades: ImportedTrade[];
}) {
  const groups: ImportedTrade[][] = [];

  sortTrades(input.trades).forEach((trade) => {
    const currentGroup = groups[groups.length - 1];
    const previousTrade = currentGroup?.[currentGroup.length - 1] ?? null;

    if (!currentGroup || !previousTrade) {
      groups.push([trade]);
      return;
    }

    const gapMinutes = Math.max(0, (trade.entryTime - tradeEnd(previousTrade)) / 60_000);

    if (
      shouldStartNewSession({
        current: trade,
        gapMinutes,
        previous: previousTrade,
        sessionGapMinutes: input.sessionGapMinutes,
        timezone: input.timezone,
      })
    ) {
      groups.push([trade]);
      return;
    }

    currentGroup.push(trade);
  });

  return groups;
}

function countGaps(trades: ImportedTrade[]): GapStats {
  let shortGapTradeCount = 0;
  let postLossReentryCount = 0;
  let revengeRiskCount = 0;
  const gaps: number[] = [];

  for (let index = 1; index < trades.length; index += 1) {
    const previous = trades[index - 1];
    const current = trades[index];

    if (!previous || !current) {
      continue;
    }

    const gapMinutes = Math.max(0, (current.entryTime - tradeEnd(previous)) / 60_000);
    gaps.push(gapMinutes);

    if (gapMinutes <= SHORT_GAP_MINUTES) {
      shortGapTradeCount += 1;

      if (previous.status !== "open" && previous.netPnl < 0) {
        postLossReentryCount += 1;

        const previousNotional = tradeNotionalExposure(previous);
        const currentNotional = tradeNotionalExposure(current);
        const previousRisk = previousNotional ?? previous.maxSize;
        const currentRisk = currentNotional ?? current.maxSize;

        if (previousRisk > 0 && currentRisk >= previousRisk * 1.1) {
          revengeRiskCount += 1;
        }
      }
    }
  }

  return {
    avgGapBetweenTrades: average(gaps),
    postLossReentryCount,
    revengeRiskCount,
    shortGapTradeCount,
  };
}

function buildAssetMix(trades: ImportedTrade[]) {
  return trades.reduce<Record<string, { netPnl: number | null; tradeCount: number }>>((mix, trade) => {
    const existing = mix[trade.coin] ?? { netPnl: 0, tradeCount: 0 };
    mix[trade.coin] = {
      netPnl: (existing.netPnl ?? 0) + trade.netPnl,
      tradeCount: existing.tradeCount + 1,
    };
    return mix;
  }, {});
}

function buildDirectionMix(trades: ImportedTrade[]) {
  return trades.reduce<ReconstructedSession["directionMix"]>(
    (mix, trade) => {
      const current = mix[trade.direction];
      mix[trade.direction] = {
        netPnl: (current.netPnl ?? 0) + trade.netPnl,
        tradeCount: current.tradeCount + 1,
      };
      return mix;
    },
    {
      long: { netPnl: 0, tradeCount: 0 },
      short: { netPnl: 0, tradeCount: 0 },
    },
  );
}

function countStreaks(trades: ImportedTrade[]) {
  let currentLosses = 0;
  let currentWins = 0;
  let maxConsecutiveLosses = 0;
  let maxConsecutiveWins = 0;

  trades.forEach((trade) => {
    const result = tradeResult(trade);

    if (result === "loss") {
      currentLosses += 1;
      currentWins = 0;
    } else if (result === "win") {
      currentWins += 1;
      currentLosses = 0;
    } else {
      currentLosses = 0;
      currentWins = 0;
    }

    maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
  });

  return { maxConsecutiveLosses, maxConsecutiveWins };
}

function calculateOrderMatchCompleteness(trades: ImportedTrade[]): ReconstructedSession["orderMatchCompleteness"] {
  const matchedOrderIds = new Set<number>();
  const expectedOrderIds = new Set<number>();
  let fullyMatchedTrades = 0;
  let partiallyMatchedTrades = 0;
  let unmatchedTrades = 0;

  trades.forEach((trade) => {
    trade.orderIds.forEach((orderId) => expectedOrderIds.add(orderId));
    trade.rawOrderMatches.forEach((order) => {
      if (order.orderId !== null) {
        matchedOrderIds.add(order.orderId);
      }
    });

    if (trade.orderIds.length === 0 && trade.rawOrderMatches.length === 0) {
      unmatchedTrades += 1;
      return;
    }

    const matchedForTrade = trade.orderIds.filter((orderId) =>
      trade.rawOrderMatches.some((order) => order.orderId === orderId),
    ).length;

    if (matchedForTrade === trade.orderIds.length) {
      fullyMatchedTrades += 1;
    } else if (matchedForTrade > 0) {
      partiallyMatchedTrades += 1;
    } else {
      unmatchedTrades += 1;
    }
  });

  return {
    fullyMatchedTrades,
    matchedOrderIds: matchedOrderIds.size,
    partiallyMatchedTrades,
    unmatchedOrderIds: Math.max(0, expectedOrderIds.size - matchedOrderIds.size),
    unmatchedTrades,
  };
}

function sourceCompletenessFor(input: {
  closedTrades: number;
  hasInvalidTimestamp: boolean;
  openTrades: number;
  orderMatchCompleteness: ReconstructedSession["orderMatchCompleteness"];
  sourceHealth?: SourceHealthInput;
  warnings: BaselineDataQualityWarning[];
}): SourceCompleteness[] {
  const completeness: SourceCompleteness[] = [];
  const warningCodes = new Set(input.warnings.map((warning) => warning.code));

  if (input.closedTrades === 0) {
    completeness.push("insufficient_source");
  }

  if ((input.sourceHealth?.boundaryFillCount ?? 0) > 0 || warningCodes.has("boundary-position-fills-excluded")) {
    completeness.push("partial_boundary");
  }

  if (input.openTrades > 0) {
    completeness.push("partial_open");
  }

  if (
    warningCodes.has("fill-cap-hit") ||
    warningCodes.has("order-cap-hit") ||
    warningCodes.has("requested-range-may-exceed-recent-fill-window")
  ) {
    completeness.push("possibly_truncated");
  }

  if (
    input.orderMatchCompleteness.unmatchedTrades > 0 ||
    input.orderMatchCompleteness.partiallyMatchedTrades > 0 ||
    warningCodes.has("missing-order-matches")
  ) {
    completeness.push("order_enrichment_incomplete");
  }

  if (input.hasInvalidTimestamp) {
    completeness.push("invalid_timestamps");
  }

  return completeness.length > 0 ? unique(completeness) : ["complete" satisfies SourceCompleteness];
}

function confidenceFor(input: {
  closedTrades: number;
  sourceCompleteness: SourceCompleteness[];
  timezoneProvided: boolean;
}) {
  const reasons = [
    "PnL confidence is capped at medium until Hyperliquid closedPnl fee semantics are independently reconciled.",
  ];
  let confidence: SessionConfidence = "medium";

  if (!input.timezoneProvided) {
    confidence = "low";
    reasons.push("Missing scan timezone; time/session claims are capped at low confidence.");
  }

  if (input.closedTrades === 0) {
    confidence = "low";
    reasons.push("No closed trades in session; use only for exposure context.");
  } else if (input.closedTrades < 2) {
    confidence = "low";
    reasons.push("Fewer than 2 closed trades in session.");
  }

  if (input.sourceCompleteness.includes("invalid_timestamps")) {
    confidence = "insufficient_evidence";
    reasons.push("Invalid timestamps make time-based session claims unsafe.");
  }

  if (input.sourceCompleteness.includes("partial_open") && confidence !== "insufficient_evidence") {
    confidence = "low";
    reasons.push("Open trades downgrade PnL confidence.");
  }

  if (
    input.sourceCompleteness.some((entry) =>
      ["partial_boundary", "possibly_truncated", "order_enrichment_incomplete"].includes(entry),
    ) &&
    confidence === "medium"
  ) {
    confidence = "low";
    reasons.push("Source warnings limit imported session confidence.");
  }

  return {
    confidence,
    confidenceReasons: unique(reasons),
  };
}

function diagnosisReadinessFor(confidence: SessionConfidence, sourceCompleteness: SourceCompleteness[]): DiagnosisReadiness {
  if (confidence === "insufficient_evidence" || sourceCompleteness.includes("invalid_timestamps")) {
    return "unsafe_not_enough_evidence";
  }

  if (confidence === "medium" && sourceCompleteness.length === 1 && sourceCompleteness[0] === "complete") {
    return "directional_only";
  }

  return "directional_only";
}

function sessionTypeFor(tags: SessionTag[]): SessionType {
  if (tags.includes("revenge_risk")) {
    return "revenge_risk";
  }

  if (tags.includes("post_loss")) {
    return "post_loss_reentry_cluster";
  }

  if (tags.includes("rapid_reentry")) {
    return "rapid_reentry_cluster";
  }

  if (tags.includes("high_density")) {
    return "high_density";
  }

  if (tags.includes("overnight")) {
    return "overnight";
  }

  if (tags.includes("weekend")) {
    return "weekend";
  }

  if (tags.includes("multi_asset")) {
    return "multi_asset";
  }

  if (tags.includes("long_bias") || tags.includes("short_bias")) {
    return "directional_bias";
  }

  return "standard_activity";
}

function hasInvalidTimestamp(trades: ImportedTrade[]) {
  return trades.some(
    (trade) =>
      !Number.isFinite(trade.entryTime) ||
      trade.entryTime <= 0 ||
      (trade.endTime !== null && (!Number.isFinite(trade.endTime) || trade.endTime <= 0)),
  );
}

function buildSession(input: {
  index: number;
  request: BaselineImportRequest;
  sourceHealth?: SourceHealthInput;
  timezone: string;
  timezoneProvided: boolean;
  trades: ImportedTrade[];
  warnings: BaselineDataQualityWarning[];
}): ReconstructedSession {
  const trades = sortTrades(input.trades);
  const closedTrades = trades.filter((trade) => trade.status !== "open");
  const openTrades = trades.filter((trade) => trade.status === "open");
  const startedAt = trades[0]?.entryTime ?? input.request.startTime;
  const endedAt = Math.max(...trades.map((trade) => tradeEnd(trade)), startedAt);
  const localDateKey = getPortalTimeParts(startedAt, { timezone: input.timezone }).traderLocalDateKey;
  const gapStats = countGaps(trades);
  const directionMix = buildDirectionMix(trades);
  const largestBaseSize = trades.length === 0 ? null : Math.max(...trades.map((trade) => trade.maxSize));
  const notionalValues = trades
    .map((trade) => tradeNotionalExposure(trade))
    .filter((value): value is number => value !== null);
  const orderMatchCompleteness = calculateOrderMatchCompleteness(trades);
  const sourceCompleteness = sourceCompletenessFor({
    closedTrades: closedTrades.length,
    hasInvalidTimestamp: hasInvalidTimestamp(trades),
    openTrades: openTrades.length,
    orderMatchCompleteness,
    sourceHealth: input.sourceHealth,
    warnings: input.warnings,
  });
  const { confidence, confidenceReasons } = confidenceFor({
    closedTrades: closedTrades.length,
    sourceCompleteness,
    timezoneProvided: input.timezoneProvided,
  });
  const isOvernight = trades.some((trade) =>
    tradeOverlapsOvernightWindow(
      {
        endEpochMs: trade.endTime,
        startEpochMs: trade.entryTime,
      },
      { timezone: input.timezone },
    ),
  );
  const isWeekend = trades.some((trade) => isTraderLocalWeekend(trade.entryTime, { timezone: input.timezone }));
  const isHighDensity =
    trades.length >= 6 ||
    (trades.length >= 4 && gapStats.avgGapBetweenTrades !== null && gapStats.avgGapBetweenTrades <= SHORT_GAP_MINUTES);
  const longRatio = trades.length === 0 ? 0 : directionMix.long.tradeCount / trades.length;
  const shortRatio = trades.length === 0 ? 0 : directionMix.short.tradeCount / trades.length;
  const tags: SessionTag[] = [];

  if (isOvernight) tags.push("overnight");
  if (isWeekend) tags.push("weekend");
  if (isHighDensity) tags.push("high_density");
  if (gapStats.shortGapTradeCount >= 2) tags.push("rapid_reentry");
  if (gapStats.postLossReentryCount > 0) tags.push("post_loss");
  if (gapStats.revengeRiskCount > 0) tags.push("revenge_risk");
  if (Object.keys(buildAssetMix(trades)).length >= 2) tags.push("multi_asset");
  if (longRatio >= 0.7) tags.push("long_bias");
  if (shortRatio >= 0.7) tags.push("short_bias");

  const wins = closedTrades.filter((trade) => trade.netPnl > 0).length;
  const losses = closedTrades.filter((trade) => trade.netPnl < 0).length;
  const netPnlAfterFeesAndFunding = closedTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const fees = trades.reduce((sum, trade) => sum + trade.grossFees, 0);
  const funding = trades.reduce((sum, trade) => sum + trade.fundingPnl, 0);
  const bestTrade = closedTrades.reduce<ImportedTrade | null>(
    (best, trade) => (!best || trade.netPnl > best.netPnl ? trade : best),
    null,
  );
  const worstTrade = closedTrades.reduce<ImportedTrade | null>(
    (worst, trade) => (!worst || trade.netPnl < worst.netPnl ? trade : worst),
    null,
  );
  const streaks = countStreaks(trades);

  return {
    accountAddress: input.request.accountAddress,
    assetMix: buildAssetMix(trades),
    averageHoldMinutes: average(
      closedTrades.map((trade) => trade.durationMinutes).filter((duration): duration is number => duration !== null),
    ),
    avgGapBetweenTrades: gapStats.avgGapBetweenTrades,
    bestTradeId: bestTrade?.id ?? null,
    boundaryTradeCount: input.sourceHealth?.boundaryFillCount ?? 0,
    closedTrades: closedTrades.length,
    confidence,
    confidenceReasons,
    diagnosisReadiness: diagnosisReadinessFor(confidence, sourceCompleteness),
    directionMix,
    endedAt,
    environment: input.request.environment,
    fees,
    firstTradeResult: tradeResult(trades[0]),
    funding,
    grossPnlBeforeFees: closedTrades.length === 0 ? null : netPnlAfterFeesAndFunding + fees,
    id: `session-${input.index + 1}`,
    isHighDensity,
    isOvernight,
    isPostLossCluster: gapStats.postLossReentryCount > 0,
    isRevengeRisk: gapStats.revengeRiskCount > 0,
    isWeekend,
    largestBaseSize,
    largestNotionalExposure: notionalValues.length === 0 ? null : Math.max(...notionalValues),
    lastTradeResult: tradeResult(trades[trades.length - 1]),
    localDateKey,
    losses,
    maxConsecutiveLosses: streaks.maxConsecutiveLosses,
    maxConsecutiveWins: streaks.maxConsecutiveWins,
    netPnlAfterFeesAndFunding: closedTrades.length === 0 ? null : netPnlAfterFeesAndFunding,
    openAtSessionEnd: openTrades.length > 0,
    openTrades: openTrades.length,
    orderMatchCompleteness,
    postLossReentryCount: gapStats.postLossReentryCount,
    sessionType: sessionTypeFor(tags),
    shortGapTradeCount: gapStats.shortGapTradeCount,
    sourceCompleteness,
    startedAt,
    tags,
    timezone: input.timezone,
    totalTimeInMarketMinutes: closedTrades.reduce((sum, trade) => sum + (trade.durationMinutes ?? 0), 0),
    totalTrades: trades.length,
    tradeIds: trades.map((trade) => trade.id),
    winRate: closedTrades.length === 0 ? null : wins / closedTrades.length,
    wins,
    worstTradeId: worstTrade?.id ?? null,
  };
}

function emptyTagCounts() {
  return {
    high_density: 0,
    long_bias: 0,
    multi_asset: 0,
    overnight: 0,
    post_loss: 0,
    rapid_reentry: 0,
    revenge_risk: 0,
    short_bias: 0,
    weekend: 0,
  } satisfies Record<SessionTag, number>;
}

function buildSummary(sessions: ReconstructedSession[]): SessionIntelligenceSummary {
  const tagCounts = emptyTagCounts();
  const confidenceDistribution: Record<SessionConfidence, number> = {
    high: 0,
    insufficient_evidence: 0,
    low: 0,
    medium: 0,
  };
  const diagnosisReadinessDistribution: Record<DiagnosisReadiness, number> = {
    directional_only: 0,
    ready_for_diagnosis: 0,
    unsafe_not_enough_evidence: 0,
  };

  sessions.forEach((session) => {
    session.tags.forEach((tag) => {
      tagCounts[tag] += 1;
    });
    confidenceDistribution[session.confidence] += 1;
    diagnosisReadinessDistribution[session.diagnosisReadiness] += 1;
  });

  const sessionsWithPnl = sessions.filter(
    (session): session is ReconstructedSession & { netPnlAfterFeesAndFunding: number } =>
      session.netPnlAfterFeesAndFunding !== null,
  );
  const topPositiveSession =
    sessionsWithPnl
      .filter((session) => session.netPnlAfterFeesAndFunding > 0)
      .sort((left, right) => right.netPnlAfterFeesAndFunding - left.netPnlAfterFeesAndFunding)[0] ?? null;
  const worstNegativeSession =
    sessionsWithPnl
      .filter((session) => session.netPnlAfterFeesAndFunding < 0)
      .sort((left, right) => left.netPnlAfterFeesAndFunding - right.netPnlAfterFeesAndFunding)[0] ?? null;

  return {
    confidenceDistribution,
    diagnosisReadinessDistribution,
    highDensitySessionCount: sessions.filter((session) => session.isHighDensity).length,
    overnightSessionCount: sessions.filter((session) => session.isOvernight).length,
    postLossClusterCount: sessions.filter((session) => session.isPostLossCluster).length,
    revengeRiskCount: sessions.filter((session) => session.isRevengeRisk).length,
    sessionCount: sessions.length,
    tagCounts,
    topPositiveSession: topPositiveSession
      ? {
          id: topPositiveSession.id,
          netPnlAfterFeesAndFunding: topPositiveSession.netPnlAfterFeesAndFunding,
          tradeIds: topPositiveSession.tradeIds,
        }
      : null,
    totalFees: sessions.reduce((sum, session) => sum + session.fees, 0),
    totalFunding: sessions.reduce((sum, session) => sum + session.funding, 0),
    totalSessionNetPnl: sessions.reduce((sum, session) => sum + (session.netPnlAfterFeesAndFunding ?? 0), 0),
    weekendSessionCount: sessions.filter((session) => session.isWeekend).length,
    worstNegativeSession: worstNegativeSession
      ? {
          id: worstNegativeSession.id,
          netPnlAfterFeesAndFunding: worstNegativeSession.netPnlAfterFeesAndFunding,
          tradeIds: worstNegativeSession.tradeIds,
        }
      : null,
  };
}

export function buildSessionIntelligence(input: BuildSessionIntelligenceInput): SessionIntelligenceResult {
  const timezoneProvided = typeof input.request.timezone === "string" && input.request.timezone.trim().length > 0;
  const timezone = resolvePortalTimezone(input.request.timezone);
  const groups = buildPrimarySessionGroups({
    sessionGapMinutes: input.sessionGapMinutes ?? DEFAULT_SESSION_GAP_MINUTES,
    timezone,
    trades: input.trades,
  });
  const sessions = groups.map((trades, index) =>
    buildSession({
      index,
      request: input.request,
      sourceHealth: input.sourceHealth,
      timezone,
      timezoneProvided,
      trades,
      warnings: input.warnings ?? [],
    }),
  );

  return {
    sessions,
    summary: buildSummary(sessions),
    version: "v1",
  };
}

export function buildSessionIntelligenceDebugOutput(
  request: BaselineImportRequest,
  result: SessionIntelligenceResult,
  options: {
    evidenceComparison?: {
      alignedCount: number;
      comparisonCount: number;
      conflictCount: number;
      importedOnlyCount: number;
      nativeOnlyCount: number;
      notComparableCount: number;
      sourceWarnings: Array<{ code: string; detail: string; severity: "warning" | "info" }>;
      suppressedCount: number;
      topicsCompared: string[];
    };
    sourceQualityWarnings?: BaselineDataQualityWarning[];
  } = {},
) {
  const timezone = resolvePortalTimezone(request.timezone);
  const directionalOnlySessionCount = result.summary.diagnosisReadinessDistribution.directional_only ?? 0;
  const unsafeNotEnoughEvidenceSessionCount =
    result.summary.diagnosisReadinessDistribution.unsafe_not_enough_evidence ?? 0;
  const readyForDiagnosisSessionCount = result.summary.diagnosisReadinessDistribution.ready_for_diagnosis ?? 0;
  const sessionsWithPnl = result.sessions
    .filter((session): session is ReconstructedSession & { netPnlAfterFeesAndFunding: number } =>
      session.netPnlAfterFeesAndFunding !== null,
    )
    .sort((left, right) => Math.abs(right.netPnlAfterFeesAndFunding) - Math.abs(left.netPnlAfterFeesAndFunding));
  const strongestDirectionalSessionSignals = sessionsWithPnl
    .filter((session) => session.diagnosisReadiness === "directional_only")
    .slice(0, 3)
    .map((session) => ({
      confidence: session.confidence,
      diagnosisReadiness: session.diagnosisReadiness,
      id: session.id,
      localDateKey: session.localDateKey,
      netPnlAfterFeesAndFunding: session.netPnlAfterFeesAndFunding,
      tags: session.tags,
      tradeIds: session.tradeIds,
    }));
  const weakestSessionSignals = [...result.sessions]
    .sort((left, right) => {
      const confidenceWeight: Record<SessionConfidence, number> = {
        high: 3,
        insufficient_evidence: 0,
        low: 1,
        medium: 2,
      };
      return confidenceWeight[left.confidence] - confidenceWeight[right.confidence];
    })
    .slice(0, 3)
    .map((session) => ({
      confidence: session.confidence,
      confidenceReasons: session.confidenceReasons,
      diagnosisReadiness: session.diagnosisReadiness,
      id: session.id,
      sourceCompleteness: session.sourceCompleteness,
      tags: session.tags,
    }));

  return {
    version: result.version,
    generatedAt: new Date().toISOString(),
    kind: "portal-session-intelligence-debug",
    request: {
      accountAddress: request.accountAddress,
      endIso: new Date(request.endTime).toISOString(),
      endTime: request.endTime,
      environment: request.environment,
      startIso: new Date(request.startTime).toISOString(),
      startTime: request.startTime,
      timezone,
    },
    sessionCount: result.summary.sessionCount,
    tagCounts: result.summary.tagCounts,
    overnightSessionCount: result.summary.overnightSessionCount,
    weekendSessionCount: result.summary.weekendSessionCount,
    highDensitySessionCount: result.summary.highDensitySessionCount,
    postLossClusterCount: result.summary.postLossClusterCount,
    revengeRiskCount: result.summary.revengeRiskCount,
    totalSessionNetPnl: result.summary.totalSessionNetPnl,
    totalFees: result.summary.totalFees,
    totalFunding: result.summary.totalFunding,
    confidenceDistribution: result.summary.confidenceDistribution,
    diagnosisReadinessDistribution: result.summary.diagnosisReadinessDistribution,
    anyReadyForDiagnosis: readyForDiagnosisSessionCount > 0,
    directionalOnlySessionCount,
    unsafeNotEnoughEvidenceSessionCount,
    sourceQualityWarnings: (options.sourceQualityWarnings ?? []).map((warning) => ({
      code: warning.code,
      detail: warning.detail,
      severity: warning.severity,
    })),
    evidenceComparison: options.evidenceComparison ?? {
      alignedCount: 0,
      comparisonCount: 0,
      conflictCount: 0,
      importedOnlyCount: 0,
      nativeOnlyCount: 0,
      notComparableCount: 0,
      sourceWarnings: [],
      suppressedCount: 0,
      topicsCompared: [],
    },
    strongestDirectionalSessionSignals,
    weakestSessionSignals,
    topPositiveSession: result.summary.topPositiveSession,
    worstNegativeSession: result.summary.worstNegativeSession,
  };
}
