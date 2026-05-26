import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AvatarExpPanel, type AvatarExpProgress } from "./avatar-exp-panel";

const progression: AvatarExpProgress = {
  currentLevelExp: 50,
  expToNextLevel: 68,
  level: 2,
  nextLevelExp: 100,
  progressPercent: 32,
  recentEvents: [
    {
      detail: "BTC-USD",
      exp: 10,
      id: "event-1",
      label: "Journaled trade",
      meta: "Journal",
      tone: "positive",
    },
  ],
  totalExp: 82,
};

test("AvatarExpPanel renders level, total EXP, progress, recent events, sources, and import entry", () => {
  const markup = renderToStaticMarkup(
    createElement(AvatarExpPanel, {
      progression,
      onImportSource: () => undefined,
      onOpenSource: () => undefined,
      sources: [
        {
          detail: "testnet",
          id: "source-1",
          label: "Historical Baseline",
          meta: "42T - $123.45",
          tone: "positive",
        },
      ],
    }),
  );

  assert.match(markup, /Level 2/);
  assert.match(markup, /82 EXP/);
  assert.match(markup, /32%/);
  assert.match(markup, /Journaled trade/);
  assert.match(markup, /BTC-USD/);
  assert.match(markup, /\+10/);
  assert.match(markup, /Historical Baseline/);
  assert.match(markup, /42T - \$123.45/);
  assert.match(markup, /Import Source/);
});

test("AvatarExpPanel renders an empty source state without creating local state", () => {
  const markup = renderToStaticMarkup(
    createElement(AvatarExpPanel, {
      progression: {
        currentLevelExp: 0,
        expToNextLevel: 50,
        level: 1,
        nextLevelExp: 50,
        progressPercent: 0,
        recentEvents: [],
        totalExp: 0,
      },
      onImportSource: () => undefined,
      sources: [],
    }),
  );

  assert.match(markup, /Level 1/);
  assert.match(markup, /0 EXP/);
  assert.match(markup, /No EXP events yet/);
  assert.match(markup, /No sources connected yet/);
  assert.match(markup, /0%/);
});
