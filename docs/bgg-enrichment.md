# BGG catalog enrichment worker

The `bgg-enricher` Compose service continuously fills missing BGG product details. It processes at most 50 products serially, waits a random 20–40 seconds after each batch, and resumes from durable PostgreSQL checkpoints after a restart.

For every product it:

1. Loads the BGG game page through `bgg-scraper`.
2. Updates description, publisher, designer, player/time/age data, rating, weight, categories, and mechanics.
3. Downloads the BGG image into `data/bgg-images/` and replaces the remote image URL with `BGG_IMAGE_PUBLIC_BASE_URL`.
4. Optionally translates title and description with `google-translate-api-x` in one batch request.
5. Updates the Typesense document when Typesense is configured.

Machine translations are stored as `NEEDS_REVIEW` by default. Set `TRANSLATION_MODERATION_STATUS=APPROVED` only if automatic publication is acceptable.

## Start

Apply migrations before starting the worker:

```sh
pnpm db:migrate
docker compose -f infra/docker-compose.yml up -d --build postgres typesense bgg-scraper bgg-enricher
```

For a deployed database, use `prisma migrate deploy` instead of `prisma migrate dev`:

```sh
pnpm exec prisma migrate deploy --schema libs/data/db-postgres/prisma/schema.prisma
```

Monitor progress:

```sh
docker compose -f infra/docker-compose.yml logs -f bgg-enricher
curl -s http://localhost:3003/health
```

Downloaded images are served by the scraper at `http://localhost:3001/images/<bgg-id>.<ext>`. In production, set `BGG_IMAGE_PUBLIC_BASE_URL` to the public URL that routes to this directory/service.

## Guardrails

- Requests are serial and spaced by at least 1.5 seconds.
- Translation uses the package's batch endpoint, combines title and description into one request, limits either field to 4,500 characters, and defaults to one call every 3–4 seconds.
- A 401/403/429, CAPTCHA, Cloudflare challenge, or explicit rate-limit response immediately opens the circuit.
- Five consecutive transient/malformed responses also open the circuit.
- The circuit is persisted at `data/bgg-enricher/circuit-open.json`; while it exists, the container stays up for inspection but makes no outbound requests and reports HTTP 503 from `/health`.
- Individual 404s are skipped. Other individual failures retry after six hours and become terminal after three attempts.
- A crashed `running` checkpoint is reclaimed after 30 minutes.

Inspect the circuit reason before resuming. After correcting credentials, blocking, or request pacing:

```sh
docker compose -f infra/docker-compose.yml stop bgg-enricher
rm data/bgg-enricher/circuit-open.json
docker compose -f infra/docker-compose.yml start bgg-enricher
```

The pacing and retry variables are documented in `.env.example` and `infra/.env.example`. Do not reduce them aggressively: neither BGG HTML scraping nor the unofficial Google Translate endpoint offers a contractual bulk quota.
