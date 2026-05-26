"use client";

type ChartLimitPriceArmatureProps = {
  label: string;
  width?: number;
};

export function ChartLimitPriceArmature({
  label,
  width,
}: ChartLimitPriceArmatureProps) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none flex w-[min(480px,calc(100vw-2rem))] items-center justify-center gap-3 text-center"
      style={width ? { width } : undefined}
    >
      <span
        aria-hidden="true"
        className="h-px min-w-10 flex-1 bg-[linear-gradient(90deg,transparent,rgba(69,216,255,0.36))]"
      />
      <span className="inline-flex h-8 max-w-[220px] items-center justify-center rounded-full border border-cyan-100/[0.14] bg-[#030711] px-3.5 text-[12px] font-medium leading-none tracking-normal text-cyan-50/86 shadow-[0_0_0_1px_rgba(8,13,22,0.92),0_10px_24px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <span className="relative z-10 truncate">{label}</span>
      </span>
      <span
        aria-hidden="true"
        className="h-px min-w-10 flex-1 bg-[linear-gradient(90deg,rgba(69,216,255,0.36),transparent)]"
      />
    </div>
  );
}
