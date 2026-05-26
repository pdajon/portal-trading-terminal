export type RailDetailSectionId =
  | "liquidation"
  | "entry-mark"
  | "value-margin"
  | "protection"
  | "funding"
  | "plan";

export type RailDetailSectionLayout = {
  hasOverflow: boolean;
  inlineSectionIds: RailDetailSectionId[];
  overflowSectionIds: RailDetailSectionId[];
};

type SelectRailDetailSectionsInput = {
  availableHeight: number;
  coreHeight: number;
  orderedSectionIds: RailDetailSectionId[];
  safetyPadding?: number;
  sectionHeights: Partial<Record<RailDetailSectionId, number>>;
};

export function selectRailDetailSections({
  availableHeight,
  coreHeight,
  orderedSectionIds,
  safetyPadding = 0,
  sectionHeights,
}: SelectRailDetailSectionsInput): RailDetailSectionLayout {
  const inlineSectionIds: RailDetailSectionId[] = [];
  let usedHeight = Math.max(0, coreHeight) + Math.max(0, safetyPadding);

  for (let index = 0; index < orderedSectionIds.length; index += 1) {
    const sectionId = orderedSectionIds[index];
    const sectionHeight = Math.max(0, sectionHeights[sectionId] ?? 0);

    if (usedHeight + sectionHeight > availableHeight) {
      const overflowSectionIds = orderedSectionIds.slice(index);
      return {
        hasOverflow: overflowSectionIds.length > 0,
        inlineSectionIds,
        overflowSectionIds,
      };
    }

    inlineSectionIds.push(sectionId);
    usedHeight += sectionHeight;
  }

  return {
    hasOverflow: false,
    inlineSectionIds,
    overflowSectionIds: [],
  };
}
