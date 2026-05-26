import type {
  BaselineEntryStyleProxy,
  BaselineExecutionMode,
  BaselineImportRequest,
  BaselineImportScanResult,
  BaselineMetricRow,
  BaselineProfile,
} from "@/features/baseline-import/types";
import { buildSessionIntelligence } from "@/features/baseline-import/session-intelligence";
import { resolvePortalTimezone } from "@/features/time/portal-time";

export const BASELINE_IMPORT_STORAGE_KEY = "portal.baseline-import";
export const BASELINE_IMPORT_STORAGE_VERSION = "v1";
export const BASELINE_IMPORT_STORAGE_SOFT_LIMIT_BYTES = 4_500_000;
export const BASELINE_IMPORT_PAYLOAD_DB_NAME = "portal-baseline-import-payloads";
export const BASELINE_IMPORT_PAYLOAD_DB_VERSION = 1;
export const BASELINE_IMPORT_PAYLOAD_STORE_NAME = "baseline-import-bundles";

export type StoredBaselineImportBundle = {
  id: string;
  request: BaselineImportRequest;
  result: BaselineImportScanResult;
  savedAt: string;
  source: "hyperliquid";
  sourceLabel: "Historical Import";
  version: typeof BASELINE_IMPORT_STORAGE_VERSION;
};

export type StoredBaselineImportCollection = StoredBaselineImportBundle[];

export type StoredBaselineImportManifestEntry = Omit<StoredBaselineImportBundle, "result"> & {
  payload: {
    storage: "indexeddb";
    key: string;
  };
  summary: {
    endTime: number;
    fillCount: number;
    netPnl: number;
    orderCount: number;
    sessionCount: number;
    startTime: number;
    timezone: string;
    tradeCount: number;
  };
};

export type StoredBaselineImportManifest = {
  kind: "portal.baseline-import.manifest";
  bundles: StoredBaselineImportManifestEntry[];
  version: typeof BASELINE_IMPORT_STORAGE_VERSION;
};

export type ImportedJournalListRow = {
  direction: "long" | "short";
  durationMinutes: number | null;
  entryPrice: number | null;
  entryStyleProxy: BaselineEntryStyleProxy;
  executionMode: BaselineExecutionMode;
  exitPrice: number | null;
  id: string;
  realizedPnl: number;
  sourceLabel: "Historical Import";
  status: "open" | "closed" | "reversed-fragment";
  symbol: string;
  timestamp: string;
};

export function createStoredBaselineImportBundleId(request: BaselineImportRequest) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(request.accountAddress.trim())) {
    return `hyperliquid-upload:${request.environment}:${request.startTime}:${request.endTime}`;
  }

  return `hyperliquid:${request.environment}:${request.accountAddress.trim().toLowerCase()}`;
}

export function serializeStoredBaselineImportBundles(bundles: StoredBaselineImportCollection) {
  return JSON.stringify(bundles);
}

export function estimateStoredBaselineImportBundlesSizeBytes(bundles: StoredBaselineImportCollection) {
  return new TextEncoder().encode(serializeStoredBaselineImportBundles(bundles)).length;
}

function buildStoredBaselineImportManifestEntry(
  bundle: StoredBaselineImportBundle,
): StoredBaselineImportManifestEntry {
  return {
    id: bundle.id,
    payload: {
      key: bundle.id,
      storage: "indexeddb",
    },
    request: bundle.request,
    savedAt: bundle.savedAt,
    source: bundle.source,
    sourceLabel: bundle.sourceLabel,
    summary: {
      endTime: bundle.request.endTime,
      fillCount: bundle.result.fills.length,
      netPnl: bundle.result.trades.reduce((sum, trade) => sum + trade.netPnl, 0),
      orderCount: bundle.result.orders.length,
      sessionCount: bundle.result.sessionIntelligence?.summary.sessionCount ?? bundle.result.sessions.length,
      startTime: bundle.request.startTime,
      timezone: bundle.request.timezone,
      tradeCount: bundle.result.trades.length,
    },
    version: bundle.version,
  };
}

export function buildStoredBaselineImportManifest(
  bundles: StoredBaselineImportCollection,
): StoredBaselineImportManifest {
  return {
    bundles: bundles.map(buildStoredBaselineImportManifestEntry),
    kind: "portal.baseline-import.manifest",
    version: BASELINE_IMPORT_STORAGE_VERSION,
  };
}

export function serializeStoredBaselineImportManifest(
  bundles: StoredBaselineImportCollection,
) {
  return JSON.stringify(buildStoredBaselineImportManifest(bundles));
}

function isStoredBaselineImportManifestEntry(
  value: unknown,
): value is StoredBaselineImportManifestEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredBaselineImportManifestEntry>;
  return (
    typeof candidate.id === "string" &&
    candidate.version === BASELINE_IMPORT_STORAGE_VERSION &&
    candidate.source === "hyperliquid" &&
    candidate.sourceLabel === "Historical Import" &&
    Boolean(candidate.request) &&
    Boolean(candidate.payload) &&
    candidate.payload?.storage === "indexeddb" &&
    typeof candidate.payload.key === "string"
  );
}

