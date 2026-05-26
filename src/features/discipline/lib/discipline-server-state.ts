import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ChartZone } from "@/features/chart/types";
import type {
  DisciplineRiskGateOrderSnapshot,
  DisciplineRiskGateRules,
  DisciplineRiskGateTracking,
  MarketEntryConfirmationRule,
} from "@/features/discipline/lib/discipline-risk-gate";
import type { HyperliquidSymbol } from "@/types/market";
import type { ChartTradePlan, TradeDirection } from "@/types/trade";
import { getOverrideBondPreview } from "@/features/discipline/lib/override-bond-ledger";
import {
  deriveBlockedTimeWindowRuleState,
  type BlockedTimeWindowRule,
} from "@/features/discipline/lib/discipline-time-window";
import {
  DEFAULT_REQUIRE_PROTECTION_RULE,
  isRequireProtectionWeakened,
  sanitizeRequireProtectionRule,
  type RequireProtectionRule,
} from "@/features/discipline/lib/discipline-protection";

export type ServerDisciplineTracking = DisciplineRiskGateTracking & {
  dayKey: string;
  lastLosingTradeAt: string | null;
};

export type ServerDisciplineNoTradeZone = Pick<
  ChartZone,
  "bottomPrice" | "id" | "isNoTrade" | "symbol" | "topPrice"
>;

export type ServerDisciplinePendingOrder = DisciplineRiskGateOrderSnapshot & {
  symbol?: HyperliquidSymbol | string | null;
};

export type DisciplineRuleState =
  | "inactive"
  | "active"
  | "armed"
  | "triggered"
  | "locked"
  | "overridden";

export type DisciplineRuleType =
  | "blocked_time_window"
  | "cooldown_after_loss"
  | "max_daily_loss"
  | "max_trades_per_day"
  | "min_risk_reward"
  | "no_trade_zone"
  | "require_protection";

export type ServerDisciplineRuleStateEntry = {
  reasonCode?: string;
  ruleType: DisciplineRuleType;
  state: DisciplineRuleState;
};

export type ServerDisciplineRuleStates = {
  blockedTimeWindows: Record<string, ServerDisciplineRuleStateEntry>;
  cooldownAfterLossMinutes: ServerDisciplineRuleStateEntry;
  maxDailyLoss: ServerDisciplineRuleStateEntry;
  maxTradesPerDay: ServerDisciplineRuleStateEntry;
  minRiskReward: ServerDisciplineRuleStateEntry;
  noTradeZones: Record<string, ServerDisciplineRuleStateEntry>;
  requireProtection: ServerDisciplineRuleStateEntry;
};

export type OverrideBondLabel = "soft" | "serious" | "heavy" | "nuclear" | "custom";

export type ServerDisciplineOverrideBondConfig = {
  enabled: boolean;
  baseAmountUsdc: number;
  label: OverrideBondLabel;
};

export type ServerDisciplineOverrideBondConfigs = {
  blockedTimeWindows: Record<string, ServerDisciplineOverrideBondConfig>;
  cooldownAfterLossMinutes: ServerDisciplineOverrideBondConfig;
  maxDailyLoss: ServerDisciplineOverrideBondConfig;
  maxTradesPerDay: ServerDisciplineOverrideBondConfig;
  minRiskReward: ServerDisciplineOverrideBondConfig;
  noTradeZones: Record<string, ServerDisciplineOverrideBondConfig>;
  requireProtection: ServerDisciplineOverrideBondConfig;
};

export type ServerDisciplineState = {
  activeTradePlan: Pick<ChartTradePlan, "entry" | "id" | "stop" | "symbol" | "target"> | null;
  blockedTimeWindows: BlockedTimeWindowRule[];
  disciplineLocked: boolean;
  marketEntryConfirmation: MarketEntryConfirmationRule;
  noTradeZones: ServerDisciplineNoTradeZone[];
  overrideBondConfigs: ServerDisciplineOverrideBondConfigs;
  pendingOrders: ServerDisciplinePendingOrder[];
  requireProtection: RequireProtectionRule;
  rules: DisciplineRiskGateRules;
  ruleStates: ServerDisciplineRuleStates;
  source: ServerDisciplineStateSource;
  tracking: ServerDisciplineTracking;
  updatedAt: string;
  version: number;
  walletAddress?: string;
};

export type ServerDisciplineStateSource = "client_sync" | "server_gate" | "manual_test" | "system";
export type ServerDisciplineSyncIntent = "tracking_update" | "rule_update" | "hydration" | "system";

export type ServerDisciplineSyncPayload = Partial<ServerDisciplineState> & {
  syncIntent?: ServerDisciplineSyncIntent;
};

export type ServerDisciplineSyncResult = {
  accepted: boolean;
  clientVersion: number | null;
  message: string;
  overrideBondPreview?: {
    baseAmountUsdc: number;
    finalAmountUsdc: number;
    multiplier: number;
    portalAmountUsdc: number;
    reserveAmountUsdc: number;
    vaultAmountUsdc: number;
  };
  overrideBondRequired?: boolean;
  reasonCode?:
    | "discipline_state_weaken_attempt"
    | "discipline_state_hydration_read_only"
    | "locked_rule_cannot_be_weakened";
  ruleEditLogEntry?: ServerDisciplineRuleEditBlockedLogEntry;
  serverVersion: number;
  state: ServerDisciplineState;
};

export type ServerDisciplineRuleEditBlockedLogEntry = {
  category: "discipline";
  currentState: "locked";
  eventType: "discipline-rule-edit-blocked";
  message: "Rule locked. Override Bond required to weaken this rule.";
  reasonCode: "locked_rule_cannot_be_weakened";
  ruleId: string;
  ruleType: DisciplineRuleType;
};

const DEFAULT_STATE_FILE = join(process.cwd(), ".portal", "discipline-state.json");

export const DEFAULT_MARKET_ENTRY_CONFIRMATION_RULE: MarketEntryConfirmationRule = {
  enabled: false,
  mode: "confirm_required",
  state: "inactive",
};

export function getServerDisciplineStatePath() {
  return process.env.PORTAL_DISCIPLINE_STATE_PATH || DEFAULT_STATE_FILE;
}

