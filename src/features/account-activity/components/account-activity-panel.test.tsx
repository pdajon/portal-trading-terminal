import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AccountActivityPanel,
  AccountActivityPanelControls,
  PositionActivityModal,
} from "./account-activity-panel";
import type { AccountActivityLedger } from "../lib/account-activity-ledger";

test("AccountActivityPanel renders Positions as a non-selectable Portal ledger", () => {
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: buildLedger(),
      onCloseAllPositions: () => {},
      selectedTab: "positions",
    }),
  );

  assert.match(markup, /Coin/);
  assert.match(markup, /Position Value/);
  assert.match(markup, /PNL \(ROE %\)/);
  assert.match(markup, /Liq\. Price/);
  assert.match(markup, /TP\/SL/);
  assert.match(markup, /XPL 3x/);
  assert.match(markup, /Close All/);
  assert.match(markup, /Limit/);
  assert.match(markup, /Market/);
  assert.match(markup, /Reverse/);
  assert.match(markup, /\$670\.99 \(Cross\)/);
  assert.match(markup, /Share position PNL \+\$65\.63/);
  assert.match(markup, /aria-label="Edit TP\/SL for XPL 3x"/);
  assert.match(markup, /viewBox="0 0 24 24"/);
  assert.doesNotMatch(markup, />Edit</);
  assert.doesNotMatch(markup, /Row details open when a ledger row is selected/);
  assert.doesNotMatch(markup, /Detail/);
});

test("AccountActivityPanel renders account ledgers without the duplicate subheader row", () => {
  const tradeMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: buildLedger(),
      selectedTab: "trade-history",
    }),
  );
  const orderMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: buildLedger(),
      selectedTab: "order-history",
    }),
  );

  assert.doesNotMatch(tradeMarkup, /Filter/);
  assert.doesNotMatch(tradeMarkup, /Aggregate/);
  assert.doesNotMatch(tradeMarkup, /TRADE HISTORY/);
  assert.match(tradeMarkup, /Open explorer for trade/);
  assert.match(tradeMarkup, /Share trade result/);
  assert.match(tradeMarkup, /text-white\/40/);
  assert.match(tradeMarkup, /text-white\/28/);
  assert.match(tradeMarkup, /Closed PNL/);
  assert.match(orderMarkup, /Filled Size/);
  assert.match(orderMarkup, /Trigger Conditions/);
  assert.match(orderMarkup, /Order ID/);
});

test("AccountActivityPanel only shows trade share actions for closed fills", () => {
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        tradeHistory: {
          count: 1,
          rows: [
            {
              ...buildLedger().tradeHistory.rows[0]!,
              cells: {
                ...buildLedger().tradeHistory.rows[0]!.cells,
                closedPnl: "-$0.11",
                direction: "Open Long",
              },
            },
          ],
        },
      },
      selectedTab: "trade-history",
    }),
  );

  assert.match(markup, /Open explorer for trade/);
  assert.doesNotMatch(markup, /Share trade result/);
});

