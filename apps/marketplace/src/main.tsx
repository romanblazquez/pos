import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import './styles.css';
import { initializeAnalytics } from './analytics.js';
import { firstPartyAnalytics } from './analytics.js';
import { ConsentBanner } from '@retail-os/ui-react';

// Temporary operator switch. Hiding the UI does not grant optional consent:
// first-party identifiers, GA and advertising tags remain off by default.
const CONSENT_UI_ENABLED = (import.meta.env.VITE_CONSENT_UI_ENABLED ?? 'false') === 'true';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

initializeAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {CONSENT_UI_ENABLED
        ? <ConsentBanner analytics={firstPartyAnalytics} locale="es" />
        : null}
    </QueryClientProvider>
  </StrictMode>,
);
