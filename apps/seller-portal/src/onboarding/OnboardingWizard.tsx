import { useState } from 'react';
import type { SellerSession } from '../App.js';
import { sellerApi } from '../auth/api-client.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type ConnectorType =
  | 'tiendanube'
  | 'shopify'
  | 'mercadolibre'
  | 'woocommerce'
  | 'csv'
  | 'manual';

interface WizardState {
  storeType: 'connect' | 'create' | '';
  connectorType: ConnectorType | '';
  connectorConnected: boolean;
  catalogImported: boolean;
  shipsFrom: string;
  offersPickup: boolean;
  commissionAccepted: boolean;
}

const INITIAL: WizardState = {
  storeType: '',
  connectorType: '',
  connectorConnected: false,
  catalogImported: false,
  shipsFrom: '',
  offersPickup: false,
  commissionAccepted: false,
};

// Per-connector credential fields shown to the seller.
// Keys become the JSON body sent to POST /connector/credentials.
const CREDENTIAL_FIELDS: Partial<Record<ConnectorType, { key: string; label: string; placeholder: string; hint: string }[]>> = {
  tiendanube: [
    {
      key: 'storeId',
      label: 'ID de tu tienda (Store ID)',
      placeholder: 'Ej: 1234567',
      hint: 'Tiendanube Admin → tu URL es mitienda.mitiendanube.com — el ID numérico está en Configuración → Datos de la cuenta',
    },
    {
      key: 'accessToken',
      label: 'Token de acceso',
      placeholder: 'Pegá tu access token aquí',
      hint: 'Tiendanube Admin → Configuración → Aplicaciones externas → Crear token de API',
    },
  ],
  shopify: [
    {
      key: 'shopUrl',
      label: 'URL de tu tienda Shopify',
      placeholder: 'tu-tienda.myshopify.com',
      hint: 'El subdominio de tu tienda en Shopify (sin https://)',
    },
    {
      key: 'accessToken',
      label: 'Admin API access token',
      placeholder: 'shpat_...',
      hint: 'Shopify Admin → Apps → Develop apps → tu app → Admin API access token',
    },
  ],
  woocommerce: [
    {
      key: 'siteUrl',
      label: 'URL de tu sitio WordPress',
      placeholder: 'https://tu-tienda.com',
      hint: 'La URL raíz de tu sitio donde está instalado WooCommerce',
    },
    {
      key: 'consumerKey',
      label: 'Consumer Key',
      placeholder: 'ck_...',
      hint: 'WooCommerce → Ajustes → Avanzado → REST API → Añadir clave',
    },
    {
      key: 'consumerSecret',
      label: 'Consumer Secret',
      placeholder: 'cs_...',
      hint: 'Se genera junto con la Consumer Key',
    },
  ],
  mercadolibre: [
    {
      key: 'accessToken',
      label: 'Access Token de Mercado Libre',
      placeholder: 'APP_USR-...',
      hint: 'Mercado Libre Developers → Mis apps → Credenciales → Access token',
    },
    {
      key: 'sellerId',
      label: 'Tu User ID (Seller ID)',
      placeholder: 'Ej: 123456789',
      hint: 'Número de usuario de tu cuenta de Mercado Libre',
    },
  ],
};

const TOTAL_STEPS = 5;

const CONNECTORS: { type: ConnectorType; label: string; icon: string; desc: string }[] = [
  { type: 'tiendanube', label: 'Tiendanube', icon: '☁️', desc: 'Sincroniza tu tienda Tiendanube automáticamente.' },
  { type: 'shopify', label: 'Shopify', icon: '🛍️', desc: 'Conecta tu tienda Shopify en segundos.' },
  { type: 'mercadolibre', label: 'Mercado Libre', icon: '🛒', desc: 'Importa tu catálogo de Mercado Libre.' },
  { type: 'woocommerce', label: 'WooCommerce', icon: '🔌', desc: 'Conecta tu sitio WordPress + WooCommerce.' },
  { type: 'csv', label: 'Archivo CSV', icon: '📄', desc: 'Importa tu catálogo desde un archivo Excel o CSV.' },
  { type: 'manual', label: 'Manual', icon: '✏️', desc: 'Cargá tus productos directamente en el portal.' },
];

interface OnboardingWizardProps {
  session: SellerSession;
  onComplete: (updates: Partial<SellerSession['seller']>) => void;
}

