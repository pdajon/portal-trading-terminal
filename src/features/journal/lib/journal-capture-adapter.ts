import type { ChartTimeframe } from "@/features/chart/components/timeframe-switcher";
import type { TradeDirection } from "@/types/trade";

import {
  createJournalEntryForOpenedTrade,
  updateJournalEntryForOrderFilledTrade,
  type JournalTradeFeeSnapshot,
  type JournalTradeLifecycleEvent,
} from "./journal-lifecycle";
import {
  linkMemoryEventToJournalEntry,
  type JournalMemoryEvent,
} from "./journal-memory-events";

export type JournalEntryStyle = "Hunted" | "Chased";

export type JournalEntrySource =
  | "Market"
  | "Limit"
  | "Mid-Zone"
  | "Order Zone"
  | "Touch Trigger"
  | "Close Trigger"
  | "Other";

export type JournalReplayFrameEvent =
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

export type JournalReplayFramePlan = {
  capturedAt: string;
  event: JournalReplayFrameEvent;
  id: string;
  journalEntryId: string;
  pnl: number | null;
  price: number | null;
  size: number | null;
  status: "captured" | "planned" | "unavailable";
  storageKey: string | null;
};

export type JournalReplayMetadata = {
  captureIntervalTargetSeconds: number;
  finalTimelineMaxFrames: number;
  frames: JournalReplayFramePlan[];
  liveCaptureStoragePreference: "indexeddb-compressed-assets";
  rawFrameCount: number;
  replayStatus: "capturing" | "finalized" | "unavailable";
  savedFrameCount: number;
  preserveEntryExitFrames: boolean;
  preserveKeyEventFrames: boolean;
  timelineDownsampleStrategy: "entry-exit-key-events-even-spacing";
};

export type JournalSnapshotStoreRecord = {
  blob?: Blob;
  fullBlob?: Blob;
  fullHeight?: number;
  fullWidth?: number;
  markerLabel?: string;
  markerPrice?: number;
  markerTone?: "entry" | "exit";
  markerYPercent?: number | null;
  previewBlob?: Blob;
  previewHeight?: number;
  previewWidth?: number;
  storageKey: string;
  storedAt?: string;
};

export type JournalEntry = {
  confidenceRating: number | null;
  closedAt?: string | null;
  clientOrderId?: string | null;
  direction: TradeDirection | null;
  disciplineRulesSnapshot: string[];
  entrySource: JournalEntrySource;
  entryStyle: JournalEntryStyle;
  exitReason:
    | "target_hit"
    | "stop_hit"
    | "manual_close"
    | "panic_close"
    | "magic_trade_action"
    | "rule_discipline_action"
    | "other"
    | null;
  timeframe: ChartTimeframe;
  emotionState: string;
  entryPrice: number | null;
  executionId?: string | null;
  exitPrice: number | null;
  fees?: JournalTradeFeeSnapshot | null;
  grossPnl?: number | null;
  id: string;
  isCustomSetupTag: boolean;
  lessonLearned: string;
  magicTradeRuleId?: string | null;
  mistakeMade: string;
  openedAt?: string | null;
  orderId?: number | string | null;
  orderZoneId?: string | null;
  realizedPnl: number | null;
  relatedExecutionIds?: string[];
  relatedOrderIds?: Array<number | string>;
  relatedSessionLogIds: string[];
  replayMetadata: JournalReplayMetadata;
  planFollowed: "followed" | "broken" | "unclear" | null;
  setupQualityRating: number | null;
  setupCapturedAt: string | null;
  setupStatus: "pending" | "captured" | "skipped" | "uncaptured_emergency_exit";
  setupTag: string | null;
  setupType: string;
  size: number | null;
  status: "open" | "closed";
  symbol: string | null;
  thesis: string;
  timestamp: string;
  tradeLifecycleEvents?: JournalTradeLifecycleEvent[];
  triggerId?: string | null;
  updatedAt: string;
};

export type JournalEntryClassificationInput = {
  orderSource?: string | null;
  triggerCondition?: string | null;
  triggerSource?: "market-manual" | "pending-limit" | "other";
};

