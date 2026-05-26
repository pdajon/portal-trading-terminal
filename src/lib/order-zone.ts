import type { ChartZone } from "@/features/chart/types";
import type { OrderZoneDistribution } from "@/types/trade";

type ZoneBounds = Pick<ChartZone, "topPrice" | "bottomPrice">;

export function getZoneBounds(zone: ZoneBounds) {
  return {
    bottomPrice: Math.min(zone.topPrice, zone.bottomPrice),
    topPrice: Math.max(zone.topPrice, zone.bottomPrice),
  };
}

function getDistributionFraction(
  index: number,
  count: number,
  distribution: OrderZoneDistribution,
) {
  if (count <= 1) {
    return 0.5;
  }

  const linearPosition = index / (count - 1);

  if (distribution === "top-heavy") {
    return linearPosition ** 2;
  }

  if (distribution === "bottom-heavy") {
    return 1 - (1 - linearPosition) ** 2;
  }

  return linearPosition;
}

export function getOrderZonePrices(
  zone: ZoneBounds,
  count: number,
  distribution: OrderZoneDistribution,
) {
  const normalizedCount = Math.max(2, Math.min(10, Math.floor(count)));
  const { topPrice, bottomPrice } = getZoneBounds(zone);
  const priceRange = topPrice - bottomPrice;

  if (priceRange <= 0) {
    return [topPrice];
  }

  return Array.from({ length: normalizedCount }, (_, index) => {
    const fraction = getDistributionFraction(index, normalizedCount, distribution);
    return topPrice - priceRange * fraction;
  });
}
