import { Injectable } from '@nestjs/common';

export interface MpOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  env: 'test' | 'production';
}

export interface MpToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  merchantId: string;
  scope: string;
}

export interface MpDiscoveredTerminal {
  terminalId: string;
  name: string;
  model: string;
  serialNumber?: string;
  online: boolean;
}

/**
 * MpOAuthService — server-side Mercado Pago OAuth Authorization Code Flow.
 *
 * Production flow:
 *   1. Build the authorization URL → redirect merchant to MP.
 *   2. MP redirects back with `?code=xxx&state=yyy`.
 *   3. Exchange the code for an `access_token` + `refresh_token`.
 *   4. Store encrypted tokens; never return them to the frontend.
 *   5. Use the access token to discover assigned Point terminals.
 *
 * Development flow:
 *   - Skip OAuth; accept a test `ACCESS_TOKEN` from the request body.
 *   - Only available when `RETAIL_DEV_MODE=true`.
 *
 * Token storage is intentionally a stub (in-memory Map) this pass; production
 * wires Prisma `ProviderConnection` + encryption (AES-256-GCM with a key stored
 * in KMS / environment secret). See docs/security-model.md.
 */
@Injectable()
export class MpOAuthService {
  private readonly tokens = new Map<string, MpToken>();
  private readonly MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
  private readonly MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
  private readonly MP_DEVICES_URL = 'https://api.mercadopago.com/terminals/terminals';

  buildAuthorizationUrl(config: MpOAuthConfig, merchantId: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state: `${merchantId}:${Date.now()}`,
    });
    return `${this.MP_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(
    config: MpOAuthConfig,
    code: string,
    merchantId: string,
  ): Promise<MpToken> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    });
    const res = await fetch(this.MP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`MP OAuth token exchange failed: HTTP ${res.status}`);
    const json = await res.json() as { access_token: string; refresh_token: string; expires_in: number; user_id: number; scope: string };
    const token: MpToken = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
      merchantId: String(json.user_id),
      scope: json.scope,
    };
    // TODO(production): encrypt and persist to ProviderConnection via Prisma.
    this.tokens.set(merchantId, token);
    return token;
  }

  /** Store test credentials from dev mode (no OAuth redirect needed). */
  storeDevCredentials(merchantId: string, accessToken: string): void {
    this.tokens.set(merchantId, {
      accessToken,
      refreshToken: '',
      expiresIn: 0,
      merchantId,
      scope: 'offline_access read write',
    });
  }

  getAccessToken(merchantId: string): string | undefined {
    return this.tokens.get(merchantId)?.accessToken;
  }

  async discoverTerminals(accessToken: string): Promise<MpDiscoveredTerminal[]> {
    const res = await fetch(this.MP_DEVICES_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      if (res.status === 404) return []; // No terminals assigned yet.
      throw new Error(`MP terminals discovery failed: HTTP ${res.status}`);
    }
    const json = await res.json() as { terminals: Array<{ id: string; name: string; model: string; serial_number?: string; status?: string }> };
    return (json.terminals ?? []).map((t) => ({
      terminalId: t.id,
      name: t.name,
      model: t.model,
      serialNumber: t.serial_number,
      online: t.status === 'online',
    }));
  }
}
