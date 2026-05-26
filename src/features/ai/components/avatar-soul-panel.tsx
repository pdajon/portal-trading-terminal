import React from "react";

export type AvatarSoulTone =
  | "neutral"
  | "positive"
  | "negative"
  | "warning"
  | "critical";

export type AvatarSoulWarning = {
  id: string;
  message: string;
  severity: "info" | "warning" | "critical";
  source: string;
  symbol?: string;
  title: string;
};

export type AvatarSoulObservation = {
  body: string;
  details: string[];
  id: string;
  state: string;
  title: string;
};

export type AvatarSoulFinding = {
  id: string;
  severity: AvatarSoulTone;
  signalCount: number;
  summary: string;
  title: string;
};

export type AvatarSoulSource = {
  detail: string;
  id: string;
  label: string;
  meta: string;
  tone: AvatarSoulTone;
};

export type AvatarSoulRecommendation = {
  dismissalCount?: number;
  evidenceSummary: string;
  id: string;
  severity: "info" | "warning" | "critical";
  showLessAvailable?: boolean;
  suggestedRule: string;
  title: string;
  type: string;
};

type AvatarSoulDiagnosis = {
  confidence: string;
  generatedAtLabel: string;
  planStatus: string;
  planSummary: string;
  planTitle: string;
  profitLeaks: AvatarSoulFinding[];
  readyRuleCount: number;
  recommendedRuleCount: number;
  sampleSize: number;
  strengths: AvatarSoulFinding[];
};

type AvatarSoulSystemInsight = {
  label: string;
  tone?: AvatarSoulTone;
  value: string;
};

type AvatarSoulPanelProps = {
  coachState: string;
  diagnosis: AvatarSoulDiagnosis;
  dismissedWarningCount: number;
  onDismissRecommendation?: (recommendationId: string) => void;
  onReviewRecommendation?: (recommendationId: string) => void;
  onShowLessRecommendation?: (recommendationId: string) => void;
  onSnoozeRecommendation?: (recommendationId: string) => void;
  observations: AvatarSoulObservation[];
  recommendations: AvatarSoulRecommendation[];
  sources: AvatarSoulSource[];
  systemInsights: AvatarSoulSystemInsight[];
  warnings: AvatarSoulWarning[];
};

