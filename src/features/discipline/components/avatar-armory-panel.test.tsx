import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AvatarArmoryPanel } from "./avatar-armory-panel";

test("AvatarArmoryPanel renders compact discipline controls", () => {
  const markup = renderToStaticMarkup(
    createElement(AvatarArmoryPanel, {
      activeRuleCount: 3,
      blockedTimeWindows: [
        {
          enabled: true,
          id: "weak-window",
          label: "Weak Window",
          onToggle: () => undefined,
          state: "locked",
          value: "10:00-11:00",
        },
      ],
      controls: [
        {
          detail: "Blocks new entries after the daily loss floor.",
          enabled: true,
          id: "max-daily-loss",
          label: "Max Daily Loss",
          onToggle: () => undefined,
          tone: "danger",
          value: "-$100.00 floor",
        },
        {
          detail: "Starts a cooldown after a losing trade.",
          enabled: true,
          id: "cooldown-after-loss",
          label: "Cooldown After Loss",
          onToggle: () => undefined,
          tone: "warning",
          value: "15m",
        },
      ],
      statusLabel: "Blocked",
    }),
  );

  assert.match(markup, /Discipline Controls/);
  assert.match(markup, /Blocked/);
  assert.match(markup, /Toggle the active rule set/);
  assert.match(markup, /Max Daily Loss/);
  assert.match(markup, /-\$100.00 floor/);
  assert.match(markup, /Cooldown After Loss/);
  assert.match(markup, /15m/);
  assert.doesNotMatch(markup, /Require Protection/);
  assert.doesNotMatch(markup, /Market Entry Confirmation/);
  assert.match(markup, /Blocked Windows/);
  assert.match(markup, /Weak Window/);
  assert.match(markup, /10:00-11:00/);
  assert.doesNotMatch(markup, /Shell Matrix/);
  assert.doesNotMatch(markup, /Override Bond/);
});

test("AvatarArmoryPanel renders no blocked windows when none exist", () => {
  const markup = renderToStaticMarkup(
    createElement(AvatarArmoryPanel, {
      activeRuleCount: 0,
      blockedTimeWindows: [],
      controls: [
        {
          enabled: false,
          id: "cooldown-after-loss",
          label: "Cooldown After Loss",
          onToggle: () => undefined,
          value: "Off",
        },
      ],
      statusLabel: "Off",
    }),
  );

  assert.match(markup, /Cooldown After Loss/);
  assert.match(markup, /Off/);
  assert.doesNotMatch(markup, /Blocked Windows/);
});
