import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AvatarArmoryShellLayer } from "./avatar-armory-shell-layer";
import { AVATAR_ARMORY_LAYER_CONFIG } from "../lib/avatar-armor-layers";

test("AvatarArmoryShellLayer renders active and inactive asset overlays", () => {
  const markup = renderToStaticMarkup(
    createElement(AvatarArmoryShellLayer, {
      pieces: AVATAR_ARMORY_LAYER_CONFIG.map((layer) => ({
        ...layer,
        active: layer.id === "core-chest" || layer.id === "cloak-shell",
      })),
    }),
  );

  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /data-shell-id="core-chest"/);
  assert.match(markup, /data-shell-id="arm-shells"/);
  assert.match(markup, /data-shell-id="cloak-shell"/);
  assert.match(markup, /src="\/portal\/avatar\/armor\/armor-core-chest\.svg"/);
  assert.match(markup, /src="\/portal\/avatar\/armor\/armor-arm-shells\.svg"/);
  assert.match(markup, /src="\/portal\/avatar\/armor\/armor-cloak-shell\.svg"/);
  assert.match(markup, /data-active="true"/);
  assert.match(markup, /data-active="false"/);
  assert.doesNotMatch(markup, /<path\b/);
});
