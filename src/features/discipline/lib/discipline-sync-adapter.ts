import type { ChartZone } from "@/features/chart/types";
import type {
  MarketEntryConfirmationRule,
  DisciplineRiskGateRules,
} from "@/features/discipline/lib/discipline-risk-gate";
import {
  DEFAULT_REQUIRE_PROTECTION_RULE,
  sanitizeRequireProtectionRule,
  type RequireProtectionRule,
} from "@/features/discipline/lib/discipline-protection";
import type { BlockedTimeWindowRule } from "@/features/discipline/lib/discipline-time-window";
import { resolveBlockedTimeWindowDisplayState } from "@/features/discipline/lib/blocked-time-window-override";
import type { HyperliquidSymbol } from "@/types/market";
import type { ChartTradePlan, TradeDirection } from "@/types/trade";

export type DisciplineRules = {
  blockedTimeWindows?: BlockedTimeWindowRule[];
  cooldownAfterLossMinutes: number | null;
  marketEntryConfirmation?: MarketEntryConfirmationRule;
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
  requireProtection?: RequireProtectionRule;
};

export type DisciplineTracking = {
  cooldownRemainingMs: number;
  dayKey: string;
  lastLosingTradeAt: string | null;
  realizedPnlToday: number;
  tradesPlacedToday: number;
};

export type DisciplineServerRuleType =
  | "blocked_time_window"
  | "cooldown_after_loss"
  | "max_daily_loss"
  | "max_trades_per_day"
  | "market_entry_confirmation"
  | "min_risk_reward"
  | "no_trade_zone"
  | "require_protection";

export type OverrideBondLabel = "soft" | "serious" | "heavy" | "nuclear" | "custom";

export type OverrideBondConfig = {
  baseAmountUsdc: number;
  enabled: boolean;
  label: OverrideBondLabel;
};

export type OverrideBondPreview = {
  baseAmountUsdc: number;
  finalAmountUsdc: number;
  multiplier: number;
  portalAmountUsdc: number;
  reserveAmountUsdc: number;
  vaultAmountUsdc: number;
};

export type PendingDisciplineRuleEdit = {
  intendedMinRR: number | null;
  intendedRules: DisciplineRules;
  ruleId?: string | null;
  ruleType?: DisciplineServerRuleType | string | null;
};

export type PendingOverrideBondPrompt = PendingDisciplineRuleEdit & {
  message: string;
  preview: OverrideBondPreview;
};

export type ServerDisciplineRuleStateEntrySnapshot = {
  state?: BlockedTimeWindowRule["state"];
};

export type ServerDisciplineRuleStatesSnapshot = {
  blockedTimeWindows?: Record<string, ServerDisciplineRuleStateEntrySnapshot>;
};

export type ServerDisciplineStateSnapshot = {
  activeTradePlan?: Pick<
    ChartTradePlan,
    "entry" | "id" | "stop" | "symbol" | "target"
  > | null;
  blockedTimeWindows?: BlockedTimeWindowRule[];
  disciplineLocked?: boolean;
  marketEntryConfirmation?: MarketEntryConfirmationRule;
  noTradeZones?: ServerDisciplineNoTradeZone[];
  overrideBondConfigs?: {
    blockedTimeWindows?: Record<string, OverrideBondConfig>;
    cooldownAfterLossMinutes?: OverrideBondConfig;
    maxDailyLoss?: OverrideBondConfig;
    maxTradesPerDay?: OverrideBondConfig;
    minRiskReward?: OverrideBondConfig;
    noTradeZones?: Record<string, OverrideBondConfig>;
    requireProtection?: OverrideBondConfig;
  };
  pendingOrders?: Array<{
    id?: string;
    orderId?: number | null;
    reduceOnly?: boolean;
    side?: TradeDirection;
    size: number;
    symbol?: string | null;
  }>;
  requireProtection?: RequireProtectionRule;
  rules?: DisciplineRiskGateRules;
  ruleStates?: ServerDisciplineRuleStatesSnapshot;
  tracking?: DisciplineTracking;
  updatedAt?: string;
  version?: number;
};

