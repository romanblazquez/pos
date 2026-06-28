import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthenticatedUser, BrowserSession } from '@retail-os/api-client';
import { GoogleSignInButton } from '@retail-os/ui-react';
import { adminApi, API_BASE } from './api-client.js';

interface AdminAuthContextValue {
  user: AuthenticatedUser;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const clientId = import.meta.env.VITE_GOOGLE_ADMIN_CLIENT_ID;

  useEffect(() => {
    let active = true;
    adminApi.setUnauthenticatedHandler(() => {
      setUser(null);
      queryClient.clear();
    });
    adminApi.refresh()
      .then((session) => { if (active && session?.user.role === 'admin') setUser(session.user); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      adminApi.setUnauthenticatedHandler(undefined);
    };
  }, [queryClient]);

  async function googleLogin(credential: string, state: string) {
    setError('');
    const response = await fetch(`${API_BASE}/api/v1/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: 'admin', credential, state }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? 'La cuenta no tiene acceso administrativo');
    }
    const session = adminApi.acceptSession(await response.json() as BrowserSession);
    if (session.user.role !== 'admin') throw new Error('Invalid admin session');
    setUser(session.user);
  }

  async function logout() {
    await adminApi.logout();
    queryClient.clear();
    setUser(null);
  }

  if (loading) {
    return <div className="grid min-h-dvh place-items-center bg-slate-950 text-sm text-slate-400">Verificando sesión…</div>;
  }

  if (!user) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-white">
        <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Retail OS</p>
          <h1 className="mt-2 text-2xl font-bold">Administración</h1>
          <p className="mt-2 text-sm text-slate-400">Acceso exclusivo para administradores autorizados.</p>
          <div className="mt-6">
            <GoogleSignInButton
              app="admin"
              clientId={clientId}
              apiBase={API_BASE}
              theme="filled_black"
              onError={setError}
              onCredential={async (credential, state) => {
                try { await googleLogin(credential, state); }
                catch (loginError) {
                  setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión');
                }
              }}
            />
          </div>
          {!clientId && <p className="mt-4 text-sm text-amber-300">Falta VITE_GOOGLE_ADMIN_CLIENT_ID.</p>}
          {error && <p className="mt-4 rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-200">{error}</p>}
        </section>
      </main>
    );
  }

  return <AdminAuthContext.Provider value={{ user, logout }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error('useAdminAuth outside AdminAuth');
  return value;
}
