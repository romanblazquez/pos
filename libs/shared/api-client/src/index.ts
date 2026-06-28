export type BrowserAuthApp = 'marketplace' | 'admin' | 'seller';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  role: 'customer' | 'admin' | 'seller' | 'service';
}

export interface BrowserSession {
  accessToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
  customer?: { id: string; email: string; name?: string | null };
  seller?: Record<string, unknown> & { id: string };
}

export class BrowserApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<BrowserSession | null> | null = null;
  private onUnauthenticated: (() => void) | undefined;

  constructor(
    private readonly baseUrl: string,
    private readonly app: BrowserAuthApp,
  ) {}

  acceptSession(session: BrowserSession): BrowserSession {
    this.accessToken = session.accessToken;
    return session;
  }

  clear(): void {
    this.accessToken = null;
  }

  setUnauthenticatedHandler(handler: (() => void) | undefined): void {
    this.onUnauthenticated = handler;
  }

  async refresh(): Promise<BrowserSession | null> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: this.app }),
      });
      if (!response.ok) {
        this.clear();
        this.onUnauthenticated?.();
        return null;
      }
      return this.acceptSession(await response.json() as BrowserSession);
    })().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async fetch(input: string, init: RequestInit = {}): Promise<Response> {
    if (!this.accessToken && !(await this.refresh())) {
      return new Response(JSON.stringify({ message: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    let response = await this.authorizedFetch(input, init);
    if (response.status === 401 && await this.refresh()) {
      response = await this.authorizedFetch(input, init);
    }
    if (response.status === 401) this.onUnauthenticated?.();
    return response;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: this.app }),
      });
    } finally {
      this.clear();
    }
  }

  private authorizedFetch(input: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    return fetch(input, { ...init, headers, credentials: 'include' });
  }
}
