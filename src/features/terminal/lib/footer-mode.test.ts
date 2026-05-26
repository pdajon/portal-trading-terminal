import assert from "node:assert/strict";
import test from "node:test";

import {
  BOTTOM_ACTION_ROW_TRADE_HEIGHT,
  BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT,
  FOOTER_DECK_COLLAPSED_HEIGHT,
  FOOTER_TABS,
  footerTabSupportsExpansion,
  resolveFooterHeight,
  shouldUseCompactLivePositionRail,
} from "./footer-mode";

test("FOOTER_TABS preserves the visible command deck order", () => {
  assert.deepEqual(
    FOOTER_TABS.map((tab) => tab.id),
    [
      "trade",
      "positions",
      "open-orders",
      "trade-history",
      "funding-history",
      "order-history",
      "balances",
    ],
  );
});

test("footerTabSupportsExpansion matches non-trade workspace modes", () => {
  assert.equal(footerTabSupportsExpansion("trade"), false);
  assert.equal(footerTabSupportsExpansion("positions"), false);
  assert.equal(footerTabSupportsExpansion("open-orders"), false);
  assert.equal(footerTabSupportsExpansion("trade-history"), false);
  assert.equal(footerTabSupportsExpansion("funding-history"), false);
  assert.equal(footerTabSupportsExpansion("order-history"), false);
  assert.equal(footerTabSupportsExpansion("balances"), false);
  assert.equal(footerTabSupportsExpansion("discipline"), false);
  assert.equal(footerTabSupportsExpansion("settings"), false);
  assert.equal(footerTabSupportsExpansion("journal"), true);
  assert.equal(footerTabSupportsExpansion("ai-coach"), true);
  assert.equal(footerTabSupportsExpansion("diagnosis"), true);
  assert.equal(footerTabSupportsExpansion("session-logs"), true);
});

test("resolveFooterHeight preserves app shell footer priority", () => {
  assert.equal(
    resolveFooterHeight({
      isFooterDeckCollapsed: false,
      isReviewWorkspaceExpanded: false,
      journalSetupGateActive: false,
      magicTradeChartPickActive: true,
      selectedFooterTab: "trade",
      viewportHeight: 900,
    }),
    0,
  );
  assert.equal(
    resolveFooterHeight({
      isFooterDeckCollapsed: true,
      isReviewWorkspaceExpanded: true,
      journalSetupGateActive: false,
      magicTradeChartPickActive: false,
      selectedFooterTab: "journal",
      viewportHeight: 900,
    }),
    FOOTER_DECK_COLLAPSED_HEIGHT,
  );
  assert.equal(
    resolveFooterHeight({
      isFooterDeckCollapsed: false,
      isReviewWorkspaceExpanded: false,
      journalSetupGateActive: false,
      magicTradeChartPickActive: false,
      selectedFooterTab: "trade",
      viewportHeight: 900,
    }),
    416,
  );
  assert.equal(BOTTOM_ACTION_ROW_TRADE_HEIGHT, 416);
  assert.equal(
    resolveFooterHeight({
      isFooterDeckCollapsed: false,
      isReviewWorkspaceExpanded: false,
      journalSetupGateActive: false,
      magicTradeChartPickActive: false,
      selectedFooterTab: "journal",
      viewportHeight: 900,
    }),
    BOTTOM_ACTION_ROW_TRADE_HEIGHT,
  );
  assert.equal(BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT, BOTTOM_ACTION_ROW_TRADE_HEIGHT);
});

test("resolveFooterHeight keeps every visible footer tab aligned with trade height", () => {
  for (const tab of FOOTER_TABS) {
    assert.equal(
      resolveFooterHeight({
        isFooterDeckCollapsed: false,
        isReviewWorkspaceExpanded: false,
        journalSetupGateActive: false,
        magicTradeChartPickActive: false,
        selectedFooterTab: tab.id,
        viewportHeight: 900,
      }),
      BOTTOM_ACTION_ROW_TRADE_HEIGHT,
      `${tab.id} should use the same baseline deck height as trade`,
    );
  }
});

test("resolveFooterHeight keeps expanded workspace sizing and treats setup capture as optional", () => {
  assert.equal(
    resolveFooterHeight({
      isFooterDeckCollapsed: false,
      isReviewWorkspaceExpanded: true,
      journalSetupGateActive: false,
      magicTradeChartPickActive: false,
      selectedFooterTab: "ai-coach",
      viewportHeight: 900,
    }),
    495,
  );
  assert.equal(
    resolveFooterHeight({
      isFooterDeckCollapsed: true,
      isReviewWorkspaceExpanded: true,
      journalSetupGateActive: true,
      magicTradeChartPickActive: false,
      selectedFooterTab: "trade",
      viewportHeight: 900,
    }),
    FOOTER_DECK_COLLAPSED_HEIGHT,
  );
});

test("shouldUseCompactLivePositionRail follows footer visibility", () => {
  assert.equal(
    shouldUseCompactLivePositionRail({
      footerHeight: FOOTER_DECK_COLLAPSED_HEIGHT,
      isFooterDeckCollapsed: false,
      magicTradeChartPickActive: false,
    }),
    false,
  );
  assert.equal(
    shouldUseCompactLivePositionRail({
      footerHeight: BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT,
      isFooterDeckCollapsed: false,
      magicTradeChartPickActive: false,
    }),
    true,
  );
});
