import type { JournalMemoryEvent } from "./journal-memory-events";

export type TradeMemoryGroupId = "trade-actions" | "discipline" | "ai-coach" | "protection-plan";

export type TradeMemoryGroup = {
  events: JournalMemoryEvent[];
  id: TradeMemoryGroupId;
  label: string;
};

export type TradeReviewFlags = {
  aiWarned: boolean;
  warningDismissed: boolean;
  disciplineBlockedAction: boolean;
  overrideBondPosted: boolean;
  repeatedOverride: boolean;
  ruleRespectedNoOverride: boolean;
  magicTradeInvolved: boolean;
  triggerInvolved: boolean;
};

export type TradeMemoryRow = {
  detail: string | null;
  event: JournalMemoryEvent;
  label: string;
  sessionLogId: string | null;
  tone: "neutral" | "ai" | "discipline" | "warning";
};

export const TRADE_MEMORY_GROUPS: Array<{ id: TradeMemoryGroupId; label: string; types: Set<JournalMemoryEvent["type"]> }> = [
  {
    id: "trade-actions",
    label: "Trade Actions",
    types: new Set([
      "trade_opened",
      "trade_reduced",
      "trade_closed",
      "trade_reversed",
      "order_filled",
      "magic_trade_executed",
      "trigger_fired",
    ]),
  },
  {
    id: "discipline",
    label: "Discipline",
    types: new Set([
      "discipline_rule_blocked",
      "discipline_rule_edit_blocked",
      "discipline_override_bond_posted",
      "no_trade_session",
    ]),
  },
  {
    id: "ai-coach",
    label: "AI Coach",
    types: new Set(["ai_warning_shown", "ai_warning_dismissed", "ai_warning_respected", "ai_warning_ignored"]),
  },
  {
    id: "protection-plan",
    label: "Protection / Plan",
    types: new Set(["protection_added", "protection_updated", "protection_removed", "plan_created", "plan_changed"]),
  },
];

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumber(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return isNumber(value) ? value : null;
}

function getOverrideCount(event: JournalMemoryEvent) {
  return (
    getNumber(event.metadata, "overrideCountToday") ??
    getNumber(event.metadata, "overrideCount") ??
    getNumber(event.metadata, "previousOverrideCount") ??
    null
  );
}

