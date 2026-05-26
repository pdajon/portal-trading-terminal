Portal Avatar Assets
====================

Current approved Avatar shell assets:

- `portal-being.svg`
- `portal-soul.svg`

The Trade footer image sources are intentionally fixed in
`src/components/layout/app-shell.tsx`:

- `/portal/avatar/portal-being.svg`
- `/portal/avatar/portal-soul.svg`

The app may append a small version query string to those base paths so local
browsers re-request placeholder updates during visual iteration.

Do not auto-discover Avatar assets. Do not import screenshots, Desktop files,
Downloads files, fantasy character art, human portraits, anime, superheroes, or
other unreviewed artwork into this folder. Future production assets should be
manually reviewed, added here intentionally, and wired through explicit source
constants.