export default function OnboardingWizard({ session, onComplete }: OnboardingWizardProps) {
  // If the seller already has a connector (e.g. returning from OAuth), skip to step 3
  const initialStep = session.seller.connectorType ? 3 : 1;
  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState<WizardState>({
    ...INITIAL,
    connectorType: (session.seller.connectorType as ConnectorType) || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS)); }
  function prev() { setStep((s) => Math.max(s - 1, 1)); }

  async function finish() {
    setIsSubmitting(true);
    setError('');
    try {
      const res = await sellerApi.fetch(`${API}/api/v1/auth/seller/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'complete',
          data: {
            storeType: data.storeType,
            connectorType: data.connectorType || null,
            shipsFrom: data.shipsFrom,
            offersPickup: data.offersPickup,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { message?: string }).message ?? 'Error al guardar. Intenta de nuevo.');
        return;
      }

      onComplete({ onboardingStep: 'complete', status: 'active' });
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-stone-50 px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center sm:mb-8">
          <p className="text-2xl font-bold text-emerald-800">🎲 BoardGame Market</p>
          <p className="text-stone-500 text-sm mt-1">
            Hola, <strong>{session.seller.name}</strong> — completá tu perfil
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6 sm:mb-8">
          <div className="flex justify-between text-xs text-stone-400 mb-2">
            <span>Paso {step} de {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-stone-200 rounded-full">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <Step1StoreType data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 2 && (
            <Step2Connect data={data} session={session} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 3 && (
            <Step3Catalog data={data} session={session} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 4 && (
            <Step4Delivery data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 5 && (
            <Step5Commission data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              onClick={prev}
              className="min-h-11 px-4 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 sm:px-5"
            >
              ← Anterior
            </button>
          ) : (
            <div />
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={next}
              className="min-h-11 px-4 py-2 text-sm bg-emerald-700 text-white font-medium rounded-lg hover:bg-emerald-800 sm:px-6"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={!data.commissionAccepted || isSubmitting}
              className="min-h-11 px-4 py-2 text-sm bg-emerald-700 text-white font-semibold rounded-lg sm:px-6
                         hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Activando tu tienda...' : '¡Empezar a vender! 🎲'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1StoreType({
  data,
  onChange,
}: {
  data: WizardState;
  onChange: (d: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader step={1} title="¿Cómo querés participar?" desc="Elegí la opción que mejor se adapte a tu situación." />
      <div className="grid gap-3">
        {[
          { value: 'connect' as const, icon: '🔗', title: 'Conectar mi tienda existente', desc: 'Tengo Tiendanube, Shopify, Mercado Libre u otro sistema.' },
          { value: 'create' as const, icon: '🚀', title: 'Crear una tienda nueva', desc: 'Quiero vender online sin tener una tienda previa.' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange({ storeType: opt.value })}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              data.storeType === opt.value
                ? 'border-emerald-600 bg-emerald-50'
                : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{opt.icon}</span>
              <div>
                <p className="font-semibold text-stone-900 text-sm">{opt.title}</p>
                <p className="text-xs text-stone-500 mt-0.5">{opt.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const NEEDS_CREDENTIALS = new Set(['tiendanube', 'shopify', 'mercadolibre', 'woocommerce']);

function Step2Connect({
  data,
  session,
  onChange,
}: {
  data: WizardState;
  session: SellerSession;
  onChange: (d: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader step={2} title="Conectar tu catálogo" desc="¿Dónde están tus productos ahora?" />
      <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
        {CONNECTORS.map((c) => (
          <button
            key={c.type}
            onClick={() => onChange({ connectorType: c.type, connectorConnected: false })}
            className={`text-left p-3 rounded-xl border-2 transition-all ${
              data.connectorType === c.type
                ? 'border-emerald-600 bg-emerald-50'
                : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            <span className="text-xl block mb-1">{c.icon}</span>
            <p className="font-medium text-sm text-stone-900">{c.label}</p>
            <p className="text-xs text-stone-400 mt-0.5 leading-snug">{c.desc}</p>
          </button>
        ))}
      </div>

      {data.connectorType && NEEDS_CREDENTIALS.has(data.connectorType) && (
        <ConnectorCredentialForm
          sellerId={session.seller.id}
          connectorType={data.connectorType as ConnectorType}
          connected={data.connectorConnected}
          onConnected={() => onChange({ connectorConnected: true })}
        />
      )}
    </div>
  );
}

// ─── Shared credential form ───────────────────────────────────────────────────