export type JournalTradeCaptureDetails = {
  additionalOrderFills?: Array<{
    childOrderId?: number | string | null;
    executionId?: string | null;
    fillPrice?: number | null;
    fillSize?: number | null;
    orderId?: number | string | null;
    orderZoneId?: string | null;
    relatedSessionLogIds?: string[];
    timestamp: string;
  }>;
  clientOrderId?: string | null;
  entrySource: JournalEntrySource;
  entryStyle: JournalEntryStyle;
  direction: TradeDirection | null;
  entryPrice: number | null;
  executionId?: string | null;
  fees?: JournalTradeFeeSnapshot | null;
  magicTradeRuleId?: string | null;
  metadata?: Record<string, unknown>;
  orderId?: number | string | null;
  orderZoneId?: string | null;
  relatedSessionLogIds?: string[];
  size: number | null;
  symbol: string | null;
  timestamp?: string;
  triggerId?: string | null;
};

export type JournalSnapshotCaptureRequest = {
  delayMs?: number;
  frameId: string;
  journalEntryId: string;
  maxAttempts?: number;
  pnl?: number | null;
  price?: number | null;
  retryDelayMs?: number;
  size?: number | null;
};

type RandomUuid = () => string;

function createRandomUUID() {
  return globalThis.crypto.randomUUID();
}

export function createJournalReplayFrame(details: {
  event: JournalReplayFrameEvent;
  journalEntryId: string;
  pnl?: number | null;
  price?: number | null;
  randomUUID?: RandomUuid;
  size?: number | null;
  status?: JournalReplayFramePlan["status"];
  storageKey?: string | null;
  timestamp?: string;
}): JournalReplayFramePlan {
  return {
    capturedAt: details.timestamp ?? new Date().toISOString(),
    event: details.event,
    id: `replay-${details.event}-${(details.randomUUID ?? createRandomUUID)()}`,
    journalEntryId: details.journalEntryId,
    pnl: details.pnl ?? null,
    price: details.price ?? null,
    size: details.size ?? null,
    status: details.status ?? "planned",
    storageKey: details.storageKey ?? null,
  };
}

export function createJournalReplayMetadata(
  timestamp: string,
  journalEntryId: string,
  details: {
    captureIntervalTargetSeconds: number;
    pnl?: number | null;
    price?: number | null;
    randomUUID?: RandomUuid;
    size?: number | null;
  },
): JournalReplayMetadata {
  return {
    captureIntervalTargetSeconds: details.captureIntervalTargetSeconds,
    finalTimelineMaxFrames: 15,
    frames: [
      createJournalReplayFrame({
        event: "entry",
        journalEntryId,
        pnl: details.pnl,
        price: details.price,
        randomUUID: details.randomUUID,
        size: details.size,
        timestamp,
      }),
    ],
    liveCaptureStoragePreference: "indexeddb-compressed-assets",
    rawFrameCount: 1,
    replayStatus: "capturing",
    savedFrameCount: 0,
    preserveEntryExitFrames: true,
    preserveKeyEventFrames: true,
    timelineDownsampleStrategy: "entry-exit-key-events-even-spacing",
  };
}

export function appendJournalReplayFrameToEntry(
  entry: JournalEntry,
  event: JournalReplayFrameEvent,
  details: {
    pnl?: number | null;
    price?: number | null;
    randomUUID?: RandomUuid;
    size?: number | null;
    status?: JournalReplayFramePlan["status"];
    storageKey?: string | null;
    timestamp?: string;
  } = {},
): { entry: JournalEntry; frame: JournalReplayFramePlan } {
  const frame = createJournalReplayFrame({
    event,
    journalEntryId: entry.id,
    pnl: details.pnl,
    price: details.price,
    randomUUID: details.randomUUID,
    size: details.size,
    status: details.status,
    storageKey: details.storageKey,
    timestamp: details.timestamp,
  });

  return appendJournalReplayFramePlanToEntry(entry, frame);
}

