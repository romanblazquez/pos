import { useState } from 'react';
import type { BrowserSession } from '@retail-os/api-client';
import type { SellerSession } from '../App.js';
import { sellerApi, API_BASE as API } from './api-client.js';

interface Props {
  onAuth: (seller: SellerSession['seller']) => void;
}

type Mode = 'login' | 'register';

export default function AuthGate({ onAuth }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url =
        mode === 'register'
          ? `${API}/api/v1/auth/seller/register`
          : `${API}/api/v1/auth/seller/login`;
      const body =
        mode === 'register'
          ? { name, email, password }
          : { email, password };

      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Error inesperado');
        return;
      }

      const session = sellerApi.acceptSession(data as BrowserSession);
      onAuth(session.seller as SellerSession['seller']);
    } catch {
      setError('No se pudo conectar con el servidor. ¿Está corriendo la API?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand / social proof */}
      <div className="hidden lg:flex lg:w-[420px] shrink-0 bg-emerald-900 flex-col p-10 justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">BG</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">BGMarket</p>
            <p className="text-emerald-400 text-xs mt-0.5">Portal de Vendedores</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="space-y-4">
          <h2 className="text-2xl font-light leading-relaxed text-white">
            Vendé más,<br />gestioná menos.
          </h2>
          <p className="text-emerald-300 text-sm mt-2 leading-relaxed">
            Conectá tu tienda y aparecé en el marketplace automáticamente.
          </p>

          {/* Social proof stats */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-emerald-800">
            {[
              { value: '12k+', label: 'Juegos' },
              { value: '340+', label: 'Tiendas' },
              { value: '4 h',  label: 'Sync'   },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white tabular">{value}</p>
                <p className="text-xs text-emerald-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-emerald-800 text-xs">© 2025 BGMarket</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="max-w-sm mx-auto w-full px-6 py-12">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">BG</span>
            </div>
            <div>
              <p className="text-slate-900 font-semibold text-sm leading-none">BGMarket</p>
              <p className="text-emerald-600 text-xs mt-0.5">Portal de Vendedores</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'Bienvenido' : 'Creá tu cuenta'}
          </h2>
          <p className="text-slate-500 text-sm mt-1 mb-8">
            {mode === 'login'
              ? 'Accedé a tu portal de vendedor'
              : 'Completá los datos para empezar'}
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <Field label="Nombre de tu tienda">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ej: El Dado Mágico"
                  className={inputCls}
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@tienda.com"
                className={inputCls}
              />
            </Field>
            <Field label="Contraseña">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className={inputCls}
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {loading
                ? '...'
                : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {mode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-emerald-700 font-medium hover:underline"
            >
              {mode === 'login' ? 'Registrate' : 'Iniciá sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors';
