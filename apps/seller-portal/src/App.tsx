import { useState } from 'react';
import OnboardingWizard from './onboarding/OnboardingWizard.js';
import Dashboard from './pages/Dashboard.js';

type PortalView = 'onboarding' | 'dashboard';

// Temporary auth stub — will be replaced with real JWT auth in Epic 2
function useSellerAuth() {
  const stored = localStorage.getItem('seller-portal.seller-id');
  return { sellerId: stored, isOnboarded: !!stored };
}

export default function App() {
  const { isOnboarded } = useSellerAuth();
  const [view, setView] = useState<PortalView>(
    isOnboarded ? 'dashboard' : 'onboarding',
  );

  return (
    <div className="min-h-screen">
      {view === 'onboarding' && (
        <OnboardingWizard onComplete={() => setView('dashboard')} />
      )}
      {view === 'dashboard' && <Dashboard />}
    </div>
  );
}