export type ServerDisciplineSyncPayload = {
  accepted?: boolean;
  clientVersion?: number | null;
  message?: string;
  overrideBondPreview?: OverrideBondPreview;
  overrideBondRequired?: boolean;
  reasonCode?: string;
  ruleEditLogEntry?: {
    currentState?: string;
    eventType?: string;
    message?: string;
    reasonCode?: string;
    ruleId?: string;
    ruleType?: string;
  };
  serverVersion?: number;
  state?: ServerDisciplineStateSnapshot;
};

export type ServerDisciplineNoTradeZone = {
  bottomPrice: number;
  id: string;
  isNoTrade: boolean;
  symbol: string;
  topPrice: number;
};

export type DisciplineSyncPendingLimitOrder = {
  direction?: TradeDirection;
  id?: string;
  normalizedSize?: number;
  orderId?: number | null;
  reduceOnly?: boolean;
  status?: string;
  symbol?: HyperliquidSymbol | string | null;
};

export type BuiltDisciplineSyncPayload = {
  activeTradePlan: Pick<ChartTradePlan, "entry" | "id" | "stop" | "symbol" | "target"> | null;
  blockedTimeWindows: BlockedTimeWindowRule[];
  disciplineLocked: boolean;
  marketEntryConfirmation: MarketEntryConfirmationRule;
  noTradeZones: ServerDisciplineNoTradeZone[];
  overrideBondConfigs: {
    blockedTimeWindows: Record<string, OverrideBondConfig>;
    cooldownAfterLossMinutes: OverrideBondConfig;
    maxDailyLoss: OverrideBondConfig;
    maxTradesPerDay: OverrideBondConfig;
    minRiskReward: OverrideBondConfig;
    noTradeZones: Record<string, OverrideBondConfig>;
    requireProtection: OverrideBondConfig;
  };
  pendingOrders: Array<{
    id?: string;
    orderId: number | null;
    reduceOnly: boolean;
    side?: TradeDirection;
    size: number;
    symbol?: HyperliquidSymbol | string | null;
  }>;
  requireProtection: RequireProtectionRule;
  rules: DisciplineRiskGateRules;
  source: "client_sync";
  syncIntent: "rule_update";
  tracking: DisciplineTracking;
  updatedAt: string;
  version?: number;
};

export const DEFAULT_REQUIRE_PROTECTION_CLIENT_RULE: RequireProtectionRule =
  DEFAULT_REQUIRE_PROTECTION_RULE;

export const DEFAULT_MARKET_ENTRY_CONFIRMATION_CLIENT_RULE: MarketEntryConfirmationRule =
  {
    enabled: false,
    mode: "confirm_required",
    state: "inactive",
  };

export const DEFAULT_DISCIPLINE_RULES: DisciplineRules = {
  blockedTimeWindows: [],
  cooldownAfterLossMinutes: null,
  marketEntryConfirmation: DEFAULT_MARKET_ENTRY_CONFIRMATION_CLIENT_RULE,
  maxDailyLoss: null,
  maxTradesPerDay: null,
  requireProtection: DEFAULT_REQUIRE_PROTECTION_CLIENT_RULE,
};

export const DEFAULT_OVERRIDE_BOND_CONFIG: OverrideBondConfig = {
  baseAmountUsdc: 25,
  enabled: true,
  label: "serious",
};

export const OVERRIDE_BOND_PRESETS: Array<{
  amount: number;
  label: Exclude<OverrideBondLabel, "custom">;
  name: string;
}> = [
  { amount: 10, label: "soft", name: "Soft" },
  { amount: 25, label: "serious", name: "Serious" },
  { amount: 50, label: "heavy", name: "Heavy" },
  { amount: 100, label: "nuclear", name: "Nuclear" },
];

