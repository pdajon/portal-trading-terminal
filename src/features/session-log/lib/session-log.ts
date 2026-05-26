import type { TradeDirection } from "@/types/trade";

export const SESSION_LOG_STORAGE_KEY = "portal.session-log";
export const MAX_SESSION_LOG_ENTRIES = 250;

export type SessionLogCategory =
  | "orders"
  | "positions"
  | "protection"
  | "discipline"
  | "logic";

export type SessionLogEventType =
  | "market-order-placed"
  | "limit-order-placed"
  | "limit-order-canceled"
  | "pending-order-filled"
  | "position-opened"
  | "position-reduced"
  | "position-reversed"
  | "position-closed"
  | "close-all-used"
  | "cancel-all-orders-used"
  | "protection-attached"
  | "protection-updated"
  | "break-even-used"
  | "discipline-rule-blocked"
  | "discipline-market-entry-confirmation-required"
  | "discipline-market-entry-confirmed"
  | "discipline-market-entry-canceled"
  | "discipline-rule-edit-blocked"
  | "discipline-override-bond-posted"
  | "discipline-plan-activated"
  | "TAG_ALONG_ARMED"
  | "TAG_ALONG_UPDATED"
  | "TAG_ALONG_DISARMED"
  | "TAG_ALONG_WOULD_TRIGGER"
  | "TAG_ALONG_EXECUTED"
  | "TAG_ALONG_SKIPPED"
  | "TAG_ALONG_FAILED";

export type SessionLogEntry = {
  category: SessionLogCategory;
  description: string;
  direction: TradeDirection | null;
  eventType: SessionLogEventType;
  id: string;
  metadata?: unknown;
  pnl: number | null;
  price: number | null;
  size: number | null;
  source: string;
  symbol: string | null;
  timestamp: string;
};

export type SessionLogEntryDraft = Omit<
  SessionLogEntry,
  "id" | "timestamp"
> & {
  timestamp?: string;
};

export type SessionLogFilter = "all" | SessionLogCategory;

export const SESSION_LOG_FILTERS: Array<{
  id: SessionLogFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "orders", label: "Orders" },
  { id: "positions", label: "Positions" },
  { id: "protection", label: "Protection" },
  { id: "discipline", label: "Discipline" },
  { id: "logic", label: "Logic" },
];

type CreateSessionLogEntriesOptions = {
  now?: number;
  randomUUID?: () => string;
};

export function createSessionLogEntries(
  entries: SessionLogEntryDraft[],
  options: CreateSessionLogEntriesOptions = {},
) {
  if (entries.length === 0) {
    return [] as SessionLogEntry[];
  }

  const now = options.now ?? Date.now();
  const randomUUID =
    options.randomUUID ?? (() => globalThis.crypto.randomUUID());

  return entries.map((entry, index) => ({
    ...entry,
    id: `session-log-${now}-${index}-${randomUUID()}`,
    timestamp: entry.timestamp ?? new Date(now + index).toISOString(),
  }));
}

export function prependSessionLogEntries(
  currentEntries: SessionLogEntry[],
  nextEntries: SessionLogEntry[],
  maxEntries = MAX_SESSION_LOG_ENTRIES,
) {
  return [...nextEntries.slice().reverse(), ...currentEntries].slice(
    0,
    maxEntries,
  );
}

export function filterSessionLogEntries(
  entries: SessionLogEntry[],
  filter: SessionLogFilter,
) {
  return filter === "all"
    ? entries
    : entries.filter((entry) => entry.category === filter);
}

export function indexSessionLogEntriesById(entries: SessionLogEntry[]) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

export function formatSessionLogTimestamp(timestamp: string) {
  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
  }).format(parsedDate);
}

export function formatSessionLogPrice(price: number) {
  if (!Number.isFinite(price)) {
    return "--";
  }

  return price.toFixed(2);
}

export function formatSessionLogEventType(eventType: SessionLogEventType) {
  switch (eventType) {
    case "market-order-placed":
      return "Market Order";
    case "limit-order-placed":
      return "Limit Order";
    case "limit-order-canceled":
      return "Limit Canceled";
    case "pending-order-filled":
      return "Pending Fill";
    case "position-opened":
      return "Position Opened";
    case "position-reduced":
      return "Position Reduced";
    case "position-reversed":
      return "Position Reversed";
    case "position-closed":
      return "Position Closed";
    case "close-all-used":
      return "Close All";
    case "cancel-all-orders-used":
      return "Cancel All";
    case "protection-attached":
      return "Protection Attached";
    case "protection-updated":
      return "Protection Updated";
    case "break-even-used":
      return "Break Even";
    case "discipline-rule-blocked":
      return "Rule Block";
    case "discipline-rule-edit-blocked":
      return "Rule Edit Block";
    case "discipline-override-bond-posted":
      return "Override Bond";
    case "discipline-plan-activated":
      return "Plan Activated";
    case "TAG_ALONG_ARMED":
      return "Magic Trade Armed";
    case "TAG_ALONG_UPDATED":
      return "Magic Trade Updated";
    case "TAG_ALONG_DISARMED":
      return "Magic Trade Disarmed";
    case "TAG_ALONG_WOULD_TRIGGER":
      return "Magic Trade Would Trigger";
    case "TAG_ALONG_EXECUTED":
      return "Magic Trade Executed";
    case "TAG_ALONG_SKIPPED":
      return "Magic Trade Skipped";
    case "TAG_ALONG_FAILED":
      return "Magic Trade Failed";
    default:
      return eventType;
  }
}
