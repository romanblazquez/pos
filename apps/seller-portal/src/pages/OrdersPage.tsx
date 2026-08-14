import { useState, useEffect, useCallback } from 'react';
import type { SellerSession } from '../App.js';
import { Badge } from '../components/ui/index.js';
import { sellerApi } from '../auth/api-client.js';

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

interface OrderEvent {
  id: string;
  type: string;
  payload: { trackingCarrier?: string; trackingNumber?: string; reason?: string } | null;
  createdAt: string;
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
  paymentId: string | null;
  paidOutAt: string | null;
  createdAt: string;
  lines: OrderLine[];
  events: OrderEvent[];
}

// What a seller can move an order to from its current status — mirrors
// SellersService.updateOrderStatus's allowedFrom table exactly, so the UI
// never offers a transition the API would reject.
const NEXT_STATUSES: Record<string, Array<'shipped' | 'delivered' | 'cancelled'>> = {
  pending: ['cancelled'],
  reserved: ['cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};

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
      const res = await sellerApi.fetch(`${API}/api/v1/sellers/${session.seller.id}/orders?${params}`);
      const data = res.ok ? await res.json() as { data: Order[]; total: number } : { data: [], total: 0 };
      setOrders(data.data ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [session.seller.id, page, statusFilter]);

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
    <div className="flex min-h-full flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
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
            className="min-h-10 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 sm:px-4
                       rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* Filter pills */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setStatusFilter(f.id); setPage(1); }}
              className={cn(
                'min-h-9 shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
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
              sellerId={session.seller.id}
              expanded={expanded === order.id}
              onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
              onChanged={fetchOrders}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 pt-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
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

function OrderCard({ order, sellerId, expanded, onToggle, onChanged }: {
  order: Order;
  sellerId: string;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const firstProduct = order.lines[0]?.listing.product;
  const extraLines = order.lines.length - 1;
  const [shipFormOpen, setShipFormOpen] = useState(false);
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFormOpen, setCancelFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const latestShipment = order.events.find((e) => e.type === 'shipped');
  const latestCancellation = order.events.find((e) => e.type === 'cancelled_by_seller');
  const latestRefund = order.events.find((e) => e.type === 'refunded');
  const nextStatuses = NEXT_STATUSES[order.status] ?? [];
  // Mirrors the API's rule: a gateway-captured payment is refunded on cancel,
  // and the order ends as `refunded` rather than `cancelled`.
  const willRefund = Boolean(order.paymentId && order.paymentProvider && order.paymentProvider !== 'wallet_credits');

  async function updateStatus(body: { status: 'shipped' | 'delivered' | 'cancelled'; trackingCarrier?: string; trackingNumber?: string; reason?: string }) {
    setBusy(true);
    setActionError('');
    try {
      const res = await sellerApi.fetch(`${API}/api/v1/sellers/${sellerId}/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? 'No se pudo actualizar el pedido');
      }
      setShipFormOpen(false);
      setCancelFormOpen(false);
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 text-left transition-colors hover:bg-slate-50/60 sm:px-5"
      >
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
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
          <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
            <span className="text-sm font-semibold text-slate-900 tabular sm:w-24 sm:text-right">
              {fmtPrice(order.totalMinorUnits, order.currency)}
            </span>
            <span className="hidden text-xs text-slate-400 sm:inline">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5">
          {/* Lines */}
          <div className="space-y-3">
            {order.lines.map((line) => (
              <div key={line.id} className="flex items-center gap-2 text-sm sm:gap-3">
                <div className="w-8 h-8 rounded-md bg-slate-100 overflow-hidden shrink-0">
                  {line.listing.product.images[0] ? (
                    <img src={line.listing.product.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-200" />
                  )}
                </div>
                <span className="flex-1 text-slate-700 truncate">{line.listing.product.name}</span>
                <span className="text-slate-500 text-xs">×{line.quantity}</span>
                <span className="shrink-0 tabular text-slate-900 font-medium sm:w-20 sm:text-right">
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
            <div className="flex justify-between font-medium text-slate-700 pt-1 border-t border-slate-100">
              <span>Total cobrado al comprador</span>
              <span className="tabular">{fmtPrice(order.totalMinorUnits, order.currency)}</span>
            </div>
            {order.commissionMinorUnits > 0 && (
              <div className="flex justify-between text-slate-400 text-xs">
                <span>Comisión plataforma</span>
                <span className="tabular">−{fmtPrice(order.commissionMinorUnits, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-slate-100">
              <span>Vas a recibir</span>
              <span className="tabular">{fmtPrice(order.totalMinorUnits - order.commissionMinorUnits, order.currency)}</span>
            </div>
            {(order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered') && (
              order.paidOutAt ? (
                <p className="text-xs text-emerald-600 font-medium pt-0.5">
                  ✓ Pago recibido el {fmtDate(order.paidOutAt)}
                </p>
              ) : (
                <p className="text-xs text-amber-600 pt-0.5">⏳ Pago pendiente de transferencia</p>
              )
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-400">
            <span>ID: <span className="font-mono">{order.id.slice(-8)}</span></span>
            {order.paymentProvider && <span>Pago: {order.paymentProvider}</span>}
          </div>

          {latestShipment?.payload?.trackingNumber && (
            <p className="text-xs text-slate-500">
              📦 Enviado{latestShipment.payload.trackingCarrier ? ` por ${latestShipment.payload.trackingCarrier}` : ''}
              {' · '}seguimiento: <span className="font-mono">{latestShipment.payload.trackingNumber}</span>
            </p>
          )}
          {latestCancellation?.payload?.reason && (
            <p className="text-xs text-slate-500">✕ Cancelado: {latestCancellation.payload.reason}</p>
          )}
          {latestRefund && (
            <p className="text-xs text-slate-500">
              ↩ Reembolsado al comprador
              {latestRefund.payload?.reason ? ` · ${latestRefund.payload.reason}` : ''}
            </p>
          )}

          {/* Fulfillment actions */}
          {nextStatuses.length > 0 && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              {actionError && <p className="text-xs text-red-600">{actionError}</p>}

              {!shipFormOpen && !cancelFormOpen && (
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.includes('shipped') && (
                    <button
                      onClick={() => setShipFormOpen(true)}
                      disabled={busy}
                      className="min-h-9 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                      Marcar como enviado
                    </button>
                  )}
                  {nextStatuses.includes('delivered') && (
                    <button
                      onClick={() => updateStatus({ status: 'delivered' })}
                      disabled={busy}
                      className="min-h-9 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                      Marcar como entregado
                    </button>
                  )}
                  {nextStatuses.includes('cancelled') && (
                    <button
                      onClick={() => setCancelFormOpen(true)}
                      disabled={busy}
                      className="min-h-9 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {willRefund ? 'Cancelar y reembolsar' : 'Cancelar pedido'}
                    </button>
                  )}
                </div>
              )}

              {shipFormOpen && (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      value={trackingCarrier}
                      onChange={(e) => setTrackingCarrier(e.target.value)}
                      placeholder="Transportista (opcional)"
                      className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-sm"
                    />
                    <input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="N° de seguimiento (opcional)"
                      className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus({
                        status: 'shipped',
                        trackingCarrier: trackingCarrier || undefined,
                        trackingNumber: trackingNumber || undefined,
                      })}
                      disabled={busy}
                      className="min-h-9 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                      {busy ? 'Guardando…' : 'Confirmar envío'}
                    </button>
                    <button
                      onClick={() => setShipFormOpen(false)}
                      disabled={busy}
                      className="min-h-9 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {cancelFormOpen && (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                  {willRefund && (
                    <p className="text-xs text-amber-700">
                      Este pedido ya fue cobrado. Al cancelarlo se reembolsa el pago completo al comprador
                      y el pedido queda como <strong>reembolsado</strong>. No se puede deshacer.
                    </p>
                  )}
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Motivo de la cancelación"
                    className="min-h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus({ status: 'cancelled', reason: cancelReason || undefined })}
                      disabled={busy}
                      className="min-h-9 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      {busy ? 'Procesando…' : willRefund ? 'Confirmar y reembolsar' : 'Confirmar cancelación'}
                    </button>
                    <button
                      onClick={() => setCancelFormOpen(false)}
                      disabled={busy}
                      className="min-h-9 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
