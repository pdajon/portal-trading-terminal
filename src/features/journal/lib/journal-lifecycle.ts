import type { JournalMemoryEvent, JournalMemoryEventSource } from "./journal-memory-events";

export type NativeJournalTradeSide = "long" | "short";
export type NativeJournalTradeStatus = "open" | "closed";

export type JournalTradeFeeSnapshot = {
  currency?: string | null;
  total: number | null;
};

export type JournalTradeLifecycleEvent = {
  childOrderId?: number | string | null;
  clientOrderId?: string | null;
  executionId?: string | null;
  fees?: JournalTradeFeeSnapshot | null;
  grossPnl?: number | null;
  magicTradeRuleId?: string | null;
  netPnl?: number | null;
  orderId?: number | string | null;
  orderZoneId?: string | null;
  realizedPnl?: number | null;
  reducedSize?: number | null;
  remainingSize?: number | null;
  sessionLogId?: string | null;
  size?: number | null;
  timestamp: string;
  triggerId?: string | null;
  type: "opened" | "reduced" | "closed" | "reversed" | "order_filled" | "magic_trade" | "trigger_fired";
};

export type NativeJournalLifecycleEntry = {
  closedAt?: string | null;
  clientOrderId?: string | null;
  direction: NativeJournalTradeSide | null;
  entryPrice: number | null;
  executionId?: string | null;
  exitPrice: number | null;
  fees?: JournalTradeFeeSnapshot | null;
  grossPnl?: number | null;
  id: string;
  magicTradeRuleId?: string | null;
  openedAt?: string | null;
  orderId?: number | string | null;
  orderZoneId?: string | null;
  realizedPnl: number | null;
  relatedExecutionIds?: string[];
  relatedOrderIds?: Array<number | string>;
  relatedSessionLogIds: string[];
  size: number | null;
  status: NativeJournalTradeStatus;
  symbol: string | null;
  timestamp: string;
  tradeLifecycleEvents?: JournalTradeLifecycleEvent[];
  triggerId?: string | null;
  updatedAt: string;
};

export type CreateJournalEntryForOpenedTradeInput<Entry extends NativeJournalLifecycleEntry> = {
  baseEntry: Entry;
  clientOrderId?: string | null;
  executionId?: string | null;
  fees?: JournalTradeFeeSnapshot | null;
  magicTradeRuleId?: string | null;
  orderId?: number | string | null;
  orderZoneId?: string | null;
  relatedSessionLogIds?: string[];
  timestamp: string;
  triggerId?: string | null;
};

export type JournalTradeReductionInput = {
  childOrderId?: number | string | null;
  clientOrderId?: string | null;
  executionId?: string | null;
  fees?: JournalTradeFeeSnapshot | null;
  grossPnl?: number | null;
  magicTradeRuleId?: string | null;
  netPnl?: number | null;
  orderId?: number | string | null;
  orderZoneId?: string | null;
  realizedPnl?: number | null;
  reducedSize?: number | null;
  relatedSessionLogIds?: string[];
  remainingSize?: number | null;
  sessionLogId?: string | null;
  timestamp: string;
  triggerId?: string | null;
};

export type JournalTradeCloseInput = JournalTradeReductionInput & {
  exitPrice?: number | null;
  size?: number | null;
};

export type JournalTradeReverseInput = JournalTradeCloseInput & {
  newEntry?: NativeJournalLifecycleEntry | null;
};

function compactStrings(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(compactStrings(values)));
}

function uniqueOrderIds(values: Array<number | string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is number | string => typeof value === "number" || typeof value === "string")),
  );
}

function normalizeFees(fees: JournalTradeFeeSnapshot | null | undefined) {
  return fees && typeof fees.total === "number" && Number.isFinite(fees.total) ? fees : fees ?? null;
}

function resolveNetPnl(details: { fees?: JournalTradeFeeSnapshot | null; grossPnl?: number | null; netPnl?: number | null; realizedPnl?: number | null }) {
  if (typeof details.netPnl === "number" && Number.isFinite(details.netPnl)) {
    return details.netPnl;
  }

  if (
    typeof details.grossPnl === "number" &&
    Number.isFinite(details.grossPnl) &&
    details.fees &&
    typeof details.fees.total === "number" &&
    Number.isFinite(details.fees.total)
  ) {
    return details.grossPnl - details.fees.total;
  }

  if (typeof details.realizedPnl === "number" && Number.isFinite(details.realizedPnl)) {
    return details.realizedPnl;
  }

  return typeof details.grossPnl === "number" && Number.isFinite(details.grossPnl) ? details.grossPnl : null;
}

