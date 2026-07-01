import { useState, useEffect } from 'react';
import type { BrowserSession } from '@retail-os/api-client';
import OnboardingWizard from './onboarding/OnboardingWizard.js';
import Dashboard from './pages/Dashboard.js';
import AuthGate from './auth/AuthGate.js';
import { sellerApi, API_BASE } from './auth/api-client.js';

export type SellerSession = {
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

export default function App() {
  const [session, setSession] = useState<SellerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oauthBanner, setOauthBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function accept(next: BrowserSession | null): void {
    if (next?.seller) {
      sellerApi.acceptSession(next);
      setSession({ seller: next.seller as SellerSession['seller'] });
    } else {
      sellerApi.clear();
      setSession(null);
    }
  }

  // Silently hydrate a session from the refresh cookie on mount — replaces
  // the old localStorage-persisted access token, which never refreshed and
  // died 10 minutes after login (see apps/api/src/auth/jwt.ts's expiresInSeconds).
  useEffect(() => {
    let active = true;
    sellerApi.setUnauthenticatedHandler(() => setSession(null));
    sellerApi.refresh()
      .then((next) => { if (active) accept(next); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => {
      active = false;
      sellerApi.setUnauthenticatedHandler(undefined);
    };
  }, []);

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
      // Refresh seller profile so connectorType is up to date
      sellerApi.fetch(`${API_BASE}/api/v1/auth/me`)
        .then((r) => r.json())
        .then((seller: SellerSession['seller']) => {
          setSession((prev) => prev ? { ...prev, seller } : prev);
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

  function handleAuth(seller: SellerSession['seller']) {
    setSession({ seller });
  }

  async function handleLogout() {
    await sellerApi.logout();
    setSession(null);
  }

  function updateSession(updates: Partial<SellerSession['seller']>) {
    if (!session) return;
    setSession({ ...session, seller: { ...session.seller, ...updates } });
  }

  if (isLoading) {
    return <div className="grid min-h-dvh place-items-center bg-slate-50 text-sm text-slate-400">Verificando sesión…</div>;
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
