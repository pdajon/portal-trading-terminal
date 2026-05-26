import assert from "node:assert/strict";
import test from "node:test";

import {
  CHART_INDICATOR_OPTIONS,
  CHART_SETTINGS_OPTIONS,
  CHART_PRICE_SCALE_UTILITY_OPTIONS,
  CHART_SERIES_STYLE_OPTIONS,
  DEFAULT_CHART_SETTINGS,
  CHART_RANGE_CALENDAR_OPTIONS,
  CHART_RANGE_PRIMARY_OPTIONS,
  formatChartUtilityClock,
  formatChartActiveCountLabel,
  getChartRangeStart,
  getChartIndicatorActiveCount,
  getChartChromePrimaryIntervals,
  formatChartChromeTimeframeLabel,
  formatChartChromeTitle,
  getChartScaleUtilityStatus,
  getChartSettingsActiveCount,
  formatChartCandleCountdown,
} from "./chart-chrome";

test("chart chrome exposes the Hyperliquid-style primary interval strip", () => {
  assert.deepEqual(
    getChartChromePrimaryIntervals().map((interval) => interval.key),
    ["5m", "1h", "1d"],
  );

  assert.deepEqual(
    getChartChromePrimaryIntervals().map((interval) => interval.label),
    ["5m", "1h", "D"],
  );
});

test("chart chrome formats the inline symbol and timeframe title", () => {
  assert.equal(
    formatChartChromeTitle({
      symbol: "BTC-USD",
      timeframe: "5m",
      venue: "Hyperliquid",
    }),
    "BTCUSD · 5 · Hyperliquid",
  );

  assert.equal(formatChartChromeTimeframeLabel("1d"), "D");
  assert.equal(formatChartChromeTimeframeLabel("1h"), "1h");
});

test("chart chrome formats the active candle countdown from the selected timeframe", () => {
  assert.equal(
    formatChartCandleCountdown({
      latestCandleTime: Date.UTC(2026, 4, 20, 17, 45, 0) / 1000,
      nowMs: Date.UTC(2026, 4, 20, 17, 53, 58),
      timeframe: "15m",
    }),
    "06:02",
  );

  assert.equal(
    formatChartCandleCountdown({
      latestCandleTime: Date.UTC(2026, 4, 20, 17, 0, 0) / 1000,
      nowMs: Date.UTC(2026, 4, 20, 17, 7, 0),
      timeframe: "5m",
    }),
    "03:00",
  );

  assert.equal(
    formatChartCandleCountdown({
      latestCandleTime: Date.UTC(2026, 4, 20, 17, 0, 0) / 1000,
      nowMs: Date.UTC(2026, 4, 20, 17, 15, 0),
      timeframe: "1h",
    }),
    "45:00",
  );
});

test("chart chrome style selector stays limited to available Lightweight Charts series", () => {
  assert.deepEqual(
    CHART_SERIES_STYLE_OPTIONS.map((style) => style.key),
    ["candles", "bars", "line", "area", "baseline"],
  );

  assert.deepEqual(
    CHART_SERIES_STYLE_OPTIONS.map((style) => style.label),
    ["Candles", "Bars", "Line", "Area", "Baseline"],
  );
});

test("chart chrome exposes bottom-right scale utility controls", () => {
  assert.deepEqual(
    CHART_PRICE_SCALE_UTILITY_OPTIONS.map((option) => [
      option.key,
      option.label,
    ]),
    [
      ["percent", "%"],
      ["log", "log"],
      ["auto", "auto"],
    ],
  );
});

test("chart chrome formats compact active-count labels for accessibility", () => {
  assert.equal(
    formatChartActiveCountLabel("Chart layers", 8, 17),
    "Chart layers, 8 of 17 active",
  );
  assert.equal(
    formatChartActiveCountLabel("Chart axis settings", 2, 4),
    "Chart axis settings, 2 of 4 active",
  );
});