function appendLifecycleEvent<Entry extends NativeJournalLifecycleEntry>(
  entry: Entry,
  lifecycleEvent: JournalTradeLifecycleEvent,
): Entry {
  return {
    ...entry,
    tradeLifecycleEvents: [...(entry.tradeLifecycleEvents ?? []), lifecycleEvent],
  };
}

function mergeIdentifiers<Entry extends NativeJournalLifecycleEntry>(
  entry: Entry,
  details: {
    clientOrderId?: string | null;
    executionId?: string | null;
    magicTradeRuleId?: string | null;
    orderId?: number | string | null;
    orderZoneId?: string | null;
    relatedSessionLogIds?: string[];
    triggerId?: string | null;
  },
): Entry {
  return {
    ...entry,
    clientOrderId: entry.clientOrderId ?? details.clientOrderId ?? null,
    executionId: entry.executionId ?? details.executionId ?? null,
    magicTradeRuleId: entry.magicTradeRuleId ?? details.magicTradeRuleId ?? null,
    orderId: entry.orderId ?? details.orderId ?? null,
    orderZoneId: entry.orderZoneId ?? details.orderZoneId ?? null,
    relatedExecutionIds: uniqueStrings([...(entry.relatedExecutionIds ?? []), details.executionId]),
    relatedOrderIds: uniqueOrderIds([...(entry.relatedOrderIds ?? []), details.orderId]),
    relatedSessionLogIds: uniqueStrings([...(entry.relatedSessionLogIds ?? []), ...(details.relatedSessionLogIds ?? [])]),
    triggerId: entry.triggerId ?? details.triggerId ?? null,
  };
}

export function createJournalEntryForOpenedTrade<Entry extends NativeJournalLifecycleEntry>(
  details: CreateJournalEntryForOpenedTradeInput<Entry>,
): Entry {
  const openedEntry = mergeIdentifiers(
    {
      ...details.baseEntry,
      fees: normalizeFees(details.fees),
      openedAt: details.baseEntry.openedAt ?? details.timestamp,
      status: "open",
      timestamp: details.baseEntry.timestamp || details.timestamp,
      updatedAt: details.timestamp,
    },
    details,
  );

  return appendLifecycleEvent(openedEntry, {
    clientOrderId: details.clientOrderId ?? null,
    executionId: details.executionId ?? null,
    fees: normalizeFees(details.fees),
    magicTradeRuleId: details.magicTradeRuleId ?? null,
    orderId: details.orderId ?? null,
    orderZoneId: details.orderZoneId ?? null,
    sessionLogId: details.relatedSessionLogIds?.[details.relatedSessionLogIds.length - 1] ?? null,
    size: details.baseEntry.size,
    timestamp: details.timestamp,
    triggerId: details.triggerId ?? null,
    type: "opened",
  });
}

export function updateJournalEntryForReducedTrade<Entry extends NativeJournalLifecycleEntry>(
  entry: Entry,
  details: JournalTradeReductionInput,
): Entry {
  const realizedPnl = resolveNetPnl(details);
  const nextEntry = mergeIdentifiers(
    {
      ...entry,
      fees: normalizeFees(details.fees) ?? entry.fees,
      grossPnl:
        typeof details.grossPnl === "number" && Number.isFinite(details.grossPnl)
          ? (entry.grossPnl ?? 0) + details.grossPnl
          : entry.grossPnl ?? null,
      realizedPnl: realizedPnl !== null ? (entry.realizedPnl ?? 0) + realizedPnl : entry.realizedPnl,
      size:
        typeof details.remainingSize === "number" && Number.isFinite(details.remainingSize)
          ? details.remainingSize
          : entry.size,
      status: "open",
      updatedAt: details.timestamp,
    },
    details,
  );

  return appendLifecycleEvent(nextEntry, {
    childOrderId: details.childOrderId ?? null,
    clientOrderId: details.clientOrderId ?? null,
    executionId: details.executionId ?? null,
    fees: normalizeFees(details.fees),
    grossPnl: details.grossPnl ?? null,
    magicTradeRuleId: details.magicTradeRuleId ?? null,
    netPnl: realizedPnl,
    orderId: details.orderId ?? null,
    orderZoneId: details.orderZoneId ?? null,
    realizedPnl: details.realizedPnl ?? realizedPnl,
    reducedSize: details.reducedSize ?? null,
    remainingSize: details.remainingSize ?? null,
    sessionLogId: details.sessionLogId ?? details.relatedSessionLogIds?.[details.relatedSessionLogIds.length - 1] ?? null,
    timestamp: details.timestamp,
    triggerId: details.triggerId ?? null,
    type: "reduced",
  });
}

