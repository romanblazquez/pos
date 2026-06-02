import { useState } from 'react';
import type { StepProps } from '../OnboardingWizard.js';
import type { ConnectedProvider } from '@retail-os/onboarding';

const AVAILABLE_PROVIDERS = [
  { id: 'mercadopago_point', name: 'Mercado Pago Point', icon: '💳', description: 'Terminales físicos y virtuales' },
  { id: 'codi', name: 'CoDi', icon: '📱', description: 'Pagos QR dinámicos Banxico' },
  { id: 'spei', name: 'SPEI', icon: '🏦', description: 'Transferencias SPEI', comingSoon: true },
];

export function StepPaymentProviders({ data, onNext, onBack }: StepProps) {
  const [connected, setConnected] = useState<ConnectedProvider[]>(data.connectedProviders ?? []);
  const [mpToken, setMpToken] = useState('');
  const [showMpInput, setShowMpInput] = useState(false);

  function connectMp() {
    if (!mpToken.trim()) return;
    setConnected((prev) => [
      ...prev.filter((p) => p.id !== 'mercadopago_point'),
      { id: 'mercadopago_point', name: 'Mercado Pago Point', status: 'connected', mode: 'development' },
    ]);
    setMpToken('');
    setShowMpInput(false);
  }

  function disconnectProvider(id: string) {
    setConnected((prev) => prev.filter((p) => p.id !== id));
  }

  const isConnected = (id: string) => connected.some((p) => p.id === id);

  return (
    <div className="wizard-step-form">
      <p className="wizard-hint">
        Conecta al menos un método de pago para empezar a cobrar. Puedes agregar más después en Configuración → Pagos.
      </p>
      {AVAILABLE_PROVIDERS.map((provider) => {
        const connected_ = isConnected(provider.id);
        return (
          <div key={provider.id} className={`wizard-provider-item${connected_ ? ' connected' : ''}${'comingSoon' in provider && provider.comingSoon ? ' soon' : ''}`}>
            <span className="wizard-provider-icon">{provider.icon}</span>
            <div className="wizard-provider-info">
              <strong>{provider.name}</strong>
              <span>{provider.description}</span>
            </div>
            {'comingSoon' in provider && provider.comingSoon ? (
              <span className="soon-badge">Próximamente</span>
            ) : connected_ ? (
              <button className="wizard-btn-small wizard-btn-danger" onClick={() => disconnectProvider(provider.id)}>Desconectar</button>
            ) : provider.id === 'mercadopago_point' ? (
              <button className="wizard-btn-small" onClick={() => setShowMpInput(!showMpInput)}>Conectar</button>
            ) : (
              <button className="wizard-btn-small" disabled>Conectar</button>
            )}
          </div>
        );
      })}
      {showMpInput && (
        <div className="wizard-dev-token">
          <label>Access Token de prueba (TEST-xxx...)
            <input type="password" value={mpToken} onChange={(e) => setMpToken(e.target.value)}
              placeholder="TEST-xxxxxxxxxxxx" />
          </label>
          <button className="wizard-btn-primary" disabled={!mpToken.trim()} onClick={connectMp}>
            Conectar en modo dev
          </button>
        </div>
      )}
      <div className="wizard-actions">
        <button className="wizard-btn-secondary" onClick={onBack}>← Atrás</button>
        <button className="wizard-btn-secondary" onClick={() => onNext({ connectedProviders: connected })}>
          Omitir por ahora
        </button>
        <button className="wizard-btn-primary" disabled={connected.length === 0}
          onClick={() => onNext({ connectedProviders: connected })}>
          Continuar →
        </button>
      </div>
    </div>
  );
}
