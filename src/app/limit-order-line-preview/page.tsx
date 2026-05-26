"use client";

import { useMemo, useState } from "react";

type OrderSide = "buy" | "sell";

type PreviewOrder = {
  id: string;
  price: number;
  size: string;
  side: OrderSide;
  top: number;
};

type VariantKey = "glass" | "command" | "ghost";
type TooltipVariantKey = "reference" | "glass" | "signal";
type TooltipTarget = "cancel" | "drag";
type ActiveTooltipTarget = {
  orderId: string;
  target: TooltipTarget;
} | null;

const orders: PreviewOrder[] = [
  { id: "sell-83483", price: 83483, size: "0.00071", side: "sell", top: 24 },
  { id: "sell-82551", price: 82551, size: "0.00071", side: "sell", top: 30 },
  { id: "buy-75166", price: 75166, size: "0.00112", side: "buy", top: 67 },
  { id: "buy-74583", price: 74583, size: "0.00173", side: "buy", top: 70 },
  { id: "buy-74013", price: 74013, size: "0.00144", side: "buy", top: 73 },
];

const variants: Array<{
  description: string;
  key: VariantKey;
  label: string;
}> = [
  {
    key: "glass",
    label: "Glass Ledger",
    description: "closest to Hyperliquid, cleaner Portal glass",
  },
  {
    key: "command",
    label: "Command Slab",
    description: "more Portal-native, stronger execution readout",
  },
  {
    key: "ghost",
    label: "Ghost Stack",
    description: "quietest chart-first treatment",
  },
];

const tooltipVariants: Array<{
  description: string;
  key: TooltipVariantKey;
  label: string;
}> = [
  {
    key: "reference",
    label: "Reference Smoke",
    description: "closest to the Hyperliquid tooltip block",
  },
  {
    key: "glass",
    label: "Portal Glass",
    description: "darker glass with a restrained cyan edge",
  },
  {
    key: "signal",
    label: "Signal Tab",
    description: "compact operator tag with a sharper pointer",
  },
];

const candles = [
  34, 43, 38, 51, 45, 57, 50, 44, 53, 61, 48, 42, 36, 32, 39, 47, 56, 69, 76,
  66, 58, 53, 49, 45, 51, 54, 62, 70, 81, 75, 67, 63, 59, 65, 72, 78, 69, 62,
  58, 54, 50, 56, 61, 64, 60, 55, 52, 49, 46, 50, 53, 57, 55, 59, 64, 68, 71,
  66, 62, 60, 63, 67,
];

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(price);
}

function getDeckTop(
  order: PreviewOrder,
  cluster: PreviewOrder[],
  compression: number,
) {
  const index = cluster.findIndex((item) => item.id === order.id);
  const base = cluster[0]?.top ?? order.top;
  const naturalGap = order.top - base;
  const compressedGap = index * 2.1;
  return base + naturalGap * (1 - compression) + compressedGap * compression;
}

function getOrderTone(side: OrderSide) {
  if (side === "buy") {
    return {
      axis: "bg-[#4fb887] text-emerald-50",
      chipBorder: "border-emerald-300/62",
      chipGlow: "shadow-[0_0_0_1px_rgba(34,197,94,0.22),0_0_18px_rgba(34,197,94,0.14),inset_0_1px_0_rgba(255,255,255,0.10)]",
      label: "text-emerald-100",
      line: "border-emerald-300/75",
      soft: "bg-emerald-300/[0.08]",
    };
  }

  return {
    axis: "bg-[#d75e78] text-rose-50",
    chipBorder: "border-rose-300/62",
    chipGlow: "shadow-[0_0_0_1px_rgba(255,61,138,0.20),0_0_18px_rgba(255,61,138,0.13),inset_0_1px_0_rgba(255,255,255,0.10)]",
    label: "text-rose-100",
    line: "border-rose-300/75",
    soft: "bg-rose-300/[0.08]",
  };
}

