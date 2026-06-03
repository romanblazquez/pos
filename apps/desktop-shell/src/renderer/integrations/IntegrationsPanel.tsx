import { useCallback, useEffect, useState } from 'react';

interface TiendanubeSyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';
  storeId: string | null;
  lastSyncAt: string | null;
  productCount: number;
  error: string | null;
}

interface MercadoPagoSyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  mode: 'production' | 'development' | null;
  merchantId: string | null;
  terminals: Array<{ id: string; name: string; model: string; online: boolean }>;
  error: string | null;
}

declare global {
  interface Window {
    retailIntegrations: {
      tiendanubeConnect(appId: string, clientSecret: string): Promise<TiendanubeSyncState>;
      tiendanubeSync(): Promise<TiendanubeSyncState>;
      tiendanubeDisconnect(): Promise<TiendanubeSyncState>;
      tiendanubeState(): Promise<TiendanubeSyncState>;
      mercadopagoConnect(clientId: string, clientSecret: string): Promise<MercadoPagoSyncState>;
      mercadopagoConnectDev(accessToken: string): Promise<MercadoPagoSyncState>;
      mercadopagoDisconnect(): Promise<MercadoPagoSyncState>;
      mercadopagoDiscoverTerminals(): Promise<MercadoPagoSyncState>;
      mercadopagoState(): Promise<MercadoPagoSyncState>;
    };
  }
}

const EMPTY_STATE: TiendanubeSyncState = {
  status: 'disconnected',
  storeId: null,
  lastSyncAt: null,
  productCount: 0,
  error: null,
};

export function IntegrationsPanel() {
  const [state, setState] = useState<TiendanubeSyncState>(EMPTY_STATE);
  const [appId, setAppId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    void window.retailIntegrations.tiendanubeState().then(setState);
  }, []);

  const handleConnect = useCallback(async () => {
    if (!appId.trim() || !clientSecret.trim()) return;
    const result = await window.retailIntegrations.tiendanubeConnect(appId.trim(), clientSecret.trim());
    setState(result);
  }, [appId, clientSecret]);

  const handleSync = useCallback(async () => {
    const result = await window.retailIntegrations.tiendanubeSync();
    setState(result);
  }, []);

  const handleDisconnect = useCallback(async () => {
    const result = await window.retailIntegrations.tiendanubeDisconnect();
    setState(result);
    setAppId('');
    setClientSecret('');
  }, []);

  return (
    <div className="integrations-shell">
      <header className="integrations-header">
        <span className="integrations-logo">🔗</span>
        <div>
          <h1>Integraciones</h1>
          <p>Conecta plataformas externas para importar y sincronizar datos.</p>
        </div>
      </header>

      <div className="integrations-grid">
        <div className="provider-card">
          <div className="provider-card-header">
            <div className="provider-brand">
              <span className="provider-icon">🟣</span>
              <div>
                <strong>Tiendanube</strong>
                <span className="provider-subtitle">E-commerce</span>
              </div>
            </div>
            <StatusBadge status={state.status} />
          </div>

          <p className="provider-description">
            Importa tu catalogo de productos desde Tiendanube y mantenlo sincronizado con el punto de venta.
          </p>

          {state.error && (
            <div className="provider-error">
              <span>Error:</span> {state.error}
            </div>
          )}

          {state.status === 'disconnected' && (
            <div className="provider-connect-form">
              <label>
                App ID
                <input
                  type="text"
                  placeholder="Tu App ID de Tiendanube"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
              </label>
              <label>
                Client Secret
                <input
                  type="password"
                  placeholder="Tu Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </label>
              <button
                className="provider-btn-primary"
                disabled={!appId.trim() || !clientSecret.trim()}
                onClick={handleConnect}
              >
                Conectar con Tiendanube
              </button>
              <p className="provider-hint">
                Necesitas una app creada en el portal de Partners de Tiendanube.
                Al conectar se abrira el navegador para autorizar el acceso.
              </p>
            </div>
          )}

          {state.status === 'connecting' && (
            <div className="provider-status-message">
              <span className="spinner" />
              Esperando autorizacion en el navegador...
            </div>
          )}

          {(state.status === 'connected' || state.status === 'syncing') && (
            <div className="provider-connected">
              <div className="provider-stats">
                <div className="provider-stat">
                  <span className="provider-stat-label">Tienda</span>
                  <span className="provider-stat-value">#{state.storeId}</span>
                </div>
                <div className="provider-stat">
                  <span className="provider-stat-label">Productos</span>
                  <span className="provider-stat-value">{state.productCount}</span>
                </div>
                <div className="provider-stat">
                  <span className="provider-stat-label">Ultima sincronizacion</span>
                  <span className="provider-stat-value">
                    {state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString('es-MX') : 'Nunca'}
                  </span>
                </div>
              </div>

              <div className="provider-actions">
                <button
                  className="provider-btn-primary"
                  disabled={state.status === 'syncing'}
                  onClick={handleSync}
                >
                  {state.status === 'syncing' ? 'Sincronizando...' : 'Sincronizar'}
                </button>
                <button
                  className="provider-btn-danger"
                  disabled={state.status === 'syncing'}
                  onClick={handleDisconnect}
                >
                  Desconectar
                </button>
              </div>
            </div>
          )}

          {state.status === 'error' && state.storeId && (
            <div className="provider-actions">
              <button className="provider-btn-primary" onClick={handleSync}>
                Reintentar
              </button>
              <button className="provider-btn-danger" onClick={handleDisconnect}>
                Desconectar
              </button>
            </div>
          )}
        </div>

        <div className="provider-card provider-card-coming-soon">
          <div className="provider-card-header">
            <div className="provider-brand">
              <span className="provider-icon">🟡</span>
              <div>
                <strong>Mercado Libre</strong>
                <span className="provider-subtitle">Marketplace</span>
              </div>
            </div>
            <span className="status-badge badge-roadmap">Proximamente</span>
          </div>
          <p className="provider-description">
            Sincroniza inventario y precios con tu cuenta de Mercado Libre.
          </p>
        </div>

        <div className="provider-card provider-card-coming-soon">
          <div className="provider-card-header">
            <div className="provider-brand">
              <span className="provider-icon">🔵</span>
              <div>
                <strong>Shopify</strong>
                <span className="provider-subtitle">E-commerce</span>
              </div>
            </div>
            <span className="status-badge badge-roadmap">Proximamente</span>
          </div>
          <p className="provider-description">
            Importa productos y ordenes desde tu tienda Shopify.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TiendanubeSyncState['status'] }) {
  const labels: Record<TiendanubeSyncState['status'], string> = {
    disconnected: 'Desconectado',
    connecting: 'Conectando',
    connected: 'Conectado',
    syncing: 'Sincronizando',
    error: 'Error',
  };
  const classes: Record<TiendanubeSyncState['status'], string> = {
    disconnected: 'badge-muted',
    connecting: 'badge-warn',
    connected: 'badge-success',
    syncing: 'badge-warn',
    error: 'badge-danger',
  };
  return <span className={`status-badge ${classes[status]}`}>{labels[status]}</span>;
}
