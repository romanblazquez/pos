import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import './styles.css';
import { AdminAuth } from './auth/AdminAuth.js';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminAuth><App /></AdminAuth>
    </QueryClientProvider>
  </StrictMode>,
);
