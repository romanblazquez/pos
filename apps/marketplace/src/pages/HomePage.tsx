import { useState } from 'react';

const FEATURED_CATEGORIES = [
  { label: 'Estrategia', icon: '⚔️', slug: 'strategy' },
  { label: 'Familia', icon: '👨‍👩‍👧', slug: 'family' },
  { label: 'Cooperativo', icon: '🤝', slug: 'cooperative' },
  { label: 'Fiesta', icon: '🎉', slug: 'party' },
  { label: 'Económico', icon: '💰', slug: 'economic' },
  { label: 'Deckbuilding', icon: '🃏', slug: 'deckbuilding' },
];

const TRENDING_GAMES = [
  'Catan', 'Spirit Island', 'Pandemic', 'Terraforming Mars',
  'Wingspan', '7 Wonders', 'Ticket to Ride', 'Gloomhaven',
];

interface HomePageProps {
  onSearch: (q: string) => void;
  onProduct: (slug: string) => void;
}

export default function HomePage({ onSearch }: HomePageProps) {
  const [q, setQ] = useState('');

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-emerald-900 to-emerald-800 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            Encuentra el mejor precio para tu juego de mesa
          </h1>
          <p className="text-emerald-200 text-lg">
            Comparamos disponibilidad, precio y envío entre múltiples tiendas en tiempo real.
          </p>
          <form
            className="flex gap-2 max-w-lg mx-auto"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) onSearch(q.trim());
            }}
          >
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: Catan, Spirit Island, Wingspan..."
              className="flex-1 px-5 py-3 text-base rounded-xl text-stone-900
                         focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-400 text-emerald-900 font-semibold
                         rounded-xl hover:bg-emerald-300 transition-colors"
            >
              Buscar
            </button>
          </form>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {TRENDING_GAMES.map((game) => (
              <button
                key={game}
                onClick={() => onSearch(game)}
                className="text-sm px-3 py-1 rounded-full bg-emerald-700 hover:bg-emerald-600
                           text-emerald-100 transition-colors"
              >
                {game}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-6xl mx-auto px-4 py-12 grid sm:grid-cols-3 gap-6">
        {[
          { icon: '💰', title: 'Mejor precio', desc: 'Comparamos precios en tiempo real entre todas las tiendas.' },
          { icon: '📦', title: 'Stock real', desc: 'Verificamos disponibilidad antes de que completes tu compra.' },
          { icon: '🚚', title: 'Mejor envío', desc: 'Filtra por tiempo de entrega y costo de envío a tu zona.' },
        ].map((v) => (
          <div key={v.title} className="text-center p-6 rounded-2xl bg-white border border-stone-200">
            <div className="text-4xl mb-3">{v.icon}</div>
            <h3 className="font-semibold text-stone-900 mb-1">{v.title}</h3>
            <p className="text-sm text-stone-500">{v.desc}</p>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="text-xl font-semibold text-stone-800 mb-4">Explorar por categoría</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {FEATURED_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => onSearch(cat.label)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white
                         border border-stone-200 hover:border-emerald-400 hover:shadow-sm
                         transition-all group"
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-sm font-medium text-stone-700 group-hover:text-emerald-700">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* CTA for sellers */}
      <section className="bg-stone-100 border-t border-stone-200 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h2 className="text-2xl font-bold text-stone-900">
            ¿Tenés una tienda de juegos de mesa?
          </h2>
          <p className="text-stone-600">
            Conectá tu catálogo y empezá a vender en el marketplace sin cambiar tu sistema actual.
          </p>
          <a
            href="/seller-portal"
            className="inline-block px-6 py-3 bg-emerald-700 text-white font-semibold
                       rounded-xl hover:bg-emerald-800 transition-colors"
          >
            Registrá tu tienda →
          </a>
        </div>
      </section>
    </div>
  );
}
