import type { Request } from 'express';

/**
 * The real client IP, for audit rows.
 *
 * `req.ip` is wrong here and every audit event written so far proves it: the
 * chain is client -> Cloudflare -> Traefik -> API, so `X-Forwarded-For`
 * arrives as `<client>, <cloudflare-edge>`. With `trust proxy = 1` Express
 * trusts a single hop and resolves to the Cloudflare edge address, which is
 * why the whole `AuditEvent.ipAddress` column reads 162.159.x / 172.6x.x and
 * is useless for telling two sessions apart.
 *
 * `CF-Connecting-IP` is set by Cloudflare to the true client address and
 * cannot be spoofed by the client, because Cloudflare overwrites whatever the
 * caller sent. That guarantee only holds while the origin is reachable *only*
 * through Cloudflare — which is the case here (Traefik terminates the
 * tunnel), but it is the assumption to re-check if the API is ever exposed
 * directly.
 *
 * Falls back through the XFF chain, then `req.ip`, so local and non-proxied
 * requests still record something truthful.
 */
export function clientIp(req: Request): string | undefined {
  const cf = req.get('cf-connecting-ip');
  if (cf) return cf.trim();

  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    // Left-most entry is the originating client; everything after it is the
    // proxy chain that handled the request.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return req.ip;
}
