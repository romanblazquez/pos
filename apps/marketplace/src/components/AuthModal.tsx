import { useState } from 'react';
import { useCustomer } from '../context/CustomerContext.js';
import { Button } from './ui/index.js';

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
  const { login, register } = useCustomer();

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[--border] bg-[--bg-raised] shadow-2xl overflow-hidden animate-fade-in">

        {/* Tab bar */}
        <div className="flex border-b border-[--border]">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors
                ${tab === t
                  ? 'text-emerald-600 border-b-2 border-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'text-[--tx-muted] hover:text-[--tx]'}`}
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
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20
                          rounded-lg px-3 py-2 border border-red-200 dark:border-red-800">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? '…' : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Button>

          <p className="text-center text-xs text-[--tx-muted]">
            {tab === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button
              type="button"
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
            >
              {tab === 'login' ? 'Registrate' : 'Iniciá sesión'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
