import {
  applySoulExpEvent,
  createInitialSoulExpState,
  getSoulExpForEvent,
  getSoulLevelForExp,
} from "./soul-exp";
import type {
  SoulExpActionType,
  SoulExpEvent,
  SoulExpState,
  SoulLevelProgress,
} from "./soul-types";

type SoulExpTone = "neutral" | "positive" | "negative" | "warning";

export type SoulExpActivityJournalEntry = {
  closedAt?: string | null;
  direction?: "long" | "short" | null;
  id: string;
  status?: "open" | "closed" | string;
  symbol?: string | null;
  timestamp: string;
  updatedAt?: string | null;
};

export type SoulExpActivitySessionLogEntry = {
  description?: string;
  eventType: string;
  id: string;
  source?: string;
  symbol?: string | null;
  timestamp: string;
};

export type SoulExpActivityMemoryEvent = {
  id: string;
  message?: string;
  sessionLogId?: string;
  source?: string;
  symbol?: string | null;
  timestamp: string;
  title?: string;
  type: string;
};

export type SoulExpDisplayEvent = {
  detail: string;
  exp: number;
  id: string;
  label: string;
  meta: string;
  occurredAt: string;
  tone: SoulExpTone;
  type: SoulExpActionType;
};

export type SoulExpDerivedProgression = {
  currentLevelExp: number;
  expToNextLevel: number | null;
  level: SoulLevelProgress;
  progressPercent: number;
  recentEvents: SoulExpDisplayEvent[];
  state: SoulExpState;
};

type DeriveSoulExpInput = {
  journalEntries?: SoulExpActivityJournalEntry[];
  journalMemoryEvents?: SoulExpActivityMemoryEvent[];
  now?: string;
  recentEventLimit?: number;
  sessionLogEntries?: SoulExpActivitySessionLogEntry[];
};

type DerivedSoulExpEvent = SoulExpEvent & {
  detail: string;
  label: string;
  meta: string;
  tone: SoulExpTone;
};

const TRADE_EXECUTION_EVENT_TYPES = new Set([
  "position-opened",
  "position-closed",
  "position-reduced",
  "position-reversed",
  "pending-order-filled",
  "close-all-used",
]);

function normalizeSymbol(symbol: string | null | undefined) {
  return symbol && symbol.trim().length > 0 ? symbol : "Portal";
}

function getJournalTimestamp(entry: SoulExpActivityJournalEntry) {
  return entry.closedAt ?? entry.updatedAt ?? entry.timestamp;
}

function createEvent(input: {
  detail: string;
  id: string;
  label: string;
  meta: string;
  occurredAt: string;
  tone?: SoulExpTone;
  type: SoulExpActionType;
}): DerivedSoulExpEvent {
  return {
    detail: input.detail,
    id: input.id,
    label: input.label,
    meta: input.meta,
    occurredAt: input.occurredAt,
    tone: input.tone ?? "positive",
    type: input.type,
  };
}

function appendUniqueEvent(
  eventsById: Map<string, DerivedSoulExpEvent>,
  event: DerivedSoulExpEvent,
) {
  if (!eventsById.has(event.id)) {
    eventsById.set(event.id, event);
  }
}

function getProgressPercent(totalExp: number, level: SoulLevelProgress) {
  if (level.nextLevelExp === null) {
    return 100;
  }

  const span = level.nextLevelExp - level.currentLevelExp;
  if (span <= 0) {
    return 100;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(((totalExp - level.currentLevelExp) / span) * 100)),
  );
}

function compareEventsAscending(
  left: Pick<SoulExpEvent, "id" | "occurredAt">,
  right: Pick<SoulExpEvent, "id" | "occurredAt">,
) {
  const timestampCompare = left.occurredAt.localeCompare(right.occurredAt);
  return timestampCompare === 0 ? left.id.localeCompare(right.id) : timestampCompare;
}

function toDisplayEvent(event: DerivedSoulExpEvent): SoulExpDisplayEvent {
  return {
    detail: event.detail,
    exp: getSoulExpForEvent(event),
    id: event.id,
    label: event.label,
    meta: event.meta,
    occurredAt: event.occurredAt,
    tone: event.tone,
    type: event.type,
  };
}

