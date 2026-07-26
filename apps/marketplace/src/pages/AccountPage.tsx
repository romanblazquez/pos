import { useQuery } from '@tanstack/react-query';
import { useCustomer } from '../context/CustomerContext.js';
import { useAddresses } from '../hooks/useAddresses.js';
import { useWallet } from '../hooks/useWallet.js';
import { useShelf } from '../context/ShelfContext.js';
import { SHELF_STATUS_META, SHELF_STATUS_ORDER } from '../shelf-meta.js';
import { useXPInfo, XP_TIERS } from '../hooks/useXP.js';
import { XPProgressRing } from '../components/XPProgressRing.js';
import { Card, CardContent, Badge, Button } from '../components/ui/index.js';
import { API_BASE, marketplaceApi } from '../lib/api-client.js';
import { formatMoney as sharedFormatMoney } from '@retail-os/ui-react';
import { useIntl } from 'react-intl';

function fmt(minor: number, currency = 'MXN') {
  return sharedFormatMoney({ minorUnits: minor, currency }, undefined, 0);
}

function relDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Ahora';
  if (h < 1) return `Hace ${m} min`;
  if (d === 0) return `Hace ${h}h`;
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

interface Order {
  id: string; status: string; totalMinorUnits: number; currency: string; createdAt: string;
  platformCreditsApplied: number; storeCreditsApplied: number;
  seller: { name: string };
  lines: { quantity: number; listing: { product: { name: string; images: string[] } } }[];
}

const XP_EARN_ACTIONS = [
  { icon: '⭐', label: 'Escribir una reseña', desc: 'Comparte tu experiencia con la comunidad', xp: 40 },
  { icon: '📸', label: 'Subir una foto', desc: 'Foto de tu colección o partida', xp: 25 },
  { icon: '✅', label: 'Validar datos de juego', desc: 'Confirma info de BGG o corrige errores', xp: 30 },
  { icon: '🛒', label: 'Completar una compra', desc: 'Cada compra confirmada en el marketplace', xp: 60 },
  { icon: '📦', label: 'Agregar a colección', desc: 'Marca un juego como tuyo', xp: 10 },
  { icon: '♥', label: 'Agregar a wishlist', desc: 'Guardá juegos que querés', xp: 5 },
];

