import assert from "node:assert/strict";
import test from "node:test";

import { shouldDismissMarketSelector } from "./market-selector-dismissal";

test("shouldDismissMarketSelector keeps interactions inside the selector open", () => {
  const selectorRoot = {
    contains(target: Node | null) {
      return target?.nodeName === "INPUT" || target?.nodeName === "BUTTON";
    },
  } as HTMLElement;

  assert.equal(
    shouldDismissMarketSelector(selectorRoot, { nodeName: "INPUT" } as Node),
    false,
  );
  assert.equal(
    shouldDismissMarketSelector(selectorRoot, { nodeName: "BUTTON" } as Node),
    false,
  );
});

test("shouldDismissMarketSelector dismisses outside document targets cleanly", () => {
  const selectorRoot = {
    contains() {
      return false;
    },
  } as unknown as HTMLElement;

  assert.equal(
    shouldDismissMarketSelector(selectorRoot, { nodeName: "CANVAS" } as Node),
    true,
  );
});

test("shouldDismissMarketSelector does not dismiss when the root is unavailable", () => {
  assert.equal(
    shouldDismissMarketSelector(null, { nodeName: "CANVAS" } as Node),
    false,
  );
});
