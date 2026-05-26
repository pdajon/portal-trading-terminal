export const JOURNAL_MEMORY_EVENTS_STORAGE_KEY = "portal.journal.memoryEvents";

export type JournalMemoryEventType =
  | "trade_opened"
  | "trade_closed"
  | "trade_reduced"
  | "trade_reversed"
  | "order_filled"
  | "magic_trade_executed"
  | "trigger_fired"
  | "discipline_rule_blocked"
  | "discipline_rule_edit_blocked"
  | "discipline_override_bond_posted"
  | "ai_warning_shown"
  | "ai_warning_dismissed"
  | "ai_warning_respected"
  | "ai_warning_ignored"
  | "no_trade_session"
  | "plan_created"
  | "plan_changed"
  | "protection_added"
  | "protection_removed"
  | "protection_updated";

export type JournalMemoryEventSource =
  | "execution"
  | "discipline"
  | "ai_coach"
  | "override_bond"
  | "magic_trade"
  | "trigger"
  | "journal"
  | "system";

export type JournalMemoryEvent = {
  aiWarningId?: string;
  id: string;
  journalEntryId?: string;
  magicTradeRuleId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  overrideBondId?: string;
  sessionLogId?: string;
  severity?: "info" | "warning" | "critical";
  side?: "long" | "short";
  source: JournalMemoryEventSource;
  symbol?: string;
  timestamp: string;
  title?: string;
  tradeId?: string;
  triggerId?: string;
  type: JournalMemoryEventType;
};

export type JournalMemoryJournalEntry = {
  direction?: "long" | "short" | null;
  id: string;
  status: "open" | "closed";
  symbol?: string | null;
};

export type JournalMemorySessionLogEntry = {
  description?: string;
  direction?: "long" | "short" | null;
  eventType: string;
  id: string;
  metadata?: unknown;
  pnl?: number | null;
  price?: number | null;
  size?: number | null;
  source?: string;
  symbol?: string | null;
  timestamp: string;
};

export type JournalMemoryAiWarning = {
  actionLabel?: string;
  id: string;
  message: string;
  relatedRuleType?: string;
  severity: "info" | "warning" | "critical";
  source: string;
  symbol?: string;
  timestamp: string;
  title: string;
  trigger: string;
  ttlMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isJournalMemoryEvent(value: unknown): value is JournalMemoryEvent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.type === "string" &&
    typeof value.source === "string"
  );
}

function cloneMetadata(metadata: unknown): Record<string, unknown> {
  return isRecord(metadata) ? { ...metadata } : {};
}

function normalizeOptionalString(value: string | null | undefined) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function createSessionLogMetadata(entry: JournalMemorySessionLogEntry, extra: Record<string, unknown> = {}) {
  return {
    ...cloneMetadata(entry.metadata),
    direction: entry.direction ?? null,
    eventType: entry.eventType,
    pnl: entry.pnl ?? null,
    price: entry.price ?? null,
    sessionLogSource: entry.source ?? null,
    size: entry.size ?? null,
    ...extra,
  };
}

export function serializeJournalMemoryEvents(events: JournalMemoryEvent[]) {
  return JSON.stringify(events);
}

export function parseJournalMemoryEvents(rawValue: string | null): JournalMemoryEvent[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isJournalMemoryEvent) : [];
  } catch {
    return [];
  }
}

export function readJournalMemoryEvents(storage: Pick<Storage, "getItem">): JournalMemoryEvent[] {
  return parseJournalMemoryEvents(storage.getItem(JOURNAL_MEMORY_EVENTS_STORAGE_KEY));
}

export function writeJournalMemoryEvents(
  storage: Pick<Storage, "removeItem" | "setItem">,
  events: JournalMemoryEvent[],
) {
  if (events.length === 0) {
    storage.removeItem(JOURNAL_MEMORY_EVENTS_STORAGE_KEY);
    return;
  }

  storage.setItem(JOURNAL_MEMORY_EVENTS_STORAGE_KEY, serializeJournalMemoryEvents(events));
}

export function appendJournalMemoryEvent(
  events: JournalMemoryEvent[],
  nextEvent: JournalMemoryEvent,
  maxEvents = 500,
): JournalMemoryEvent[] {
  const withoutDuplicate = events.filter((event) => event.id !== nextEvent.id);
  return [nextEvent, ...withoutDuplicate].slice(0, maxEvents);
}

export function appendJournalMemoryEvents(
  events: JournalMemoryEvent[],
  nextEvents: JournalMemoryEvent[],
  maxEvents = 500,
): JournalMemoryEvent[] {
  return nextEvents.reduce(
    (currentEvents, nextEvent) => appendJournalMemoryEvent(currentEvents, nextEvent, maxEvents),
    events,
  );
}

export function getJournalMemoryEventsForJournalEntry(events: JournalMemoryEvent[], journalEntryId: string) {
  return events.filter((event) => event.journalEntryId === journalEntryId);
}

