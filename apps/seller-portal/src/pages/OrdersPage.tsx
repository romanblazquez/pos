import { useState, useEffect, useCallback } from 'react';
import type { SellerSession } from '../App.js';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '../components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const PAGE_SIZE = 20;

function cn(...c: (string | boolean | undefined | null)[]) { return c.filter(Boolean).join(' '); }

function fmtPrice(minor: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderLine {
  id: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  listing: {
    product: { name: string; images: string[]; slug: string };
  };
}

interface Order {
  id: string;
  status: string;
  currency: string;
  subtotalMinorUnits: number;
  shippingMinorUnits: number;
  totalMinorUnits: number;
  commissionMinorUnits: number;
  paymentProvider: string | null;
  createdAt: string;
  lines: OrderLine[];
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', reserved: 'Reservado', confirmed: 'Confirmado',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado',
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'> = {
  pending: 'warning', reserved: 'warning', confirmed: 'success',
  shipped: 'default', delivered: 'success', cancelled: 'destructive', refunded: 'secondary',
};

// ─── Main ────────────────────────────────────────────────────────────────────

export default function OrdersPage({ session }: { session: SellerSession }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${API}/api/v1/sellers/${session.seller.id}/orders?${params}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const data = await res.json() as { orders: Order[]; total: number };
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [session.seller.id, session.token, page, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'confirmed', label: 'Confirmados' },
    { id: 'shipped', label: 'Enviados' },
    { id: 'delivered', label: 'Entregados' },
    { id: 'cancelled', label: 'Cancelados' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Pedidos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total.toLocaleString('es-AR')} pedidos en total
            </p>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300
                       rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-8 py-6 space-y-5">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setStatusFilter(f.id); setPage(1); }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                statusFilter === f.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Order list */}
        <div className="space-y-2">
          {loading && orders.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-sm text-slate-400">Cargando pedidos…</p>
            </div>
          )}

          {!loading && orders.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-1">
              <p className="text-sm font-medium text-slate-500">Sin pedidos</p>
              <p className="text-xs text-slate-400">
                {statusFilter === 'all'
                  ? 'Los pedidos del marketplace aparecerán aquí.'
                  : 'No hay pedidos con este estado.'}
              </p>
            </div>
          )}

          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expanded === order.id}
              onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString('es-AR')}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600
                           hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-600 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium tabular">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600
                           hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, expanded, onToggle }: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const firstProduct = order.lines[0]?.listing.product;
  const extraLines = order.lines.length - 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
            {firstProduct?.images[0] ? (
              <img src={firstProduct.images[0]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-200" />
            )}
          </div>

          {/* Description */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {firstProduct?.name ?? 'Pedido'}
              {extraLines > 0 && (
                <span className="text-slate-400 font-normal"> +{extraLines} más</span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtDate(order.createdAt)} · {fmtTime(order.createdAt)}
            </p>
          </div>

          {/* Status + total */}
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
            <span className="text-sm font-semibold text-slate-900 tabular w-24 text-right">
              {fmtPrice(order.totalMinorUnits, order.currency)}
            </span>
            <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {/* Lines */}
          <div className="space-y-3">
            {order.lines.map((line) => (
              <div key={line.id} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-md bg-slate-100 overflow-hidden shrink-0">
                  {line.listing.product.images[0] ? (
                    <img src={line.listing.product.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-200" />
                  )}
                </div>
                <span className="flex-1 text-slate-700 truncate">{line.listing.product.name}</span>
                <span className="text-slate-500 text-xs">×{line.quantity}</span>
                <span className="tabular text-slate-900 font-medium w-20 text-right">
                  {fmtPrice(line.lineTotalMinor, order.currency)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tabular">{fmtPrice(order.subtotalMinorUnits, order.currency)}</span>
            </div>
            {order.shippingMinorUnits > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Envío</span>
                <span className="tabular">{fmtPrice(order.shippingMinorUnits, order.currency)}</span>
              </div>
            )}
            {order.commissionMinorUnits > 0 && (
              <div className="flex justify-between text-slate-400 text-xs">
                <span>Comisión plataforma</span>
                <span className="tabular">−{fmtPrice(order.commissionMinorUnits, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-slate-100">
              <span>Total</span>
              <span className="tabular">{fmtPrice(order.totalMinorUnits, order.currency)}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
            <span>ID: <span className="font-mono">{order.id.slice(-8)}</span></span>
            {order.paymentProvider && <span>Pago: {order.paymentProvider}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
