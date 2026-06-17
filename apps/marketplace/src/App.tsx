import { useState, useEffect } from 'react';
import SearchPage from './pages/SearchPage.js';
import ProductPage from './pages/ProductPage.js';
import HomePage from './pages/HomePage.js';
import AccountPage from './pages/AccountPage.js';
import WalletPage from './pages/WalletPage.js';
import OrdersPage from './pages/OrdersPage.js';
import { CartProvider, useCart } from './cart/CartContext.js';
import CartDrawer from './cart/CartDrawer.js';
import { CustomerProvider, useCustomer } from './context/CustomerContext.js';
import AuthModal from './components/AuthModal.js';
import { Button } from './components/ui/index.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type Route =
  | { page: 'home' }
  | { page: 'search'; q: string }
  | { page: 'product'; slug: string }
  | { page: 'account' }
  | { page: 'wallet' }
  | { page: 'orders' };

function parseRoute(pathname: string, search: string): Route {
  if (pathname.startsWith('/product/')) {
    const slug = pathname.slice('/product/'.length);
    if (slug) return { page: 'product', slug };
  }
  if (pathname === '/search') return { page: 'search', q: new URLSearchParams(search).get('q') ?? '' };
  if (pathname === '/account') return { page: 'account' };
  if (pathname === '/account/wallet') return { page: 'wallet' };
  if (pathname === '/account/orders') return { page: 'orders' };
  return { page: 'home' };
}

