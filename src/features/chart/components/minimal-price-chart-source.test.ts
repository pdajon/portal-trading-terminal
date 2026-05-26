import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("live price marker keeps exchange-native styling instead of Portal glass styling", () => {
  const source = readFileSync(
    "src/features/chart/components/minimal-price-chart.tsx",
    "utf8",
  );

  assert.match(source, /LIVE_PRICE_MARKER_BACKGROUND/);
  const markerStart = source.indexOf("{livePriceAxisMarkerY !== null");
  const markerEnd = source.indexOf("{portalCrosshairGuidePoint ?", markerStart);
  const markerSource = source.slice(markerStart, markerEnd);

  assert.doesNotMatch(markerSource, /border border-cyan-100\/\[0\.11\]/);
  assert.doesNotMatch(
    markerSource,
    /rounded-portal-control border border-cyan/,
  );
});

test("live price marker aligns countdown start with price start", () => {
  const source = readFileSync(
    "src/features/chart/components/minimal-price-chart.tsx",
    "utf8",
  );

  const markerStart = source.indexOf("{livePriceAxisMarkerY !== null");
  const markerEnd = source.indexOf("{portalCrosshairGuidePoint ?", markerStart);
  const markerSource = source.slice(markerStart, markerEnd);

  assert.match(markerSource, /pb-\[2px\] pt-\[3px\] text-left/);
  assert.match(markerSource, /pb-\[3px\] pt-\[1px\] text-left text-\[10px\]/);
  assert.doesNotMatch(markerSource, /text-right/);
});

test("price-axis pointer guard runs before every chart object grab path", () => {
  const source = readFileSync(
    "src/features/chart/components/minimal-price-chart.tsx",
    "utf8",
  );
  const handlerStart = source.indexOf("function handlePointerDown");
  const handlerEnd = source.indexOf("function handlePointerMove", handlerStart);
  const handlerSource = source.slice(handlerStart, handlerEnd);

  assert.ok(
    handlerSource.indexOf("isRightPriceAxisClientX(event.clientX)") <
      handlerSource.indexOf("magicTradeLevelPickActive"),
  );
  assert.ok(
    handlerSource.indexOf("isRightPriceAxisClientX(event.clientX)") <
      handlerSource.indexOf("findTrendLineHitAtPoint"),
  );
  assert.ok(
    handlerSource.indexOf("isRightPriceAxisClientX(event.clientX)") <
      handlerSource.indexOf("getZoneInteractionAtYCoordinate"),
  );
});

test("pending order chips are primitive-backed and not DOM overlays", () => {
  const source = readFileSync(
    "src/features/chart/components/minimal-price-chart.tsx",
    "utf8",
  );
  const handlerStart = source.indexOf("function handlePointerDown");
  const handlerEnd = source.indexOf("function handlePointerMove", handlerStart);
  const chartPointerHandlerSource = source.slice(handlerStart, handlerEnd);

  assert.match(source, /ChartPendingOrderChipPrimitive/);
  assert.doesNotMatch(source, /data-pending-order-drag-handle/);
  assert.doesNotMatch(source, /data-pending-order-cancel-cell/);
  assert.doesNotMatch(
    chartPointerHandlerSource,
    /findPendingOrderAtYCoordinate/,
  );
  assert.match(
    chartPointerHandlerSource,
    /getPendingOrderChipHitFromClientPoint/,
  );
  assert.match(
    chartPointerHandlerSource,
    /pendingOrderChipHit\.target === "cancel"/,
  );
  assert.match(
    chartPointerHandlerSource,
    /pendingOrderPointerDownOrderRef\.current/,
  );
});

test("pending orders do not render legacy armature Limit badges", () => {
  const source = readFileSync(
    "src/features/chart/components/minimal-price-chart.tsx",
    "utf8",
  );

  assert.doesNotMatch(source, /\$\{pendingOrder\.id\}-limit-marker/);
});