test("AccountActivityPanel colors Trade History direction independently from open-row PNL", () => {
  const closedRow = buildLedger().tradeHistory.rows[0]!;
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        tradeHistory: {
          count: 2,
          rows: [
            {
              ...closedRow,
              cells: {
                ...closedRow.cells,
                closedPnl: "-9.93 USDC",
                direction: "Close Long",
              },
              id: "closed-long",
              tone: "negative",
            },
            {
              ...closedRow,
              cells: {
                ...closedRow.cells,
                closedPnl: "-0.11 USDC",
                direction: "Open Long",
              },
              id: "open-long",
              tone: "negative",
            },
          ],
        },
      },
      selectedTab: "trade-history",
    }),
  );

  assert.match(markup, /text-\[#FF4F8A\][^>]*>Close Long/);
  assert.match(markup, /text-\[#22C55E\][^>]*>Open Long/);
  assert.match(markup, /text-white\/68[^>]*><span class="inline-flex items-center gap-2"><span>-0\.11 USDC/);
});

test("AccountActivityPanel bolds Coin column text and matches row side color where Hyperliquid does", () => {
  const orderMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: buildLedger(),
      selectedTab: "open-orders",
    }),
  );
  const tradeMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: buildLedger(),
      selectedTab: "trade-history",
    }),
  );
  const fundingMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: buildLedger(),
      selectedTab: "funding-history",
    }),
  );
  const shortPositionMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        positions: {
          count: 1,
          rows: [
            {
              ...buildLedger().positions.rows[0]!,
              cells: {
                ...buildLedger().positions.rows[0]!.cells,
                coin: "BTC 1x",
                size: "0.01118 BTC",
              },
              direction: "short",
              id: "position-btc-short",
              symbol: "BTC-USD",
              tone: "negative",
            },
          ],
        },
      },
      selectedTab: "positions",
    }),
  );
  const balancesMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: buildLedger(),
      selectedTab: "balances",
    }),
  );

  assert.match(orderMarkup, /font-bold text-\[#FF4F8A\][^>]*>XPL/);
  assert.match(tradeMarkup, /font-bold text-\[#FF4F8A\][^>]*>XPL/);
  assert.match(fundingMarkup, /font-bold text-\[#22C55E\][^>]*>XPL/);
  assert.match(shortPositionMarkup, /font-bold text-\[#FF4F8A\][\s\S]*text-\[18px\] font-semibold text-current[^>]*>BTC/);
  assert.doesNotMatch(shortPositionMarkup, /text-\[#63E6BE\][^>]*>BTC/);
  assert.match(balancesMarkup, /font-bold text-white\/90[^>]*>USDC/);
  assert.doesNotMatch(tradeMarkup, /font-mono[^>]*>XPL/);
});

test("AccountActivityPanel colors Funding History position side by side, not payment", () => {
  const fundingRow = buildLedger().fundingHistory.rows[0]!;
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        fundingHistory: {
          count: 2,
          rows: [
            {
              ...fundingRow,
              cells: {
                ...fundingRow.cells,
                payment: "-0.24 USDC",
                positionSide: "Long",
              },
              id: "funding-long-negative-payment",
              tone: "negative",
            },
            {
              ...fundingRow,
              cells: {
                ...fundingRow.cells,
                payment: "0.12 USDC",
                positionSide: "Short",
              },
              id: "funding-short-positive-payment",
              tone: "positive",
            },
          ],
        },
      },
      selectedTab: "funding-history",
    }),
  );

  assert.match(markup, /text-\[#22C55E\][^>]*>Long/);
  assert.match(markup, /text-\[#FF4F8A\][^>]*>Short/);
  assert.match(markup, /text-\[#FF4F8A\][^>]*>-0\.24 USDC/);
  assert.match(markup, /text-\[#22C55E\][^>]*>0\.12 USDC/);
});

test("AccountActivityPanel keeps the TP/SL edit button visually attached to stacked protection values", () => {
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        positions: {
          count: 1,
          rows: [
            {
              ...buildLedger().positions.rows[0]!,
              cells: {
                ...buildLedger().positions.rows[0]!.cells,
                tpSl: "78,301.00 / 79,773.00",
              },
            },
          ],
        },
      },
      selectedTab: "positions",
    }),
  );

  assert.match(markup, /inline-flex w-fit max-w-max items-center gap-2/);
  assert.match(markup, /inline-flex flex-col gap-1 leading-tight/);
  assert.match(markup, /78,301\.00/);
  assert.match(markup, /79,773\.00/);
  assert.match(markup, /aria-label="Edit TP\/SL for XPL 3x"/);
});

test("PositionActivityModal renders TP/SL price plus gain and loss companion fields", () => {
  const row = buildLedger().positions.rows[0]!;
  const markup = renderToStaticMarkup(
    createElement(PositionActivityModal, {
      modal: {
        kind: "tpsl",
        row,
        stop: "1900",
        target: "2200",
      },
      onClose: () => {},
      onUpdateProtectionLevels: () => {},
    }),
  );

  assert.match(markup, /TP Price/);
  assert.match(markup, /SL Price/);
  assert.match(markup, /Gain/);
  assert.match(markup, /Loss/);
  assert.match(markup, /aria-label="Take-profit gain"/);
  assert.match(markup, /aria-label="Stop-loss loss"/);
  assert.match(markup, /aria-label="Take-profit gain unit"/);
  assert.match(markup, /aria-label="Stop-loss loss unit"/);
  assert.match(markup, /<option value="percent" selected="">%<\/option>/);
  assert.match(markup, /<option value="usdc">\$<\/option>/);
});

test("AccountActivityPanel renders review copy for legacy Magic Trade Open Orders", () => {
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        openOrders: {
          count: 1,
          rows: [
            {
              cells: {
                actions: "Review / Disarm",
                coin: "SOL",
                direction: "Open Short",
                orderValue: "Market",
                originalSize: "--",
                price: "Market",
                reduceOnly: "No",
                size: "$905 margin",
                time: "05/15/2026, 12:45:04",
                tpSl: "--",
                triggerConditions: "BTC close below 79,850 on 15m",
                type: "Magic Trigger",
              },
              detail: [{ label: "Margin Status", value: "Review required before execution", tone: "warning" }],
              direction: "short",
              id: "magic-open-order-review",
              magicTradeReviewRequired: true,
              magicTradeRuleId: "magic-btc-sol",
              orderId: null,
              origin: "magic-trade",
              symbol: "SOL-USD",
              tone: "negative",
            },
          ],
        },
      },
      onDisarmMagicTradeRule: () => {},
      onEditMagicTradeRule: () => {},
      selectedTab: "open-orders",
    }),
  );

  assert.match(markup, />Review</);
  assert.match(markup, />Disarm</);
});

test("AccountActivityPanel colors Order History direction by Hyperliquid direction semantics", () => {
  const orderRow = buildLedger().orderHistory.rows[0]!;
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        orderHistory: {
          count: 2,
          rows: [
            {
              ...orderRow,
              cells: {
                ...orderRow.cells,
                direction: "Open Long",
                status: "Canceled",
              },
              id: "order-open-long-canceled",
              tone: "negative",
            },
            {
              ...orderRow,
              cells: {
                ...orderRow.cells,
                direction: "Close Long",
                status: "Open",
              },
              id: "order-close-long-open",
              tone: "cyan",
            },
          ],
        },
      },
      selectedTab: "order-history",
    }),
  );

  assert.match(markup, /text-\[#22C55E\][^>]*>Open Long/);
  assert.match(markup, /text-\[#FF4F8A\][^>]*>Close Long/);
});

test("AccountActivityPanel dims empty table messages", () => {
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        tradeHistory: { count: 0, rows: [] },
      },
      selectedTab: "trade-history",
    }),
  );

  assert.match(markup, /No trade history yet/);
  assert.match(markup, /text-white\/28/);
});

