import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const STORAGE_KEY = 'mkt_customer';

export interface Customer {
  id: string;
  email: string;
  name?: string | null;
}

interface CustomerSession {
  token: string;
  customer: Customer;
}

interface CustomerCtx {
  session: CustomerSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<CustomerCtx | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as CustomerSession);
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  function persist(s: CustomerSession | null) {
    setSession(s);
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/api/v1/auth/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? 'Credenciales inválidas');
    }
    const data = await res.json() as CustomerSession;
    persist(data);
  }

  async function register(email: string, password: string, name: string) {
    const res = await fetch(`${API}/api/v1/auth/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? 'No se pudo crear la cuenta');
    }
    const data = await res.json() as CustomerSession;
    persist(data);
  }

  function logout() {
    persist(null);
  }

  return (
    <Ctx.Provider value={{ session, isLoading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCustomer outside CustomerProvider');
  return ctx;
}
