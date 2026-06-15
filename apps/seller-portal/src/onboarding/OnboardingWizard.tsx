import { useState } from 'react';

type ConnectorType =
  | 'tiendanube'
  | 'shopify'
  | 'mercadolibre'
  | 'woocommerce'
  | 'csv'
  | 'manual';

interface WizardState {
  // Step 1
  name: string;
  email: string;
  phone: string;
  // Step 2
  storeType: 'connect' | 'create' | '';
  // Step 3
  connectorType: ConnectorType | '';
  // Step 4
  catalogImported: boolean;
  // Step 5
  shipsFrom: string;
  offersPickup: boolean;
  // Step 6
  commissionAccepted: boolean;
}

const INITIAL: WizardState = {
  name: '', email: '', phone: '',
  storeType: '',
  connectorType: '',
  catalogImported: false,
  shipsFrom: '', offersPickup: false,
  commissionAccepted: false,
};

const TOTAL_STEPS = 6;

const CONNECTORS: { type: ConnectorType; label: string; icon: string; desc: string }[] = [
  { type: 'tiendanube', label: 'Tiendanube', icon: '☁️', desc: 'Sincroniza tu tienda Tiendanube automáticamente.' },
  { type: 'shopify', label: 'Shopify', icon: '🛍️', desc: 'Conecta tu tienda Shopify en segundos.' },
  { type: 'mercadolibre', label: 'Mercado Libre', icon: '🛒', desc: 'Importa tu catálogo de Mercado Libre.' },
  { type: 'woocommerce', label: 'WooCommerce', icon: '🔌', desc: 'Conecta tu sitio WordPress + WooCommerce.' },
  { type: 'csv', label: 'Archivo CSV', icon: '📄', desc: 'Importa tu catálogo desde un archivo Excel o CSV.' },
  { type: 'manual', label: 'Manual', icon: '✏️', desc: 'Cargá tus productos directamente en el portal.' },
];

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardState>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }
  function prev() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function finish() {
    setIsSubmitting(true);
    try {
      // In Epic 2 this will POST to /api/v1/sellers/onboard
      await new Promise((r) => setTimeout(r, 800));
      localStorage.setItem('seller-portal.seller-id', 'demo-seller-001');
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-2xl font-bold text-emerald-800">🎲 BoardGame Market</p>
          <p className="text-stone-500 text-sm mt-1">Portal de Vendedores</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
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

        {/* Card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8">
          {step === 1 && (
            <Step1Account data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 2 && (
            <Step2StoreType data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 3 && (
            <Step3Connect data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 4 && (
            <Step4Catalog data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 5 && (
            <Step5Delivery data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
          {step === 6 && (
            <Step6Commission data={data} onChange={(d) => setData((s) => ({ ...s, ...d }))} />
          )}
        </div>

        {/* Nav buttons */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button
              onClick={prev}
              className="px-5 py-2 text-sm text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50"
            >
              ← Anterior
            </button>
          ) : (
            <div />
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={next}
              className="px-6 py-2 text-sm bg-emerald-700 text-white font-medium rounded-lg hover:bg-emerald-800"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={!data.commissionAccepted || isSubmitting}
              className="px-6 py-2 text-sm bg-emerald-700 text-white font-semibold rounded-lg
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

function Step1Account({
  data,
  onChange,
}: {
  data: WizardState;
  onChange: (d: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        step={1}
        title="Crear tu cuenta"
        desc="Empecemos con los datos básicos de tu tienda."
      />
      <Field label="Nombre de tu tienda">
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej: El Dado Mágico"
          className={inputCls}
        />
      </Field>
      <Field label="Email de contacto">
        <input
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="tu@tienda.com"
          className={inputCls}
        />
      </Field>
      <Field label="WhatsApp / Teléfono (opcional)">
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+52 55 1234 5678"
          className={inputCls}
        />
      </Field>
    </div>
  );
}

function Step2StoreType({
  data,
  onChange,
}: {
  data: WizardState;
  onChange: (d: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        step={2}
        title="¿Cómo querés participar?"
        desc="Elegí la opción que mejor se adapte a tu situación."
      />
      <div className="grid gap-3">
        {[
          {
            value: 'connect' as const,
            icon: '🔗',
            title: 'Conectar mi tienda existente',
            desc: 'Tengo Tiendanube, Shopify, Mercado Libre u otro sistema. Solo conecto y listo.',
          },
          {
            value: 'create' as const,
            icon: '🚀',
            title: 'Crear una tienda nueva',
            desc: 'Quiero vender online. Me doy de alta en el marketplace y el sistema me da una tienda propia.',
          },
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

function Step3Connect({
  data,
  onChange,
}: {
  data: WizardState;
  onChange: (d: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        step={3}
        title="Conectar tu catálogo"
        desc="¿Dónde están tus productos ahora?"
      />
      <div className="grid grid-cols-2 gap-3">
        {CONNECTORS.map((c) => (
          <button
            key={c.type}
            onClick={() => onChange({ connectorType: c.type })}
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
      {data.connectorType && data.connectorType !== 'csv' && data.connectorType !== 'manual' && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
          🔐 Te redirigiremos a <strong>{CONNECTORS.find(c => c.type === data.connectorType)?.label}</strong> para
          autorizar el acceso. Solo necesitamos leer tu catálogo e inventario.
        </div>
      )}
    </div>
  );
}

function Step4Catalog({
  data,
  onChange,
}: {
  data: WizardState;
  onChange: (d: Partial<WizardState>) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(data.catalogImported);

  function simulateImport() {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setDone(true);
      onChange({ catalogImported: true });
    }, 2000);
  }

  return (
    <div className="space-y-5">
      <StepHeader
        step={4}
        title="Importar catálogo"
        desc="Vamos a traer tus productos al marketplace."
      />
      {!done ? (
        <div className="text-center py-6">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-stone-600 text-sm mb-4">
            Conectaremos con{' '}
            <strong>{CONNECTORS.find((c) => c.type === data.connectorType)?.label ?? 'tu tienda'}</strong>{' '}
            y traeremos todos tus productos.
          </p>
          <button
            onClick={simulateImport}
            disabled={importing}
            className="px-6 py-2.5 bg-emerald-700 text-white text-sm font-medium rounded-lg
                       hover:bg-emerald-800 disabled:opacity-60"
          >
            {importing ? '⏳ Importando...' : 'Importar productos'}
          </button>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-stone-900">¡Catálogo importado!</p>
          <p className="text-sm text-stone-500 mt-1">
            Encontramos <strong>47 productos</strong>. Los revisaremos y
            publicaremos en el marketplace en las próximas horas.
          </p>
        </div>
      )}
    </div>
  );
}

function Step5Delivery({
  data,
  onChange,
}: {
  data: WizardState;
  onChange: (d: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        step={5}
        title="Envíos y retiro"
        desc="¿Desde dónde enviás? Los clientes verán el tiempo estimado de entrega."
      />
      <Field label="Ciudad / Código postal desde donde enviás">
        <input
          type="text"
          value={data.shipsFrom}
          onChange={(e) => onChange({ shipsFrom: e.target.value })}
          placeholder="Ej: Buenos Aires, CABA o 1425"
          className={inputCls}
        />
      </Field>
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

function Step6Commission({
  data,
  onChange,
}: {
  data: WizardState;
  onChange: (d: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        step={6}
        title="Comisión y términos"
        desc="Una comisión solo se cobra cuando vendés."
      />
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
          No hay costos de alta ni cuota fija.
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
          Acepto los{' '}
          <a href="#" className="underline text-emerald-700">términos y condiciones</a>{' '}
          del marketplace y la comisión del 3% por venta.
        </p>
      </label>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StepHeader({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div>
      <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-1">
        Paso {step}
      </p>
      <h2 className="text-xl font-bold text-stone-900">{title}</h2>
      <p className="text-sm text-stone-500 mt-1">{desc}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-stone-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 text-sm rounded-lg border border-stone-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
