export const CHART_RIGHT_PRICE_AXIS_INTERACTION_GUTTER_PX = 72;

export function isChartRightPriceAxisPoint({
  containerWidth,
  priceScaleWidth,
  x,
}: {
  containerWidth: number;
  priceScaleWidth: number;
  x: number;
}) {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(priceScaleWidth) ||
    !Number.isFinite(x) ||
    containerWidth <= 0 ||
    priceScaleWidth < 0
  ) {
    return false;
  }

  const interactionWidth = Math.max(
    priceScaleWidth,
    CHART_RIGHT_PRICE_AXIS_INTERACTION_GUTTER_PX,
  );

  return x >= Math.max(0, containerWidth - interactionWidth);
}
