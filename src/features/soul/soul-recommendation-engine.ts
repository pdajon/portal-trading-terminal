import { deriveSoulObservations } from "./soul-observation";
import { createSoulRecommendation } from "./soul-recommendations";
import type {
  SoulObservation,
  SoulObservationType,
  SoulRecommendation,
  SoulSuggestedRule,
  SoulTradeSnapshot,
} from "./soul-types";

type SoulRecommendationJournalEntry = {
  closedAt?: string | null;
  entrySource?: string | null;
  id: string;
  openedAt?: string | null;
  realizedPnl?: number | null;
  relatedSessionLogIds?: string[];
  status: "open" | "closed" | string;
  symbol?: string | null;
  timestamp: string;
};

type SoulRecommendationSessionLogEntry = {
  eventType: string;
  id: string;
  metadata?: unknown;
  timestamp: string;
};

type SoulRecommendationLivePosition = {
  direction?: "long" | "short";
  entryPrice: number;
  pnlUsd?: number | null;
  slStatus: "live" | "missing";
  symbol: string;
  tpStatus: "live" | "missing";
};

type SoulRecommendationActiveTradePlan = {
  createdAt: string;
  direction: "long" | "short";
  entry: number;
  id: string;
  stop: number;
  symbol: string;
  target: number;
};

type DeriveSoulRecommendationActivityInput = {
  activeTradePlan?: SoulRecommendationActiveTradePlan | null;
  journalEntries?: SoulRecommendationJournalEntry[];
  livePositions?: SoulRecommendationLivePosition[];
  now?: string;
  sessionLogEntries?: SoulRecommendationSessionLogEntry[];
};

const OBSERVATION_RULE_MAP: Partial<Record<
  SoulObservationType,
  { rule: SoulSuggestedRule; recommendationType: SoulRecommendation["type"] }
>> = {
  ignored_cooldown_behavior: {
    recommendationType: "cooldown_after_loss",
    rule: {
      parameters: { minutes: 15 },
      summary: "Lock a cooldown after losing trades.",
      type: "cooldown_after_loss",
    },
  },
  overtrading: {
    recommendationType: "max_trades_per_day",
    rule: {
      parameters: { maxTrades: 3 },
      summary: "Set a max-trades guard for clustered entry sessions.",
      type: "max_trades_per_day",
    },
  },
  rapid_re_entry: {
    recommendationType: "cooldown_after_loss",
    rule: {
      parameters: { minutes: 15 },
      summary: "Require a cooldown before re-entering after a loss.",
      type: "cooldown_after_loss",
    },
  },
  revenge_trading: {
    recommendationType: "cooldown_after_loss",
    rule: {
      parameters: { minutes: 30 },
      summary: "Lock a cooldown after losing trades.",
      type: "cooldown_after_loss",
    },
  },
};

function mapEntrySourceToSoulSource(source: string | null | undefined) {
  switch (source) {
    case "Market":
      return "market";
    case "Limit":
      return "limit";
    case "Mid-Zone":
    case "Order Zone":
      return "order_zone";
    case "Touch Trigger":
    case "Close Trigger":
      return "trigger";
    default:
      return source ?? null;
  }
}

function getRelatedLogs(
  entry: SoulRecommendationJournalEntry,
  logsById: Map<string, SoulRecommendationSessionLogEntry>,
) {
  return (entry.relatedSessionLogIds ?? [])
    .map((id) => logsById.get(id) ?? null)
    .filter((log): log is SoulRecommendationSessionLogEntry => log !== null);
}

function inferProtectionFromLogs(logs: SoulRecommendationSessionLogEntry[]) {
  const hasAttachedProtection = logs.some(
    (log) =>
      log.eventType === "protection-attached" ||
      log.eventType === "protection-updated",
  );
  const hasStopOnlyProtection = logs.some(
    (log) => log.eventType === "break-even-used",
  );

  return {
    hasStopLoss: hasAttachedProtection || hasStopOnlyProtection,
    hasTakeProfit: hasAttachedProtection,
  };
}

function calculateRiskRewardRatio(
  plan: SoulRecommendationActiveTradePlan | null | undefined,
) {
  if (!plan) {
    return null;
  }

  const risk = Math.abs(plan.entry - plan.stop);
  const reward = Math.abs(plan.target - plan.entry);

  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk <= 0) {
    return null;
  }

  return reward / risk;
}