export function AvatarSoulPanel({
  coachState,
  diagnosis,
  dismissedWarningCount,
  onDismissRecommendation,
  onReviewRecommendation,
  onShowLessRecommendation,
  onSnoozeRecommendation,
  observations,
  recommendations,
  sources,
  systemInsights,
  warnings,
}: AvatarSoulPanelProps) {
  const visibleWarnings = warnings.slice(0, 2);
  const visibleRecommendations = recommendations.slice(0, 2);
  const visibleObservations = observations.slice(0, 2);
  const visibleProfitLeaks = diagnosis.profitLeaks.slice(0, 2);
  const visibleStrengths = diagnosis.strengths.slice(0, 1);
  const visibleSources = sources.slice(0, 3);

  return (
    <div className="grid min-h-0 gap-2.5">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.055] pb-2">
        <div>
          <div className="text-[9px] font-semibold uppercase leading-none tracking-[0.16em] text-violet-100/58">
            System State
          </div>
          <div className="mt-1 text-[12px] font-semibold text-white/88">
            {coachState}
          </div>
        </div>
        <div className="rounded-full border border-violet-300/14 bg-violet-400/[0.07] px-2.5 py-1 font-mono text-[9px] text-violet-50/72">
          {visibleWarnings.length} live
        </div>
      </div>

      <section className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/48">
            Active Warnings
          </h4>
          {dismissedWarningCount > 0 ? (
            <span className="font-mono text-[9px] text-white/34">
              {dismissedWarningCount} hidden
            </span>
          ) : null}
        </div>
        {visibleWarnings.length > 0 ? (
          <div className="grid gap-1.5">
            {visibleWarnings.map((warning) => (
              <div
                key={warning.id}
                className={`rounded-portal-control border px-2.5 py-2 ${getWarningToneClass(
                  warning.severity,
                )}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-[11px] font-semibold text-white/88">
                    {warning.title}
                  </div>
                  {warning.symbol ? (
                    <div className="shrink-0 font-mono text-[8px] text-white/36">
                      {warning.symbol}
                    </div>
                  ) : null}
                </div>
                <div className="mt-1 text-[10px] leading-4 text-white/58">
                  {warning.message}
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/32">
                  {warning.source}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-portal-control border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-4 text-white/44">
            No active warnings.
          </div>
        )}
      </section>

      <section className="grid gap-1.5 border-t border-white/[0.055] pt-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/48">
            Soul Recommendations
          </h4>
          <span className="font-mono text-[9px] text-white/34">
            {recommendations.length} open
          </span>
        </div>
        {visibleRecommendations.length > 0 ? (
          <div className="grid gap-1.5">
            {visibleRecommendations.map((recommendation) => (
              <div
                key={recommendation.id}
                className={`rounded-portal-control border px-2.5 py-2 ${getRecommendationToneClass(
                  recommendation.severity,
                )}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-[11px] font-semibold text-white/86">
                    {recommendation.title}
                  </div>
                  <span className="shrink-0 font-mono text-[8px] uppercase text-white/36">
                    {recommendation.severity}
                  </span>
                </div>
                <div className="mt-1 text-[10px] leading-4 text-white/56">
                  {recommendation.evidenceSummary}
                </div>
                <div className="mt-1 rounded-portal-control border border-white/[0.055] bg-white/[0.025] px-2 py-1 font-mono text-[8px] leading-3 text-white/42">
                  {recommendation.suggestedRule}
                </div>
                {recommendation.showLessAvailable ? (
                  <div className="mt-1.5 rounded-portal-control border border-violet-200/12 bg-violet-300/[0.045] px-2 py-1 font-mono text-[8px] leading-3 text-violet-50/52">
                    Ignored {recommendation.dismissalCount ?? 3} times. You can quiet this warning type.
                  </div>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className="rounded-portal-control px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/36 transition hover:bg-white/[0.035] hover:text-white/62"
                    onClick={() => onDismissRecommendation?.(recommendation.id)}
                  >
                    Ignore
                  </button>
                  <button
                    type="button"
                    className="rounded-portal-control px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/36 transition hover:bg-white/[0.035] hover:text-white/62"
                    onClick={() => onSnoozeRecommendation?.(recommendation.id)}
                  >
                    Snooze
                  </button>
                  <button
                    type="button"
                    className="rounded-portal-control border border-violet-300/14 bg-violet-400/[0.055] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-violet-100/72 transition hover:border-violet-300/24 hover:bg-violet-400/[0.09] hover:text-violet-50"
                    onClick={() => onReviewRecommendation?.(recommendation.id)}
                  >
                    Review Rule
                  </button>
                  {recommendation.showLessAvailable ? (
                    <button
                      type="button"
                      className="rounded-portal-control border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/50 transition hover:border-violet-200/18 hover:bg-violet-300/[0.07] hover:text-violet-50"
                      onClick={() => onShowLessRecommendation?.(recommendation.id)}
                    >
                      Show These Warnings Less
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-portal-control border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-4 text-white/44">
            No Soul recommendations yet.
          </div>
        )}
      </section>

      <section className="grid gap-1.5">
        <h4 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/48">
          Recent Observations
        </h4>
        {visibleObservations.length > 0 ? (
          <div className="grid gap-1.5">
            {visibleObservations.map((observation) => (
              <div
                key={observation.id}
                className={`rounded-portal-control border px-2.5 py-2 ${getStateToneClass(
                  observation.state,
                )}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-[11px] font-semibold text-white/84">
                    {observation.title}
                  </div>
                  <span className="shrink-0 font-mono text-[8px] text-white/34">
                    {observation.state}
                  </span>
                </div>
                <div className="mt-1 text-[10px] leading-4 text-white/56">
                  {observation.body}
                </div>
                {observation.details[0] ? (
                  <div className="mt-1 truncate font-mono text-[8px] text-white/32">
                    {observation.details[0]}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-portal-control border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-4 text-white/44">
            Awaiting stronger coach signal.
          </div>
        )}
      </section>

      <section className="grid gap-1.5 border-t border-white/[0.055] pt-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/48">
            Diagnosis
          </h4>
          <span className="font-mono text-[9px] text-white/34">
            {diagnosis.sampleSize} samples
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <SignalStat label="Confidence" value={diagnosis.confidence} />
          <SignalStat label="Updated" value={diagnosis.generatedAtLabel} />
          <SignalStat
            label="Rules"
            value={`${diagnosis.readyRuleCount}/${diagnosis.recommendedRuleCount}`}
          />
        </div>

        {diagnosis.sampleSize === 0 ? (
          <div className="rounded-portal-control border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-4 text-white/44">
            Not enough evidence yet.
          </div>
        ) : (
          <div className="grid gap-1.5">
            {[...visibleProfitLeaks, ...visibleStrengths].map((finding) => (
              <div
                key={finding.id}
                className={`rounded-portal-control border px-2.5 py-2 ${getFindingToneClass(
                  finding.severity,
                )}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-[11px] font-semibold text-white/84">
                    {finding.title}
                  </div>
                  <span className="shrink-0 font-mono text-[8px] text-white/34">
                    {finding.signalCount} signals
                  </span>
                </div>
                <div className="mt-1 text-[10px] leading-4 text-white/56">
                  {finding.summary}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-portal-control border border-violet-200/[0.10] bg-violet-400/[0.045] px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 truncate text-[10px] font-semibold text-violet-50/82">
              {diagnosis.planTitle}
            </div>
            <span className="shrink-0 font-mono text-[8px] uppercase text-violet-100/48">
              {diagnosis.planStatus}
            </span>
          </div>
          <div className="mt-1 text-[10px] leading-4 text-white/50">
            {diagnosis.planSummary}
          </div>
        </div>
      </section>

      <section className="grid gap-1.5 border-t border-white/[0.055] pt-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/48">
            Imported Sources
          </h4>
          <span className="font-mono text-[9px] text-white/34">
            {sources.length} linked
          </span>
        </div>
        {visibleSources.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleSources.map((source) => (
              <div
                key={source.id}
                className={`grid h-[58px] w-[58px] place-items-center rounded-full border px-1.5 text-center ${getSourceToneClass(
                  source.tone,
                )}`}
              >
                <div>
                  <div className="text-[7px] font-semibold uppercase leading-3 tracking-[0.08em] text-white/42">
                    {source.label}
                  </div>
                  <div className="mt-0.5 text-[9px] font-semibold leading-3 text-white/80">
                    {source.detail}
                  </div>
                  <div className="mt-0.5 font-mono text-[7px] leading-3 text-white/42">
                    {source.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-portal-control border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-4 text-white/44">
            No imported sources connected.
          </div>
        )}
      </section>

      {systemInsights.length > 0 ? (
        <section className="grid gap-1.5 border-t border-white/[0.055] pt-2">
          <h4 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/48">
            Signal State
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {systemInsights.slice(0, 4).map((insight) => (
              <SignalStat
                key={insight.label}
                label={insight.label}
                tone={insight.tone}
                value={insight.value}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SignalStat({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: AvatarSoulTone;
  value: string;
}) {
  return (
    <div
      className={`rounded-portal-control border px-2 py-1.5 ${getStatToneClass(tone)}`}
    >
      <div className="text-[7px] uppercase tracking-[0.12em] text-white/28">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-[9px] text-white/72">
        {value}
      </div>
    </div>
  );
}

function getWarningToneClass(severity: AvatarSoulWarning["severity"]) {
  switch (severity) {
    case "critical":
      return "border-rose-300/18 bg-rose-400/[0.065]";
    case "warning":
      return "border-amber-300/18 bg-amber-400/[0.06]";
    default:
      return "border-cyan-200/[0.10] bg-cyan-300/[0.04]";
  }
}

function getRecommendationToneClass(severity: AvatarSoulRecommendation["severity"]) {
  switch (severity) {
    case "critical":
      return "border-rose-300/18 bg-rose-400/[0.055]";
    case "warning":
      return "border-amber-300/16 bg-amber-300/[0.05]";
    default:
      return "border-cyan-200/[0.10] bg-cyan-300/[0.035]";
  }
}

function getFindingToneClass(tone: AvatarSoulTone) {
  switch (tone) {
    case "positive":
      return "border-emerald-300/14 bg-emerald-300/[0.045]";
    case "critical":
    case "negative":
      return "border-rose-300/18 bg-rose-400/[0.055]";
    case "warning":
      return "border-amber-300/16 bg-amber-300/[0.05]";
    default:
      return "border-cyan-200/[0.10] bg-cyan-300/[0.035]";
  }
}

function getSourceToneClass(tone: AvatarSoulTone) {
  switch (tone) {
    case "positive":
      return "border-emerald-300/16 bg-emerald-300/[0.055]";
    case "critical":
    case "negative":
      return "border-rose-300/16 bg-rose-300/[0.055]";
    case "warning":
      return "border-amber-300/18 bg-amber-300/[0.055]";
    default:
      return "border-cyan-200/[0.12] bg-cyan-300/[0.045]";
  }
}

function getStateToneClass(state: string) {
  switch (state) {
    case "Warning":
      return "border-amber-300/16 bg-amber-300/[0.055]";
    case "Insight Available":
      return "border-violet-300/14 bg-violet-400/[0.06]";
    case "Not Enough Data":
      return "border-white/[0.055] bg-white/[0.02]";
    default:
      return "border-cyan-200/[0.10] bg-cyan-300/[0.035]";
  }
}

function getStatToneClass(tone: AvatarSoulTone) {
  switch (tone) {
    case "positive":
      return "border-emerald-300/12 bg-emerald-300/[0.04]";
    case "critical":
    case "negative":
      return "border-rose-300/14 bg-rose-300/[0.045]";
    case "warning":
      return "border-amber-300/14 bg-amber-300/[0.045]";
    default:
      return "border-white/[0.055] bg-white/[0.02]";
  }
}
