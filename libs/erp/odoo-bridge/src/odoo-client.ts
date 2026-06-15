/**
 * OdooClient — thin JSON-RPC 2.0 client for Odoo 16/17.
 *
 * Covers the Odoo external API surface used by the EWP bridge:
 * - Session authentication (username + password → session cookie)
 * - `call_kw` for model method calls (search_read, create, write, etc.)
 *
 * Node.js native fetch does NOT maintain a cookie jar (credentials: 'include'
 * is browser-only). We manually extract the session_id from Set-Cookie after
 * authenticate() and inject it as a Cookie header on every subsequent request.
 */

export interface OdooConfig {
  url: string;
  database: string;
  username: string;
  password: string;
}

export interface OdooSession {
  uid: number;
  sessionId: string;
  serverVersion: string;
  database: string;
}

export class OdooClientError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'OdooClientError';
  }
}

export interface SearchReadOptions {
  domain?: unknown[][];
  fields?: string[];
  limit?: number;
  offset?: number;
  order?: string;
}

export interface SearchReadAllOptions extends Omit<SearchReadOptions, 'limit' | 'offset'> {
  batchSize?: number;
  maxRecords?: number;
}

export class OdooClient {
  private session: OdooSession | null = null;
  private cookieHeader: string | null = null;
  private reqId = 0;

  constructor(private readonly config: OdooConfig) {}

  get isAuthenticated(): boolean {
    return this.session !== null;
  }

  get currentSession(): OdooSession | null {
    return this.session;
  }

  async authenticate(): Promise<OdooSession> {
    const id = ++this.reqId;
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id,
      params: {
        db: this.config.database,
        login: this.config.username,
        password: this.config.password,
      },
    });

    let resp: Response;
    try {
      resp = await fetch(`${this.config.url}/web/session/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (err) {
      throw new OdooClientError(`Network error reaching ${this.config.url}: ${String(err)}`);
    }

    if (!resp.ok) {
      throw new OdooClientError(`HTTP ${resp.status} from Odoo: ${resp.statusText}`);
    }

    // Extract session_id from Set-Cookie header — Node.js fetch does not
    // maintain a cookie jar, so we must carry it manually.
    const setCookie = resp.headers.get('set-cookie') ?? '';
    const match = setCookie.match(/session_id=([^;]+)/);
    if (match) {
      this.cookieHeader = `session_id=${match[1]}`;
    }

    const json = (await resp.json()) as {
      result?: Record<string, unknown>;
      error?: { code: number; message: string; data?: unknown };
    };

    if (json.error) {
      throw new OdooClientError(json.error.message ?? 'Odoo RPC error', json.error.code, json.error.data);
    }

    const result = json.result ?? {};

    if (!result['uid']) {
      throw new OdooClientError('Authentication failed: invalid credentials or database');
    }

    this.session = {
      uid: result['uid'] as number,
      sessionId: match?.[1] ?? '',
      serverVersion: (result['server_version'] as string) ?? 'unknown',
      database: this.config.database,
    };

    return this.session;
  }

  /** Call any Odoo model method via /web/dataset/call_kw. */
  async callKw<T = unknown>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    if (!this.session) throw new OdooClientError('Not authenticated — call authenticate() first');
    return this.rpc<T>('/web/dataset/call_kw', {
      model,
      method,
      args,
      kwargs: { context: {}, ...kwargs },
    });
  }

  /** Convenience: `model.search_read(domain, fields, offset, limit, order)` */
  async searchRead<T = Record<string, unknown>>(
    model: string,
    options: SearchReadOptions = {},
  ): Promise<T[]> {
    return this.callKw<T[]>(model, 'search_read', [options.domain ?? []], {
      fields: options.fields,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
      order: options.order,
    });
  }

  /** Read every matching record in bounded pages instead of silently truncating. */
  async searchReadAll<T = Record<string, unknown>>(
    model: string,
    options: SearchReadAllOptions = {},
  ): Promise<T[]> {
    const batchSize = Math.max(1, options.batchSize ?? 500);
    const maxRecords = Math.max(batchSize, options.maxRecords ?? 100_000);
    const records: T[] = [];

    while (records.length < maxRecords) {
      const limit = Math.min(batchSize, maxRecords - records.length);
      const page = await this.searchRead<T>(model, {
        domain: options.domain,
        fields: options.fields,
        order: options.order,
        offset: records.length,
        limit,
      });

      records.push(...page);
      if (page.length < limit) break;
    }

    if (records.length === maxRecords) {
      throw new OdooClientError(
        `Search for ${model} reached the safety limit of ${maxRecords} records`,
      );
    }

    return records;
  }

  /** Convenience: `model.create(vals)` — returns new record id. */
  async create(model: string, vals: Record<string, unknown>): Promise<number> {
    return this.callKw<number>(model, 'create', [vals]);
  }

  /** Convenience: `model.write(ids, vals)` */
  async write(model: string, ids: number[], vals: Record<string, unknown>): Promise<boolean> {
    return this.callKw<boolean>(model, 'write', [ids, vals]);
  }

  /** Get Odoo server version — no authentication required. */
  async getServerVersion(): Promise<string> {
    const result = await this.rpc<Record<string, unknown>>('/web/webclient/version_info', {});
    return (result['server_version'] as string) ?? 'unknown';
  }

  private async rpc<T = Record<string, unknown>>(endpoint: string, params: Record<string, unknown>): Promise<T> {
    const id = ++this.reqId;
    const body = JSON.stringify({ jsonrpc: '2.0', method: 'call', id, params });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cookieHeader) headers['Cookie'] = this.cookieHeader;

    let resp: Response;
    try {
      resp = await fetch(`${this.config.url}${endpoint}`, { method: 'POST', headers, body });
    } catch (err) {
      throw new OdooClientError(`Network error reaching ${this.config.url}: ${String(err)}`);
    }

    if (!resp.ok) {
      throw new OdooClientError(`HTTP ${resp.status} from Odoo: ${resp.statusText}`);
    }

    const json = (await resp.json()) as {
      result?: T;
      error?: { code: number; message: string; data?: unknown };
    };

    if (json.error) {
      throw new OdooClientError(json.error.message ?? 'Odoo RPC error', json.error.code, json.error.data);
    }

    return json.result as T;
  }

  /** Fetch a binary resource (e.g. product image) with the current session cookie.
   *  Returns a base64-encoded data URI, or null if the request fails or returns no content. */
  async fetchImage(url: string): Promise<string | null> {
    if (!this.cookieHeader) return null;
    const headers: Record<string, string> = { Cookie: this.cookieHeader };
    try {
      const resp = await fetch(url, { headers });
      if (!resp.ok || resp.status === 404) return null;
      const contentType = resp.headers.get('content-type') ?? 'image/png';
      const buf = await resp.arrayBuffer();
      if (!buf.byteLength) return null;
      const b64 = Buffer.from(buf).toString('base64');
      return `data:${contentType};base64,${b64}`;
    } catch {
      return null;
    }
  }
}
