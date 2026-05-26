import type { ChartTrendLine, ChartTrendLineSource } from "@/features/chart/types";

const VALID_CHART_TREND_LINE_SOURCES = new Set<ChartTrendLineSource>([
  "context-menu-fibonacci",
  "context-menu-measurement",
  "context-menu-two-point",
  "context-menu-vertical-ray",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeStoredChartTrendLines(value: unknown): ChartTrendLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((line): ChartTrendLine[] => {
    if (!line || typeof line !== "object" || Array.isArray(line)) {
      return [];
    }

    const candidate = line as Partial<ChartTrendLine>;

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.createdAt !== "string" ||
      typeof candidate.symbol !== "string" ||
      typeof candidate.source !== "string" ||
      !VALID_CHART_TREND_LINE_SOURCES.has(
        candidate.source as ChartTrendLineSource,
      ) ||
      !isFiniteNumber(candidate.startPrice) ||
      !isFiniteNumber(candidate.endPrice) ||
      !isFiniteNumber(candidate.startTime) ||
      !isFiniteNumber(candidate.endTime)
    ) {
      return [];
    }

    return [
      {
        createdAt: candidate.createdAt,
        ...(typeof candidate.customLabel === "string" &&
        candidate.customLabel.trim()
          ? { customLabel: candidate.customLabel.trim() }
          : {}),
        endPrice: candidate.endPrice,
        endTime: candidate.endTime,
        id: candidate.id,
        ...(candidate.isHidden === true ? { isHidden: true } : {}),
        ...(candidate.isLocked === true ? { isLocked: true } : {}),
        source: candidate.source as ChartTrendLineSource,
        startPrice: candidate.startPrice,
        startTime: candidate.startTime,
        symbol: candidate.symbol,
      },
    ];
  });
}
