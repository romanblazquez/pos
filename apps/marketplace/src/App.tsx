import { useState } from 'react';
import SearchPage from './pages/SearchPage.js';
import ProductPage from './pages/ProductPage.js';
import HomePage from './pages/HomePage.js';
import { CartProvider, useCart } from './cart/CartContext.js';
import CartDrawer from './cart/CartDrawer.js';

type Route =
  | { page: 'home' }
  | { page: 'search'; q: string }
  | { page: 'product'; slug: string };

export default function App() {
  return (
    <CartProvider>
      <AppInner />
    </CartProvider>
  );
}

function AppInner() {
  const [route, setRoute] = useState<Route>({ page: 'home' });
  const [cartOpen, setCartOpen] = useState(false);

  function navigate(r: Route) {
    setRoute(r);
    window.scrollTo(0, 0);
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
