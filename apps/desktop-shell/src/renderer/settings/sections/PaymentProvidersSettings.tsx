import { useState } from 'react';

type ProviderStatus = 'connected' | 'disconnected' | 'pending_oauth' | 'dev_mode';

interface ProviderEntry {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: ProviderStatus;
  mode: 'production' | 'development';
  accountId?: string;
  terminals?: number;
}

/**
 * PaymentProvidersSettings — connect/disconnect payment providers, switch
 * between dev and production mode, discover terminals, assign them to stores.
 * The OAuth redirect opens the MP authorization page in a browser; on return
 * the backend exchanges the code for tokens (never exposed to the renderer).
 */
export function PaymentProvidersSettings() {
  const [providers, setProviders] = useState<ProviderEntry[]>([
    {
      id: 'mercadopago_point',
      name: 'Mercado Pago Point',
      icon: '💳',
      description: 'Terminales físicos Point Mini, Smart, Air y cobro presencial',
      status: 'disconnected',
      mode: 'development',
    },
    {
      id: 'codi',
      name: 'CoDi',
      icon: '📱',
      description: 'Pagos QR dinámicos vía Banxico CoDi',
      status: 'disconnected',
      mode: 'development',
    },
  ]);
  const [devToken, setDevToken] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('mercadopago_point');
  const [showDevInput, setShowDevInput] = useState<string | null>(null);

  function connectDev(providerId: string) {
    if (!devToken.trim()) return;
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? { ...p, status: 'dev_mode', mode: 'development', accountId: 'dev-account', terminals: 1 }
          : p,
      ),
    );
    setDevToken('');
    setShowDevInput(null);
    // TODO: POST /payments/mercadopago/dev-credentials to the API
  }

  function startOAuth(providerId: string) {
    // TODO: GET /payments/mercadopago/auth-url → open in external browser
    // On callback, the backend exchanges code, stores token, and the UI
    // polls or receives an SSE event to update the status.
    alert(`OAuth flow for ${providerId} — configure MERCADOPAGO_CLIENT_ID in the API first.`);
  }

  function disconnect(providerId: string) {
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, status: 'disconnected', accountId: undefined, terminals: undefined } : p)),
    );
  }

  return (
    <div className="settings-form">
      <section className="settings-section-group">
        <h2>Proveedores de pago</h2>
        <p className="settings-hint">
          Los comerciantes en producción se conectan via OAuth — nunca ingresan credenciales manualmente.
          El modo desarrollo permite ingresar un Access Token de pruebas directamente.
        </p>
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            expanded={expandedId === provider.id}
            showDevInput={showDevInput === provider.id}
            devToken={devToken}
            onDevTokenChange={setDevToken}
            onToggleExpand={() => setExpandedId((v) => (v === provider.id ? null : provider.id))}
            onShowDevInput={() => setShowDevInput(provider.id)}
            onConnectDev={() => connectDev(provider.id)}
            onOAuth={() => startOAuth(provider.id)}
            onDisconnect={() => disconnect(provider.id)}
          />
        ))}
      </section>
    </div>
  );
}

function statusLabel(status: ProviderStatus): string {
  return { connected: 'Conectado', disconnected: 'Desconectado', pending_oauth: 'Pendiente OAuth', dev_mode: 'Modo Dev' }[status];
}
function statusColor(status: ProviderStatus): string {
  return { connected: 'ok', disconnected: 'off', pending_oauth: 'warn', dev_mode: 'dev' }[status];
}

function ProviderCard({
  provider, expanded, showDevInput, devToken,
  onDevTokenChange, onToggleExpand, onShowDevInput, onConnectDev, onOAuth, onDisconnect,
}: {
  provider: ProviderEntry; expanded: boolean; showDevInput: boolean; devToken: string;
  onDevTokenChange(v: string): void; onToggleExpand(): void; onShowDevInput(): void;
  onConnectDev(): void; onOAuth(): void; onDisconnect(): void;
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
          {isActive ? (
            <div className="provider-active-info">
              {provider.accountId && <p><strong>Cuenta:</strong> {provider.accountId}</p>}
              {provider.terminals !== undefined && <p><strong>Terminales:</strong> {provider.terminals}</p>}
              <p><strong>Modo:</strong> {provider.mode === 'development' ? '🧪 Desarrollo' : '🏭 Producción'}</p>
              <div className="provider-actions">
                <button className="settings-btn-secondary" onClick={onDisconnect}>Desconectar</button>
              </div>
            </div>
          ) : (
            <div className="provider-connect-options">
              <button className="settings-btn-primary" onClick={onOAuth}>
                🔐 Conectar con OAuth (Producción)
              </button>
              <button className="settings-btn-secondary" onClick={onShowDevInput}>
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
                      onChange={(e) => onDevTokenChange(e.target.value)}
                    />
                  </label>
                  <button className="settings-btn-primary" disabled={!devToken.trim()} onClick={onConnectDev}>
                    Conectar en modo dev
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
