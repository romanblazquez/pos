import { useCallback, useEffect, useState } from 'react';
import { Button, Badge, Input } from '@retail-os/ui-react';
import type { OdooBridgeConfig, OdooBridgeState } from '../shell-bridge.js';

type OdooConfig = OdooBridgeConfig;
type OdooState = OdooBridgeState;

const DEFAULT_CONFIG: OdooConfig = {
  url: 'http://localhost:8069',
  database: 'odoo',
  username: 'admin',
  password: '',
  pollIntervalMs: 60000,
  catalogSource: 'odoo',
};

const STATUS_MAP: Record<OdooState['status'], { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' }> = {
  connected:     { label: 'Conectado',       variant: 'success'  },
  connecting:    { label: 'Conectando…',     variant: 'warning'  },
  syncing:       { label: 'Sincronizando…',  variant: 'warning'  },
  disconnected:  { label: 'Desconectado',    variant: 'muted'    },
  error:         { label: 'Error',           variant: 'danger'   },
};

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
    </svg>
  );
}

export function OdooIntegration() {
  const odoo = window.retailOdoo;
  const hasShell = !!odoo;

  const [state, setState] = useState<OdooState | null>(null);
  const [config, setConfig] = useState<OdooConfig>(DEFAULT_CONFIG);
  const [connecting, setConnecting] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [syncingInventory, setSyncingInventory] = useState(false);

  useEffect(() => {
    if (!odoo) return;
    void odoo.getState().then(setState);
    return odoo.onStateChanged(setState);
  }, [odoo]);

  const connected = state?.status === 'connected' || state?.status === 'syncing';

  const handleConnect = useCallback(async () => {
    if (!odoo || connecting) return;
    setConnecting(true);
    try { await odoo.connect(config); } finally { setConnecting(false); }
  }, [odoo, config, connecting]);

  const handleDisconnect = useCallback(async () => {
    if (!odoo) return;
    await odoo.disconnect();
  }, [odoo]);

  const handleSyncCatalog = useCallback(async () => {
    if (!odoo || syncingCatalog) return;
    setSyncingCatalog(true);
    try { await odoo.syncCatalog(); } finally { setSyncingCatalog(false); }
  }, [odoo, syncingCatalog]);

  const handleSyncInventory = useCallback(async () => {
    if (!odoo || syncingInventory) return;
    setSyncingInventory(true);
    try { await odoo.syncInventory(); } finally { setSyncingInventory(false); }
  }, [odoo, syncingInventory]);

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden">
      {/* ── Card header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
            🟢
          </div>
          <div>
            <p className="text-sm font-bold text-text leading-none">Odoo ERP</p>
            <p className="text-[11px] text-muted mt-0.5">ERP · Inventario · Clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state && <Badge variant={STATUS_MAP[state.status].variant}>{STATUS_MAP[state.status].label}</Badge>}
          {state?.version && <Badge variant="muted">v{state.version}</Badge>}
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Description */}
        <p className="text-xs text-muted">
          {connected && state?.database
            ? `${state.database} · ${state.url}`
            : 'Catálogo, inventario y clientes en tiempo real vía EWP (ERP Workspace Protocol).'}
          {connected && state?.lastSyncAt && (
            <> · Sync {new Date(state.lastSyncAt).toLocaleTimeString('es-MX')}</>
          )}
        </p>

        {/* Error */}
        {state?.error && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger">
            {state.error}
          </div>
        )}

        {/* Pending exports warning */}
        {connected && ((state?.pendingSaleExports ?? 0) > 0 || (state?.failedSaleExports ?? 0) > 0) && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            {state!.pendingSaleExports} ventas pendientes de exportar a Odoo
            {(state?.failedSaleExports ?? 0) > 0 && <> · {state!.failedSaleExports} con error</>}
          </div>
        )}

        {/* No-shell warning */}
        {!hasShell && (
          <div className="rounded-lg bg-warn/10 border border-warn/30 px-3 py-2 text-xs text-warn">
            Requiere el shell de escritorio para activar el puente EWP.
          </div>
        )}

        {/* ── Connect form ── */}
        {hasShell && !connected && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text">URL de Odoo</label>
              <Input
                type="url"
                placeholder="http://localhost:8069"
                value={config.url}
                onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
                className="h-9 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text">Base de datos</label>
                <Input
                  placeholder="odoo"
                  value={config.database}
                  onChange={(e) => setConfig((c) => ({ ...c, database: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text">Usuario</label>
                <Input
                  placeholder="admin"
                  value={config.username}
                  onChange={(e) => setConfig((c) => ({ ...c, username: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text">Contraseña</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={config.password}
                onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text">ID de almacén <span className="text-muted font-normal">(opcional)</span></label>
              <Input
                type="number"
                min="1"
                placeholder="Detección automática"
                value={config.warehouseId ?? ''}
                onChange={(e) => setConfig((c) => ({
                  ...c,
                  warehouseId: e.target.value ? Number(e.target.value) : undefined,
                }))}
                className="h-9 text-sm"
              />
            </div>
            <p className="text-[11px] text-muted">
              Credenciales por defecto: usuario <code className="bg-panel-2 px-1 rounded">admin</code> / contraseña <code className="bg-panel-2 px-1 rounded">admin</code>
            </p>
            <Button
              disabled={connecting || !config.url || !config.database || !config.username || !config.password}
              loading={connecting}
              onClick={() => void handleConnect()}
              className="self-start"
            >
              Conectar a Odoo
            </Button>
          </div>
        )}

        {/* ── Connected stats ── */}
        {connected && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Catálogo" value={state?.catalogProductCount ? `${state.catalogProductCount} productos` : '—'} />
              <Stat label="Almacén" value={state?.database ?? '—'} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={syncingCatalog}
                disabled={syncingCatalog}
                onClick={() => void handleSyncCatalog()}
              >
                {!syncingCatalog && <RefreshIcon />}
                Catálogo
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={syncingInventory}
                disabled={syncingInventory}
                onClick={() => void handleSyncInventory()}
              >
                {!syncingInventory && <RefreshIcon />}
                Inventario
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDisconnect()}
                className="ml-auto"
              >
                Desconectar
              </Button>
            </div>
          </div>
        )}

        {/* EWP label */}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="size-1.5 rounded-full bg-accent inline-block" />
          <span className="text-[11px] text-muted">ERP Workspace Protocol (EWP) v1.0</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-panel-2 px-3 py-2">
      <span className="text-[10px] font-bold text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm font-black text-text truncate">{value}</span>
    </div>
  );
}
