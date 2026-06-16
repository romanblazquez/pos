import { useState, useEffect } from 'react';
import SearchPage from './pages/SearchPage.js';
import ProductPage from './pages/ProductPage.js';
import HomePage from './pages/HomePage.js';
import { CartProvider, useCart } from './cart/CartContext.js';
import CartDrawer from './cart/CartDrawer.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type Route =
  | { page: 'home' }
  | { page: 'search'; q: string }
  | { page: 'product'; slug: string };

function parseRoute(pathname: string, search: string): Route {
  if (pathname.startsWith('/product/')) {
    const slug = pathname.slice('/product/'.length);
    if (slug) return { page: 'product', slug };
  }
  if (pathname === '/search') {
    const q = new URLSearchParams(search).get('q') ?? '';
    return { page: 'search', q };
  }
  return { page: 'home' };
}

function pushRoute(r: Route) {
  if (r.page === 'home') window.history.pushState({}, '', '/');
  else if (r.page === 'search') window.history.pushState({}, '', `/search?q=${encodeURIComponent(r.q)}`);
  else window.history.pushState({}, '', `/product/${r.slug}`);
}

export default function App() {
  return (
    <CartProvider>
      <AppInner />
    </CartProvider>
  );
}

type CheckoutReturn =
  | { state: 'idle' }
  | { state: 'polling'; orderId: string }
  | { state: 'confirmed'; orderId: string }
  | { state: 'failed'; message: string };

function AppInner() {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, window.location.search)
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutReturn>({ state: 'idle' });

  // Sync route on browser back/forward
  useEffect(() => {
    function onPop() {
      setRoute(parseRoute(window.location.pathname, window.location.search));
      window.scrollTo(0, 0);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Detect return from MercadoPago (back_urls redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    const status = params.get('status'); // MP appends: approved | failure | pending
    if (!orderId) return;

    window.history.replaceState({}, '', window.location.pathname);

    if (status === 'failure') {
      setCheckout({ state: 'failed', message: 'El pago fue rechazado. Podés intentar de nuevo.' });
      return;
    }

    // Approved or pending — reconcile and poll until confirmed
    setCheckout({ state: 'polling', orderId });

    let attempts = 0;
    const MAX = 20; // 40 seconds
    const interval = setInterval(async () => {
      attempts++;
      try {
        // First trigger reconciliation (in case webhook hasn't fired yet)
        if (attempts === 1) {
          await fetch(`${API}/api/v1/checkout/orders/${orderId}/reconcile`, { method: 'POST' });
        }
        const res = await fetch(`${API}/api/v1/checkout/orders/${orderId}`);
        if (!res.ok) throw new Error('fetch failed');
        const order = (await res.json()) as { status: string };
        if (order.status === 'confirmed') {
          clearInterval(interval);
          setCheckout({ state: 'confirmed', orderId });
        } else if (order.status === 'cancelled') {
          clearInterval(interval);
          setCheckout({ state: 'failed', message: 'El pago fue cancelado.' });
        } else if (attempts >= MAX) {
          clearInterval(interval);
          // Show confirmed anyway — webhook will catch up
          setCheckout({ state: 'confirmed', orderId });
        }
      } catch {
        if (attempts >= MAX) {
          clearInterval(interval);
          setCheckout({ state: 'confirmed', orderId });
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  function navigate(r: Route) {
    setRoute(r);
    pushRoute(r);
    window.scrollTo(0, 0);
  }

  if (checkout.state === 'polling' || checkout.state === 'confirmed' || checkout.state === 'failed') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 max-w-md w-full text-center space-y-4">
          {checkout.state === 'polling' && (
            <>
              <p className="text-4xl animate-pulse">⏳</p>
              <h1 className="text-xl font-bold text-stone-900">Confirmando tu pago…</h1>
              <p className="text-sm text-stone-500">Esto tarda unos segundos. No cierres la ventana.</p>
            </>
          )}
          {checkout.state === 'confirmed' && (
            <>
              <p className="text-4xl">🎉</p>
              <h1 className="text-xl font-bold text-emerald-800">¡Pago confirmado!</h1>
              <p className="text-sm text-stone-500">
                Tu pedido <span className="font-mono text-xs bg-stone-100 px-1 rounded">{checkout.orderId}</span> fue recibido.
                El vendedor te contactará pronto.
              </p>
              <button
                onClick={() => setCheckout({ state: 'idle' })}
                className="mt-2 px-6 py-2.5 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800"
              >
                Seguir comprando
              </button>
            </>
          )}
          {checkout.state === 'failed' && (
            <>
              <p className="text-4xl">❌</p>
              <h1 className="text-xl font-bold text-red-700">Pago no completado</h1>
              <p className="text-sm text-stone-500">{checkout.message}</p>
              <button
                onClick={() => setCheckout({ state: 'idle' })}
                className="mt-2 px-6 py-2.5 bg-stone-700 text-white text-sm font-medium rounded-lg hover:bg-stone-800"
              >
                Volver al marketplace
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        onSearch={(q) => navigate({ page: 'search', q })}
        onHome={() => navigate({ page: 'home' })}
        onCartOpen={() => setCartOpen(true)}
      />
      <main>
        {route.page === 'home' && (
          <HomePage
            onSearch={(q) => navigate({ page: 'search', q })}
            onProduct={(slug) => navigate({ page: 'product', slug })}
          />
        )}
        {route.page === 'search' && (
          <SearchPage
            query={route.q}
            onProduct={(slug) => navigate({ page: 'product', slug })}
          />
        )}
        {route.page === 'product' && (
          <ProductPage
            slug={route.slug}
            onCartOpen={() => setCartOpen(true)}
          />
        )}
      </main>
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}

function Header({
  onSearch,
  onHome,
  onCartOpen,
}: {
  onSearch: (q: string) => void;
  onHome: () => void;
  onCartOpen: () => void;
}) {
  const [q, setQ] = useState('');
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <button
          onClick={onHome}
          className="font-bold text-lg text-emerald-800 whitespace-nowrap shrink-0"
        >
          🎲 BoardGame Market
        </button>
        <form
          className="flex-1 flex gap-2 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) onSearch(q.trim());
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca un juego de mesa..."
            className="flex-1 px-4 py-1.5 text-sm rounded-lg border border-stone-300
                       focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-4 py-1.5 text-sm bg-emerald-700 text-white rounded-lg
                       hover:bg-emerald-800 transition-colors"
          >
            Buscar
          </button>
        </form>
        <nav className="hidden sm:flex items-center gap-4 text-sm text-stone-600 shrink-0">
          <a
            href={import.meta.env.VITE_SELLER_PORTAL_URL ?? 'http://localhost:4400'}
            className="hover:text-emerald-700"
          >
            Soy vendedor
          </a>
          <button
            onClick={onCartOpen}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       hover:bg-stone-100 transition-colors font-medium"
          >
            🛒
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-emerald-600 text-white
                               text-[10px] font-bold rounded-full flex items-center justify-center
                               min-w-[1.1rem] px-0.5">
                {count}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
