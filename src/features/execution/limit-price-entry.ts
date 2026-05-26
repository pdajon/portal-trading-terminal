import { formatChartPriceInput } from "@/features/chart/types";

export type LimitPriceEntryMode = "chart" | "typed";

export const DEFAULT_LIMIT_PRICE_ENTRY_MODE: LimitPriceEntryMode = "typed";

export type LimitPriceEntryState = {
  mode: LimitPriceEntryMode;
  typedPriceInput: string;
};

export type LimitPriceEntryResolution =
  | { mode: "chart"; ok: true }
  | { mode: "typed"; ok: true; price: number }
  | { mode: "typed"; ok: false; reason: string };

export const INVALID_TYPED_LIMIT_PRICE_REASON =
  "Enter a valid limit price before placing the order.";

export function getLimitPriceEntryResetState(): LimitPriceEntryState {
  return {
    mode: DEFAULT_LIMIT_PRICE_ENTRY_MODE,
    typedPriceInput: "",
  };
}

export function parseLimitPriceInput(value: string) {
  const match = value.match(/-?\d[\d,]*(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[0].replaceAll(",", ""));

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function resolveLimitPriceEntry(
  state: LimitPriceEntryState,
): LimitPriceEntryResolution {
  if (state.mode === "chart") {
    return { mode: "chart", ok: true };
  }

  const price = parseLimitPriceInput(state.typedPriceInput);

  if (price === null || price <= 0) {
    return {
      mode: "typed",
      ok: false,
      reason: INVALID_TYPED_LIMIT_PRICE_REASON,
    };
  }

  return {
    mode: "typed",
    ok: true,
    price,
  };
}

export function formatLimitMidPriceInput(price: number | null | undefined) {
  if (price === null || price === undefined || !Number.isFinite(price) || price <= 0) {
    return "";
  }

  return formatChartPriceInput(price);
}
