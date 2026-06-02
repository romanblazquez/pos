import { useState } from 'react';

type EmulatorStatus = 'running' | 'stopped';

interface VirtualTerminal {
  id: string;
  name: string;
  model: string;
  status: EmulatorStatus;
  activeOrder?: string;
}

/**
 * DeveloperSettings — emulator management, virtual terminals, webhook simulation.
 * Only visible in RETAIL_DEV_MODE. In production builds this section is hidden.
 */
export function DeveloperSettings() {
  const [terminals, setTerminals] = useState<VirtualTerminal[]>([
    { id: 'VTERM-001', name: 'Virtual Point Mini', model: 'Point Mini', status: 'stopped' },
  ]);
  const [newTerminalName, setNewTerminalName] = useState('');

  function addTerminal() {
    if (!newTerminalName.trim()) return;
    const id = `VTERM-${String(terminals.length + 1).padStart(3, '0')}`;
    setTerminals((prev) => [
      ...prev,
      { id, name: newTerminalName.trim(), model: 'Point Mini', status: 'stopped' },
    ]);
    setNewTerminalName('');
  }

  function toggleTerminal(id: string) {
    setTerminals((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'running' ? 'stopped' : 'running' } : t)),
    );
  }

  return (
    <div className="settings-form">
      <div className="dev-mode-banner">
        🛠️ Modo desarrollador activo — estas herramientas no están disponibles en producción
      </div>

      <section className="settings-section-group">
        <h2>Terminales virtuales (Emulador MP Point)</h2>
        <p className="settings-hint">
          Los terminales virtuales emulan el ciclo de vida de un Point físico: reciben órdenes,
          permiten simular inserción de tarjeta, aprobación, rechazo, timeout y errores de red.
          El POS no sabe si está conectado a un terminal real o virtual.
        </p>
        <div className="terminal-list">
          {terminals.map((t) => (
            <div key={t.id} className={`terminal-card ${t.status}`}>
              <div className="terminal-card-info">
                <span className="terminal-icon">🖥️</span>
                <div>
                  <strong>{t.name}</strong>
                  <span className="terminal-id">{t.id}</span>
                  <span className="terminal-model">{t.model}</span>
                </div>
              </div>
              <div className="terminal-card-actions">
                <span className={`terminal-status ${t.status}`}>
                  {t.status === 'running' ? '● Activo' : '○ Inactivo'}
                </span>
                <button
                  className={t.status === 'running' ? 'settings-btn-secondary' : 'settings-btn-primary'}
                  onClick={() => toggleTerminal(t.id)}
                >
                  {t.status === 'running' ? 'Detener' : 'Iniciar'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="add-terminal-form">
          <input
            value={newTerminalName}
            onChange={(e) => setNewTerminalName(e.target.value)}
            placeholder="Nombre del terminal virtual"
            onKeyDown={(e) => e.key === 'Enter' && addTerminal()}
          />
          <button className="settings-btn-primary" onClick={addTerminal} disabled={!newTerminalName.trim()}>
            + Agregar terminal
          </button>
        </div>
      </section>

      <section className="settings-section-group">
        <h2>Simulación de webhooks</h2>
        <p className="settings-hint">
          Simula pagos con diferentes resultados para probar el ciclo completo del POS sin hardware.
        </p>
        <div className="webhook-actions">
          <WebhookSimButton label="Simular pago aprobado" status="approved" />
          <WebhookSimButton label="Simular pago rechazado" status="rejected" />
          <WebhookSimButton label="Simular timeout" status="timeout" />
          <WebhookSimButton label="Simular webhook duplicado" status="approved" duplicate />
        </div>
      </section>

      <section className="settings-section-group">
        <h2>Entorno y variables</h2>
        <div className="env-table">
          <EnvRow name="RETAIL_DEV_MODE" value="true" />
          <EnvRow name="MERCADOPAGO_ENV" value="test" />
          <EnvRow name="PAYMENT_PROVIDER" value="mercadopago-point-emulator" />
          <EnvRow name="API_BASE_URL" value="http://localhost:3000" />
        </div>
      </section>
    </div>
  );
}

function WebhookSimButton({
  label, status: _status, duplicate = false,
}: { label: string; status: string; duplicate?: boolean }) {
  const [sent, setSent] = useState(false);
  const handleClick = () => {
    // TODO: call emulator API to trigger webhook simulation
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };
  return (
    <button
      className={`webhook-sim-btn${sent ? ' sent' : ''}`}
      onClick={handleClick}
    >
      {sent ? '✓ Enviado' : label}{duplicate ? ' (duplicado)' : ''}
    </button>
  );
}

function EnvRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="env-row">
      <code className="env-name">{name}</code>
      <code className="env-value">{value}</code>
    </div>
  );
}
