"use client";

import { cn } from "@/lib/utils/cn";

export const chartTimeframes = ["1m", "5m", "15m", "1h", "1d"] as const;

export type ChartTimeframe = (typeof chartTimeframes)[number];

type TimeframeSwitcherProps = {
  activeTimeframe: ChartTimeframe;
  onTimeframeChange: (timeframe: ChartTimeframe) => void;
};

export function TimeframeSwitcher({
  activeTimeframe,
  onTimeframeChange,
}: TimeframeSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-portal-control border border-white/[0.055] bg-white/[0.030] p-0.5 shadow-[0_10px_22px_rgba(0,0,0,0.14)] backdrop-blur-[18px]">
      {chartTimeframes.map((timeframe) => (
        <button
          key={timeframe}
          type="button"
          onClick={() => onTimeframeChange(timeframe)}
          className={cn(
            "rounded-portal-control px-2.5 py-1.5 text-[10px] font-medium tracking-[0.02em] transition",
            timeframe === activeTimeframe
              ? "bg-cyan-400/[0.075] text-cyan-100/86"
              : "text-white/38 hover:bg-white/[0.035] hover:text-white/68",
          )}
        >
          {timeframe}
        </button>
      ))}
    </div>
  );
}
