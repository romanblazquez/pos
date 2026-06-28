import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BrowserSession } from '@retail-os/api-client';
import { API_BASE, marketplaceApi } from '../lib/api-client.js';

export interface Customer {
  id: string;
  email: string;
  name?: string | null;
}

interface CustomerSession {
  customer: Customer;
}

interface CustomerCtx {
  session: CustomerSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (credential: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<CustomerCtx | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    marketplaceApi.setUnauthenticatedHandler(() => {
      setSession(null);
      queryClient.clear();
    });
    marketplaceApi.refresh()
      .then((next) => { if (active) accept(next); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => {
      active = false;
      marketplaceApi.setUnauthenticatedHandler(undefined);
    };
  }, [queryClient]);

  function accept(next: BrowserSession | null): void {
    if (next?.customer) {
      marketplaceApi.acceptSession(next);
      setSession({ customer: next.customer });
    } else {
      marketplaceApi.clear();
      setSession(null);
    }
  }

  async function passwordRequest(path: string, body: Record<string, string>) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(error.message ?? 'No se pudo iniciar sesión');
    }
    accept(await response.json() as BrowserSession);
  }

  function login(email: string, password: string) {
    return passwordRequest('/api/v1/auth/customer/login', { email, password });
  }

  function register(email: string, password: string, name: string) {
    return passwordRequest('/api/v1/auth/customer/register', { email, password, name });
  }

  async function loginWithGoogle(credential: string, state: string) {
    const response = await fetch(`${API_BASE}/api/v1/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: 'marketplace', credential, state }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(error.message ?? 'Google no pudo verificar la cuenta');
    }
    accept(await response.json() as BrowserSession);
  }

  async function logout() {
    await marketplaceApi.logout();
    setSession(null);
    queryClient.clear();
  }

  return (
    <Ctx.Provider value={{ session, isLoading, login, register, loginWithGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCustomer outside CustomerProvider');
  return ctx;
}