export function createTodayKey(now = new Date()) {
  return now.toLocaleDateString("en-CA");
}

export function createEmptyDisciplineTracking(dayKey = createTodayKey()): DisciplineTracking {
  return {
    cooldownRemainingMs: 0,
    dayKey,
    lastLosingTradeAt: null,
    realizedPnlToday: 0,
    tradesPlacedToday: 0,
  };
}

export function sanitizePositiveNumber(value: unknown, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (!integer) {
    return value;
  }

  const normalizedValue = Math.floor(value);
  return normalizedValue > 0 ? normalizedValue : null;
}

export function sanitizeDisciplineRules(value: unknown): DisciplineRules {
  const parsedRules =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<DisciplineRules>)
      : {};

  return {
    blockedTimeWindows: sanitizeBlockedTimeWindows(parsedRules.blockedTimeWindows),
    cooldownAfterLossMinutes: sanitizePositiveNumber(
      parsedRules.cooldownAfterLossMinutes,
      true,
    ),
    marketEntryConfirmation: DEFAULT_MARKET_ENTRY_CONFIRMATION_CLIENT_RULE,
    maxDailyLoss: sanitizePositiveNumber(parsedRules.maxDailyLoss),
    maxTradesPerDay: sanitizePositiveNumber(parsedRules.maxTradesPerDay, true),
    requireProtection: DEFAULT_REQUIRE_PROTECTION_CLIENT_RULE,
  };
}

export function sanitizeBlockedTimeWindows(value: unknown): BlockedTimeWindowRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const rule =
      item && typeof item === "object"
        ? (item as Partial<BlockedTimeWindowRule>)
        : null;

    if (
      !rule ||
      typeof rule.id !== "string" ||
      !isBlockedWindowTime(rule.startTime) ||
      !isBlockedWindowTime(rule.endTime)
    ) {
      return [];
    }

    return [
      {
        daysOfWeek: Array.isArray(rule.daysOfWeek)
          ? rule.daysOfWeek.filter(
              (day): day is number =>
                Number.isInteger(day) && day >= 0 && day <= 6,
            )
          : undefined,
        enabled: rule.enabled !== false,
        endTime: rule.endTime,
        id: rule.id,
        label: typeof rule.label === "string" ? rule.label : undefined,
        source:
          rule.source === "operator_diagnosis" ? "operator_diagnosis" : "manual",
        sourceFindingId:
          typeof rule.sourceFindingId === "string"
            ? rule.sourceFindingId
            : undefined,
        startTime: rule.startTime,
        state: rule.state,
        timezone: typeof rule.timezone === "string" ? rule.timezone : undefined,
      },
    ];
  });
}

export function sanitizeMarketEntryConfirmationRule(
  value: unknown,
): MarketEntryConfirmationRule {
  const rule =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<MarketEntryConfirmationRule>)
      : {};

  return {
    enabled: rule.enabled === true,
    mode: rule.mode === "warn_only" ? "warn_only" : "confirm_required",
    source:
      rule.source === "operator_diagnosis" || rule.source === "manual"
        ? rule.source
        : undefined,
    sourceFindingId:
      typeof rule.sourceFindingId === "string" && rule.sourceFindingId.length > 0
        ? rule.sourceFindingId
        : undefined,
    state:
      rule.state === "triggered" ||
      rule.state === "locked" ||
      rule.state === "overridden"
        ? rule.state
        : rule.enabled === true
          ? "active"
          : "inactive",
  };
}

export function sanitizeOverrideBondConfig(
  config: OverrideBondConfig | undefined,
): OverrideBondConfig {
  if (!config) {
    return DEFAULT_OVERRIDE_BOND_CONFIG;
  }

  const baseAmountUsdc =
    typeof config.baseAmountUsdc === "number" &&
    Number.isFinite(config.baseAmountUsdc)
      ? Math.max(0, config.baseAmountUsdc)
      : DEFAULT_OVERRIDE_BOND_CONFIG.baseAmountUsdc;

  return {
    baseAmountUsdc,
    enabled: config.enabled !== false,
    label: sanitizeOverrideBondLabel(config.label, baseAmountUsdc),
  };
}

