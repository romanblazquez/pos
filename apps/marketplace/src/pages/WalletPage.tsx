import { useQuery } from '@tanstack/react-query';
import { useCustomer } from '../context/CustomerContext.js';
import { Card, CardContent } from '../components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function fmt(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

const TX_META: Record<string, { icon: string; color: string; sign: string }> = {
  earn_platform: { icon: '🎁', color: 'text-emerald-600 dark:text-emerald-400', sign: '+' },
  earn_store:    { icon: '🏪', color: 'text-emerald-600 dark:text-emerald-400', sign: '+' },
  redeem_platform: { icon: '✅', color: 'text-[--tx-muted]', sign: '−' },
  redeem_store:    { icon: '✅', color: 'text-[--tx-muted]', sign: '−' },
};

interface StoreCredit { balanceMinor: number; seller: { id: string; name: string } }
interface Wallet { platformCreditsMinor: number; storeCredits: StoreCredit[] }
interface Transaction { id: string; type: string; amountMinor: number; description: string; createdAt: string }

export default function WalletPage() {
  const { session } = useCustomer();
  if (!session) return null;

  const { data: wallet, isLoading: wl } = useQuery<Wallet>({
    queryKey: ['wallet', session.customer.id],
    queryFn: async () => {
      const res = await fetch(`${API}/api/v1/customers/${session.customer.id}/wallet`);
      if (!res.ok) throw new Error(`wallet fetch failed: ${res.status}`);
      return res.json() as Promise<Wallet>;
    },
    retry: false,
  });

  const { data: txs, isLoading: tl } = useQuery<Transaction[]>({
    queryKey: ['wallet-transactions', session.customer.id],
    queryFn: async () => {
      const res = await fetch(`${API}/api/v1/customers/${session.customer.id}/wallet/transactions`);
      if (!res.ok) throw new Error(`transactions fetch failed: ${res.status}`);
      return res.json() as Promise<Transaction[]>;
    },
    retry: false,
  });

  const totalStore = wallet?.storeCredits?.reduce((s, c) => s + c.balanceMinor, 0) ?? 0;
  const activeStores = wallet?.storeCredits?.filter((s) => s.balanceMinor > 0) ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-[--tx]">Mi Wallet</h1>

      {/* Balance card */}
      {wl ? (
        <div className="h-36 rounded-2xl bg-[--bg-subtle] animate-pulse" />
      ) : (
        <Card className="overflow-hidden">
          {/* Platform credits */}
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white p-5 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Créditos libres</p>
              <p className="text-3xl font-bold">{fmt(wallet?.platformCreditsMinor ?? 0)}</p>
              <p className="text-emerald-300 text-xs">Usables en cualquier tienda</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-950 flex items-center justify-center text-2xl shrink-0">🎁</div>
          </div>

          {/* Store credits */}
          {activeStores.length > 0 && (
            <CardContent className="pt-4">
              <p className="text-xs font-semibold text-[--tx-muted] uppercase tracking-wider mb-3">Créditos por tienda</p>
              <div className="flex flex-col gap-2">
                {activeStores.map((sc) => (
                  <div key={sc.seller.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-[--tx]">
                      <span>🏪</span>
                      <span>{sc.seller.name}</span>
                    </div>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmt(sc.balanceMinor)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[--border] flex items-center justify-between text-sm">
                <span className="text-[--tx-muted]">Total créditos de tienda</span>
                <span className="font-bold text-[--tx]">{fmt(totalStore)}</span>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Explainer */}
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800
                      bg-emerald-50 dark:bg-emerald-950 p-4 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">¿Cómo funcionan los créditos?</p>
        <ul className="text-xs text-emerald-700 dark:text-emerald-400 flex flex-col gap-1">
          <li>🎁 <strong>Créditos libres</strong>: 1% de cada compra, válidos en todo el marketplace.</li>
          <li>🏪 <strong>Créditos de tienda</strong>: bonus de cada tienda, sólo usables ahí.</li>
          <li>✅ Se aplican automáticamente al hacer tu próximo checkout.</li>
        </ul>
      </div>

      {/* Transaction history */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-[--tx]">Historial de movimientos</h2>

        {tl ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-[--bg-subtle] animate-pulse" />)}
          </div>
        ) : !txs || txs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="text-3xl">📭</span>
              <p className="text-sm text-[--tx-muted]">Todavía no hay movimientos</p>
              <p className="text-xs text-[--tx-faint]">Comprá algo para empezar a ganar créditos</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-1.5">
            {txs.map((tx) => {
              const meta = TX_META[tx.type] ?? { icon: tx.amountMinor > 0 ? '➕' : '➖', color: 'text-[--tx-muted]', sign: tx.amountMinor > 0 ? '+' : '−' };
              return (
                <Card key={tx.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xl shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[--tx] truncate">{tx.description}</p>
                      <p className="text-xs text-[--tx-muted]">
                        {new Date(tx.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${meta.color}`}>
                      {meta.sign}{fmt(Math.abs(tx.amountMinor))}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
