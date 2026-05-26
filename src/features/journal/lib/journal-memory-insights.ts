import type { JournalMemoryEvent } from "./journal-memory-events";

export type JournalMemoryInsightSeverity = "info" | "warning" | "critical" | "positive";

export type JournalMemoryInsightCategory =
  | "ai_warning"
  | "discipline"
  | "override_bond"
  | "plan"
  | "execution"
  | "magic_trade"
  | "trigger"
  | "no_trade"
  | "review";

export type JournalMemoryInsight = {
  category: JournalMemoryInsightCategory;
  evidenceEventIds: string[];
  id: string;
  message: string;
  severity: JournalMemoryInsightSeverity;
  timestamp?: string;
  title: string;
};

export type JournalMemoryInsightEntry = {
  id: string;
  planFollowed?: "followed" | "broken" | "unclear" | null;
  relatedSessionLogIds?: string[];
  status?: string;
  symbol?: string | null;
};

export type DeriveJournalMemoryInsightsInput = {
  allJournalEntries?: Array<JournalMemoryInsightEntry & Record<string, unknown>>;
  allMemoryEvents?: JournalMemoryEvent[];
  relatedMemoryEvents: JournalMemoryEvent[];
  selectedEntry: JournalMemoryInsightEntry | null;
};

function uniqueEvents(events: JournalMemoryEvent[]) {
  const seenIds = new Set<string>();

  return events.filter((event) => {
    if (seenIds.has(event.id)) {
      return false;
    }

    seenIds.add(event.id);
    return true;
  });
}

