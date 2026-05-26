#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const defaultPortalStateDirectory = join(repoRoot, ".portal");

const disciplineStatePath = process.env.PORTAL_DISCIPLINE_STATE_PATH
  ? resolve(process.env.PORTAL_DISCIPLINE_STATE_PATH)
  : join(defaultPortalStateDirectory, "discipline-state.json");
const overrideBondLedgerPath = process.env.PORTAL_OVERRIDE_BOND_LEDGER_PATH
  ? resolve(process.env.PORTAL_OVERRIDE_BOND_LEDGER_PATH)
  : join(defaultPortalStateDirectory, "override-bond-ledger.json");

const PORTAL_LOCAL_STORAGE_KEYS = [
  "portal.chart-levels",
  "portal.chart-line-triggers",
  "portal.chart-trend-lines",
  "portal.chart-zones",
  "portal.active-position",
  "portal.active-trade-plan",
  "portal.pending-limit-orders",
  "portal.min-rr",
  "portal.discipline-rules",
  "portal.discipline-tracking",
  "portal.session-log",
  "portal.journal",
  "portal.journal.memoryEvents",
  "portal.journal-setup-tags",
  "portal.journal-settings",
  "portal.baseline-import",
  "portal.tag-along-rules",
  "portal.tag-along-execution-records",
  "portal.magic-trade-market-uses",
];

const PORTAL_SESSION_STORAGE_KEYS = ["portal.footer-tab"];

