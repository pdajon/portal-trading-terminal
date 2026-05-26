import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEWED_LOCAL_ASSET_ICONS,
  resolveAssetIcon,
} from "./asset-icon-resolver";

test("REVIEWED_LOCAL_ASSET_ICONS documents the reviewed local icon set", () => {
  assert.deepEqual(REVIEWED_LOCAL_ASSET_ICONS, [
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
  ]);
});

test("resolveAssetIcon returns local major-asset icons for BTC ETH and SOL", () => {
  assert.deepEqual(resolveAssetIcon("BTC-USD"), {
    alt: "BTC",
    fallbackClassName: "bg-[#F7931A]/18 text-[#FFCF8A]",
    kind: "image",
    label: "₿",
    src: "/asset-icons/btc.svg",
    wrapperClassName: "bg-[#F7931A]/10 ring-[#F7931A]/22",
  });
  assert.equal(resolveAssetIcon("ETH").src, "/asset-icons/eth2.svg");
  assert.equal(resolveAssetIcon("SOL-USDC").src, "/asset-icons/sol.svg");
});

test("resolveAssetIcon returns a premium deterministic fallback for unknown markets", () => {
  assert.deepEqual(resolveAssetIcon("HYPE-USD"), {
    alt: "HYPE",
    fallbackClassName: "bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(124,58,237,0.12))] text-cyan-100",
    kind: "fallback",
    label: "H",
    src: null,
    wrapperClassName: "bg-cyan-300/[0.08] ring-cyan-200/[0.18]",
  });
});

test("resolveAssetIcon keeps digit-starting fallback labels intentional", () => {
  assert.equal(resolveAssetIcon("0G-USD").label, "0G");
  assert.equal(resolveAssetIcon("2Z-USDC").label, "2Z");
});
