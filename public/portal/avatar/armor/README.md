# Portal Avatar Armor Layers

This folder contains individual SVG overlay assets for the Portal Avatar Armory subsystem.

## Asset Contract

- Every armor layer must use the exact same canvas as `public/portal/avatar/portal-being.svg`.
- Required SVG canvas: `viewBox="62 108 388 370"`.
- Background must be transparent.
- Design each file to align directly over `portal-being.svg` with no runtime resizing tricks.
- Keep one armor piece per file.
- Do not reference random external assets.
- Do not include bitmap/raster imagery unless explicitly approved later.

## Current Files

- `armor-core-chest.svg` maps to Max Daily Loss.
- `armor-arm-shells.svg` maps to Max Trades Per Day.
- `armor-cloak-shell.svg` maps to Cooldown After Loss.
- `armor-shoulder-shells.svg` maps to Minimum Protected R:R.
- `armor-face-shell.svg` maps to Require Protection.
- `armor-visor-shell.svg` maps to Market Entry Confirmation.

These are placeholder alignment assets only. They exist to prove the overlay system and can be replaced with final artwork later as long as the asset contract stays intact.
