import assert from "node:assert/strict";
import test from "node:test";

import { deriveAvatarEyeOffset } from "./avatar-motion";

const avatarRect = {
  height: 200,
  left: 100,
  top: 200,
  width: 240,
};

test("deriveAvatarEyeOffset returns a resting gaze without pointer context", () => {
  assert.deepEqual(
    deriveAvatarEyeOffset({ avatarRect, pointer: null }),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    deriveAvatarEyeOffset({ avatarRect: null, pointer: { x: 200, y: 300 } }),
    { x: 0, y: 0 },
  );
});

test("deriveAvatarEyeOffset keeps the gaze centered at the avatar center", () => {
  assert.deepEqual(
    deriveAvatarEyeOffset({
      avatarRect,
      pointer: { x: 220, y: 300 },
    }),
    { x: 0, y: 0 },
  );
});

test("deriveAvatarEyeOffset responds clearly before the cursor reaches the edge", () => {
  assert.deepEqual(
    deriveAvatarEyeOffset({
      avatarRect,
      maxOffset: 10,
      pointer: { x: 280, y: 325 },
    }),
    { x: 6.75, y: 3.11 },
  );
});

test("deriveAvatarEyeOffset follows and clamps distant cursor movement with stronger upward gaze", () => {
  assert.deepEqual(
    deriveAvatarEyeOffset({
      avatarRect,
      maxOffset: 8,
      pointer: { x: 820, y: 900 },
    }),
    { x: 8, y: 7.36 },
  );
  assert.deepEqual(
    deriveAvatarEyeOffset({
      avatarRect,
      maxOffset: 8,
      pointer: { x: -400, y: -200 },
    }),
    { x: -8, y: -10.8 },
  );
});

test("deriveAvatarEyeOffset ignores unusable avatar bounds", () => {
  assert.deepEqual(
    deriveAvatarEyeOffset({
      avatarRect: { ...avatarRect, height: 0 },
      pointer: { x: 820, y: 900 },
    }),
    { x: 0, y: 0 },
  );
});
