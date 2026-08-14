import { useState, useEffect } from 'react';
import type { SellerSession } from '../App.js';
import { Card, CardContent, CardHeader, CardTitle, Badge, Progress, Separator } from '../components/ui/index.js';
import { sellerApi } from '../auth/api-client.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function fmtPrice(minor: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100);
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
}

interface DayBucket { date: string; orders: number; revenueMinor: number }
interface OrderStats {
  total: number; pending: number; confirmed: number; shipped: number; cancelled: number;
  revenueMinorUnits: number; daily: DayBucket[];
}
interface ListingStats { total: number; active: number; outOfStock: number; lowStock: number }
interface TopProduct { name: string; image: string | null; units: number; revenueMinor: number }

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconRevenue() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.927 0 .218.115.412.33.567z" />
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-15.002V4h-.5a2.5 2.5 0 00-2.5 2.5v.25H7a.75.75 0 000 1.5h1v1.06A5.333 5.333 0 0110 9.5c.536 0 1.044.07 1.5.196V9.25h1a.75.75 0 000-1.5h-1V6.75a2.5 2.5 0 00-2.5-2.5H9V4h.5a.5.5 0 010 1h-.5v.25h.25a1.75 1.75 0 011.75 1.75v.25H10v-.25zm1 8.5v1.748c.354-.118.668-.281.93-.49.402-.32.57-.67.57-.998 0-.32-.148-.63-.47-.896a3.88 3.88 0 00-1.03-.364z" clipRule="evenodd" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M1 1.75A.75.75 0 011.75 1h1.628a1.75 1.75 0 011.734 1.51L5.18 3a65.25 65.25 0 0113.36 1.412.75.75 0 01.58.875 48.645 48.645 0 01-1.618 6.2.75.75 0 01-.712.513H6a2.503 2.503 0 00-2.292 1.5H17.25a.75.75 0 010 1.5H2.76a.75.75 0 01-.748-.807 4.002 4.002 0 012.716-3.486L3.626 2.716a.25.25 0 00-.248-.216H1.75A.75.75 0 011 1.75zM6 17.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

function IconCatalog() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2zM2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5z" />
    </svg>
  );
}

function IconTrendUp() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042-.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5 space-y-3 animate-pulse">
        <div className="h-3 w-20 rounded-full bg-slate-200" />
        <div className="h-8 w-28 rounded-lg bg-slate-200" />
        <div className="h-3 w-16 rounded-full bg-slate-200" />
      </CardContent>
    </Card>
  );
}