export default function AccountPage({
  onNavigate,
  onLogout,
}: {
  onNavigate: (p: 'wallet' | 'orders' | 'addresses') => void;
  onLogout: () => void;
}) {
  const { session, logout } = useCustomer();
  const intl = useIntl();
  if (!session) return null;

  function handleLogout() {
    logout();
    onLogout();
  }

  const { data: wallet } = useWallet(session.customer.id);
  const { shelfState, shelfCounts, recentXPEvents } = useShelf();
  const { tier, tierIndex, nextTier, xpToNext } = useXPInfo(shelfState.xp);

  const { data: orders } = useQuery<Order[]>({
    queryKey: ['customer-orders', session.customer.id],
    queryFn: async () => {
      const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${session.customer.id}/orders?limit=5`);
      if (!res.ok) throw new Error(`orders fetch failed: ${res.status}`);
      return res.json() as Promise<Order[]>;
    },
    retry: false,
  });

  useAddresses(session.customer.id);
  const totalCredits = (wallet?.platformCreditsMinor ?? 0) + (wallet?.storeCredits?.reduce((s, c) => s + c.balanceMinor, 0) ?? 0);
  const firstName = session.customer.name?.split(' ')[0] ?? 'jugador';
  const initials = (session.customer.name?.[0] ?? session.customer.email[0]).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8 animate-fade-in">

      {/* ── Section 1: Profile header card ── */}
      <div className="rounded-2xl border border-[--border] shadow-md bg-[--bg-raised]">
        {/* Felt banner — avatar is absolutely anchored to its bottom edge */}
        <div
          className="relative h-28 rounded-t-2xl"
          style={{
            background: '#1E3A2E',
            backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.05) 1.2px,transparent 1.5px)',
            backgroundSize: '18px 18px',
          }}
        >
          {/* Logout — top-right of the banner. The ghost variant ships an opaque
              light pill (bg-[--bg-subtle]); on this fixed dark-green felt that
              left white text on a light background (invisible in light theme).
              The banner colour is theme-invariant, so override the pill to
              transparent and use white-based text (theme tokens would flip dark
              and disappear here) with a red destructive hover. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="absolute right-3 top-3 bg-transparent text-white/80 hover:bg-white/10 hover:text-red-300"
          >
            Cerrar sesión
          </Button>

          {/* Avatar — overlaps banner bottom by half */}
          <div className="absolute -bottom-10 left-6 flex items-end gap-3">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-[--bg-raised] shadow-lg text-white text-2xl font-bold font-display select-none"
              style={{ background: '#B4502E' }}
            >
              {initials}
            </div>
            {/* XP ring sits next to avatar, also half-overlapping */}
            <div className="mb-0.5">
              <XPProgressRing xp={shelfState.xp} size={60} />
            </div>
          </div>
        </div>

        {/* Content — pt-12 clears the overflowing avatar */}
        <div className="px-6 pb-5 pt-12">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-extrabold text-[--tx]">{firstName}</h1>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide text-white"
                  style={{ background: tier.color }}
                >
                  {tier.name}
                </span>
              </div>
              <p className="text-sm text-[--tx-muted]">{session.customer.email}</p>
              <p className="font-mono text-xs text-[--tx-faint] mt-0.5">
                {shelfState.xp} XP
                {nextTier && xpToNext !== null && (
                  <> · {xpToNext} XP para {nextTier.name}</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Stats row ── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { icon: '📦', value: shelfCounts.owned, label: 'Juegos', onClick: undefined },
          { icon: '♥', value: shelfCounts.wishlist, label: 'Wishlist', onClick: undefined },
          { icon: '🛍️', value: orders?.length ?? '–', label: 'Pedidos', onClick: () => onNavigate('orders') },
          { icon: '💰', value: fmt(totalCredits), label: 'Créditos', onClick: () => onNavigate('wallet'), small: true },
          { icon: '⭐', value: shelfState.xp, label: 'XP', onClick: undefined },
          { icon: '🏪', value: '—', label: 'Rating', onClick: undefined },
        ].map((s, i) => (
          <div
            key={i}
            role={s.onClick ? 'button' : undefined}
            onClick={s.onClick}
            className={`flex flex-col items-center justify-center rounded-xl border border-[--border] bg-[--bg-raised] py-4 px-2 text-center
              ${s.onClick ? 'cursor-pointer hover:bg-[--bg-hover] transition-colors' : ''}`}
          >
            <span className="text-lg mb-1">{s.icon}</span>
            <span className={`font-display font-bold text-[--tx] leading-tight ${s.small ? 'text-sm' : 'text-xl'}`}>{s.value}</span>
            <span className="font-mono text-[9px] uppercase tracking-wide text-[--tx-faint] mt-0.5">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Section 3: El Camino / Tier path ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-bold text-[--tx]">{intl.formatMessage({ id: 'account.loremasterPath' })}</h2>
        <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute left-0 right-0 top-[20px] h-0.5 bg-[--border] mx-8" />
            {XP_TIERS.map((tier, i) => {
              const done = tierIndex > i;
              const current = tierIndex === i;
              return (
                <div key={tier.name} className="relative flex flex-col items-center gap-2 z-10">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all"
                    style={{
                      background: done || current ? tier.color : 'var(--bg-subtle)',
                      borderColor: done || current ? tier.color : 'var(--border)',
                      boxShadow: current ? `0 0 0 3px ${tier.color}33` : undefined,
                    }}
                  >
                    {done ? (
                      <span className="text-white text-sm">✓</span>
                    ) : current ? (
                      <span className="text-white text-xs font-bold">◉</span>
                    ) : (
                      <span className="text-[--tx-faint] text-xs">○</span>
                    )}
                  </div>
                  <span
                    className="font-mono text-[9px] uppercase tracking-wide text-center leading-tight"
                    style={{ color: done || current ? tier.color : 'var(--tx-faint)', fontWeight: current ? 700 : undefined }}
                  >
                    {tier.name}
                  </span>
                  <span className="font-mono text-[8px] text-[--tx-faint]">{tier.min} XP</span>
                </div>
              );
            })}
          </div>
          {nextTier && (
            <p className="mt-4 text-xs text-[--tx-muted] text-center border-t border-[--border] pt-3">
              Siguiente beneficio: <span className="font-semibold text-[--tx]">{tier.nextPerk}</span> · faltan {xpToNext} XP
            </p>
          )}
        </div>
      </section>

      {/* ── Section 4: Collection shelf ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-bold text-[--tx]">{intl.formatMessage({ id: 'account.myShelf' })}</h2>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
          {SHELF_STATUS_ORDER.map((key) => {
            const meta = SHELF_STATUS_META[key];
            return (
              <div
                key={key}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-[--border] bg-[--bg-raised] p-4 text-center"
              >
                <span className="text-xl">{meta.icon}</span>
                <span className="font-display text-2xl font-bold text-[--tx]">{shelfCounts[key]}</span>
                <span className="font-mono text-[9px] uppercase tracking-wide text-[--tx-faint] leading-tight">
                  {intl.formatMessage({ id: meta.labelKey })}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[--tx-faint] text-center">
          Agrega juegos desde el catálogo con los botones de estante en cada juego.
        </p>
      </section>

      {/* ── Section 5: Ways to earn XP ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-bold text-[--tx]">{intl.formatMessage({ id: 'account.waysToEarnXp' })}</h2>
        <div className="rounded-2xl border border-[--border] bg-[--bg-raised] divide-y divide-[--border] overflow-hidden">
          {XP_EARN_ACTIONS.map((action) => (
            <div key={action.label} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl shrink-0">{action.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[--tx]">{action.label}</p>
                <p className="text-xs text-[--tx-muted]">{action.desc}</p>
              </div>
              <span
                className="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-bold"
                style={{ background: 'var(--jp-success-tint)', color: 'var(--jp-success-text)' }}
              >
                +{action.xp} XP
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 6: Recent XP events ── */}
      {recentXPEvents.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-base font-bold text-[--tx]">{intl.formatMessage({ id: 'account.recentXpActivity' })}</h2>
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] divide-y divide-[--border] overflow-hidden">
            {recentXPEvents.map((event, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-bold"
                  style={{ background: 'var(--jp-success-tint)', color: 'var(--jp-success-text)' }}
                >
                  +{event.xp}
                </span>
                <p className="flex-1 text-sm text-[--tx]">{event.label}</p>
                <p className="font-mono text-[10px] text-[--tx-faint] shrink-0">{relDate(event.at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Credits hero card ── */}
      <div
        role="button"
        onClick={() => onNavigate('wallet')}
        className="relative overflow-hidden rounded-2xl cursor-pointer group p-6 shadow-lg"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--jp-success-mark) 55%, #000) 0%, var(--jp-success-text) 100%)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.05) 1.2px,transparent 1.5px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#7FC79A' }}>Créditos disponibles</p>
          <p className="font-display text-4xl font-bold tracking-tight mb-1 text-white">{fmt(totalCredits)}</p>

          {wallet && wallet.storeCredits?.length > 0 && (
            <p className="text-xs mt-1" style={{ color: '#7FC79A' }}>
              {fmt(wallet.platformCreditsMinor)} libres
              {wallet.storeCredits.map((sc) => (
                <span key={sc.seller.name}> · {fmt(sc.balanceMinor)} {sc.seller.name}</span>
              ))}
            </p>
          )}

          <div className="mt-4 flex items-center gap-1 text-xs transition-colors" style={{ color: '#7FC79A' }}>
            Ver historial de créditos
            <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Recent orders ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[--tx]">{intl.formatMessage({ id: 'account.recentOrders' })}</h2>
          <button
            onClick={() => onNavigate('orders')}
            className="rounded-lg border border-[--border] bg-[--bg-subtle] px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-[--bg-hover] dark:text-emerald-300"
          >
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
              const creditsApplied = (order.platformCreditsApplied ?? 0) + (order.storeCreditsApplied ?? 0);
              const totalUnits = Math.round(order.totalMinorUnits / 100);
              const creditsUnits = Math.round(creditsApplied / 100);
              const paidUnits = totalUnits - creditsUnits;
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
                      {creditsApplied > 0 && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          🎁 {fmt(creditsUnits * 100, order.currency)} en créditos · pedido {fmt(totalUnits * 100, order.currency)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-sm font-semibold text-[--tx]">{fmt(paidUnits * 100, order.currency)}</p>
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
