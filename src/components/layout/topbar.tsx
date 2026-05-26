import { appConfig } from "@/lib/config/app-config";
import { hyperliquidSymbols } from "@/lib/markets/hyperliquid-symbols";
import type { MarketSymbol } from "@/types/market";

type TopbarProps = {
  activeSymbol: MarketSymbol["symbol"];
  onSymbolSelect: (symbol: MarketSymbol["symbol"]) => void;
};

export function Topbar({ activeSymbol, onSymbolSelect }: TopbarProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.28em] text-accent/70">
          {appConfig.currentMilestone}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{appConfig.name}</h1>
          <span className="rounded-full border border-line px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-muted">
            {appConfig.marketSource}
          </span>
        </div>
        <p className="text-sm text-muted">{appConfig.tagline}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hyperliquidSymbols.map((market) => (
          <button
            key={market.symbol}
            type="button"
            onClick={() => onSymbolSelect(market.symbol)}
            className={[
              "rounded-full border px-3 py-1.5 text-sm transition",
              activeSymbol === market.symbol
                ? "border-accent bg-accent/15 text-foreground"
                : "border-line bg-background/70 text-muted hover:border-accent/60 hover:text-foreground",
            ].join(" ")}
          >
            {market.symbol}
          </button>
        ))}
      </div>
    </header>
  );
}
