export type AvatarArmoryShellId =
  | "arm-shells"
  | "cloak-shell"
  | "core-chest"
  | "face-shell"
  | "shoulder-shells"
  | "visor-shell";

export type AvatarArmorDisciplineRuleId =
  | "cooldown-after-loss"
  | "max-daily-loss"
  | "max-trades-per-day";

export type AvatarArmorLayerConfig = {
  assetSrc: string;
  disciplineRuleId: AvatarArmorDisciplineRuleId;
  disciplineRuleLabel: string;
  id: AvatarArmoryShellId;
  label: string;
};

export type AvatarArmoryShellPiece = AvatarArmorLayerConfig & {
  active: boolean;
};

export const AVATAR_ARMORY_LAYER_CONFIG: readonly AvatarArmorLayerConfig[] = [
  {
    assetSrc: "/portal/avatar/armor/armor-core-chest.svg",
    disciplineRuleId: "max-daily-loss",
    disciplineRuleLabel: "Max Daily Loss",
    id: "core-chest",
    label: "Core Chest Shell",
  },
  {
    assetSrc: "/portal/avatar/armor/armor-arm-shells.svg",
    disciplineRuleId: "max-trades-per-day",
    disciplineRuleLabel: "Max Trades Per Day",
    id: "arm-shells",
    label: "Arm Shells",
  },
  {
    assetSrc: "/portal/avatar/armor/armor-cloak-shell.svg",
    disciplineRuleId: "cooldown-after-loss",
    disciplineRuleLabel: "Cooldown After Loss",
    id: "cloak-shell",
    label: "Cloak Shell",
  },
] as const;
