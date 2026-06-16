import { useState, useEffect } from 'react';
import type { SellerSession } from '../App.js';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '../components/ui/index.js';
import { Separator } from '../components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function fmtPrice(minor: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayBucket { date: string; orders: number; revenueMinor: number }

interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  shipped: number;
  cancelled: number;
  revenueMinorUnits: number;
  daily: DayBucket[];
}

interface ListingStats {
  total: number;
  active: number;
  outOfStock: number;
  lowStock: number;
}

interface TopProduct {
  name: string;
  image: string | null;
  units: number;
  revenueMinor: number;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function AnalyticsPage({ session }: { session: SellerSession }) {
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [listingStats, setListingStats] = useState<ListingStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${session.token}` };
    const sid = session.seller.id;

    Promise.all([
      fetch(`${API}/api/v1/sellers/${sid}/orders/stats`, { headers }).then((r) => r.json()),
      fetch(`${API}/api/v1/sellers/${sid}/listings/stats`, { headers }).then((r) => r.json()),
      fetch(`${API}/api/v1/sellers/${sid}/analytics/top-products?limit=5`, { headers }).then((r) => r.json()),
    ])
      .then(([os, ls, tp]) => {
        setOrderStats(os as OrderStats);
        setListingStats(ls as ListingStats);
        setTopProducts(tp as TopProduct[]);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [session.seller.id, session.token]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-400">Cargando analíticas…</p>
      </div>
    );
  }

  const currency = 'ARS';
  const revenue = orderStats?.revenueMinorUnits ?? 0;
  const maxDaily = Math.max(...(orderStats?.daily.map((d) => d.revenueMinor) ?? [1]), 1);

  const fulfillmentRate = orderStats && orderStats.total > 0
    ? Math.round(((orderStats.total - (orderStats.cancelled ?? 0)) / orderStats.total) * 100)
    : null;

  const activeRate = listingStats && listingStats.total > 0
    ? Math.round((listingStats.active / listingStats.total) * 100)
    : null;

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Analíticas</p>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Rendimiento</h1>
        <p className="text-sm text-slate-500">Resumen acumulado + últimos 7 días</p>
      </div>

      <Separator />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos totales"
          value={fmtPrice(revenue, currency)}
          note="pedidos no cancelados"
        />
        <KpiCard
          label="Pedidos totales"
          value={String(orderStats?.total ?? 0)}
          note={`${orderStats?.pending ?? 0} pendientes`}
          warn={(orderStats?.pending ?? 0) > 0}
        />
        <KpiCard
          label="Tasa de cumplimiento"
          value={fulfillmentRate !== null ? `${fulfillmentRate}%` : '—'}
          note={`${orderStats?.cancelled ?? 0} cancelados`}
          alert={(orderStats?.cancelled ?? 0) > 0}
        />
        <KpiCard
          label="Catálogo activo"
          value={activeRate !== null ? `${activeRate}%` : '—'}
          note={`${listingStats?.active ?? 0} de ${listingStats?.total ?? 0}`}
        />
      </div>

      {/* Revenue chart (last 7 days) */}
      {orderStats && orderStats.daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ingresos — últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            {revenue === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">Sin ingresos en los últimos 7 días</p>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-36">
                {orderStats.daily.map((d) => {
                  const pct = maxDaily > 0 ? (d.revenueMinor / maxDaily) * 100 : 0;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full flex flex-col justify-end h-28 relative">
                        <div
                          className="w-full bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-600"
                          style={{ height: `${Math.max(pct, 2)}%` }}
                          title={fmtPrice(d.revenueMinor, currency)}
                        />
                        {d.revenueMinor > 0 && (
                          <p className="absolute -top-5 left-0 right-0 text-center text-xs text-slate-500 tabular hidden group-hover:block">
                            {fmtPrice(d.revenueMinor, currency)}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 text-center leading-tight">{fmtShort(d.date)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders by status + Top products */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Order status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos por estado</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {orderStats && orderStats.total > 0 ? (
              [
                { label: 'Confirmados', count: orderStats.confirmed, variant: 'success' as const },
                { label: 'Pendientes',  count: orderStats.pending,   variant: 'warning' as const },
                { label: 'Enviados',    count: orderStats.shipped,   variant: 'default' as const },
                { label: 'Cancelados',  count: orderStats.cancelled, variant: 'destructive' as const },
              ].map(({ label, count, variant }) => {
                const pct = orderStats.total > 0 ? Math.round((count / orderStats.total) * 100) : 0;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={variant}>{label}</Badge>
                      </div>
                      <span className="tabular text-slate-500 text-xs">
                        {count} <span className="text-slate-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          variant === 'success'     ? 'bg-emerald-500' :
                          variant === 'warning'     ? 'bg-amber-400'   :
                          variant === 'destructive' ? 'bg-red-400'     : 'bg-slate-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-400">Sin pedidos todavía</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topProducts.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {topProducts.map((p, i) => {
                  const maxRevenue = topProducts[0].revenueMinor;
                  const pct = maxRevenue > 0 ? Math.round((p.revenueMinor / maxRevenue) * 100) : 0;
                  return (
                    <div key={i} className="py-3 space-y-1.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0">
                          {p.image ? (
                            <img src={p.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-200" />
                          )}
                        </div>
                        <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-slate-900 tabular">
                            {fmtPrice(p.revenueMinor, currency)}
                          </p>
                          <p className="text-xs text-slate-400">{p.units} uds.</p>
                        </div>
                      </div>
                      <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden ml-10">
                        <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-400">Sin ventas registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Catalog health */}
      {listingStats && listingStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Salud del catálogo</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {[
                { label: 'Total',      value: listingStats.total,        color: 'text-slate-900' },
                { label: 'Activos',    value: listingStats.active,       color: 'text-emerald-700' },
                { label: 'Stock bajo', value: listingStats.lowStock,     color: 'text-amber-600'  },
                { label: 'Sin stock',  value: listingStats.outOfStock,   color: 'text-red-600'    },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className={`text-3xl font-semibold tabular ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, note, warn, alert }: {
  label: string; value: string; note?: string; warn?: boolean; alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5 space-y-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-semibold tabular tracking-tight ${
          alert ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-900'
        }`}>
          {value}
        </p>
        {note && <p className="text-xs text-slate-400">{note}</p>}
      </CardContent>
    </Card>
  );
}
