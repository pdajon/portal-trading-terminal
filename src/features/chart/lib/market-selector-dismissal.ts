export function shouldDismissMarketSelector(
  selectorRoot: Pick<HTMLElement, "contains"> | null,
  eventTarget: Node | null,
) {
  if (!selectorRoot || !eventTarget) {
    return false;
  }

  return !selectorRoot.contains(eventTarget);
}