test("AccountActivityPanel uses Hyperliquid positions empty copy", () => {
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        positions: { count: 0, rows: [] },
      },
      selectedTab: "positions",
    }),
  );

  assert.match(markup, /No open positions yet/);
});

test("AccountActivityPanel applies Hyperliquid-style account filters to visible rows", () => {
  const ledger = {
    ...buildLedger(),
    balances: {
      count: 2,
      rows: [
        ...buildLedger().balances.rows,
        {
          cells: {
            availableBalance: "0.000001 HYPE",
            coin: "HYPE",
            contract: "--",
            pnlRoe: "--",
            repay: "--",
            send: "--",
            totalBalance: "0.000001 HYPE",
            transfer: "--",
            usdcValue: "$0.01",
          },
          detail: [],
          id: "balance-dust",
          tone: "neutral",
        },
      ],
    },
    tradeHistory: {
      count: 2,
      rows: [
        ...buildLedger().tradeHistory.rows,
        {
          cells: {
            closedPnl: "-$3.00",
            coin: "BTC",
            direction: "Open Short",
            fee: "0.0120 USDC",
            price: "80,000.00",
            size: "0.001",
            time: "05/13, 13:30",
            tradeValue: "80.00 USDC",
          },
          detail: [],
          explorerUrl: "https://app.hyperliquid.xyz/explorer/tx/0xbtc",
          id: "trade-btc",
          share: {
            coin: "BTC",
            direction: "Open Short",
            entryLabel: "80,000.00",
            markLabel: "80,000.00",
            pnlLabel: "-$3.00",
            priceLabel: "80,000.00",
            sizeLabel: "0.001",
            timeLabel: "05/13, 13:30",
            tradeValueLabel: "80.00 USDC",
          },
          tone: "negative",
        },
      ],
    },
  } satisfies AccountActivityLedger;
  const currentTradeMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      activeSymbol: "XPL-USD",
      ledger,
      marketFilter: "current",
      selectedTab: "trade-history",
    }),
  );
  const hiddenSmallBalancesMarkup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      hideSmallBalances: true,
      ledger,
      selectedTab: "balances",
    }),
  );

  assert.match(currentTradeMarkup, /XPL/);
  assert.doesNotMatch(currentTradeMarkup, /BTC/);
  assert.match(hiddenSmallBalancesMarkup, /1,200\.00 USDC/);
  assert.doesNotMatch(hiddenSmallBalancesMarkup, /HYPE/);
});

