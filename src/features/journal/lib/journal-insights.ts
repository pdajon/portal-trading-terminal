export type JournalInsightsEntryStyle = "Hunted" | "Chased";

export type JournalInsightsStatus = "not-enough-data" | "outperforming" | "underperforming" | "mixed";

export type JournalInsightBooleanState = "yes" | "no" | "not-tracked-yet";

export type JournalInsightSessionLogEventType =
  | "position-closed"
  | "position-reversed"
  | "close-all-used"
  | "protection-attached"
  | "protection-updated"
  | "break-even-used"
  | "position-reduced";

export type JournalInsightSessionLogEntry = {
  eventType: JournalInsightSessionLogEventType;
  id: string;
  timestamp: string;
};

export type JournalInsightReplayFrame = {
  capturedAt: string;
  event:
    | "entry"
    | "periodic"
    | "protection-attached"
    | "protection-updated"
    | "partial-close"
    | "break-even"
    | "stop-moved"
    | "tp-moved"
    | "reverse"
    | "close-all"
    | "exit";
};

export type JournalInsightJournalEntry = {
  entryStyle: JournalInsightsEntryStyle;
  id: string;
  realizedPnl: number | null;
  relatedSessionLogIds: string[];
  replayMetadata?: {
    frames?: JournalInsightReplayFrame[];
  };
  setupTag: string | null;
  status: "open" | "closed";
  timestamp: string;
};

export type JournalEntryStyleAggregate = {
  averageDurationMinutes: number | null;
  averageRealizedPnl: number | null;
  losses: number;
  totalTrades: number;
  wins: number;
};

export type SetupTagAggregate = {
  averageDurationMinutes: number | null;
  averageRealizedPnl: number | null;
  losses: number;
  tag: string;
  totalTrades: number;
  wins: number;
};

export type SelectedTradeInsights = {
  earlyExit: {
    exitedBeforeTp: JournalInsightBooleanState;
    tpHitAfterExit: JournalInsightBooleanState;
  };
  entryStyleAggregate: JournalEntryStyleAggregate | null;
  entryStylePatternMessage: string;
  setupTagAggregate: SetupTagAggregate | null;
  setupTagPatternMessage: string;
};

export type JournalInsightsV1 = {
  closedTradesAnalyzed: number;
  entryStyleComparison: {
    chased: JournalEntryStyleAggregate;
    hunted: JournalEntryStyleAggregate;
    message: string;
    status: JournalInsightsStatus;
    strongerStyle: JournalInsightsEntryStyle | null;
    weakerStyle: JournalInsightsEntryStyle | null;
  };
  selectedTrade: SelectedTradeInsights;
  setupTagPerformance: {
    bestTag: SetupTagAggregate | null;
    eligibleTagCount: number;
    message: string;
    tags: SetupTagAggregate[];
    worstTag: SetupTagAggregate | null;
  };
  totalJournaledTrades: number;
};

const EXIT_EVENT_TYPES = new Set<JournalInsightSessionLogEventType>([
  "position-closed",
  "position-reversed",
  "close-all-used",
]);

const TP_CONTEXT_EVENT_TYPES = new Set<JournalInsightSessionLogEventType>([
  "protection-attached",
  "protection-updated",
]);

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getExitTimestamp(
  entry: JournalInsightJournalEntry,
  sessionLogsById: Map<string, JournalInsightSessionLogEntry>,
) {
  const exitFrame = (entry.replayMetadata?.frames ?? []).find((frame) => frame.event === "exit");

  if (exitFrame?.capturedAt) {
    return exitFrame.capturedAt;
  }

  return (
    entry.relatedSessionLogIds
      .map((id) => sessionLogsById.get(id) ?? null)
      .find((log): log is JournalInsightSessionLogEntry => log !== null && EXIT_EVENT_TYPES.has(log.eventType))
      ?.timestamp ?? null
  );
}

function getDurationMinutes(startTimestamp: string, endTimestamp: string | null) {
  if (!endTimestamp) {
    return null;
  }

  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return Math.max(1, Math.round((end - start) / 60_000));
}