function routePath(r: Route): string {
  if (r.page === 'search') return `/search?q=${encodeURIComponent(r.q)}`;
  if (r.page === 'product') return `/product/${r.slug}`;
  if (r.page === 'account') return '/account';
  if (r.page === 'wallet') return '/account/wallet';
  if (r.page === 'orders') return '/account/orders';
  return '/';
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('mkt_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
  | { state: 'polling'; orderId: string }
  | { state: 'confirmed'; orderId: string }
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
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    const status = params.get('status');
    if (!orderId) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (status === 'failure') {
      setCheckout({ state: 'failed', message: 'El pago fue rechazado. Podés intentar de nuevo.' });
      return;
    }
    setCheckout({ state: 'polling', orderId });
    let attempts = 0;
    const MAX = 20;
    const iv = setInterval(async () => {
      attempts++;
      try {
        if (attempts === 1) await fetch(`${API}/api/v1/checkout/orders/${orderId}/reconcile`, { method: 'POST' });
        const res = await fetch(`${API}/api/v1/checkout/orders/${orderId}`);
        if (!res.ok) throw new Error();
        const order = (await res.json()) as { status: string };
        if (order.status === 'confirmed' || attempts >= MAX) { clearInterval(iv); setCheckout({ state: 'confirmed', orderId }); }
        else if (order.status === 'cancelled') { clearInterval(iv); setCheckout({ state: 'failed', message: 'El pago fue cancelado.' }); }
      } catch { if (attempts >= MAX) { clearInterval(iv); setCheckout({ state: 'confirmed', orderId }); } }
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  function navigate(r: Route) {
    const isAccountPage = r.page === 'account' || r.page === 'wallet' || r.page === 'orders';
    if (isAccountPage && !session) { setAuthOpen(true); return; }
    setRoute(r);
    window.history.pushState({}, '', routePath(r));
    window.scrollTo(0, 0);
  }

  if (checkout.state !== 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[--bg]">
        <div className="w-full max-w-sm rounded-2xl border border-[--border] bg-[--bg-raised] p-10 text-center space-y-4 shadow-lg">
          {checkout.state === 'polling' && (
            <>
              <p className="text-4xl animate-pulse">⏳</p>
              <h1 className="text-lg font-bold text-[--tx]">Confirmando tu pago…</h1>
              <p className="text-sm text-[--tx-muted]">No cierres la ventana.</p>
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

  const isAccount = route.page === 'account' || route.page === 'wallet' || route.page === 'orders';

  return (
    <div className="min-h-screen bg-[--bg]">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onSearch={(q) => navigate({ page: 'search', q })}
        onHome={() => navigate({ page: 'home' })}
        onCartOpen={() => setCartOpen(true)}
        onAccountClick={() => navigate({ page: 'account' })}
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
            ] as const).map(({ page, label }) => (
              <button
                key={page}
                onClick={() => navigate({ page })}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
                  ${route.page === page
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'text-[--tx-muted] hover:text-[--tx] hover:bg-[--bg-hover]'}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main className="animate-fade-in">
        {route.page === 'home' && (
          <HomePage onSearch={(q) => navigate({ page: 'search', q })} onProduct={(slug) => navigate({ page: 'product', slug })} />
        )}
        {route.page === 'search' && (
          <SearchPage query={route.q} onProduct={(slug) => navigate({ page: 'product', slug })} />
        )}
        {route.page === 'product' && (
          <ProductPage slug={route.slug} onCartOpen={() => setCartOpen(true)} />
        )}
        {route.page === 'account' && session && <AccountPage onNavigate={(p) => navigate({ page: p })} />}
        {route.page === 'wallet' && session && <WalletPage />}
        {route.page === 'orders' && session && <OrdersPage />}
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
    </div>
  );
}

function Header({
  theme, onToggleTheme, onSearch, onHome, onCartOpen, onAccountClick, onAuthClick,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSearch: (q: string) => void;
  onHome: () => void;
  onCartOpen: () => void;
  onAccountClick: () => void;
  onAuthClick: () => void;
}) {
  const [q, setQ] = useState('');
  const { count } = useCart();
  const { session, isLoading } = useCustomer();

  return (
    <header className="sticky top-0 z-40 bg-[--bg-raised] border-b border-[--border]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">

        {/* Logo */}
        <button
          onClick={onHome}
          className="font-bold text-base text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity"
        >
          🎲 BoardGame Market
        </button>

        {/* Search */}
        <form
          className="flex-1 flex gap-2 max-w-xl"
          onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca un juego de mesa…"
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-[--border]
                       bg-[--bg-input] text-[--tx] placeholder:text-[--tx-faint]
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <Button type="submit" size="sm">Buscar</Button>
        </form>

        {/* Right nav */}
        <nav className="hidden sm:flex items-center gap-1 shrink-0 ml-auto">
          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[--tx-muted]
                       hover:bg-[--bg-hover] hover:text-[--tx] transition-colors"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Seller link */}
          <a
            href={import.meta.env.VITE_SELLER_PORTAL_URL ?? 'http://localhost:4400'}
            className="text-sm text-[--tx-muted] hover:text-[--tx] transition-colors px-2 py-1"
          >
            Soy vendedor
          </a>

          {/* Customer auth */}
          {!isLoading && (
            session ? (
              <button
                onClick={onAccountClick}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[--bg-hover] transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold
                                flex items-center justify-center shrink-0 select-none">
                  {(session.customer.name?.[0] ?? session.customer.email[0]).toUpperCase()}
                </div>
                <span className="text-sm text-[--tx] font-medium max-w-[8rem] truncate">
                  {session.customer.name?.split(' ')[0] ?? 'Mi cuenta'}
                </span>
              </button>
            ) : (
              <button
                onClick={onAuthClick}
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700
                           dark:text-emerald-400 dark:hover:text-emerald-300 px-2 py-1"
              >
                Iniciar sesión
              </button>
            )
          )}

          {/* Cart */}
          <button
            onClick={onCartOpen}
            className="relative ml-1 flex items-center gap-1 px-3 py-1.5 rounded-lg
                       text-[--tx] hover:bg-[--bg-hover] transition-colors font-medium"
          >
            🛒
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-0.5
                               bg-emerald-600 text-white text-[10px] font-bold rounded-full
                               flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
