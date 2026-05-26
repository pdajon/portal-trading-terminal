import { resolveAssetIcon } from "@/lib/markets/asset-icon-resolver";

type AssetIconMarkProps = {
  asset: string;
  className?: string;
  imageClassName?: string;
};

export function AssetIconMark({
  asset,
  className = "h-7 w-7",
  imageClassName = "h-full w-full",
}: AssetIconMarkProps) {
  const icon = resolveAssetIcon(asset);

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ${icon.wrapperClassName} ${className}`}
      aria-hidden="true"
    >
      {icon.kind === "image" ? (
        <img className={imageClassName} src={icon.src} alt="" />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center rounded-full font-mono font-black leading-none ${icon.fallbackClassName}`}
        >
          {icon.label}
        </span>
      )}
    </span>
  );
}
