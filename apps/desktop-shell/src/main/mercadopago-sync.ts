import { createServer, type Server } from 'node:http';
import { shell } from 'electron';
import type { Db } from '@retail-os/local-db';

// ── Mercado Pago API types ───────────────────────────────────────────────────

interface MpTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
  scope: string;
  token_type: string;
}

interface MpTerminalDevice {
  id: string;
  name: string;
  model: string;
  serial_number?: string;
  status?: string;
}

export interface MpTerminal {
  id: string;
  name: string;
  model: string;
  online: boolean;
}

// ── Sync state ───────────────────────────────────────────────────────────────

export interface MercadoPagoSyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  mode: 'production' | 'development' | null;
  merchantId: string | null;
  terminals: MpTerminal[];
  error: string | null;
}

interface MercadoPagoSyncTerminalContext {
  tenantId: string;
  storeId: string;
}

// ── Persisted token blob (JSON in encrypted_access_token column) ─────────────

interface TokenBlob {
  access_token: string;
  refresh_token: string;
  client_id?: string;
  client_secret?: string;
}

const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const MP_DEVICES_URL = 'https://api.mercadopago.com/terminals/terminals';
const USER_AGENT = 'RetailOS (pos@retailos.dev)';

/**
 * MercadoPagoSync — manages the OAuth connection to Mercado Pago and
 * discovers assigned Point terminals. Runs entirely in the Electron main
 * process. Tokens are persisted in the local SQLite `provider_connections`
 * table so the connection survives restarts without env vars.
 */
export class MercadoPagoSync {
  private state: MercadoPagoSyncState = {
    status: 'disconnected',
    mode: null,
    merchantId: null,
    terminals: [],
    error: null,
  };

  private tokenBlob: TokenBlob | null = null;
  private tokenExpiresAt: Date | null = null;
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private oauthServer: Server | null = null;

  constructor(
    private readonly db: Db,
    private readonly terminalContext: MercadoPagoSyncTerminalContext,
  ) {
    this.loadExistingConnection();
  }

  getState(): MercadoPagoSyncState {
    return { ...this.state };
  }

  /** Start the OAuth Authorization Code flow via local HTTP callback server. */
  async connect(clientId: string, clientSecret: string): Promise<MercadoPagoSyncState> {
    if (this.state.status === 'connecting') return this.getState();

    this.state = { ...this.state, status: 'connecting', error: null };
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    try {
      const { accessToken, refreshToken, merchantId, expiresIn } =
        await this.runOAuthFlow(clientId, clientSecret);

      const blob: TokenBlob = {
        access_token: accessToken,
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      };
      this.tokenBlob = blob;
      this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      this.persistConnection(merchantId, blob, 'production', this.tokenExpiresAt);

      // Try to discover terminals after connecting.
      let terminals: MpTerminal[] = [];
      try {
        terminals = await this.fetchTerminals(accessToken);
        this.persistTerminals(merchantId, terminals);
      } catch {
        // Terminal discovery is best-effort after OAuth succeeds.
      }

      this.state = {
        status: 'connected',
        mode: 'production',
        merchantId,
        terminals,
        error: null,
      };
      return this.getState();
    } catch (err) {
      this.state = {
        ...this.state,
        status: 'error',
        error: err instanceof Error ? err.message : 'OAuth failed',
      };
      return this.getState();
    }
  }

  /** Store a test access token (dev mode, no OAuth). */
  async connectDev(accessToken: string): Promise<MercadoPagoSyncState> {
    const blob: TokenBlob = {
      access_token: accessToken,
      refresh_token: '',
    };
    this.tokenBlob = blob;
    this.tokenExpiresAt = null; // test tokens don't expire

    const merchantId = 'dev-account';
    this.persistConnection(merchantId, blob, 'development', null);

    this.state = {
      status: 'connected',
      mode: 'development',
      merchantId,
      terminals: [{ id: 'VTERM-001', name: 'Terminal Virtual', model: 'VTERM', online: true }],
      error: null,
    };
    return this.getState();
  }

