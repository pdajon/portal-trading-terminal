import assert from "node:assert/strict";
import test from "node:test";

import {
  getTradePlanPlacementError,
  isTradePlanLevelDirectionValid,
} from "./trade-plan-direction";

test("validates long trade plan stop and target placement", () => {
  assert.equal(
    isTradePlanLevelDirectionValid({
      direction: "long",
      entry: 100,
      level: "stop",
      price: 99,
    }),
    true,
  );
  assert.equal(
    isTradePlanLevelDirectionValid({
      direction: "long",
      entry: 100,
      level: "stop",
      price: 101,
    }),
    false,
  );
  assert.equal(
    isTradePlanLevelDirectionValid({
      direction: "long",
      entry: 100,
      level: "target",
      price: 101,
    }),
    true,
  );
  assert.equal(
    isTradePlanLevelDirectionValid({
      direction: "long",
      entry: 100,
      level: "target",
      price: 99,
    }),
    false,
  );
});

test("validates short trade plan stop and target placement", () => {
  assert.equal(
    isTradePlanLevelDirectionValid({
      direction: "short",
      entry: 100,
      level: "stop",
      price: 101,
    }),
    true,
  );
  assert.equal(
    isTradePlanLevelDirectionValid({
      direction: "short",
      entry: 100,
      level: "stop",
      price: 99,
    }),
    false,
  );
  assert.equal(
    isTradePlanLevelDirectionValid({
      direction: "short",
      entry: 100,
      level: "target",
      price: 99,
    }),
    true,
  );
  assert.equal(
    isTradePlanLevelDirectionValid({
      direction: "short",
      entry: 100,
      level: "target",
      price: 101,
    }),
    false,
  );
});

test("returns trader-facing placement copy for invalid levels", () => {
  assert.equal(
    getTradePlanPlacementError({
      direction: "short",
      entry: 100,
      level: "stop",
      price: 99,
    }),
    "Short stop loss must be above entry.",
  );
  assert.equal(
    getTradePlanPlacementError({
      direction: "long",
      entry: 100,
      level: "target",
      price: 99,
    }),
    "Long take profit must be above entry.",
  );
  assert.equal(
    getTradePlanPlacementError({
      direction: "long",
      entry: 100,
      level: "stop",
      price: 99,
    }),
    null,
  );
});