function buildEntryStyleAggregate(
  style: JournalInsightsEntryStyle,
  entries: JournalInsightJournalEntry[],
  sessionLogsById: Map<string, JournalInsightSessionLogEntry>,
): JournalEntryStyleAggregate {
  const matchingEntries = entries.filter((entry) => entry.entryStyle === style);
  const realizedPnls = matchingEntries.map((entry) => entry.realizedPnl).filter(isFiniteNumber);
  const durations = matchingEntries
    .map((entry) => getDurationMinutes(entry.timestamp, getExitTimestamp(entry, sessionLogsById)))
    .filter(isFiniteNumber);

  return {
    averageDurationMinutes: average(durations),
    averageRealizedPnl: average(realizedPnls),
    losses: matchingEntries.filter((entry) => (entry.realizedPnl ?? 0) < 0).length,
    totalTrades: matchingEntries.length,
    wins: matchingEntries.filter((entry) => (entry.realizedPnl ?? 0) > 0).length,
  };
}

function buildSetupTagAggregates(
  entries: JournalInsightJournalEntry[],
  sessionLogsById: Map<string, JournalInsightSessionLogEntry>,
) {
  const grouped = new Map<string, JournalInsightJournalEntry[]>();

  entries.forEach((entry) => {
    const normalizedTag = entry.setupTag?.trim();

    if (!normalizedTag) {
      return;
    }

    const currentEntries = grouped.get(normalizedTag) ?? [];
    currentEntries.push(entry);
    grouped.set(normalizedTag, currentEntries);
  });

  return Array.from(grouped.entries())
    .map(([tag, taggedEntries]) => {
      const realizedPnls = taggedEntries.map((entry) => entry.realizedPnl).filter(isFiniteNumber);
      const durations = taggedEntries
        .map((entry) => getDurationMinutes(entry.timestamp, getExitTimestamp(entry, sessionLogsById)))
        .filter(isFiniteNumber);

      return {
        averageDurationMinutes: average(durations),
        averageRealizedPnl: average(realizedPnls),
        losses: taggedEntries.filter((entry) => (entry.realizedPnl ?? 0) < 0).length,
        tag,
        totalTrades: taggedEntries.length,
        wins: taggedEntries.filter((entry) => (entry.realizedPnl ?? 0) > 0).length,
      } satisfies SetupTagAggregate;
    })
    .sort((left, right) => right.totalTrades - left.totalTrades || left.tag.localeCompare(right.tag));
}

function buildEntryStyleComparison(
  hunted: JournalEntryStyleAggregate,
  chased: JournalEntryStyleAggregate,
  minimumSampleSize: number,
) {
  const huntedEligible = hunted.totalTrades >= minimumSampleSize && hunted.averageRealizedPnl !== null;
  const chasedEligible = chased.totalTrades >= minimumSampleSize && chased.averageRealizedPnl !== null;

  if (!huntedEligible || !chasedEligible) {
    return {
      message: "Not enough hunted/chased data yet.",
      status: "not-enough-data" as const,
      strongerStyle: null,
      weakerStyle: null,
    };
  }

  if (hunted.averageRealizedPnl === chased.averageRealizedPnl) {
    return {
      message: "Hunted and chased trades are tracking about the same so far.",
      status: "mixed" as const,
      strongerStyle: null,
      weakerStyle: null,
    };
  }

  const huntedAveragePnl = hunted.averageRealizedPnl as number;
  const chasedAveragePnl = chased.averageRealizedPnl as number;
  const huntedWins = huntedAveragePnl > chasedAveragePnl;

  return {
    message: huntedWins
      ? "Your hunted trades are outperforming chased trades."
      : "Your chased trades are outperforming hunted trades.",
    status: "outperforming" as const,
    strongerStyle: huntedWins ? ("Hunted" as const) : ("Chased" as const),
    weakerStyle: huntedWins ? ("Chased" as const) : ("Hunted" as const),
  };
}

function buildSetupTagRankingMessage(bestTag: SetupTagAggregate | null, minimumSampleSize: number) {
  if (!bestTag || bestTag.totalTrades < minimumSampleSize) {
    return "Not enough setup tag data yet.";
  }

  return `Best setup tag so far: ${bestTag.tag}.`;
}

