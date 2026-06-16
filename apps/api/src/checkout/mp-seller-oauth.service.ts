import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import { encryptCredentials, decryptCredentials } from '../connectors/credential-crypto.js';

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get clientId() { return process.env.MERCADOPAGO_CLIENT_ID ?? ''; }
  private get clientSecret() { return process.env.MERCADOPAGO_CLIENT_SECRET ?? ''; }
  private get redirectUri() {
    const base = process.env.API_BASE_URL ?? 'http://localhost:3000';
    return `${base}/api/v1/payments/mp/oauth/callback`;
  }
  private get portalUrl() { return process.env.SELLER_PORTAL_URL ?? 'http://localhost:4400'; }

  /** Return the MP OAuth authorization URL for a seller. */
  getAuthUrl(sellerId: string): string {
    if (!this.clientId) {
      return `${this.portalUrl}?mp=error&msg=${encodeURIComponent('MERCADOPAGO_CLIENT_ID not configured')}`;
    }
    const state = Buffer.from(JSON.stringify({ sellerId, ts: Date.now() })).toString('base64url');
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      platform_id: 'mp',
      state,
      redirect_uri: this.redirectUri,
    });
    return `${MP_AUTH_BASE}/authorization?${params}`;
  }

  /** Exchange OAuth code for tokens, persist encrypted, return sellerId. */
  async exchangeCode(code: string, state: string): Promise<string> {
    const { sellerId } = JSON.parse(Buffer.from(state, 'base64url').toString()) as { sellerId: string };

    const res = await fetch(`${MP_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
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
