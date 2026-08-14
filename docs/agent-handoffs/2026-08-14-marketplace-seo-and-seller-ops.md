# Agent handoff — marketplace SEO surface, seller operations, audit

Continuation notes for `/home/pi/pos` (Nx monorepo, Juegospedia). Written
2026-08-14. Branch `main`, everything deployed and pushed — check `git log`
for the head; this file is updated in place as items close.

Full narrative of what shipped is in `docs/handoff.md` under
**"2026-08-14 — Marketplace SEO surface + seller fulfillment"** (sections 1-12).
This file is the *forward-looking* half: what is open, what is blocked on a
human decision, and what was found and fixed late in the session (§3).

---

## 1. State of the world

| surface | container | port | state |
|---|---|---|---|
| SEO site (`apps/web`, Next SSR) | `retail-os-seo-web` | 8091 | healthy |
| API (`apps/api`, Nest) | `retail-os-api` | 3010 | healthy |
| SPAs (marketplace / seller / admin) | `retail-os-web` | 8081 | healthy |
| BGG enrichment worker | `retail-os-bgg-enricher` | 3003 | **unhealthy by design — see §4** |

- 124 API tests pass (`npx vitest run apps/api/src`).
- `api`, `web`, `seller-portal`, `admin-console` all typecheck.
- Catalogue: **155,379 indexable products**, ~22,900 still unenriched.

### Deploy commands (they are not symmetrical, this bites people)

```bash
# API
cd /home/pi/pi/docker-stacks/retail-api   && docker compose build api && docker compose up -d api
# SEO site
cd /home/pi/pi/docker-stacks/retail-seo-web && docker compose build seo-web \
  && docker compose up -d --force-recreate --no-deps seo-web
# All three SPAs (one image)
cd /home/pi/pi/docker-stacks/retail-web   && docker compose build web && docker compose up -d --no-deps web
# BGG enricher lives in the *scraper* stack and needs env passed in
cd /home/pi/pi/docker-stacks/retail-bgg-scraper && \
  DATABASE_URL="postgresql://retail:retail@retail-os-postgres:5432/retail_os?schema=public" \
  TYPESENSE_API_KEY="dev-typesense-key" docker compose up -d --no-deps bgg-enricher
```

**Always check the exit code**, not the tail of the log. `docker compose build … | tail`
masks a failure — that is how a broken sitemap build shipped once.

---

## 2. Blocked on a decision only the owner can make

### 2.1 The apex is `noindex` — none of this SEO work reaches Google yet

`reverse-proxy/traefik-min/dynamic.yml`, router `public-web`, carries the
`noindex` middleware. The file's own comment records that it was removed on
2026-07-26 and put back the same day, because go-live is the owner's call.

To go live: delete the `middlewares: [noindex]` line on **that router only**
(Traefik hot-reloads). Everything else — app, seller portal, admin, API,
`seo.` staging host — stays noindex deliberately.

Before flipping, the checklist in `docs/seo-release-checklist.md` also expects
`MARKETPLACE_SEO_ENABLED=true` and the marketplace `robots.txt` change. Note
the SEO site's own robots is separate and already correct.

**Do not flip this autonomously.** De-indexing afterwards is slow and partial
in a way that staying closed is not.

### 2.2 Email change needs an email provider

Not built, deliberately — see `docs/handoff.md` §11. The platform cannot send
email at all: no mail dependency, no SMTP/provider credentials, no mailer
service. `Seller.emailVerified` is only ever written by the Google OAuth path.

Needs either an email provider (account + credentials + SPF/DKIM DNS on
juegospedia.com), or a Google-only re-auth flow. **Do not ship a change-email
endpoint without a verify-the-new-address round trip** — it silently moves
account recovery to an address the owner may not control.

### 2.3 `apps/backoffice` — scope call before code

Still a README with no source. ADR-0006 specifies Angular, but
`apps/admin-console` (React, deployed) already covers sellers, catalog,
mapping, orders, BGG import, ranking, markets, AI usage, analytics and now
audit — 10 views with real URL routing and payout marking. A greenfield
Angular backoffice would duplicate a working surface, and installing Angular
into the shared pnpm workspace risks every other app's build on this box.

Decide one of: extend `admin-console`, build the Angular app as specced, or
start with the roadmap's scoped first module (Reporting → Daily Sales) to
validate the integration. **Revisit ADR-0006 before writing code.**

---

## 3. FIXED 2026-08-14 late — spurious session-family revocation

Recorded in full because the diagnosis is the valuable part: the signal looked
exactly like session theft and was not, and the same evidence will be needed
if `reuse_detected` starts firing again.

**Symptom:** 53 `auth.refresh.reuse_detected` audit events. Refresh-token
reuse detection is the classic stolen-session signal, so this looks alarming.

**It is not an attack.** Evidence:

- Every one of the 53 events belongs to a single principal —
  `cmqydyaib000np20uau75igmw` = `matiasblazquez@gmail.com`, the owner.
- They arrive in bursts with 1.8s / 3.0s / 18s gaps (8 events inside 74
  seconds on 2026-07-26). That is a concurrency race, not attack cadence.
- The "different IPs" (162.159.x, 172.68-71.x) are **all Cloudflare edge
  ranges**.

**What is actually happening:** several tabs or parallel requests refresh at
once. The first rotates the token; the others present the now-rotated token;
`SessionService.rotate` sees `current.revokedAt` set and treats it as reuse.

**Why it matters:** reuse detection revokes the *entire session family*
(`session.service.ts`, the `updateMany` on `familyId`). So a concurrent
refresh logs the user out of everything. Random unexplained logouts are this.

