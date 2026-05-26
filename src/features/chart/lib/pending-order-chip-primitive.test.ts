import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPendingOrderChipLayouts,
  getPendingOrderChipPalette,
  hitTestPendingOrderChipLayouts,
  type PendingOrderChipModel,
} from "./pending-order-chip-primitive";

function model(
  overrides: Partial<PendingOrderChipModel> = {},
): PendingOrderChipModel {
  return {
    direction: "long",
    id: "order-1",
    label: "Limit 75,166",
    price: 75166,
    selected: false,
    sizeLabel: "0.00112",
    status: "live",
    ...overrides,
  };
}

test("pending order chip layout keeps badge y locked to price coordinate", () => {
  const [layout] = buildPendingOrderChipLayouts({
    chips: [model()],
    paneHeight: 420,
    paneWidth: 900,
    priceScaleWidth: 68,
    priceToCoordinate: (price) => (price === 75166 ? 188 : null),
  });

  assert.equal(layout.id, "order-1");
  assert.equal(layout.lineY, 188);
  assert.equal(layout.rect.y + layout.rect.height / 2, 188);
});

test("pending order chip hit testing separates drag body from cancel cell", () => {
  const [layout] = buildPendingOrderChipLayouts({
    chips: [model()],
    paneHeight: 420,
    paneWidth: 900,
    priceScaleWidth: 68,
    priceToCoordinate: () => 188,
  });

  assert.equal(
    hitTestPendingOrderChipLayouts(layoutsOrThrow(layout), {
      x: layout.labelRect.x + 8,
      y: layout.labelRect.y + 8,
    })?.target,
    "drag",
  );
  assert.equal(
    hitTestPendingOrderChipLayouts(layoutsOrThrow(layout), {
      x: layout.cancelRect.x + layout.cancelRect.width / 2,
      y: layout.cancelRect.y + layout.cancelRect.height / 2,
    })?.target,
    "cancel",
  );
  assert.equal(
    hitTestPendingOrderChipLayouts(layoutsOrThrow(layout), {
      x: layout.sizeRect.x + 4,
      y: layout.sizeRect.y + 4,
    }),
    null,
  );
});

test("pending order chip clamps x inside pane without moving off the line y", () => {
  const [layout] = buildPendingOrderChipLayouts({
    chips: [model()],
    paneHeight: 260,
    paneWidth: 260,
    priceScaleWidth: 64,
    priceToCoordinate: () => 214,
  });

  assert.ok(layout.rect.x >= 12);
  assert.ok(layout.rect.x + layout.rect.width <= 260 - 64 - 12);
  assert.equal(layout.lineY, 214);
  assert.equal(layout.rect.y + layout.rect.height / 2, 214);
});

test("pending order chip palettes use green for long and red for short with dimmed text", () => {
  const longPalette = getPendingOrderChipPalette("long", false, "live");
  const shortPalette = getPendingOrderChipPalette("short", false, "live");

  assert.match(longPalette.border, /34,\s*197,\s*94/);
  assert.match(shortPalette.border, /239,\s*68,\s*68/);
  assert.match(longPalette.labelText, /0\.7[0-9]\)/);
  assert.match(shortPalette.labelText, /0\.7[0-9]\)/);
  assert.notEqual(longPalette.border, shortPalette.border);
});

function layoutsOrThrow(
  layout: ReturnType<typeof buildPendingOrderChipLayouts>[number] | undefined,
) {
  assert.ok(layout);
  return [layout];
}