export function updateJournalEntryForOrderFilledTrade<Entry extends NativeJournalLifecycleEntry>(
  entry: Entry,
  details: {
    childOrderId?: number | string | null;
    clientOrderId?: string | null;
    executionId?: string | null;
    fillPrice?: number | null;
    fillSize?: number | null;
    orderId?: number | string | null;
    orderZoneId?: string | null;
    relatedSessionLogIds?: string[];
    sessionLogId?: string | null;
    timestamp: string;
  },
): Entry {
  const nextEntry = mergeIdentifiers(
    {
      ...entry,
      size:
        typeof entry.size === "number" &&
        Number.isFinite(entry.size) &&
        typeof details.fillSize === "number" &&
        Number.isFinite(details.fillSize)
          ? entry.size + details.fillSize
          : entry.size,
      status: "open",
      updatedAt: details.timestamp,
    },
    details,
  );

  return appendLifecycleEvent(nextEntry, {
    childOrderId: details.childOrderId ?? details.orderId ?? null,
    clientOrderId: details.clientOrderId ?? null,
    executionId: details.executionId ?? null,
    orderId: details.orderId ?? null,
    orderZoneId: details.orderZoneId ?? null,
    sessionLogId: details.sessionLogId ?? details.relatedSessionLogIds?.[details.relatedSessionLogIds.length - 1] ?? null,
    size: details.fillSize ?? null,
    timestamp: details.timestamp,
    type: "order_filled",
  });
}

export function updateJournalEntryForClosedTrade<Entry extends NativeJournalLifecycleEntry>(
  entry: Entry,
  details: JournalTradeCloseInput,
): Entry {
  const realizedPnl = resolveNetPnl(details);
  const nextEntry = mergeIdentifiers(
    {
      ...entry,
      closedAt: entry.closedAt ?? details.timestamp,
      exitPrice: details.exitPrice ?? entry.exitPrice,
      fees: normalizeFees(details.fees) ?? entry.fees,
      grossPnl:
        typeof details.grossPnl === "number" && Number.isFinite(details.grossPnl)
          ? (entry.grossPnl ?? 0) + details.grossPnl
          : entry.grossPnl ?? null,
      realizedPnl: realizedPnl !== null ? (entry.realizedPnl ?? 0) + realizedPnl : entry.realizedPnl,
      status: "closed",
      updatedAt: details.timestamp,
    },
    details,
  );

  return appendLifecycleEvent(nextEntry, {
    childOrderId: details.childOrderId ?? null,
    clientOrderId: details.clientOrderId ?? null,
    executionId: details.executionId ?? null,
    fees: normalizeFees(details.fees),
    grossPnl: details.grossPnl ?? null,
    magicTradeRuleId: details.magicTradeRuleId ?? null,
    netPnl: realizedPnl,
    orderId: details.orderId ?? null,
    orderZoneId: details.orderZoneId ?? null,
    realizedPnl: details.realizedPnl ?? realizedPnl,
    reducedSize: details.reducedSize ?? details.size ?? null,
    remainingSize: 0,
    sessionLogId: details.sessionLogId ?? details.relatedSessionLogIds?.[details.relatedSessionLogIds.length - 1] ?? null,
    timestamp: details.timestamp,
    triggerId: details.triggerId ?? null,
    type: "closed",
  });
}