function createTradeSnapshots({
  activeTradePlan,
  journalEntries,
  livePositions,
  sessionLogEntries,
}: Required<
  Pick<
    DeriveSoulRecommendationActivityInput,
    "journalEntries" | "livePositions" | "sessionLogEntries"
  >
> &
  Pick<DeriveSoulRecommendationActivityInput, "activeTradePlan">) {
  const logsById = new Map(sessionLogEntries.map((log) => [log.id, log]));
  const livePositionsBySymbol = new Map(
    livePositions.map((position) => [position.symbol, position]),
  );
  const activePlanRr = calculateRiskRewardRatio(activeTradePlan);
  const activePlanTrade: SoulTradeSnapshot[] = activeTradePlan
    ? [
        {
          hasStopLoss: true,
          hasTakeProfit: true,
          id: `active-plan:${activeTradePlan.id}`,
          openedAt: activeTradePlan.createdAt,
          plannedRewardRiskRatio: activePlanRr,
          source: "plan",
        },
      ]
    : [];
  const livePositionTrades: SoulTradeSnapshot[] = livePositions.map(
    (position) => ({
      hasStopLoss: position.slStatus === "live",
      hasTakeProfit: position.tpStatus === "live",
      id: `live-position:${position.symbol}`,
      openedAt: new Date().toISOString(),
      pnl: position.pnlUsd ?? null,
      source: "exchange",
    }),
  );
  const journalTrades: SoulTradeSnapshot[] = journalEntries
    .filter((entry) => entry.openedAt ?? entry.timestamp)
    .map((entry) => {
      const relatedLogs = getRelatedLogs(entry, logsById);
      const logProtection = inferProtectionFromLogs(relatedLogs);
      const livePosition = entry.symbol
        ? livePositionsBySymbol.get(entry.symbol) ?? null
        : null;
      const activePlanMatches =
        activeTradePlan && activeTradePlan.symbol === entry.symbol;

      return {
        closedAt: entry.closedAt ?? null,
        hasStopLoss:
          livePosition?.slStatus === "live" ||
          logProtection.hasStopLoss ||
          Boolean(activePlanMatches),
        hasTakeProfit:
          livePosition?.tpStatus === "live" ||
          logProtection.hasTakeProfit ||
          Boolean(activePlanMatches),
        id: entry.id,
        openedAt: entry.openedAt ?? entry.timestamp,
        plannedRewardRiskRatio: activePlanMatches ? activePlanRr : null,
        pnl: entry.realizedPnl ?? null,
        source: mapEntrySourceToSoulSource(entry.entrySource),
      };
    });

  return [...journalTrades, ...livePositionTrades, ...activePlanTrade];
}

export function deriveSoulRecommendationsFromObservations(
  observations: SoulObservation[],
): SoulRecommendation[] {
  return observations
    .map((observation) => {
      const mapped = OBSERVATION_RULE_MAP[observation.type];

      if (!mapped) {
        return null;
      }

      return createSoulRecommendation({
        createdAt: observation.createdAt,
        evidence: {
          ...observation.evidence,
          observationIds: [
            observation.id,
            ...(observation.evidence.observationIds ?? []),
          ],
        },
        id: `soul-rec:${observation.type}`,
        severity: observation.severity,
        suggestedRule: mapped.rule,
        type: mapped.recommendationType,
      });
    })
    .filter((recommendation): recommendation is SoulRecommendation => recommendation !== null)
    .sort((left, right) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityCompare =
        severityOrder[left.severity] - severityOrder[right.severity];
      return severityCompare === 0
        ? left.id.localeCompare(right.id)
        : severityCompare;
    });
}

export function deriveSoulRecommendationsFromActivity({
  activeTradePlan = null,
  journalEntries = [],
  livePositions = [],
  now = new Date().toISOString(),
  sessionLogEntries = [],
}: DeriveSoulRecommendationActivityInput): SoulRecommendation[] {
  const trades = createTradeSnapshots({
    activeTradePlan,
    journalEntries,
    livePositions,
    sessionLogEntries,
  });

  if (trades.length === 0) {
    return [];
  }

  return deriveSoulRecommendationsFromObservations(
    deriveSoulObservations({
      now,
      trades,
    }),
  );
}
