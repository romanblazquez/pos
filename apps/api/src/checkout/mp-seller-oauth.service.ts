import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '@retail-os/db-postgres';
import { encryptCredentials, decryptCredentials } from '../connectors/credential-crypto.js';
import { OAuthStateService } from '../auth/oauth-state.service.js';

const MP_BASE = 'https://api.mercadopago.com';
const MP_AUTH_BASE = 'https://auth.mercadopago.com';

interface MpTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
}

interface StoredMpCreds {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
}

@Injectable()
export class MpSellerOAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OAuthStateService) private readonly oauthState: OAuthStateService,
  ) {}

  private get clientId() { return process.env.MERCADOPAGO_CLIENT_ID ?? ''; }
  private get clientSecret() { return process.env.MERCADOPAGO_CLIENT_SECRET ?? ''; }
  private get redirectUri() {
    if (process.env.MERCADOPAGO_REDIRECT_URI) return process.env.MERCADOPAGO_REDIRECT_URI;
    const base = process.env.API_BASE_URL ?? 'http://localhost:3000';
    return `${base}/api/v1/payments/mp/oauth/callback`;
  }
  private get portalUrl() { return process.env.SELLER_PORTAL_URL ?? 'http://localhost:4400'; }

  /**
   * Return the MP OAuth authorization URL for a seller.
   *
   * PKCE: MP requires `code_challenge`/`code_challenge_method` once a marketplace
   * app has the "authorization code + PKCE" flow enabled in its dashboard — without
   * them the /authorization endpoint itself 400s. There's no server-side session to
   * stash the verifier in across this redirect round-trip, so it travels inside the
   * (already opaque, base64url-encoded) `state` param instead, the same place
   * `sellerId` already rides — `exchangeCode` reads it back out below.
   */
  async getAuthUrl(sellerId: string): Promise<string> {
    if (!this.clientId) {
      return `${this.portalUrl}?mp=error&msg=${encodeURIComponent('MERCADOPAGO_CLIENT_ID not configured')}`;
    }
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = await this.oauthState.create('mercadopago-seller', sellerId, codeVerifier);
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      platform_id: 'mp',
      state,
      redirect_uri: this.redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${MP_AUTH_BASE}/authorization?${params}`;
  }

  /** Exchange OAuth code for tokens, persist encrypted, return sellerId. */
  async exchangeCode(code: string, state: string): Promise<string> {
    const transaction = await this.oauthState.consumeByState('mercadopago-seller', state);
    const sellerId = transaction.ownerId;
    const codeVerifier = transaction.codeVerifier;

    const res = await fetch(`${MP_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        ...(codeVerifier && { code_verifier: codeVerifier }),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MP token exchange failed: ${err}`);
    }

    const data = (await res.json()) as MpTokenResponse;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    const creds: StoredMpCreds = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };

    await this.prisma.sellerMpConnection.upsert({
      where: { sellerId },
      create: {
        sellerId,
        merchantId: String(data.user_id),
        scope: data.scope,
        encryptedCreds: encryptCredentials(creds as unknown as Record<string, string>),
      },
      update: {
        merchantId: String(data.user_id),
        scope: data.scope,
        encryptedCreds: encryptCredentials(creds as unknown as Record<string, string>),
        updatedAt: new Date(),
      },
    });

    return sellerId;
  }

  /** Load and decrypt a seller's MP access token, refreshing if near expiry. */
  async getSellerAccessToken(sellerId: string): Promise<string> {
    const conn = await this.prisma.sellerMpConnection.findUnique({ where: { sellerId } });
    if (!conn) throw new NotFoundException(`Seller ${sellerId} has no MercadoPago connection`);

    const creds = decryptCredentials(conn.encryptedCreds as Record<string, unknown>) as unknown as StoredMpCreds;

    // Refresh if token expires in < 5 minutes
    if (new Date(creds.expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
      return this.refreshToken(sellerId, creds.refreshToken);
    }

    return creds.accessToken;
  }

  async getConnectionStatus(sellerId: string): Promise<{ connected: boolean; merchantId?: string; connectedAt?: Date }> {
    const conn = await this.prisma.sellerMpConnection.findUnique({ where: { sellerId } });
    if (!conn) return { connected: false };
    return { connected: true, merchantId: conn.merchantId, connectedAt: conn.connectedAt };
  }

  private async refreshToken(sellerId: string, refreshToken: string): Promise<string> {
    const res = await fetch(`${MP_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) throw new Error('MP token refresh failed');

    const data = (await res.json()) as MpTokenResponse;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    const creds: StoredMpCreds = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };

    await this.prisma.sellerMpConnection.update({
      where: { sellerId },
      data: {
        encryptedCreds: encryptCredentials(creds as unknown as Record<string, string>),
        updatedAt: new Date(),
      },
    });

    return data.access_token;
  }
}
