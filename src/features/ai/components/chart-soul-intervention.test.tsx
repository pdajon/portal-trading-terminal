import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ChartSoulIntervention,
  ChartSoulInterventionContent,
} from "./chart-soul-intervention";

const recommendation = {
  dismissalCount: 3,
  evidenceSummary: "At least one trade had no protection.",
  id: "soul-rec:missing_protection",
  severity: "critical" as const,
  showLessAvailable: true,
  suggestedRule: "Require stop loss or take profit protection before new risk.",
  title: "Require Protection",
  type: "require_protection",
};

test("ChartSoulIntervention renders a chart-anchored Soul shard with the warning panel closed", () => {
  const markup = renderToStaticMarkup(
    <ChartSoulIntervention
      onIgnore={() => undefined}
      onReviewRule={() => undefined}
      onShowLess={() => undefined}
      onSnooze={() => undefined}
      recommendation={recommendation}
    />,
  );

  assert.match(markup, /data-testid="soul-chart-intervention"/);
  assert.match(markup, /data-teleport-phase="entering"/);
  assert.match(markup, /portal-soul.svg/);
  assert.match(markup, /Open warning/);
  assert.match(markup, /Soul Intervention/);
  assert.match(markup, /Require Protection/);
  assert.match(markup, /At least one trade had no protection/);
  assert.match(
    markup,
    /Require stop loss or take profit protection before new risk/,
  );
  assert.match(markup, /Ignore/);
  assert.match(markup, /Snooze/);
  assert.match(markup, /Review Rule/);
  assert.match(markup, /Show These Warnings Less/);
  assert.doesNotMatch(markup, /<details open/);
  assert.match(markup, /pointer-events-none/);
  assert.match(markup, /pointer-events-auto/);
});

test("ChartSoulIntervention routes restrained local actions", () => {
  const actions: string[] = [];
  const element = ChartSoulInterventionContent({
    onIgnore: (id) => actions.push(`ignore:${id}`),
    onReviewRule: (id) => actions.push(`review:${id}`),
    onShowLess: (id) => actions.push(`show-less:${id}`),
    onSnooze: (id) => actions.push(`snooze:${id}`),
    phase: "active",
    recommendation,
  });

  const buttons = collectButtons(element);
  buttons.find((button) => button.props.children === "Ignore")?.props.onClick();
  buttons.find((button) => button.props.children === "Snooze")?.props.onClick();
  buttons
    .find((button) => button.props.children === "Review Rule")
    ?.props.onClick();
  buttons
    .find((button) => button.props.children === "Show These Warnings Less")
    ?.props.onClick();

  assert.deepEqual(actions, [
    "ignore:soul-rec:missing_protection",
    "snooze:soul-rec:missing_protection",
    "review:soul-rec:missing_protection",
    "show-less:soul-rec:missing_protection",
  ]);
});

function collectButtons(node: unknown, buttons: Array<{ props: any }> = []) {
  if (node === null || typeof node !== "object") {
    return buttons;
  }

  const element = node as {
    props?: { children?: unknown };
    type?: unknown;
  };

  if (element.type === "button") {
    buttons.push(element as { props: any });
  }

  const children = element.props?.children;
  if (Array.isArray(children)) {
    children.forEach((child) => collectButtons(child, buttons));
  } else {
    collectButtons(children, buttons);
  }

  return buttons;
}
