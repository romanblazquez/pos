# design-sync notes — @retail-os/ui-react → Retail OS Design System

Project: `bf2fd754-566d-48fa-98d2-2b4a62e17bbe` (https://claude.ai/design/p/bf2fd754-566d-48fa-98d2-2b4a62e17bbe)

## How this repo builds (package shape, no dist)

- `@retail-os/ui-react` is a **source-only** Nx lib (no `package.json`, no build) consumed
  via `tsconfig.base.json` path mapping. There is no `.d.ts` tree, so component discovery
  is **driven entirely by `cfg.componentSrcMap` non-null pins** — all 20 primary components
  are pinned to their `.tsx` source. The sub-compound parts (CardHeader, DialogContent,
  TableRow, Select*/DropdownMenu*/Tabs* parts, etc.) are pinned `null` to keep them OUT of
  the card list while staying importable in the bundle. **If you add a component, pin it**
  (pinning is all-or-nothing — any pin disables the auto-derive fallback).
- Build command (run from repo root `/home/pi/pos`):
  ```
  node .ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs -i .design-sync/tw-input.css -o .design-sync/.cache/compiled.css
  node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules node_modules --entry ./libs/shared/ui-react/src/index.ts --out ./ds-bundle
  node .ds-sync/package-validate.mjs ./ds-bundle --no-render-check
  ```
- `--node-modules node_modules` = repo-root node_modules (react/radix/lucide all hoist there).
- Isolated converter deps (incl. `@tailwindcss/cli`) live in `.ds-sync/` (gitignored). On a
  fresh clone: `cd .ds-sync && COREPACK_ENABLE_STRICT=0 npm i esbuild ts-morph @types/react @tailwindcss/cli`.

## Tailwind v4 precompile (the critical step)

- This is a **Tailwind v4 CSS-first** DS. claude.ai/design ships static CSS and does NOT run
  Tailwind, so the utility classes MUST be precompiled. `cfg.cssEntry`/`tokensGlob` point at
  the **generated** `.design-sync/.cache/compiled.css` (gitignored — regenerate, never edit).
- Source: `.design-sync/tw-input.css` (committed) = `@import "tailwindcss" source(none)`
  + `@import "./theme.css"` (the theme tokens) + explicit `@source` globs (components +
  `previews/`) + a large `@source inline(...)` **responsive layout safelist** so the design
  agent can use flex/grid utilities that aren't otherwise in the components. **Edit the
  safelist there**, then recompile.
- `.design-sync/theme.css` (committed) is a hand-kept copy of the token block in
  `libs/shared/ui-react/src/styles.css` (minus the `@import "tailwindcss";` line).
  **If you change tokens in the lib's styles.css, mirror them into `.design-sync/theme.css`.**

## Decisions / accepted warnings (do not re-flag)

- **Render verification SKIPPED** by user choice (`--no-render-check`). Previews were NOT
  machine-rendered; `[RENDER_SKIPPED]` is expected, not a new warn. The 20 previews are
  authored from the real components and standard shadcn patterns. Eyeball them in the DS pane.
- **Fonts**: Inter ships via a remote Google Fonts `@import` (prepended in tw-input.css) →
  `[FONT_REMOTE]` is expected. SF Pro Display / system-ui are intentional fallbacks.
- **Overlays** (Dialog, DropdownMenu, Select, Tooltip) preview their OPEN state via Radix
  `defaultOpen` (+ `modal={false}` where used) so the portal renders into the card's own
  document body. `cfg.overrides` sets cardMode/viewport for these. Unverified without a
  browser — confirm in the DS pane; if an open overlay looks off, that's the place to fix.
- Internal engineering docs are excluded from `guidelines/` via `"guidelinesGlob": []`
  (the default glob swept repo `docs/*.md` — architecture/payments/roadmap — which are not
  design guidelines). Keep it `[]` unless real design-guideline markdown is added.
- All 20 land in 6 semantic groups via `cfg.docsDir = .design-sync/docs` stub `.md` files
  (category frontmatter + a one-line retail description that also enriches each prompt.md).

## Re-sync risks (watch-list)

- **`.design-sync/.cache/compiled.css` is gitignored** (generated). Always recompile it from
  `.design-sync/tw-input.css` before `package-build` (the build command above does this).
  Both inputs (`tw-input.css`, `theme.css`) ARE committed, so a fresh clone only needs the
  recompile step — no manual regeneration.
- Discovery depends on the `componentSrcMap` pins matching real source paths — a moved/renamed
  component file silently drops it (no .d.ts safety net). Verify pin paths after refactors.
- Token drift: `theme.css` is a manual copy of `src/styles.css` tokens. They can diverge.
- The `@source inline` safelist is a fixed snapshot; net-new utility classes the design agent
  invents that aren't in the safelist or used by components/previews won't be styled. Extend
  the safelist if designs come back with unstyled layout utilities.
