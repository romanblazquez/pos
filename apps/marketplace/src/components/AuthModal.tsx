import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useCustomer } from '../context/CustomerContext.js';
import { Button } from './ui/index.js';
import { BrandMark } from './BrandMark.js';
import { GoogleSignInButton } from '@retail-os/ui-react';
import { API_BASE } from '../lib/api-client.js';

interface AuthModalProps {
  onClose: () => void;
  defaultTab?: 'login' | 'register';
}

export default function AuthModal({ onClose, defaultTab = 'login' }: AuthModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithGoogle } = useCustomer();
  const googleClientId = import.meta.env.VITE_GOOGLE_MARKETPLACE_CLIENT_ID;
  const intl = useIntl();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', keepFocusInside);
    return () => {
      document.removeEventListener('keydown', keepFocusInside);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function switchTab(t: 'login' | 'register') {
    setTab(t);
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (tab === 'register' && !name.trim()) {
      setError(intl.formatMessage({ id: 'auth.nameRequired' }));
      return;
    }
    setLoading(true);
    try {
      if (tab === 'login') await login(email, password);
      else await register(email, password, name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : intl.formatMessage({ id: 'auth.unknownError' }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-stone-950/60 backdrop-blur-md sm:items-center sm:justify-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[--bg-raised] shadow-xl animate-fade-in sm:h-auto sm:max-h-[min(46rem,calc(100dvh-2rem))] sm:max-w-sm sm:rounded-[14px] sm:border sm:border-[--border]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[--border] bg-[--bg-raised] px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] sm:absolute sm:right-2 sm:top-2 sm:z-10 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="flex items-center gap-2.5 sm:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--brand-tile)] text-[var(--brand-mark)]">
              <BrandMark className="h-5 w-5" />
            </span>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--accent)]">
                {intl.formatMessage({ id: 'auth.brand' })}
              </p>
              <p className="font-display text-[17px] font-bold leading-tight text-[--tx]">
                {intl.formatMessage({ id: 'auth.subtitleMobile' })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={intl.formatMessage({ id: 'auth.close' })}
            className="grid h-11 w-11 place-items-center rounded-xl border border-[--border] bg-[--bg-subtle] text-[--tx-muted] transition-colors hover:bg-[--bg-hover] hover:text-[--tx] active:scale-[.97] sm:h-9 sm:w-9 sm:rounded-lg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-[--border] sm:pr-12">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors
                ${
                  tab === t
                    ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-400'
                    : 'bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]'
                }`}
            >
              {t === 'login' ? intl.formatMessage({ id: 'auth.tabLogin' }) : intl.formatMessage({ id: 'auth.tabRegister' })}
            </button>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 sm:p-6"
        >
          {/* Header */}
          <div className="text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-[13px] bg-[var(--brand-tile)] text-[var(--brand-mark)] shadow-sm">
              <BrandMark className="h-7 w-7" />
            </span>
            <h2
              id="auth-modal-title"
              className="font-display text-xl font-bold tracking-[-.025em] text-[--tx]"
            >
              {tab === 'login' ? intl.formatMessage({ id: 'auth.headingLogin' }) : intl.formatMessage({ id: 'auth.headingRegister' })}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[--tx-muted]">
              {tab === 'login'
                ? intl.formatMessage({ id: 'auth.subtitleLogin' })
                : intl.formatMessage({ id: 'auth.subtitleRegister' })}
            </p>
          </div>

          {/* Fields */}
          {tab === 'register' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[--tx-muted]">{intl.formatMessage({ id: 'auth.nameLabel' })}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={intl.formatMessage({ id: 'auth.namePlaceholder' })}
                autoFocus
                className="min-h-12 rounded-xl border border-[--border] bg-[--bg-input] px-3.5 py-3 text-base text-[--tx] placeholder:text-[--tx-faint]
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[--tx-muted]">{intl.formatMessage({ id: 'auth.emailLabel' })}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={intl.formatMessage({ id: 'auth.emailPlaceholder' })}
              required
              autoFocus={tab === 'login'}
              className="min-h-12 rounded-xl border border-[--border] bg-[--bg-input] px-3.5 py-3 text-base text-[--tx] placeholder:text-[--tx-faint]
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[--tx-muted]">{intl.formatMessage({ id: 'auth.passwordLabel' })}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="min-h-12 rounded-xl border border-[--border] bg-[--bg-input] px-3.5 py-3 text-base text-[--tx] placeholder:text-[--tx-faint]
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p
              className="text-xs text-red-600 dark:text-red-200 bg-red-50 dark:bg-red-950
                          rounded-lg px-3 py-2 border border-red-200 dark:border-red-800"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full justify-center rounded-xl"
          >
            {loading ? '…' : tab === 'login' ? intl.formatMessage({ id: 'auth.submitLogin' }) : intl.formatMessage({ id: 'auth.submitRegister' })}
          </Button>

          {googleClientId && (
            <>
              <div className="flex items-center gap-3 text-xs text-[--tx-faint]">
                <span className="h-px flex-1 bg-[--border]" /> {intl.formatMessage({ id: 'auth.or' })}{' '}
                <span className="h-px flex-1 bg-[--border]" />
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
                    setError(
                      googleError instanceof Error
                        ? googleError.message
                        : intl.formatMessage({ id: 'auth.googleError' }),
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </>
          )}

          <p className="mt-auto pt-1 text-center text-xs text-[--tx-muted]">
            {tab === 'login' ? intl.formatMessage({ id: 'auth.noAccount' }) : intl.formatMessage({ id: 'auth.hasAccount' })}{' '}
            <button
              type="button"
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              className="rounded-md bg-[--bg-subtle] px-2 py-1 font-semibold text-emerald-700 hover:bg-[--bg-hover] dark:text-emerald-300"
            >
              {tab === 'login' ? intl.formatMessage({ id: 'auth.goToRegister' }) : intl.formatMessage({ id: 'auth.goToLogin' })}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
