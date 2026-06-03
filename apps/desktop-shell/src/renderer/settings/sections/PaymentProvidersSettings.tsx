import { useEffect, useState } from 'react';

type ProviderStatus = 'connected' | 'disconnected' | 'pending_oauth' | 'dev_mode';

interface TerminalItem {
  id: string;
  name: string;
  model: string;
  online: boolean;
}

interface ProviderEntry {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: ProviderStatus;
  mode: 'production' | 'development';
  accountId?: string;
  terminals?: TerminalItem[];
}

interface MercadoPagoSyncState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  mode: 'production' | 'development' | null;
  merchantId: string | null;
  terminals: TerminalItem[];
  error: string | null;
}

export function PaymentProvidersSettings() {
  const [providers, setProviders] = useState<ProviderEntry[]>([
    {
      id: 'mercadopago_point',
      name: 'Mercado Pago Point',
      icon: '💳',
      description: 'Terminales fisicos Point Mini, Smart, Air y cobro presencial',
      status: 'disconnected',
      mode: 'development',
    },
    {
      id: 'codi',
      name: 'CoDi',
      icon: '📱',
      description: 'Pagos QR dinamicos via Banxico CoDi',
      status: 'disconnected',
      mode: 'development',
    },
  ]);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [devToken, setDevToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>('mercadopago_point');
  const [showDevInput, setShowDevInput] = useState<string | null>(null);
  const [showOAuthInput, setShowOAuthInput] = useState<string | null>(null);

  useEffect(() => {
    void hydrateMercadoPago();
  }, []);

  function applyMercadoPagoState(state: MercadoPagoSyncState): void {
    const providerStatus: ProviderStatus =
      state.status === 'connecting'
        ? 'pending_oauth'
        : state.status === 'connected'
          ? state.mode === 'development'
            ? 'dev_mode'
            : 'connected'
          : 'disconnected';

    setProviders((prev) =>
      prev.map((provider) =>
        provider.id !== 'mercadopago_point'
          ? provider
          : {
              ...provider,
              status: providerStatus,
              mode: state.mode ?? provider.mode,
              accountId: state.merchantId ?? undefined,
              terminals: state.terminals,
            },
      ),
    );
    setError(state.error);
  }

  async function hydrateMercadoPago(): Promise<void> {
    const state = await window.retailIntegrations.mercadopagoState();
    applyMercadoPagoState(state);
  }

  async function connectDev(providerId: string): Promise<void> {
    if (providerId !== 'mercadopago_point' || !devToken.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const state = await window.retailIntegrations.mercadopagoConnectDev(devToken.trim());
      applyMercadoPagoState(state);
      setDevToken('');
      setShowDevInput(null);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'No se pudo conectar en modo desarrollo.');
    } finally {
      setBusy(false);
    }
  }

  async function startOAuth(providerId: string): Promise<void> {
    if (providerId !== 'mercadopago_point' || !clientId.trim() || !clientSecret.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const state = await window.retailIntegrations.mercadopagoConnect(clientId.trim(), clientSecret.trim());
      applyMercadoPagoState(state);
      if (state.status === 'connected') {
        const refreshed = await window.retailIntegrations.mercadopagoDiscoverTerminals();
        applyMercadoPagoState(refreshed);
      }
      setShowOAuthInput(null);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'No se pudo completar el flujo OAuth.');
    } finally {
      setBusy(false);
    }
  }

  async function discoverTerminals(providerId: string): Promise<void> {
    if (providerId !== 'mercadopago_point') return;
    setBusy(true);
    try {
      const state = await window.retailIntegrations.mercadopagoDiscoverTerminals();
      applyMercadoPagoState(state);
    } catch (discoverError) {
      setError(discoverError instanceof Error ? discoverError.message : 'No se pudieron descubrir terminales.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(providerId: string): Promise<void> {
    if (providerId !== 'mercadopago_point') {
      setProviders((prev) =>
        prev.map((provider) =>
          provider.id === providerId
            ? { ...provider, status: 'disconnected', accountId: undefined, terminals: undefined }
            : provider,
        ),
      );
      return;
    }

    setBusy(true);
    try {
      const state = await window.retailIntegrations.mercadopagoDisconnect();
      applyMercadoPagoState(state);
      setShowDevInput(null);
      setShowOAuthInput(null);
      setClientSecret('');
      setDevToken('');
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'No se pudo desconectar el proveedor.');
    } finally {
      setBusy(false);
    }
  }

  function showOAuthForm(providerId: string): void {
    setShowOAuthInput(providerId);
    setShowDevInput(null);
  }

  function showDevForm(providerId: string): void {
    setShowDevInput(providerId);
    setShowOAuthInput(null);
  }

  return (
    <div className="settings-form">
      <section className="settings-section-group">
        <h2>Proveedores de pago</h2>
        <p className="settings-hint">
          Los comerciantes en produccion se conectan via OAuth y el modo desarrollo permite ingresar un Access Token de pruebas directamente.
        </p>
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            error={provider.id === 'mercadopago_point' ? error : null}
            busy={provider.id === 'mercadopago_point' ? busy : false}
            expanded={expandedId === provider.id}
            showOAuthInput={showOAuthInput === provider.id}
            showDevInput={showDevInput === provider.id}
            clientId={clientId}
            clientSecret={clientSecret}
            devToken={devToken}
            onClientIdChange={setClientId}
            onClientSecretChange={setClientSecret}
            onDevTokenChange={setDevToken}
            onToggleExpand={() => setExpandedId((value) => (value === provider.id ? null : provider.id))}
            onShowOAuthForm={() => showOAuthForm(provider.id)}
            onShowDevInput={() => showDevForm(provider.id)}
            onConnectDev={() => void connectDev(provider.id)}
            onOAuth={() => void startOAuth(provider.id)}
            onDiscover={() => void discoverTerminals(provider.id)}
            onDisconnect={() => void disconnect(provider.id)}
          />
        ))}
      </section>
    </div>
  );
}

