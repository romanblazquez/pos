import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type AdminView = 'sellers' | 'catalog' | 'orders' | 'sync' | 'ranking';

const NAV: { id: AdminView; icon: string; label: string }[] = [
  { id: 'sellers', icon: '🏪', label: 'Vendedores' },
  { id: 'catalog', icon: '📚', label: 'Catálogo' },
  { id: 'orders', icon: '📋', label: 'Pedidos' },
  { id: 'sync', icon: '🔄', label: 'Sincronización' },
  { id: 'ranking', icon: '⭐', label: 'Ranking' },
];

async function fetchSellers(status?: string) {
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`/api/v1/sellers${qs}`);
  return res.json();
}

export default function App() {
  const [view, setView] = useState<AdminView>('sellers');

  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 bg-slate-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <p className="text-sm font-bold text-white">🎲 BGM Admin</p>
          <p className="text-xs text-slate-400 mt-0.5">Consola de administración</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                view === item.id
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        {view === 'sellers' && <SellersView />}
        {view !== 'sellers' && (
          <div className="flex items-center justify-center h-full min-h-96 text-slate-400">
            <div className="text-center">
              <p className="text-4xl mb-3">🚧</p>
              <p className="font-medium text-slate-600">
                {NAV.find((n) => n.id === view)?.label}
              </p>
              <p className="text-sm mt-1">En desarrollo — Épica 8</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SellersView() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-sellers', statusFilter],
    queryFn: () => fetchSellers(statusFilter || undefined),
  });

  const sellers = (data as { id: string; name: string; email: string; status: string; connectorType: string; commissionRate: number; createdAt: string }[] | undefined) ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Vendedores</h1>
        <div className="flex gap-2">
          {['', 'pending', 'active', 'suspended'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === '' ? 'Todos' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-3xl mb-2">🏪</p>
            <p className="text-sm">No hay vendedores registrados aún.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nombre', 'Email', 'Estado', 'Conector', 'Comisión', 'Acciones'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sellers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{s.connectorType ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {(Number(s.commissionRate) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-blue-600 hover:underline">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700',
    churned: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? styles['churned']}`}>
      {status}
    </span>
  );
}
