"use client";

import { type CSSProperties, useEffect, useState } from "react";

export type ToastIcon = "alert" | "check" | "clock" | "info" | "x";
export type ToastMode = "card" | "chartInstruction";
export type ToastReceipt = {
  price?: string;
  summary: string;
};
export type ToastVariant = "danger" | "info" | "neutral" | "success" | "warning";

type ToastProps = {
  detail?: string;
  icon?: ToastIcon;
  message?: string;
  receipt?: ToastReceipt;
  title?: string;
  variant?: ToastVariant;
  visible: boolean;
};

type PortalToastCardProps = {
  busy?: boolean;
  detail?: string;
  eyebrow?: string;
  icon?: ToastIcon;
  message?: string;
  mode?: ToastMode;
  receipt?: ToastReceipt;
  title?: string;
  variant?: ToastVariant;
};

function getToastTone(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return {
        accent: "text-[#00D18F]",
        card:
          "bg-[linear-gradient(135deg,rgba(0,217,144,0.20),rgba(5,10,17,0.74)_40%,rgba(3,6,11,0.58))] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_18px_42px_rgba(0,0,0,0.35)]",
        detail: "text-white/84",
        edge: "via-[#00D18F]/62",
        eyebrow: "text-[#00D18F]",
        strokeEnd: "rgba(0, 217, 144, 0.18)",
        strokeMid: "rgba(0, 217, 144, 0.46)",
        strokeStart: "rgba(0, 217, 144, 0.92)",
        title: "text-white/92",
      };
    case "warning":
      return {
        accent: "text-[#FFB000]",
        card:
          "bg-[linear-gradient(180deg,rgba(28,18,10,0.90),rgba(8,8,10,0.96))] shadow-[inset_0_0_24px_rgba(245,158,11,0.085)]",
        detail: "text-white/78",
        edge: "via-[#C77A22]/76",
        eyebrow: "text-[#FFB000]",
        strokeEnd: "rgba(255, 176, 0, 0.14)",
        strokeMid: "rgba(255, 176, 0, 0.38)",
        strokeStart: "rgba(255, 176, 0, 0.76)",
        title: "text-white/90",
      };
    case "danger":
      return {
        accent: "text-[#FF174D]",
        card:
          "bg-[linear-gradient(180deg,rgba(34,7,18,0.91),rgba(8,7,12,0.96))] shadow-[inset_0_0_24px_rgba(255,23,77,0.10)]",
        detail: "text-white/80",
        edge: "via-[#FF174D]/78",
        eyebrow: "text-[#FF4A6D]",
        strokeEnd: "rgba(255, 23, 77, 0.16)",
        strokeMid: "rgba(255, 23, 77, 0.40)",
        strokeStart: "rgba(255, 23, 77, 0.80)",
        title: "text-white/92",
      };
    case "info":
      return {
        accent: "text-[#0CBFFF]",
        card:
          "bg-[linear-gradient(135deg,rgba(12,191,255,0.20),rgba(5,10,17,0.74)_40%,rgba(3,6,11,0.58))] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_18px_42px_rgba(0,0,0,0.35)]",
        detail: "text-white/82",
        edge: "via-[#0CBFFF]/60",
        eyebrow: "text-[#0CBFFF]",
        strokeEnd: "rgba(12, 191, 255, 0.18)",
        strokeMid: "rgba(12, 191, 255, 0.44)",
        strokeStart: "rgba(12, 191, 255, 0.86)",
        title: "text-white/92",
      };
    case "neutral":
    default:
      return {
        accent: "text-white/72",
        card:
          "bg-[linear-gradient(180deg,rgba(15,17,22,0.92),rgba(5,7,11,0.96))] shadow-[inset_0_0_20px_rgba(255,255,255,0.035)]",
        detail: "text-white/72",
        edge: "via-white/30",
        eyebrow: "text-white/50",
        strokeEnd: "rgba(255, 255, 255, 0.08)",
        strokeMid: "rgba(255, 255, 255, 0.16)",
        strokeStart: "rgba(255, 255, 255, 0.30)",
        title: "text-white/88",
      };
  }
}

function getToastEyebrow(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return "Success";
    case "warning":
      return "Warning";
    case "danger":
      return "Error";
    case "info":
      return "Info";
    case "neutral":
    default:
      return "Notice";
  }
}

function getDefaultToastIcon(variant: ToastVariant): ToastIcon {
  if (variant === "success") {
    return "check";
  }

  if (variant === "danger") {
    return "x";
  }

  if (variant === "warning") {
    return "alert";
  }

  return "info";
}

