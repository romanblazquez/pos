import { useQuery } from '@tanstack/react-query';
import { useCustomer } from '../context/CustomerContext.js';
import { Card, CardContent, Badge, Button } from '../components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function fmt(minor: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

function relDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 7) return `Hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

const ORDER_BADGE: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default' | 'purple'> = {
  confirmed: 'success', delivered: 'success',
  pending: 'warning', reserved: 'info',
  shipped: 'info', cancelled: 'default', refunded: 'purple',
};
const ORDER_LABEL: Record<string, string> = {
  pending: 'Pendiente', reserved: 'Reservado', confirmed: 'Confirmado',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado',
};

interface Wallet {
  platformCreditsMinor: number;
  storeCredits: { balanceMinor: number; seller: { name: string } }[];
}
interface Order {
  id: string; status: string; totalMinorUnits: number; currency: string; createdAt: string;
  seller: { name: string };
  lines: { quantity: number; listing: { product: { name: string; images: string[] } } }[];
}

export default function AccountPage({ onNavigate }: { onNavigate: (p: 'wallet' | 'orders') => void }) {
  const { session, logout } = useCustomer();
  if (!session) return null;

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ['wallet', session.customer.id],
    queryFn: async () => (await fetch(`${API}/api/v1/customers/${session.customer.id}/wallet`)).json() as Promise<Wallet>,
  });

  const { data: orders } = useQuery<Order[]>({
    queryKey: ['customer-orders', session.customer.id],
    queryFn: async () => (await fetch(`${API}/api/v1/customers/${session.customer.id}/orders?limit=5`)).json() as Promise<Order[]>,
  });

  const totalCredits = (wallet?.platformCreditsMinor ?? 0) + (wallet?.storeCredits.reduce((s, c) => s + c.balanceMinor, 0) ?? 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-[--tx]">
            Hola, {session.customer.name?.split(' ')[0] ?? 'jugador'} 👋
          </h1>
          <p className="text-sm text-[--tx-muted]">{session.customer.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-[--tx-muted] hover:text-red-500 shrink-0">
          Cerrar sesión
        </Button>
      </div>

      {/* Credits hero card */}
      <div
        role="button"
        onClick={() => onNavigate('wallet')}
        className="relative overflow-hidden rounded-2xl cursor-pointer group
                   bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 text-white p-6 shadow-lg"
      >
        {/* Decorative ring */}
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full border border-white/10" />
        <div className="absolute -right-2 -top-2 w-28 h-28 rounded-full border border-white/10" />

        <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-1">Créditos disponibles</p>
        <p className="text-4xl font-bold tracking-tight mb-1">{fmt(totalCredits)}</p>

        {wallet && wallet.storeCredits.length > 0 && (
          <p className="text-emerald-300 text-xs mt-1">
            {fmt(wallet.platformCreditsMinor)} libres
            {wallet.storeCredits.map((sc) => (
              <span key={sc.seller.name}> · {fmt(sc.balanceMinor)} {sc.seller.name}</span>
            ))}
          </p>
        )}

        <div className="mt-4 flex items-center gap-1 text-xs text-emerald-300 group-hover:text-white transition-colors">
          Ver historial de créditos
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <button onClick={() => onNavigate('orders')} className="w-full text-left p-5 hover:bg-[--bg-hover] transition-colors rounded-xl">
            <p className="text-2xl mb-2">🛍️</p>
            <p className="text-2xl font-bold text-[--tx]">{orders?.length ?? '–'}</p>
            <p className="text-sm text-[--tx-muted] font-medium">Pedidos</p>
          </button>
        </Card>
        <Card>
          <button onClick={() => onNavigate('wallet')} className="w-full text-left p-5 hover:bg-[--bg-hover] transition-colors rounded-xl">
            <p className="text-2xl mb-2">🎁</p>
            <p className="text-2xl font-bold text-[--tx]">
              {wallet?.storeCredits.filter((s) => s.balanceMinor > 0).length ?? 0}
            </p>
            <p className="text-sm text-[--tx-muted] font-medium">Tiendas con crédito</p>
          </button>
        </Card>
      </div>

      {/* Recent orders */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[--tx]">Pedidos recientes</h2>
          <button onClick={() => onNavigate('orders')} className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
            Ver todos →
          </button>
        </div>

        {!orders ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-[--bg-subtle] animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="text-3xl">🎲</span>
              <p className="text-sm text-[--tx-muted]">Todavía no hiciste ninguna compra</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((order) => {
              const product = order.lines[0]?.listing?.product;
              return (
                <Card key={order.id}>
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-[--bg-subtle] shrink-0">
                      {product?.images?.[0]
                        ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-lg">🎲</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[--tx] truncate">
                        {product?.name ?? 'Pedido'}
                        {order.lines.length > 1 && <span className="text-[--tx-muted]"> +{order.lines.length - 1}</span>}
                      </p>
                      <p className="text-xs text-[--tx-muted]">{order.seller.name} · {relDate(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-sm font-semibold text-[--tx]">{fmt(order.totalMinorUnits, order.currency)}</p>
                      <Badge variant={ORDER_BADGE[order.status] ?? 'default'}>
                        {ORDER_LABEL[order.status] ?? order.status}
                      </Badge>
                    </div>
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