function SkeletonChart() {
  return (
    <Card>
      <CardHeader><div className="h-5 w-40 rounded-lg bg-slate-200 animate-pulse" /></CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-36 animate-pulse">
          {[60, 80, 45, 90, 55, 70, 85].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-slate-200" style={{ height: `${h}%` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
] as const;

export default function AnalyticsPage({ session }: { session: SellerSession }) {
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [listingStats, setListingStats] = useState<ListingStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const sid = session.seller.id;
    setLoading(true);

    Promise.all([
      sellerApi.fetch(`${API}/api/v1/sellers/${sid}/orders/stats?days=${days}`).then((r) => r.ok ? r.json() : null),
      sellerApi.fetch(`${API}/api/v1/sellers/${sid}/listings/stats`).then((r) => r.ok ? r.json() : null),
      sellerApi.fetch(`${API}/api/v1/sellers/${sid}/analytics/top-products?limit=5&days=${days}`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([os, ls, tp]) => {
        setOrderStats(os as OrderStats | null);
        setListingStats(ls as ListingStats | null);
        setTopProducts(Array.isArray(tp) ? tp as TopProduct[] : []);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [session.seller.id, days]);

  /**
   * The export is fetched, not linked. A plain <a href> cannot carry the
   * Authorization header this endpoint requires, so a link would download an
   * HTML 401 page named pedidos.csv — which looks like a working export until
   * someone opens it.
   */
  async function exportCsv() {
    setExporting(true);
    try {
      const res = await sellerApi.fetch(
        `${API}/api/v1/sellers/${session.seller.id}/orders/export.csv?days=${days}`,
      );
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Deliberately quiet: the button returns to its resting state, which is
      // the same signal the rest of this page uses for a failed fetch.
    } finally {
      setExporting(false);
    }
  }

  const currency = 'ARS';
  const revenue = orderStats?.revenueMinorUnits ?? 0;
  const maxDaily = Math.max(...(orderStats?.daily?.map((d) => d.revenueMinor) ?? [1]), 1);

  const fulfillmentRate =
    orderStats && orderStats.total > 0
      ? Math.round(((orderStats.total - (orderStats.cancelled ?? 0)) / orderStats.total) * 100)
      : null;

  const activeRate =
    listingStats && listingStats.total > 0
      ? Math.round((listingStats.active / listingStats.total) * 100)
      : null;

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-8">
        <div className="space-y-1">
          <div className="h-3 w-20 rounded-full bg-slate-200 animate-pulse" />
          <div className="h-7 w-44 rounded-lg bg-slate-200 animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonChart />
      </div>
    );
  }

  return (
    <div className="page-enter max-w-5xl space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Panel</p>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Analíticas</h1>
          <p className="text-sm text-slate-500">
            Acumulado total · últimos {RANGES.find((r) => r.days === days)?.label ?? `${days} días`}
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-400">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rango de fechas">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={
                'min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
                (days === r.days
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400')
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium
                     text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      <Separator />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Ingresos totales"
          value={fmtPrice(revenue, currency)}
          note="pedidos no cancelados"
          icon={<IconRevenue />}
          accent="emerald"
        />
        <KpiCard
          label="Pedidos totales"
          value={String(orderStats?.total ?? 0)}
          note={`${orderStats?.pending ?? 0} pendientes`}
          icon={<IconOrders />}
          accent={(orderStats?.pending ?? 0) > 0 ? 'amber' : 'slate'}
        />
        <KpiCard
          label="Cumplimiento"
          value={fulfillmentRate !== null ? `${fulfillmentRate}%` : '—'}
          note={`${orderStats?.cancelled ?? 0} cancelados`}
          icon={<IconCheck />}
          accent={(orderStats?.cancelled ?? 0) > 0 ? 'red' : 'emerald'}
          progress={fulfillmentRate ?? undefined}
        />
        <KpiCard
          label="Catálogo activo"
          value={activeRate !== null ? `${activeRate}%` : '—'}
          note={`${listingStats?.active ?? 0} de ${listingStats?.total ?? 0} listings`}
          icon={<IconCatalog />}
          accent="slate"
          progress={activeRate ?? undefined}
        />
      </div>

      {/* Revenue chart */}
      <Card className="overflow-visible">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Ingresos — últimos {RANGES.find((r) => r.days === days)?.label ?? `${days} días`}</CardTitle>
            {revenue > 0 && (
              <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                <IconTrendUp />
                <span>{fmtPrice(revenue, currency)}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {!orderStats || orderStats.daily.length === 0 || revenue === 0 ? (
            <div className="py-14 text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Sin ingresos esta semana</p>
              <p className="text-xs text-slate-400">Los datos aparecerán cuando tengas ventas confirmadas</p>
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-44 mt-2">
              {orderStats.daily.map((d) => {
                const pct = maxDaily > 0 ? (d.revenueMinor / maxDaily) * 100 : 0;
                const isMax = d.revenueMinor === maxDaily && d.revenueMinor > 0;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="w-full relative flex flex-col justify-end" style={{ height: '152px' }}>
                      {d.revenueMinor > 0 && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                          <div className="bg-slate-900 text-white text-[10px] font-medium px-2 py-0.5 rounded-md shadow-lg">
                            {fmtPrice(d.revenueMinor, currency)}
                          </div>
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t-md transition-all duration-200 ${
                          isMax
                            ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                            : d.revenueMinor > 0
                            ? 'bg-gradient-to-t from-emerald-500 to-emerald-300 group-hover:from-emerald-600 group-hover:to-emerald-400'
                            : 'bg-slate-100'
                        }`}
                        style={{ height: `${Math.max(d.revenueMinor > 0 ? pct : 3, d.revenueMinor > 0 ? 4 : 3)}%` }}
                      />
                    </div>
                    <p className={`text-[11px] text-center leading-tight capitalize ${
                      isMax ? 'text-emerald-600 font-semibold' : 'text-slate-400'
                    }`}>
                      {fmtShort(d.date)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders by status + Top products */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Order status breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Estado de pedidos</CardTitle>
              {orderStats && orderStats.total > 0 && (
                <span className="text-xs text-slate-500 font-medium">{orderStats.total} total</span>
              )}
            </div>
            {/* Stacked mini bar */}
            {orderStats && orderStats.total > 0 && (
              <div className="mt-3 h-2 w-full rounded-full overflow-hidden flex">
                {[
                  { count: orderStats.confirmed, color: 'bg-emerald-500' },
                  { count: orderStats.pending,   color: 'bg-amber-400' },
                  { count: orderStats.shipped,   color: 'bg-blue-400' },
                  { count: orderStats.cancelled, color: 'bg-red-400' },
                ].map(({ count, color }, i) => {
                  const pct = orderStats.total > 0 ? (count / orderStats.total) * 100 : 0;
                  return pct > 0 ? (
                    <div key={i} className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  ) : null;
                })}
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {orderStats && orderStats.total > 0 ? (
              [
                { label: 'Confirmados', count: orderStats.confirmed, color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
                { label: 'Pendientes',  count: orderStats.pending,   color: 'bg-amber-400',   textColor: 'text-amber-700',   bgColor: 'bg-amber-50' },
                { label: 'Enviados',    count: orderStats.shipped,   color: 'bg-blue-400',    textColor: 'text-blue-700',    bgColor: 'bg-blue-50' },
                { label: 'Cancelados',  count: orderStats.cancelled, color: 'bg-red-400',     textColor: 'text-red-700',     bgColor: 'bg-red-50' },
              ].map(({ label, count, color, textColor, bgColor }) => {
                const pct = orderStats.total > 0 ? Math.round((count / orderStats.total) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{label}</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${textColor} ${bgColor}`}>
                          {count} <span className="font-normal opacity-70">· {pct}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState icon="orders" text="Sin pedidos todavía" sub="Aquí verás el desglose cuando lleguen pedidos" />
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Más vendidos</CardTitle>
              {topProducts.length > 0 && (
                <span className="text-xs text-slate-500 font-medium">Top {topProducts.length}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {topProducts.length > 0 ? (
              <div className="space-y-1">
                {topProducts.map((p, i) => {
                  const maxRevenue = topProducts[0].revenueMinor;
                  const pct = maxRevenue > 0 ? Math.round((p.revenueMinor / maxRevenue) * 100) : 0;
                  const medal = i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-slate-300';
                  return (
                    <div key={i} className="group flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className={`text-sm font-bold tabular w-4 shrink-0 text-center ${medal}`}>{i + 1}</span>
                      <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 ring-1 ring-slate-200">
                        {p.image ? (
                          <img src={p.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm text-slate-800 font-medium truncate leading-none">{p.name}</p>
                        <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-slate-900 tabular">{fmtPrice(p.revenueMinor, currency)}</p>
                        <p className="text-[10px] text-slate-400">{p.units} uds.</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="products" text="Sin ventas registradas" sub="Los productos más vendidos aparecerán aquí" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Catalog health */}
      {listingStats && listingStats.total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Salud del catálogo</CardTitle>
              <Badge variant={
                listingStats.outOfStock > 0 ? 'destructive' :
                listingStats.lowStock > 0   ? 'warning'     : 'success'
              }>
                {listingStats.outOfStock > 0
                  ? `${listingStats.outOfStock} sin stock`
                  : listingStats.lowStock > 0
                  ? `${listingStats.lowStock} con stock bajo`
                  : 'Catálogo saludable'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col items-center gap-5 min-[460px]:flex-row min-[460px]:items-center min-[460px]:gap-8">
              {/* Donut */}
              <div className="relative shrink-0">
                <div
                  className="w-24 h-24 rounded-full"
                  style={{
                    background: `conic-gradient(
                      #10b981 0% ${(listingStats.active / listingStats.total) * 100}%,
                      #f59e0b ${(listingStats.active / listingStats.total) * 100}% ${((listingStats.active + listingStats.lowStock) / listingStats.total) * 100}%,
                      #ef4444 ${((listingStats.active + listingStats.lowStock) / listingStats.total) * 100}% ${((listingStats.active + listingStats.lowStock + listingStats.outOfStock) / listingStats.total) * 100}%,
                      #e2e8f0 ${((listingStats.active + listingStats.lowStock + listingStats.outOfStock) / listingStats.total) * 100}% 100%
                    )`,
                  }}
                >
                  <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900 leading-none">{activeRate}%</p>
                      <p className="text-[9px] text-slate-400 leading-none mt-0.5">activos</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="grid w-full flex-1 grid-cols-2 gap-x-4 gap-y-3 min-[460px]:gap-x-8">
                {[
                  { label: 'Total listings',   value: listingStats.total,       color: 'bg-slate-200', text: 'text-slate-700' },
                  { label: 'Activos',          value: listingStats.active,      color: 'bg-emerald-500', text: 'text-emerald-700' },
                  { label: 'Stock bajo',       value: listingStats.lowStock,    color: 'bg-amber-400',   text: 'text-amber-700' },
                  { label: 'Sin stock',        value: listingStats.outOfStock,  color: 'bg-red-400',     text: 'text-red-700' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-sm shrink-0 ${s.color}`} />
                    <div>
                      <p className={`text-sm font-semibold tabular ${s.text}`}>{s.value}</p>
                      <p className="text-[11px] text-slate-400 leading-none">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Health bars */}
            <div className="mt-5 space-y-2.5">
              <HealthBar label="Activos" value={listingStats.active} total={listingStats.total} color="bg-emerald-500" />
              <HealthBar label="Stock bajo" value={listingStats.lowStock} total={listingStats.total} color="bg-amber-400" />
              <HealthBar label="Sin stock" value={listingStats.outOfStock} total={listingStats.total} color="bg-red-400" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, note, icon, accent, progress }: {
  label: string; value: string; note?: string;
  icon: React.ReactNode; accent: 'emerald' | 'amber' | 'red' | 'slate';
  progress?: number;
}) {
  const iconBg = {
    emerald: 'bg-emerald-100 text-emerald-600',
    amber:   'bg-amber-100 text-amber-600',
    red:     'bg-red-100 text-red-600',
    slate:   'bg-slate-100 text-slate-500',
  }[accent];
  const valueColor = {
    emerald: 'text-slate-900',
    amber:   'text-amber-700',
    red:     'text-red-600',
    slate:   'text-slate-900',
  }[accent];

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardContent className="space-y-2 px-3 pb-3 pt-4 sm:space-y-3 sm:px-5 sm:pb-4 sm:pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
        </div>
        <p className={`break-words text-xl font-bold tabular tracking-tight sm:text-2xl ${valueColor}`}>{value}</p>
        {progress !== undefined && (
          <Progress
            value={progress}
            className={`h-1 ${accent === 'red' ? '[&>div]:bg-red-400' : accent === 'amber' ? '[&>div]:bg-amber-400' : ''}`}
          />
        )}
        {note && <p className="text-xs text-slate-400">{note}</p>}
      </CardContent>
    </Card>
  );
}

function HealthBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right tabular">{pct}%</span>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: 'orders' | 'products'; text: string; sub: string }) {
  return (
    <div className="py-10 text-center space-y-2">
      <div className="mx-auto w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
        {icon === 'orders' ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M1 1.75A.75.75 0 011.75 1h1.628a1.75 1.75 0 011.734 1.51L5.18 3a65.25 65.25 0 0113.36 1.412.75.75 0 01.58.875 48.645 48.645 0 01-1.618 6.2.75.75 0 01-.712.513H6a2.503 2.503 0 00-2.292 1.5H17.25a.75.75 0 010 1.5H2.76a.75.75 0 01-.748-.807 4.002 4.002 0 012.716-3.486L3.626 2.716a.25.25 0 00-.248-.216H1.75A.75.75 0 011 1.75zM6 17.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2zM2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5z" />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500">{text}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
