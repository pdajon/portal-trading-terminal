import { Panel } from "@/components/ui/panel";

const toolItems = ["Crosshair", "Trendline", "Range", "Long", "Short", "Note"];

export function LeftToolsRail() {
  return (
    <Panel className="flex h-full flex-col items-center gap-3 p-3">
      {toolItems.map((tool) => (
        <button
          key={tool}
          type="button"
          className="flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-background/60 px-2 text-center text-[11px] uppercase tracking-[0.18em] text-muted transition hover:border-accent/50 hover:text-foreground"
          title={tool}
        >
          {tool.slice(0, 2)}
        </button>
      ))}
    </Panel>
  );
}