export function sanitizeDisciplineTracking(value: unknown): DisciplineTracking {
  const tracking =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<DisciplineTracking>)
      : {};

  return {
    cooldownRemainingMs: 0,
    dayKey: typeof tracking.dayKey === "string" ? tracking.dayKey : createTodayKey(),
    lastLosingTradeAt:
      typeof tracking.lastLosingTradeAt === "string"
        ? tracking.lastLosingTradeAt
        : null,
    realizedPnlToday:
      typeof tracking.realizedPnlToday === "number" &&
      Number.isFinite(tracking.realizedPnlToday)
        ? tracking.realizedPnlToday
        : 0,
    tradesPlacedToday:
      typeof tracking.tradesPlacedToday === "number" &&
      Number.isFinite(tracking.tradesPlacedToday)
        ? Math.max(0, Math.floor(tracking.tradesPlacedToday))
        : 0,
  };
}

export function normalizeServerDisciplineSnapshot(
  snapshot: ServerDisciplineStateSnapshot,
  now = new Date(),
) {
  const nextVersion =
    typeof snapshot.version === "number" && Number.isFinite(snapshot.version)
      ? Math.floor(snapshot.version)
      : undefined;
  const normalizedRules = snapshot.rules
    ? sanitizeDisciplineRules({
        blockedTimeWindows: snapshot.blockedTimeWindows,
        cooldownAfterLossMinutes: snapshot.rules.cooldownAfterLossMinutes,
        marketEntryConfirmation: snapshot.marketEntryConfirmation,
        maxDailyLoss: snapshot.rules.maxDailyLoss,
        maxTradesPerDay: snapshot.rules.maxTradesPerDay,
        requireProtection: snapshot.requireProtection,
      })
    : undefined;
  const minRiskReward = snapshot.rules ? null : undefined;

  return {
    minRiskReward,
    nextVersion,
    noTradeZones: normalizeServerDisciplineNoTradeZones(
      snapshot.noTradeZones,
      now.toISOString(),
    ),
    overrideBondConfig: snapshot.overrideBondConfigs
      ? sanitizeOverrideBondConfig(
          snapshot.overrideBondConfigs.cooldownAfterLossMinutes ??
            snapshot.overrideBondConfigs.maxDailyLoss ??
            snapshot.overrideBondConfigs.maxTradesPerDay,
        )
      : undefined,
    rules: normalizedRules,
    ruleStates: snapshot.rules ? (snapshot.ruleStates ?? {}) : undefined,
    tracking: snapshot.tracking
      ? sanitizeDisciplineTracking(snapshot.tracking)
      : undefined,
  };
}

export function normalizeServerDisciplineNoTradeZones(
  noTradeZones: ServerDisciplineStateSnapshot["noTradeZones"],
  createdAt = new Date().toISOString(),
): ChartZone[] {
  if (!Array.isArray(noTradeZones)) {
    return [];
  }

  return noTradeZones.flatMap((zone): ChartZone[] => {
    if (
      typeof zone.id !== "string" ||
      typeof zone.symbol !== "string" ||
      typeof zone.bottomPrice !== "number" ||
      !Number.isFinite(zone.bottomPrice) ||
      typeof zone.topPrice !== "number" ||
      !Number.isFinite(zone.topPrice) ||
      !zone.isNoTrade
    ) {
      return [];
    }

    return [
      {
        bottomPrice: zone.bottomPrice,
        createdAt,
        id: zone.id,
        isNoTrade: true,
        lastInteraction: "server-discipline-sync",
        source: "context-menu-drag",
        state: "idle",
        symbol: zone.symbol as HyperliquidSymbol,
        topPrice: zone.topPrice,
      },
    ];
  });
}