export function getJournalMemoryEventsForTrade(events: JournalMemoryEvent[], tradeId: string) {
  return events.filter((event) => event.tradeId === tradeId || event.journalEntryId === tradeId);
}

export function getJournalMemoryEventsForSymbol(events: JournalMemoryEvent[], symbol: string) {
  return events.filter((event) => event.symbol === symbol);
}

export function getJournalMemoryEventsForSession(events: JournalMemoryEvent[], sessionLogId: string) {
  return events.filter((event) => event.sessionLogId === sessionLogId);
}

export function findActiveJournalEntryForSymbol(
  journalEntries: JournalMemoryJournalEntry[],
  symbol: string | null | undefined,
) {
  if (!symbol) {
    return null;
  }

  return journalEntries.find((entry) => entry.symbol === symbol && entry.status === "open") ?? null;
}

export function filterJournalEntriesWithActiveTradeSymbols(
  journalEntries: JournalMemoryJournalEntry[],
  activeTradeSymbols: Iterable<string>,
) {
  const activeSymbolSet = new Set(activeTradeSymbols);

  return journalEntries.filter(
    (entry) => entry.status !== "open" || (entry.symbol ? activeSymbolSet.has(entry.symbol) : false),
  );
}

export function linkMemoryEventToJournalEntry(
  event: JournalMemoryEvent,
  journalEntry: JournalMemoryJournalEntry | null,
): JournalMemoryEvent {
  if (!journalEntry) {
    return event;
  }

  return {
    ...event,
    journalEntryId: journalEntry.id,
    side: event.side ?? journalEntry.direction ?? undefined,
    tradeId: event.tradeId ?? journalEntry.id,
  };
}

export function createNoTradeSessionEvent(details: {
  metadata?: Record<string, unknown>;
  message?: string;
  sessionLogId?: string;
  side?: "long" | "short" | null;
  source?: JournalMemoryEventSource;
  symbol?: string | null;
  timestamp: string;
  title?: string;
  triggerId?: string;
}): JournalMemoryEvent {
  const stableId = details.sessionLogId ?? details.triggerId ?? `${details.timestamp}:${details.symbol ?? "session"}`;

  return {
    id: `journal-memory:no-trade:${stableId}`,
    message: details.message,
    metadata: details.metadata,
    sessionLogId: details.sessionLogId,
    side: details.side ?? undefined,
    source: details.source ?? "system",
    symbol: normalizeOptionalString(details.symbol),
    timestamp: details.timestamp,
    title: details.title ?? "No-trade session",
    triggerId: details.triggerId,
    type: "no_trade_session",
  };
}

function getLinkedEvent(
  event: JournalMemoryEvent,
  entry: JournalMemoryJournalEntry | null,
) {
  return linkMemoryEventToJournalEntry(event, entry);
}

function mapSessionEventType(eventType: string): {
  source: JournalMemoryEventSource;
  type: JournalMemoryEventType;
} | null {
  switch (eventType) {
    case "position-opened":
    case "market-order-placed":
      return { source: "execution", type: "trade_opened" };
    case "position-closed":
    case "close-all-used":
      return { source: "execution", type: "trade_closed" };
    case "position-reduced":
      return { source: "execution", type: "trade_reduced" };
    case "position-reversed":
      return { source: "execution", type: "trade_reversed" };
    case "pending-order-filled":
      return { source: "execution", type: "order_filled" };
    case "discipline-rule-blocked":
    case "discipline-market-entry-confirmation-required":
      return { source: "discipline", type: "discipline_rule_blocked" };
    case "discipline-rule-edit-blocked":
      return { source: "discipline", type: "discipline_rule_edit_blocked" };
    case "discipline-override-bond-posted":
      return { source: "override_bond", type: "discipline_override_bond_posted" };
    case "discipline-plan-activated":
      return { source: "journal", type: "plan_changed" };
    case "TAG_ALONG_EXECUTED":
      return { source: "magic_trade", type: "magic_trade_executed" };
    case "protection-attached":
      return { source: "journal", type: "protection_added" };
    case "protection-updated":
    case "break-even-used":
      return { source: "journal", type: "protection_updated" };
    default:
      return null;
  }
}

function buildBaseMemoryEvent(
  entry: JournalMemorySessionLogEntry,
  type: JournalMemoryEventType,
  source: JournalMemoryEventSource,
  metadata: Record<string, unknown> = {},
): JournalMemoryEvent {
  return {
    id: `journal-memory:${type}:${entry.id}`,
    magicTradeRuleId: source === "magic_trade" ? getString(entry.metadata, "ruleId") ?? undefined : undefined,
    message: entry.description,
    metadata: createSessionLogMetadata(entry, metadata),
    overrideBondId:
      type === "discipline_override_bond_posted"
        ? getString(entry.metadata, "overrideBondId") ?? getString(entry.metadata, "ruleId") ?? entry.id
        : undefined,
    sessionLogId: entry.id,
    side: entry.direction ?? undefined,
    source,
    symbol: normalizeOptionalString(entry.symbol),
    timestamp: entry.timestamp,
    title: entry.source,
    type,
  };
}

