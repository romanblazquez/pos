import { Body, Controller, Get, Inject, Param, Post, Query, Headers } from '@nestjs/common';
import { MpOAuthService } from './mp-oauth.service.js';
import { Public, Roles } from '../auth/auth.guard.js';
import { verifyMercadoPagoSignature } from '../common/webhook-signature.js';

interface DevCredentialsDto {
  merchantId: string;
  accessToken: string;
}

interface OAuthCallbackQuery {
  code: string;
  state: string;
}

interface WebhookPayload {
  action?: string;
  data?: { id?: string };
  type?: string;
  [key: string]: unknown;
}

/**
 * PaymentsController — Mercado Pago OAuth + terminal discovery + webhook ingestion.
 *
 * Security note: the OAuth callback exchanges a code for tokens server-side.
 * Access tokens never reach the frontend. In production, wrap all endpoints with
 * a JWT auth guard and limit dev-credentials endpoints to internal IPs.
 */
@Roles('admin', 'service')
@Controller('payments')
export class PaymentsController {
  constructor(@Inject(MpOAuthService) private readonly mpOAuth: MpOAuthService) {}

  // ─── Mercado Pago OAuth ─────────────────────────────────────────────────────
  /** Step 1: return the URL to which the merchant should be redirected. */
  @Get('mercadopago/auth-url')
  async getMpAuthUrl(
    @Query('merchantId') merchantId: string,
    @Query('redirectUri') redirectUri: string,
  ): Promise<{ url: string }> {
    const clientId = process.env.MERCADOPAGO_CLIENT_ID ?? '';
    const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET ?? '';
    const url = await this.mpOAuth.buildAuthorizationUrl(
      { clientId, clientSecret, redirectUri, env: process.env.MERCADOPAGO_ENV === 'production' ? 'production' : 'test' },
      merchantId,
    );
    return { url };
  }

  /** Step 2: MP redirects here; exchange code → tokens → discover terminals. */
  @Get('mercadopago/callback')
  @Public()
  async mpOAuthCallback(@Query() query: OAuthCallbackQuery) {
    const clientId = process.env.MERCADOPAGO_CLIENT_ID ?? '';
    const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET ?? '';
    const redirectUri = process.env.MERCADOPAGO_REDIRECT_URI ?? '';
    const token = await this.mpOAuth.exchangeCode(
      { clientId, clientSecret, redirectUri, env: 'production' },
      query.code,
      query.state,
    );
    const terminals = await this.mpOAuth.discoverTerminals(token.accessToken);
    return { merchantId: token.merchantId, scope: token.scope, terminals };
  }

  /** Dev-mode only: store a test Access Token without the OAuth redirect. */
  @Post('mercadopago/dev-credentials')
  storeDevCredentials(@Body() body: DevCredentialsDto) {
    if (process.env.RETAIL_DEV_MODE !== 'true') {
      return { error: 'Dev credentials endpoint is only available in RETAIL_DEV_MODE=true' };
    }
    this.mpOAuth.storeDevCredentials(body.merchantId, body.accessToken);
    return { ok: true, merchantId: body.merchantId };
  }

  /** Discover Point terminals after OAuth. */
  @Get('mercadopago/terminals/:merchantId')
  async discoverTerminals(@Param('merchantId') merchantId: string) {
    const token = this.mpOAuth.getAccessToken(merchantId);
    if (!token) return { error: 'No access token for merchant; complete OAuth first.' };
    const terminals = await this.mpOAuth.discoverTerminals(token);
    return { terminals };
  }

  // ─── Webhook ingestion ──────────────────────────────────────────────────────
  /** Inbound webhook from Mercado Pago. Validates, records, and maps to RWP event. */
  @Post('webhooks/mercadopago-point')
  @Public()
  async receiveMpWebhook(
    @Body() body: WebhookPayload,
    @Headers('x-signature') signature?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const eventId = body.data?.id ?? 'unknown';
    verifyMercadoPagoSignature(signature, requestId, eventId);
    const action = body.action ?? body.type ?? 'unknown';
    // TODO: look up the local payment by providerRef=eventId, update status,
    //       emit rwp.payment.completed or rwp.payment.failed via SSE/WebSocket.
    return { received: true, action, eventId };
  }
}