  /** Disconnect and remove all persisted data. */
  disconnect(): MercadoPagoSyncState {
    if (this.oauthServer?.listening) {
      this.oauthServer.close();
      this.oauthServer = null;
    }
    this.db.exec("DELETE FROM provider_connections WHERE provider = 'mercadopago_point'");
    this.db.exec("DELETE FROM terminal_assignments WHERE provider = 'mercadopago_point'");
    this.tokenBlob = null;
    this.tokenExpiresAt = null;
    this.clientId = null;
    this.clientSecret = null;
    this.state = { status: 'disconnected', mode: null, merchantId: null, terminals: [], error: null };
    return this.getState();
  }

  /** Discover terminals from the Mercado Pago API. */
  async discoverTerminals(): Promise<MercadoPagoSyncState> {
    const token = await this.getAccessToken();
    if (!token || !this.state.merchantId) {
      this.state = { ...this.state, error: 'No connection' };
      return this.getState();
    }

    try {
      const terminals = await this.fetchTerminals(token);
      this.persistTerminals(this.state.merchantId, terminals);
      this.state = { ...this.state, terminals, error: null };
      return this.getState();
    } catch (err) {
      this.state = {
        ...this.state,
        error: err instanceof Error ? err.message : 'Terminal discovery failed',
      };
      return this.getState();
    }
  }

  /** Returns the current access token, refreshing if expired. */
  async getAccessToken(): Promise<string | null> {
    if (!this.tokenBlob) return null;

    // Dev tokens don't expire.
    if (!this.tokenExpiresAt) return this.tokenBlob.access_token;

    // Refresh if within 5 minutes of expiry.
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() + fiveMinutes >= this.tokenExpiresAt.getTime()) {
      await this.refreshToken();
    }

