import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { AVATAR_ARMORY_LAYER_CONFIG } from "./avatar-armor-layers";

const expectedLayers = [
  ["max-daily-loss", "core-chest", "armor-core-chest.svg"],
  ["max-trades-per-day", "arm-shells", "armor-arm-shells.svg"],
  ["cooldown-after-loss", "cloak-shell", "armor-cloak-shell.svg"],
] as const;

test("avatar armor layer config maps discipline rules to separate overlay assets", () => {
  assert.deepEqual(
    AVATAR_ARMORY_LAYER_CONFIG.map((layer) => [
      layer.disciplineRuleId,
      layer.id,
      path.basename(layer.assetSrc),
    ]),
    expectedLayers,
  );
});

test("avatar armor assets share the base Avatar canvas contract", () => {
  for (const layer of AVATAR_ARMORY_LAYER_CONFIG) {
    const assetPath = path.join(process.cwd(), "public", layer.assetSrc);
    const svg = readFileSync(assetPath, "utf8");

    assert.match(svg, /<svg\b/);
    assert.match(svg, /viewBox="62 108 388 370"/);
    assert.doesNotMatch(svg, /<image\b/i);
    assert.doesNotMatch(svg, /\b(?:href|src)=["']https?:\/\//i);
  }
});