export function appendJournalReplayFramePlanToEntry(
  entry: JournalEntry,
  frame: JournalReplayFramePlan,
): { entry: JournalEntry; frame: JournalReplayFramePlan } {
  return {
    entry: {
      ...entry,
      replayMetadata: {
        ...entry.replayMetadata,
        frames: [...entry.replayMetadata.frames, frame],
        rawFrameCount: entry.replayMetadata.frames.length + 1,
        replayStatus: "capturing",
      },
    },
    frame,
  };
}

export function appendJournalExitReplayFrameToEntry(
  entry: JournalEntry,
  details: {
    pnl?: number | null;
    price?: number | null;
    randomUUID?: RandomUuid;
    size?: number | null;
    timestamp?: string;
  },
) {
  return appendJournalReplayFrameToEntry(entry, "exit", details);
}

export function updateJournalReplayFrameForEntry(
  entry: JournalEntry,
  frameId: string,
  updater: (frame: JournalReplayFramePlan) => JournalReplayFramePlan,
) {
  return {
    ...entry,
    replayMetadata: {
      ...entry.replayMetadata,
      frames: entry.replayMetadata.frames.map((frame) =>
        frame.id === frameId ? updater(frame) : frame,
      ),
    },
  };
}

export function getReplayFrameEventLabel(event: JournalReplayFrameEvent) {
  switch (event) {
    case "entry":
      return "Entry";
    case "periodic":
      return "Periodic";
    case "protection-attached":
      return "Protection";
    case "protection-updated":
      return "Protection Update";
    case "partial-close":
      return "Partial Close";
    case "break-even":
      return "Break-even";
    case "stop-moved":
      return "Stop Moved";
    case "tp-moved":
      return "TP Moved";
    case "reverse":
      return "Reverse";
    case "close-all":
      return "Close All";
    case "exit":
      return "Exit";
    default:
      return "Frame";
  }
}

export function getReplayTargetFrameCount(durationMinutes: number) {
  if (durationMinutes < 5) {
    return 5;
  }

  if (durationMinutes < 30) {
    return 10;
  }

  return 15;
}

export function getJournalEntryClassification(
  details: JournalEntryClassificationInput,
): {
  entrySource: JournalEntrySource;
  entryStyle: JournalEntryStyle;
} {
  if (details.triggerSource === "market-manual") {
    return {
      entrySource: "Market",
      entryStyle: "Chased",
    };
  }

  if (details.triggerCondition === "touch") {
    return {
      entrySource: "Touch Trigger",
      entryStyle: "Hunted",
    };
  }

  if (
    details.triggerCondition === "close-above" ||
    details.triggerCondition === "close-below"
  ) {
    return {
      entrySource: "Close Trigger",
      entryStyle: "Hunted",
    };
  }

  if (details.orderSource === "mid-zone") {
    return {
      entrySource: "Mid-Zone",
      entryStyle: "Hunted",
    };
  }

  if (details.orderSource === "order-zone") {
    return {
      entrySource: "Order Zone",
      entryStyle: "Hunted",
    };
  }

  if (
    details.orderSource === "horizontal-line" ||
    details.triggerSource === "pending-limit"
  ) {
    return {
      entrySource: "Limit",
      entryStyle: "Hunted",
    };
  }

  return {
    entrySource: "Other",
    entryStyle: "Chased",
  };
}

