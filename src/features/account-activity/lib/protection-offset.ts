import type { TradeDirection } from "@/types/trade";

export type ProtectionOffsetKind = "stop" | "target";
export type ProtectionOffsetUnit = "percent" | "usdc";

type ProtectionOffsetInput = {
  direction: TradeDirection;
  entryPrice: number;
  kind: ProtectionOffsetKind;
  offset: number;
  positionSize: number;
  unit: ProtectionOffsetUnit;
};

type ProtectionOffsetFromPriceInput = Omit<ProtectionOffsetInput, "offset"> & {
  price: number;
};

function isFinitePositiveNumber(value: number) {
  return Number.isFinite(value) && value > 0;
}

function getProtectionPriceDirection(
  direction: TradeDirection,
  kind: ProtectionOffsetKind,
) {
  const favorableDirection = direction === "long" ? 1 : -1;

  return kind === "target" ? favorableDirection : favorableDirection * -1;
}

function roundProtectionNumber(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000_000) / 1_000_000_000;
}

function trimFixedNumber(value: number, fractionDigits: number) {
  return value
    .toFixed(fractionDigits)
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "");
}

export function parseProtectionNumber(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/u);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[0]);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function resolveProtectionPriceFromOffset({
  direction,
  entryPrice,
  kind,
  offset,
  positionSize,
  unit,
}: ProtectionOffsetInput) {
  if (
    !isFinitePositiveNumber(entryPrice) ||
    !isFinitePositiveNumber(offset) ||
    (unit === "usdc" && !isFinitePositiveNumber(positionSize))
  ) {
    return null;
  }

  const priceDelta =
    unit === "percent" ? entryPrice * (offset / 100) : offset / positionSize;
  const nextPrice =
    entryPrice + getProtectionPriceDirection(direction, kind) * priceDelta;

  return isFinitePositiveNumber(nextPrice)
    ? roundProtectionNumber(nextPrice)
    : null;
}

export function resolveProtectionOffsetFromPrice({
  direction,
  entryPrice,
  kind,
  positionSize,
  price,
  unit,
}: ProtectionOffsetFromPriceInput) {
  if (
    !isFinitePositiveNumber(entryPrice) ||
    !isFinitePositiveNumber(price) ||
    (unit === "usdc" && !isFinitePositiveNumber(positionSize))
  ) {
    return null;
  }

  const signedPriceDelta =
    (price - entryPrice) * getProtectionPriceDirection(direction, kind);
  const offset =
    unit === "percent"
      ? (signedPriceDelta / entryPrice) * 100
      : signedPriceDelta * positionSize;

  return Number.isFinite(offset) ? roundProtectionNumber(offset) : null;
}

export function formatProtectionPriceInput(price: number) {
  if (!isFinitePositiveNumber(price)) {
    return "";
  }

  if (price >= 100) {
    return trimFixedNumber(price, 2);
  }

  if (price >= 1) {
    return trimFixedNumber(price, 4);
  }

  return trimFixedNumber(price, 6);
}

export function formatProtectionOffsetInput(
  offset: number | null,
  unit: ProtectionOffsetUnit,
) {
  if (offset === null || !Number.isFinite(offset)) {
    return "";
  }

  return trimFixedNumber(offset, unit === "percent" ? 2 : 2);
}
