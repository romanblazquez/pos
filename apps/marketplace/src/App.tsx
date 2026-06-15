import { useState } from 'react';
import SearchPage from './pages/SearchPage.js';
import ProductPage from './pages/ProductPage.js';
import HomePage from './pages/HomePage.js';

// Minimal client-side router — will be replaced with React Router in Epic 5
type Route =
  | { page: 'home' }
  | { page: 'search'; q: string }
  | { page: 'product'; slug: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ page: 'home' });

  function navigate(r: Route) {
    setRoute(r);
    window.scrollTo(0, 0);
  }

  return (
    <div className="min-h-screen">
      <Header
        onSearch={(q) => navigate({ page: 'search', q })}
        onHome={() => navigate({ page: 'home' })}
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
          <ProductPage slug={route.slug} />
        )}
      </main>
    </div>
  );
}

function Header({
  onSearch,
  onHome,
}: {
  onSearch: (q: string) => void;
  onHome: () => void;
}) {
  const [q, setQ] = useState('');

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-stone-200 shadow-sm">
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
        <nav className="hidden sm:flex gap-4 text-sm text-stone-600 shrink-0">
          <a href="/seller-portal" className="hover:text-emerald-700">
            Soy vendedor
          </a>
        </nav>
      </div>
    </header>
  );
}