export function buildDisciplineSyncPayload({
  activeTradePlan,
  chartZones,
  disciplineLocked,
  minRiskReward,
  overrideBondConfig,
  pendingLimitOrders,
  rules,
  tracking,
  updatedAt,
  version,
}: {
  activeTradePlan: BuiltDisciplineSyncPayload["activeTradePlan"];
  chartZones: Pick<
    ChartZone,
    "bottomPrice" | "id" | "isNoTrade" | "symbol" | "topPrice"
  >[];
  disciplineLocked: boolean;
  minRiskReward: number | null;
  overrideBondConfig: OverrideBondConfig;
  pendingLimitOrders: DisciplineSyncPendingLimitOrder[];
  rules: DisciplineRules;
  tracking: DisciplineTracking;
  updatedAt: string;
  version?: number;
}): BuiltDisciplineSyncPayload {
  return {
    activeTradePlan,
    blockedTimeWindows: rules.blockedTimeWindows ?? [],
    disciplineLocked,
    marketEntryConfirmation: DEFAULT_MARKET_ENTRY_CONFIRMATION_CLIENT_RULE,
    noTradeZones: chartZones
      .filter((zone) => zone.isNoTrade)
      .map((zone) => ({
        bottomPrice: zone.bottomPrice,
        id: zone.id,
        isNoTrade: zone.isNoTrade,
        symbol: zone.symbol,
        topPrice: zone.topPrice,
      })),
    overrideBondConfigs: buildOverrideBondConfigs(overrideBondConfig),
    pendingOrders: pendingLimitOrders
      .filter((order) => order.status === "live" || order.status === "updating")
      .flatMap((order) => {
        if (
          typeof order.normalizedSize !== "number" ||
          !Number.isFinite(order.normalizedSize) ||
          order.normalizedSize <= 0
        ) {
          return [];
        }

        return [
          {
            id: order.id,
            orderId:
              typeof order.orderId === "number" && Number.isInteger(order.orderId)
                ? order.orderId
                : null,
            reduceOnly: order.reduceOnly === true,
            side: order.direction,
            size: order.normalizedSize,
            symbol: order.symbol,
          },
        ];
      }),
    requireProtection: DEFAULT_REQUIRE_PROTECTION_CLIENT_RULE,
    rules: {
      cooldownAfterLossMinutes: rules.cooldownAfterLossMinutes,
      maxDailyLoss: rules.maxDailyLoss,
      maxTradesPerDay: rules.maxTradesPerDay,
      minRiskReward: null,
    },
    source: "client_sync",
    syncIntent: "rule_update",
    tracking: {
      cooldownRemainingMs: tracking.cooldownRemainingMs,
      dayKey: tracking.dayKey,
      lastLosingTradeAt: tracking.lastLosingTradeAt,
      realizedPnlToday: tracking.realizedPnlToday,
      tradesPlacedToday: tracking.tradesPlacedToday,
    },
    updatedAt,
    ...(version === undefined ? {} : { version }),
  };
}

export function buildOverrideBondConfigs(overrideBondConfig: OverrideBondConfig) {
  return {
    blockedTimeWindows: {},
    cooldownAfterLossMinutes: overrideBondConfig,
    maxDailyLoss: overrideBondConfig,
    maxTradesPerDay: overrideBondConfig,
    minRiskReward: overrideBondConfig,
    noTradeZones: {},
    requireProtection: overrideBondConfig,
  };
}

export function resolveBlockedTimeWindowStates(
  rules: DisciplineRules,
  serverRuleStates: ServerDisciplineRuleStatesSnapshot,
) {
  return (rules.blockedTimeWindows ?? []).map((rule) => ({
    ...rule,
    state: resolveBlockedTimeWindowDisplayState(
      rule,
      serverRuleStates.blockedTimeWindows?.[rule.id],
    ),
  }));
}

