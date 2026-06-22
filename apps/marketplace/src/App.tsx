import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { Home, Moon, Search, ShoppingCart, Store, Sun, User, Wallet } from 'lucide-react';
import SearchPage from './pages/SearchPage.js';
import ProductPage from './pages/ProductPage.js';
import HomePage from './pages/HomePage.js';
import AccountPage from './pages/AccountPage.js';
import WalletPage from './pages/WalletPage.js';
import OrdersPage from './pages/OrdersPage.js';
import AddressesPage from './pages/AddressesPage.js';
import { CartProvider, useCart } from './cart/CartContext.js';
import CartDrawer from './cart/CartDrawer.js';
import { CustomerProvider, useCustomer } from './context/CustomerContext.js';
import { useWallet } from './hooks/useWallet.js';
import AuthModal from './components/AuthModal.js';
import { Button } from './components/ui/index.js';
import { formatMoney } from './marketplace-meta.js';
import { AnalyticsConsentBanner } from './components/AnalyticsConsentBanner.js';
import { trackPageView } from './analytics.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type Route =
  | { page: 'home' }
  | { page: 'search'; q: string; category?: string }
  | { page: 'product'; slug: string }
  | { page: 'account' }
  | { page: 'wallet' }
  | { page: 'orders' }
  | { page: 'addresses' };

function parseRoute(pathname: string, search: string): Route {
  if (pathname.startsWith('/product/')) {
    const slug = pathname.slice('/product/'.length);
    if (slug) return { page: 'product', slug };
  }
  if (pathname === '/search') {
    const params = new URLSearchParams(search);
    return {
      page: 'search',
      q: params.get('q') ?? '',
      category: params.get('category') ?? undefined,
    };
  }
  if (pathname === '/account') return { page: 'account' };
  if (pathname === '/account/wallet') return { page: 'wallet' };
  if (pathname === '/account/orders') return { page: 'orders' };
  if (pathname === '/account/addresses') return { page: 'addresses' };
  return { page: 'home' };
}

function routePath(r: Route): string {
  if (r.page === 'search') {
    const params = new URLSearchParams();
    if (r.q) params.set('q', r.q);
    if (r.category) params.set('category', r.category);
    const query = params.toString();
    return query ? `/search?${query}` : '/search';
  }
  if (r.page === 'product') return `/product/${r.slug}`;
  if (r.page === 'account') return '/account';
  if (r.page === 'wallet') return '/account/wallet';
  if (r.page === 'orders') return '/account/orders';
  if (r.page === 'addresses') return '/account/addresses';
  return '/';
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('mkt_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mkt_theme', theme);
  }, [theme]);

  return (
    <CustomerProvider>
      <CartProvider>
        <AppInner theme={theme} toggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
      </CartProvider>
    </CustomerProvider>
  );
}

type CheckoutState =
  | { state: 'idle' }
  | { state: 'checking'; orderId: string }
  | { state: 'confirmed'; orderId: string }
  | { state: 'delayed'; orderId: string }
  | { state: 'failed'; message: string };

