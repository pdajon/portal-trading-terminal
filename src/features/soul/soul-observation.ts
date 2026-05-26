import type {
  SoulObservation,
  SoulObservationInput,
  SoulObservationType,
  SoulTradeSnapshot,
} from "./soul-types";

const OVERTRADING_TRADE_COUNT = 3;
const OVERTRADING_WINDOW_MS = 30 * 60 * 1000;
const RAPID_RE_ENTRY_WINDOW_MS = 5 * 60 * 1000;
const REVENGE_WINDOW_MS = 30 * 60 * 1000;
const WEAK_RR_THRESHOLD = 1;

export function createSoulObservation(observation: SoulObservation): SoulObservation {
  return observation;
}

function timestampMs(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : null;
}

function sortTrades(trades: SoulTradeSnapshot[]) {
  return trades
    .map((trade) => ({ trade, openedAtMs: timestampMs(trade.openedAt) }))
    .filter((entry): entry is { trade: SoulTradeSnapshot; openedAtMs: number } => entry.openedAtMs !== null)
    .sort((left, right) => left.openedAtMs - right.openedAtMs);
}

function hasProtection(trade: SoulTradeSnapshot) {
  return Boolean(trade.hasStopLoss || trade.hasTakeProfit);
}

function isMarketImpulse(trade: SoulTradeSnapshot) {
  return trade.source === "market";
}

function observationId(type: SoulObservationType) {
  return `soul-${type}`;
}

function createDerivedObservation(
  type: SoulObservationType,
  createdAt: string,
  summary: string,
  tradeIds: string[],
  severity: SoulObservation["severity"] = "warning",
) {
  return createSoulObservation({
    createdAt,
    evidence: { summary, tradeIds },
    id: observationId(type),
    severity,
    type,
  });
}

export function deriveSoulObservations(input: SoulObservationInput): SoulObservation[] {
  const observations: SoulObservation[] = [];
  const sortedTrades = sortTrades(input.trades);

  if (sortedTrades.length >= OVERTRADING_TRADE_COUNT) {
    for (let index = 0; index <= sortedTrades.length - OVERTRADING_TRADE_COUNT; index += 1) {
      const windowTrades = sortedTrades.slice(index, index + OVERTRADING_TRADE_COUNT);
      const elapsed = windowTrades[windowTrades.length - 1].openedAtMs - windowTrades[0].openedAtMs;

      if (elapsed <= OVERTRADING_WINDOW_MS) {
        observations.push(
          createDerivedObservation(
            "overtrading",
            input.now,
            `${windowTrades.length} trades opened inside ${OVERTRADING_WINDOW_MS / 60000} minutes.`,
            windowTrades.map(({ trade }) => trade.id),
          ),
        );
        break;
      }
    }
  }

  sortedTrades.forEach(({ trade }, index) => {
    const next = sortedTrades[index + 1];
    const closedAtMs = timestampMs(trade.closedAt);

    if (trade.pnl !== undefined && trade.pnl !== null && trade.pnl < 0 && next && closedAtMs !== null) {
      const nextDelay = next.openedAtMs - closedAtMs;

      if (nextDelay >= 0 && nextDelay <= REVENGE_WINDOW_MS) {
        observations.push(
          createDerivedObservation(
            "revenge_trading",
            input.now,
            "A new trade followed a losing trade before behavior could cool down.",
            [trade.id, next.trade.id],
            "critical",
          ),
        );
      }

      if (nextDelay >= 0 && nextDelay <= RAPID_RE_ENTRY_WINDOW_MS) {
        observations.push(
          createDerivedObservation(
            "rapid_re_entry",
            input.now,
            `A new trade opened within ${RAPID_RE_ENTRY_WINDOW_MS / 60000} minutes of the previous close.`,
            [trade.id, next.trade.id],
          ),
        );
      }
    }
  });

  const unprotectedTrades = input.trades.filter((trade) => !hasProtection(trade));

  if (unprotectedTrades.length > 0) {
    observations.push(
      createDerivedObservation(
        "missing_protection",
        input.now,
        "At least one trade had no stop loss or take profit protection.",
        unprotectedTrades.map((trade) => trade.id),
        "critical",
      ),
    );
  }

  const weakRrTrades = input.trades.filter(
    (trade) =>
      hasProtection(trade) &&
      typeof trade.plannedRewardRiskRatio === "number" &&
      Number.isFinite(trade.plannedRewardRiskRatio) &&
      trade.plannedRewardRiskRatio < WEAK_RR_THRESHOLD,
  );

  if (weakRrTrades.length > 0) {
    observations.push(
      createDerivedObservation(
        "weak_protected_rr",
        input.now,
        `Protected trade R:R fell below ${WEAK_RR_THRESHOLD}:1.`,
        weakRrTrades.map((trade) => trade.id),
      ),
    );
  }

  const impulseTrades = input.trades.filter((trade) => isMarketImpulse(trade) && !hasProtection(trade));

  if (impulseTrades.length > 0) {
    observations.push(
      createDerivedObservation(
        "impulsive_execution",
        input.now,
        "A market execution entered risk without protection context.",
        impulseTrades.map((trade) => trade.id),
      ),
    );
  }

  const cooldownWindows = input.cooldownWindows ?? [];
  const ignoredCooldownTradeIds = sortedTrades
    .filter(({ openedAtMs }) =>
      cooldownWindows.some((window) => {
        const startedAtMs = timestampMs(window.startedAt);
        const endedAtMs = timestampMs(window.endedAt);

        return startedAtMs !== null && endedAtMs !== null && openedAtMs >= startedAtMs && openedAtMs <= endedAtMs;
      }),
    )
    .map(({ trade }) => trade.id);

  if (ignoredCooldownTradeIds.length > 0) {
    observations.push(
      createDerivedObservation(
        "ignored_cooldown_behavior",
        input.now,
        "A trade opened while a cooldown window was active.",
        ignoredCooldownTradeIds,
        "critical",
      ),
    );
  }

  const byType = new Map<SoulObservationType, SoulObservation>();
  observations.forEach((observation) => {
    if (!byType.has(observation.type)) {
      byType.set(observation.type, observation);
    }
  });

  return Array.from(byType.values());
}
