import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChartLayerStackGroups,
  buildChartLayerStackSummary,
  buildChartLayerStorageKey,
  CHART_LAYER_PRESETS,
  DEFAULT_CHART_LAYER_VISIBILITY,
  getChartLayerPresetVisibility,
  normalizeChartLayerVisibility,
  readChartLayerVisibility,
  resolveChartLayerPresetKey,
  writeChartLayerVisibility,
} from "./chart-layer-visibility";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("normalizes chart layer visibility with defaults for new layers", () => {
  assert.deepEqual(
    normalizeChartLayerVisibility({
      ema20: true,
      funding: true,
      levels: false,
      openInterest: true,
      unknownLayer: true,
      volume: true,
    }),
    {
      ...DEFAULT_CHART_LAYER_VISIBILITY,
      ema20: true,
      funding: true,
      levels: false,
      openInterest: true,
      volume: true,
    },
  );
});

test("reads scoped chart layer visibility before falling back to legacy storage", () => {
  const storage = new MemoryStorage();
  storage.setItem("portal.chart-layer-visibility", JSON.stringify({ volume: true }));

  assert.equal(
    readChartLayerVisibility(storage, "BTC-USD", "1m").volume,
    true,
  );

  writeChartLayerVisibility(storage, "ETH-USD", "5m", {
    ...DEFAULT_CHART_LAYER_VISIBILITY,
    ema50: true,
    volume: false,
  });

  const scoped = readChartLayerVisibility(storage, "ETH-USD", "5m");
  assert.equal(scoped.ema50, true);
  assert.equal(scoped.volume, false);
  assert.equal(
    storage.getItem(buildChartLayerStorageKey("ETH-USD", "5m")) !== null,
    true,
  );
});

test("chart layer presets expose intentional operator layer bundles", () => {
  assert.deepEqual(
    CHART_LAYER_PRESETS.map((preset) => preset.key),
    ["execution", "clean", "trend", "context", "all"],
  );

  assert.deepEqual(getChartLayerPresetVisibility("clean"), {
    ...DEFAULT_CHART_LAYER_VISIBILITY,
    atr: false,
    drawings: false,
    ema20: false,
    ema50: false,
    executionMarkers: false,
    funding: false,
    levels: false,
    magicTrade: false,
    macd: false,
    openInterest: false,
    orders: false,
    positions: false,
    rsi: false,
    tradePlan: false,
    volume: false,
    vwap: false,
    zones: false,
  });

  assert.deepEqual(getChartLayerPresetVisibility("context"), {
    ...DEFAULT_CHART_LAYER_VISIBILITY,
    atr: false,
    drawings: true,
    ema20: false,
    ema50: false,
    executionMarkers: true,
    funding: true,
    levels: true,
    magicTrade: true,
    macd: false,
    openInterest: true,
    orders: true,
    positions: true,
    rsi: false,
    tradePlan: true,
    volume: true,
    vwap: false,
    zones: true,
  });
});

test("resolves exact preset visibility and treats manual edits as custom", () => {
  const trendVisibility = getChartLayerPresetVisibility("trend");

  assert.equal(resolveChartLayerPresetKey(trendVisibility), "trend");
  assert.equal(
    resolveChartLayerPresetKey({
      ...trendVisibility,
      funding: true,
    }),
    "custom",
  );
});

test("builds a compact active layer stack summary", () => {
  assert.deepEqual(buildChartLayerStackSummary(DEFAULT_CHART_LAYER_VISIBILITY), {
    activeCount: 8,
    labels: ["Position", "Plan", "Levels", "Zones", "Orders", "Drawings"],
    overflowCount: 2,
    totalCount: 17,
  });

  assert.deepEqual(
    buildChartLayerStackSummary(getChartLayerPresetVisibility("clean")),
    {
      activeCount: 0,
      labels: [],
      overflowCount: 0,
      totalCount: 17,
    },
  );

  assert.deepEqual(
    buildChartLayerStackSummary(getChartLayerPresetVisibility("trend"), 8),
    {
      activeCount: 15,
      labels: [
        "Position",
        "Plan",
        "Levels",
        "Zones",
        "Orders",
        "Volume",
        "EMA 20",
        "EMA 50",
      ],
      overflowCount: 7,
      totalCount: 17,
    },
  );
});

test("groups chart layers into an operator active stack", () => {
  const defaultGroups = buildChartLayerStackGroups(DEFAULT_CHART_LAYER_VISIBILITY);

  assert.deepEqual(
    defaultGroups.map((group) => ({
      activeCount: group.activeCount,
      activeLayerKeys: group.activeLayerKeys,
      key: group.key,
      label: group.label,
      totalCount: group.totalCount,
    })),
    [
      {
        activeCount: 4,
        activeLayerKeys: [
          "positions",
          "tradePlan",
          "orders",
          "executionMarkers",
        ],
        key: "core",
        label: "Core",
        totalCount: 4,
      },
      {
        activeCount: 0,
        activeLayerKeys: [],
        key: "studies",
        label: "Studies",
        totalCount: 7,
      },
      {
        activeCount: 0,
        activeLayerKeys: [],
        key: "context",
        label: "Context",
        totalCount: 2,
      },
      {
        activeCount: 3,
        activeLayerKeys: ["levels", "zones", "drawings"],
        key: "drawings",
        label: "Drawings",
        totalCount: 3,
      },
      {
        activeCount: 1,
        activeLayerKeys: ["magicTrade"],
        key: "automation",
        label: "Automation",
        totalCount: 1,
      },
    ],
  );
});