function selectBestAndWorstTags(
  tags: SetupTagAggregate[],
  minimumSampleSize: number,
) {
  const eligibleTags = tags.filter(
    (tag) => tag.totalTrades >= minimumSampleSize && tag.averageRealizedPnl !== null,
  );

  if (eligibleTags.length === 0) {
    return { bestTag: null, eligibleTagCount: 0, worstTag: null };
  }

  const byPnlDescending = [...eligibleTags].sort((left, right) => {
    return (
      (right.averageRealizedPnl ?? Number.NEGATIVE_INFINITY) -
        (left.averageRealizedPnl ?? Number.NEGATIVE_INFINITY) || left.tag.localeCompare(right.tag)
    );
  });
  const byPnlAscending = [...eligibleTags].sort((left, right) => {
    return (
      (left.averageRealizedPnl ?? Number.POSITIVE_INFINITY) -
        (right.averageRealizedPnl ?? Number.POSITIVE_INFINITY) || left.tag.localeCompare(right.tag)
    );
  });

  const bestCandidate = byPnlDescending[0] ?? null;
  const secondBest = byPnlDescending[1] ?? null;
  const worstCandidate = byPnlAscending[0] ?? null;
  const secondWorst = byPnlAscending[1] ?? null;

  const bestTag =
    bestCandidate &&
    (!secondBest || (bestCandidate.averageRealizedPnl ?? 0) > (secondBest.averageRealizedPnl ?? 0))
      ? bestCandidate
      : null;

  const worstTag =
    worstCandidate &&
    (!secondWorst || (worstCandidate.averageRealizedPnl ?? 0) < (secondWorst.averageRealizedPnl ?? 0))
      ? worstCandidate
      : null;

  return {
    bestTag,
    eligibleTagCount: eligibleTags.length,
    worstTag,
  };
}

function buildSelectedTradeInsights(
  selectedEntry: JournalInsightJournalEntry | null,
  sessionLogsById: Map<string, JournalInsightSessionLogEntry>,
  entryStyleAggregates: Record<JournalInsightsEntryStyle, JournalEntryStyleAggregate>,
  entryStyleComparison: {
    status: JournalInsightsStatus;
    strongerStyle: JournalInsightsEntryStyle | null;
    weakerStyle: JournalInsightsEntryStyle | null;
  },
  setupTagAggregates: SetupTagAggregate[],
  bestTag: SetupTagAggregate | null,
  worstTag: SetupTagAggregate | null,
  minimumSampleSize: number,
): SelectedTradeInsights {
  if (!selectedEntry) {
    return {
      earlyExit: {
        exitedBeforeTp: "not-tracked-yet",
        tpHitAfterExit: "not-tracked-yet",
      },
      entryStyleAggregate: null,
      entryStylePatternMessage: "Not enough hunted/chased data yet.",
      setupTagAggregate: null,
      setupTagPatternMessage: "Not enough setup tag data yet.",
    };
  }

  const selectedStyleAggregate = entryStyleAggregates[selectedEntry.entryStyle];
  const selectedSetupTag = selectedEntry.setupTag?.trim() ?? null;
  const selectedSetupAggregate = selectedSetupTag
    ? setupTagAggregates.find((aggregate) => aggregate.tag === selectedSetupTag) ?? null
    : null;

  let entryStylePatternMessage = "Not enough hunted/chased data yet.";

  if (entryStyleComparison.status !== "not-enough-data") {
    if (entryStyleComparison.strongerStyle === selectedEntry.entryStyle) {
      entryStylePatternMessage = `This trade matches your stronger ${selectedEntry.entryStyle.toLowerCase()} pattern.`;
    } else if (entryStyleComparison.weakerStyle === selectedEntry.entryStyle) {
      entryStylePatternMessage = `This trade matches your weaker ${selectedEntry.entryStyle.toLowerCase()} pattern.`;
    } else {
      entryStylePatternMessage = "Hunted and chased trades are tracking about the same so far.";
    }
  }

  let setupTagPatternMessage = "Not enough setup tag data yet.";

  if (!selectedSetupTag) {
    setupTagPatternMessage = "Not tracked yet.";
  } else if (!selectedSetupAggregate || selectedSetupAggregate.totalTrades < minimumSampleSize) {
    setupTagPatternMessage = `Not enough ${selectedSetupTag} data yet.`;
  } else if (bestTag?.tag === selectedSetupTag) {
    setupTagPatternMessage = `This trade matches your best-performing setup tag: ${selectedSetupTag}.`;
  } else if (worstTag?.tag === selectedSetupTag) {
    setupTagPatternMessage = `This trade matches your weaker setup tag pattern: ${selectedSetupTag}.`;
  } else {
    setupTagPatternMessage = `${selectedSetupTag} is performing in the middle of your tracked setup tags.`;
  }

  const selectedLogs = selectedEntry.relatedSessionLogIds
    .map((id) => sessionLogsById.get(id) ?? null)
    .filter((entry): entry is JournalInsightSessionLogEntry => entry !== null);
  const hasTpContext =
    selectedLogs.some((entry) => TP_CONTEXT_EVENT_TYPES.has(entry.eventType)) ||
    (selectedEntry.replayMetadata?.frames ?? []).some(
      (frame) =>
        frame.event === "tp-moved" ||
        frame.event === "protection-attached" ||
        frame.event === "protection-updated",
    );

  return {
    earlyExit: {
      exitedBeforeTp: hasTpContext ? "not-tracked-yet" : "not-tracked-yet",
      tpHitAfterExit: hasTpContext ? "not-tracked-yet" : "not-tracked-yet",
    },
    entryStyleAggregate: selectedStyleAggregate,
    entryStylePatternMessage,
    setupTagAggregate: selectedSetupAggregate,
    setupTagPatternMessage,
  };
}

