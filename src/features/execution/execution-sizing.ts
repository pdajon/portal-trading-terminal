import type { HyperliquidSymbol } from "@/types/market";
import {
  resolveHyperliquidMarket,
  type HyperliquidMarketResolution,
} from "@/lib/markets/hyperliquid-market-registry";

export type ExecutionSizingUnit = "base" | "notional_usdc";

export const AMBIGUOUS_EXECUTION_SIZE_ERROR =
  "Ambiguous execution size. Send baseSize or notionalUsdc with conversionPrice.";

export const EXECUTION_SIZING_METADATA_MISMATCH_ERROR =
  "Execution sizing metadata does not match the requested base size.";

// High enough for realistic testnet validation while preserving a clear client-side guardrail.
export const PORTAL_V1_MAX_TESTNET_NOTIONAL_USDC = 50_000;

export type ExecutionSizingInput = {
  baseSize?: unknown;
  conversionPrice?: unknown;
  intendedNotionalUsdc?: unknown;
  notionalUsdc?: unknown;
  size?: unknown;
  symbol: HyperliquidSymbol;
  market?: HyperliquidMarketResolution | null;
};

export type ExecutionSizingResult =
  | {
      baseSize: number;
      estimatedNotionalUsdc: number | null;
      ok: true;
      sizingUnit: ExecutionSizingUnit;
    }
  | {
      error: string;
      ok: false;
    };

function finitePositiveNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

export function normalizeBaseSize(
  size: number,
  symbol: HyperliquidSymbol,
  market?: HyperliquidMarketResolution | null,
) {
  if (!Number.isFinite(size) || size <= 0) {
    return 0;
  }

  const decimals = market?.quantityPrecision ?? resolveHyperliquidMarket(symbol)?.quantityPrecision ?? 5;
  const factor = 10 ** decimals;

  return Math.floor((size + Number.EPSILON) * factor) / factor;
}

export function getBaseAssetLabel(symbol: string) {
  return symbol.replace(/-USD$/i, "");
}

function validateSafetyLimit(input: {
  baseSize: number;
  estimatedNotionalUsdc: number | null;
  market?: HyperliquidMarketResolution | null;
  symbol: HyperliquidSymbol;
}): string | null {
  const market = input.market ?? resolveHyperliquidMarket(input.symbol);

  if (!market) {
    return `Unsupported Hyperliquid market: ${input.symbol}.`;
  }

  if (input.baseSize > market.maxTestnetBaseSize) {
    return `Execution size exceeds Portal V1 testnet safety limit for ${input.symbol}.`;
  }

  if (
    input.estimatedNotionalUsdc !== null &&
    input.estimatedNotionalUsdc > PORTAL_V1_MAX_TESTNET_NOTIONAL_USDC
  ) {
    return `Execution notional exceeds Portal V1 testnet safety limit of ${PORTAL_V1_MAX_TESTNET_NOTIONAL_USDC} USDC.`;
  }

  return null;
}

function validateSizingMetadata(input: {
  baseSize: number;
  conversionPrice: number | null;
  intendedNotionalUsdc: number | null;
}) {
  if (input.conversionPrice === null || input.intendedNotionalUsdc === null) {
    return null;
  }

  const impliedNotional = input.baseSize * input.conversionPrice;
  const tolerance = Math.max(1, input.intendedNotionalUsdc * 0.02);

  return Math.abs(impliedNotional - input.intendedNotionalUsdc) <= tolerance
    ? null
    : EXECUTION_SIZING_METADATA_MISMATCH_ERROR;
}

export function resolveExecutionSizing(input: ExecutionSizingInput): ExecutionSizingResult {
  if (input.size !== undefined) {
    return {
      error: AMBIGUOUS_EXECUTION_SIZE_ERROR,
      ok: false,
    };
  }

  const baseSize = finitePositiveNumber(input.baseSize);
  const notionalUsdc = finitePositiveNumber(input.notionalUsdc);
  const conversionPrice = finitePositiveNumber(input.conversionPrice);
  const intendedNotionalUsdc = finitePositiveNumber(input.intendedNotionalUsdc);

  if (baseSize !== null && notionalUsdc !== null) {
    return {
      error: "Execution sizing is ambiguous. Send either baseSize or notionalUsdc, not both.",
      ok: false,
    };
  }

  if (baseSize !== null) {
    const normalizedBaseSize = normalizeBaseSize(baseSize, input.symbol, input.market);

    if (normalizedBaseSize <= 0) {
      return { error: "Invalid execution base size.", ok: false };
    }

    const estimatedNotionalUsdc =
      conversionPrice === null ? intendedNotionalUsdc : normalizedBaseSize * conversionPrice;
    const metadataError = validateSizingMetadata({
      baseSize: normalizedBaseSize,
      conversionPrice,
      intendedNotionalUsdc,
    });

    if (metadataError) {
      return { error: metadataError, ok: false };
    }

    const safetyError = validateSafetyLimit({
      baseSize: normalizedBaseSize,
      estimatedNotionalUsdc,
      market: input.market,
      symbol: input.symbol,
    });

    if (safetyError) {
      return { error: safetyError, ok: false };
    }

    return {
      baseSize: normalizedBaseSize,
      estimatedNotionalUsdc,
      ok: true,
      sizingUnit: "base",
    };
  }

  if (notionalUsdc === null || conversionPrice === null) {
    return {
      error: AMBIGUOUS_EXECUTION_SIZE_ERROR,
      ok: false,
    };
  }

  const normalizedBaseSize = normalizeBaseSize(
    notionalUsdc / conversionPrice,
    input.symbol,
    input.market,
  );

  if (normalizedBaseSize <= 0) {
    return { error: "Execution notional is too small for the market size increment.", ok: false };
  }

  const estimatedNotionalUsdc = normalizedBaseSize * conversionPrice;
  const safetyError = validateSafetyLimit({
    baseSize: normalizedBaseSize,
    estimatedNotionalUsdc,
    market: input.market,
    symbol: input.symbol,
  });

  if (safetyError) {
    return { error: safetyError, ok: false };
  }

  return {
    baseSize: normalizedBaseSize,
    estimatedNotionalUsdc: notionalUsdc,
    ok: true,
    sizingUnit: "notional_usdc",
  };
}

export function getExecutionSizingMetadata(input: {
  allocationPercent?: number | null;
  baseSize: number;
  conversionPrice: number | null;
  intendedNotionalUsdc: number | null;
}) {
  return {
    allocationPercent:
      typeof input.allocationPercent === "number" && Number.isFinite(input.allocationPercent)
        ? input.allocationPercent
        : null,
    baseSize: input.baseSize,
    conversionPrice: input.conversionPrice,
    estimatedNotionalUsdc:
      input.conversionPrice !== null && Number.isFinite(input.conversionPrice)
        ? input.baseSize * input.conversionPrice
        : null,
    intendedNotionalUsdc: input.intendedNotionalUsdc,
    sizingUnit: "base" as const,
  };
}

export function parseCollateralAllocationPercentInput(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const match = normalizedValue.match(/-?\d[\d,]*(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[0].replaceAll(",", ""));

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(parsedValue)));
}
