import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

export function Panel({ children, className }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-portal-panel border border-line bg-panel/90 shadow-panel backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}