export function ConnectorCredentialForm({
  sellerId,
  connectorType,
  connected,
  onConnected,
}: {
  sellerId: string;
  connectorType: ConnectorType;
  connected: boolean;
  onConnected: () => void;
}) {
  const fields = CREDENTIAL_FIELDS[connectorType] ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (fields.length === 0) return null;

  const connectorLabel = CONNECTORS.find((c) => c.type === connectorType)?.label ?? connectorType;

  async function save() {
    const missing = fields.find((f) => !values[f.key]?.trim());
    if (missing) { setError(`El campo "${missing.label}" es obligatorio.`); return; }

    setSaving(true);
    setError('');
    try {
      // 1. Save credentials (encrypted on server)
      const saveRes = await fetch(`${API}/api/v1/sellers/${sellerId}/connector/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, connectorType }),
      });
      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `HTTP ${saveRes.status}`);
      }

      // 2. Ping to verify the credentials actually work
      const pingRes = await fetch(`${API}/api/v1/sellers/${sellerId}/connector/ping`);
      if (!pingRes.ok) throw new Error('Credenciales guardadas pero la verificación falló. Revisá los datos.');

      onConnected();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (connected) {
    return (
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-semibold text-emerald-800 text-sm">¡{connectorLabel} conectado!</p>
          <p className="text-xs text-emerald-600">Las credenciales se verificaron correctamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
      <p className="text-sm font-medium text-stone-700">
        🔑 Ingresá tus credenciales de <strong>{connectorLabel}</strong>
      </p>

      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <label className="text-xs font-medium text-stone-600">{f.label}</label>
          <input
            type={f.key.toLowerCase().includes('token') || f.key.toLowerCase().includes('secret') ? 'password' : 'text'}
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className={inputCls}
          />
          <p className="text-[11px] text-stone-400">{f.hint}</p>
        </div>
      ))}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 text-sm bg-emerald-700 text-white font-medium rounded-lg
                   hover:bg-emerald-800 disabled:opacity-60 transition-colors"
      >
        {saving ? '⏳ Verificando...' : 'Guardar y verificar conexión'}
      </button>
    </div>
  );
}

function Step3Catalog({
  data,
  session,
  onChange,
}: {
  data: WizardState;
  session: SellerSession;
  onChange: (d: Partial<WizardState>) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(data.catalogImported);
  const [result, setResult] = useState<{ synced: number } | null>(null);

  async function triggerImport() {
    setImporting(true);
    try {
      const res = await sellerApi.fetch(
        `${API}/api/v1/sellers/${session.seller.id}/connector/sync/catalog`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({}));
      setResult({ synced: (body as { itemsSynced?: number }).itemsSynced ?? 0 });
      setDone(true);
      onChange({ catalogImported: true });
    } catch {
      setResult({ synced: 0 });
      setDone(true);
      onChange({ catalogImported: true });
    } finally {
      setImporting(false);
    }
  }

  if (['csv', 'manual', ''].includes(data.connectorType)) {
    return (
      <div className="space-y-5">
        <StepHeader step={3} title="Importar catálogo" desc="Podés cargar productos manualmente desde el panel." />
        <div className="text-center py-6">
          <p className="text-4xl mb-3">✏️</p>
          <p className="text-sm text-stone-600">Añadirás tus productos después de activar la cuenta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StepHeader step={3} title="Importar catálogo" desc="Vamos a traer tus productos al marketplace." />
      {!done ? (
        <div className="text-center py-6">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-stone-600 text-sm mb-4">
            Conectaremos con <strong>{CONNECTORS.find((c) => c.type === data.connectorType)?.label ?? 'tu tienda'}</strong>{' '}
            y traeremos todos tus productos.
          </p>
          <button
            onClick={triggerImport}
            disabled={importing}
            className="px-6 py-2.5 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 disabled:opacity-60"
          >
            {importing ? '⏳ Importando...' : 'Importar productos'}
          </button>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-stone-900">¡Catálogo importado!</p>
          {result && (
            <p className="text-sm text-stone-500 mt-1">
              {result.synced > 0
                ? <>Sincronizamos <strong>{result.synced} productos</strong>. Los revisaremos y publicaremos pronto.</>
                : 'Tu catálogo se sincronizará automáticamente cuando el conector esté configurado.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Step4Delivery({ data, onChange }: { data: WizardState; onChange: (d: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-5">
      <StepHeader step={4} title="Envíos y retiro" desc="¿Desde dónde enviás?" />
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">Ciudad o código postal de origen</label>
        <input
          type="text"
          value={data.shipsFrom}
          onChange={(e) => onChange({ shipsFrom: e.target.value })}
          placeholder="Ej: Buenos Aires, CABA"
          className={inputCls}
        />
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={data.offersPickup}
          onChange={(e) => onChange({ offersPickup: e.target.checked })}
          className="mt-0.5 w-4 h-4 accent-emerald-600"
        />
        <div>
          <p className="text-sm font-medium text-stone-900">Ofrezco retiro en local</p>
          <p className="text-xs text-stone-500">Los clientes podrán elegir retirar en tu tienda física.</p>
        </div>
      </label>
    </div>
  );
}

function Step5Commission({ data, onChange }: { data: WizardState; onChange: (d: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-5">
      <StepHeader step={5} title="Comisión y términos" desc="Una comisión solo se cobra cuando vendés." />
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-600">Comisión por venta</span>
          <span className="font-bold text-stone-900">3%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-600">Cuota mensual</span>
          <span className="font-bold text-emerald-700">Gratis</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-600">Visibilidad</span>
          <span className="font-bold text-stone-900">Ranking automático</span>
        </div>
        <hr className="border-stone-200" />
        <p className="text-xs text-stone-400">
          La comisión se descuenta de cada venta realizada a través del marketplace.
        </p>
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={data.commissionAccepted}
          onChange={(e) => onChange({ commissionAccepted: e.target.checked })}
          className="mt-0.5 w-4 h-4 accent-emerald-600"
        />
        <p className="text-sm text-stone-700">
          Acepto los <a href="#" className="underline text-emerald-700">términos y condiciones</a> y la comisión del 3%.
        </p>
      </label>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StepHeader({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div>
      <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-1">Paso {step}</p>
      <h2 className="text-xl font-bold text-stone-900">{title}</h2>
      <p className="text-sm text-stone-500 mt-1">{desc}</p>
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 text-sm rounded-lg border border-stone-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