test("chart chrome summarizes the active price scale utility state", () => {
  assert.deepEqual(
    getChartScaleUtilityStatus({
      autoScaleEnabled: true,
      priceScaleMode: "normal",
    }),
    {
      activeUtilityKeys: ["auto"],
      modeLabel: "Normal",
      statusLabel: "Scale Normal",
    },
  );

  assert.deepEqual(
    getChartScaleUtilityStatus({
      autoScaleEnabled: false,
      priceScaleMode: "percent",
    }),
    {
      activeUtilityKeys: ["percent"],
      modeLabel: "Percent",
      statusLabel: "Scale Percent",
    },
  );

  assert.deepEqual(
    getChartScaleUtilityStatus({
      autoScaleEnabled: true,
      priceScaleMode: "log",
    }),
    {
      activeUtilityKeys: ["log", "auto"],
      modeLabel: "Log",
      statusLabel: "Scale Log",
    },
  );
});

test("chart chrome exposes Hyperliquid-style bottom range controls", () => {
  assert.deepEqual(
    CHART_RANGE_PRIMARY_OPTIONS.map((option) => [option.key, option.label]),
    [
      ["5y", "5y"],
      ["1y", "1y"],
      ["6m", "6m"],
      ["3m", "3m"],
      ["1m", "1m"],
      ["5d", "5d"],
      ["1d", "1d"],
    ],
  );

  assert.deepEqual(
    CHART_RANGE_CALENDAR_OPTIONS.map((option) => [option.key, option.label]),
    [
      ["session", "Session"],
      ["all", "All"],
    ],
  );
});

test("chart chrome resolves range preset start times", () => {
  const latestTime = 1_700_000_000;

  assert.equal(getChartRangeStart("5d", latestTime, []), latestTime - 432_000);
  assert.equal(
    getChartRangeStart("3m", latestTime, []),
    latestTime - 7_776_000,
  );
  assert.equal(
    getChartRangeStart("session", Date.UTC(2026, 4, 17, 18) / 1000, []),
    Date.UTC(2026, 4, 17, 0) / 1000,
  );
  assert.equal(
    getChartRangeStart("all", latestTime, [{ time: 1_699_000_000 }]),
    1_699_000_000,
  );
});

test("chart chrome exposes the compact chart settings drawer options", () => {
  assert.deepEqual(
    CHART_SETTINGS_OPTIONS.map((option) => [
      option.key,
      option.label,
      option.group,
    ]),
    [
      ["grid", "Grid", "Display"],
      ["crosshair", "Crosshair", "Display"],
      ["price-axis", "Price axis", "Scale"],
      ["volume", "Volume pane", "Series"],
    ],
  );
});

test("chart chrome exposes native Lightweight Charts indicator options", () => {
  assert.deepEqual(
    CHART_INDICATOR_OPTIONS.map((option) => [
      option.key,
      option.label,
      option.group,
    ]),
    [
      ["volume", "Volume", "Flow"],
      ["ema20", "EMA 20", "Trend"],
      ["ema50", "EMA 50", "Trend"],
      ["vwap", "VWAP", "Trend"],
      ["rsi", "RSI", "Momentum"],
      ["macd", "MACD", "Momentum"],
      ["atr", "ATR", "Volatility"],
      ["funding", "Funding", "Context"],
      ["openInterest", "Open Interest", "Context"],
    ],
  );
});

test("chart chrome counts active native indicators", () => {
  assert.equal(
    getChartIndicatorActiveCount({
      atr: false,
      ema20: true,
      ema50: false,
      funding: false,
      macd: true,
      openInterest: false,
      rsi: false,
      volume: true,
      vwap: false,
    }),
    3,
  );
});

test("chart chrome counts active compact settings", () => {
  assert.deepEqual(DEFAULT_CHART_SETTINGS, {
    crosshair: true,
    grid: false,
    priceAxis: true,
  });

  assert.equal(
    getChartSettingsActiveCount({
      ...DEFAULT_CHART_SETTINGS,
      volume: true,
    }),
    3,
  );
});

test("chart chrome formats the local chart utility clock with UTC offset", () => {
  assert.deepEqual(
    formatChartUtilityClock(
      new Date("2026-05-17T01:40:54.000Z"),
      "America/Chicago",
    ),
    {
      offsetLabel: "UTC-5",
      timeLabel: "20:40:54",
    },
  );
});
