import type {
  ConnectorCapabilities,
  ConnectorCredentials,
  ExternalOrderStatus,
  HealthCheck,
  OAuthStartResult,
  OrderConfirmation,
  PingResult,
  PriceItem,
  RawProduct,
  ReservationRequest,
  ReservationResult,
  SellerOrderId,
  StockItem,
  WebhookRegistration,
} from './types.js';

/**
 * Every external platform connector must implement this interface.
 * The platform only talks to seller systems through connectors — never directly.
 *
 * Optional methods (marked with ?) are only called when getCapabilities()
 * reports the corresponding flag as true.
 */
export interface IConnector {
  // ─── Identity ────────────────────────────────────────────────────────────
  readonly connectorType: string;
  getCapabilities(): ConnectorCapabilities;

  // ─── Auth ─────────────────────────────────────────────────────────────────
  /** Returns an OAuth URL to redirect the seller to, plus a CSRF state token. */
  startOAuth(sellerId: string, redirectUri: string): Promise<OAuthStartResult>;

  /** Exchange an OAuth callback code for credentials. */
  exchangeCode(
    sellerId: string,
    code: string,
    state: string,
  ): Promise<ConnectorCredentials>;

  /** Validate that stored credentials still work. */
  validateCredentials(sellerId: string): Promise<HealthCheck>;

  /** Refresh credentials when token is expiring. */
  refreshCredentials(
    sellerId: string,
  ): Promise<ConnectorCredentials>;

  // ─── Catalog ──────────────────────────────────────────────────────────────
  /** Returns an async generator that yields product pages for pagination. */
  fetchCatalog(
    sellerId: string,
    cursor?: string,
  ): AsyncGenerator<RawProduct[]>;

  // ─── Inventory ────────────────────────────────────────────────────────────
  /** Fetch current stock for given external IDs (or all if skus is empty). */
  fetchInventory(sellerId: string, externalIds?: string[]): Promise<StockItem[]>;

  /** Register a webhook so the seller system pushes inventory changes to us. */
  subscribeInventory?(
    sellerId: string,
    callbackUrl: string,
  ): Promise<WebhookRegistration>;

  unsubscribeInventory?(sellerId: string, webhookId: string): Promise<void>;

  // ─── Prices ───────────────────────────────────────────────────────────────
  fetchPrices(sellerId: string, externalIds?: string[]): Promise<PriceItem[]>;

  // ─── Reservation (optional) ───────────────────────────────────────────────
  reserveStock?(
    sellerId: string,
    req: ReservationRequest,
  ): Promise<ReservationResult>;

  releaseReservation?(
    sellerId: string,
    reservationId: string,
  ): Promise<void>;

  // ─── Orders ───────────────────────────────────────────────────────────────
  confirmOrder(
    sellerId: string,
    order: OrderConfirmation,
  ): Promise<SellerOrderId>;

  fetchOrderStatus(
    sellerId: string,
    externalOrderId: string,
  ): Promise<ExternalOrderStatus>;

  // ─── Health ───────────────────────────────────────────────────────────────
  ping(sellerId: string): Promise<PingResult>;
}
