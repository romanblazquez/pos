/**
 * Payment provider connection management types.
 *
 * Production merchants connect via OAuth; developers use test credentials.
 * Tokens are stored encrypted at rest (the shell holds the encryption key;
 * the API holds encrypted blobs). The POS renderer never sees credentials.
 */
export type ProviderConnectionStatus = 'active' | 'expired' | 'error' | 'pending_oauth' | 'disconnected';

export interface ProviderConnection {
  id: string;
  merchantId: string;
  provider: string;               // 'mercadopago_point' | 'codi' | …
  mode: 'production' | 'development';
  status: ProviderConnectionStatus;
  /** Encrypted at rest — only the backend decrypts for API calls. */
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  tokenExpiresAt?: string;
  /** OAuth application identifiers. */
  clientId?: string;
  scope?: string;
  /** MP-specific: the merchant's MP account id after OAuth. */
  providerAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalAssignment {
  id: string;
  merchantId: string;
  storeId: string;
  provider: string;
  terminalId: string;
  terminalName: string;
  terminalModel?: string;   // 'Point Mini' | 'Point Smart' | 'Point Air' | 'VTERM'
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A terminal as returned by Mercado Pago's Devices API. */
export interface DiscoveredTerminal {
  terminalId: string;
  name: string;
  model: string;
  serialNumber?: string;
  storeId?: string;
  online: boolean;
}

export interface OAuthStartPayload {
  provider: string;
  merchantId: string;
  redirectUri: string;
  mode: 'production' | 'development';
}

export interface OAuthCallbackPayload {
  provider: string;
  code: string;
  state: string;
  merchantId: string;
}

export interface ProviderTestResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/** Registered settings section injected by a module. */
export interface SettingsSection {
  id: string;
  moduleId: string;
  label: string;
  icon: string;
  /** Angular/React route within the settings app. */
  route: string;
  /** Permission required to view this section. */
  permission?: string;
}
