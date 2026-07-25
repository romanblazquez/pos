import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import './styles.css';
import { initializeAnalytics } from './analytics.js';
import { firstPartyAnalytics } from './analytics.js';
import { ConsentBanner } from '@retail-os/ui-react';

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
      <ConsentBanner analytics={firstPartyAnalytics} locale="es" />
    </QueryClientProvider>
  </StrictMode>,
);
