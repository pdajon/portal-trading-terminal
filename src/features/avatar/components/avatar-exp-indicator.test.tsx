import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AvatarExpIndicator } from "./avatar-exp-indicator";
import type { AvatarExpProgress } from "./avatar-exp-panel";

const progression: AvatarExpProgress = {
  currentLevelExp: 50,
  expToNextLevel: 68,
  level: 2,
  nextLevelExp: 100,
  progressPercent: 32,
  recentEvents: [],
  totalExp: 82,
};

test("AvatarExpIndicator renders compact level, total EXP, and progress", () => {
  const markup = renderToStaticMarkup(
    createElement(AvatarExpIndicator, { progression }),
  );

  assert.match(markup, /LV 2/);
  assert.match(markup, /82 EXP/);
  assert.match(markup, /32%/);
  assert.match(markup, /aria-label="Avatar EXP level 2, 82 total EXP"/);
});
