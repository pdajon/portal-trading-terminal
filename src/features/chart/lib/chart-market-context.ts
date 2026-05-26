import type { ChartIndicatorPoint } from "@/features/chart/lib/chart-indicators";

export type ChartOpenInterestPoint = {
  time: number;
  valueBase: number | null;
  valueUsd: number | null;
};

export type ChartMarketContext = {
  coin: string;
  fetchedAt: number;
  fundingRates: ChartIndicatorPoint[];
  fundingWindowHours: number;
  openInterest: ChartOpenInterestPoint | null;
  source: "hyperliquid-testnet-market-context";
  symbol: string;
};

export type ChartMarketContextStatus = "idle" | "loading" | "ready" | "error";

export type ChartMarketContextReadout = {
  detail: string;
  key: "funding" | "openInterest";
  label: string;
  tone: "muted" | "negative" | "neutral" | "positive" | "warning";
  value: string;
};

type FundingHistoryRecord = {
  coin?: unknown;
  fundingRate?: unknown;
  time?: unknown;
};

type OpenInterestSnapshot = {
  markPrice?: unknown;
  openInterestBase?: unknown;
  openInterestUsd?: unknown;
  time?: unknown;
};

function parseFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeTimeToSeconds(value: unknown) {
  const parsedTime = parseFiniteNumber(value);

  if (parsedTime === null || parsedTime <= 0) {
    return null;
  }

  return Math.floor(parsedTime > 1_000_000_000_000 ? parsedTime / 1000 : parsedTime);
}

export function normalizeFundingRateHistory(
  payload: unknown,
  coin?: string | null,
): ChartIndicatorPoint[] {
  const targetCoin = coin?.trim().toUpperCase() ?? null;
  const records = Array.isArray(payload) ? payload : [];

  return records
    .flatMap((record): ChartIndicatorPoint[] => {
      const candidate = record as FundingHistoryRecord;
      const recordCoin =
        typeof candidate.coin === "string"
          ? candidate.coin.trim().toUpperCase()
          : null;

      if (targetCoin && recordCoin && recordCoin !== targetCoin) {
        return [];
      }

      const time = normalizeTimeToSeconds(candidate.time);
      const fundingRate = parseFiniteNumber(candidate.fundingRate);

      if (time === null || fundingRate === null) {
        return [];
      }

      return [{ time, value: fundingRate * 100 }];
    })
    .sort((left, right) => left.time - right.time);
}

export function normalizeOpenInterestSnapshot(
  snapshot: OpenInterestSnapshot,
): ChartOpenInterestPoint | null {
  const time = normalizeTimeToSeconds(snapshot.time);
  const valueBase = parseFiniteNumber(snapshot.openInterestBase);
  const markPrice = parseFiniteNumber(snapshot.markPrice);
  const providedUsd = parseFiniteNumber(snapshot.openInterestUsd);
  const valueUsd =
    providedUsd ?? (valueBase !== null && markPrice !== null ? valueBase * markPrice : null);

  if (time === null || (valueBase === null && valueUsd === null)) {
    return null;
  }

  return {
    time,
    valueBase,
    valueUsd,
  };
}

export function upsertOpenInterestPoint(
  points: ChartOpenInterestPoint[],
  point: ChartOpenInterestPoint,
  limit = 180,
) {
  const nextPoints = points.filter((currentPoint) => currentPoint.time !== point.time);
  nextPoints.push(point);
  nextPoints.sort((left, right) => left.time - right.time);

  return nextPoints.slice(Math.max(0, nextPoints.length - limit));
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";

  return `${sign}${Math.abs(value).toFixed(4)}%`;
}

function formatCompactUsd(value: number) {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absoluteValue >= 1_000_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000_000).toFixed(2)}B`;
  }

  if (absoluteValue >= 1_000_000) {
    return `${sign}$${(absoluteValue / 1_000_000).toFixed(2)}M`;
  }

  if (absoluteValue >= 1_000) {
    return `${sign}$${(absoluteValue / 1_000).toFixed(1)}K`;
  }

  return `${sign}$${absoluteValue.toFixed(2)}`;
}

function formatCompactBase(value: number) {
  if (Math.abs(value) >= 1_000) {
    return value.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function getFundingWindowLabel(context: ChartMarketContext | null) {
  const hours = context?.fundingWindowHours;

  if (!hours || !Number.isFinite(hours)) {
    return "Funding rate";
  }

  if (hours % 24 === 0) {
    return `${hours / 24}D funding`;
  }

  return `${hours}H funding`;
}

function buildUnavailableReadout(
  key: ChartMarketContextReadout["key"],
  label: string,
  status: ChartMarketContextStatus,
): ChartMarketContextReadout | null {
  if (status === "loading") {
    return {
      detail: "Context route",
      key,
      label,
      tone: "muted",
      value: "Loading",
    };
  }

  if (status === "error") {
    return {
      detail: "Retry from Layers",
      key,
      label,
      tone: "warning",
      value: "Offline",
    };
  }

  return null;
}

export function buildMarketContextReadouts({
  coin,
  context,
  fundingEnabled,
  openInterestEnabled,
  openInterestPoints,
  status,
}: {
  coin: string | null | undefined;
  context: ChartMarketContext | null;
  fundingEnabled: boolean;
  openInterestEnabled: boolean;
  openInterestPoints: ChartOpenInterestPoint[];
  status: ChartMarketContextStatus;
}): ChartMarketContextReadout[] {
  const readouts: ChartMarketContextReadout[] = [];
  const displayCoin = coin?.trim() || context?.coin || "Asset";

  if (fundingEnabled) {
    const unavailable = buildUnavailableReadout("funding", "Funding", status);

    if (unavailable && !context) {
      readouts.push(unavailable);
    } else {
      const latestFunding = context?.fundingRates.at(-1);

      readouts.push({
        detail: getFundingWindowLabel(context),
        key: "funding",
        label: "Funding",
        tone:
          latestFunding === undefined
            ? "muted"
            : latestFunding.value > 0
              ? "positive"
              : latestFunding.value < 0
                ? "negative"
                : "neutral",
        value:
          latestFunding === undefined
            ? "No data"
            : formatSignedPercent(latestFunding.value),
      });
    }
  }

  if (openInterestEnabled) {
    const unavailable = buildUnavailableReadout("openInterest", "Open Int", status);

    if (unavailable && !context && openInterestPoints.length === 0) {
      readouts.push(unavailable);
    } else {
      const latestOpenInterest =
        openInterestPoints.at(-1) ?? context?.openInterest ?? null;
      const value = latestOpenInterest?.valueUsd ?? latestOpenInterest?.valueBase;

      readouts.push({
        detail:
          latestOpenInterest?.valueBase !== null &&
          latestOpenInterest?.valueBase !== undefined
            ? `${formatCompactBase(latestOpenInterest.valueBase)} ${displayCoin} OI`
            : "Live session",
        key: "openInterest",
        label: "Open Int",
        tone: value === null || value === undefined ? "muted" : "neutral",
        value:
          value === null || value === undefined
            ? "No data"
            : latestOpenInterest?.valueUsd !== null &&
                latestOpenInterest?.valueUsd !== undefined
              ? formatCompactUsd(latestOpenInterest.valueUsd)
              : formatCompactBase(value),
      });
    }
  }

  return readouts;
}

export async function fetchChartMarketContext(symbol: string) {
  const response = await fetch(
    `/api/market-context?symbol=${encodeURIComponent(symbol)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Unable to load market context for ${symbol}`);
  }

  return (await response.json()) as ChartMarketContext;
}
