import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  DisciplineRuleType,
  ServerDisciplineOverrideBondConfig,
  ServerDisciplineState,
} from "@/features/discipline/lib/discipline-server-state";

export type OverrideBondLedgerEntry = {
  baseAmountUsdc: number;
  bondId: string;
  finalAmountUsdc: number;
  multiplier: number;
  overrideCountToday: number;
  portalAmountUsdc: number;
  reserveAmountUsdc: number;
  ruleId?: string;
  ruleType: DisciplineRuleType;
  source: "simulated";
  status: "posted";
  timestamp: string;
  vaultAmountUsdc: number;
  walletAddress?: string;
};

export type OverrideBondAmounts = {
  baseAmountUsdc: number;
  finalAmountUsdc: number;
  multiplier: number;
  portalAmountUsdc: number;
  reserveAmountUsdc: number;
  vaultAmountUsdc: number;
};

const DEFAULT_LEDGER_FILE = join(process.cwd(), ".portal", "override-bond-ledger.json");

export function getOverrideBondLedgerPath() {
  return process.env.PORTAL_OVERRIDE_BOND_LEDGER_PATH || DEFAULT_LEDGER_FILE;
}

export async function readOverrideBondLedger() {
  try {
    const rawLedger = await readFile(getOverrideBondLedgerPath(), "utf8");
    const parsedLedger = JSON.parse(rawLedger);
    return Array.isArray(parsedLedger) ? parsedLedger.flatMap(sanitizeLedgerEntry) : [];
  } catch {
    return [] as OverrideBondLedgerEntry[];
  }
}

