import { useState } from 'react';
import type { SellerSession } from '../App.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface Props {
  onAuth: (session: SellerSession) => void;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Error inesperado');
        return;
      }

      onAuth(data as SellerSession);
    } catch {
      setError('No se pudo conectar con el servidor. ¿Está corriendo la API?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-2xl font-bold text-emerald-800">🎲 BoardGame Market</p>
          <p className="text-stone-500 text-sm mt-1">Portal de Vendedores</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
          <h2 className="text-lg font-bold text-stone-900 mb-6">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
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
              className="w-full py-2.5 bg-emerald-700 text-white text-sm font-semibold rounded-lg
                         hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {loading
                ? '...'
                : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-stone-500 mt-5">
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
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-stone-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-2.5 text-sm rounded-lg border border-stone-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
