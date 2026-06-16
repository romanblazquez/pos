import { useState, useEffect } from 'react';
import type { SellerSession } from '../App.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface Props {
  session: SellerSession;
  onSessionUpdate: (updates: Partial<SellerSession['seller']>) => void;
}

export function SettingsPage({ session, onSessionUpdate }: Props) {
  const [name, setName] = useState(session.seller.name ?? '');
  const [phone, setPhone] = useState(session.seller.phone ?? '');
  const [timezone, setTimezone] = useState(session.seller.timezone ?? 'America/Mexico_City');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/api/v1/sellers/${session.seller.id}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, timezone }),
      });
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        throw new Error(body.message ?? 'Error al guardar');
      }
      const updated = await res.json() as { name: string; phone?: string; timezone: string };
      onSessionUpdate({ name: updated.name, phone: updated.phone, timezone: updated.timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  const TIMEZONES = [
    'America/Mexico_City',
    'America/Monterrey',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Buenos_Aires',
    'America/Sao_Paulo',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/Madrid',
    'UTC',
  ];

  return (
    <div className="p-8 max-w-2xl space-y-6 page-enter">
      {/* Page header */}
      <div className="space-y-1 mb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Configuración</p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Perfil de la tienda</h1>
        <p className="text-sm text-slate-400">Información pública y programa de recompensas.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del vendedor</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Nombre de la tienda
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={30}
                  placeholder="+52 55 1234 5678"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Zona horaria
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div className="pt-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-400">Email:</span>
                <span className="text-xs text-slate-600 font-medium">{session.seller.email}</span>
              </div>

              {error && (
                <p className="text-xs text-red-600 mb-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <RewardsCard session={session} />

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">ID de vendedor</span>
              <span className="font-mono text-xs text-slate-700">{session.seller.id}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Email</span>
              <span>{session.seller.email}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">País</span>
              <span>{session.seller.country ?? 'MX'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Conector</span>
              <span>{session.seller.connectorType ?? 'Ninguno'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface RewardPreview {
  effectiveCommissionPct: number;
  platformCashbackPct: number;
  storeCashbackPct: number;
  totalBuyerCashbackPct: number;
}

function RewardsCard({ session }: { session: SellerSession }) {
  const [storeCashback, setStoreCashback] = useState(0);
  const [platformCashbackPct, setPlatformCashbackPct] = useState(0.01);
  const [preview, setPreview] = useState<RewardPreview | null>(null);
  const [saving, setRewardSaving] = useState(false);
  const [saved, setRewardSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/rewards`)
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<RewardPreview>;
      })
      .then((d) => {
        if (!d) return;
        const cbPct = d.platformCashbackPct ?? 0.01;
        setPlatformCashbackPct(cbPct);
        setStoreCashback(Math.round((d.storeCashbackPct ?? 0) * 100));
        setPreview(d);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [session.seller.id]);

  // Recompute preview locally as slider moves
  useEffect(() => {
    const pct = storeCashback / 100;
    const effective = Math.max(0.05 - Math.floor(storeCashback / 2) * 0.01, 0.03);
    setPreview({
      storeCashbackPct: pct,
      effectiveCommissionPct: effective,
      platformCashbackPct,
      totalBuyerCashbackPct: platformCashbackPct + pct,
    });
  }, [storeCashback, platformCashbackPct]);

  async function saveRewards() {
    setRewardSaving(true);
    try {
      await fetch(`${API}/api/v1/sellers/${session.seller.id}/rewards`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ storeCashbackPct: storeCashback / 100 }),
      });
      setRewardSaved(true);
      setTimeout(() => setRewardSaved(false), 3000);
    } finally {
      setRewardSaving(false);
    }
  }

  const exampleTotal = 10000; // $100.00 in centavos
  const commissionAmt = preview ? Math.round(exampleTotal * preview.effectiveCommissionPct) : 0;
  const platformCbAmt = preview ? Math.round(exampleTotal * preview.platformCashbackPct) : 0;
  const storeCbAmt = preview ? Math.round(exampleTotal * (storeCashback / 100)) : 0;
  const payoutAmt = exampleTotal - commissionAmt - storeCbAmt;

  function fmt(minor: number) {
    return `$${(minor / 100).toFixed(2)}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Programa de recompensas</CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">
          Ofrecé créditos exclusivos de tu tienda y reducí tu comisión de plataforma.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <>
            {/* Credit types explained */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 space-y-1">
                <p className="font-semibold text-slate-700">Créditos de plataforma</p>
                <p className="text-slate-400 leading-relaxed">
                  {Math.round(platformCashbackPct * 100)}% que aporta el marketplace. El comprador los puede usar en <strong className="text-slate-600">cualquier tienda</strong>.
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 space-y-1">
                <p className="font-semibold text-emerald-800">Créditos de tu tienda</p>
                <p className="text-emerald-700/70 leading-relaxed">
                  El % que vos configurás. Solo se pueden canjear en <strong className="text-emerald-800">tus productos</strong>. Nunca en otra tienda.
                </p>
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Créditos de tienda que ofrecés
                </label>
                <span className="text-2xl font-semibold text-slate-900">{storeCashback}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={storeCashback}
                onChange={(e) => setStoreCashback(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>0%</span>
                <span>2%</span>
                <span>4%</span>
                <span>6%</span>
                <span>8%</span>
              </div>
            </div>

            {/* Commission & cashback breakdown */}
            {preview && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-0.5">
                  <p className="text-xs text-slate-500">Tu comisión efectiva</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {Math.round(preview.effectiveCommissionPct * 100)}%
                  </p>
                  <p className="text-xs text-slate-400">
                    {storeCashback > 0
                      ? `Reducida ${Math.floor(storeCashback / 2)}% — cada 2% extra = −1% comisión`
                      : 'Comisión base 5%'
                    }
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 space-y-0.5">
                  <p className="text-xs text-emerald-600">Beneficio total del comprador</p>
                  <p className="text-2xl font-semibold text-emerald-700">
                    {Math.round(preview.totalBuyerCashbackPct * 100)}%
                  </p>
                  <p className="text-xs text-emerald-500">
                    {Math.round(platformCashbackPct * 100)}% libre + {storeCashback}% solo en tu tienda
                  </p>
                </div>
              </div>
            )}

            {/* Example order breakdown */}
            {preview && (
            <div className="rounded-xl border border-slate-100 p-4 space-y-2.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Ejemplo — venta de {fmt(exampleTotal)}
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Precio de venta</span>
                  <span className="font-medium">{fmt(exampleTotal)}</span>
                </div>

                {/* Total deduction = commission + store cashback */}
                <div className="flex justify-between font-medium text-slate-700">
                  <span>
                    Total deducido ({Math.round(preview.effectiveCommissionPct * 100) + storeCashback}%)
                  </span>
                  <span className="text-red-500">−{fmt(commissionAmt + storeCbAmt)}</span>
                </div>

                {/* Commission sub-line */}
                <div className="pl-4 space-y-0.5">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>└ comisión plataforma ({Math.round(preview.effectiveCommissionPct * 100)}%)</span>
                    <span>−{fmt(commissionAmt)}</span>
                  </div>
                  <div className="pl-4 space-y-0.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>└ ingreso neto plataforma ({Math.round((preview.effectiveCommissionPct - platformCashbackPct) * 100)}%)</span>
                      <span>{fmt(commissionAmt - platformCbAmt)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-500">
                      <span>└ créditos libres al comprador ({Math.round(platformCashbackPct * 100)}%)</span>
                      <span>+{fmt(platformCbAmt)}</span>
                    </div>
                  </div>

                  {storeCbAmt > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>└ cashback de tu tienda ({storeCashback}%) — solo en tus productos</span>
                      <span>−{fmt(storeCbAmt)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between font-semibold border-t border-slate-100 pt-2 mt-1">
                  <span>Tu cobro neto</span>
                  <span className="text-slate-900">{fmt(payoutAmt)}</span>
                </div>
              </div>

              {/* Credits summary */}
              <div className="border-t border-dashed border-slate-200 pt-2.5 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Créditos libres que gana (marketplace)</span>
                  <span className="text-emerald-600 font-medium">+{fmt(platformCbAmt)} — cualquier tienda</span>
                </div>
                {storeCbAmt > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Créditos exclusivos que gana (tu tienda)</span>
                    <span className="text-emerald-600 font-medium">+{fmt(storeCbAmt)} — solo en tus productos</span>
                  </div>
                )}
              </div>
            </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={saveRewards}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar programa'}
              </button>
              {storeCashback === 0 && (
                <p className="text-xs text-slate-400">Sin cashback — comisión estándar 5%</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
