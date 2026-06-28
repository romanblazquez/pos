import { useState } from 'react';
import { useCustomer } from '../context/CustomerContext.js';
import { Button } from './ui/index.js';
import { GoogleSignInButton } from '@retail-os/ui-react';
import { API_BASE } from '../lib/api-client.js';

interface AuthModalProps {
  onClose: () => void;
  defaultTab?: 'login' | 'register';
}

export default function AuthModal({ onClose, defaultTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithGoogle } = useCustomer();
  const googleClientId = import.meta.env.VITE_GOOGLE_MARKETPLACE_CLIENT_ID;

  function switchTab(t: 'login' | 'register') {
    setTab(t);
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (tab === 'register' && !name.trim()) { setError('Ingresá tu nombre'); return; }
    setLoading(true);
    try {
      if (tab === 'login') await login(email, password);
      else await register(email, password, name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-[--border] bg-[--bg-raised] shadow-xl animate-fade-in">

        {/* Tab bar */}
        <div className="flex border-b border-[--border]">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors
                ${tab === t
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-400'
                  : 'bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]'}`}
            >
              {t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          {/* Header */}
          <div className="text-center">
            <p className="text-2xl mb-1">🎲</p>
            <h2 className="text-base font-bold text-[--tx]">
              {tab === 'login' ? 'Bienvenido de vuelta' : 'Únete al marketplace'}
            </h2>
            <p className="text-xs text-[--tx-muted] mt-0.5">
              {tab === 'login' ? 'Accedé a tu wallet y tus pedidos' : 'Empezá a ganar cashback en cada compra'}
            </p>
          </div>

          {/* Fields */}
          {tab === 'register' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[--tx-muted]">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                autoFocus
                className="px-3 py-2.5 text-sm rounded-lg border border-[--border]
                           bg-[--bg-input] text-[--tx] placeholder:text-[--tx-faint]
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[--tx-muted]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoFocus={tab === 'login'}
              className="px-3 py-2.5 text-sm rounded-lg border border-[--border]
                         bg-[--bg-input] text-[--tx] placeholder:text-[--tx-faint]
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[--tx-muted]">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="px-3 py-2.5 text-sm rounded-lg border border-[--border]
                         bg-[--bg-input] text-[--tx] placeholder:text-[--tx-faint]
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-200 bg-red-50 dark:bg-red-950
                          rounded-lg px-3 py-2 border border-red-200 dark:border-red-800">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? '…' : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Button>

          {googleClientId && (
            <>
              <div className="flex items-center gap-3 text-xs text-[--tx-faint]">
                <span className="h-px flex-1 bg-[--border]" /> o <span className="h-px flex-1 bg-[--border]" />
              </div>
              <GoogleSignInButton
                app="marketplace"
                clientId={googleClientId}
                apiBase={API_BASE}
                onError={setError}
                onCredential={async (credential, state) => {
                  setLoading(true);
                  setError('');
                  try {
                    await loginWithGoogle(credential, state);
                    onClose();
                  } catch (googleError) {
                    setError(googleError instanceof Error ? googleError.message : 'Google no pudo verificar la cuenta');
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </>
          )}

          <p className="text-center text-xs text-[--tx-muted]">
            {tab === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button
              type="button"
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              className="rounded-md bg-[--bg-subtle] px-2 py-1 font-semibold text-emerald-700 hover:bg-[--bg-hover] dark:text-emerald-300"
            >
              {tab === 'login' ? 'Registrate' : 'Iniciá sesión'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
