import React from "react";

export type AvatarExpSource = {
  detail: string;
  id: string;
  label: string;
  meta: string;
  tone: "neutral" | "positive" | "negative" | "warning";
};

export type AvatarExpEvent = {
  detail: string;
  exp: number;
  id: string;
  label: string;
  meta: string;
  tone: "neutral" | "positive" | "negative" | "warning";
};

export type AvatarExpProgress = {
  currentLevelExp: number;
  expToNextLevel: number | null;
  level: number;
  nextLevelExp: number | null;
  progressPercent: number;
  recentEvents: AvatarExpEvent[];
  totalExp: number;
};

type AvatarExpPanelProps = {
  onImportSource?: () => void;
  onOpenSource?: (sourceId: string) => void;
  progression: AvatarExpProgress;
  sources: AvatarExpSource[];
};

export function AvatarExpPanel({
  onImportSource,
  onOpenSource,
  progression,
  sources,
}: AvatarExpPanelProps) {
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(progression.progressPercent)),
  );
  const levelCopy =
    progression.nextLevelExp === null
      ? "Current shell stabilized."
      : `${progression.expToNextLevel ?? 0} EXP to Level ${progression.level + 1}.`;

  return (
    <div className="grid min-h-0 gap-1.5">
      <section className="grid gap-1.5 border-b border-white/[0.055] pb-1.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/44">
              Level {progression.level}
            </div>
            <div className="mt-0.5 text-[18px] font-semibold leading-none text-white/90">
              {progression.totalExp} EXP
            </div>
          </div>
          <div className="rounded-full border border-cyan-200/[0.12] bg-cyan-300/[0.055] px-2.5 py-1 font-mono text-[9px] text-cyan-100/72">
            {progressPercent}%
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(103,232,249,0.72),rgba(139,92,246,0.58))]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="font-mono text-[9px] text-white/34">
          {progression.totalExp - progression.currentLevelExp} /{" "}
          {progression.nextLevelExp === null
            ? progression.totalExp
            : progression.nextLevelExp - progression.currentLevelExp}{" "}
          shell EXP. {levelCopy}
        </div>
      </section>

      <section className="grid min-h-0 gap-1.5 border-b border-white/[0.055] pb-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/44">
            Recent EXP
          </div>
          <div className="font-mono text-[9px] text-white/34">
            {progression.recentEvents.length} events
          </div>
        </div>

        {progression.recentEvents.length > 0 ? (
          <div className="grid max-h-[92px] min-h-0 gap-1.5 overflow-y-auto pr-1">
            {progression.recentEvents.map((event) => (
              <div
                key={event.id}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-portal-control border px-2 py-1 ${getEventToneClass(event.tone)}`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-semibold leading-3 text-white/82">
                    {event.label}
                  </div>
                  <div className="truncate font-mono text-[8px] leading-3 text-white/38">
                    {event.meta} - {event.detail}
                  </div>
                </div>
                <div className="font-mono text-[10px] font-semibold text-cyan-100/74">
                  {event.exp > 0 ? "+" : ""}
                  {event.exp}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-portal-control border border-white/[0.055] bg-white/[0.02] px-3 py-3 text-[11px] leading-4 text-white/46">
            No EXP events yet.
          </div>
        )}
      </section>

      <section className="grid min-h-0 gap-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/44">
            Sources
          </div>
          <div className="font-mono text-[9px] text-white/34">
            {sources.length} connected
          </div>
        </div>

        {sources.length > 0 ? (
          <div className="flex min-h-0 flex-wrap gap-2 overflow-y-auto pr-1">
            {sources.slice(0, 4).map((source) => (
              <button
                key={source.id}
                type="button"
                className={`relative flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-full border px-2 text-center transition [clip-path:inset(0_round_999px)] ${getSourceToneClass(source.tone)}`}
                onClick={() => onOpenSource?.(source.id)}
              >
                <span className="pointer-events-none absolute inset-[-6px] rounded-full bg-cyan-200/[0.035] blur-lg" />
                <span className="relative text-[8px] font-semibold uppercase leading-3 tracking-[0.1em] text-white/42">
                  {source.label}
                </span>
                <span className="relative mt-0.5 text-[10px] font-semibold leading-3 text-white/82">
                  {source.detail}
                </span>
                <span className="relative mt-1 font-mono text-[8px] leading-3 text-white/48">
                  {source.meta}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-portal-control border border-white/[0.055] bg-white/[0.02] px-2 py-1.5 text-[10px] leading-3 text-white/46">
            No sources connected yet.
          </div>
        )}

        <button
          type="button"
          className="inline-flex h-6 items-center justify-center rounded-portal-control border border-dashed border-violet-300/18 bg-violet-400/[0.055] px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-100/72 transition hover:border-violet-300/28 hover:bg-violet-400/[0.09] hover:text-violet-50"
          onClick={onImportSource}
        >
          Import Source
        </button>
      </section>
    </div>
  );
}

function getEventToneClass(tone: AvatarExpEvent["tone"]) {
  switch (tone) {
    case "negative":
      return "border-rose-300/12 bg-rose-300/[0.035]";
    case "warning":
      return "border-amber-300/16 bg-amber-300/[0.045]";
    case "positive":
      return "border-cyan-200/[0.11] bg-cyan-300/[0.04]";
    default:
      return "border-white/[0.06] bg-white/[0.025]";
  }
}

function getSourceToneClass(tone: AvatarExpSource["tone"]) {
  switch (tone) {
    case "positive":
      return "border-emerald-300/16 bg-emerald-300/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    case "negative":
      return "border-rose-300/16 bg-rose-300/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    case "warning":
      return "border-amber-300/20 bg-amber-300/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
    default:
      return "border-cyan-200/[0.12] bg-cyan-300/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
  }
}