export function formatAverageDurationMinutes(value: number | null) {
  if (!isFiniteNumber(value) || value <= 0) {
    return "Not enough data yet";
  }

  const roundedMinutes = Math.max(1, Math.round(value));

  if (roundedMinutes < 60) {
    return `${roundedMinutes}m`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function deriveJournalInsightsV1(
  journalEntries: JournalInsightJournalEntry[],
  sessionLogEntries: JournalInsightSessionLogEntry[],
  selectedEntryId?: string | null,
  minimumSampleSize = 3,
): JournalInsightsV1 {
  const sessionLogsById = new Map(sessionLogEntries.map((entry) => [entry.id, entry]));
  const closedTrades = journalEntries.filter(
    (entry) => entry.status === "closed" && isFiniteNumber(entry.realizedPnl),
  );

  const hunted = buildEntryStyleAggregate("Hunted", closedTrades, sessionLogsById);
  const chased = buildEntryStyleAggregate("Chased", closedTrades, sessionLogsById);
  const entryStyleComparison = buildEntryStyleComparison(hunted, chased, minimumSampleSize);

  const setupTagAggregates = buildSetupTagAggregates(closedTrades, sessionLogsById);
  const { bestTag, eligibleTagCount, worstTag } = selectBestAndWorstTags(
    setupTagAggregates,
    minimumSampleSize,
  );

  const selectedEntry =
    journalEntries.find((entry) => entry.id === selectedEntryId) ?? null;

  return {
    closedTradesAnalyzed: closedTrades.length,
    entryStyleComparison: {
      chased,
      hunted,
      message: entryStyleComparison.message,
      status: entryStyleComparison.status,
      strongerStyle: entryStyleComparison.strongerStyle,
      weakerStyle: entryStyleComparison.weakerStyle,
    },
    selectedTrade: buildSelectedTradeInsights(
      selectedEntry,
      sessionLogsById,
      { Chased: chased, Hunted: hunted },
      entryStyleComparison,
      setupTagAggregates,
      bestTag,
      worstTag,
      minimumSampleSize,
    ),
    setupTagPerformance: {
      bestTag,
      eligibleTagCount,
      message: buildSetupTagRankingMessage(bestTag, minimumSampleSize),
      tags: setupTagAggregates,
      worstTag,
    },
    totalJournaledTrades: journalEntries.length,
  };
}
