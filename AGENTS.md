# Portal Agent Instructions

Before making any UI, UX, layout, or styling changes in this repo, read:

- [Portal Brand Bible](docs/brand/PORTAL_BRAND_BIBLE.md)
- [Portal Prompt Pack](docs/brand/PORTAL_PROMPT_PACK.md)

Portal is a premium crypto trading terminal. Preserve that product identity in every interface decision.

## VISUAL REFERENCE (CRITICAL)

- Before making any UI or styling changes, review:
  `/docs/brand/visual/Portal_Visual_Brand_Bible.pdf`
- This file is the PRIMARY visual source of truth.
- Follow the visual system shown in the PDF, including:
  - glass surface layering
  - gradients and glow system
  - component styling
  - command deck layout (footer)
- If written rules and visuals differ:
  -> prioritize the visual reference

## Brand And Product Rules

- The chart is sacred.
- Use dark glass surfaces.
- Cyan/blue = active and primary states.
- Purple/magenta = AI and system intelligence.
- Amber/red = warning, danger, discipline, risk.
- Glow only when earned.
- Avoid cluttered exchange UI.
- Avoid too many cards, pills, borders, and nested containers.
- Use progressive disclosure.
- Advanced data should be reachable, not jammed into the default screen.
- Footer must be a mode-based command deck.
- Trade controls must not appear in Discipline, Journal, AI Coach, Logs, or Settings mode.

## Locked Edge Radius

- Portal's locked rectangular edge radius is `7px`.
- Use the shared Portal radius token/classes for rectangular UI: buttons, inputs, panels, cards, popovers, overlays, modals, window shells, and clipped glass surfaces.
- Keep true circular geometry circular: avatars, dots, toggles, loading rings, and similar marks may remain `rounded-full`.
- Do not introduce new arbitrary rectangular corner radii unless the user explicitly changes the locked radius.

Do not redesign the UI unless explicitly asked.