function HoverTooltip({
  children,
  target,
  variant,
  visible,
}: {
  children: React.ReactNode;
  target: TooltipTarget;
  variant: TooltipVariantKey;
  visible: boolean;
}) {
  const placement =
    target === "cancel"
      ? "left-1/2 w-max -translate-x-[76%]"
      : "left-1/2 w-max -translate-x-[46%]";
  const visibility = visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0";
  const arrowPlacement =
    target === "cancel" ? "left-[76%]" : "left-[46%]";

  if (variant === "glass") {
    return (
      <span
        data-tooltip-kind={target}
        className={`pointer-events-none absolute bottom-[calc(100%+10px)] ${placement} z-50 translate-y-1 rounded-portal-chip border border-cyan-200/22 bg-[linear-gradient(180deg,rgba(10,19,32,0.96),rgba(4,8,15,0.94))] px-3.5 py-2 text-[13px] font-medium text-cyan-50 opacity-0 shadow-[0_18px_42px_rgba(0,0,0,0.45),0_0_18px_rgba(51,245,255,0.14),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-[18px] transition duration-150 portal-clip-chip ${visibility}`}
      >
        {children}
        <span
          className={`absolute top-[calc(100%-1px)] ${arrowPlacement} h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-cyan-200/22 bg-[#050a12]`}
        />
      </span>
    );
  }

  if (variant === "signal") {
    return (
      <span
        data-tooltip-kind={target}
        className={`pointer-events-none absolute bottom-[calc(100%+9px)] ${placement} z-50 translate-y-1 rounded-portal-chip border border-white/12 bg-[linear-gradient(90deg,rgba(12,16,28,0.96),rgba(18,11,30,0.92))] px-3 py-1.5 font-value text-[12px] font-semibold uppercase tracking-[0.11em] text-white/88 opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.42),0_0_16px_rgba(139,92,246,0.14)] transition duration-150 portal-clip-chip ${visibility}`}
      >
        {children}
        <span
          className={`absolute top-[calc(100%-1px)] ${arrowPlacement} h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-white/12 bg-[#0d0b17]`}
        />
      </span>
    );
  }

  return (
    <span
      data-tooltip-kind={target}
      className={`pointer-events-none absolute bottom-[calc(100%+9px)] ${placement} z-50 translate-y-1 rounded-portal-chip bg-[#3a3d49] px-4 py-2 text-[17px] font-medium text-white opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.38)] transition duration-150 portal-clip-chip ${visibility}`}
    >
      {children}
      <span
        className={`absolute top-[calc(100%-1px)] ${arrowPlacement} h-3 w-3 -translate-x-1/2 rotate-45 bg-[#3a3d49]`}
      />
    </span>
  );
}

