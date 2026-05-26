import type { HyperliquidEnvironment } from "@/lib/hyperliquid/types";

export type BaselineImportRequest = {
  accountAddress: string;
  endTime: number;
  environment: HyperliquidEnvironment;
  startTime: number;
  timezone: string;
};

export type BaselineExecutionMode = "market" | "limit" | "mixed" | "unknown";

export type BaselineEntryStyleProxy = "likely-hunted" | "likely-chased" | "unknown";

export type TradeFragmentType =
  | "open"
  | "add"
  | "reduce"
  | "close"
  | "reverse-close"
  | "reverse-open";

export type TimeOfDayBucket = "overnight" | "premarket" | "cash" | "afternoon" | "evening";

export type HoldTimeBucket =
  | "<5m"
  | "5-15m"
  | "15-60m"
  | "1-4h"
  | "4-24h"
  | "24h+"
  | "open";

export type BaselineDataQualityWarningCode =
  | "boundary-position-fills-excluded"
  | "fill-cap-hit"
  | "order-cap-hit"
  | "missing-order-matches"
  | "inferred-only-classifications"
  | "empty-results-possible-wrong-address"
  | "requested-range-may-exceed-recent-fill-window"
  | "manual-upload-duplicates"
  | "manual-upload-incomplete-funding-coverage"
  | "manual-upload-missing-fields"
  | "manual-upload-source-quality-directional-only"
  | "manual-upload-unsupported-rows";

export type BaselineDataQualityWarning = {
  code: BaselineDataQualityWarningCode;
  detail: string;
  severity: "warning" | "info";
};

export type HyperliquidUserFillWire = Record<string, unknown> & {
  closedPnl?: unknown;
  coin?: unknown;
  crossed?: unknown;
  dir?: unknown;
  fee?: unknown;
  feeToken?: unknown;
  hash?: unknown;
  oid?: unknown;
  px?: unknown;
  side?: unknown;
  startPosition?: unknown;
  sz?: unknown;
  tid?: unknown;
  time?: unknown;
};

export type HyperliquidHistoricalOrderWire = Record<string, unknown> & {
  order?: Record<string, unknown>;
  coin?: unknown;
  isPositionTpsl?: unknown;
  oid?: unknown;
  orderType?: unknown;
  origSz?: unknown;
  reduceOnly?: unknown;
  side?: unknown;
  status?: unknown;
  statusTimestamp?: unknown;
  tif?: unknown;
  timestamp?: unknown;
  triggerCondition?: unknown;
  triggerPx?: unknown;
};

export type HyperliquidUserFundingWire = Record<string, unknown> & {
  coin?: unknown;
  delta?: unknown;
  hash?: unknown;
  time?: unknown;
};

export type HyperliquidLedgerUpdateWire = Record<string, unknown> & {
  delta?: unknown;
  hash?: unknown;
  time?: unknown;
  token?: unknown;
  type?: unknown;
};

export type HyperliquidClearinghouseStateWire = Record<string, unknown>;

export type HyperliquidPortfolioPeriodWire = {
  accountValueHistory?: [number, string][];
  pnlHistory?: [number, string][];
  vlm?: unknown;
};

export type HyperliquidPortfolioWire = [string, HyperliquidPortfolioPeriodWire][];

export type ImportedFill = {
  accountAddress: string;
  closedPnl: number;
  coin: string;
  crossed: boolean | null;
  dirRaw: string | null;
  environment: HyperliquidEnvironment;
  fee: number;
  feeToken: string | null;
  hash: string | null;
  id: string;
  orderId: number | null;
  price: number | null;
  raw: HyperliquidUserFillWire;
  side: "buy" | "sell" | "unknown";
  signedSize: number | null;
  size: number | null;
  startPosition: number | null;
  time: number;
  timestamp: string;
  tradeId: number | null;
};

export type ImportedOrder = {
  accountAddress: string;
  coin: string;
  environment: HyperliquidEnvironment;
  id: string;
  isPositionTpsl: boolean;
  isTrigger: boolean;
  limitPrice: number | null;
  orderId: number | null;
  orderType: BaselineExecutionMode | "trigger";
  originalSize: number | null;
  raw: HyperliquidHistoricalOrderWire;
  reduceOnly: boolean;
  side: "buy" | "sell" | "unknown";
  status: string | null;
  statusTime: number | null;
  statusTimestamp: string | null;
  tif: string | null;
  time: number | null;
  timestamp: string | null;
  triggerCondition: string | null;
  triggerPrice: number | null;
};

export type ImportedFundingRecord = {
  accountAddress: string;
  coin: string;
  delta: number;
  environment: HyperliquidEnvironment;
  hash: string | null;
  id: string;
  raw: HyperliquidUserFundingWire;
  time: number;
  timestamp: string;
};

