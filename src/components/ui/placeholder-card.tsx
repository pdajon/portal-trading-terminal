import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type PlaceholderCardProps = {
  label: string;
  value: string;
  detail?: string;
  accent?: "default" | "success" | "danger";
  className?: string;
  children?: ReactNode;
};

const accentStyles = {
  default: "border-line bg-background/60",
  success: "border-success/30 bg-success/10",
  danger: "border-danger/30 bg-danger/10",
};

export function PlaceholderCard({
  label,
  value,
  detail,
  accent = "default",
  className,
  children,
}: PlaceholderCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accentStyles[accent],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
            {label}
          </p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
          {detail ? <p className="text-sm text-muted">{detail}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
