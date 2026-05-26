import { PlaceholderCard } from "@/components/ui/placeholder-card";
import type { PreparedExecutionPayload } from "@/types/trade";

type ExecutionPayloadPreviewProps = {
  payload: PreparedExecutionPayload;
};

export function ExecutionPayloadPreview({
  payload,
}: ExecutionPayloadPreviewProps) {
  return (
    <div className="space-y-3">
      <PlaceholderCard
        label="Execution prep"
        value={`${payload.side.toUpperCase()} ${payload.symbol}`}
        detail={`${payload.orderType} review-only payload on ${payload.environment}`}
      />

      <div className="rounded-2xl border border-line bg-background/60 p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
              Entry
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {payload.entryPrice.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
              Size
            </p>
            <p className="mt-1 font-semibold text-foreground">
              ${payload.sizeUsd.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
              Estimated qty
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {payload.estimatedQuantity.toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
              R:R
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {payload.riskRewardRatio.toFixed(2)}R
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
              Stop
            </p>
            <p className="mt-1 font-semibold text-danger">
              {payload.stopLoss.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
              Target
            </p>
            <p className="mt-1 font-semibold text-success">
              {payload.takeProfit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