export type ImportedLedgerUpdate = {
  accountAddress: string;
  delta: number | null;
  environment: HyperliquidEnvironment;
  hash: string | null;
  id: string;
  kind: "deposit" | "withdrawal" | "transfer" | "unknown";
  raw: HyperliquidLedgerUpdateWire;
  time: number;
  timestamp: string;
  token: string | null;
};

export type ImportedTrade = {
  accountAddress: string;
  addFills: ImportedFill[];
  closeFills: ImportedFill[];
  coin: string;
  direction: "long" | "short";
  durationMinutes: number | null;
  endTime: number | null;
  entryPrice: number | null;
  entryStyleProxy: BaselineEntryStyleProxy;
  entryTime: number;
  environment: HyperliquidEnvironment;
  executionClosedPnl: number;
  executionMode: BaselineExecutionMode;
  exitPrice: number | null;
  fundingPnl: number;
  grossFees: number;
  id: string;
  maxSize: number;
  netPnl: number;
  openFills: ImportedFill[];
  orderIds: number[];
  rawOrderMatches: ImportedOrder[];
  reconstructionConfidence: "high" | "medium" | "low";
  reduceFills: ImportedFill[];
  sessionId: string | null;
  sourceLabel: "Historical Import";
  status: "open" | "closed" | "reversed-fragment";
};

export type ImportedSession = {
  accountAddress: string;
  dominantAsset: string | null;
  endedAt: number;
  environment: HyperliquidEnvironment;
  id: string;
  lossCount: number;
  netPnl: number;
  notes: string[];
  startedAt: number;
  tradeCount: number;
  tradeIds: string[];
  winCount: number;
};

export type BaselineMetricRow<Key extends string = string> = {
  averageNetPnl: number | null;
  key: Key;
  lossCount: number;
  netPnl: number;
  sampleReliable: boolean;
  tradeCount: number;
  winCount: number;
};

export type SizeAfterLossEvent = {
  flagged: boolean;
  increaseRatio: number;
  nextTradeId: string;
  nextTradeMaxSize: number;
  previousTradeId: string;
  previousTradeMaxSize: number;
};

export type SessionType =
  | "standard_activity"
  | "overnight"
  | "high_density"
  | "rapid_reentry_cluster"
  | "post_loss_reentry_cluster"
  | "revenge_risk"
  | "weekend"
  | "same_day"
  | "multi_asset"
  | "directional_bias";

export type SessionTag =
  | "overnight"
  | "high_density"
  | "rapid_reentry"
  | "post_loss"
  | "revenge_risk"
  | "weekend"
  | "multi_asset"
  | "long_bias"
  | "short_bias";

export type SessionConfidence = "high" | "medium" | "low" | "insufficient_evidence";

export type SourceCompleteness =
  | "complete"
  | "partial_boundary"
  | "partial_open"
  | "possibly_truncated"
  | "order_enrichment_incomplete"
  | "invalid_timestamps"
  | "insufficient_source";

export type DiagnosisReadiness =
  | "ready_for_diagnosis"
  | "directional_only"
  | "unsafe_not_enough_evidence";

export type TradeResult = "win" | "loss" | "flat" | "open" | "unknown";

export type ReconstructedSession = {
  accountAddress: string;
  assetMix: Record<string, { netPnl: number | null; tradeCount: number }>;
  averageHoldMinutes: number | null;
  avgGapBetweenTrades: number | null;
  bestTradeId: string | null;
  boundaryTradeCount: number;
  closedTrades: number;
  confidence: SessionConfidence;
  confidenceReasons: string[];
  diagnosisReadiness: DiagnosisReadiness;
  directionMix: {
    long: { netPnl: number | null; tradeCount: number };
    short: { netPnl: number | null; tradeCount: number };
  };
  endedAt: number;
  environment: HyperliquidEnvironment;
  fees: number;
  firstTradeResult: TradeResult;
  funding: number;
  grossPnlBeforeFees: number | null;
  id: string;
  isHighDensity: boolean;
  isOvernight: boolean;
  isPostLossCluster: boolean;
  isRevengeRisk: boolean;
  isWeekend: boolean;
  largestBaseSize: number | null;
  largestNotionalExposure: number | null;
  lastTradeResult: TradeResult;
  localDateKey: string;
  losses: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  netPnlAfterFeesAndFunding: number | null;
  openAtSessionEnd: boolean;
  openTrades: number;
  orderMatchCompleteness: {
    fullyMatchedTrades: number;
    matchedOrderIds: number;
    partiallyMatchedTrades: number;
    unmatchedOrderIds: number;
    unmatchedTrades: number;
  };
  postLossReentryCount: number;
  sessionType: SessionType;
  shortGapTradeCount: number;
  sourceCompleteness: SourceCompleteness[];
  startedAt: number;
  tags: SessionTag[];
  timezone: string;
  totalTimeInMarketMinutes: number;
  totalTrades: number;
  tradeIds: string[];
  winRate: number | null;
  wins: number;
  worstTradeId: string | null;
};

