import React from "react";

export type AvatarArmoryTone =
  | "active"
  | "critical"
  | "neutral"
  | "overridden"
  | "warning";

export type AvatarArmoryRuleState =
  | "active"
  | "armed"
  | "inactive"
  | "locked"
  | "overridden"
  | "triggered";

export type AvatarArmorySignal = {
  detail: string;
  id: string;
  label: string;
  state: AvatarArmoryRuleState;
  tone: AvatarArmoryTone;
  value: string;
};

export type AvatarArmoryMetric = {
  label: string;
  tone?: AvatarArmoryTone;
  value: string;
};

export type AvatarArmoryDisciplineControl = {
  control?: React.ReactNode;
  detail?: string;
  enabled: boolean;
  id: string;
  label: string;
  onToggle: () => void;
  tone?: "danger" | "standard" | "warning";
  value: string;
};

export type AvatarArmoryBlockedWindowControl = {
  enabled: boolean;
  id: string;
  label: string;
  onToggle: () => void;
  state: string;
  value: string;
};

type AvatarArmoryPanelProps = {
  activeRuleCount: number;
  blockedTimeWindows: AvatarArmoryBlockedWindowControl[];
  controls: AvatarArmoryDisciplineControl[];
  statusLabel: string;
};

export function AvatarArmoryPanel({
  activeRuleCount,
  blockedTimeWindows,
  controls,
  statusLabel,
}: AvatarArmoryPanelProps) {
  return (
    <div className="grid min-h-0 gap-2">
      <section className="relative isolate overflow-hidden rounded-portal-panel border border-amber-200/[0.12] bg-[linear-gradient(135deg,rgba(245,158,11,0.09),rgba(5,8,14,0.46)_48%,rgba(34,211,238,0.045))] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_22px_rgba(245,158,11,0.055)]">
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/24 to-transparent" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-amber-100/62">
              Discipline Controls
            </div>
            <div className="mt-1 text-[11px] font-medium text-white/72">
              Toggle the active rule set
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[12px] font-semibold text-amber-50/92">
              {activeRuleCount}
            </div>
            <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/38">
              {statusLabel}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-1.5">
        {controls.map((control) => (
          <DisciplineControlCard key={control.id} control={control} />
        ))}
      </section>

      {blockedTimeWindows.length > 0 ? (
        <section className="grid gap-1.5 border-t border-white/[0.055] pt-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/46">
              Blocked Windows
            </h4>
            <span className="font-mono text-[9px] text-white/34">
              {blockedTimeWindows.length}
            </span>
          </div>
          <div className="grid gap-1.5">
            {blockedTimeWindows.map((windowRule) => (
              <BlockedWindowControl
                key={windowRule.id}
                windowRule={windowRule}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DisciplineControlCard({
  control,
}: {
  control: AvatarArmoryDisciplineControl;
}) {
  const active = control.enabled;

  return (
    <div
      className={`rounded-portal-control border px-2.5 py-2 ${getControlToneClass(
        control.tone ?? "standard",
        active,
      )}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          role="switch"
          aria-label={`Toggle ${control.label}`}
          aria-checked={active}
          className="group flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left"
          onClick={() => {
            control.onToggle();
          }}
        >
          <SwitchPip active={active} tone={control.tone ?? "standard"} />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-semibold text-white/86">
              {control.label}
            </span>
            <span className="mt-0.5 block truncate font-mono text-[9px] text-white/36">
              {control.value}
            </span>
          </span>
        </button>
        {control.control ? (
          <div className="shrink-0">{control.control}</div>
        ) : null}
      </div>
      {control.detail ? (
        <div className="mt-1 truncate pl-[26px] text-[9px] text-white/38">
          {control.detail}
        </div>
      ) : null}
    </div>
  );
}

function BlockedWindowControl({
  windowRule,
}: {
  windowRule: AvatarArmoryBlockedWindowControl;
}) {
  const locked = windowRule.state === "locked";

  return (
    <div className="flex items-center justify-between gap-2 rounded-portal-control border border-white/[0.06] bg-black/20 px-2.5 py-2">
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold text-white/78">
          {windowRule.label}
        </div>
        <div className="mt-0.5 truncate font-mono text-[9px] text-white/36">
          {windowRule.value} · {windowRule.state}
        </div>
      </div>
      <button
        type="button"
        className={`shrink-0 rounded-portal-control border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition ${
          locked
            ? "border-amber-200/24 bg-amber-400/[0.11] text-amber-50"
            : windowRule.enabled
              ? "border-cyan-200/16 bg-cyan-300/[0.065] text-cyan-50/84 hover:text-white"
              : "border-white/[0.07] bg-white/[0.025] text-white/48 hover:text-white/74"
        }`}
        onClick={windowRule.onToggle}
      >
        {locked ? "Override" : windowRule.enabled ? "On" : "Off"}
      </button>
    </div>
  );
}

function SwitchPip({
  active,
  tone,
}: {
  active: boolean;
  tone: AvatarArmoryDisciplineControl["tone"];
}) {
  return (
    <span
      className={`pointer-events-none mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition ${
        active
          ? tone === "danger"
            ? "border-red-200/30 bg-red-500/24 shadow-[0_0_12px_rgba(248,113,113,0.16)]"
            : "border-amber-100/28 bg-amber-300/20 shadow-[0_0_12px_rgba(245,158,11,0.14)]"
          : "border-white/[0.08] bg-black/24"
      }`}
      aria-hidden="true"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? tone === "danger"
              ? "bg-red-100"
              : "bg-amber-100"
            : "bg-white/22"
        }`}
      />
    </span>
  );
}

function getControlToneClass(
  tone: AvatarArmoryDisciplineControl["tone"],
  active: boolean,
) {
  if (!active) {
    return "border-white/[0.055] bg-white/[0.018]";
  }

  if (tone === "danger") {
    return "border-red-300/[0.16] bg-red-500/[0.055]";
  }

  if (tone === "warning") {
    return "border-amber-300/[0.16] bg-amber-300/[0.055]";
  }

  return "border-cyan-200/[0.11] bg-cyan-300/[0.04]";
}
