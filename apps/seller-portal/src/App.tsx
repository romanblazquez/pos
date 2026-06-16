import { useState } from 'react';
import OnboardingWizard from './onboarding/OnboardingWizard.js';
import Dashboard from './pages/Dashboard.js';
import AuthGate from './auth/AuthGate.js';

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

  function handleAuth(s: SellerSession) {
    localStorage.setItem('seller-portal.session', JSON.stringify(s));
    setSession(s);
  }

  function handleLogout() {
    localStorage.removeItem('seller-portal.session');
    setSession(null);
  }

  if (!session) {
    return <AuthGate onAuth={handleAuth} />;
  }

  const needsOnboarding = session.seller.onboardingStep !== 'complete';

  return (
    <div className="min-h-screen">
      {needsOnboarding ? (
        <OnboardingWizard
          session={session}
          onComplete={(updated) => {
            const next = { ...session, seller: { ...session.seller, ...updated } };
            localStorage.setItem('seller-portal.session', JSON.stringify(next));
            setSession(next);
          }}
        />
      ) : (
        <Dashboard session={session} onLogout={handleLogout} />
      )}
    </div>
  );
}