export function createDefaultServerDisciplineState(): ServerDisciplineState {
  return {
    activeTradePlan: null,
    blockedTimeWindows: [],
    disciplineLocked: false,
    marketEntryConfirmation: DEFAULT_MARKET_ENTRY_CONFIRMATION_RULE,
    noTradeZones: [],
    overrideBondConfigs: createDefaultServerDisciplineOverrideBondConfigs(),
    pendingOrders: [],
    requireProtection: DEFAULT_REQUIRE_PROTECTION_RULE,
    rules: {
      cooldownAfterLossMinutes: null,
      maxDailyLoss: null,
      maxTradesPerDay: null,
      minRiskReward: null,
    },
    ruleStates: createDefaultServerDisciplineRuleStates(),
    source: "system",
    tracking: createEmptyServerDisciplineTracking(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

export async function readServerDisciplineState() {
  try {
    const rawState = await readFile(getServerDisciplineStatePath(), "utf8");
    return getFreshServerDisciplineState(sanitizeServerDisciplineState(JSON.parse(rawState)));
  } catch {
    return createDefaultServerDisciplineState();
  }
}

export async function writeServerDisciplineState(nextState: Partial<ServerDisciplineState>) {
  const state = getFreshServerDisciplineState(sanitizeServerDisciplineState({
    ...nextState,
    source: nextState.source ?? "system",
  }));
  await persistServerDisciplineState(state);

  return state;
}

export async function syncServerDisciplineState(
  payload: ServerDisciplineSyncPayload,
): Promise<ServerDisciplineSyncResult> {
  const syncIntent = sanitizeSyncIntent(payload.syncIntent);

  if (syncIntent === "system" || payload.syncIntent === undefined) {
    const currentState = await readServerDisciplineState();
    const state = getFreshServerDisciplineState(sanitizeServerDisciplineState({
      ...payload,
      source: payload.source ?? (payload.syncIntent === undefined ? "manual_test" : "system"),
      updatedAt: new Date().toISOString(),
      version: Math.max(payload.version ?? 0, currentState.version + 1),
    }));
    await persistServerDisciplineState(state);

    return {
      accepted: true,
      clientVersion: payload.version ?? null,
      message: "Discipline state accepted.",
      serverVersion: state.version,
      state,
    };
  }

  const currentState = await readServerDisciplineState();
  const clientVersion = typeof payload.version === "number" && Number.isFinite(payload.version)
    ? Math.floor(payload.version)
    : null;

  if (syncIntent === "hydration") {
    return {
      accepted: false,
      clientVersion,
      message: "Discipline state hydration is read-only.",
      reasonCode: "discipline_state_hydration_read_only",
      serverVersion: currentState.version,
      state: currentState,
    };
  }

  if (clientVersion !== null && clientVersion < currentState.version) {
    return rejectWeakenedSync(currentState, clientVersion);
  }

  const clientState = getFreshServerDisciplineState(sanitizeServerDisciplineState({
    ...currentState,
    ...payload,
    source: "client_sync",
    updatedAt: new Date().toISOString(),
    version: currentState.version + 1,
  }));

  const lockedRuleEdit = getLockedRuleWeakeningAttempt(currentState, clientState);
  if (lockedRuleEdit) {
    return await rejectLockedRuleEdit(currentState, clientVersion, lockedRuleEdit);
  }

  if (doesClientWeakenServerState(currentState, clientState)) {
    return rejectWeakenedSync(currentState, clientVersion);
  }

  await persistServerDisciplineState(clientState);

  return {
    accepted: true,
    clientVersion,
    message: "Discipline state accepted.",
    serverVersion: clientState.version,
    state: clientState,
  };
}

export function deriveServerDisciplineRuleStates(
  state: ServerDisciplineState,
  context: {
    now?: Date;
    prices?: number[];
    symbol?: HyperliquidSymbol | string | null;
  } = {},
): ServerDisciplineRuleStates {
  const currentStates = state.ruleStates ?? createDefaultServerDisciplineRuleStates();

  return {
    blockedTimeWindows: deriveBlockedTimeWindowRuleStates(
      state,
      context.now,
      currentStates.blockedTimeWindows,
    ),
    cooldownAfterLossMinutes: deriveRuleStateEntry(
      currentStates.cooldownAfterLossMinutes,
      "cooldown_after_loss",
      state.rules.cooldownAfterLossMinutes === null
        ? "inactive"
        : state.tracking.cooldownRemainingMs > 0
          ? "locked"
          : "active",
      state.tracking.cooldownRemainingMs > 0 ? "cooldown_active" : undefined,
    ),
    maxDailyLoss: deriveRuleStateEntry(
      currentStates.maxDailyLoss,
      "max_daily_loss",
      state.rules.maxDailyLoss === null
        ? "inactive"
        : isMaxDailyLossHit(state)
          ? "locked"
          : "active",
      isMaxDailyLossHit(state) ? "max_daily_loss_hit" : undefined,
    ),
    maxTradesPerDay: deriveRuleStateEntry(
      currentStates.maxTradesPerDay,
      "max_trades_per_day",
      state.rules.maxTradesPerDay === null
        ? "inactive"
        : state.tracking.tradesPlacedToday >= state.rules.maxTradesPerDay
          ? "locked"
          : "active",
      state.rules.maxTradesPerDay !== null &&
        state.tracking.tradesPlacedToday >= state.rules.maxTradesPerDay
        ? "max_trades_per_day_hit"
        : undefined,
    ),
    minRiskReward: deriveRuleStateEntry(
      currentStates.minRiskReward,
      "min_risk_reward",
      state.rules.minRiskReward === null
        ? "inactive"
        : state.activeTradePlan &&
            getTradePlanRiskReward(state.activeTradePlan) < state.rules.minRiskReward
          ? "locked"
          : "active",
      state.rules.minRiskReward !== null &&
        state.activeTradePlan &&
        getTradePlanRiskReward(state.activeTradePlan) < state.rules.minRiskReward
        ? "min_rr_failed"
        : undefined,
    ),
    noTradeZones: deriveNoTradeZoneRuleStates(state, context, currentStates.noTradeZones),
    requireProtection: deriveRuleStateEntry(
      currentStates.requireProtection,
      "require_protection",
      state.requireProtection.enabled
        ? state.ruleStates.requireProtection.state === "overridden"
          ? "overridden"
          : state.requireProtection.state === "locked"
            ? "locked"
            : "active"
        : "inactive",
      state.requireProtection.enabled ? "protection_required" : undefined,
    ),
  };
}

async function persistServerDisciplineState(state: ServerDisciplineState) {
  const filePath = getServerDisciplineStatePath();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tempPath, filePath);
}

export async function recordServerDisciplineTradesPlaced(count: number) {
  if (!Number.isFinite(count) || count <= 0) {
    return readServerDisciplineState();
  }

  const currentState = await readServerDisciplineState();
  return writeServerDisciplineState({
    ...currentState,
    source: "server_gate",
    updatedAt: new Date().toISOString(),
    version: currentState.version + 1,
    tracking: {
      ...currentState.tracking,
      tradesPlacedToday: currentState.tracking.tradesPlacedToday + Math.floor(count),
    },
  });
}

export function isServerDisciplinePriceInsideNoTradeZone(
  state: ServerDisciplineState,
  symbol: HyperliquidSymbol | string | null | undefined,
  price: number,
) {
  if (!symbol || !Number.isFinite(price)) {
    return false;
  }

  return state.noTradeZones.some((zone) => {
    if (!zone.isNoTrade || zone.symbol !== symbol) {
      return false;
    }

    const low = Math.min(zone.bottomPrice, zone.topPrice);
    const high = Math.max(zone.bottomPrice, zone.topPrice);

    return price >= low && price <= high;
  });
}

export function findServerDisciplinePendingOrder(
  state: ServerDisciplineState,
  order: { id?: string | null; orderId?: number | null },
) {
  return state.pendingOrders.find((pendingOrder) => {
    if (order.id && pendingOrder.id === order.id) {
      return true;
    }

    return (
      order.orderId !== null &&
      order.orderId !== undefined &&
      pendingOrder.orderId === order.orderId
    );
  }) ?? null;
}

function createEmptyServerDisciplineTracking(): ServerDisciplineTracking {
  return {
    cooldownRemainingMs: 0,
    dayKey: createTodayKey(),
    lastLosingTradeAt: null,
    realizedPnlToday: 0,
    tradesPlacedToday: 0,
  };
}

function createDefaultServerDisciplineRuleStates(): ServerDisciplineRuleStates {
  return {
    blockedTimeWindows: {},
    cooldownAfterLossMinutes: {
      ruleType: "cooldown_after_loss",
      state: "inactive",
    },
    maxDailyLoss: {
      ruleType: "max_daily_loss",
      state: "inactive",
    },
    maxTradesPerDay: {
      ruleType: "max_trades_per_day",
      state: "inactive",
    },
    minRiskReward: {
      ruleType: "min_risk_reward",
      state: "inactive",
    },
    noTradeZones: {},
    requireProtection: {
      ruleType: "require_protection",
      state: "inactive",
    },
  };
}

export function createDefaultServerDisciplineOverrideBondConfig(
  label: OverrideBondLabel = "serious",
  baseAmountUsdc = 25,
): ServerDisciplineOverrideBondConfig {
  return {
    enabled: true,
    baseAmountUsdc,
    label,
  };
}

export function createDefaultServerDisciplineOverrideBondConfigs(): ServerDisciplineOverrideBondConfigs {
  return {
    blockedTimeWindows: {},
    cooldownAfterLossMinutes: createDefaultServerDisciplineOverrideBondConfig(),
    maxDailyLoss: createDefaultServerDisciplineOverrideBondConfig(),
    maxTradesPerDay: createDefaultServerDisciplineOverrideBondConfig(),
    minRiskReward: createDefaultServerDisciplineOverrideBondConfig(),
    noTradeZones: {},
    requireProtection: createDefaultServerDisciplineOverrideBondConfig(),
  };
}

function sanitizeServerDisciplineState(input: unknown): ServerDisciplineState {
  const partialState = input && typeof input === "object" ? input as Partial<ServerDisciplineState> : {};
  const defaultState = createDefaultServerDisciplineState();
  const baseState = {
    activeTradePlan: sanitizeTradePlan(partialState.activeTradePlan),
    blockedTimeWindows: Array.isArray(partialState.blockedTimeWindows)
      ? partialState.blockedTimeWindows.flatMap(sanitizeBlockedTimeWindow)
      : [],
    disciplineLocked: partialState.disciplineLocked === true,
    marketEntryConfirmation: sanitizeMarketEntryConfirmationRule(partialState.marketEntryConfirmation),
    noTradeZones: Array.isArray(partialState.noTradeZones)
      ? partialState.noTradeZones.flatMap(sanitizeNoTradeZone)
      : [],
    overrideBondConfigs: sanitizeOverrideBondConfigs(partialState.overrideBondConfigs),
    pendingOrders: Array.isArray(partialState.pendingOrders)
      ? partialState.pendingOrders.flatMap(sanitizePendingOrder)
      : [],
    requireProtection: sanitizeRequireProtectionRule(partialState.requireProtection),
    rules: sanitizeRules(partialState.rules),
    ruleStates: sanitizeRuleStates(partialState.ruleStates),
    source: sanitizeStateSource(partialState.source),
    tracking: sanitizeTracking(partialState.tracking),
    updatedAt: typeof partialState.updatedAt === "string" ? partialState.updatedAt : defaultState.updatedAt,
    version:
      typeof partialState.version === "number" && Number.isFinite(partialState.version)
        ? Math.max(1, Math.floor(partialState.version))
        : defaultState.version,
    walletAddress: typeof partialState.walletAddress === "string" ? partialState.walletAddress : undefined,
  };

  return {
    ...baseState,
    ruleStates: deriveServerDisciplineRuleStates(baseState),
  };
}

function sanitizeMarketEntryConfirmationRule(input: unknown): MarketEntryConfirmationRule {
  const partialRule = input && typeof input === "object" && !Array.isArray(input)
    ? input as Partial<MarketEntryConfirmationRule>
    : {};

  return {
    enabled: partialRule.enabled === true,
    mode: partialRule.mode === "warn_only" ? "warn_only" : "confirm_required",
    source:
      partialRule.source === "manual" || partialRule.source === "operator_diagnosis"
        ? partialRule.source
        : undefined,
    sourceFindingId:
      typeof partialRule.sourceFindingId === "string" && partialRule.sourceFindingId.length > 0
        ? partialRule.sourceFindingId
        : undefined,
    state:
      partialRule.state === "triggered" ||
      partialRule.state === "locked" ||
      partialRule.state === "overridden"
        ? partialRule.state
        : partialRule.enabled === true
          ? "active"
          : "inactive",
  };
}

function getFreshServerDisciplineState(state: ServerDisciplineState): ServerDisciplineState {
  const todayKey = createTodayKey();

  if (state.tracking.dayKey !== todayKey) {
    return {
      ...state,
      tracking: createEmptyServerDisciplineTracking(),
      updatedAt: new Date().toISOString(),
      version: state.version + 1,
      ruleStates: deriveServerDisciplineRuleStates({
        ...state,
        tracking: createEmptyServerDisciplineTracking(),
      }),
    };
  }

  const stateWithFreshCooldown = {
    ...state,
    tracking: {
      ...state.tracking,
      cooldownRemainingMs: getServerCooldownRemainingMs(state.rules, state.tracking),
    },
  };

  return {
    ...stateWithFreshCooldown,
    ruleStates: deriveServerDisciplineRuleStates(stateWithFreshCooldown),
  };
}

function rejectWeakenedSync(
  state: ServerDisciplineState,
  clientVersion: number | null,
): ServerDisciplineSyncResult {
  return {
    accepted: false,
    clientVersion,
    message: "Discipline state rejected. Server lock is stricter.",
    reasonCode: "discipline_state_weaken_attempt",
    serverVersion: state.version,
    state,
  };
}

async function rejectLockedRuleEdit(
  state: ServerDisciplineState,
  clientVersion: number | null,
  rule: { ruleId: string; ruleType: DisciplineRuleType },
): Promise<ServerDisciplineSyncResult> {
  const preview = await getOverrideBondPreview({
    ruleId: rule.ruleId,
    ruleType: rule.ruleType,
    state,
  });

  return {
    accepted: false,
    clientVersion,
    message: "Rule locked. Override Bond required to weaken this rule.",
    overrideBondPreview: preview.bond,
    overrideBondRequired: true,
    reasonCode: "locked_rule_cannot_be_weakened",
    ruleEditLogEntry: {
      category: "discipline",
      currentState: "locked",
      eventType: "discipline-rule-edit-blocked",
      message: "Rule locked. Override Bond required to weaken this rule.",
      reasonCode: "locked_rule_cannot_be_weakened",
      ruleId: rule.ruleId,
      ruleType: rule.ruleType,
    },
    serverVersion: state.version,
    state,
  };
}

export function getServerDisciplineRuleStateEntry(
  state: ServerDisciplineState,
  rule: { ruleId?: string; ruleType: DisciplineRuleType },
) {
  switch (rule.ruleType) {
    case "blocked_time_window":
      return rule.ruleId ? state.ruleStates.blockedTimeWindows[rule.ruleId] : undefined;
    case "cooldown_after_loss":
      return state.ruleStates.cooldownAfterLossMinutes;
    case "max_daily_loss":
      return state.ruleStates.maxDailyLoss;
    case "max_trades_per_day":
      return state.ruleStates.maxTradesPerDay;
    case "min_risk_reward":
      return state.ruleStates.minRiskReward;
    case "no_trade_zone":
      return rule.ruleId ? state.ruleStates.noTradeZones[rule.ruleId] : undefined;
    case "require_protection":
      return state.ruleStates.requireProtection;
  }
}

export function getServerDisciplineOverrideBondConfig(
  state: ServerDisciplineState,
  rule: { ruleId?: string; ruleType: DisciplineRuleType },
) {
  switch (rule.ruleType) {
    case "blocked_time_window":
      return rule.ruleId
        ? state.overrideBondConfigs.blockedTimeWindows[rule.ruleId] ?? createDefaultServerDisciplineOverrideBondConfig()
        : createDefaultServerDisciplineOverrideBondConfig();
    case "cooldown_after_loss":
      return state.overrideBondConfigs.cooldownAfterLossMinutes;
    case "max_daily_loss":
      return state.overrideBondConfigs.maxDailyLoss;
    case "max_trades_per_day":
      return state.overrideBondConfigs.maxTradesPerDay;
    case "min_risk_reward":
      return state.overrideBondConfigs.minRiskReward;
    case "no_trade_zone":
      return rule.ruleId
        ? state.overrideBondConfigs.noTradeZones[rule.ruleId] ?? createDefaultServerDisciplineOverrideBondConfig()
        : createDefaultServerDisciplineOverrideBondConfig();
    case "require_protection":
      return state.overrideBondConfigs.requireProtection;
  }
}

export async function markServerDisciplineRuleOverridden(rule: {
  ruleId?: string;
  ruleType: DisciplineRuleType;
}) {
  const currentState = await readServerDisciplineState();
  const nextRuleStates = structuredClone(currentState.ruleStates);
  const entry: ServerDisciplineRuleStateEntry = {
    ruleType: rule.ruleType,
    state: "overridden",
  };

  switch (rule.ruleType) {
    case "blocked_time_window":
      if (rule.ruleId) {
        nextRuleStates.blockedTimeWindows[rule.ruleId] = entry;
      }
      break;
    case "cooldown_after_loss":
      nextRuleStates.cooldownAfterLossMinutes = entry;
      break;
    case "max_daily_loss":
      nextRuleStates.maxDailyLoss = entry;
      break;
    case "max_trades_per_day":
      nextRuleStates.maxTradesPerDay = entry;
      break;
    case "min_risk_reward":
      nextRuleStates.minRiskReward = entry;
      break;
    case "no_trade_zone":
      if (rule.ruleId) {
        nextRuleStates.noTradeZones[rule.ruleId] = entry;
      }
      break;
    case "require_protection":
      nextRuleStates.requireProtection = entry;
      break;
  }

  return await writeServerDisciplineState({
    ...currentState,
    ruleStates: nextRuleStates,
    source: "system",
    updatedAt: new Date().toISOString(),
    version: currentState.version + 1,
  });
}

function getLockedRuleWeakeningAttempt(
  serverState: ServerDisciplineState,
  clientState: ServerDisciplineState,
) {
  if (
    serverState.ruleStates.cooldownAfterLossMinutes.state === "locked" &&
    isCooldownWeakened(serverState.rules.cooldownAfterLossMinutes, clientState.rules.cooldownAfterLossMinutes)
  ) {
    return { ruleId: "cooldownAfterLossMinutes", ruleType: "cooldown_after_loss" as const };
  }

  if (
    serverState.ruleStates.maxDailyLoss.state === "locked" &&
    isMaxDailyLossWeakened(serverState.rules.maxDailyLoss, clientState.rules.maxDailyLoss)
  ) {
    return { ruleId: "maxDailyLoss", ruleType: "max_daily_loss" as const };
  }

  if (
    serverState.ruleStates.maxTradesPerDay.state === "locked" &&
    isMaxTradesWeakened(serverState.rules.maxTradesPerDay, clientState.rules.maxTradesPerDay)
  ) {
    return { ruleId: "maxTradesPerDay", ruleType: "max_trades_per_day" as const };
  }

  if (
    serverState.ruleStates.minRiskReward.state === "locked" &&
    isMinRiskRewardWeakened(serverState.rules.minRiskReward, clientState.rules.minRiskReward)
  ) {
    return { ruleId: "minRiskReward", ruleType: "min_risk_reward" as const };
  }

  if (
    serverState.ruleStates.requireProtection.state === "locked" &&
    isRequireProtectionWeakened(serverState.requireProtection, clientState.requireProtection)
  ) {
    return { ruleId: "requireProtection", ruleType: "require_protection" as const };
  }

  for (const zone of serverState.noTradeZones) {
    if (
      serverState.ruleStates.noTradeZones[zone.id]?.state === "locked" &&
      !hasMatchingNoTradeZone(clientState, zone)
    ) {
      return { ruleId: zone.id, ruleType: "no_trade_zone" as const };
    }
  }

  for (const rule of serverState.blockedTimeWindows) {
    if (
      serverState.ruleStates.blockedTimeWindows[rule.id]?.state === "locked" &&
      !hasMatchingBlockedTimeWindow(clientState, rule)
    ) {
      return { ruleId: rule.id, ruleType: "blocked_time_window" as const };
    }
  }

  return null;
}

function doesClientWeakenServerState(
  serverState: ServerDisciplineState,
  clientState: ServerDisciplineState,
) {
  if (
    serverState.disciplineLocked &&
    !clientState.disciplineLocked &&
    (hasActiveServerDisciplineLock(serverState) || !hasServerDisciplineOverride(serverState))
  ) {
    return true;
  }

  if (
    serverState.ruleStates.cooldownAfterLossMinutes.state !== "overridden" &&
    serverState.tracking.cooldownRemainingMs > 0 &&
    clientState.tracking.cooldownRemainingMs <= 0
  ) {
    return true;
  }

  if (
    serverState.ruleStates.cooldownAfterLossMinutes.state !== "overridden" &&
    serverState.tracking.lastLosingTradeAt &&
    serverState.rules.cooldownAfterLossMinutes !== null &&
    clientState.tracking.lastLosingTradeAt !== serverState.tracking.lastLosingTradeAt
  ) {
    return true;
  }

  if (clientState.tracking.tradesPlacedToday < serverState.tracking.tradesPlacedToday) {
    return true;
  }

  if (isMaxDailyLossHit(serverState) && clientState.tracking.realizedPnlToday > serverState.tracking.realizedPnlToday) {
    return true;
  }

  if (
    serverState.noTradeZones.some((zone) =>
      serverState.ruleStates.noTradeZones[zone.id]?.state !== "overridden" &&
      !hasMatchingNoTradeZone(clientState, zone)
    )
  ) {
    return true;
  }

  if (
    serverState.blockedTimeWindows.some((rule) =>
      serverState.ruleStates.blockedTimeWindows[rule.id]?.state !== "overridden" &&
      !hasMatchingBlockedTimeWindow(clientState, rule)
    )
  ) {
    return true;
  }

  if (
    serverState.ruleStates.minRiskReward.state !== "overridden" &&
    serverState.activeTradePlan &&
    serverState.rules.minRiskReward !== null &&
    (clientState.rules.minRiskReward === null ||
      clientState.rules.minRiskReward < serverState.rules.minRiskReward)
  ) {
    return true;
  }

  if (
    serverState.ruleStates.requireProtection.state !== "overridden" &&
    isRequireProtectionWeakened(serverState.requireProtection, clientState.requireProtection)
  ) {
    return true;
  }

  return false;
}

function hasActiveServerDisciplineLock(state: ServerDisciplineState) {
  if (
    state.ruleStates.cooldownAfterLossMinutes.state === "locked" ||
    state.ruleStates.maxDailyLoss.state === "locked" ||
    state.ruleStates.maxTradesPerDay.state === "locked" ||
    state.ruleStates.minRiskReward.state === "locked" ||
    state.ruleStates.requireProtection.state === "locked"
  ) {
    return true;
  }

  return (
    Object.values(state.ruleStates.noTradeZones).some((entry) => entry.state === "locked") ||
    Object.values(state.ruleStates.blockedTimeWindows).some((entry) => entry.state === "locked")
  );
}

function hasServerDisciplineOverride(state: ServerDisciplineState) {
  if (
    state.ruleStates.cooldownAfterLossMinutes.state === "overridden" ||
    state.ruleStates.maxDailyLoss.state === "overridden" ||
    state.ruleStates.maxTradesPerDay.state === "overridden" ||
    state.ruleStates.minRiskReward.state === "overridden" ||
    state.ruleStates.requireProtection.state === "overridden"
  ) {
    return true;
  }

  return (
    Object.values(state.ruleStates.noTradeZones).some((entry) => entry.state === "overridden") ||
    Object.values(state.ruleStates.blockedTimeWindows).some((entry) => entry.state === "overridden")
  );
}

function isCooldownWeakened(serverValue: number | null, clientValue: number | null) {
  return serverValue !== null && (clientValue === null || clientValue < serverValue);
}

function isMaxDailyLossWeakened(serverValue: number | null, clientValue: number | null) {
  return serverValue !== null && (clientValue === null || clientValue > serverValue);
}

function isMaxTradesWeakened(serverValue: number | null, clientValue: number | null) {
  return serverValue !== null && (clientValue === null || clientValue > serverValue);
}

function isMinRiskRewardWeakened(serverValue: number | null, clientValue: number | null) {
  return serverValue !== null && (clientValue === null || clientValue < serverValue);
}

function isMaxDailyLossHit(state: ServerDisciplineState) {
  return (
    state.rules.maxDailyLoss !== null &&
    state.tracking.realizedPnlToday <= -state.rules.maxDailyLoss
  );
}

function hasMatchingNoTradeZone(
  state: ServerDisciplineState,
  zone: ServerDisciplineNoTradeZone,
) {
  return state.noTradeZones.some((candidateZone) =>
    candidateZone.id === zone.id &&
    candidateZone.isNoTrade === zone.isNoTrade &&
    candidateZone.symbol === zone.symbol &&
    candidateZone.bottomPrice === zone.bottomPrice &&
    candidateZone.topPrice === zone.topPrice,
  );
}

function hasMatchingBlockedTimeWindow(
  state: ServerDisciplineState,
  rule: BlockedTimeWindowRule,
) {
  return state.blockedTimeWindows.some((candidate) =>
    candidate.id === rule.id &&
    candidate.enabled === rule.enabled &&
    candidate.startTime === rule.startTime &&
    candidate.endTime === rule.endTime &&
    candidate.timezone === rule.timezone &&
    JSON.stringify(candidate.daysOfWeek ?? []) === JSON.stringify(rule.daysOfWeek ?? []),
  );
}

function deriveRuleStateEntry(
  currentEntry: ServerDisciplineRuleStateEntry | undefined,
  ruleType: DisciplineRuleType,
  state: DisciplineRuleState,
  reasonCode?: string,
): ServerDisciplineRuleStateEntry {
  if (currentEntry?.state === "overridden") {
    return {
      ...currentEntry,
      ruleType,
    };
  }

  return {
    reasonCode,
    ruleType,
    state,
  };
}

function deriveNoTradeZoneRuleStates(
  state: ServerDisciplineState,
  context: {
    prices?: number[];
    symbol?: HyperliquidSymbol | string | null;
  },
  currentZoneStates: Record<string, ServerDisciplineRuleStateEntry>,
) {
  return state.noTradeZones.reduce<Record<string, ServerDisciplineRuleStateEntry>>((nextStates, zone) => {
    const zoneState = getNoTradeZoneState(zone, context);
    nextStates[zone.id] = deriveRuleStateEntry(
      currentZoneStates[zone.id],
      "no_trade_zone",
      zoneState,
      zoneState === "locked" ? "no_trade_zone_active" : undefined,
    );

    return nextStates;
  }, {});
}

function deriveBlockedTimeWindowRuleStates(
  state: ServerDisciplineState,
  now: Date | undefined,
  currentWindowStates: Record<string, ServerDisciplineRuleStateEntry>,
) {
  return state.blockedTimeWindows.reduce<Record<string, ServerDisciplineRuleStateEntry>>((nextStates, rule) => {
    const ruleState = deriveBlockedTimeWindowRuleState(rule, now ?? new Date());
    nextStates[rule.id] = deriveRuleStateEntry(
      currentWindowStates[rule.id],
      "blocked_time_window",
      ruleState,
      ruleState === "locked" ? "blocked_time_window_active" : undefined,
    );

    return nextStates;
  }, {});
}

function getNoTradeZoneState(
  zone: ServerDisciplineNoTradeZone,
  context: {
    prices?: number[];
    symbol?: HyperliquidSymbol | string | null;
  },
): DisciplineRuleState {
  if (!zone.isNoTrade) {
    return "inactive";
  }

  const prices = context.symbol === zone.symbol ? context.prices ?? [] : [];

  if (prices.some((price) => isPriceInsideZone(zone, price))) {
    return "locked";
  }

  if (prices.some((price) => isPriceNearZone(zone, price))) {
    return "armed";
  }

  return "active";
}

function isPriceInsideZone(zone: ServerDisciplineNoTradeZone, price: number) {
  if (!Number.isFinite(price)) {
    return false;
  }

  const low = Math.min(zone.bottomPrice, zone.topPrice);
  const high = Math.max(zone.bottomPrice, zone.topPrice);

  return price >= low && price <= high;
}

function isPriceNearZone(zone: ServerDisciplineNoTradeZone, price: number) {
  if (!Number.isFinite(price)) {
    return false;
  }

  const low = Math.min(zone.bottomPrice, zone.topPrice);
  const high = Math.max(zone.bottomPrice, zone.topPrice);
  const zoneWidth = Math.max(1, high - low);
  const nearDistance = zoneWidth * 0.25;

  return Math.abs(price - low) <= nearDistance || Math.abs(price - high) <= nearDistance;
}

function getTradePlanRiskReward(
  tradePlan: Pick<ChartTradePlan, "entry" | "stop" | "target">,
) {
  const risk = Math.abs(tradePlan.entry - tradePlan.stop);
  const reward = Math.abs(tradePlan.target - tradePlan.entry);

  if (!Number.isFinite(risk) || risk <= 0 || !Number.isFinite(reward)) {
    return 0;
  }

  return reward / risk;
}

function sanitizeRuleStates(ruleStates: unknown): ServerDisciplineRuleStates {
  const defaults = createDefaultServerDisciplineRuleStates();
  const partialRuleStates = ruleStates && typeof ruleStates === "object"
    ? ruleStates as Partial<ServerDisciplineRuleStates>
    : {};

  return {
    blockedTimeWindows: sanitizeBlockedTimeWindowRuleStates(partialRuleStates.blockedTimeWindows),
    cooldownAfterLossMinutes: sanitizeRuleStateEntry(
      partialRuleStates.cooldownAfterLossMinutes,
      defaults.cooldownAfterLossMinutes,
    ),
    maxDailyLoss: sanitizeRuleStateEntry(partialRuleStates.maxDailyLoss, defaults.maxDailyLoss),
    maxTradesPerDay: sanitizeRuleStateEntry(
      partialRuleStates.maxTradesPerDay,
      defaults.maxTradesPerDay,
    ),
    minRiskReward: sanitizeRuleStateEntry(partialRuleStates.minRiskReward, defaults.minRiskReward),
    noTradeZones: sanitizeNoTradeZoneRuleStates(partialRuleStates.noTradeZones),
    requireProtection: sanitizeRuleStateEntry(
      partialRuleStates.requireProtection,
      defaults.requireProtection,
    ),
  };
}

function sanitizeOverrideBondConfigs(configs: unknown): ServerDisciplineOverrideBondConfigs {
  const defaults = createDefaultServerDisciplineOverrideBondConfigs();
  const partialConfigs = configs && typeof configs === "object"
    ? configs as Partial<ServerDisciplineOverrideBondConfigs>
    : {};

  return {
    blockedTimeWindows: sanitizeBlockedTimeWindowOverrideBondConfigs(partialConfigs.blockedTimeWindows),
    cooldownAfterLossMinutes: sanitizeOverrideBondConfig(
      partialConfigs.cooldownAfterLossMinutes,
      defaults.cooldownAfterLossMinutes,
    ),
    maxDailyLoss: sanitizeOverrideBondConfig(partialConfigs.maxDailyLoss, defaults.maxDailyLoss),
    maxTradesPerDay: sanitizeOverrideBondConfig(partialConfigs.maxTradesPerDay, defaults.maxTradesPerDay),
    minRiskReward: sanitizeOverrideBondConfig(partialConfigs.minRiskReward, defaults.minRiskReward),
    noTradeZones: sanitizeNoTradeZoneOverrideBondConfigs(partialConfigs.noTradeZones),
    requireProtection: sanitizeOverrideBondConfig(
      partialConfigs.requireProtection,
      defaults.requireProtection,
    ),
  };
}

function sanitizeNoTradeZoneOverrideBondConfigs(configs: unknown) {
  if (!configs || typeof configs !== "object" || Array.isArray(configs)) {
    return {};
  }

  return Object.entries(configs as Record<string, unknown>).reduce<Record<string, ServerDisciplineOverrideBondConfig>>(
    (nextConfigs, [zoneId, config]) => {
      if (zoneId.length > 0) {
        nextConfigs[zoneId] = sanitizeOverrideBondConfig(config, createDefaultServerDisciplineOverrideBondConfig());
      }

      return nextConfigs;
    },
    {},
  );
}

function sanitizeBlockedTimeWindowOverrideBondConfigs(configs: unknown) {
  if (!configs || typeof configs !== "object" || Array.isArray(configs)) {
    return {};
  }

  return Object.entries(configs as Record<string, unknown>).reduce<Record<string, ServerDisciplineOverrideBondConfig>>(
    (nextConfigs, [ruleId, config]) => {
      if (ruleId.length > 0) {
        nextConfigs[ruleId] = sanitizeOverrideBondConfig(config, createDefaultServerDisciplineOverrideBondConfig());
      }

      return nextConfigs;
    },
    {},
  );
}

function sanitizeOverrideBondConfig(
  config: unknown,
  fallback: ServerDisciplineOverrideBondConfig,
): ServerDisciplineOverrideBondConfig {
  const maybeConfig = config && typeof config === "object"
    ? config as Partial<ServerDisciplineOverrideBondConfig>
    : {};
  const baseAmountUsdc =
    typeof maybeConfig.baseAmountUsdc === "number" && Number.isFinite(maybeConfig.baseAmountUsdc)
      ? Math.max(0, maybeConfig.baseAmountUsdc)
      : fallback.baseAmountUsdc;

  return {
    enabled: maybeConfig.enabled !== false,
    baseAmountUsdc,
    label: sanitizeOverrideBondLabel(maybeConfig.label, fallback.label),
  };
}

function sanitizeOverrideBondLabel(label: unknown, fallback: OverrideBondLabel): OverrideBondLabel {
  return label === "soft" ||
    label === "serious" ||
    label === "heavy" ||
    label === "nuclear" ||
    label === "custom"
    ? label
    : fallback;
}

function sanitizeNoTradeZoneRuleStates(ruleStates: unknown) {
  if (!ruleStates || typeof ruleStates !== "object" || Array.isArray(ruleStates)) {
    return {};
  }

  return Object.entries(ruleStates as Record<string, unknown>).reduce<Record<string, ServerDisciplineRuleStateEntry>>(
    (nextStates, [zoneId, entry]) => {
      if (zoneId.length > 0) {
        nextStates[zoneId] = sanitizeRuleStateEntry(entry, {
          ruleType: "no_trade_zone",
          state: "inactive",
        });
      }

      return nextStates;
    },
    {},
  );
}

function sanitizeBlockedTimeWindowRuleStates(ruleStates: unknown) {
  if (!ruleStates || typeof ruleStates !== "object" || Array.isArray(ruleStates)) {
    return {};
  }

  return Object.entries(ruleStates as Record<string, unknown>).reduce<Record<string, ServerDisciplineRuleStateEntry>>(
    (nextStates, [ruleId, entry]) => {
      if (ruleId.length > 0) {
        nextStates[ruleId] = sanitizeRuleStateEntry(entry, {
          ruleType: "blocked_time_window",
          state: "inactive",
        });
      }

      return nextStates;
    },
    {},
  );
}

function sanitizeRuleStateEntry(
  entry: unknown,
  fallback: ServerDisciplineRuleStateEntry,
): ServerDisciplineRuleStateEntry {
  const maybeEntry = entry && typeof entry === "object"
    ? entry as Partial<ServerDisciplineRuleStateEntry>
    : {};

  return {
    reasonCode: typeof maybeEntry.reasonCode === "string" ? maybeEntry.reasonCode : fallback.reasonCode,
    ruleType: sanitizeRuleType(maybeEntry.ruleType, fallback.ruleType),
    state: sanitizeRuleState(maybeEntry.state, fallback.state),
  };
}

function sanitizeRuleState(state: unknown, fallback: DisciplineRuleState): DisciplineRuleState {
  return state === "inactive" ||
    state === "active" ||
    state === "armed" ||
    state === "triggered" ||
    state === "locked" ||
    state === "overridden"
    ? state
    : fallback;
}

function sanitizeRuleType(ruleType: unknown, fallback: DisciplineRuleType): DisciplineRuleType {
  return ruleType === "blocked_time_window" ||
    ruleType === "cooldown_after_loss" ||
    ruleType === "max_daily_loss" ||
    ruleType === "max_trades_per_day" ||
    ruleType === "min_risk_reward" ||
    ruleType === "no_trade_zone"
    ? ruleType
    : fallback;
}

function sanitizeStateSource(source: unknown): ServerDisciplineStateSource {
  return source === "client_sync" ||
    source === "server_gate" ||
    source === "manual_test" ||
    source === "system"
    ? source
    : "system";
}

function sanitizeSyncIntent(syncIntent: unknown): ServerDisciplineSyncIntent {
  return syncIntent === "tracking_update" ||
    syncIntent === "rule_update" ||
    syncIntent === "hydration" ||
    syncIntent === "system"
    ? syncIntent
    : "system";
}

function createTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function getServerCooldownRemainingMs(
  rules: DisciplineRiskGateRules,
  tracking: ServerDisciplineTracking,
  now = Date.now(),
) {
  if (rules.cooldownAfterLossMinutes === null || !tracking.lastLosingTradeAt) {
    return 0;
  }

  const lastLossAt = new Date(tracking.lastLosingTradeAt).getTime();

  if (!Number.isFinite(lastLossAt)) {
    return 0;
  }

  return Math.max(0, lastLossAt + rules.cooldownAfterLossMinutes * 60_000 - now);
}

function sanitizeRules(rules: unknown): DisciplineRiskGateRules {
  const partialRules = rules && typeof rules === "object" ? rules as Partial<DisciplineRiskGateRules> : {};

  return {
    cooldownAfterLossMinutes: sanitizePositiveNumber(partialRules.cooldownAfterLossMinutes, true),
    maxDailyLoss: sanitizePositiveNumber(partialRules.maxDailyLoss),
    maxTradesPerDay: sanitizePositiveNumber(partialRules.maxTradesPerDay, true),
    minRiskReward: sanitizePositiveNumber(partialRules.minRiskReward),
  };
}

function sanitizeTracking(tracking: unknown): ServerDisciplineTracking {
  const partialTracking = tracking && typeof tracking === "object" ? tracking as Partial<ServerDisciplineTracking> : {};

  return {
    cooldownRemainingMs: 0,
    dayKey: typeof partialTracking.dayKey === "string" ? partialTracking.dayKey : createTodayKey(),
    lastLosingTradeAt:
      typeof partialTracking.lastLosingTradeAt === "string" ? partialTracking.lastLosingTradeAt : null,
    realizedPnlToday: sanitizeFiniteNumber(partialTracking.realizedPnlToday, 0),
    tradesPlacedToday: Math.max(0, Math.floor(sanitizeFiniteNumber(partialTracking.tradesPlacedToday, 0))),
  };
}

function sanitizeNoTradeZone(zone: unknown): ServerDisciplineNoTradeZone[] {
  const maybeZone = zone && typeof zone === "object" ? zone as Partial<ServerDisciplineNoTradeZone> : null;
  const bottomPrice = maybeZone?.bottomPrice;
  const topPrice = maybeZone?.topPrice;

  if (
    !maybeZone ||
    typeof maybeZone.id !== "string" ||
    typeof maybeZone.symbol !== "string" ||
    typeof bottomPrice !== "number" ||
    typeof topPrice !== "number" ||
    !Number.isFinite(bottomPrice) ||
    !Number.isFinite(topPrice)
  ) {
    return [];
  }

  return [{
    bottomPrice,
    id: maybeZone.id,
    isNoTrade: maybeZone.isNoTrade === true,
    symbol: maybeZone.symbol,
    topPrice,
  }];
}

function sanitizeBlockedTimeWindow(rule: unknown): BlockedTimeWindowRule[] {
  const maybeRule = rule && typeof rule === "object" ? rule as Partial<BlockedTimeWindowRule> : null;

  if (
    !maybeRule ||
    typeof maybeRule.id !== "string" ||
    !isValidTime(maybeRule.startTime) ||
    !isValidTime(maybeRule.endTime)
  ) {
    return [];
  }

  const daysOfWeek = Array.isArray(maybeRule.daysOfWeek)
    ? maybeRule.daysOfWeek.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : undefined;

  return [{
    daysOfWeek: daysOfWeek && daysOfWeek.length > 0 ? Array.from(new Set(daysOfWeek)) : undefined,
    enabled: maybeRule.enabled !== false,
    endTime: maybeRule.endTime,
    id: maybeRule.id,
    label: typeof maybeRule.label === "string" ? maybeRule.label : undefined,
    source: maybeRule.source === "operator_diagnosis" ? "operator_diagnosis" : "manual",
    sourceFindingId: typeof maybeRule.sourceFindingId === "string" ? maybeRule.sourceFindingId : undefined,
    startTime: maybeRule.startTime,
    state: sanitizeRuleState(maybeRule.state, "inactive"),
    timezone: typeof maybeRule.timezone === "string" ? maybeRule.timezone : undefined,
  }];
}

function isValidTime(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function sanitizePendingOrder(order: unknown): ServerDisciplinePendingOrder[] {
  const maybeOrder = order && typeof order === "object" ? order as Partial<ServerDisciplinePendingOrder> : null;
  const size = maybeOrder?.size;

  if (!maybeOrder || typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return [];
  }

  return [{
    id: typeof maybeOrder.id === "string" ? maybeOrder.id : undefined,
    orderId: Number.isInteger(maybeOrder.orderId) ? maybeOrder.orderId : null,
    reduceOnly: maybeOrder.reduceOnly === true,
    side: maybeOrder.side === "long" || maybeOrder.side === "short" ? maybeOrder.side : undefined,
    size,
    symbol: typeof maybeOrder.symbol === "string" ? maybeOrder.symbol : null,
  }];
}

function sanitizeTradePlan(
  tradePlan: unknown,
): Pick<ChartTradePlan, "entry" | "id" | "stop" | "symbol" | "target"> | null {
  const maybeTradePlan = tradePlan && typeof tradePlan === "object"
    ? tradePlan as Partial<ChartTradePlan>
    : null;
  const entry = maybeTradePlan?.entry;
  const stop = maybeTradePlan?.stop;
  const target = maybeTradePlan?.target;

  if (
    !maybeTradePlan ||
    typeof maybeTradePlan.id !== "string" ||
    typeof maybeTradePlan.symbol !== "string" ||
    typeof entry !== "number" ||
    typeof stop !== "number" ||
    typeof target !== "number" ||
    !Number.isFinite(entry) ||
    !Number.isFinite(stop) ||
    !Number.isFinite(target)
  ) {
    return null;
  }

  return {
    entry,
    id: maybeTradePlan.id,
    stop,
    symbol: maybeTradePlan.symbol as HyperliquidSymbol,
    target,
  };
}

function sanitizePositiveNumber(value: unknown, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (!integer) {
    return value;
  }

  const normalizedValue = Math.floor(value);
  return normalizedValue > 0 ? normalizedValue : null;
}

function sanitizeFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
