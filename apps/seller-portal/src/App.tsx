import { useState, useEffect } from 'react';
import OnboardingWizard from './onboarding/OnboardingWizard.js';
import Dashboard from './pages/Dashboard.js';
import AuthGate from './auth/AuthGate.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type SellerSession = {
  token: string;
  seller: {
    id: string;
    name: string;
    slug: string;
    email: string;
    status: string;
    tier: string;
    connectorType: string | null;
    onboardingStep: string | null;
    emailVerified: boolean;
    phone?: string | null;
    country?: string | null;
    timezone?: string | null;
  };
};

function getStoredSession(): SellerSession | null {
  try {
    const raw = localStorage.getItem('seller-portal.session');
    return raw ? (JSON.parse(raw) as SellerSession) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<SellerSession | null>(getStoredSession);
  const [oauthBanner, setOauthBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Handle OAuth redirect return (?oauth=success|error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth');
    if (!oauthStatus) return;

    // Strip query params from URL without reloading
    window.history.replaceState({}, '', window.location.pathname);

    // Handle MercadoPago seller OAuth return
    const mpStatus = params.get('mp');
    if (mpStatus) {
      window.history.replaceState({}, '', window.location.pathname);
      if (mpStatus === 'success') {
        setOauthBanner({ type: 'success', msg: '¡MercadoPago conectado! Ya podés recibir pagos del marketplace.' });
      } else {
        const mpMsg = params.get('msg') ?? 'Error desconocido';
        setOauthBanner({ type: 'error', msg: `Error al conectar MercadoPago: ${decodeURIComponent(mpMsg)}` });
      }
      return;
    }

    if (oauthStatus === 'success') {
      const stored = getStoredSession();
      if (!stored) return;
      // Refresh seller profile so connectorType is up to date
      fetch(`${API}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${stored.token}` },
      })
        .then((r) => r.json())
        .then((seller: SellerSession['seller']) => {
          const next: SellerSession = { ...stored, seller };
          localStorage.setItem('seller-portal.session', JSON.stringify(next));
          setSession(next);
          setOauthBanner({ type: 'success', msg: '¡Tienda conectada exitosamente!' });
        })
        .catch(() => {
          setOauthBanner({ type: 'success', msg: '¡Tienda conectada! Actualizá la página si algo no se ve bien.' });
        });
    } else if (oauthStatus === 'error') {
      const errorMsg = params.get('msg') ?? 'Error desconocido';
      setOauthBanner({ type: 'error', msg: `Error al conectar la tienda: ${decodeURIComponent(errorMsg)}` });
    }
  }, []);

  function handleAuth(s: SellerSession) {
    localStorage.setItem('seller-portal.session', JSON.stringify(s));
    setSession(s);
  }

  function handleLogout() {
    localStorage.removeItem('seller-portal.session');
    setSession(null);
  }

  function updateSession(updates: Partial<SellerSession['seller']>) {
    if (!session) return;
    const next = { ...session, seller: { ...session.seller, ...updates } };
    localStorage.setItem('seller-portal.session', JSON.stringify(next));
    setSession(next);
  }

  if (!session) {
    return <AuthGate onAuth={handleAuth} />;
  }

  const needsOnboarding = session.seller.onboardingStep !== 'complete';

  return (
    <div className="min-h-screen">
      {oauthBanner && (
        <div className={`fixed left-4 right-4 top-4 z-50 flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg sm:left-1/2 sm:right-auto sm:w-max sm:max-w-lg sm:-translate-x-1/2 sm:px-5
          ${oauthBanner.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'}`}>
          {oauthBanner.msg}
          <button onClick={() => setOauthBanner(null)} className="shrink-0 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
      {needsOnboarding ? (
        <OnboardingWizard
          session={session}
          onComplete={(updated) => updateSession(updated)}
        />
      ) : (
        <Dashboard session={session} onLogout={handleLogout} onSessionUpdate={updateSession} />
      )}
    </div>
  );
}