export function getActiveDisciplineRuleCount(
  rules: DisciplineRules,
  minRiskReward: number | null,
) {
  void minRiskReward;
  return (
    [
      rules.maxDailyLoss,
      rules.maxTradesPerDay,
      rules.cooldownAfterLossMinutes,
    ].filter((value) => value !== null).length +
    (rules.blockedTimeWindows ?? []).filter((rule) => rule.enabled).length
  );
}

export function resolveDisciplineWorkspaceStatusLabel(
  disciplineCurrentlyBlocked: boolean,
  rules: DisciplineRules,
  minRiskReward: number | null,
) {
  if (disciplineCurrentlyBlocked) {
    return "Blocked";
  }

  return getActiveDisciplineRuleCount(rules, minRiskReward) > 0 ? "Active" : "Off";
}

export function getHardLockActive({
  activeBlockedTimeWindow,
  activeTradePlan,
  cooldownRemainingMs,
  disciplineCurrentlyBlocked,
  minRiskReward,
  rules,
  tracking,
}: {
  activeBlockedTimeWindow: BlockedTimeWindowRule | null;
  activeTradePlan: ChartTradePlan | null;
  cooldownRemainingMs: number;
  disciplineCurrentlyBlocked: boolean;
  minRiskReward: number | null;
  rules: DisciplineRules;
  tracking: DisciplineTracking;
}) {
  void activeTradePlan;
  void disciplineCurrentlyBlocked;
  void minRiskReward;
  return (
    cooldownRemainingMs > 0 ||
    (rules.maxDailyLoss !== null &&
      tracking.realizedPnlToday <= -rules.maxDailyLoss) ||
    (rules.maxTradesPerDay !== null &&
      tracking.tradesPlacedToday >= rules.maxTradesPerDay) ||
    activeBlockedTimeWindow !== null
  );
}

export function getFreshDisciplineTracking(
  tracking: DisciplineTracking,
  rules: DisciplineRules,
  options: {
    now?: Date;
    todayKey?: string;
  } = {},
) {
  const now = options.now ?? new Date();
  const todayKey = options.todayKey ?? createTodayKey(now);

  if (tracking.dayKey === todayKey) {
    return {
      ...tracking,
      cooldownRemainingMs: getCooldownRemainingMs(rules, tracking, now.getTime()),
    };
  }

  return createEmptyDisciplineTracking(todayKey);
}

export function getCooldownRemainingMs(
  rules: DisciplineRules,
  tracking: DisciplineTracking,
  now = Date.now(),
) {
  if (
    rules.cooldownAfterLossMinutes === null ||
    !tracking.lastLosingTradeAt
  ) {
    return 0;
  }

  const lastLossAt = new Date(tracking.lastLosingTradeAt).getTime();

  if (!Number.isFinite(lastLossAt)) {
    return 0;
  }

  return Math.max(
    0,
    lastLossAt + rules.cooldownAfterLossMinutes * 60_000 - now,
  );
}

export function getDisciplineServerRuleTypeForClientRule(
  key: keyof DisciplineRules,
): DisciplineServerRuleType {
  switch (key) {
    case "blockedTimeWindows":
      return "blocked_time_window";
    case "cooldownAfterLossMinutes":
      return "cooldown_after_loss";
    case "maxDailyLoss":
      return "max_daily_loss";
    case "maxTradesPerDay":
      return "max_trades_per_day";
    case "marketEntryConfirmation":
      return "market_entry_confirmation";
    case "requireProtection":
      return "require_protection";
  }
}

function sanitizeOverrideBondLabel(
  label: unknown,
  amount: number,
): OverrideBondLabel {
  if (
    label === "soft" ||
    label === "serious" ||
    label === "heavy" ||
    label === "nuclear" ||
    label === "custom"
  ) {
    return label;
  }

  return (
    OVERRIDE_BOND_PRESETS.find((preset) => preset.amount === amount)?.label ??
    "custom"
  );
}

function isBlockedWindowTime(value: unknown): value is string {
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