export type SessionIntelligenceSummary = {
  confidenceDistribution: Record<SessionConfidence, number>;
  diagnosisReadinessDistribution: Record<DiagnosisReadiness, number>;
  highDensitySessionCount: number;
  overnightSessionCount: number;
  postLossClusterCount: number;
  revengeRiskCount: number;
  sessionCount: number;
  tagCounts: Record<SessionTag, number>;
  topPositiveSession: Pick<ReconstructedSession, "id" | "netPnlAfterFeesAndFunding" | "tradeIds"> | null;
  totalFees: number;
  totalFunding: number;
  totalSessionNetPnl: number;
  weekendSessionCount: number;
  worstNegativeSession: Pick<ReconstructedSession, "id" | "netPnlAfterFeesAndFunding" | "tradeIds"> | null;
};

export type SessionIntelligenceResult = {
  sessions: ReconstructedSession[];
  summary: SessionIntelligenceSummary;
  version: "v1";
};

export type BaselineProfile = {
  accountAddress: string;
  byAsset: BaselineMetricRow[];
  byDirection: BaselineMetricRow<"long" | "short">[];
  byEntryStyleProxy: BaselineMetricRow<BaselineEntryStyleProxy>[];
  byExecutionMode: BaselineMetricRow<BaselineExecutionMode>[];
  byHoldTimeBucket: BaselineMetricRow<HoldTimeBucket>[];
  byTimeOfDay: BaselineMetricRow<TimeOfDayBucket>[];
  dataQuality: BaselineDataQualityWarning[];
  dateRange: {
    endTime: number;
    startTime: number;
    timezone: string;
  };
  environment: HyperliquidEnvironment;
  fundingContext: {
    ledgerNetFlow: number;
    totalFundingPnl: number;
  };
  sessionBehavior: {
    averageTradesPerSession: number | null;
    maxTradesInSession: number;
    sessionsOverFiveTrades: number;
    shortGapTradeCount: number;
    totalSessions: number;
  };
  sizeAfterLoss: {
    events: SizeAfterLossEvent[];
    flaggedCount: number;
  };
  source: "hyperliquid";
  totals: {
    averageClosedTradeNetPnl: number | null;
    averageHoldMinutes: number | null;
    closedGrossFees: number;
    closedTrades: number;
    executionClosedPnl: number;
    flatCount: number;
    grossPnlBeforeFees: number;
    grossFees: number;
    lossCount: number;
    netPnl: number;
    openTradeFees: number;
    totalTrades: number;
    winCount: number;
    winRate: number | null;
  };
  version: "v1";
};

export type BaselineImportFetchResult = {
  accountSnapshot: HyperliquidClearinghouseStateWire | null;
  historicalOrders: HyperliquidHistoricalOrderWire[];
  ledgerUpdates: HyperliquidLedgerUpdateWire[];
  userFills: HyperliquidUserFillWire[];
  userFunding: HyperliquidUserFundingWire[];
};

export type BaselineImportScanResult = {
  accountSnapshot: HyperliquidClearinghouseStateWire | null;
  fills: ImportedFill[];
  funding: ImportedFundingRecord[];
  ledgerUpdates: ImportedLedgerUpdate[];
  orders: ImportedOrder[];
  profile: BaselineProfile;
  sessions: ImportedSession[];
  sessionIntelligence?: SessionIntelligenceResult;
  sourceHealth: {
    aggregatedFillCount: number;
    boundaryFillCount: number;
    recommendationTradeCount: number;
  };
  trades: ImportedTrade[];
  warnings: BaselineDataQualityWarning[];
};

export type ReconstructImportedTradesInput = {
  fills: ImportedFill[];
  funding: ImportedFundingRecord[];
  orders: ImportedOrder[];
  request: BaselineImportRequest;
};

export type ReconstructImportedTradesResult = {
  boundaryFillCount: number;
  sessions: ImportedSession[];
  trades: ImportedTrade[];
  warnings: BaselineDataQualityWarning[];
};

export type BuildBaselineProfileInput = {
  accountSnapshot: HyperliquidClearinghouseStateWire | null;
  funding: ImportedFundingRecord[];
  ledgerUpdates: ImportedLedgerUpdate[];
  orders: ImportedOrder[];
  request: BaselineImportRequest;
  sessionWarnings: BaselineDataQualityWarning[];
  trades: ImportedTrade[];
  userFills: ImportedFill[];
};