function ToastIconMark({
  busy,
  icon,
  size = "md",
}: {
  busy?: boolean;
  icon: ToastIcon;
  size?: "md" | "sm";
}) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const spinnerSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  if (busy || icon === "clock") {
    return (
      <svg
        className={`${spinnerSize} animate-spin`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="8.5"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="2.4"
        />
        <path
          d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.8"
        />
      </svg>
    );
  }

  if (icon === "check") {
    return (
      <svg className={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          className="portal-toast-check-path"
          d="m5.5 12.4 4 4 9-9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
      </svg>
    );
  }

  if (icon === "alert") {
    return (
      <svg className={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4.4 21 19H3L12 4.4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
        <path
          d="M12 9.2v4.6M12 16.8h.01"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      </svg>
    );
  }

  if (icon === "x") {
    return (
      <svg className={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m7 7 10 10M17 7 7 17"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.3"
        />
      </svg>
    );
  }

  return (
    <svg className={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 10.8v5M12 7.6h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export function PortalToastCard({
  busy,
  detail,
  eyebrow,
  icon,
  message,
  mode = "card",
  receipt,
  title,
  variant = "danger",
}: PortalToastCardProps) {
  const resolvedTitle = title ?? message ?? "";
  const resolvedDetail = detail ?? (title ? message : undefined);
  const resolvedIcon = icon ?? getDefaultToastIcon(variant);
  const resolvedEyebrow = eyebrow ?? getToastEyebrow(variant);
  const tone = getToastTone(variant);
  const strokeStyle = {
    "--portal-toast-stroke-end": tone.strokeEnd,
    "--portal-toast-stroke-mid": tone.strokeMid,
    "--portal-toast-stroke-start": tone.strokeStart,
  } as CSSProperties;

  if (mode === "chartInstruction") {
    return (
      <div className="relative isolate inline-flex min-h-[40px] max-w-[calc(100vw-2rem)] items-center justify-center overflow-hidden rounded-full border border-cyan-100/[0.14] bg-[linear-gradient(180deg,rgba(5,16,24,0.96),rgba(4,10,16,0.98))] px-6 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]">
        <span className="min-w-0 truncate text-[18px] font-semibold leading-none tracking-normal text-white/86">
          {resolvedDetail || resolvedTitle}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`portal-toast-card relative isolate flex min-h-[98px] w-[232px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-portal-panel px-3.5 pb-3.5 pt-3 text-left backdrop-blur-[8px] portal-clip-panel ${tone.card}`}
      style={strokeStyle}
    >
      <div
        className={`pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent ${tone.edge} to-transparent`}
      />
      <span className="relative flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className={`mt-0.5 shrink-0 ${tone.accent}`}>
          <ToastIconMark busy={busy} icon={resolvedIcon} size="md" />
        </span>
        <span className="min-w-0">
          <span
            className={`block text-[16px] font-medium leading-tight tracking-normal ${tone.title}`}
          >
            {resolvedTitle}
          </span>
          <span
            className={`mt-1 block text-[9px] font-semibold uppercase leading-none tracking-[0.08em] ${tone.eyebrow}`}
          >
            {resolvedEyebrow}
          </span>
        </span>
      </span>
      <span className="relative mt-auto block min-w-0 pt-3.5">
        {receipt ? (
          <span className="flex min-w-0 items-baseline justify-between gap-3">
            <span
              className={`min-w-0 truncate text-[17px] font-medium leading-tight ${tone.detail}`}
            >
              {receipt.summary}
            </span>
            {receipt.price ? (
              <span className="shrink-0 font-mono text-[11px] font-semibold leading-none text-white/66">
                {receipt.price}
              </span>
            ) : null}
          </span>
        ) : resolvedDetail ? (
          <span className={`block text-[18px] font-medium leading-tight ${tone.detail}`}>
            {resolvedDetail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function Toast({
  detail,
  icon,
  message,
  receipt,
  title,
  variant = "danger",
  visible,
}: ToastProps) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      setIsExiting(false);
      return;
    }

    if (!shouldRender) {
      return;
    }

    setIsExiting(true);
    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
      setIsExiting(false);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldRender, visible]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`portal-toast-motion relative max-h-36 overflow-visible ${
        isExiting ? "portal-toast-motion-exit" : "portal-toast-motion-enter"
      }`}
      role="status"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-[-9px] left-1/2 h-4 w-[178px] -translate-x-1/2 rounded-full blur-[1px] ${
          variant === "success"
            ? "bg-[radial-gradient(ellipse_at_center,rgba(0,224,145,0.34),rgba(0,224,145,0.10)_42%,transparent_72%)]"
            : "bg-[radial-gradient(ellipse_at_center,rgba(17,210,255,0.34),rgba(17,210,255,0.10)_42%,transparent_72%)]"
        }`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-portal-panel bg-[linear-gradient(180deg,rgba(4,9,15,0.96),rgba(2,5,10,0.96))]"
      />
      <PortalToastCard
        detail={detail}
        icon={icon}
        message={message}
        receipt={receipt}
        title={title}
        variant={variant}
      />
    </div>
  );
}
