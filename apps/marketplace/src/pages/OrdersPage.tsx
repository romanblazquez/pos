import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useCustomer } from '../context/CustomerContext.js';
import { useMarket } from '../context/MarketContext.js';
import { Card, CardContent, Badge, fmtExact } from '../components/ui/index.js';
import { API_BASE, marketplaceApi } from '../lib/api-client.js';
import { formatMoney as sharedFormatMoney } from '@retail-os/ui-react';

function fmt(minor: number, currency = 'MXN') {
  return sharedFormatMoney({ minorUnits: minor, currency }, undefined, 0);
}

const ORDER_BADGE: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default' | 'purple'> = {
  confirmed: 'success', delivered: 'success',
  pending: 'warning', reserved: 'info',
  shipped: 'info', cancelled: 'default', refunded: 'purple',
};
const ORDER_STATUS_KEYS: Record<string, string> = {
  pending: 'orders.statusPending', reserved: 'orders.statusReserved', confirmed: 'orders.statusConfirmed',
  shipped: 'orders.statusShipped', delivered: 'orders.statusDelivered', cancelled: 'orders.statusCancelled', refunded: 'orders.statusRefunded',
};

const STEP_KEY = ['pending', 'reserved', 'confirmed', 'shipped', 'delivered'];

interface OrderLine {
  quantity: number;
  unitPriceMinorUnits: number;
  listing: { product: { name: string; slug: string; images: string[] } };
}
interface Order {
  id: string; status: string; totalMinorUnits: number; currency: string; createdAt: string;
  platformCreditsApplied: number; storeCreditsApplied: number; paymentProvider: string | null;
  seller: { name: string; slug: string };
  lines: OrderLine[];
}

const PAYMENT_PROVIDER_KEYS: Record<string, string> = {
  wallet_credits: 'orders.paymentWalletCredits',
};

