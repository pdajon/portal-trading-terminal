import { ExecutionPayloadPreview } from "@/features/execution/components/execution-payload-preview";
import { PlaceholderCard } from "@/components/ui/placeholder-card";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import type { PlannedTrade, PreparedExecutionPayload } from "@/types/trade";

type RightTradePanelProps = {
  tradePlan: PlannedTrade;
  executionPayload: PreparedExecutionPayload;
  latestPrice: number;
  onTradePlanChange: (
    updates: Partial<
      Pick<
        PlannedTrade,
        "direction" | "entry" | "stopLoss" | "takeProfit" | "positionSizeUsd"
      >
    >,
  ) => void;
};

export function RightTradePanel({
  tradePlan,
  executionPayload,
  latestPrice,
  onTradePlanChange,
}: RightTradePanelProps) {
  const riskDistance = Math.abs(tradePlan.entry - tradePlan.stopLoss);
  const rewardDistance = Math.abs(tradePlan.takeProfit - tradePlan.entry);

  return (
    <Panel className="h-full p-5">
      <div className="space-y-5">
        <SectionHeader
          eyebrow="Trade plan"
          title={`${tradePlan.symbol} ${tradePlan.direction}`}
          description="Local planning state now drives the chart overlays and panel summaries."
        />

        <div className="grid grid-cols-2 gap-2">
          {(["long", "short"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => onTradePlanChange({ direction })}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                tradePlan.direction === direction
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-line bg-background/60 text-muted hover:border-accent/40 hover:text-foreground"
              }`}
            >
              {direction}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 rounded-2xl border border-line bg-background/60 p-4">
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
              Entry
            </span>
            <input
              type="number"
              value={tradePlan.entry}
              onChange={(event) =>
                onTradePlanChange({ entry: Number(event.target.value) })
              }
              className="w-full bg-transparent text-lg font-semibold text-foreground outline-none"
            />
          </label>
          <label className="space-y-2 rounded-2xl border border-line bg-background/60 p-4">
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
              Size (USD)
            </span>
            <input
              type="number"
              value={tradePlan.positionSizeUsd ?? 0}
              onChange={(event) =>
                onTradePlanChange({ positionSizeUsd: Number(event.target.value) })
              }
              className="w-full bg-transparent text-lg font-semibold text-foreground outline-none"
            />
          </label>
          <label className="space-y-2 rounded-2xl border border-line bg-background/60 p-4">
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
              Stop loss
            </span>
            <input
              type="number"
              value={tradePlan.stopLoss}
              onChange={(event) =>
                onTradePlanChange({ stopLoss: Number(event.target.value) })
              }
              className="w-full bg-transparent text-lg font-semibold text-foreground outline-none"
            />
          </label>
          <label className="space-y-2 rounded-2xl border border-line bg-background/60 p-4">
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
              Take profit
            </span>
            <input
              type="number"
              value={tradePlan.takeProfit}
              onChange={(event) =>
                onTradePlanChange({ takeProfit: Number(event.target.value) })
              }
              className="w-full bg-transparent text-lg font-semibold text-foreground outline-none"
            />
          </label>
        </div>

        <div className="space-y-3">
          <PlaceholderCard
            label="Entry"
            value={tradePlan.entry.toLocaleString()}
            detail={`Last price ${latestPrice.toLocaleString()}`}
          />
          <PlaceholderCard
            label="Stop loss"
            value={tradePlan.stopLoss.toLocaleString()}
            detail={`Risk distance ${riskDistance.toFixed(2)}`}
            accent="danger"
          />
          <PlaceholderCard
            label="Take profit"
            value={tradePlan.takeProfit.toLocaleString()}
            detail={`Reward distance ${rewardDistance.toFixed(2)}`}
            accent="success"
          />
          <PlaceholderCard
            label="Risk / reward"
            value={`${tradePlan.riskRewardRatio.toFixed(2)}R`}
            detail={`Planned size $${tradePlan.positionSizeUsd?.toLocaleString() ?? "0"}`}
          />
        </div>

        <ExecutionPayloadPreview payload={executionPayload} />

        <div className="rounded-2xl border border-accent/35 bg-accent/12 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent/80">
            Next phase
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">
            This payload is review-only for now. The live Hyperliquid submission
            path stays deferred until planning interactions feel stable.
          </p>
        </div>
      </div>
    </Panel>
  );
}