**Fix shipped:** a 30-second grace window in `SessionService.rotate`
(`absorbRefreshRace`). A replayed token is treated as a race only when all
three hold, each ruling out a different way it could be genuine reuse:

1. `replacedBySessionId` is set — the row was **rotated**, not revoked by
   logout, password change, or an earlier reuse cascade. Those leave it null
   and must keep failing closed.
2. the rotation happened inside the window.
3. the successor is still live, unexpired, and on the same app audience.

It returns an access token bound to the successor and **no new refresh
token**; `attachSession` skips the cookie write via `refreshCookieUnchanged`,
because the winning request already set the cookie every tab shares. Writing
this response's empty token would clobber the live one — the exact logout the
fix exists to prevent. Audited as `auth.refresh.race_absorbed`, deliberately
distinct from `reuse_detected` so filing races there stops hiding real theft.

Covered by `apps/api/src/auth/refresh-race.spec.ts`, which is mostly about
what must STILL hard-revoke: replay outside the window, logout/password-change
revocations, an already-revoked successor, and a cross-audience successor.

**Second finding, also fixed:** `AuditEvent.ipAddress` was recording
Cloudflare's edge IP. `trust proxy = 1` was already set, but the chain is
client → Cloudflare → Traefik → API, so `X-Forwarded-For` arrives as
`<client>, <cf-edge>` and one trusted hop resolves to Cloudflare. Now uses
`CF-Connecting-IP` (`apps/api/src/common/client-ip.ts`), falling back to the
left-most XFF entry then `req.ip`. **Rows written before this are still
Cloudflare IPs** — do not read historical audit IPs as client addresses. The
CF-Connecting-IP guarantee holds only while the origin is reachable solely
through Cloudflare; re-check if the API is ever exposed directly.

Query to re-check any of this:

```sql
SELECT "actorPrincipalId", "ipAddress", count(*),
       min("createdAt"), max("createdAt")
FROM "AuditEvent" WHERE action='auth.refresh.reuse_detected'
GROUP BY 1,2 ORDER BY 3 DESC;
```

Or just open **Auditoría** in admin-console and filter the action.

---

## 4. Operational note: the BGG enricher is *supposed* to look unhealthy

`retail-os-bgg-enricher` reporting `unhealthy` is normal and self-healing.
BGG returns HTTP 403 periodically; the circuit breaker opens, the container
stays up for inspection, `/health` returns 503 by design, and it half-opens
every 120 minutes. Circuit-open records exist for 2026-07-11, 07-25 and 08-14.

**The signal to watch is throughput, not the health flag.** Healthy is
250-560 products/hour. On 2026-08-14 it ran ~400/hr all day, then collapsed to
2/hr at 19:00 UTC when BGG started blocking. ~22,900 products remain
unenriched — roughly 13h of work at a healthy rate, never at the blocked rate.

```sql
SELECT date_trunc('hour',"completedAt") h, count(*)
FROM bgg_enrichment_state WHERE "completedAt" > now() - interval '12 hours'
GROUP BY 1 ORDER BY 1;
```

If throughput stays ~0 across several half-open cycles, the block is
persistent rather than a rate-limit window, and pacing
(`BGG_ITEM_DELAY_MS`, `BGG_BATCH_DELAY_*`) or the scraper's stealth
fingerprint needs attention. Do not manually probe BGG while the circuit is
open — the breaker exists to stop exactly that.

---

## 5. Traps this work already paid for

Cheap to re-learn the hard way; all are now load-bearing comments in code.

1. **`listProducts` reports a failed request as `{ results: [], total: 0 }`** —
   byte-identical to a genuine empty tail. Anything paging the catalogue must
   assert an expected row count, or it silently ships short. This produced a
   sitemap missing 43 pages, and before that one covering a fifth of the site.
2. **A short sitemap is not a smaller truth.** It actively tells Google the
   missing URLs do not exist. The chunk routes return **503 + Retry-After**
   rather than a partial file; keep that.
3. **`source: 'db'` means the search index is down**, and the Postgres fallback
   sees only verified products with an active listing (~76 of 155,379).
   Treat it as "cannot answer", not as an answer.
4. **Index-backed counts and DB-backed filters must not be mixed.** Chip counts
   read Typesense while publisher filtering read Postgres → every publisher
   page rendered empty under a chip advertising thousands.
5. **CSS-only folds on crawlable lists.** Slicing a chip array before render
   deletes the internal links the hub exists to provide.
6. **`className="tabular"` is a Tailwind utility in the portals and nothing in
   `apps/web`** (plain CSS, no tailwind.config). Copying portal idioms across
   ships dead classes. See `docs/design-system/PLAYBOOK.md` §2b.
7. **Money in exports goes out in MAJOR units with the currency beside it**, and
   cells starting `= + - @` get quote-prefixed. A spreadsheet has no concept of
   minor units and Excel executes formulas on open.
8. **Reindex after any listing mutation.** Cards are served from the index;
   single edits reindex inline, bulk edits enqueue (`enqueueReindex`).

---

## 6. Suggested order for the next session

1. Whichever of §2.1 / §2.2 / §2.3 the owner has decided.
2. BGG enricher pacing, only if §4's throughput query still reads ~0.
3. Watch `auth.refresh.race_absorbed` vs `auth.refresh.reuse_detected` in
   **Auditoría** for a few days. Races should now land in the first and the
   second should go quiet. If `reuse_detected` keeps firing for one principal
   after this, that is worth taking seriously — the noise that was masking it
   is gone.

Everything in §1-§5 is verified against production as of 2026-08-14 23:15
local. Re-verify before trusting it — the catalogue grows hourly.