export default function OrdersPage() {
  const { session } = useCustomer();
  const intl = useIntl();
  const { uiLocale } = useMarket();
  if (!session) return null;
  const [expanded, setExpanded] = useState<string | null>(null);
  const qc = useQueryClient();
  const reconciledRef = useRef(new Set<string>());

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['customer-orders', session.customer.id],
    queryFn: async () => (await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${session.customer.id}/orders`)).json() as Promise<Order[]>,
  });

  // Self-heal stale "pending" orders — MercadoPago's webhook/redirect can miss
  // (e.g. local dev without a public webhook URL), so re-check with MP directly
  // whenever this page is viewed instead of relying solely on the one-shot
  // redirect-page effect in App.tsx.
  useEffect(() => {
    const pending = (orders ?? []).filter(
      (o) => o.status === 'pending' && !reconciledRef.current.has(o.id),
    );
    if (pending.length === 0) return;
    pending.forEach((o) => reconciledRef.current.add(o.id));

    Promise.all(
      pending.map((o) =>
        marketplaceApi.fetch(`${API_BASE}/api/v1/checkout/orders/${o.id}/reconcile`, { method: 'POST' }).catch(() => null),
      ),
    ).then(() => qc.invalidateQueries({ queryKey: ['customer-orders', session.customer.id] }));
  }, [orders, qc, session.customer.id]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-[--tx]">{intl.formatMessage({ id: 'orders.title' })}</h1>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-[--bg-subtle] animate-pulse" />)}
        </div>
      ) : !orders || orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-5xl">🎲</span>
            <p className="text-base font-medium text-[--tx]">{intl.formatMessage({ id: 'orders.emptyTitle' })}</p>
            <p className="text-sm text-[--tx-muted]">{intl.formatMessage({ id: 'orders.emptyHint' })}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            const stepIdx = STEP_KEY.indexOf(order.status);
            const isActive = stepIdx >= 0;

            return (
              <Card key={order.id} className="overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full flex items-center gap-3 bg-[--bg-raised] p-4 text-left transition-colors hover:bg-[--bg-hover]"
                >
                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-[--bg-subtle] shrink-0">
                    {order.lines[0]?.listing?.product?.images?.[0]
                      ? <img src={order.lines[0].listing.product.images[0]} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">🎲</div>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[--tx] truncate">
                      {order.lines[0]?.listing?.product?.name ?? intl.formatMessage({ id: 'orders.fallbackName' })}
                      {order.lines.length > 1 && <span className="text-[--tx-muted] font-normal"> +{order.lines.length - 1}</span>}
                    </p>
                    <p className="text-xs text-[--tx-muted]">
                      {order.seller.name} · {new Date(order.createdAt).toLocaleDateString(uiLocale === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-bold text-[--tx]">{fmt(order.totalMinorUnits, order.currency)}</p>
                    <Badge variant={ORDER_BADGE[order.status] ?? 'default'}>
                      {ORDER_STATUS_KEYS[order.status] ? intl.formatMessage({ id: ORDER_STATUS_KEYS[order.status] }) : order.status}
                    </Badge>
                  </div>

                  <svg
                    className={`w-4 h-4 text-[--tx-faint] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div className="border-t border-[--border] p-4 flex flex-col gap-5">

                    {/* Progress bar */}
                    {isActive && (
                      <div className="flex flex-col gap-2">
                        <div className="relative h-1.5 bg-[--bg-subtle] rounded-full">
                          <div
                            className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${(stepIdx / (STEP_KEY.length - 1)) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between">
                          {STEP_KEY.map((key, i) => (
                            <span
                              key={key}
                              className={`text-[10px] text-center ${i <= stepIdx ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-[--tx-faint]'}`}
                            >
                              {intl.formatMessage({ id: ORDER_STATUS_KEYS[key] })}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Line items */}
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-[--tx-muted] uppercase tracking-wider">{intl.formatMessage({ id: 'orders.products' })}</p>
                      {order.lines.map((line, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-[--bg-subtle] shrink-0">
                            {line.listing?.product?.images?.[0]
                              ? <img src={line.listing.product.images[0]} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-sm">🎲</div>}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-[--tx]">{line.listing?.product?.name}</p>
                            <p className="text-xs text-[--tx-muted]">{intl.formatMessage({ id: 'orders.quantity' }, { quantity: line.quantity })}</p>
                          </div>
                          <p className="text-sm font-medium text-[--tx]">
                            {fmt((line.unitPriceMinorUnits ?? 0) * line.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Meta */}
                    {(() => {
                      const creditsApplied = (order.platformCreditsApplied ?? 0) + (order.storeCreditsApplied ?? 0);
                      const gatewayLabel = order.paymentProvider === 'mercadopago_checkout_pro'
                        ? 'MercadoPago'
                        : intl.formatMessage({ id: PAYMENT_PROVIDER_KEYS[order.paymentProvider ?? ''] ?? 'orders.paymentCard' });
                      // Exact (2-decimal) figures throughout — the amounts always sum
                      // correctly because nothing here is rounded for display.
                      const paidViaGateway = order.totalMinorUnits - creditsApplied;
                      return (
                        <div className="border-t border-[--border] pt-3 flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs text-[--tx-muted]">
                            <span>{intl.formatMessage({ id: 'orders.id' })}</span>
                            <code className="font-mono text-[10px] bg-[--bg-subtle] px-1.5 py-0.5 rounded">{order.id.slice(-12)}</code>
                          </div>
                          <div className="flex justify-between text-xs text-[--tx-muted]">
                            <span>{intl.formatMessage({ id: 'orders.seller' })}</span>
                            <span>{order.seller.name}</span>
                          </div>

                          {creditsApplied > 0 && (
                            <>
                              <div className="flex justify-between text-xs text-[--tx-muted] pt-1">
                                <span>{intl.formatMessage({ id: 'orders.orderTotal' })}</span>
                                <span className="tabular">{fmtExact(order.totalMinorUnits, order.currency)}</span>
                              </div>
                              <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                                <span>{intl.formatMessage({ id: 'orders.creditsApplied' })}</span>
                                <span className="tabular">−{fmtExact(creditsApplied, order.currency)}</span>
                              </div>
                            </>
                          )}

                          <div className="flex justify-between text-sm font-bold text-[--tx] pt-1 border-t border-[--border]">
                            <span>
                              {paidViaGateway > 0
                                ? intl.formatMessage({ id: 'orders.totalPaidWithMethod' }, { method: gatewayLabel })
                                : intl.formatMessage({ id: 'orders.totalPaid' })}
                            </span>
                            <span className="tabular">{fmtExact(paidViaGateway, order.currency)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