main().catch((error) => {
  console.error(`Portal demo reset failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.has("help")) {
    printHelp();
    return;
  }

  const baseUrl = args.values.get("base-url") ?? process.env.PORTAL_DEMO_BASE_URL ?? null;
  const strictExchange = args.flags.has("strict-exchange");
  const localOnly = args.flags.has("local-only");
  const skipBackup = args.flags.has("no-backup");

  const backupDirectory = skipBackup ? null : await backupCurrentState();
  await resetFileBackedState();
  const removedTempFiles = await removeOrphanTempFiles();

  console.log("Portal demo state reset");
  console.log(`- Discipline state: neutral (${disciplineStatePath})`);
  console.log(`- Override Bond ledger: cleared (${overrideBondLedgerPath})`);
  console.log(`- Orphan temp files removed: ${removedTempFiles}`);
  console.log(`- Backup: ${backupDirectory ?? "skipped"}`);

  if (!localOnly && baseUrl) {
    await resetExchangeState(baseUrl, strictExchange);
    console.log(`- Browser cleanup URL: ${baseUrl}/portal-demo-reset.html`);
  } else {
    console.log("- Exchange cleanup: skipped");
    console.log("  Pass --base-url http://localhost:3002 to close testnet exposure through the local API.");
    console.log("  Open /portal-demo-reset.html on the local Portal server to clear browser storage.");
  }

  printBrowserResetSnippet();
}

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      flags.add("help");
      continue;
    }

    if (arg === "--strict-exchange" || arg === "--local-only" || arg === "--no-backup") {
      flags.add(arg.slice(2));
      continue;
    }

    if (arg === "--base-url") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--base-url requires a URL value.");
      }
      values.set("base-url", value.replace(/\/$/, ""));
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { flags, values };
}

function printHelp() {
  console.log(`Usage:
  node scripts/reset-demo-state.mjs
  node scripts/reset-demo-state.mjs --base-url http://localhost:3002 --strict-exchange

Options:
  --base-url <url>       Local Portal server used for testnet close/cancel/verify calls.
  --strict-exchange      Fail if live positions or pending orders remain after API cleanup.
  --local-only           Reset only file-backed local state.
  --no-backup            Skip .portal backup creation before reset.
  --help                 Show this help.
`);
}

async function backupCurrentState() {
  const backupDirectory = join(defaultPortalStateDirectory, "demo-reset-backups", createBackupStamp());
  const filesToBackup = [disciplineStatePath, overrideBondLedgerPath].filter((path) => existsSync(path));

  if (filesToBackup.length === 0) {
    return null;
  }

  await mkdir(backupDirectory, { recursive: true });

  for (const filePath of filesToBackup) {
    const rawFile = await readFile(filePath);
    await writeFile(join(backupDirectory, basename(filePath)), rawFile);
  }

  return backupDirectory;
}

async function resetFileBackedState() {
  await writeJsonAtomic(disciplineStatePath, createNeutralDisciplineState());
  await writeJsonAtomic(overrideBondLedgerPath, []);
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function removeOrphanTempFiles() {
  let removedCount = 0;
  const fileGroups = [
    { directory: dirname(disciplineStatePath), prefix: `${basename(disciplineStatePath)}.` },
    { directory: dirname(overrideBondLedgerPath), prefix: `${basename(overrideBondLedgerPath)}.` },
  ];

  for (const group of fileGroups) {
    let entries = [];
    try {
      entries = await readdir(group.directory);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.startsWith(group.prefix) || !entry.endsWith(".tmp")) {
        continue;
      }

      await rm(join(group.directory, entry), { force: true });
      removedCount += 1;
    }
  }

  return removedCount;
}

async function resetExchangeState(baseUrl, strictExchange) {
  console.log(`- Exchange cleanup: ${baseUrl}`);

  await requestJson(`${baseUrl}/api/close-all`, { method: "POST" });
  await requestJson(`${baseUrl}/api/cancel-all-orders`, { method: "POST" });

  const livePositionsPayload = await requestJson(`${baseUrl}/api/live-positions?fresh=1`);
  const pendingOrdersPayload = await requestJson(`${baseUrl}/api/pending-orders?fresh=1`);
  const livePositions = Array.isArray(livePositionsPayload.positions) ? livePositionsPayload.positions : [];
  const pendingOrders = Array.isArray(pendingOrdersPayload.pendingOrders) ? pendingOrdersPayload.pendingOrders : [];

  console.log(`  Live positions: ${JSON.stringify(livePositions)}`);
  console.log(`  Pending orders: ${JSON.stringify(pendingOrders)}`);

  if (strictExchange && (livePositions.length > 0 || pendingOrders.length > 0)) {
    throw new Error("Exchange cleanup finished but live positions or pending orders remain.");
  }
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : response.statusText;
    throw new Error(`${url} returned ${response.status}: ${message}`);
  }

  return payload;
}

function createNeutralDisciplineState() {
  const now = new Date();

  return {
    activeTradePlan: null,
    blockedTimeWindows: [],
    disciplineLocked: false,
    marketEntryConfirmation: {
      enabled: false,
      mode: "confirm_required",
      state: "inactive",
    },
    noTradeZones: [],
    overrideBondConfigs: {
      blockedTimeWindows: {},
      cooldownAfterLossMinutes: defaultOverrideBondConfig(),
      maxDailyLoss: defaultOverrideBondConfig(),
      maxTradesPerDay: defaultOverrideBondConfig(),
      minRiskReward: defaultOverrideBondConfig(),
      noTradeZones: {},
      requireProtection: defaultOverrideBondConfig(),
    },
    pendingOrders: [],
    requireProtection: {
      enabled: false,
      mode: "stop_loss_required",
    },
    rules: {
      cooldownAfterLossMinutes: null,
      maxDailyLoss: null,
      maxTradesPerDay: null,
      minRiskReward: null,
    },
    ruleStates: {
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
    },
    source: "system",
    tracking: {
      cooldownRemainingMs: 0,
      dayKey: now.toLocaleDateString("en-CA"),
      lastLosingTradeAt: null,
      realizedPnlToday: 0,
      tradesPlacedToday: 0,
    },
    updatedAt: now.toISOString(),
    version: Date.now(),
  };
}

function defaultOverrideBondConfig() {
  return {
    enabled: true,
    baseAmountUsdc: 25,
    label: "serious",
  };
}

function createBackupStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function printBrowserResetSnippet() {
  console.log("");
  console.log("Browser storage reset snippet for the open /terminal tab:");
  console.log("```js");
  console.log(`for (const key of ${JSON.stringify(PORTAL_LOCAL_STORAGE_KEYS)}) localStorage.removeItem(key);`);
  console.log(`for (const key of ${JSON.stringify(PORTAL_SESSION_STORAGE_KEYS)}) sessionStorage.removeItem(key);`);
  console.log(`indexedDB.deleteDatabase("portal-baseline-import-payloads");`);
  console.log("location.reload();");
  console.log("```");
}