export function deriveSoulExpFromActivity({
  journalEntries = [],
  journalMemoryEvents = [],
  now,
  recentEventLimit = 6,
  sessionLogEntries = [],
}: DeriveSoulExpInput): SoulExpDerivedProgression {
  const eventsById = new Map<string, DerivedSoulExpEvent>();

  journalEntries.forEach((entry) => {
    appendUniqueEvent(
      eventsById,
      createEvent({
        detail: `${normalizeSymbol(entry.symbol)} ${entry.status === "closed" ? "closed" : "logged"}`,
        id: `soul-exp:journal:${entry.id}`,
        label: "Journaled trade",
        meta: "Journal",
        occurredAt: getJournalTimestamp(entry),
        type: "journaled_trade_recorded",
      }),
    );
  });

  journalMemoryEvents.forEach((event) => {
    if (event.type === "magic_trade_executed") {
      appendUniqueEvent(
        eventsById,
        createEvent({
          detail: normalizeSymbol(event.symbol),
          id: `soul-exp:magic:${event.sessionLogId ?? event.id}`,
          label: "Magic Trade used",
          meta: "Logic",
          occurredAt: event.timestamp,
          type: "magic_trade_used",
        }),
      );
      return;
    }

    if (event.type === "ai_warning_respected" || event.type === "no_trade_session") {
      appendUniqueEvent(
        eventsById,
        createEvent({
          detail: event.title ?? event.message ?? "Restraint recorded",
          id: `soul-exp:memory:${event.id}`,
          label: "Impulse avoided",
          meta: event.source === "discipline" ? "Discipline" : "AI Coach",
          occurredAt: event.timestamp,
          type: "impulse_avoided",
        }),
      );
    }
  });

  sessionLogEntries.forEach((entry) => {
    if (entry.eventType === "TAG_ALONG_EXECUTED") {
      appendUniqueEvent(
        eventsById,
        createEvent({
          detail: normalizeSymbol(entry.symbol),
          id: `soul-exp:magic:${entry.id}`,
          label: "Magic Trade used",
          meta: "Logic",
          occurredAt: entry.timestamp,
          type: "magic_trade_used",
        }),
      );
      return;
    }

    if (entry.eventType === "discipline-plan-activated") {
      appendUniqueEvent(
        eventsById,
        createEvent({
          detail: entry.source ?? "Rule set active",
          id: `soul-exp:discipline:${entry.id}`,
          label: "Rule accepted",
          meta: "Discipline",
          occurredAt: entry.timestamp,
          type: "rule_accepted",
        }),
      );
      return;
    }

    if (TRADE_EXECUTION_EVENT_TYPES.has(entry.eventType)) {
      appendUniqueEvent(
        eventsById,
        createEvent({
          detail: normalizeSymbol(entry.symbol),
          id: `soul-exp:session:${entry.id}`,
          label: "Execution logged",
          meta: entry.source ?? "Session Log",
          occurredAt: entry.timestamp,
          type: "trade_execution_logged",
        }),
      );
    }
  });

  const sortedEvents = Array.from(eventsById.values()).sort(compareEventsAscending);
  const createdAt = sortedEvents[0]?.occurredAt ?? now ?? new Date(0).toISOString();
  const state = sortedEvents.reduce(
    (currentState, event) => applySoulExpEvent(currentState, event),
    createInitialSoulExpState(createdAt),
  );
  const level = getSoulLevelForExp(state.totalExp);
  const progressPercent = getProgressPercent(state.totalExp, level);

  return {
    currentLevelExp: level.currentLevelExp,
    expToNextLevel:
      level.nextLevelExp === null
        ? null
        : Math.max(0, level.nextLevelExp - state.totalExp),
    level,
    progressPercent,
    recentEvents: sortedEvents
      .slice()
      .reverse()
      .slice(0, recentEventLimit)
      .map(toDisplayEvent),
    state,
  };
}
