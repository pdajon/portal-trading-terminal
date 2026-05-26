export type FooterTab =
  | "ai-coach"
  | "balances"
  | "diagnosis"
  | "discipline"
  | "funding-history"
  | "journal"
  | "open-orders"
  | "order-history"
  | "positions"
  | "session-logs"
  | "settings"
  | "trade"
  | "trade-history";

export type AccountActivityFooterTab =
  | "balances"
  | "funding-history"
  | "open-orders"
  | "order-history"
  | "positions"
  | "trade"
  | "trade-history";

export type FooterTabDefinition = {
  id: FooterTab;
  label: string;
  tone?: "ai" | "risk";
};

export const BOTTOM_ACTION_ROW_TRADE_HEIGHT = 416;
export const BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT = BOTTOM_ACTION_ROW_TRADE_HEIGHT;
export const FOOTER_DECK_COLLAPSED_HEIGHT = 82;

export const FOOTER_TABS: readonly FooterTabDefinition[] = [
  { id: "trade", label: "Trade" },
  { id: "positions", label: "Positions" },
  { id: "open-orders", label: "Open Orders" },
  { id: "trade-history", label: "Trade History" },
  { id: "funding-history", label: "Funding History" },
  { id: "order-history", label: "Order History" },
  { id: "balances", label: "Balances" },
];

const EXPANDABLE_FOOTER_TABS = new Set<FooterTab>([
  "ai-coach",
  "diagnosis",
  "journal",
  "session-logs",
]);

export function footerTabSupportsExpansion(tab: FooterTab) {
  return EXPANDABLE_FOOTER_TABS.has(tab);
}

export function getExpandedWorkspaceFooterHeight(viewportHeight: number) {
  return viewportHeight > 0
    ? Math.min(
        Math.max(
          Math.round(viewportHeight * 0.55),
          BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT,
        ),
        Math.max(BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT, viewportHeight - 160),
      )
    : BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT;
}

export function getJournalSetupGateFooterHeight(viewportHeight: number) {
  return viewportHeight > 0
    ? Math.min(
        Math.max(
          Math.round(viewportHeight * 0.68),
          BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT + 140,
        ),
        Math.max(BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT + 80, viewportHeight - 128),
      )
    : BOTTOM_ACTION_ROW_WORKSPACE_HEIGHT + 160;
}

export function resolveFooterHeight({
  isFooterDeckCollapsed,
  isReviewWorkspaceExpanded,
  journalSetupGateActive,
  magicTradeChartPickActive,
  selectedFooterTab,
  viewportHeight,
}: {
  isFooterDeckCollapsed: boolean;
  isReviewWorkspaceExpanded: boolean;
  journalSetupGateActive: boolean;
  magicTradeChartPickActive: boolean;
  selectedFooterTab: FooterTab;
  viewportHeight: number;
}) {
  if (magicTradeChartPickActive) {
    return 0;
  }

  if (isFooterDeckCollapsed) {
    return FOOTER_DECK_COLLAPSED_HEIGHT;
  }

  if (
    footerTabSupportsExpansion(selectedFooterTab) &&
    isReviewWorkspaceExpanded
  ) {
    return getExpandedWorkspaceFooterHeight(viewportHeight);
  }

  return BOTTOM_ACTION_ROW_TRADE_HEIGHT;
}

export function shouldUseCompactLivePositionRail({
  footerHeight,
  isFooterDeckCollapsed,
  magicTradeChartPickActive,
}: {
  footerHeight: number;
  isFooterDeckCollapsed: boolean;
  magicTradeChartPickActive: boolean;
}) {
  return (
    !isFooterDeckCollapsed &&
    !magicTradeChartPickActive &&
    footerHeight > FOOTER_DECK_COLLAPSED_HEIGHT
  );
}
