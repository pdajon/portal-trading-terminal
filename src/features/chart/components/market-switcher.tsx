"use client";

import { useMemo, useState } from "react";
import { isSupportedHyperliquidChartSymbol } from "@/features/chart/lib/hyperliquid-chart-symbols";
import { hyperliquidSymbols } from "@/lib/markets/hyperliquid-symbols";
import { cn } from "@/lib/utils/cn";
import type { HyperliquidSymbol } from "@/types/market";

type MarketSwitcherProps = {
  activeSymbol: HyperliquidSymbol;
  currentPrice: number | null;
  onSymbolChange: (symbol: HyperliquidSymbol) => void;
};

export function MarketSwitcher({
  activeSymbol,
  currentPrice,
  onSymbolChange,
}: MarketSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const supportedSymbols = hyperliquidSymbols.filter((market) =>
    isSupportedHyperliquidChartSymbol(market.symbol as HyperliquidSymbol),
  );

  const filteredSymbols = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return supportedSymbols;
    }

    return supportedSymbols.filter((market) => {
      const haystack = `${market.symbol} ${market.baseAsset} ${market.quoteAsset}`.toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [query, supportedSymbols]);

  const formattedCurrentPrice = useMemo(() => {
    if (currentPrice === null || !Number.isFinite(currentPrice)) {
      return null;
    }

    return new Intl.NumberFormat("en-US", {
      currency: "USD",
      maximumFractionDigits: currentPrice >= 1000 ? 0 : 2,
      minimumFractionDigits: 0,
      style: "currency",
    }).format(currentPrice);
  }, [currentPrice]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="min-h-[56px] min-w-[166px] rounded-portal-control border border-white/[0.07] bg-[linear-gradient(180deg,rgba(35,49,79,0.28),rgba(16,24,41,0.2))] px-4 py-3 text-left shadow-[0_10px_24px_rgba(4,8,18,0.2),inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-10px_20px_rgba(9,14,24,0.14)] backdrop-blur-[18px] transition hover:border-white/[0.09] hover:bg-[linear-gradient(180deg,rgba(42,58,92,0.32),rgba(18,27,47,0.24))]"
      >
        <div className="relative">
          <div className="pointer-events-none absolute -left-1 -top-1 h-8 w-16 rounded-full bg-[radial-gradient(circle,rgba(142,171,225,0.12),transparent_72%)] blur-lg" />
          <p className="relative text-[8px] font-medium uppercase tracking-[0.24em] text-[rgba(198,210,234,0.4)]">
            Market
          </p>
          <p className="relative mt-2 text-[1rem] font-semibold leading-none tracking-[-0.03em] text-[rgba(244,247,255,0.82)]">
            {activeSymbol}
          </p>
          {formattedCurrentPrice ? (
            <p className="relative mt-2 text-[0.74rem] font-medium leading-none tracking-[0.01em] text-[rgba(198,210,234,0.56)]">
              {formattedCurrentPrice}
            </p>
          ) : null}
        </div>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+14px)] w-[340px] overflow-hidden rounded-portal-panel border border-white/[0.08] bg-[linear-gradient(180deg,rgba(30,41,64,0.78),rgba(12,18,30,0.76))] shadow-[0_28px_80px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[26px]">
          <div className="border-b border-white/7 px-4 py-4">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tickers"
              className="w-full rounded-portal-control border border-white/[0.06] bg-white/[0.045] px-4 py-3 text-sm text-white/88 outline-none placeholder:text-white/32"
            />
          </div>

          <div className="max-h-72 overflow-y-auto px-2 py-2">
            {filteredSymbols.length > 0 ? (
              filteredSymbols.map((market) => (
                <button
                  key={market.symbol}
                  type="button"
                  onClick={() => {
                    onSymbolChange(market.symbol as HyperliquidSymbol);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-portal-control px-4 py-3.5 text-left transition",
                    market.symbol === activeSymbol
                      ? "bg-white/10 text-white"
                      : "text-white/68 hover:bg-white/7 hover:text-white/92",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{market.symbol}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/30">
                      {market.baseAsset} / {market.quoteAsset}
                    </p>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/26">
                    {market.status}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-5 text-sm text-white/42">
                No matching Hyperliquid tickers.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
