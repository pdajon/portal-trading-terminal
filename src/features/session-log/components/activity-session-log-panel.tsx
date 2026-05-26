import React from "react";

import { AssetIconMark } from "@/components/market/asset-icon-mark";
import {
  formatSessionLogEventType,
  formatSessionLogPrice,
  formatSessionLogTimestamp,
  SESSION_LOG_FILTERS,
  type SessionLogEntry,
  type SessionLogFilter,
} from "@/features/session-log/lib/session-log";

const ACTIVITY_ENTRY_LIMIT = 6;

type ActivitySessionLogPanelProps = {
  entries: SessionLogEntry[];
  filter: SessionLogFilter;
  formatEstimatedBaseSize: (
    value: number,
    symbol: string | null | undefined,
  ) => string;
  formatUsd: (value: number) => string;
  isExpanded?: boolean;
  onFilterChange: (filter: SessionLogFilter) => void;
  onToggleExpanded?: () => void;
  totalEntryCount: number;
  variant?: "activity" | "footer";
};

export function ActivitySessionLogPanel({
  entries,
  filter,
  formatEstimatedBaseSize,
  formatUsd,
  isExpanded = false,
  onFilterChange,
  onToggleExpanded,
  totalEntryCount,
  variant = "activity",
}: ActivitySessionLogPanelProps) {
  if (variant === "footer") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
              Session Log
            </div>
            <div className="mt-2 text-sm text-white/44">
              History only. Orders, positions, protection, Discipline, and
              Magic.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-white/34">
              {totalEntryCount} event{totalEntryCount === 1 ? "" : "s"} stored
              locally
            </div>
            {onToggleExpanded ? (
              <button
                type="button"
                aria-label={isExpanded ? "Collapse session log" : "Expand session log"}
                aria-pressed={isExpanded}
                className="group inline-flex h-9 w-9 items-center justify-center rounded-portal-control border border-white/[0.06] bg-white/[0.035] text-white/46 transition duration-300 ease-out hover:border-cyan-300/24 hover:bg-cyan-300/[0.075] hover:text-cyan-100 hover:shadow-[0_0_18px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.09)]"
                onClick={onToggleExpanded}
              >
                <SessionLogExpandIcon isExpanded={isExpanded} />
              </button>
            ) : null}
          </div>
        </div>

        <SessionLogFilterControls
          activeFilter={filter}
          className="flex shrink-0 items-center gap-6 border-b border-white/[0.06] pb-3 text-[12px]"
          onFilterChange={onFilterChange}
        />

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          {entries.length === 0 ? (
            <SessionLogEmptyState
              title="Session log is empty."
              message="Execution and position events will appear here."
            />
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {entries.map((entry) => (
                <SessionLogEntryRow
                  key={entry.id}
                  entry={entry}
                  formatEstimatedBaseSize={formatEstimatedBaseSize}
                  formatUsd={formatUsd}
                  variant="footer"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const visibleEntries = entries.slice(0, ACTIVITY_ENTRY_LIMIT);
  const activeFilterLabel =
    SESSION_LOG_FILTERS.find((sessionFilter) => sessionFilter.id === filter)
      ?.label ?? "All";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase leading-none tracking-[0.16em] text-white/52">
            Recent Events
          </div>
          <div className="mt-1.5 text-[10px] leading-4 text-white/38">
            {totalEntryCount} event{totalEntryCount === 1 ? "" : "s"} stored
            locally
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-cyan-200/[0.12] bg-cyan-300/[0.055] px-2.5 py-1 font-mono text-[9px] text-cyan-100/70">
          {activeFilterLabel}
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-white/[0.055] pr-1">
        {visibleEntries.length === 0 ? (
          <SessionLogEmptyState
            title="Activity is quiet."
            message="Execution and system events will appear here."
          />
        ) : (
          <div className="divide-y divide-white/[0.055]">
            {visibleEntries.map((entry) => (
              <SessionLogEntryRow
                key={entry.id}
                entry={entry}
                formatEstimatedBaseSize={formatEstimatedBaseSize}
                formatUsd={formatUsd}
                variant="activity"
              />
            ))}
          </div>
        )}
      </div>

      {entries.length > visibleEntries.length ? (
        <div className="shrink-0 border-t border-white/[0.055] pt-2 text-[9px] text-white/34">
          Showing latest {visibleEntries.length} of {entries.length} filtered
          events.
        </div>
      ) : null}
    </div>
  );
}

function SessionLogFilterControls({
  activeFilter,
  className,
  onFilterChange,
}: {
  activeFilter: SessionLogFilter;
  className: string;
  onFilterChange: (filter: SessionLogFilter) => void;
}) {
  return (
    <div className={className}>
      {SESSION_LOG_FILTERS.map((sessionFilter) => (
        <button
          key={sessionFilter.id}
          type="button"
          className={`relative shrink-0 pb-2 font-medium transition ${
            activeFilter === sessionFilter.id
              ? "text-white"
              : "text-white/38 hover:text-white/66"
          }`}
          onClick={() => onFilterChange(sessionFilter.id)}
        >
          {sessionFilter.label}
          {activeFilter === sessionFilter.id ? (
            <span className="absolute inset-x-0 bottom-0 h-px bg-white/72" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function SessionLogEntryRow({
  entry,
  formatEstimatedBaseSize,
  formatUsd,
  variant,
}: {
  entry: SessionLogEntry;
  formatEstimatedBaseSize: (
    value: number,
    symbol: string | null | undefined,
  ) => string;
  formatUsd: (value: number) => string;
  variant: "activity" | "footer";
}) {
  if (variant === "activity") {
    return (
      <div className="grid gap-1.5 py-2.5">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-white/48">
            {formatSessionLogEventType(entry.eventType)}
          </div>
          <div className="shrink-0 font-mono text-[9px] text-white/30">
            {formatSessionLogTimestamp(entry.timestamp)}
          </div>
        </div>
        <div className="line-clamp-2 text-[11px] leading-4 text-white/78">
          {entry.description}
        </div>
        <SessionLogEntryMeta
          entry={entry}
          formatEstimatedBaseSize={formatEstimatedBaseSize}
          formatUsd={formatUsd}
          variant="activity"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 py-3 lg:grid-cols-[116px_minmax(0,1fr)] lg:items-start">
      <div className="font-mono text-[11px] text-white/36">
        {formatSessionLogTimestamp(entry.timestamp)}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/32">
            {formatSessionLogEventType(entry.eventType)}
          </span>
          <span className="text-[12px] text-white/34">{entry.source}</span>
        </div>
        <div className="mt-1 text-[13px] text-white/86">
          {entry.description}
        </div>
        <SessionLogEntryMeta
          entry={entry}
          formatEstimatedBaseSize={formatEstimatedBaseSize}
          formatUsd={formatUsd}
          variant="footer"
        />
      </div>
    </div>
  );
}

function SessionLogEntryMeta({
  entry,
  formatEstimatedBaseSize,
  formatUsd,
  variant,
}: {
  entry: SessionLogEntry;
  formatEstimatedBaseSize: (
    value: number,
    symbol: string | null | undefined,
  ) => string;
  formatUsd: (value: number) => string;
  variant: "activity" | "footer";
}) {
  const className =
    variant === "activity"
      ? "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-white/36"
      : "mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/42";

  return (
    <div className={className}>
      {entry.symbol ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <AssetIconMark
            asset={entry.symbol}
            className={variant === "activity" ? "h-3.5 w-3.5" : "h-4 w-4"}
          />
          <span className="truncate">{entry.symbol}</span>
        </span>
      ) : null}
      {entry.direction ? <span>{entry.direction}</span> : null}
      {entry.size !== null ? (
        <span className="font-mono">
          size {formatEstimatedBaseSize(entry.size, entry.symbol)}
        </span>
      ) : null}
      {entry.price !== null ? (
        <span className="font-mono">
          price {formatSessionLogPrice(entry.price)}
        </span>
      ) : null}
      {entry.pnl !== null ? (
        <span className="font-mono">PnL {formatUsd(entry.pnl)}</span>
      ) : null}
    </div>
  );
}

function SessionLogEmptyState({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-[110px] flex-col items-center justify-center text-center">
      <div className="text-sm font-medium text-white/84">{title}</div>
      <div className="mt-2 max-w-[220px] text-xs leading-5 text-white/42">
        {message}
      </div>
    </div>
  );
}

function SessionLogExpandIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-[18px] w-[18px] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isExpanded ? "rotate-180 scale-[1.02]" : ""
      }`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 8L10 4L14 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M6 12L10 16L14 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}
