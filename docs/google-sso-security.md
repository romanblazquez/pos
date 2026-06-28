# Google SSO and first-party API sessions

## Trust boundaries

- `marketplace` (`4300`) accepts verified Google users and creates/links a customer profile.
- `admin` (`4500`) accepts only active rows in `PlatformAdminMembership`. The initial allowlist contains `matiasblazquez@gmail.com`.
- Google ID tokens are consumed once at `/api/v1/auth/google`. They are never accepted as API bearer tokens.
- Protected API calls use a short-lived first-party JWT. Refresh credentials are random, rotated, hashed in PostgreSQL, and stored only in an HttpOnly cookie.

## Google Cloud configuration

Create two **Web application** OAuth clients under the same Google consent/branding project:

1. Marketplace client authorized JavaScript origins:
   - `http://localhost:4300`
   - the production marketplace HTTPS origin
2. Admin client authorized JavaScript origins:
   - `http://localhost:4500`
   - the production admin HTTPS origin

The implementation uses the Google Identity Services JavaScript callback and ID token, so no Google authorization redirect URI or client secret is required.

Set the same client ID on the API and corresponding Vite build:

```dotenv
GOOGLE_MARKETPLACE_CLIENT_ID="...apps.googleusercontent.com"
VITE_GOOGLE_MARKETPLACE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_ADMIN_CLIENT_ID="...apps.googleusercontent.com"
VITE_GOOGLE_ADMIN_CLIENT_ID="...apps.googleusercontent.com"
PLATFORM_ADMIN_EMAILS="matiasblazquez@gmail.com"
```

Vite variables are embedded at build time; set them before building the frontends.

## Production token keys

Generate and store an RSA key pair in the deployment secret manager:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out jwt-private.pem
openssl rsa -pubout -in jwt-private.pem -out jwt-public.pem
```

Provide PEM or base64-encoded PEM through `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`, and set a unique `JWT_KEY_ID`. During rotation, put old public keys in `JWT_PREVIOUS_PUBLIC_KEYS` until all old access JWTs expire.

Production startup rejects missing keys, Google client IDs, HTTPS API URL, credential encryption key, webhook secret, or non-HTTPS allowed origins.

## Database and startup

For the current development workflow:

```sh
docker compose -f infra/docker-compose.yml up -d postgres redis typesense
pnpm db:push
pnpm dev:web
```

For an existing deployed database, apply `20260628120000_secure_identity` through the deployment migration workflow before starting the new API. The API also idempotently ensures the configured initial admin memberships exist.

## Reverse proxy and headers

Production should expose `/api` on the same site as each SPA and proxy it to the Nest API. Configure a CSP that permits the Google Identity script/frame endpoints while keeping `default-src 'self'`. Do not permit arbitrary origins. `ALLOWED_ORIGINS` must list the exact marketplace, seller, and admin HTTPS origins.

Required webhook secrets:

```dotenv
MERCADOPAGO_WEBHOOK_SECRET="..."
TIENDANUBE_CLIENT_SECRET="..."
```

MercadoPago notifications are timestamped and HMAC-verified. Tiendanube signatures are verified against the raw request body and the signed store ID must match the seller's encrypted connector credentials.
