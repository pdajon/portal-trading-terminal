import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AvatarSoulPanel } from "./avatar-soul-panel";

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

test("AvatarSoulPanel renders compact AI, diagnosis, source, and system summaries", () => {
  const markup = renderToStaticMarkup(
    createElement(AvatarSoulPanel, {
      coachState: "Warning",
      diagnosis: {
        confidence: "Low",
        generatedAtLabel: "11:42",
        planStatus: "review ready",
        planSummary: "Review cooldown and market-entry rules.",
        planTitle: "Reduce revenge risk",
        profitLeaks: [
          {
            id: "leak-1",
            severity: "warning",
            signalCount: 3,
            summary: "Trades after losses are underperforming.",
            title: "Post-loss behavior",
          },
        ],
        readyRuleCount: 1,
        recommendedRuleCount: 2,
        sampleSize: 4,
        strengths: [
          {
            id: "strength-1",
            severity: "positive",
            signalCount: 2,
            summary: "Protected exits are holding up.",
            title: "Protection respected",
          },
        ],
      },
      dismissedWarningCount: 2,
      observations: [
        {
          body: "Discipline layer is active.",
          details: ["2 rules active"],
          id: "discipline",
          state: "Watching",
          title: "Discipline",
        },
      ],
      onDismissRecommendation: () => undefined,
      onReviewRecommendation: () => undefined,
      onShowLessRecommendation: () => undefined,
      onSnoozeRecommendation: () => undefined,
      recommendations: [
        {
          dismissalCount: 3,
          evidenceSummary: "At least one trade had no protection.",
          id: "rec-1",
          severity: "critical",
          showLessAvailable: true,
          suggestedRule: "Require stop loss or take profit protection before new risk.",
          title: "Require Protection",
          type: "require_protection",
        },
      ],
      sources: [
        {
          detail: "testnet",
          id: "source-1",
          label: "Historical Baseline",
          meta: "42T - $100.00",
          tone: "positive",
        },
      ],
      systemInsights: [
        {
          label: "Sources",
          value: "1 linked",
        },
      ],
      warnings: [
        {
          id: "warning-1",
          message: "Wait for candle close.",
          severity: "warning",
          source: "operator diagnosis",
          symbol: "BTC-USD",
          title: "Early entry risk",
        },
      ],
    }),
  );

  assert.match(markup, /Active Warnings/);
  assert.match(markup, /Early entry risk/);
  assert.match(markup, /Recent Observations/);
  assert.match(markup, /Discipline layer is active/);
  assert.match(markup, /Soul Recommendations/);
  assert.match(markup, /Require Protection/);
  assert.match(markup, /At least one trade had no protection/);
  assert.match(markup, /Ignore/);
  assert.match(markup, /Snooze/);
  assert.match(markup, /Review Rule/);
  assert.match(markup, /Show These Warnings Less/);
  assert.match(markup, /Diagnosis/);
  assert.match(markup, /Post-loss behavior/);
  assert.match(markup, /Protection respected/);
  assert.match(markup, /Imported Sources/);
  assert.match(markup, /Historical Baseline/);
  assert.match(markup, /2 hidden/);
});

test("AvatarSoulPanel renders calm empty states without local state", () => {
  const markup = renderToStaticMarkup(
    createElement(AvatarSoulPanel, {
      coachState: "Watching",
      diagnosis: {
        confidence: "Low",
        generatedAtLabel: "--",
        planStatus: "review ready",
        planSummary: "Portal needs more evidence.",
        planTitle: "No plan yet",
        profitLeaks: [],
        readyRuleCount: 0,
        recommendedRuleCount: 0,
        sampleSize: 0,
        strengths: [],
      },
      dismissedWarningCount: 0,
      observations: [],
      recommendations: [],
      sources: [],
      systemInsights: [],
      warnings: [],
    }),
  );

  assert.match(markup, /No active warnings/);
  assert.match(markup, /No Soul recommendations yet/);
  assert.match(markup, /Awaiting stronger coach signal/);
  assert.match(markup, /Not enough evidence yet/);
  assert.match(markup, /No imported sources connected/);
});

test("AvatarSoulPanel routes local recommendation actions with the recommendation id", () => {
  const actions: string[] = [];
  const element = AvatarSoulPanel({
    coachState: "Warning",
    diagnosis: {
      confidence: "Low",
      generatedAtLabel: "--",
      planStatus: "review ready",
      planSummary: "Portal needs more evidence.",
      planTitle: "No plan yet",
      profitLeaks: [],
      readyRuleCount: 0,
      recommendedRuleCount: 0,
      sampleSize: 0,
      strengths: [],
    },
    dismissedWarningCount: 0,
    observations: [],
    onDismissRecommendation: (id) => actions.push(`ignore:${id}`),
    onReviewRecommendation: (id) => actions.push(`review:${id}`),
    onShowLessRecommendation: (id) => actions.push(`show-less:${id}`),
    onSnoozeRecommendation: (id) => actions.push(`snooze:${id}`),
    recommendations: [
      {
        dismissalCount: 3,
        evidenceSummary: "At least one trade had no protection.",
        id: "rec-1",
        severity: "critical",
        showLessAvailable: true,
        suggestedRule: "Require stop loss or take profit protection before new risk.",
        title: "Require Protection",
        type: "require_protection",
      },
    ],
    sources: [],
    systemInsights: [],
    warnings: [],
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
    "ignore:rec-1",
    "snooze:rec-1",
    "review:rec-1",
    "show-less:rec-1",
  ]);
});