test("AccountActivityPanel renders Magic Trade triggers as Open Orders actions", () => {
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: {
        ...buildLedger(),
        openOrders: {
          count: 1,
          rows: [
            {
              cells: {
                actions: "Edit / Disarm",
                coin: "SOL",
                direction: "Open Short",
                orderValue: "Market",
                originalSize: "--",
                price: "Market",
                reduceOnly: "No",
                size: "$905 margin",
                time: "05/15/2026, 12:45:04",
                tpSl: "--",
                triggerConditions: "BTC close below 79,850 on 15m",
                type: "Magic Trigger",
              },
              detail: [{ label: "Origin", value: "Magic Trade", tone: "warning" }],
              direction: "short",
              id: "magic-open-order",
              magicTradeRuleId: "magic-btc-sol",
              orderId: null,
              origin: "magic-trade",
              symbol: "SOL-USD",
              tone: "negative",
            },
          ],
        },
      },
      onDisarmMagicTradeRule: () => {},
      onEditMagicTradeRule: () => {},
      onFocusMagicTradeRule: () => {},
      selectedTab: "open-orders",
    }),
  );

  assert.match(markup, /Magic Trigger/);
  assert.match(markup, /aria-label="Show Magic trigger on chart"/);
  assert.match(markup, /SOL/);
  assert.match(markup, /Open Short/);
  assert.match(markup, /\$905 margin/);
  assert.match(markup, /BTC close below 79,850 on 15m/);
  assert.match(markup, />Edit</);
  assert.match(markup, />Disarm</);
  assert.doesNotMatch(markup, />Cancel</);
});

test("AccountActivityPanel renders position coins as chart-switch buttons when enabled", () => {
  const markup = renderToStaticMarkup(
    createElement(AccountActivityPanel, {
      ledger: buildLedger(),
      onSelectSymbol: () => {},
      selectedTab: "positions",
    }),
  );

  assert.match(markup, /type="button"/);
  assert.match(markup, /aria-label="Open XPL chart"/);
  assert.match(markup, /XPL/);
  assert.match(markup, /3x/);
});