export function mapSessionLogEntryToJournalMemoryEvents(
  sessionLogEntry: JournalMemorySessionLogEntry,
  journalEntries: JournalMemoryJournalEntry[],
  options: {
    activeTradeSymbols?: Iterable<string>;
  } = {},
): JournalMemoryEvent[] {
  const mapped = mapSessionEventType(sessionLogEntry.eventType);

  if (!mapped) {
    return [];
  }

  const memoryJournalEntries =
    options.activeTradeSymbols !== undefined
      ? filterJournalEntriesWithActiveTradeSymbols(journalEntries, options.activeTradeSymbols)
      : journalEntries;
  const activeEntry = findActiveJournalEntryForSymbol(memoryJournalEntries, sessionLogEntry.symbol);
  const events: JournalMemoryEvent[] = [];
  let noTradeSessionEvent: JournalMemoryEvent | null = null;

  if (
    !activeEntry &&
    (mapped.type === "discipline_rule_blocked" ||
      mapped.type === "discipline_rule_edit_blocked" ||
      mapped.type === "discipline_override_bond_posted")
  ) {
    noTradeSessionEvent = createNoTradeSessionEvent({
      message: sessionLogEntry.description,
      sessionLogId: sessionLogEntry.id,
      side: sessionLogEntry.direction,
      source: mapped.source,
      symbol: sessionLogEntry.symbol,
      timestamp: sessionLogEntry.timestamp,
      metadata: createSessionLogMetadata(sessionLogEntry),
    });
    events.push(noTradeSessionEvent);
  }

  const event = getLinkedEvent(
    buildBaseMemoryEvent(sessionLogEntry, mapped.type, mapped.source, {
      noTradeSessionEventId: noTradeSessionEvent?.id,
    }),
    activeEntry,
  );
  events.push(event);

  const hasTrigger =
    getString(sessionLogEntry.metadata, "triggerId") !== null ||
    getString(sessionLogEntry.metadata, "triggerSource") !== null ||
    (isRecord(sessionLogEntry.metadata) && "sourceTriggerSnapshot" in sessionLogEntry.metadata);

  if (hasTrigger) {
    events.push(
      getLinkedEvent(
        buildBaseMemoryEvent(sessionLogEntry, "trigger_fired", "trigger", {
          parentMemoryEventId: event.id,
        }),
        activeEntry,
      ),
    );
    events[events.length - 1] = {
      ...events[events.length - 1],
      id: `journal-memory:trigger_fired:${sessionLogEntry.id}`,
      triggerId:
        getString(sessionLogEntry.metadata, "triggerId") ??
        getString(sessionLogEntry.metadata, "ruleId") ??
        sessionLogEntry.id,
    };
  }

  return events;
}

export function createAiWarningShownMemoryEvent(details: {
  activeJournalEntries: JournalMemoryJournalEntry[];
  warning: JournalMemoryAiWarning;
}): JournalMemoryEvent {
  const activeEntry = findActiveJournalEntryForSymbol(details.activeJournalEntries, details.warning.symbol);

  return linkMemoryEventToJournalEntry(
    {
      aiWarningId: details.warning.id,
      id: `journal-memory:ai_warning_shown:${details.warning.id}`,
      message: details.warning.message,
      metadata: {
        warning: details.warning,
        warningSource: details.warning.source,
        warningTrigger: details.warning.trigger,
      },
      severity: details.warning.severity,
      source: "ai_coach",
      symbol: details.warning.symbol,
      timestamp: details.warning.timestamp,
      title: details.warning.title,
      type: "ai_warning_shown",
    },
    activeEntry,
  );
}

export function createAiWarningDismissedMemoryEvent(details: {
  activeJournalEntries: JournalMemoryJournalEntry[];
  timestamp: string;
  warning: unknown;
}): JournalMemoryEvent {
  const warning = isRecord(details.warning) ? details.warning : {};
  const warningId = typeof warning.id === "string" ? warning.id : `unknown-${details.timestamp}`;
  const warningSymbol = typeof warning.symbol === "string" ? warning.symbol : undefined;
  const activeEntry = findActiveJournalEntryForSymbol(details.activeJournalEntries, warningSymbol);

  return linkMemoryEventToJournalEntry(
    {
      aiWarningId: warningId,
      id: `journal-memory:ai_warning_dismissed:${warningId}`,
      message: typeof warning.message === "string" ? warning.message : undefined,
      metadata: {
        warning,
      },
      severity:
        warning.severity === "info" || warning.severity === "warning" || warning.severity === "critical"
          ? warning.severity
          : undefined,
      source: "ai_coach",
      symbol: warningSymbol,
      timestamp: details.timestamp,
      title: typeof warning.title === "string" ? warning.title : "AI warning dismissed",
      type: "ai_warning_dismissed",
    },
    activeEntry,
  );
}