export function buildOpenedJournalEntryCapture(
  details: JournalTradeCaptureDetails,
  context: {
    activeChartTimeframe: ChartTimeframe;
    captureIntervalTargetSeconds: number;
    disciplineRulesSnapshot: string[];
    nowMs?: number;
    randomUUID?: RandomUuid;
  },
) {
  const timestamp = details.timestamp ?? new Date().toISOString();
  const nowMs = context.nowMs ?? Date.now();
  const randomUUID = context.randomUUID ?? createRandomUUID;
  const nextEntryId = `journal-${nowMs}-${randomUUID()}`;
  const entryFrame = createJournalReplayFrame({
    event: "entry",
    journalEntryId: nextEntryId,
    price: details.entryPrice,
    randomUUID,
    size: details.size,
    timestamp,
  });
  const baseEntry: JournalEntry = {
    confidenceRating: null,
    direction: details.direction,
    disciplineRulesSnapshot: context.disciplineRulesSnapshot,
    entrySource: details.entrySource,
    entryStyle: details.entryStyle,
    exitReason: null,
    timeframe: context.activeChartTimeframe,
    emotionState: "",
    entryPrice: details.entryPrice,
    exitPrice: null,
    id: nextEntryId,
    isCustomSetupTag: false,
    lessonLearned: "",
    mistakeMade: "",
    realizedPnl: null,
    relatedSessionLogIds: details.relatedSessionLogIds ?? [],
    replayMetadata: {
      ...createJournalReplayMetadata(timestamp, nextEntryId, {
        captureIntervalTargetSeconds: context.captureIntervalTargetSeconds,
        price: details.entryPrice,
        randomUUID,
        size: details.size,
      }),
      frames: [entryFrame],
    },
    planFollowed: null,
    setupQualityRating: null,
    setupCapturedAt: null,
    setupStatus: "pending",
    setupTag: null,
    setupType: "",
    size: details.size,
    status: "open",
    symbol: details.symbol,
    thesis: "",
    timestamp,
    updatedAt: timestamp,
  };
  let entry = createJournalEntryForOpenedTrade({
    baseEntry,
    clientOrderId: details.clientOrderId,
    executionId: details.executionId,
    fees: details.fees,
    magicTradeRuleId: details.magicTradeRuleId,
    orderId: details.orderId,
    orderZoneId: details.orderZoneId,
    relatedSessionLogIds: details.relatedSessionLogIds,
    timestamp,
    triggerId: details.triggerId,
  });
  details.additionalOrderFills?.forEach((fill) => {
    entry = updateJournalEntryForOrderFilledTrade(entry, fill);
  });

  const primaryTradeSessionLogId =
    details.relatedSessionLogIds?.[details.relatedSessionLogIds.length - 1];
  const tradeOpenedMemoryEvent = linkMemoryEventToJournalEntry(
    {
      id: `journal-memory:trade_opened:${primaryTradeSessionLogId ?? entry.id}`,
      message: "Trade opened and attached to Journal memory.",
      metadata: {
        entrySource: details.entrySource,
        entryStyle: details.entryStyle,
        clientOrderId: details.clientOrderId ?? null,
        executionId: details.executionId ?? null,
        magicTradeRuleId: details.magicTradeRuleId ?? null,
        orderId: details.orderId ?? null,
        orderZoneId: details.orderZoneId ?? null,
        openedAt: entry.openedAt ?? timestamp,
        triggerId: details.triggerId ?? null,
        ...details.metadata,
      },
      sessionLogId: primaryTradeSessionLogId,
      side: details.direction ?? undefined,
      source: "execution",
      symbol: details.symbol ?? undefined,
      timestamp,
      title: "Trade opened",
      type: "trade_opened",
    },
    entry,
  );
  const orderFilledMemoryEvent =
    details.executionId &&
    (details.entrySource === "Limit" ||
      details.entrySource === "Mid-Zone" ||
      details.entrySource === "Order Zone")
      ? linkMemoryEventToJournalEntry(
          {
            id: `journal-memory:order_filled:${details.executionId}`,
            message: "Order fill attached to Journal memory.",
            metadata: {
              entrySource: details.entrySource,
              entryStyle: details.entryStyle,
              clientOrderId: details.clientOrderId ?? null,
              executionId: details.executionId,
              magicTradeRuleId: details.magicTradeRuleId ?? null,
              orderId: details.orderId ?? null,
              orderZoneId: details.orderZoneId ?? null,
              triggerId: details.triggerId ?? null,
              ...details.metadata,
            },
            side: details.direction ?? undefined,
            source: "execution",
            symbol: details.symbol ?? undefined,
            timestamp,
            title: "Order filled",
            type: "order_filled",
          },
          entry,
        )
      : null;

  return {
    entry,
    entryFrame,
    memoryEvents: orderFilledMemoryEvent
      ? [tradeOpenedMemoryEvent, orderFilledMemoryEvent]
      : [tradeOpenedMemoryEvent],
    snapshotRequest: {
      frameId: entryFrame.id,
      journalEntryId: nextEntryId,
      price: details.entryPrice,
      size: details.size,
    } satisfies JournalSnapshotCaptureRequest,
  };
}