test("AccountActivityPanelControls renders the active tab actions for the footer header", () => {
  const tradeHistoryControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: true,
      hideSmallBalances: true,
      marketFilter: "all",
      positionFilter: "all",
      selectedTab: "trade-history",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const inactiveTradeHistoryControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "all",
      positionFilter: "all",
      selectedTab: "trade-history",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const openOrderControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "all",
      positionFilter: "all",
      selectedTab: "open-orders",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const selectedOpenOrderControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "active",
      marketFilterHasSelection: true,
      positionFilter: "all",
      selectedTab: "open-orders",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const selectedAllOpenOrderControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "all",
      marketFilterHasSelection: true,
      positionFilter: "all",
      selectedTab: "open-orders",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const fundingHistoryControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "all",
      positionFilter: "all",
      selectedTab: "funding-history",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const orderHistoryControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "all",
      positionFilter: "all",
      selectedTab: "order-history",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const positionControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "all",
      positionFilter: "all",
      selectedTab: "positions",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const selectedPositionControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "all",
      positionFilter: "short",
      positionFilterHasSelection: true,
      selectedTab: "positions",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const balanceControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: true,
      marketFilter: "all",
      positionFilter: "all",
      selectedTab: "balances",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );
  const inactiveBalanceControls = renderToStaticMarkup(
    createElement(AccountActivityPanelControls, {
      aggregateTrades: false,
      hideSmallBalances: false,
      marketFilter: "all",
      positionFilter: "all",
      selectedTab: "balances",
      setAggregateTrades: () => {},
      setHideSmallBalances: () => {},
      setMarketFilter: () => {},
      setPositionFilter: () => {},
    }),
  );

  assert.match(tradeHistoryControls, /Filter/);
  assert.match(tradeHistoryControls, /All/);
  assert.match(tradeHistoryControls, /Active/);
  assert.match(tradeHistoryControls, /Long/);
  assert.match(tradeHistoryControls, /Short/);
  assert.match(tradeHistoryControls, /Aggregate/);
  assert.match(tradeHistoryControls, /type="button"/);
  assert.match(tradeHistoryControls, /aria-pressed="true"/);
  assert.doesNotMatch(tradeHistoryControls, /rounded-\[7px\] border px-3/);
  assert.doesNotMatch(tradeHistoryControls, /border-cyan-300\/22 bg-cyan-300/);
  assert.match(
    tradeHistoryControls,
    /h-\[18px\] w-\[18px\] items-center justify-center rounded-\[4px\]/,
  );
  assert.match(tradeHistoryControls, /border-\[#33F5FF\]/);
  assert.match(
    tradeHistoryControls,
    /h-\[10px\] w-\[10px\] rounded-\[2px\] bg-\[#33F5FF\]/,
  );
  assert.match(inactiveTradeHistoryControls, /aria-pressed="false"/);
  assert.match(inactiveTradeHistoryControls, /border-white\/20 bg-transparent opacity-70/);
  assert.doesNotMatch(
    inactiveTradeHistoryControls,
    /h-\[10px\] w-\[10px\] rounded-\[2px\] bg-\[#33F5FF\]/,
  );
  assert.doesNotMatch(tradeHistoryControls, /All Markets/);
  assert.doesNotMatch(tradeHistoryControls, /Current Market/);
  assert.doesNotMatch(tradeHistoryControls, /Reduce Only/);
  assert.doesNotMatch(tradeHistoryControls, /Trigger Orders/);
  assert.doesNotMatch(tradeHistoryControls, /TP\/SL Orders/);
  assert.match(openOrderControls, /Filter/);
  assert.match(openOrderControls, /All/);
  assert.match(openOrderControls, /Active/);
  assert.match(
    selectedOpenOrderControls,
    /aria-hidden="true" class="[^"]*text-white\/86[^"]*">Active<svg/,
  );
  assert.match(
    selectedAllOpenOrderControls,
    /aria-hidden="true" class="[^"]*text-white\/86[^"]*">All<svg/,
  );
  assert.doesNotMatch(openOrderControls, /All Markets/);
  assert.doesNotMatch(openOrderControls, /Current Market/);
  assert.doesNotMatch(openOrderControls, /Reduce Only/);
  assert.doesNotMatch(openOrderControls, /Trigger Orders/);
  assert.doesNotMatch(openOrderControls, /TP\/SL Orders/);
  assert.match(fundingHistoryControls, /Filter/);
  assert.match(fundingHistoryControls, /All/);
  assert.match(fundingHistoryControls, /Active/);
  assert.doesNotMatch(fundingHistoryControls, /All Markets/);
  assert.match(orderHistoryControls, /Filter/);
  assert.match(orderHistoryControls, /Long/);
  assert.match(orderHistoryControls, /Short/);
  assert.doesNotMatch(orderHistoryControls, /Current Market/);
  assert.match(positionControls, /Filter/);
  assert.match(positionControls, /Active/);
  assert.match(
    selectedPositionControls,
    /aria-hidden="true" class="[^"]*text-white\/86[^"]*">Short<svg/,
  );
  assert.match(balanceControls, /Filter/);
  assert.match(balanceControls, /All/);
  assert.match(balanceControls, /Active/);
  assert.match(balanceControls, /Long/);
  assert.match(balanceControls, /Short/);
  assert.match(balanceControls, /Hide Small Balances/);
  assert.match(
    balanceControls,
    /h-\[18px\] w-\[18px\] items-center justify-center rounded-\[4px\]/,
  );
  assert.match(balanceControls, /border-\[#33F5FF\]/);
  assert.match(balanceControls, /h-\[10px\] w-\[10px\] rounded-\[2px\] bg-\[#33F5FF\]/);
  assert.match(inactiveBalanceControls, /border-white\/20 bg-transparent opacity-70/);
  assert.doesNotMatch(
    inactiveBalanceControls,
    /h-\[10px\] w-\[10px\] rounded-\[2px\] bg-\[#33F5FF\]/,
  );
  assert.doesNotMatch(balanceControls, /All Markets/);
  assert.doesNotMatch(balanceControls, /Current Market/);
  assert.doesNotMatch(balanceControls, /Reduce Only/);
  assert.doesNotMatch(balanceControls, /Trigger Orders/);
  assert.doesNotMatch(balanceControls, /TP\/SL Orders/);

  [
    tradeHistoryControls,
    openOrderControls,
    fundingHistoryControls,
    orderHistoryControls,
    positionControls,
    balanceControls,
  ].forEach((controls) => {
    assert.match(controls, /aria-label="Filter"/);
    assert.match(controls, /text-white\/86/);
    assert.match(controls, /opacity-0/);
    assert.doesNotMatch(controls, /rounded-\[10px\] border border-white/);
    assert.doesNotMatch(controls, /#8B5CF6/);
  });
});

function buildLedger(): AccountActivityLedger {
  return {
    balances: {
      count: 1,
      rows: [
        {
          cells: {
            availableBalance: "1,200.00 USDC",
            coin: "USDC",
            contract: "--",
            pnlRoe: "--",
            repay: "--",
            send: "Not available in your jurisdiction",
            totalBalance: "$2,400.00",
            transfer: "Transfer to Spot",
            usdcValue: "$2,400.00",
          },
          detail: [{ label: "Available Balance", value: "1,200.00 USDC" }],
          id: "balance-usdc",
          tone: "neutral",
        },
      ],
    },
    fundingHistory: {
      count: 1,
      rows: [
        {
          cells: {
            coin: "XPL",
            payment: "-0.24 USDC",
            positionSide: "Long",
            rate: "--",
            size: "20,483 XPL",
            time: "Live",
          },
          detail: [{ label: "Payment", value: "-0.24 USDC", tone: "negative" }],
          id: "funding-xpl",
          tone: "negative",
        },
      ],
    },
    magicTrade: {
      count: 1,
      rows: [
        {
          cells: {
            action: "Magic Trade opened XPL testnet position",
            coin: "XPL",
            event: "Executed",
            pnl: "--",
            price: "0.100000",
            size: "250",
            status: "Executed",
            time: "05/13/2026, 13:27",
          },
          detail: [{ label: "Status", value: "Executed", tone: "neutral" }],
          id: "magic-trade-1",
          tone: "neutral",
        },
      ],
    },
    openOrders: {
      count: 1,
      rows: [
        {
          cells: {
            actions: "Edit / Cancel",
            coin: "XPL",
            direction: "Close Long",
            orderValue: "101.20 USDC",
            originalSize: "1,000 XPL",
            price: "0.101200",
            reduceOnly: "Yes",
            size: "1,000 XPL",
            time: "05/13, 13:20",
            tpSl: "--",
            triggerConditions: "Chart line",
            type: "Limit",
          },
          detail: [{ label: "Order ID", value: "123456" }],
          direction: "short",
          id: "open-order-1",
          orderId: 123456,
          origin: "local",
          symbol: "XPL-USD",
          tone: "negative",
        },
      ],
    },
    orderHistory: {
      count: 1,
      rows: [
        {
          cells: {
            coin: "XPL",
            direction: "Short",
            filledSize: "0",
            orderId: "123456",
            orderValue: "101.20 USDC",
            price: "0.101200",
            reduceOnly: "Yes",
            size: "1,000 XPL",
            status: "Open",
            time: "05/13, 13:20",
            tpSl: "--",
            triggerConditions: "Chart line",
            type: "Limit",
          },
          detail: [{ label: "Status", value: "Open", tone: "cyan" }],
          id: "order-history-1",
          tone: "cyan",
        },
      ],
    },
    positions: {
      count: 1,
      rows: [
        {
          cells: {
            actions: "Limit / Market / Reverse",
            coin: "XPL 3x",
            entryPrice: "0.095071",
            funding: "-0.24 USDC",
            liqPrice: "0.066711",
            margin: "$670.99 (Cross)",
            markPrice: "0.098275",
            pnlRoe: "+$65.63 (+10.1%)",
            positionValue: "2,012.97 USDC",
            size: "20,483 XPL",
            tpSl: "-- / --",
          },
          detail: [{ label: "Coin", value: "XPL" }],
          direction: "long",
          id: "position-xpl",
          share: {
            coin: "XPL",
            direction: "Long 3x",
            entryLabel: "0.095071",
            markLabel: "0.098275",
            pnlLabel: "+$65.63",
            priceLabel: "0.098275",
            sizeLabel: "20,483 XPL",
            timeLabel: "Open position",
            tradeValueLabel: "2,012.97 USDC",
          },
          symbol: "XPL-USD",
          tone: "positive",
        },
      ],
    },
    tradeHistory: {
      count: 1,
      rows: [
        {
          cells: {
            closedPnl: "+$42.00",
            coin: "XPL",
            direction: "Close Long",
            fee: "-- USDC",
            price: "0.099000",
            size: "900",
            time: "05/13, 13:25",
            tradeValue: "89.10 USDC",
          },
          detail: [{ label: "Closed PNL", value: "+$42.00", tone: "positive" }],
          explorerUrl: "https://app.hyperliquid.xyz/explorer/tx/0xabc",
          id: "trade-1",
          share: {
            coin: "XPL",
            direction: "Close Long",
            entryLabel: "0.099000",
            markLabel: "0.099000",
            pnlLabel: "+$42.00",
            priceLabel: "0.099000",
            sizeLabel: "900",
            timeLabel: "05/13, 13:25",
            tradeValueLabel: "89.10 USDC",
          },
          tone: "positive",
        },
      ],
    },
  };
}
