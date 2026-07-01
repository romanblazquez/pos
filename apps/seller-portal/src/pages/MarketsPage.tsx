import { useEffect, useState } from 'react';
import type { SellerSession } from '../App.js';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '../components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface CountryRef { id: string; code: string; name: string }
interface CurrencyRef { id: string; code: string; name: string; symbol: string }
interface LanguageRef { id: string; code: string; name: string; nativeName: string }
interface SellerMarket {
  id: string;
  countryCode: string;
  countryName: string;
  settlementCurrencyCode: string;
  languageCodes: string[];
  shipsFromCountryCode: string | null;
  shippingCountries: string[];
  localPickup: boolean;
  active: boolean;
}

export function MarketsPage({ session }: { session: SellerSession }) {
  const [markets, setMarkets] = useState<SellerMarket[] | null>(null);
  const [countries, setCountries] = useState<CountryRef[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRef[]>([]);
  const [languages, setLanguages] = useState<LanguageRef[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${session.token}` };

  function refresh() {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/markets`, { headers: authHeaders })
      .then((r) => r.ok ? r.json() : [])
      .then((d: SellerMarket[]) => setMarkets(Array.isArray(d) ? d : []))
      .catch(() => setMarkets([]));
  }

  useEffect(() => {
    refresh();
    fetch(`${API}/api/v1/markets/countries`).then((r) => r.ok ? r.json() : []).then((d) => setCountries(Array.isArray(d) ? d : [])).catch(() => null);
    fetch(`${API}/api/v1/markets/currencies`).then((r) => r.ok ? r.json() : []).then((d) => setCurrencies(Array.isArray(d) ? d : [])).catch(() => null);
    fetch(`${API}/api/v1/markets/languages`).then((r) => r.ok ? r.json() : []).then((d) => setLanguages(Array.isArray(d) ? d : [])).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.seller.id]);

  async function createMarket(body: {
    countryCode: string; settlementCurrencyCode: string; languageCodes: string[];
    shipsFromCountryCode?: string; shippingCountries?: string[]; localPickup?: boolean;
  }) {
    setError('');
    try {
      const res = await fetch(`${API}/api/v1/sellers/${session.seller.id}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? 'Error al agregar el mercado');
      }
      setShowNew(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
  }

  async function toggleActive(m: SellerMarket) {
    setBusyId(m.id);
    try {
      await fetch(`${API}/api/v1/sellers/${session.seller.id}/markets/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ active: !m.active }),
      });
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeMarket(id: string) {
    setBusyId(id);
    try {
      await fetch(`${API}/api/v1/sellers/${session.seller.id}/markets/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-8 max-w-3xl space-y-6 page-enter">
      <div className="space-y-1 mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Configuración</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mercados</h1>
          <p className="text-sm text-slate-400">
            Países donde vendés, tu moneda de liquidación por país y a dónde envías.
          </p>
        </div>
        {!showNew && (
          <Button variant="primary" onClick={() => setShowNew(true)}>+ Agregar mercado</Button>
        )}
      </div>

      {showNew && (
        <SellerMarketForm
          countries={countries}
          currencies={currencies}
          languages={languages}
          error={error}
          onCancel={() => { setShowNew(false); setError(''); }}
          onSubmit={createMarket}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mis mercados</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {markets === null ? (
            <p className="text-sm text-slate-400 py-4">Cargando…</p>
          ) : markets.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">
              Todavía no configuraste ningún mercado — por defecto vendés en México (MXN).
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {markets.map((m) => (
                <div key={m.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{m.countryName} ({m.countryCode})</p>
                      <Badge variant={m.active ? 'success' : 'secondary'}>{m.active ? 'Activo' : 'Inactivo'}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Liquidación en {m.settlementCurrencyCode} · idiomas: {m.languageCodes.join(', ')}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {m.localPickup ? 'Retiro en tienda disponible · ' : ''}
                      Envíos a: {m.shippingCountries.length > 0 ? m.shippingCountries.join(', ') : '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs">
                    <button
                      onClick={() => toggleActive(m)}
                      disabled={busyId === m.id}
                      className="text-slate-500 hover:text-slate-900"
                    >
                      {m.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => removeMarket(m.id)}
                      disabled={busyId === m.id}
                      className="text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SellerMarketForm({
  countries, currencies, languages, error, onCancel, onSubmit,
}: {
  countries: CountryRef[];
  currencies: CurrencyRef[];
  languages: LanguageRef[];
  error: string;
  onCancel: () => void;
  onSubmit: (body: {
    countryCode: string; settlementCurrencyCode: string; languageCodes: string[];
    shipsFromCountryCode?: string; shippingCountries?: string[]; localPickup?: boolean;
  }) => void;
}) {
  const [countryCode, setCountryCode] = useState('');
  const [settlementCurrencyCode, setSettlementCurrencyCode] = useState('');
  const [languageCode, setLanguageCode] = useState('');
  const [shipsFromCountryCode, setShipsFromCountryCode] = useState('');
  const [shippingCountries, setShippingCountries] = useState<string[]>([]);
  const [localPickup, setLocalPickup] = useState(false);
  const [saving, setSaving] = useState(false);

  const valid = countryCode && settlementCurrencyCode && languageCode;

  function toggleShipping(code: string) {
    setShippingCountries((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    try {
      await onSubmit({
        countryCode,
        settlementCurrencyCode,
        languageCodes: [languageCode],
        shipsFromCountryCode: shipsFromCountryCode || undefined,
        shippingCountries,
        localPickup,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">País donde vendés</label>
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Selecciona…</option>
              {countries.map((c) => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Moneda de liquidación</label>
            <select value={settlementCurrencyCode} onChange={(e) => setSettlementCurrencyCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Selecciona…</option>
              {currencies.map((c) => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Idioma principal</label>
            <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Selecciona…</option>
              {languages.map((l) => <option key={l.id} value={l.code}>{l.name} ({l.code})</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Envías desde (si es distinto)</label>
            <select value={shipsFromCountryCode} onChange={(e) => setShipsFromCountryCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Mismo país</option>
              {countries.map((c) => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Envías a</label>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleShipping(c.code)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  shippingCountries.includes(c.code)
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={localPickup} onChange={(e) => setLocalPickup(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
          Ofrezco retiro en tienda para este mercado
        </label>

        <div className="flex gap-2 pt-1">
          <Button variant="primary" onClick={submit} disabled={!valid || saving}>
            {saving ? 'Guardando…' : 'Guardar mercado'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
