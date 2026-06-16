// Tiendanube (Nuvemshop) REST API v1 client.
// Docs: https://tiendanube.github.io/api-documentation/

export interface TiendanubeCredentials {
  accessToken: string;
  storeId: string;
  userId: string;
}

export interface TnProduct {
  id: number;
  name: Record<string, string>;           // { es: 'name', pt: 'nome', ... }
  description: Record<string, string>;
  images: { id: number; src: string; position: number }[];
  variants: TnVariant[];
  categories: { id: number; name: Record<string, string> }[];
  tags: string;                           // comma-separated string
  brand?: string;
  handle?: string;
  canonical_url?: string;
  free_shipping?: boolean;
  requires_shipping?: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface TnVariant {
  id: number;
  product_id: number;
  price: string;              // decimal string e.g. "4200.00"
  compare_at_price: string | null;
  stock_management: boolean;
  stock: number | null;
  sku: string | null;
  weight?: string | null;     // kg, decimal string
  depth?: string | null;
  height?: string | null;
  width?: string | null;
  cost?: string | null;       // COGS, decimal string
  values: { es?: string; [lang: string]: string | undefined }[];
}

export interface TnStore {
  id: number;
  name: string;
  url: string;
  main_currency: string;  // e.g. "ARS", "MXN", "BRL"
  country: string;
}

export interface TnWebhook {
  id: number;
  url: string;
  event: string;
  created_at: string;
}

const BASE = 'https://api.tiendanube.com/v1';
const APP_USER_AGENT = 'BoardGameMarket/1.0 (soporte@boardgamemarket.com)';

export class TiendanubeClient {
  constructor(private readonly creds: TiendanubeCredentials) {}

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ data: T; headers: Headers }> {
    const res = await fetch(`${BASE}/${this.creds.storeId}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.creds.accessToken}`,
        'User-Agent': APP_USER_AGENT,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      // Rate-limited: respect Retry-After header, then retry once
      const retryAfter = Number(res.headers.get('Retry-After') ?? 5) * 1000;
      await new Promise((r) => setTimeout(r, retryAfter));
      return this.req<T>(method, path, body, extraHeaders);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const url = `${BASE}/${this.creds.storeId}${path}`;
      throw new Error(`Tiendanube ${method} ${url} → ${res.status}: ${text}`);
    }

    const data = await res.json() as T;
    return { data, headers: res.headers };
  }

  async getStore(): Promise<TnStore> {
    const { data } = await this.req<TnStore>('GET', '/store');
    return data;
  }

  async getProducts(
    page = 1,
    perPage = 200,
  ): Promise<{ products: TnProduct[]; nextPage: number | null }> {
    const { data: products, headers } = await this.req<TnProduct[]>(
      'GET',
      `/products?page=${page}&per_page=${perPage}&published=true`,
    );

    // Tiendanube uses Link header for pagination: <url>; rel="next"
    const link = headers.get('Link') ?? '';
    const hasNext = link.includes('rel="next"');

    return { products, nextPage: hasNext ? page + 1 : null };
  }

  async getVariants(productId: number): Promise<TnVariant[]> {
    const { data } = await this.req<TnVariant[]>('GET', `/products/${productId}/variants`);
    return data;
  }

  async registerWebhook(event: string, url: string): Promise<TnWebhook> {
    const { data } = await this.req<TnWebhook>('POST', '/webhooks', { url, event });
    return data;
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    await this.req<unknown>('DELETE', `/webhooks/${webhookId}`);
  }

  async listWebhooks(): Promise<TnWebhook[]> {
    const { data } = await this.req<TnWebhook[]>('GET', '/webhooks');
    return data;
  }
}
