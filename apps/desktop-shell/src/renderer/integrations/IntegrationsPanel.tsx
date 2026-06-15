import { useCallback, useEffect, useState } from 'react';
import { Button, Badge, Input, cn } from '@retail-os/ui-react';
import { OdooIntegration } from './OdooIntegration.js';

interface TiendanubeSyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';
  storeId: string | null;
  lastSyncAt: string | null;
  productCount: number;
  error: string | null;
  callbackUrl: string;
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
      tiendanubeConnectDirect(storeId: string, accessToken: string): Promise<TiendanubeSyncState>;
      tiendanubeSync(): Promise<TiendanubeSyncState>;
      tiendanubeDisconnect(): Promise<TiendanubeSyncState>;
      tiendanubeState(): Promise<TiendanubeSyncState>;
      tiendanubeOnCatalogUpdated(handler: (payload: unknown) => void): () => void;
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
  callbackUrl: 'http://localhost:43821/tiendanube/callback',
};

type ConnMode = 'direct' | 'oauth';

export function IntegrationsPanel() {
  const [state, setState] = useState<TiendanubeSyncState>(EMPTY_STATE);
  const [connMode, setConnMode] = useState<ConnMode>('direct');

  // Direct token fields
  const [directStoreId, setDirectStoreId] = useState('');
  const [directToken, setDirectToken] = useState('');

  // OAuth fields
  const [appId, setAppId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    void window.retailIntegrations.tiendanubeState().then(setState);
  }, []);

  const handleConnectDirect = useCallback(async () => {
    if (!directStoreId.trim() || !directToken.trim()) return;
    setState((s) => ({ ...s, status: 'connecting', error: null }));
    const result = await window.retailIntegrations.tiendanubeConnectDirect(directStoreId.trim(), directToken.trim());
    setState(result);
  }, [directStoreId, directToken]);

  const handleConnectOAuth = useCallback(async () => {
    if (!appId.trim() || !clientSecret.trim()) return;
    setState((s) => ({ ...s, status: 'connecting', error: null }));
    const result = await window.retailIntegrations.tiendanubeConnect(appId.trim(), clientSecret.trim());
    setState(result);
  }, [appId, clientSecret]);

  const handleSync = useCallback(async () => {
    setState((s) => ({ ...s, status: 'syncing', error: null }));
    const result = await window.retailIntegrations.tiendanubeSync();
    setState(result);
  }, []);

  const handleDisconnect = useCallback(async () => {
    const result = await window.retailIntegrations.tiendanubeDisconnect();
    setState(result);
    setDirectStoreId('');
    setDirectToken('');
    setAppId('');
    setClientSecret('');
  }, []);

  const isDisconnected = state.status === 'disconnected' || (state.status === 'error' && !state.storeId);

  return (
    <div className="flex flex-col h-full bg-bg overflow-y-auto">
      <div className="flex flex-col gap-4 p-6 max-w-2xl">
        {/* ── Odoo ── */}
        <OdooIntegration />

        {/* ── Tiendanube ── */}
        <div className="rounded-xl border border-line bg-panel overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-[#7B3FE4]/10 border border-[#7B3FE4]/20 flex items-center justify-center text-lg">
                🟣
              </div>
              <div>
                <p className="text-sm font-bold text-text leading-none">Tiendanube</p>
                <p className="text-[11px] text-muted mt-0.5">E-commerce · Catálogo bidireccional</p>
              </div>
            </div>
            <TnBadge status={state.status} />
          </div>

          <div className="px-4 py-4 flex flex-col gap-4">
            <p className="text-xs text-muted">
              Importa tu catálogo desde Tiendanube con variantes, imágenes y stock en tiempo real.
            </p>

            {/* Error */}
            {state.error && (
              <div className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger">
                {state.error}
              </div>
            )}

            {/* ── Connect form ── */}
            {isDisconnected && (
              <div className="flex flex-col gap-3">
                {/* Mode tabs */}
                <div className="flex rounded-lg border border-line bg-panel-2 p-0.5 gap-0.5 self-start">
                  {(['direct', 'oauth'] as ConnMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setConnMode(m)}
                      className={cn(
                        'text-xs font-bold px-3 h-7 rounded-md transition-all',
                        connMode === m
                          ? 'bg-bg text-text shadow-sm border border-line'
                          : 'text-muted hover:text-text',
                      )}
                    >
                      {m === 'direct' ? 'Token directo' : 'OAuth app'}
                    </button>
                  ))}
                </div>

                {connMode === 'direct' ? (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2 text-xs text-muted">
                      Usa esto si tienes una <strong>Aplicación a medida</strong> en el portal de Tiendanube.
                      Ingresa el ID de tienda y el token de acceso generado allí.
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-text">ID de tienda</label>
                      <Input
                        placeholder="ej. 4796783"
                        value={directStoreId}
                        onChange={(e) => setDirectStoreId(e.target.value)}
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-text">Token de acceso</label>
                      <Input
                        type="password"
                        placeholder="Token de tu aplicación a medida"
                        value={directToken}
                        onChange={(e) => setDirectToken(e.target.value)}
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                    <Button
                      disabled={!directStoreId.trim() || !directToken.trim()}
                      onClick={() => void handleConnectDirect()}
                      className="self-start"
                    >
                      Conectar
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-muted">
                      Para apps públicas con client_id y client_secret. La URL de redirección debe ser
                      registrada en el portal de socios:{' '}
                      <code className="bg-panel-2 px-1 rounded font-mono text-[10px]">{state.callbackUrl}</code>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-text">App ID</label>
                      <Input
                        placeholder="Numeric App ID"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-text">Client Secret</label>
                      <Input
                        type="password"
                        placeholder="Client Secret"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                    <Button
                      disabled={!appId.trim() || !clientSecret.trim()}
                      onClick={() => void handleConnectOAuth()}
                      className="self-start"
                    >
                      Autorizar con Tiendanube
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Connecting ── */}
            {state.status === 'connecting' && (
              <div className="flex items-center gap-3 py-1">
                <span className="inline-block size-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span className="text-xs text-muted">Verificando conexión…</span>
                <Button variant="outline" size="sm" onClick={() => void handleDisconnect()}>
                  Cancelar
                </Button>
              </div>
            )}

            {/* ── Connected stats ── */}
            {(state.status === 'connected' || state.status === 'syncing') && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Tienda" value={`#${state.storeId}`} />
                  <Stat label="Productos" value={String(state.productCount)} />
                  <Stat
                    label="Última sync"
                    value={state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleTimeString('es-MX') : 'Nunca'}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    loading={state.status === 'syncing'}
                    disabled={state.status === 'syncing'}
                    onClick={() => void handleSync()}
                    size="sm"
                  >
                    Sincronizar catálogo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={state.status === 'syncing'}
                    onClick={() => void handleDisconnect()}
                  >
                    Desconectar
                  </Button>
                </div>
              </div>
            )}

            {/* ── Error with storeId ── */}
            {state.status === 'error' && state.storeId && (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => void handleSync()}>Reintentar</Button>
                <Button variant="outline" size="sm" onClick={() => void handleDisconnect()}>Desconectar</Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Coming soon cards ── */}
        {[
          { icon: '🟡', name: 'Mercado Libre', sub: 'Marketplace' },
          { icon: '🔵', name: 'Shopify', sub: 'E-commerce' },
        ].map(({ icon, name, sub }) => (
          <div key={name} className="rounded-xl border border-line bg-panel overflow-hidden opacity-60">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-panel-2 border border-line flex items-center justify-center text-lg">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-text leading-none">{name}</p>
                  <p className="text-[11px] text-muted mt-0.5">{sub}</p>
                </div>
              </div>
              <Badge variant="muted">Próximamente</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TnBadge({ status }: { status: TiendanubeSyncState['status'] }) {
  const map: Record<TiendanubeSyncState['status'], { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' }> = {
    disconnected: { label: 'Desconectado', variant: 'muted' },
    connecting: { label: 'Conectando…', variant: 'warning' },
    connected: { label: 'Conectado', variant: 'success' },
    syncing: { label: 'Sincronizando…', variant: 'warning' },
    error: { label: 'Error', variant: 'danger' },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-panel-2 px-3 py-2">
      <span className="text-[10px] font-bold text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm font-black text-text truncate">{value}</span>
    </div>
  );
}