export function parseStoredBaselineImportManifest(raw: string | null) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredBaselineImportManifest>;

    if (
      parsed.kind !== "portal.baseline-import.manifest" ||
      parsed.version !== BASELINE_IMPORT_STORAGE_VERSION ||
      !Array.isArray(parsed.bundles)
    ) {
      return [];
    }

    return parsed.bundles
      .filter(isStoredBaselineImportManifestEntry)
      .map((entry) => ({
        ...entry,
        request: {
          ...entry.request,
          timezone: resolvePortalTimezone(entry.request.timezone),
        },
      }));
  } catch {
    return [];
  }
}

export function formatBaselineSourceWalletAddress(accountAddress: string) {
  const compactAddress = accountAddress.trim().replace(/^0x/i, "");

  if (compactAddress.length === 0) {
    return "unknown";
  }

  if (compactAddress.length <= 6) {
    return compactAddress.toLowerCase();
  }

  return `${compactAddress.slice(0, 3).toLowerCase()}...${compactAddress
    .slice(-3)
    .toLowerCase()}`;
}

export function deleteStoredBaselineImportBundle(
  bundles: StoredBaselineImportCollection,
  bundleId: string,
) {
  return bundles.filter((bundle) => bundle.id !== bundleId);
}

function isStoredBundleCandidate(value: unknown): value is Partial<StoredBaselineImportBundle> {
  return Boolean(value) && typeof value === "object";
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hydrateMetricRows<Key extends string>(rows: BaselineMetricRow<Key>[] | undefined): BaselineMetricRow<Key>[] {
  return (rows ?? []).map((row) => ({
    ...row,
    sampleReliable: row.sampleReliable ?? row.tradeCount >= 10,
  }));
}

function hydrateBaselineProfile(
  profile: BaselineProfile,
  result: BaselineImportScanResult,
  timezone: string,
): BaselineProfile {
  const closedTrades = result.trades.filter((trade) => trade.status !== "open");
  const openTrades = result.trades.filter((trade) => trade.status === "open");
  const closedGrossFees = profile.totals.closedGrossFees ?? closedTrades.reduce((sum, trade) => sum + trade.grossFees, 0);
  const openTradeFees = profile.totals.openTradeFees ?? openTrades.reduce((sum, trade) => sum + trade.grossFees, 0);
  const netPnl = profile.totals.netPnl ?? closedTrades.reduce((sum, trade) => sum + trade.netPnl, 0);

  return {
    ...profile,
    byAsset: hydrateMetricRows(profile.byAsset),
    byDirection: hydrateMetricRows(profile.byDirection),
    byEntryStyleProxy: hydrateMetricRows(profile.byEntryStyleProxy),
    byExecutionMode: hydrateMetricRows(profile.byExecutionMode),
    byHoldTimeBucket: hydrateMetricRows(profile.byHoldTimeBucket),
    byTimeOfDay: hydrateMetricRows(profile.byTimeOfDay),
    dateRange: {
      ...profile.dateRange,
      timezone: resolvePortalTimezone(profile.dateRange?.timezone, timezone),
    },
    totals: {
      ...profile.totals,
      averageClosedTradeNetPnl:
        profile.totals.averageClosedTradeNetPnl ?? average(closedTrades.map((trade) => trade.netPnl)),
      closedGrossFees,
      grossPnlBeforeFees: profile.totals.grossPnlBeforeFees ?? netPnl + closedGrossFees,
      openTradeFees,
    },
  };
}

function hydrateBaselineScanResult(
  result: BaselineImportScanResult,
  request: BaselineImportRequest,
): BaselineImportScanResult {
  const sourceHealth = result.sourceHealth ?? {
    aggregatedFillCount: result.fills.length,
    boundaryFillCount: 0,
    recommendationTradeCount: result.trades.length,
  };
  const warnings = result.warnings ?? result.profile.dataQuality;

  return {
    ...result,
    profile: hydrateBaselineProfile(result.profile, result, request.timezone),
    sessionIntelligence:
      result.sessionIntelligence ??
      buildSessionIntelligence({
        request,
        sourceHealth,
        trades: result.trades,
        warnings,
      }),
    sourceHealth,
    warnings,
  };
}

function normalizeStoredBundle(candidate: Partial<StoredBaselineImportBundle> | null) {
  if (
    !candidate ||
    candidate.version !== BASELINE_IMPORT_STORAGE_VERSION ||
    candidate.source !== "hyperliquid" ||
    candidate.sourceLabel !== "Historical Import" ||
    !candidate.request ||
    !candidate.result
  ) {
    return null;
  }

  const request = {
    ...candidate.request,
    timezone: resolvePortalTimezone(candidate.request.timezone),
  };

  return {
    ...candidate,
    id:
      typeof candidate.id === "string" && candidate.id.length > 0
        ? candidate.id
        : createStoredBaselineImportBundleId(request),
    request,
    result: hydrateBaselineScanResult(candidate.result, request),
  } as StoredBaselineImportBundle;
}

export function parseStoredBaselineImportBundles(raw: string | null) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => (isStoredBundleCandidate(entry) ? normalizeStoredBundle(entry) : null))
        .filter((entry): entry is StoredBaselineImportBundle => entry !== null);
    }

    if (isStoredBundleCandidate(parsed)) {
      const normalized = normalizeStoredBundle(parsed);
      return normalized ? [normalized] : [];
    }

    return [];
  } catch {
    return [];
  }
}

