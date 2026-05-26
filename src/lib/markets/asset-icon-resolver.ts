export type AssetIconResolution =
  | {
      alt: string;
      fallbackClassName: string;
      kind: "image";
      label: string;
      src: string;
      wrapperClassName: string;
    }
  | {
      alt: string;
      fallbackClassName: string;
      kind: "fallback";
      label: string;
      src: null;
      wrapperClassName: string;
    };

export const REVIEWED_LOCAL_ASSET_ICONS = [
  {
    alt: "BTC",
    baseAsset: "BTC",
    src: "/asset-icons/btc.svg",
  },
  {
    alt: "ETH",
    baseAsset: "ETH",
    src: "/asset-icons/eth2.svg",
  },
  {
    alt: "SOL",
    baseAsset: "SOL",
    src: "/asset-icons/sol.svg",
  },
] as const;

const MAJOR_ASSET_ICONS: Record<string, AssetIconResolution> = {
  BTC: {
    alt: "BTC",
    fallbackClassName: "bg-[#F7931A]/18 text-[#FFCF8A]",
    kind: "image",
    label: "₿",
    src: "/asset-icons/btc.svg",
    wrapperClassName: "bg-[#F7931A]/10 ring-[#F7931A]/22",
  },
  ETH: {
    alt: "ETH",
    fallbackClassName: "bg-violet-300/[0.16] text-violet-100",
    kind: "image",
    label: "Ξ",
    src: "/asset-icons/eth2.svg",
    wrapperClassName: "bg-violet-300/[0.09] ring-violet-200/[0.20]",
  },
  SOL: {
    alt: "SOL",
    fallbackClassName: "bg-[linear-gradient(135deg,rgba(20,241,149,0.18),rgba(153,69,255,0.16))] text-cyan-50",
    kind: "image",
    label: "S",
    src: "/asset-icons/sol.svg",
    wrapperClassName: "bg-cyan-300/[0.08] ring-cyan-200/[0.20]",
  },
};

export function getAssetIconBaseAsset(input: string) {
  const normalizedInput = input
    .trim()
    .toUpperCase()
    .replace("/", "-")
    .replace(/-USDC$/i, "-USD");

  return normalizedInput
    .replace(/-USD$/i, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function resolveAssetIcon(input: string): AssetIconResolution {
  const baseAsset = getAssetIconBaseAsset(input);
  const knownIcon = MAJOR_ASSET_ICONS[baseAsset];

  if (knownIcon) {
    return knownIcon;
  }

  const label = /^[0-9]/.test(baseAsset)
    ? baseAsset.slice(0, 2)
    : baseAsset.slice(0, 1) || "?";

  return {
    alt: baseAsset || "Unknown asset",
    fallbackClassName:
      "bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(124,58,237,0.12))] text-cyan-100",
    kind: "fallback",
    label,
    src: null,
    wrapperClassName: "bg-cyan-300/[0.08] ring-cyan-200/[0.18]",
  };
}