export function getTradeMemoryEventsForEntry(events: JournalMemoryEvent[], entry: { id: string; relatedSessionLogIds?: string[] }) {
  const relatedSessionLogIds = new Set(entry.relatedSessionLogIds ?? []);

  return events
    .filter(
      (event) =>
        event.journalEntryId === entry.id ||
        event.tradeId === entry.id ||
        (event.sessionLogId ? relatedSessionLogIds.has(event.sessionLogId) : false),
    )
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function groupTradeMemoryEvents(events: JournalMemoryEvent[]): TradeMemoryGroup[] {
  return TRADE_MEMORY_GROUPS.map((group) => ({
    events: events.filter((event) => group.types.has(event.type)),
    id: group.id,
    label: group.label,
  }));
}

export function deriveTradeReviewFlags(events: JournalMemoryEvent[]): TradeReviewFlags {
  const hasAiWarning = events.some((event) => event.type === "ai_warning_shown");
  const hasWarningDismissed = events.some((event) => event.type === "ai_warning_dismissed" || event.type === "ai_warning_ignored");
  const hasDisciplineBlock = events.some(
    (event) => event.type === "discipline_rule_blocked" || event.type === "discipline_rule_edit_blocked",
  );
  const overrideEvents = events.filter((event) => event.type === "discipline_override_bond_posted");
  const hasOverrideBond = overrideEvents.length > 0;
  const repeatedOverride =
    overrideEvents.length > 1 || overrideEvents.some((event) => (getOverrideCount(event) ?? 0) > 1);

  return {
    aiWarned: hasAiWarning,
    warningDismissed: hasWarningDismissed,
    disciplineBlockedAction: hasDisciplineBlock,
    overrideBondPosted: hasOverrideBond,
    repeatedOverride,
    ruleRespectedNoOverride: hasDisciplineBlock && !hasOverrideBond,
    magicTradeInvolved: events.some((event) => event.type === "magic_trade_executed"),
    triggerInvolved: events.some((event) => event.type === "trigger_fired"),
  };
}

export function formatTradeMemoryEvent(event: JournalMemoryEvent): TradeMemoryRow {
  const symbol = event.symbol ? `${event.symbol} ` : "";
  const side = event.side ? `${event.side} ` : "";
  const baseDetail = event.message ?? event.title ?? null;

  switch (event.type) {
    case "trade_opened":
      return { detail: baseDetail, event, label: `Opened ${symbol}${side}trade`.trim(), sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "trade_reduced":
      return { detail: baseDetail, event, label: `Reduced ${symbol}${side}trade`.trim(), sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "trade_closed":
      return { detail: baseDetail, event, label: `Closed ${symbol}${side}trade`.trim(), sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "trade_reversed":
      return { detail: baseDetail, event, label: `Reversed ${symbol}${side}trade`.trim(), sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "order_filled":
      return { detail: baseDetail, event, label: `Order filled${symbol ? `: ${symbol.trim()}` : ""}`, sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "magic_trade_executed":
      return { detail: baseDetail, event, label: `Magic Trade executed${symbol ? `: ${symbol.trim()}` : ""}`, sessionLogId: event.sessionLogId ?? null, tone: "ai" };
    case "trigger_fired":
      return { detail: baseDetail, event, label: `Trigger fired${symbol ? `: ${symbol.trim()}` : ""}`, sessionLogId: event.sessionLogId ?? null, tone: "ai" };
    case "discipline_rule_blocked": {
      const reason = getString(event.metadata, "reasonCode") ?? event.message ?? "rule active";
      return { detail: baseDetail, event, label: `Discipline blocked action: ${reason}`, sessionLogId: event.sessionLogId ?? null, tone: "discipline" };
    }
    case "discipline_rule_edit_blocked": {
      const reason = getString(event.metadata, "reasonCode") ?? event.message ?? "rule edit blocked";
      return { detail: baseDetail, event, label: `Discipline blocked rule edit: ${reason}`, sessionLogId: event.sessionLogId ?? null, tone: "discipline" };
    }
    case "discipline_override_bond_posted": {
      const amount = getNumber(event.metadata, "finalAmountUsdc");
      const multiplier = getNumber(event.metadata, "multiplier");
      const vault = getNumber(event.metadata, "vaultAmountUsdc");
      const portal = getNumber(event.metadata, "portalAmountUsdc");
      const reserve = getNumber(event.metadata, "reserveAmountUsdc");
      const split =
        vault !== null || portal !== null || reserve !== null
          ? `split ${vault ?? 0} vault / ${portal ?? 0} Portal / ${reserve ?? 0} reserve`
          : null;
      const summary = [amount !== null ? `${amount} USDC` : null, multiplier !== null ? `${multiplier}x multiplier` : null, split]
        .filter(Boolean)
        .join(", ");
      return {
        detail: summary || baseDetail,
        event,
        label: "Override Bond posted",
        sessionLogId: event.sessionLogId ?? null,
        tone: "warning",
      };
    }
    case "ai_warning_shown":
      return { detail: event.message ?? null, event, label: `AI warned: ${event.title ?? "Warning shown"}`, sessionLogId: event.sessionLogId ?? null, tone: "ai" };
    case "ai_warning_dismissed":
      return { detail: event.message ?? null, event, label: `AI warning dismissed: ${event.title ?? "Warning dismissed"}`, sessionLogId: event.sessionLogId ?? null, tone: "ai" };
    case "ai_warning_respected":
      return { detail: baseDetail, event, label: "AI warning respected", sessionLogId: event.sessionLogId ?? null, tone: "ai" };
    case "ai_warning_ignored":
      return { detail: baseDetail, event, label: "AI warning ignored", sessionLogId: event.sessionLogId ?? null, tone: "ai" };
    case "no_trade_session":
      return { detail: baseDetail, event, label: `No-trade session${symbol ? `: ${symbol.trim()}` : ""}`, sessionLogId: event.sessionLogId ?? null, tone: "discipline" };
    case "plan_created":
      return { detail: baseDetail, event, label: "Plan created", sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "plan_changed":
      return { detail: baseDetail, event, label: "Plan changed", sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "protection_added":
      return { detail: baseDetail, event, label: "Protection added", sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "protection_updated":
      return { detail: baseDetail, event, label: "Protection updated", sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
    case "protection_removed":
      return { detail: baseDetail, event, label: "Protection removed", sessionLogId: event.sessionLogId ?? null, tone: "neutral" };
  }
}