export function buildOrderFilledMemoryEventForActiveEntry(
  details: JournalTradeCaptureDetails,
  activeEntry: JournalEntry,
  context: {
    nowMs?: number;
  } = {},
): JournalMemoryEvent {
  const timestamp = details.timestamp ?? new Date().toISOString();

  return linkMemoryEventToJournalEntry(
    {
      id: `journal-memory:order_filled:${details.executionId ?? details.orderId ?? context.nowMs ?? Date.now()}`,
      message: "Order fill attached to active Journal trade.",
      metadata: {
        clientOrderId: details.clientOrderId ?? null,
        executionId: details.executionId ?? null,
        orderId: details.orderId ?? null,
        orderZoneId: details.orderZoneId ?? null,
        ...details.metadata,
      },
      sessionLogId:
        details.relatedSessionLogIds?.[
          details.relatedSessionLogIds.length - 1
        ],
      side: details.direction ?? undefined,
      source: "execution",
      symbol: details.symbol ?? undefined,
      timestamp,
      title: "Order filled",
      type: "order_filled",
    },
    activeEntry,
  );
}

export function resolveOpenJournalEntryForTradeFill(
  entries: JournalEntry[],
  details: Pick<JournalTradeCaptureDetails, "direction" | "symbol">,
) {
  if (!details.symbol || !details.direction) {
    return null;
  }

  return (
    entries.find(
      (entry) =>
        entry.status === "open" &&
        entry.symbol === details.symbol &&
        entry.direction === details.direction,
    ) ?? null
  );
}

export function resolveCloseAllJournalEntryTargets(
  entries: JournalEntry[],
  positions: Array<{ symbol?: string | null }>,
) {
  const openJournalSymbols = new Set(
    entries
      .filter((entry) => entry.status === "open" && entry.symbol)
      .map((entry) => entry.symbol as string),
  );
  const seenSymbols = new Set<string>();

  return positions.flatMap((position) => {
    if (!position.symbol || seenSymbols.has(position.symbol)) {
      return [];
    }

    seenSymbols.add(position.symbol);
    return openJournalSymbols.has(position.symbol) ? [position.symbol] : [];
  });
}

export function commitJournalEntriesRefUpdate(
  entriesRef: { current: JournalEntry[] },
  currentEntries: JournalEntry[],
  updater: (entries: JournalEntry[]) => JournalEntry[],
) {
  const nextEntries = updater(currentEntries);
  entriesRef.current = nextEntries;
  return nextEntries;
}

export function resolveJournalSetupGateFooterTransition<Tab extends string>({
  gateActive,
  returnTab,
  selectedFooterTab,
  tradeTab,
}: {
  gateActive: boolean;
  returnTab: Tab | null;
  selectedFooterTab: Tab;
  tradeTab: Tab;
}) {
  if (!gateActive || selectedFooterTab === tradeTab) {
    return {
      returnTab,
      selectedFooterTab,
    };
  }

  return {
    returnTab: returnTab ?? selectedFooterTab,
    selectedFooterTab: tradeTab,
  };
}

export function updateLatestOpenJournalEntryForSymbol(
  entries: JournalEntry[],
  symbol: string,
  updater: (entry: JournalEntry) => JournalEntry,
  updatedAt: string,
) {
  const targetIndex = entries.findIndex(
    (entry) => entry.symbol === symbol && entry.status === "open",
  );

  if (targetIndex === -1) {
    return entries;
  }

  const nextEntries = [...entries];
  nextEntries[targetIndex] = {
    ...updater(nextEntries[targetIndex]),
    updatedAt,
  };
  return nextEntries;
}