function statusLabel(status: ProviderStatus): string {
  return {
    connected: 'Conectado',
    disconnected: 'Desconectado',
    pending_oauth: 'Pendiente OAuth',
    dev_mode: 'Modo Dev',
  }[status];
}

function statusColor(status: ProviderStatus): string {
  return { connected: 'ok', disconnected: 'off', pending_oauth: 'warn', dev_mode: 'dev' }[status];
}

function ProviderCard({
  provider,
  error,
  busy,
  expanded,
  showOAuthInput,
  showDevInput,
  clientId,
  clientSecret,
  devToken,
  onClientIdChange,
  onClientSecretChange,
  onDevTokenChange,
  onToggleExpand,
  onShowOAuthForm,
  onShowDevInput,
  onConnectDev,
  onOAuth,
  onDiscover,
  onDisconnect,
}: {
  provider: ProviderEntry;
  error: string | null;
  busy: boolean;
  expanded: boolean;
  showOAuthInput: boolean;
  showDevInput: boolean;
  clientId: string;
  clientSecret: string;
  devToken: string;
  onClientIdChange(value: string): void;
  onClientSecretChange(value: string): void;
  onDevTokenChange(value: string): void;
  onToggleExpand(): void;
  onShowOAuthForm(): void;
  onShowDevInput(): void;
  onConnectDev(): void;
  onOAuth(): void;
  onDiscover(): void;
  onDisconnect(): void;
}) {
  const isActive = provider.status === 'connected' || provider.status === 'dev_mode';
  return (
    <div className={`provider-card${expanded ? ' expanded' : ''}`}>
      <button className="provider-card-header" onClick={onToggleExpand}>
        <span className="provider-icon">{provider.icon}</span>
        <div className="provider-info">
          <strong>{provider.name}</strong>
          <span className="provider-desc">{provider.description}</span>
        </div>
        <span className={`provider-status ${statusColor(provider.status)}`}>{statusLabel(provider.status)}</span>
        <span className="expand-arrow">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="provider-card-body">
          {error && <p className="settings-hint">Error: {error}</p>}
          {isActive ? (
            <div className="provider-active-info">
              {provider.accountId && (
                <p>
                  <strong>Cuenta:</strong> {provider.accountId}
                </p>
              )}
              <p>
                <strong>Terminales:</strong> {provider.terminals?.length ?? 0}
              </p>
              <p>
                <strong>Modo:</strong> {provider.mode === 'development' ? '🧪 Desarrollo' : '🏭 Produccion'}
              </p>
              {!!provider.terminals?.length && (
                <div className="terminal-list">
                  {provider.terminals.map((terminal) => (
                    <div className={`terminal-card${terminal.online ? ' running' : ''}`} key={terminal.id}>
                      <div className="terminal-card-info">
                        <span className="terminal-icon">🏧</span>
                        <div>
                          <strong>{terminal.name}</strong>
                          <span className="terminal-id">{terminal.id}</span>
                          <span className="terminal-model">{terminal.model}</span>
                        </div>
                      </div>
                      <span className={`terminal-status${terminal.online ? ' running' : ''}`}>
                        {terminal.online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="provider-actions">
                <button className="settings-btn-secondary" disabled={busy} onClick={onDiscover}>
                  Descubrir terminales
                </button>
                <button className="settings-btn-secondary" disabled={busy} onClick={onDisconnect}>
                  Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="provider-connect-options">
              <button className="settings-btn-primary" disabled={busy} onClick={onShowOAuthForm}>
                🔐 Conectar con OAuth (Produccion)
              </button>
              {showOAuthInput && (
                <div className="dev-token-input">
                  <label>
                    Client ID
                    <input
                      type="text"
                      placeholder="APP_USR-xxxxxxxx"
                      value={clientId}
                      onChange={(event) => onClientIdChange(event.target.value)}
                    />
                  </label>
                  <label>
                    Client Secret
                    <input
                      type="password"
                      placeholder="Client Secret"
                      value={clientSecret}
                      onChange={(event) => onClientSecretChange(event.target.value)}
                    />
                  </label>
                  <button
                    className="settings-btn-primary"
                    disabled={busy || !clientId.trim() || !clientSecret.trim()}
                    onClick={onOAuth}
                  >
                    {busy ? 'Conectando...' : 'Iniciar OAuth'}
                  </button>
                </div>
              )}
              <button className="settings-btn-secondary" disabled={busy} onClick={onShowDevInput}>
                🧪 Usar Access Token de prueba (Dev)
              </button>
              {showDevInput && (
                <div className="dev-token-input">
                  <label>
                    Access Token de prueba
                    <input
                      type="password"
                      placeholder="TEST-xxxxxxxxxxxx"
                      value={devToken}
                      onChange={(event) => onDevTokenChange(event.target.value)}
                    />
                  </label>
                  <button className="settings-btn-primary" disabled={busy || !devToken.trim()} onClick={onConnectDev}>
                    {busy ? 'Conectando...' : 'Conectar en modo dev'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
