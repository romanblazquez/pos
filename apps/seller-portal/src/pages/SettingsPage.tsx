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
    <div className="p-8 max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Perfil de la tienda</h1>
        <p className="text-sm text-slate-500">
          Información pública de tu tienda. El email y país no se pueden cambiar aquí.
        </p>
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
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
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
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
  const [preview, setPreview] = useState<RewardPreview | null>(null);
  const [saving, setRewardSaving] = useState(false);
  const [saved, setRewardSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/sellers/${session.seller.id}/rewards`)
      .then((r) => r.json())
      .then((d: RewardPreview & { storeCashbackPct: number }) => {
        setStoreCashback(Math.round(d.storeCashbackPct * 100));
        setPreview(d);
      })
      .finally(() => setLoading(false));
  }, [session.seller.id]);

  // Update preview as slider moves (no API call — computed locally from known rates)
  useEffect(() => {
    if (!preview) return;
    const pct = storeCashback / 100;
    const base = preview.platformCashbackPct;
    // effectiveCommission = max(5% - storeCashback, 2%)
    const effective = Math.max(0.05 - pct, 0.02);
    setPreview((p) => p ? { ...p, storeCashbackPct: pct, effectiveCommissionPct: effective, totalBuyerCashbackPct: base + pct } : p);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCashback]);

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
          Ofrecé cashback a tus compradores y reducí tu comisión de plataforma.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <>
            {/* Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Cashback de tienda para compradores
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
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-900"
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
                    {(preview.effectiveCommissionPct * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-slate-400">
                    {storeCashback > 0
                      ? `Reducida de 5% por tu cashback`
                      : 'Comisión base 5%'}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 space-y-0.5">
                  <p className="text-xs text-emerald-600">Cashback total del comprador</p>
                  <p className="text-2xl font-semibold text-emerald-700">
                    {(preview.totalBuyerCashbackPct * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-emerald-500">
                    1% marketplace + {storeCashback}% tu tienda
                  </p>
                </div>
              </div>
            )}

            {/* Example order breakdown */}
            <div className="rounded-xl border border-slate-100 p-4 space-y-2.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Ejemplo — venta de {fmt(exampleTotal)}
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Precio de venta</span>
                  <span className="font-medium">{fmt(exampleTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Comisión plataforma ({(preview?.effectiveCommissionPct ?? 0.05) * 100}%)</span>
                  <span className="text-red-500">−{fmt(commissionAmt)}</span>
                </div>
                {storeCbAmt > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Tu cashback de tienda ({storeCashback}%)</span>
                    <span className="text-red-500">−{fmt(storeCbAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-slate-100 pt-2 mt-1">
                  <span>Tu cobro neto</span>
                  <span className="text-slate-900">{fmt(payoutAmt)}</span>
                </div>
              </div>
              <div className="border-t border-dashed border-slate-200 pt-2 space-y-1 text-sm">
                <div className="flex justify-between text-emerald-600">
                  <span>Créditos marketplace que gana el comprador (1%)</span>
                  <span>+{fmt(platformCbAmt)}</span>
                </div>
                {storeCbAmt > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Créditos de tu tienda que gana el comprador</span>
                    <span>+{fmt(storeCbAmt)}</span>
                  </div>
                )}
              </div>
            </div>

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
