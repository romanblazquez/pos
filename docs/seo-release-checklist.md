# Marketplace SEO release switch

SEO markup can be developed and validated while public indexing remains disabled.

## Current safe state

- `VITE_SEO_INDEXING_ENABLED=false` produces `noindex,nofollow,noarchive`.
- Marketplace `robots.txt` uses `Disallow: /`.
- Traefik applies the authoritative `X-Robots-Tag: noindex...` middleware.

All three layers must agree before launch. Changing only the application flag does not
activate indexing.

## Enable indexing

1. Set `MARKETPLACE_SEO_ENABLED=true` in
   `docker-stacks/retail-web/.env`.
2. Change only the marketplace `robots.txt` to:

   ```text
   User-agent: *
   Allow: /
   Sitemap: https://juegospedia.com/sitemap.xml
   ```

   Keep seller and admin portals blocked.
3. Remove `noindex` from only the `marketplace` router in
   `reverse-proxy/traefik-min/dynamic.yml`.
4. Rebuild `retail-web` and reload Traefik.
5. Verify:
   - no `X-Robots-Tag: noindex` on public marketplace pages;
   - canonical URL points to `https://juegospedia.com`;
   - robots.txt allows crawling;
   - sitemap URLs return 200;
   - product and breadcrumb JSON-LD pass Rich Results Test.

## Disable indexing

Reverse the three controls. The Traefik header is the emergency kill switch because it
overrides page metadata without requiring a frontend rebuild.
