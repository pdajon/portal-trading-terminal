import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { mockOrders } from "@/lib/mock/orders";
import { mockPositions } from "@/lib/mock/positions";
import type { HyperliquidSymbol } from "@/types/market";
import type { PlannedTrade } from "@/types/trade";

type BottomTradePanelProps = {
  activeSymbol: HyperliquidSymbol;
  tradePlan: PlannedTrade;
};

export function BottomTradePanel({
  activeSymbol,
  tradePlan,
}: BottomTradePanelProps) {
  const filteredPositions = mockPositions.filter(
    (position) => position.symbol === activeSymbol,
  );
  const filteredOrders = mockOrders.filter((order) => order.symbol === activeSymbol);

  return (
    <Panel className="h-full p-5">
      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.15fr_0.95fr]">
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Planned trade"
            title={`${tradePlan.symbol} setup`}
            description="The same local plan shown on the chart and in the right panel."
          />

          <div className="rounded-2xl border border-line bg-background/60 p-4">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  Direction
                </p>
                <p className="mt-1 font-semibold capitalize text-foreground">
                  {tradePlan.direction}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  R:R
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {tradePlan.riskRewardRatio.toFixed(2)}R
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  Entry
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {tradePlan.entry.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  Size
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  ${tradePlan.positionSizeUsd?.toLocaleString() ?? "0"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  Stop
                </p>
                <p className="mt-1 font-semibold text-danger">
                  {tradePlan.stopLoss.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  Target
                </p>
                <p className="mt-1 font-semibold text-success">
                  {tradePlan.takeProfit.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Positions"
            title={`${activeSymbol} positions`}
            description="Bottom-docked account context that supports the chart instead of competing with it."
          />

          <div className="space-y-3">
            {filteredPositions.length > 0 ? filteredPositions.map((position) => (
              <div
                key={position.id}
                className="grid gap-3 rounded-2xl border border-line bg-background/60 px-4 py-3 md:grid-cols-5"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {position.symbol}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    {position.side}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Size
                  </p>
                  <p className="text-sm text-foreground">{position.size}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Entry
                  </p>
                  <p className="text-sm text-foreground">{position.entryPrice}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Mark
                  </p>
                  <p className="text-sm text-foreground">{position.markPrice}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    PnL
                  </p>
                  <p className="text-sm text-success">
                    ${position.pnl.toFixed(2)}
                  </p>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-line bg-background/40 px-4 py-6 text-sm text-muted">
                No open positions for {activeSymbol} yet.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="History"
            title={`${activeSymbol} order activity`}
            description="Execution history stays visible, but secondary to the chart-first workflow."
          />

          <div className="space-y-3">
            {filteredOrders.length > 0 ? filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-line bg-background/60 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {order.symbol}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {order.side} {order.type}
                    </p>
                  </div>
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted">
                    {order.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-muted">
                  <span>{order.size}</span>
                  <span>@ {order.price}</span>
                  <span>{order.placedAt}</span>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-line bg-background/40 px-4 py-6 text-sm text-muted">
                No recent orders for {activeSymbol} yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </Panel>
  );
}