function getNumber(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstTimestamp(events: JournalMemoryEvent[]) {
  return events.slice().sort((left, right) => left.timestamp.localeCompare(right.timestamp))[0]?.timestamp;
}

function makeInsight(input: {
  category: JournalMemoryInsightCategory;
  events?: JournalMemoryEvent[];
  id: string;
  message: string;
  severity: JournalMemoryInsightSeverity;
  title: string;
}): JournalMemoryInsight {
  const events = uniqueEvents(input.events ?? []);

  return {
    category: input.category,
    evidenceEventIds: events.map((event) => event.id),
    id: input.id,
    message: input.message,
    severity: input.severity,
    timestamp: firstTimestamp(events),
    title: input.title,
  };
}

function hasRepeatedOverride(overrideEvents: JournalMemoryEvent[]) {
  return (
    overrideEvents.length > 1 ||
    overrideEvents.some((event) => {
      const overrideCount =
        getNumber(event.metadata, "overrideCountToday") ??
        getNumber(event.metadata, "overrideCount") ??
        getNumber(event.metadata, "previousOverrideCount") ??
        0;

      return overrideCount > 1;
    })
  );
}

export function deriveJournalMemoryInsights(input: DeriveJournalMemoryInsightsInput): JournalMemoryInsight[] {
  const events = uniqueEvents(input.relatedMemoryEvents);
  const insights: JournalMemoryInsight[] = [];
  const aiWarningEvents = events.filter((event) => event.type === "ai_warning_shown");
  const warningDismissedEvents = events.filter(
    (event) => event.type === "ai_warning_dismissed" || event.type === "ai_warning_ignored",
  );
  const disciplineEvents = events.filter(
    (event) => event.type === "discipline_rule_blocked" || event.type === "discipline_rule_edit_blocked",
  );
  const overrideEvents = events.filter((event) => event.type === "discipline_override_bond_posted");
  const magicTradeEvents = events.filter((event) => event.type === "magic_trade_executed");
  const triggerEvents = events.filter((event) => event.type === "trigger_fired");

  if (aiWarningEvents.length > 0) {
    insights.push(makeInsight({
      category: "ai_warning",
      events: aiWarningEvents,
      id: "journal-memory-insight:ai-warning",
      message: "Portal showed a warning while this trade was active. Review whether you acted on it.",
      severity: "warning",
      title: "AI warned during this trade.",
    }));
  }

  if (warningDismissedEvents.length > 0) {
    insights.push(makeInsight({
      category: "ai_warning",
      events: warningDismissedEvents,
      id: "journal-memory-insight:warning-dismissed",
      message: "You dismissed a warning during this trade. Check whether the trade still followed your plan.",
      severity: "warning",
      title: "Warning dismissed.",
    }));
  }

  if (disciplineEvents.length > 0) {
    insights.push(makeInsight({
      category: "discipline",
      events: disciplineEvents,
      id: "journal-memory-insight:discipline-stepped-in",
      message: "Portal blocked new risk near this trade. That usually means pressure was rising.",
      severity: "critical",
      title: "Discipline stepped in.",
    }));
  }

  if (overrideEvents.length > 0) {
    insights.push(makeInsight({
      category: "override_bond",
      events: overrideEvents,
      id: "journal-memory-insight:override-bond",
      message: "You paid to override a locked rule. That should be reviewed, not ignored.",
      severity: "critical",
      title: "Override Bond posted.",
    }));
  }

  if (hasRepeatedOverride(overrideEvents)) {
    insights.push(makeInsight({
      category: "override_bond",
      events: overrideEvents,
      id: "journal-memory-insight:repeated-override",
      message: "Multiple Override Bonds appeared in this session. That is pressure trading.",
      severity: "critical",
      title: "Repeated override pattern.",
    }));
  }

  if (disciplineEvents.length > 0 && overrideEvents.length === 0) {
    insights.push(makeInsight({
      category: "discipline",
      events: disciplineEvents,
      id: "journal-memory-insight:rule-respected",
      message: "You did not override the locked rule. That restraint matters.",
      severity: "positive",
      title: "Rule respected.",
    }));
  }

  if (magicTradeEvents.length > 0) {
    insights.push(makeInsight({
      category: "magic_trade",
      events: magicTradeEvents,
      id: "journal-memory-insight:magic-trade",
      message: "This trade was managed or affected by Magic Trade automation.",
      severity: "info",
      title: "Magic Trade involved.",
    }));
  }

  if (triggerEvents.length > 0) {
    insights.push(makeInsight({
      category: "trigger",
      events: triggerEvents,
      id: "journal-memory-insight:trigger",
      message: "This trade involved a trigger. Review whether the trigger matched your plan.",
      severity: "info",
      title: "Trigger involved.",
    }));
  }

  if (input.selectedEntry?.planFollowed === "followed") {
    insights.push(makeInsight({
      category: "plan",
      id: "journal-memory-insight:plan-followed",
      message: "You marked this trade as following the plan.",
      severity: "positive",
      title: "Plan followed.",
    }));
  } else if (input.selectedEntry?.planFollowed === "broken") {
    insights.push(makeInsight({
      category: "plan",
      id: "journal-memory-insight:plan-broken",
      message: "You marked this trade as breaking the plan. Review the mistake field.",
      severity: "critical",
      title: "Plan broken.",
    }));
  }

  return insights;
}

export function deriveNoTradeMemoryInsights(noTradeEvents: JournalMemoryEvent[]): JournalMemoryInsight[] {
  const events = uniqueEvents(noTradeEvents.filter((event) => event.type === "no_trade_session"));

  if (events.length === 0) {
    return [];
  }

  const insights = [
    makeInsight({
      category: "no_trade",
      events,
      id: "journal-memory-insight:no-trade-recorded",
      message: "Portal captured a blocked attempt without creating a fake trade. That behavior still matters.",
      severity: "warning",
      title: "No-trade decision recorded.",
    }),
  ];

  const overrideEvents = events.filter((event) =>
    event.message?.toLowerCase().includes("override bond") ||
    event.title?.toLowerCase().includes("override bond"),
  );
  if (overrideEvents.length > 0) {
    insights.push(makeInsight({
      category: "override_bond",
      events: overrideEvents,
      id: "journal-memory-insight:no-trade-override",
      message: "An Override Bond was posted without an active trade.",
      severity: "critical",
      title: "Override Bond without active trade.",
    }));
  }

  if (events.length > 1) {
    insights.push(makeInsight({
      category: "no_trade",
      events,
      id: "journal-memory-insight:repeated-no-trade",
      message: "Multiple blocked attempts were captured in Journal memory.",
      severity: "warning",
      title: "Repeated blocked attempts.",
    }));
  }

  return insights;
}