export function updateJournalEntryForReversedTrade<Entry extends NativeJournalLifecycleEntry>(
  entry: Entry,
  details: JournalTradeReverseInput,
): { closedEntry: Entry; openedEntry: NativeJournalLifecycleEntry | null } {
  const closedEntry = appendLifecycleEvent(updateJournalEntryForClosedTrade(entry, details), {
    clientOrderId: details.clientOrderId ?? null,
    executionId: details.executionId ?? null,
    fees: normalizeFees(details.fees),
    grossPnl: details.grossPnl ?? null,
    magicTradeRuleId: details.magicTradeRuleId ?? null,
    netPnl: resolveNetPnl(details),
    orderId: details.orderId ?? null,
    orderZoneId: details.orderZoneId ?? null,
    realizedPnl: details.realizedPnl ?? resolveNetPnl(details),
    reducedSize: details.reducedSize ?? details.size ?? null,
    remainingSize: 0,
    sessionLogId: details.sessionLogId ?? details.relatedSessionLogIds?.[details.relatedSessionLogIds.length - 1] ?? null,
    timestamp: details.timestamp,
    triggerId: details.triggerId ?? null,
    type: "reversed",
  });

  return { closedEntry, openedEntry: details.newEntry ?? null };
}

export function resolveActiveJournalEntryForSymbol<Entry extends NativeJournalLifecycleEntry>(
  entries: Entry[],
  symbol: string | null | undefined,
  direction?: NativeJournalTradeSide | null,
) {
  return (
    entries.find(
      (entry) =>
        entry.status === "open" &&
        entry.symbol === symbol &&
        (direction === undefined || direction === null || entry.direction === direction),
    ) ?? null
  );
}

export function resolveJournalEntryByExecutionOrOrderId<Entry extends NativeJournalLifecycleEntry>(
  entries: Entry[],
  identifiers: {
    clientOrderId?: string | null;
    executionId?: string | null;
    orderId?: number | string | null;
    sessionLogId?: string | null;
  },
) {
  return (
    entries.find((entry) => {
      const executionIds = new Set(compactStrings([entry.executionId, ...(entry.relatedExecutionIds ?? [])]));
      const orderIds = new Set(uniqueOrderIds([entry.orderId, ...(entry.relatedOrderIds ?? [])]).map(String));
      const sessionLogIds = new Set(entry.relatedSessionLogIds);
      return (
        (identifiers.executionId ? executionIds.has(identifiers.executionId) : false) ||
        (identifiers.orderId !== null && identifiers.orderId !== undefined
          ? orderIds.has(String(identifiers.orderId))
          : false) ||
        (identifiers.clientOrderId && entry.clientOrderId === identifiers.clientOrderId) ||
        (identifiers.sessionLogId ? sessionLogIds.has(identifiers.sessionLogId) : false)
      );
    }) ?? null
  );
}

export function attachJournalMemoryEventToTrade(
  event: JournalMemoryEvent,
  entry: Pick<NativeJournalLifecycleEntry, "direction" | "id" | "symbol"> | null,
  metadata: Record<string, unknown> = {},
): JournalMemoryEvent {
  if (!entry) {
    return {
      ...event,
      metadata: {
        ...(event.metadata ?? {}),
        ...metadata,
      },
    };
  }

  return {
    ...event,
    journalEntryId: entry.id,
    metadata: {
      ...(event.metadata ?? {}),
      ...metadata,
    },
    side: event.side ?? entry.direction ?? undefined,
    symbol: event.symbol ?? entry.symbol ?? undefined,
    tradeId: event.tradeId ?? entry.id,
  };
}

export function createJournalLifecycleMemoryEvent(details: {
  entry: Pick<NativeJournalLifecycleEntry, "direction" | "id" | "symbol"> | null;
  id: string;
  message?: string;
  metadata?: Record<string, unknown>;
  sessionLogId?: string | null;
  source: JournalMemoryEventSource;
  timestamp: string;
  title?: string;
  type: JournalMemoryEvent["type"];
}) {
  return attachJournalMemoryEventToTrade(
    {
      id: details.id,
      message: details.message,
      metadata: details.metadata,
      sessionLogId: details.sessionLogId ?? undefined,
      source: details.source,
      timestamp: details.timestamp,
      title: details.title,
      type: details.type,
    },
    details.entry,
  );
}
