# Claude Design — local mirror

Local copy of the **Juegospedia Design System** project hosted on claude.ai/design,
kept in-repo so it can be read without a network round-trip.

- **Project ID:** `f4bdd787-46c6-4e56-92b1-1b6a68a6fc6a`
- **Type:** `PROJECT_TYPE_PROJECT` — it does **not** appear in `DesignSync
  list_projects` (which only lists design-system-type, writable projects). Fetch it
  by UUID with `DesignSync get_file`.
- **Last pulled:** 2026-07-18

## Files
- `juegospedia-design-system.dc.html` — the design spec (the `.dc.html` source).
  7 sections: brand mark, tokens & primitives, "shadcn kit warmed up" (buttons,
  cards, badges…), the encyclopedia layer (ComplexityMeter, CommunityRatingSummary,
  CollectionActions…), collector profile, promo kit, 16 shelves.
  > ⚠️ **Truncated.** `DesignSync get_file` caps content at **256 KiB** and this
  > file is larger, so the mirror is exactly 262144 bytes and the HTML is cut off
  > mid-element at the end (the closing tags and likely the last shelf/footer are
  > missing). All 7 section headings and the token/component definitions are
  > present; only the tail is lost. There is no offset param to fetch the rest —
  > re-pull if the cap is raised or the source shrinks.
- `support.js` — the generic `dc-runtime` viewer bundle referenced by the `.dc.html`
  (not Juegospedia-specific; needed only to render the doc as a page).

## Re-pull / update
```
DesignSync get_file  projectId=f4bdd787-46c6-4e56-92b1-1b6a68a6fc6a  path="Juegospedia Design System.dc.html"
DesignSync get_file  projectId=f4bdd787-46c6-4e56-92b1-1b6a68a6fc6a  path="support.js"
DesignSync list_files projectId=f4bdd787-46c6-4e56-92b1-1b6a68a6fc6a   # see screenshots/, uploads/
```
The tool returns `{"content": "..."}` JSON — write the `content` field to the file.
`list_files` also shows `screenshots/` and `uploads/` (PNG mockups) not mirrored here.

## Related
- `PLAYBOOK.md` — how the system is implemented in the apps.
- Tokens already live in code: `libs/shared/ui-react/src/styles.css` +
  `palette.css` (the `--game-token-*` contract); the marketplace mirrors a subset
  in `apps/marketplace/src/styles.css`.
