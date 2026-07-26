import { useEffect, useState } from 'react';
import type { SellerSession } from '../App.js';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '../components/ui/index.js';
import { sellerApi } from '../auth/api-client.js';

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
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() {
    sellerApi.fetch(`${API}/api/v1/sellers/${session.seller.id}/markets`)
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
      const res = await sellerApi.fetch(`${API}/api/v1/sellers/${session.seller.id}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  async function saveMarket(id: string, patch: Partial<SellerMarket>) {
    setBusyId(id);
    setError('');
    try {
      const res = await sellerApi.fetch(`${API}/api/v1/sellers/${session.seller.id}/markets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'No se pudo guardar el mercado');
      }
      setEditingId(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(m: SellerMarket) {
    setBusyId(m.id);
    try {
      await sellerApi.fetch(`${API}/api/v1/sellers/${session.seller.id}/markets/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      await sellerApi.fetch(`${API}/api/v1/sellers/${session.seller.id}/markets/${id}`, {
        method: 'DELETE',
      });
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8 page-enter">
      <div className="mb-6 flex flex-col items-start gap-4 lg:mb-8 min-[520px]:flex-row min-[520px]:justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Configuración</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mercados</h1>
          <p className="text-sm text-slate-400">
            Países donde vendés, tu moneda de liquidación por país y a dónde envías.
          </p>
        </div>
        {!showNew && (
          <Button className="w-full min-[520px]:w-auto" variant="primary" onClick={() => setShowNew(true)}>+ Agregar mercado</Button>
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
                <div key={m.id} className="py-4">
                <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between min-[480px]:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
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
                  <div className="flex shrink-0 items-center gap-4 text-xs min-[480px]:flex-col min-[480px]:items-end min-[480px]:gap-1.5">
                    <button
                      onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                      disabled={busyId === m.id}
                      className="text-slate-500 hover:text-slate-900"
                    >
                      {editingId === m.id ? 'Cancelar' : 'Editar'}
                    </button>
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
                {editingId === m.id && (
                  <SellerMarketEditor
                    market={m}
                    busy={busyId === m.id}
                    onSave={(patch) => saveMarket(m.id, patch)}
                  />
                )}
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

        <div className="flex flex-col gap-2 pt-1 min-[420px]:flex-row">
          <Button variant="primary" onClick={submit} disabled={!valid || saving}>
            {saving ? 'Guardando…' : 'Guardar mercado'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline editor for one seller market.
 *
 * These fields decide where a seller's offers appear and in what money, so they
 * are the seller's to set — the backfill only ever seeded the minimum implied by
 * selling in a market (domestic delivery, the market's own languages). Widening
 * that, especially shipping abroad, is a claim only the seller can make.
 *
 * Comma-separated text rather than a country multi-select: the destination list
 * is short today and a free-text field beats a picker nobody has data to fill.
 */
function SellerMarketEditor({
  market,
  busy,
  onSave,
}: {
  market: SellerMarket;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [languages, setLanguages] = useState(market.languageCodes.join(', '));
  const [shipping, setShipping] = useState(market.shippingCountries.join(', '));
  const [shipsFrom, setShipsFrom] = useState(market.shipsFromCountryCode ?? '');
  const [pickup, setPickup] = useState(market.localPickup);

  const list = (value: string) =>
    value.split(',').map((part) => part.trim()).filter(Boolean);

  return (
    <form
      className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          languageCodes: list(languages),
          shippingCountries: list(shipping).map((code) => code.toUpperCase()),
          shipsFromCountryCode: shipsFrom.trim().toUpperCase() || undefined,
          localPickup: pickup,
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Idiomas (separados por coma)</span>
        <input
          value={languages}
          onChange={(event) => setLanguages(event.target.value)}
          placeholder="es-MX, en-MX"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Envíos a (códigos de país)</span>
        <input
          value={shipping}
          onChange={(event) => setShipping(event.target.value)}
          placeholder="MX, AR"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-slate-600">Envía desde</span>
        <input
          value={shipsFrom}
          onChange={(event) => setShipsFrom(event.target.value)}
          placeholder="MX"
          maxLength={2}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase"
        />
      </label>

      <label className="flex items-center gap-2 self-end text-sm text-slate-700">
        <input
          type="checkbox"
          checked={pickup}
          onChange={(event) => setPickup(event.target.checked)}
          className="h-4 w-4"
        />
        Retiro en tienda disponible
      </label>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