export type BaselineImportPayloadStore = {
  clear(): Promise<void>;
  delete(ids: string[]): Promise<void>;
  get(keys: string[]): Promise<StoredBaselineImportCollection>;
  put(bundles: StoredBaselineImportCollection): Promise<void>;
};

function openBaselineImportPayloadDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB is unavailable for Historical Import storage."),
    );
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(
      BASELINE_IMPORT_PAYLOAD_DB_NAME,
      BASELINE_IMPORT_PAYLOAD_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(BASELINE_IMPORT_PAYLOAD_STORE_NAME)) {
        database.createObjectStore(BASELINE_IMPORT_PAYLOAD_STORE_NAME, {
          keyPath: "id",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createIndexedDbBaselineImportPayloadStore(): BaselineImportPayloadStore {
  async function withStore<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => void,
    resolveValue: () => T,
  ) {
    const database = await openBaselineImportPayloadDatabase();

    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(
        BASELINE_IMPORT_PAYLOAD_STORE_NAME,
        mode,
      );
      const store = transaction.objectStore(BASELINE_IMPORT_PAYLOAD_STORE_NAME);

      callback(store);
      transaction.oncomplete = () => {
        database.close();
        resolve(resolveValue());
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  return {
    async clear() {
      await withStore("readwrite", (store) => store.clear(), () => undefined);
    },
    async delete(ids) {
      await withStore(
        "readwrite",
        (store) => {
          for (const id of ids) {
            store.delete(id);
          }
        },
        () => undefined,
      );
    },
    async get(keys) {
      const bundles: StoredBaselineImportCollection = [];

      await withStore(
        "readonly",
        (store) => {
          for (const key of keys) {
            const request = store.get(key);
            request.onsuccess = () => {
              const bundle = normalizeStoredBundle(
                request.result as Partial<StoredBaselineImportBundle> | null,
              );

              if (bundle) {
                bundles.push(bundle);
              }
            };
          }
        },
        () => undefined,
      );

      const keyOrder = new Map(keys.map((key, index) => [key, index]));
      return bundles.sort(
        (left, right) =>
          (keyOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (keyOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      );
    },
    async put(bundles) {
      await withStore(
        "readwrite",
        (store) => {
          for (const bundle of bundles) {
            store.put(bundle);
          }
        },
        () => undefined,
      );
    },
  };
}

export async function loadStoredBaselineImportBundlesFromLocalStore(
  storage: Storage,
  payloadStore: BaselineImportPayloadStore = createIndexedDbBaselineImportPayloadStore(),
) {
  const raw = storage.getItem(BASELINE_IMPORT_STORAGE_KEY);
  const manifestEntries = parseStoredBaselineImportManifest(raw);

  if (manifestEntries.length > 0) {
    return await payloadStore.get(
      manifestEntries.map((entry) => entry.payload.key),
    );
  }

  return parseStoredBaselineImportBundles(raw);
}

export async function persistStoredBaselineImportBundlesToLocalStore(
  storage: Storage,
  bundles: StoredBaselineImportCollection,
  payloadStore: BaselineImportPayloadStore = createIndexedDbBaselineImportPayloadStore(),
) {
  if (bundles.length === 0) {
    storage.removeItem(BASELINE_IMPORT_STORAGE_KEY);
    await payloadStore.clear();
    return;
  }

  await payloadStore.put(bundles);
  storage.setItem(
    BASELINE_IMPORT_STORAGE_KEY,
    serializeStoredBaselineImportManifest(bundles),
  );
}

export async function deleteStoredBaselineImportBundlePayloads(
  bundleIds: string[],
  payloadStore: BaselineImportPayloadStore = createIndexedDbBaselineImportPayloadStore(),
) {
  await payloadStore.delete(bundleIds);
}

export function buildImportedJournalListRows(bundle: StoredBaselineImportBundle | null): ImportedJournalListRow[] {
  if (!bundle) {
    return [];
  }

  return bundle.result.trades
    .map((trade) => ({
      direction: trade.direction,
      durationMinutes: trade.durationMinutes,
      entryPrice: trade.entryPrice,
      entryStyleProxy: trade.entryStyleProxy,
      executionMode: trade.executionMode,
      exitPrice: trade.exitPrice,
      id: trade.id,
      realizedPnl: trade.netPnl,
      sourceLabel: trade.sourceLabel,
      status: trade.status,
      symbol: trade.coin,
      timestamp: new Date(trade.entryTime).toISOString(),
    }))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}