    return this.tokenBlob.access_token;
  }

  // ── Private: OAuth flow ──────────────────────────────────────────────────

  private runOAuthFlow(
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; refreshToken: string; merchantId: string; expiresIn: number }> {
    return new Promise((resolve, reject) => {
      const server = createServer(async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const code = url.searchParams.get('code');
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>Error: no se recibio codigo de autorizacion</h1>');
            return;
          }

          const token = await this.exchangeCode(clientId, clientSecret, code, redirectUri);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html><body style="font-family:system-ui;text-align:center;padding:4rem">
              <h1>Conectado a Mercado Pago</h1>
              <p>Puedes cerrar esta ventana y volver a Retail OS.</p>
            </body></html>
          `);
          cleanup();
          resolve({
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            merchantId: String(token.user_id),
            expiresIn: token.expires_in,
          });
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Error al conectar con Mercado Pago</h1>');
          cleanup();
          reject(err);
        }
      });

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('OAuth timeout — no response within 2 minutes'));
      }, 120_000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (!server.listening) return;
        server.close();
        this.oauthServer = null;
      };

      this.oauthServer = server;

      let redirectUri = '';
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        redirectUri = `http://localhost:${addr.port}/callback`;
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          state: String(Date.now()),
        });
        void shell.openExternal(`${MP_AUTH_URL}?${params.toString()}`);
      });
    });
  }

  private async exchangeCode(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string,
  ): Promise<MpTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(MP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Token exchange failed: HTTP ${res.status}`);
    return res.json() as Promise<MpTokenResponse>;
  }

  private async refreshToken(): Promise<void> {
    if (!this.tokenBlob?.refresh_token) return;

    const cid = this.tokenBlob.client_id ?? this.clientId;
    const csecret = this.tokenBlob.client_secret ?? this.clientSecret;
    if (!cid || !csecret) return;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cid,
      client_secret: csecret,
      refresh_token: this.tokenBlob.refresh_token,
    });

    const res = await fetch(MP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Token refresh failed: HTTP ${res.status}`);
    const json = (await res.json()) as MpTokenResponse;

    this.tokenBlob = {
      ...this.tokenBlob,
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    };
    this.tokenExpiresAt = new Date(Date.now() + json.expires_in * 1000);

    // Update persisted token.
    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE provider_connections SET encrypted_access_token = ?, token_expires_at = ?, updated_at = ? WHERE provider = 'mercadopago_point' AND status = 'active'",
      )
      .run(JSON.stringify(this.tokenBlob), this.tokenExpiresAt.toISOString(), now);
  }

  // ── Private: terminal discovery ────────────────────────────────────────

  private async fetchTerminals(accessToken: string): Promise<MpTerminal[]> {
    const res = await fetch(MP_DEVICES_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Terminal discovery failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as { terminals?: MpTerminalDevice[] };
    return (json.terminals ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      model: t.model,
      online: t.status === 'online',
    }));
  }

  private persistTerminals(merchantId: string, terminals: MpTerminal[]): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT INTO terminal_assignments (id, tenant_id, store_id, provider, terminal_id, terminal_name, terminal_model, active, created_at, updated_at)
       VALUES (@id, @tenantId, @storeId, @provider, @terminalId, @terminalName, @terminalModel, 1, @now, @now)
       ON CONFLICT(id) DO UPDATE SET terminal_name=@terminalName, terminal_model=@terminalModel, active=1, updated_at=@now`,
    );
    for (const t of terminals) {
      stmt.run({
        id: `mp-${merchantId}-${t.id}`,
        tenantId: this.terminalContext.tenantId,
        storeId: this.terminalContext.storeId,
        provider: 'mercadopago_point',
        terminalId: t.id,
        terminalName: t.name,
        terminalModel: t.model,
        now,
      });
    }
  }

  // ── Private: persistence ───────────────────────────────────────────────

  private loadExistingConnection(): void {
    const row = this.db
      .prepare(
        "SELECT provider_account_id, encrypted_access_token, token_expires_at, mode FROM provider_connections WHERE provider = 'mercadopago_point' AND status = 'active' LIMIT 1",
      )
      .get() as
      | { provider_account_id: string; encrypted_access_token: string; token_expires_at: string | null; mode: string }
      | undefined;

    if (!row) return;

    try {
      this.tokenBlob = JSON.parse(row.encrypted_access_token) as TokenBlob;
    } catch {
      // Legacy plain-text token (dev mode).
      this.tokenBlob = { access_token: row.encrypted_access_token, refresh_token: '' };
    }

    if (this.tokenBlob.client_id) this.clientId = this.tokenBlob.client_id;
    if (this.tokenBlob.client_secret) this.clientSecret = this.tokenBlob.client_secret;
    this.tokenExpiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null;

    // Load persisted terminals.
    const terminalRows = this.db
      .prepare("SELECT terminal_id, terminal_name, terminal_model FROM terminal_assignments WHERE provider = 'mercadopago_point' AND active = 1")
      .all() as Array<{ terminal_id: string; terminal_name: string; terminal_model: string | null }>;

    const terminals: MpTerminal[] =
      row.mode === 'development'
        ? [{ id: 'VTERM-001', name: 'Terminal Virtual', model: 'VTERM', online: true }]
        : terminalRows.map((t) => ({
            id: t.terminal_id,
            name: t.terminal_name,
            model: t.terminal_model ?? 'Unknown',
            online: true,
          }));

    this.state = {
      status: 'connected',
      mode: row.mode as 'production' | 'development',
      merchantId: row.provider_account_id,
      terminals,
      error: null,
    };
  }

  private persistConnection(
    merchantId: string,
    blob: TokenBlob,
    mode: 'production' | 'development',
    expiresAt: Date | null,
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO provider_connections (id, tenant_id, provider, mode, status, encrypted_access_token, provider_account_id, token_expires_at, created_at, updated_at)
         VALUES (@id, @tenantId, 'mercadopago_point', @mode, 'active', @token, @merchantId, @expiresAt, @now, @now)
         ON CONFLICT(tenant_id, provider, mode) DO UPDATE SET
           status='active', encrypted_access_token=@token, provider_account_id=@merchantId, token_expires_at=@expiresAt, updated_at=@now`,
      )
      .run({
        id: `mp-conn-${merchantId}`,
        tenantId: this.terminalContext.tenantId,
        mode,
        token: JSON.stringify(blob),
        merchantId,
        expiresAt: expiresAt?.toISOString() ?? null,
        now,
      });
  }
}