export async function writeOverrideBondLedger(entries: OverrideBondLedgerEntry[]) {
  const ledgerPath = getOverrideBondLedgerPath();
  await mkdir(dirname(ledgerPath), { recursive: true });
  const temporaryPath = `${ledgerPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(entries, null, 2), "utf8");
  await rename(temporaryPath, ledgerPath);
}

export function getOverrideBondMultiplier(overrideCountToday: number) {
  if (overrideCountToday <= 0) {
    return 1;
  }

  if (overrideCountToday === 1) {
    return 2;
  }

  if (overrideCountToday === 2) {
    return 3;
  }

  return 5;
}

export function calculateOverrideBondAmounts(
  baseAmountUsdc: number,
  multiplier: number,
): OverrideBondAmounts {
  const finalAmountUsdc = roundUsdc(baseAmountUsdc * multiplier);

  return {
    baseAmountUsdc: roundUsdc(baseAmountUsdc),
    finalAmountUsdc,
    multiplier,
    portalAmountUsdc: roundUsdc(finalAmountUsdc * 0.2),
    reserveAmountUsdc: roundUsdc(finalAmountUsdc * 0.1),
    vaultAmountUsdc: roundUsdc(finalAmountUsdc * 0.7),
  };
}

export async function getOverrideBondPreview(input: {
  ruleId?: string;
  ruleType: DisciplineRuleType;
  state: ServerDisciplineState;
}) {
  const ledger = await readOverrideBondLedger();
  const overrideCountToday = countOverridesToday(ledger, input.state.walletAddress);
  const multiplier = getOverrideBondMultiplier(overrideCountToday);
  const config = getOverrideBondConfig(input.state, input);

  return {
    bond: calculateOverrideBondAmounts(config.baseAmountUsdc, multiplier),
    overrideCountToday,
  };
}

export async function appendOverrideBondLedgerEntry(input: {
  ruleId?: string;
  ruleType: DisciplineRuleType;
  state: ServerDisciplineState;
  walletAddress?: string;
}) {
  const ledger = await readOverrideBondLedger();
  const walletAddress = input.walletAddress ?? input.state.walletAddress;
  const overrideCountToday = countOverridesToday(ledger, walletAddress);
  const multiplier = getOverrideBondMultiplier(overrideCountToday);
  const config = getOverrideBondConfig(input.state, input);
  const amounts = calculateOverrideBondAmounts(config.baseAmountUsdc, multiplier);
  const entry: OverrideBondLedgerEntry = {
    ...amounts,
    bondId: `override-bond-${Date.now()}-${crypto.randomUUID()}`,
    overrideCountToday: overrideCountToday + 1,
    ruleId: input.ruleId,
    ruleType: input.ruleType,
    source: "simulated",
    status: "posted",
    timestamp: new Date().toISOString(),
    walletAddress,
  };

  await writeOverrideBondLedger([entry, ...ledger]);

  return entry;
}

function countOverridesToday(entries: OverrideBondLedgerEntry[], walletAddress?: string) {
  const todayKey = createTodayKey();

  return entries.filter((entry) => {
    if (walletAddress && entry.walletAddress && entry.walletAddress !== walletAddress) {
      return false;
    }

    return createDayKey(entry.timestamp) === todayKey;
  }).length;
}

function getOverrideBondConfig(
  state: ServerDisciplineState,
  rule: { ruleId?: string; ruleType: DisciplineRuleType },
): ServerDisciplineOverrideBondConfig {
  switch (rule.ruleType) {
    case "blocked_time_window":
      return rule.ruleId
        ? state.overrideBondConfigs.blockedTimeWindows[rule.ruleId] ?? defaultBondConfig()
        : defaultBondConfig();
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
        ? state.overrideBondConfigs.noTradeZones[rule.ruleId] ?? defaultBondConfig()
        : defaultBondConfig();
    case "require_protection":
      return state.overrideBondConfigs.requireProtection;
  }
}

function defaultBondConfig(): ServerDisciplineOverrideBondConfig {
  return {
    enabled: true,
    baseAmountUsdc: 25,
    label: "serious",
  };
}

function sanitizeLedgerEntry(entry: unknown) {
  if (!entry || typeof entry !== "object") {
    return [] as OverrideBondLedgerEntry[];
  }

  const maybeEntry = entry as Partial<OverrideBondLedgerEntry>;
  if (
    typeof maybeEntry.bondId !== "string" ||
    !isRuleType(maybeEntry.ruleType) ||
    maybeEntry.source !== "simulated" ||
    maybeEntry.status !== "posted" ||
    typeof maybeEntry.timestamp !== "string"
  ) {
    return [] as OverrideBondLedgerEntry[];
  }

  return [{
    baseAmountUsdc: sanitizeUsdc(maybeEntry.baseAmountUsdc),
    bondId: maybeEntry.bondId,
    finalAmountUsdc: sanitizeUsdc(maybeEntry.finalAmountUsdc),
    multiplier: sanitizeMultiplier(maybeEntry.multiplier),
    overrideCountToday: sanitizeCount(maybeEntry.overrideCountToday),
    portalAmountUsdc: sanitizeUsdc(maybeEntry.portalAmountUsdc),
    reserveAmountUsdc: sanitizeUsdc(maybeEntry.reserveAmountUsdc),
    ruleId: typeof maybeEntry.ruleId === "string" ? maybeEntry.ruleId : undefined,
    ruleType: maybeEntry.ruleType,
    source: "simulated" as const,
    status: "posted" as const,
    timestamp: maybeEntry.timestamp,
    vaultAmountUsdc: sanitizeUsdc(maybeEntry.vaultAmountUsdc),
    walletAddress: typeof maybeEntry.walletAddress === "string" ? maybeEntry.walletAddress : undefined,
  }];
}

function sanitizeUsdc(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function sanitizeMultiplier(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function sanitizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isRuleType(ruleType: unknown): ruleType is DisciplineRuleType {
  return ruleType === "cooldown_after_loss" ||
    ruleType === "max_daily_loss" ||
    ruleType === "max_trades_per_day" ||
    ruleType === "min_risk_reward" ||
    ruleType === "no_trade_zone";
}

function createTodayKey() {
  return createDayKey(new Date().toISOString());
}

function createDayKey(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("en-CA");
}

function roundUsdc(value: number) {
  return Math.round(value * 100) / 100;
}
