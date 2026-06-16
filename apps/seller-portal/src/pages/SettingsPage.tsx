import { useState } from 'react';
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
