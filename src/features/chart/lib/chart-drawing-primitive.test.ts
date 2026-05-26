import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChartTrendLine } from "@/features/chart/types";

import {
  buildChartDrawingRenderItems,
  ChartDrawingPrimitive,
  ChartDrawingPrimitiveRenderer,
  findChartDrawingHit,
} from "./chart-drawing-primitive";

function line(overrides: Partial<ChartTrendLine> = {}): ChartTrendLine {
  return {
    createdAt: "2026-05-17T00:00:00.000Z",
    endPrice: 80,
    endTime: 220,
    id: "trend-1",
    source: "context-menu-two-point",
    startPrice: 100,
    startTime: 100,
    symbol: "BTC-USD",
    ...overrides,
  };
}

test("builds stable drawing geometry from logical chart coordinates", () => {
  const items = buildChartDrawingRenderItems({
    candles: [{ time: 100 }, { time: 160 }, { time: 220 }],
    draftLine: null,
    hoveredLineId: null,
    lines: [
      line(),
      line({ id: "hidden", isHidden: true }),
      line({ id: "wrong-symbol", symbol: "ETH-USD" }),
    ],
    paneHeight: 240,
    priceToCoordinate: (price) => 200 - price,
    selectedLineId: null,
    symbol: "BTC-USD",
    timeToCoordinate: (time) => time / 2,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "trend-1");
  assert.equal(items[0].startX, 50);
  assert.equal(items[0].endX, 110);
  assert.equal(items[0].startY, 100);
  assert.equal(items[0].endY, 120);
});

test("builds vertical rays and draft drawings inside the chart pane", () => {
  const items = buildChartDrawingRenderItems({
    candles: [{ time: 100 }, { time: 160 }, { time: 220 }],
    draftLine: {
      endPrice: 90,
      endTime: 160,
      id: "draft",
      source: "context-menu-two-point",
      startPrice: 95,
      startTime: 100,
      symbol: "BTC-USD",
    },
    hoveredLineId: null,
    lines: [
      line({
        endPrice: 100,
        endTime: 160,
        id: "ray-1",
        source: "context-menu-vertical-ray",
        startPrice: 100,
        startTime: 160,
      }),
    ],
    paneHeight: 240,
    priceToCoordinate: (price) => 200 - price,
    selectedLineId: "ray-1",
    symbol: "BTC-USD",
    timeToCoordinate: (time) => time / 2,
  });

  assert.deepEqual(
    items.map((item) => [item.id, item.tool, item.startX, item.endX, item.endY]),
    [
      ["ray-1", "vertical-ray", 80, 80, 240],
      ["draft", "trend-line", 50, 80, 110],
    ],
  );
  assert.equal(items[0].selected, true);
});

test("uses the rendered drawing geometry for trend-line hit testing", () => {
  const [item] = buildChartDrawingRenderItems({
    candles: [{ time: 100 }, { time: 160 }, { time: 220 }],
    draftLine: null,
    hoveredLineId: null,
    lines: [line()],
    paneHeight: 240,
    priceToCoordinate: (price) => 200 - price,
    selectedLineId: null,
    symbol: "BTC-USD",
    timeToCoordinate: (time) => time / 2,
  });

  assert.equal(findChartDrawingHit([item], { x: 50, y: 100 })?.mode, "start");
  assert.equal(findChartDrawingHit([item], { x: 110, y: 120 })?.mode, "end");
  assert.equal(findChartDrawingHit([item], { x: 80, y: 110 })?.mode, "body");
  assert.equal(findChartDrawingHit([item], { x: 80, y: 150 }), null);
});

test("primitive updates pane data and returns no renderer when empty", () => {
  let updates = 0;
  const primitive = new ChartDrawingPrimitive();

  primitive.attached({
    chart: {
      timeScale: () => ({
        logicalToCoordinate: (logical: number) => logical * 10,
      }),
    },
    horzScaleBehavior: {},
    requestUpdate: () => {
      updates += 1;
    },
    series: {
      priceToCoordinate: (price: number) => 200 - price,
    },
  } as never);

  primitive.setDrawings({
    candles: [{ time: 100 }, { time: 160 }, { time: 220 }],
    draftLine: null,
    hoveredLineId: null,
    lines: [line()],
    paneHeight: 240,
    selectedLineId: null,
    symbol: "BTC-USD",
  });

  assert.ok(updates > 0);
  assert.ok(primitive.paneViews()[0].renderer());

  primitive.setDrawings({
    candles: [{ time: 100 }, { time: 160 }, { time: 220 }],
    draftLine: null,
    hoveredLineId: null,
    lines: [],
    paneHeight: 240,
    selectedLineId: null,
    symbol: "BTC-USD",
  });

  assert.equal(primitive.paneViews()[0].renderer(), null);
});

test("primitive renderer reprojects trend lines from the latest chart scales", () => {
  let xMultiplier = 10;
  let yBase = 200;
  let yMultiplier = 1;
  const primitive = new ChartDrawingPrimitive();

  primitive.attached({
    chart: {
      timeScale: () => ({
        logicalToCoordinate: (logical: number) => logical * xMultiplier,
      }),
    },
    horzScaleBehavior: {},
    requestUpdate: () => {},
    series: {
      priceToCoordinate: (price: number) => yBase - price * yMultiplier,
    },
  } as never);

  primitive.setDrawings({
    candles: [{ time: 100 }, { time: 160 }, { time: 220 }],
    draftLine: null,
    hoveredLineId: null,
    lines: [line()],
    paneHeight: 240,
    selectedLineId: null,
    symbol: "BTC-USD",
  });

  assert.deepEqual(drawFirstTrendPath(primitive), [
    ["moveTo", 0, 100],
    ["lineTo", 20, 120],
  ]);

  xMultiplier = 20;
  yBase = 400;
  yMultiplier = 2;

  assert.deepEqual(drawFirstTrendPath(primitive), [
    ["moveTo", 0, 200],
    ["lineTo", 40, 240],
  ]);
});

test("renderer clips drawing paint to the chart pane before stroking", () => {
  const operations: string[] = [];
  const context = {
    beginPath: () => operations.push("beginPath"),
    clip: () => operations.push("clip"),
    lineTo: () => operations.push("lineTo"),
    moveTo: () => operations.push("moveTo"),
    rect: (x: number, y: number, width: number, height: number) =>
      operations.push(`rect:${x},${y},${width},${height}`),
    restore: () => operations.push("restore"),
    save: () => operations.push("save"),
    setLineDash: () => {},
    stroke: () => operations.push("stroke"),
    fillText: () => {},
    measureText: (text: string) => ({ width: text.length * 7 }),
    fillRect: () => {},
    roundRect: () => {},
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    set fillStyle(_value: string) {},
    set font(_value: string) {},
    set globalAlpha(_value: number) {},
    set lineCap(_value: CanvasLineCap) {},
    set lineWidth(_value: number) {},
    set strokeStyle(_value: string) {},
    set textBaseline(_value: CanvasTextBaseline) {},
  };
  const renderer = new ChartDrawingPrimitiveRenderer([
    {
      endX: 260,
      endY: 120,
      fibonacciLevels: [],
      hovered: false,
      id: "trend-1",
      isDraft: false,
      isLocked: false,
      measurementLabel: null,
      selected: false,
      startX: -40,
      startY: 100,
      tool: "trend-line",
    },
  ]);

  renderer.draw({
    useBitmapCoordinateSpace: (callback: (scope: unknown) => void) =>
      callback({
        bitmapSize: { height: 200, width: 240 },
        context,
        horizontalPixelRatio: 1,
        verticalPixelRatio: 1,
      }),
  } as never);

  assert.deepEqual(operations.slice(0, 4), [
    "save",
    "beginPath",
    "rect:0,0,240,200",
    "clip",
  ]);
  assert.ok(operations.indexOf("clip") < operations.indexOf("stroke"));
});

function drawFirstTrendPath(
  primitive: ChartDrawingPrimitive,
): Array<["moveTo" | "lineTo", number, number]> {
  const operations: Array<["moveTo" | "lineTo", number, number]> = [];
  const renderer = primitive.paneViews()[0].renderer();

  assert.ok(renderer);

  renderer.draw({
    useBitmapCoordinateSpace: (callback: (scope: unknown) => void) =>
      callback({
        bitmapSize: { height: 240, width: 360 },
        context: {
          beginPath: () => {},
          clip: () => {},
          lineTo: (x: number, y: number) =>
            operations.push(["lineTo", x, y]),
          moveTo: (x: number, y: number) =>
            operations.push(["moveTo", x, y]),
          rect: () => {},
          restore: () => {},
          save: () => {},
          setLineDash: () => {},
          stroke: () => {},
          fillText: () => {},
          measureText: (text: string) => ({ width: text.length * 7 }),
          fillRect: () => {},
          roundRect: () => {},
          createLinearGradient: () => ({
            addColorStop: () => {},
          }),
          set fillStyle(_value: string) {},
          set font(_value: string) {},
          set globalAlpha(_value: number) {},
          set lineCap(_value: CanvasLineCap) {},
          set lineWidth(_value: number) {},
          set strokeStyle(_value: string) {},
          set textBaseline(_value: CanvasTextBaseline) {},
        },
        horizontalPixelRatio: 1,
        verticalPixelRatio: 1,
      }),
  } as never);

  return operations.slice(0, 2);
}
