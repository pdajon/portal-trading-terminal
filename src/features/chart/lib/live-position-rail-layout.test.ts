import assert from "node:assert/strict";
import test from "node:test";
import {
  selectRailDetailSections,
  type RailDetailSectionId,
} from "./live-position-rail-layout";

const orderedSections: RailDetailSectionId[] = [
  "liquidation",
  "entry-mark",
  "value-margin",
  "protection",
  "funding",
  "plan",
];

const sectionHeights: Record<RailDetailSectionId, number> = {
  "entry-mark": 42,
  funding: 28,
  liquidation: 44,
  plan: 48,
  protection: 44,
  "value-margin": 42,
};

test("selectRailDetailSections keeps every section inline when all sections fit", () => {
  const layout = selectRailDetailSections({
    availableHeight: 340,
    coreHeight: 70,
    orderedSectionIds: orderedSections,
    sectionHeights,
    safetyPadding: 12,
  });

  assert.deepEqual(layout.inlineSectionIds, orderedSections);
  assert.deepEqual(layout.overflowSectionIds, []);
  assert.equal(layout.hasOverflow, false);
});

test("selectRailDetailSections moves only the last section into overflow when it cannot fit", () => {
  const layout = selectRailDetailSections({
    availableHeight: 282,
    coreHeight: 70,
    orderedSectionIds: orderedSections,
    sectionHeights,
    safetyPadding: 12,
  });

  assert.deepEqual(layout.inlineSectionIds, [
    "liquidation",
    "entry-mark",
    "value-margin",
    "protection",
    "funding",
  ]);
  assert.deepEqual(layout.overflowSectionIds, ["plan"]);
  assert.equal(layout.hasOverflow, true);
});

test("selectRailDetailSections moves all lower-priority sections into overflow after space runs out", () => {
  const layout = selectRailDetailSections({
    availableHeight: 170,
    coreHeight: 70,
    orderedSectionIds: orderedSections,
    sectionHeights,
    safetyPadding: 12,
  });

  assert.deepEqual(layout.inlineSectionIds, ["liquidation", "entry-mark"]);
  assert.deepEqual(layout.overflowSectionIds, [
    "value-margin",
    "protection",
    "funding",
    "plan",
  ]);
  assert.equal(layout.hasOverflow, true);
});

test("selectRailDetailSections never skips a higher-priority section to fit a lower-priority section", () => {
  const layout = selectRailDetailSections({
    availableHeight: 140,
    coreHeight: 70,
    orderedSectionIds: ["liquidation", "entry-mark", "funding"],
    sectionHeights: {
      "entry-mark": 100,
      funding: 20,
      liquidation: 30,
    },
    safetyPadding: 0,
  });

  assert.deepEqual(layout.inlineSectionIds, ["liquidation"]);
  assert.deepEqual(layout.overflowSectionIds, ["entry-mark", "funding"]);
  assert.equal(layout.hasOverflow, true);
});

test("selectRailDetailSections only considers active plan detail when the plan section is present", () => {
  const layout = selectRailDetailSections({
    availableHeight: 320,
    coreHeight: 70,
    orderedSectionIds: orderedSections.filter((sectionId) => sectionId !== "plan"),
    sectionHeights,
    safetyPadding: 12,
  });

  assert.deepEqual(layout.inlineSectionIds, [
    "liquidation",
    "entry-mark",
    "value-margin",
    "protection",
    "funding",
  ]);
  assert.deepEqual(layout.overflowSectionIds, []);
  assert.equal(layout.hasOverflow, false);
});