function AppInner({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, window.location.search),
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutState>({ state: 'idle' });
  const { session } = useCustomer();

  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    trackPageView(routePath(route));
  }, [route]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Our own dev-mode fallback appends `order_id`; a real MercadoPago redirect
    // appends its own params instead — `external_reference` is the one we set to
    // our orderId when creating the preference, and `status`/`collection_status`
    // carry approved | pending | rejected (never `order_id`/`failure`, which only
    // existed in the dev-mode path and never matched a real payment redirect).
    const orderId = params.get('order_id') ?? params.get('external_reference');
    const status = params.get('status') ?? params.get('collection_status');
    if (!orderId) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (status === 'rejected' || status === 'failure') {
      setCheckout({ state: 'failed', message: 'El pago fue rechazado. Podés intentar de nuevo.' });
      return;
    }
    setCheckout({ state: 'checking', orderId });
    let cancelled = false;

    // The webhook (server push) should have already confirmed the order by the
    // time the buyer lands back here — reconcile is just a one-shot backstop in
    // case the webhook hasn't arrived yet. A short bounded retry (not indefinite
    // polling) covers that race; if it's still not confirmed after a few seconds,
    // hand off to a "still processing" state instead of an endless spinner —
    // "Mis pedidos" self-heals on view, so the buyer always has a way forward.
    async function checkStatus(id: string, attempt: number): Promise<void> {
      if (cancelled) return;
      try {
        if (attempt === 0) await fetch(`${API}/api/v1/checkout/orders/${id}/reconcile`, { method: 'POST' });
        const res = await fetch(`${API}/api/v1/checkout/orders/${id}`);
        if (!res.ok) throw new Error();
        const order = (await res.json()) as { status: string };
        if (cancelled) return;
        if (order.status === 'confirmed') { setCheckout({ state: 'confirmed', orderId: id }); return; }
        if (order.status === 'cancelled') { setCheckout({ state: 'failed', message: 'El pago fue cancelado.' }); return; }
      } catch {
        if (cancelled) return;
      }
      if (attempt >= 3) { setCheckout({ state: 'delayed', orderId: id }); return; }
      setTimeout(() => checkStatus(id, attempt + 1), 1500);
    }
    checkStatus(orderId, 0);

    return () => { cancelled = true; };
  }, []);

  function navigate(r: Route) {
    const isAccountPage = r.page === 'account' || r.page === 'wallet' || r.page === 'orders' || r.page === 'addresses';
    if (isAccountPage && !session) { setAuthOpen(true); return; }
    setRoute(r);
    window.history.pushState({}, '', routePath(r));
    window.scrollTo(0, 0);
  }

  function replaceRoute(r: Route) {
    setRoute(r);
    window.history.replaceState({}, '', routePath(r));
    window.scrollTo(0, 0);
  }

  if (checkout.state !== 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[--bg]">
        <div className="w-full max-w-sm rounded-2xl border border-[--border] bg-[--bg-raised] p-10 text-center space-y-4 shadow-lg">
          {checkout.state === 'checking' && (
            <>
              <p className="text-4xl animate-pulse">⏳</p>
              <h1 className="text-lg font-bold text-[--tx]">Confirmando tu pago…</h1>
              <p className="text-sm text-[--tx-muted]">Esto toma solo unos segundos.</p>
            </>
          )}
          {checkout.state === 'delayed' && (
            <>
              <p className="text-4xl">📨</p>
              <h1 className="text-lg font-bold text-[--tx]">Tu pago se está procesando</h1>
              <p className="text-sm text-[--tx-muted]">
                MercadoPago todavía no nos confirma el resultado — esto puede tardar un poco más.
                Te avisaremos en "Mis pedidos" en cuanto se confirme.
              </p>
              <Button onClick={() => { setCheckout({ state: 'idle' }); navigate({ page: 'orders' }); }}>
                Ver mis pedidos
              </Button>
            </>
          )}
          {checkout.state === 'confirmed' && (
            <>
              <p className="text-4xl">🎉</p>
              <h1 className="text-lg font-bold text-emerald-600">¡Pago confirmado!</h1>
              <p className="text-sm text-[--tx-muted]">
                Pedido <code className="font-mono text-xs bg-[--bg-subtle] px-1.5 py-0.5 rounded">{checkout.orderId.slice(-10)}</code> recibido.
              </p>
              <Button onClick={() => { setCheckout({ state: 'idle' }); navigate({ page: 'orders' }); }}>
                Ver mis pedidos
              </Button>
            </>
          )}
          {checkout.state === 'failed' && (
            <>
              <p className="text-4xl">❌</p>
              <h1 className="text-lg font-bold text-red-600">Pago no completado</h1>
              <p className="text-sm text-[--tx-muted]">{checkout.message}</p>
              <Button variant="outline" onClick={() => setCheckout({ state: 'idle' })}>
                Volver al marketplace
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const isAccount = route.page === 'account' || route.page === 'wallet' || route.page === 'orders' || route.page === 'addresses';

  return (
    <div className="min-h-screen bg-[--bg]">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onSearch={(q) => navigate({ page: 'search', q })}
        onHome={() => navigate({ page: 'home' })}
        onCartOpen={() => setCartOpen(true)}
        onAccountClick={() => navigate({ page: 'account' })}
        onWalletClick={() => navigate({ page: 'wallet' })}
        onAuthClick={() => setAuthOpen(true)}
      />

      {/* Account subnav */}
      {isAccount && session && (
        <div className="border-b border-[--border] bg-[--bg-raised]">
          <nav className="max-w-3xl mx-auto px-4 flex items-center gap-1 h-10">
            {([
              { page: 'account', label: 'Resumen' },
              { page: 'wallet', label: 'Wallet' },
              { page: 'orders', label: 'Pedidos' },
              { page: 'addresses', label: 'Direcciones' },
            ] as const).map(({ page, label }) => (
              <button
                key={page}
                onClick={() => navigate({ page })}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
                  ${route.page === page
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100'
                    : 'bg-[--bg-subtle] text-[--tx-muted] hover:text-[--tx] hover:bg-[--bg-hover]'}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main className="animate-fade-in">
        {route.page === 'home' && (
          <HomePage
            onSearch={(q, category) => navigate({ page: 'search', q, category })}
            onProduct={(slug) => navigate({ page: 'product', slug })}
          />
        )}
        {route.page === 'search' && (
          <SearchPage
            query={route.q}
            category={route.category}
            onSearch={(q, category) => navigate({ page: 'search', q, category })}
            onProduct={(slug) => navigate({ page: 'product', slug })}
            onHome={() => navigate({ page: 'home' })}
          />
        )}
        {route.page === 'product' && (
          <ProductPage
            slug={route.slug}
            onCartOpen={() => setCartOpen(true)}
            onHome={() => navigate({ page: 'home' })}
            onCategory={(category) => navigate({ page: 'search', q: '', category })}
          />
        )}
        {route.page === 'account' && session && (
          <AccountPage
            onNavigate={(p) => navigate({ page: p })}
            onLogout={() => replaceRoute({ page: 'home' })}
          />
        )}
        {route.page === 'wallet' && session && <WalletPage />}
        {route.page === 'orders' && session && <OrdersPage />}
        {route.page === 'addresses' && session && <AddressesPage />}
      </main>

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
      {authOpen && (
        <AuthModal
          onClose={() => {
            setAuthOpen(false);
            if (session) navigate({ page: 'account' });
          }}
        />
      )}
      <AnalyticsConsentBanner />
    </div>
  );
}

function Header({
  theme, onToggleTheme, onSearch, onHome, onCartOpen, onAccountClick, onWalletClick, onAuthClick,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSearch: (q: string) => void;
  onHome: () => void;
  onCartOpen: () => void;
  onAccountClick: () => void;
  onWalletClick: () => void;
  onAuthClick: () => void;
}) {
  const [q, setQ] = useState('');
  const { count } = useCart();
  const { session, isLoading } = useCustomer();
  const { data: walletSummary } = useWallet(session?.customer.id);

  const walletTotal = walletSummary
    ? walletSummary.platformCreditsMinor + walletSummary.storeCredits.reduce((sum, item) => sum + item.balanceMinor, 0)
    : 0;

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) onSearch(q.trim());
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[--border] bg-[--bg-raised]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:h-16 lg:flex-row lg:items-center lg:gap-4 lg:py-0">
        <div className="flex items-center gap-2">
        <button
          onClick={onHome}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[--bg-subtle] px-2 py-1 text-base font-bold text-[--tx]
                       transition-colors hover:text-emerald-700 dark:hover:text-emerald-400"
        >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white">
              <Home className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="max-w-[11rem] truncate tracking-tight">BoardGame Market</span>
        </button>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            {session && (
              <HeaderIconButton label="Wallet" onClick={onWalletClick}>
                <Wallet className="h-4 w-4" aria-hidden="true" />
              </HeaderIconButton>
            )}
            <HeaderIconButton label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </HeaderIconButton>
            <HeaderIconButton label={session ? 'Mi cuenta' : 'Iniciar sesión'} onClick={session ? onAccountClick : onAuthClick}>
              <User className="h-4 w-4" aria-hidden="true" />
            </HeaderIconButton>
            <CartButton count={count} onClick={onCartOpen} compact />
          </div>
        </div>

        <form
          className="relative flex w-full min-w-0 flex-1 gap-2 lg:max-w-2xl"
          onSubmit={submitSearch}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--tx-faint]" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca Catan, Root, Wingspan..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-[--border] bg-[--bg-input] py-2 pl-9 pr-3 text-sm
                       bg-[--bg-input] text-[--tx] placeholder:text-[--tx-faint]
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <Button type="submit" className="min-w-10 shrink-0 px-3 sm:px-4">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Buscar</span>
          </Button>
        </form>

        <nav className="hidden shrink-0 items-center gap-1 lg:ml-auto lg:flex">
          {session && (
            <button
              onClick={onWalletClick}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50
                         px-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100
                         dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {walletSummary ? formatMoney(walletTotal) : 'Wallet'}
            </button>
          )}

          <a
            href={import.meta.env.VITE_SELLER_PORTAL_URL ?? 'http://localhost:4400'}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[--bg-subtle] px-3 text-sm font-medium text-[--tx-muted]
                       transition-colors hover:bg-[--bg-hover] hover:text-[--tx]"
          >
            <Store className="h-4 w-4" aria-hidden="true" />
            Soy vendedor
          </a>

          <HeaderIconButton label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </HeaderIconButton>

          {!isLoading && (
            session ? (
              <button
                onClick={onAccountClick}
                className="flex h-9 items-center gap-2 rounded-lg bg-[--bg-subtle] px-2 transition-colors hover:bg-[--bg-hover]"
              >
                <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-emerald-700
                                text-xs font-bold text-white">
                  {(session.customer.name?.[0] ?? session.customer.email[0]).toUpperCase()}
                </div>
                <span className="max-w-[8rem] truncate text-sm font-medium text-[--tx]">
                  {session.customer.name?.split(' ')[0] ?? 'Mi cuenta'}
                </span>
              </button>
            ) : (
              <Button variant="outline" size="sm" onClick={onAuthClick}>
                <User className="h-4 w-4" aria-hidden="true" />
                Iniciar sesión
              </Button>
            )
          )}

          <CartButton count={count} onClick={onCartOpen} />
        </nav>
      </div>
    </header>
  );
}

function HeaderIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx-muted]
                 transition-colors hover:bg-[--bg-hover] hover:text-[--tx]"
    >
      {children}
    </button>
  );
}

function CartButton({ count, onClick, compact = false }: { count: number; onClick: () => void; compact?: boolean }) {
  return (
    <button
      aria-label="Abrir carrito"
      title="Carrito"
      onClick={onClick}
      className={`relative inline-flex h-9 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx] transition-colors hover:bg-[--bg-hover]
        ${compact ? 'w-9' : 'gap-2 px-3 font-medium'}`}
    >
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      {!compact && <span className="text-sm">Carrito</span>}
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full
                         bg-emerald-600 px-0.5 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
