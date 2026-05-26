import React, { useEffect, useState } from "react";

export type ChartSoulInterventionRecommendation = {
  dismissalCount?: number;
  evidenceSummary: string;
  id: string;
  severity: "info" | "warning" | "critical";
  showLessAvailable?: boolean;
  suggestedRule: string;
  title: string;
  type: string;
};

type ChartSoulInterventionProps = {
  onIgnore: (recommendationId: string) => void;
  onReviewRule: (recommendationId: string) => void;
  onShowLess?: (recommendationId: string) => void;
  onSnooze: (recommendationId: string) => void;
  recommendation: ChartSoulInterventionRecommendation | null;
  soulAssetSrc?: string;
};

type SoulInterventionPhase = "entering" | "active" | "exiting";

export function ChartSoulIntervention({
  onIgnore,
  onReviewRule,
  onShowLess,
  onSnooze,
  recommendation: activeRecommendation,
  soulAssetSrc = "/portal/avatar/portal-soul.svg?v=orb-companion-v12",
}: ChartSoulInterventionProps) {
  const [visibleRecommendation, setVisibleRecommendation] =
    useState<ChartSoulInterventionRecommendation | null>(activeRecommendation);
  const [phase, setPhase] = useState<SoulInterventionPhase>(
    activeRecommendation ? "entering" : "exiting",
  );

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (activeRecommendation) {
      setVisibleRecommendation(activeRecommendation);
      setPhase("entering");
      timeout = setTimeout(() => setPhase("active"), 500);
    } else if (visibleRecommendation) {
      setPhase("exiting");
      timeout = setTimeout(() => setVisibleRecommendation(null), 920);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [activeRecommendation, visibleRecommendation]);

  if (!visibleRecommendation) {
    return null;
  }

  return (
    <ChartSoulInterventionContent
      onIgnore={onIgnore}
      onReviewRule={onReviewRule}
      onShowLess={onShowLess}
      onSnooze={onSnooze}
      phase={phase}
      recommendation={visibleRecommendation}
      soulAssetSrc={soulAssetSrc}
    />
  );
}

type ChartSoulInterventionContentProps = Omit<
  ChartSoulInterventionProps,
  "recommendation"
> & {
  phase: SoulInterventionPhase;
  recommendation: ChartSoulInterventionRecommendation;
};

export function ChartSoulInterventionContent({
  onIgnore,
  onReviewRule,
  onShowLess,
  onSnooze,
  phase,
  recommendation,
  soulAssetSrc = "/portal/avatar/portal-soul.svg?v=orb-companion-v12",
}: ChartSoulInterventionContentProps) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-[28]"
      data-testid="soul-chart-intervention"
      data-teleport-phase={phase}
    >
      <details className="group/soul-intervention pointer-events-none absolute inset-0">
        <summary
          aria-label={`Open Soul warning: ${recommendation.title}`}
          className="portal-soul-chart-shard group/soul-shard pointer-events-auto absolute left-[clamp(1rem,4vw,3.5rem)] top-[clamp(3.25rem,7vh,4.75rem)] block h-11 w-11 cursor-pointer list-none overflow-visible rounded-full outline-none [&::-webkit-details-marker]:hidden"
        >
          <span className="portal-soul-chart-shard__aura" aria-hidden="true" />
          <span className="portal-soul-chart-shard__hitbox" aria-hidden="true" />
          <img
            alt=""
            aria-hidden="true"
            className="portal-soul-chart-shard__asset"
            src={soulAssetSrc}
          />
          <span className="pointer-events-none absolute left-9 top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-portal-control border border-red-200/16 bg-[linear-gradient(180deg,rgba(31,12,18,0.84),rgba(8,7,13,0.74))] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-red-50/68 opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.34),0_0_18px_rgba(239,68,68,0.14),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-[14px] transition duration-150 group-hover/soul-shard:opacity-100 group-focus-visible/soul-shard:opacity-100">
            Open warning
          </span>
        </summary>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_21%_24%,rgba(239,68,68,0.10),transparent_22%),linear-gradient(90deg,rgba(5,6,10,0.22),transparent_48%,rgba(5,6,10,0.10))] opacity-0 transition duration-200 group-open/soul-intervention:opacity-100" />
        <div className="pointer-events-none absolute left-[clamp(3.25rem,calc(4vw+2.25rem),5.75rem)] top-[clamp(4.05rem,calc(7vh+0.95rem),5.65rem)] isolate w-[min(430px,calc(100%-4.5rem))] overflow-hidden rounded-portal-panel border border-red-200/18 bg-[linear-gradient(180deg,rgba(18,13,24,0.91),rgba(5,8,14,0.82))] px-4 py-3 shadow-[0_0_0_1px_rgba(239,68,68,0.075),0_18px_56px_rgba(0,0,0,0.38),0_0_30px_rgba(239,68,68,0.10),0_0_44px_rgba(139,92,246,0.10),inset_0_1px_0_rgba(255,255,255,0.11)] opacity-0 backdrop-blur-[20px] transition duration-200 portal-clip-panel group-open/soul-intervention:pointer-events-auto group-open/soul-intervention:opacity-100">
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-red-100/34 to-transparent" />
          <div className="pointer-events-none absolute -left-10 top-8 h-px w-[150%] -rotate-6 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-red-50/58">
              Soul Intervention
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-violet-100/46">
              {recommendation.severity}
            </span>
          </div>
          <div className="mt-1.5 text-[14px] font-semibold leading-tight text-white/90">
            {recommendation.title}
          </div>
          <div className="mt-2 text-[11px] leading-4 text-white/64">
            {recommendation.evidenceSummary}
          </div>
          <div className="mt-2 border-l border-red-200/18 pl-2 font-mono text-[9px] leading-3 text-cyan-50/52">
            {recommendation.suggestedRule}
          </div>
          {recommendation.showLessAvailable ? (
            <div className="mt-2 rounded-portal-control border border-violet-200/12 bg-violet-300/[0.045] px-2 py-1 font-mono text-[8px] leading-3 text-violet-50/56">
              Ignored {recommendation.dismissalCount ?? 3} times.
            </div>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              className="rounded-portal-control px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/38 transition hover:bg-white/[0.04] hover:text-white/68"
              type="button"
              onClick={() => onIgnore(recommendation.id)}
            >
              Ignore
            </button>
            <button
              className="rounded-portal-control px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/38 transition hover:bg-white/[0.04] hover:text-white/68"
              type="button"
              onClick={() => onSnooze(recommendation.id)}
            >
              Snooze
            </button>
            <button
              className="rounded-portal-control border border-cyan-200/16 bg-cyan-300/[0.055] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-50/70 transition hover:border-cyan-200/28 hover:bg-cyan-300/[0.09] hover:text-cyan-50"
              type="button"
              onClick={() => onReviewRule(recommendation.id)}
            >
              Review Rule
            </button>
            {recommendation.showLessAvailable ? (
              <button
                className="rounded-portal-control border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/48 transition hover:border-violet-200/18 hover:bg-violet-300/[0.07] hover:text-violet-50"
                type="button"
                onClick={() => onShowLess?.(recommendation.id)}
              >
                Show These Warnings Less
              </button>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}