function LimitLine({
  compression,
  activeTooltipTarget,
  order,
  setActiveTooltipTarget,
  stackIndex,
  tooltipVariant,
  top,
  variant,
}: {
  compression: number;
  activeTooltipTarget: ActiveTooltipTarget;
  order: PreviewOrder;
  setActiveTooltipTarget: (target: ActiveTooltipTarget) => void;
  stackIndex: number;
  tooltipVariant: TooltipVariantKey;
  top: number;
  variant: VariantKey;
}) {
  const tone = getOrderTone(order.side);
  const label = `Limit ${formatPrice(order.price)} N/A`;
  const dragTooltipVisible =
    activeTooltipTarget?.orderId === order.id &&
    activeTooltipTarget.target === "drag";
  const cancelTooltipVisible =
    activeTooltipTarget?.orderId === order.id &&
    activeTooltipTarget.target === "cancel";
  const tooltipVisible = dragTooltipVisible || cancelTooltipVisible;

  return (
    <div
      className="absolute inset-x-0"
      style={{
        zIndex: tooltipVisible ? 140 : 42 - stackIndex,
        top: `${top}%`,
      }}
    >
      <div
        className={`absolute left-0 right-[112px] top-1/2 border-t ${tone.line}`}
        style={{
          borderTopStyle: "dashed",
          opacity: variant === "ghost" ? 0.58 : 0.78,
        }}
      />
      <div
        className={`absolute right-0 top-1/2 h-[27px] w-[88px] -translate-y-1/2 rounded-portal-chip ${tone.axis} portal-clip-chip px-3 text-right font-value text-[20px] leading-[27px] shadow-[0_8px_20px_rgba(0,0,0,0.30)]`}
      >
        {formatPrice(order.price)}
      </div>

      {variant === "glass" ? (
        <button
          className={`group absolute left-[30%] top-1/2 grid h-[34px] -translate-y-1/2 grid-cols-[12px_180px_104px_34px] overflow-hidden rounded-portal-chip border ${tone.chipBorder} bg-[linear-gradient(180deg,rgba(221,240,255,0.88),rgba(135,162,190,0.55))] font-value text-[16px] font-semibold text-[#0b1320] ${tone.chipGlow} portal-clip-chip`}
          style={{
            opacity: 1,
            transform: `translateY(-50%) translateX(${stackIndex * compression * 2}px)`,
          }}
          type="button"
          title={`Cancel ${label}`}
        >
          <span className={`h-full w-full ${tone.soft}`}>
            <span className={`mx-auto mt-[7px] block h-5 w-px ${tone.axis}`} />
          </span>
          <span className="flex items-center px-3 text-[#2f99ff]">{label}</span>
          <span className="flex items-center justify-end border-l border-[#2995ff]/70 bg-[#050a13] px-3 text-white">
            {order.size}
          </span>
          <span className="flex items-center justify-center border-l border-[#2995ff]/75 bg-[#dbeafe]/82 text-[24px] font-light text-[#2f99ff] transition group-hover:bg-[#f3f8ff]">
            x
          </span>
        </button>
      ) : null}

      {variant === "command" ? (
        <button
          className={`group absolute left-[28%] top-1/2 grid h-[32px] -translate-y-1/2 grid-cols-[74px_128px_96px_34px] overflow-hidden rounded-portal-chip border ${tone.chipBorder} bg-[linear-gradient(180deg,rgba(8,18,31,0.92),rgba(3,7,13,0.94))] text-[12px] ${tone.chipGlow} portal-clip-chip`}
          style={{
            opacity: 1,
            transform: `translateY(-50%) translateX(${stackIndex * compression * 2}px)`,
          }}
          type="button"
          title={`Cancel ${label}`}
        >
          <span className={`flex items-center px-3 font-semibold uppercase tracking-[0.18em] ${tone.label}`}>
            {order.side === "buy" ? "Buy" : "Sell"} LMT
          </span>
          <span className="flex items-center border-l border-white/10 px-3 font-value text-[15px] font-semibold text-white">
            {formatPrice(order.price)}
          </span>
          <span className="flex items-center justify-end border-l border-cyan-200/12 px-3 font-value text-[15px] text-cyan-100">
            {order.size}
          </span>
          <span className="flex items-center justify-center border-l border-white/10 bg-white/[0.06] text-[19px] text-cyan-100 transition group-hover:bg-cyan-300/14 group-hover:text-white">
            x
          </span>
        </button>
      ) : null}

      {variant === "ghost" ? (
        <div
          className={`absolute left-[31%] top-1/2 grid h-[30px] -translate-y-1/2 grid-cols-[164px_94px_30px] rounded-portal-chip border ${tone.chipBorder} bg-[linear-gradient(180deg,#07111d,#03070d)] text-[12px] ${tone.chipGlow}`}
          style={{
            opacity: 1,
            transform: `translateY(-50%) translateX(${stackIndex * compression * 2}px)`,
          }}
        >
          <button
            className={`group relative flex cursor-grab items-center rounded-l-portal-chip px-3 font-value text-[14px] font-semibold outline-none transition hover:bg-white/[0.055] active:cursor-grabbing ${tone.label}`}
            data-order-id={order.id}
            data-preview-target="drag-handle"
            onBlur={() => setActiveTooltipTarget(null)}
            onClick={() =>
              setActiveTooltipTarget({ orderId: order.id, target: "drag" })
            }
            onFocus={() =>
              setActiveTooltipTarget({ orderId: order.id, target: "drag" })
            }
            onMouseEnter={() =>
              setActiveTooltipTarget({ orderId: order.id, target: "drag" })
            }
            onMouseLeave={() => setActiveTooltipTarget(null)}
            type="button"
          >
            Limit {formatPrice(order.price)}
            <HoverTooltip
              target="drag"
              variant={tooltipVariant}
              visible={dragTooltipVisible}
            >
              Drag to modify price
            </HoverTooltip>
          </button>
          <span className="flex items-center justify-end border-l border-white/10 px-2 font-value text-[14px] text-white/92">
            {order.size}
          </span>
          <button
            className="group relative flex items-center justify-center rounded-r-portal-chip border-l border-white/10 text-[17px] text-white/76 outline-none transition hover:bg-white/10 hover:text-white"
            data-order-id={order.id}
            data-preview-target="cancel-cell"
            onBlur={() => setActiveTooltipTarget(null)}
            onClick={() =>
              setActiveTooltipTarget({ orderId: order.id, target: "cancel" })
            }
            onFocus={() =>
              setActiveTooltipTarget({ orderId: order.id, target: "cancel" })
            }
            onMouseEnter={() =>
              setActiveTooltipTarget({ orderId: order.id, target: "cancel" })
            }
            onMouseLeave={() => setActiveTooltipTarget(null)}
            type="button"
          >
            x
            <HoverTooltip
              target="cancel"
              variant={tooltipVariant}
              visible={cancelTooltipVisible}
            >
              Click to cancel
            </HoverTooltip>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MockCandles() {
  return (
    <div className="absolute inset-x-3 bottom-[13%] top-[16%] z-10 flex gap-[5px] opacity-90">
      {candles.map((height, index) => {
        const up = index === 0 || height >= candles[index - 1];
        const open = index === 0 ? height - 6 : candles[index - 1];
        const close = height;
        const bodyTop = Math.max(4, 100 - Math.max(open, close));
        const bodyBottom = Math.min(94, 100 - Math.min(open, close));
        const bodyHeight = Math.max(4, bodyBottom - bodyTop);
        const wickTop = Math.max(2, bodyTop - 8 - ((index * 5) % 9));
        const wickBottom = Math.min(98, bodyBottom + 9 + ((index * 7) % 12));
        return (
          <div key={`${height}-${index}`} className="relative h-full flex-1">
            <span
              className={`absolute left-1/2 w-px -translate-x-1/2 ${up ? "bg-[#19d1bb]" : "bg-[#ff4d5e]"}`}
              style={{
                height: `${Math.max(8, wickBottom - wickTop)}%`,
                top: `${wickTop}%`,
              }}
            />
            <span
              className={`absolute left-1/2 w-full max-w-[7px] -translate-x-1/2 ${up ? "bg-[#17c6b5]" : "bg-[#ff4f5d]"}`}
              style={{
                height: `${bodyHeight}%`,
                top: `${bodyTop}%`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function PreviewChart({
  compression,
  tooltipVariant,
  variant,
}: {
  compression: number;
  tooltipVariant: TooltipVariantKey;
  variant: VariantKey;
}) {
  const [activeTooltipTarget, setActiveTooltipTarget] =
    useState<ActiveTooltipTarget>(null);
  const renderedOrders = useMemo(() => {
    const sellOrders = orders.filter((order) => order.side === "sell");
    const buyOrders = orders.filter((order) => order.side === "buy");

    return orders.map((order) => ({
      order,
      stackIndex: (order.side === "sell" ? sellOrders : buyOrders).findIndex(
        (item) => item.id === order.id,
      ),
      top: getDeckTop(order, order.side === "sell" ? sellOrders : buyOrders, compression),
    }));
  }, [compression]);

  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-portal-panel border border-cyan-100/[0.10] bg-[#071119] shadow-[0_28px_90px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.055)] portal-clip-panel">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(170,211,255,0.075)_1px,transparent_1px),linear-gradient(90deg,rgba(170,211,255,0.075)_1px,transparent_1px)] bg-[size:100px_76px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_56%_34%,rgba(51,245,255,0.08),transparent_28%),radial-gradient(circle_at_38%_70%,rgba(139,92,246,0.07),transparent_32%),linear-gradient(180deg,rgba(3,8,13,0.12),rgba(2,4,9,0.72))]" />
      <div className="absolute left-5 top-5 z-30 flex items-center gap-3 font-sans text-[19px] text-white/78">
        <span>BTCUSD</span>
        <span className="text-white/35">-</span>
        <span>2h</span>
        <span className="text-white/35">-</span>
        <span>Hyperliquid</span>
        <span className="ml-2 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_8px_rgba(52,211,153,0.10)]" />
        <span className="font-value text-[#ef676c]">C77,611 -0.13%</span>
      </div>

      <MockCandles />

      <div className="absolute inset-x-0 top-[52%] z-20">
        <div className="absolute left-0 right-[112px] border-t border-[#ef5e6d]/80" style={{ borderTopStyle: "dashed" }} />
        <div className="absolute right-0 top-1/2 h-[28px] w-[88px] -translate-y-1/2 rounded-portal-chip bg-[#d95760] px-3 text-right font-value text-[20px] leading-[28px] text-white portal-clip-chip">
          77,611
        </div>
      </div>

      {renderedOrders.map(({ order, stackIndex, top }) => (
        <LimitLine
          activeTooltipTarget={activeTooltipTarget}
          compression={compression}
          key={order.id}
          order={order}
          setActiveTooltipTarget={setActiveTooltipTarget}
          stackIndex={stackIndex}
          tooltipVariant={tooltipVariant}
          top={top}
          variant={variant}
        />
      ))}

      <div className="absolute bottom-5 left-5 right-5 z-30 flex items-center justify-between border-t border-white/[0.08] pt-4 font-sans text-[16px] text-white/62">
        <div className="flex gap-5">
          <span>5y</span>
          <span>1y</span>
          <span>6m</span>
          <span>3m</span>
          <span>1m</span>
          <span>5d</span>
          <span className="text-cyan-100">1d</span>
        </div>
        <div className="font-value">18:13:16 (UTC-5)</div>
      </div>
    </div>
  );
}

export default function LimitOrderLinePreviewPage() {
  const [activeVariant, setActiveVariant] = useState<VariantKey>("ghost");
  const [activeTooltipVariant, setActiveTooltipVariant] =
    useState<TooltipVariantKey>("reference");
  const [compression, setCompression] = useState(0.82);
  const activeVariantMeta = variants.find((variant) => variant.key === activeVariant) ?? variants[0];
  const activeTooltipMeta =
    tooltipVariants.find((variant) => variant.key === activeTooltipVariant) ??
    tooltipVariants[0];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(51,245,255,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.13),transparent_34%),linear-gradient(180deg,#030712_0%,#050914_48%,#02040a_100%)] px-5 py-5 text-white lg:px-8">
      <section className="mx-auto flex max-w-[1720px] flex-col gap-4">
        <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/72">
              Portal Chart Lab
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-white">
              Limit Level Line Preview
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/54">
              Ghost Stack selected, with drag-only label handles, cancel-only x cells, and hover chips for each target.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[620px]">
            <div className="grid grid-cols-3 gap-2">
              {variants.map((variant) => (
                <button
                  className={`rounded-portal-control border px-3 py-2 text-left transition portal-clip-control ${
                    activeVariant === variant.key
                      ? "border-cyan-300/58 bg-cyan-300/[0.11] text-cyan-50 shadow-[0_0_24px_rgba(51,245,255,0.12)]"
                      : "border-white/[0.08] bg-white/[0.035] text-white/56 hover:border-white/[0.14] hover:text-white/82"
                  }`}
                  key={variant.key}
                  onClick={() => setActiveVariant(variant.key)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{variant.label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/42">
                    {variant.description}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {tooltipVariants.map((variant) => (
                <button
                  className={`rounded-portal-control border px-3 py-2 text-left transition portal-clip-control ${
                    activeTooltipVariant === variant.key
                      ? "border-purple-300/40 bg-purple-300/[0.10] text-purple-50 shadow-[0_0_22px_rgba(139,92,246,0.11)]"
                      : "border-white/[0.08] bg-white/[0.026] text-white/54 hover:border-white/[0.14] hover:text-white/82"
                  }`}
                  key={variant.key}
                  onClick={() => setActiveTooltipVariant(variant.key)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{variant.label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/42">
                    {variant.description}
                  </span>
                </button>
              ))}
            </div>

            <label className="grid grid-cols-[130px_minmax(0,1fr)_56px] items-center gap-3 rounded-portal-control border border-white/[0.08] bg-white/[0.035] px-3 py-2 portal-clip-control">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                Compression
              </span>
              <input
                aria-label="Compression"
                className="accent-cyan-300"
                max="1"
                min="0"
                onChange={(event) => setCompression(Number(event.target.value))}
                step="0.01"
                type="range"
                value={compression}
              />
              <span className="text-right font-value text-sm text-cyan-100">
                {Math.round(compression * 100)}%
              </span>
            </label>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <MockVariantFrame title={activeVariantMeta.label}>
            <PreviewChart
              compression={compression}
              tooltipVariant={activeTooltipVariant}
              variant={activeVariant}
            />
          </MockVariantFrame>

          <aside className="rounded-portal-panel border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,17,29,0.86),rgba(3,7,13,0.82))] p-4 shadow-[var(--portal-shadow-slab)] portal-clip-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
              Interaction Notes
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-white/68">
              <p>Every chip is a direct cancel target through the connected x cell.</p>
              <p>Only the limit-price label is treated as the drag handle. The dashed line itself stays passive.</p>
              <p>Hover the label for the drag chip, or hover the x for the cancel chip.</p>
            </div>
            <div className="mt-5 rounded-portal-panel border border-cyan-100/[0.09] bg-black/20 p-3 portal-clip-panel">
              <p className="font-value text-[13px] uppercase tracking-[0.18em] text-cyan-100/70">
                Current Pick
              </p>
              <p className="mt-2 text-xl font-semibold text-white">{activeVariantMeta.label}</p>
              <p className="mt-1 text-sm text-white/48">{activeVariantMeta.description}</p>
            </div>
            <div className="mt-3 rounded-portal-panel border border-purple-100/[0.10] bg-black/20 p-3 portal-clip-panel">
              <p className="font-value text-[13px] uppercase tracking-[0.18em] text-purple-100/70">
                Hover Chip
              </p>
              <p className="mt-2 text-xl font-semibold text-white">{activeTooltipMeta.label}</p>
              <p className="mt-1 text-sm text-white/48">{activeTooltipMeta.description}</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function MockVariantFrame({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-portal-panel border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,17,29,0.72),rgba(3,7,13,0.78))] p-3 shadow-[var(--portal-shadow-slab)] portal-clip-panel">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/38">Preview Surface</p>
          <h2 className="mt-1 text-lg font-semibold text-white/90">{title}</h2>
        </div>
        <div className="rounded-portal-control border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1 font-value text-xs text-cyan-100 portal-clip-control">
          Mock only
        </div>
      </div>
      {children}
    </section>
  );
}
