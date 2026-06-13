import { useMemo, useState, useRef, useEffect } from 'react';
import { formatMoney } from '@retail-os/ui-react';
import type { Product } from '@retail-os/catalog';
import { useCart } from '../store/cart-store.js';

export function ProductGrid() {
  const catalog = useCart((s) => s.catalog);
  const ready = useCart((s) => s.ready);
  const addProduct = useCart((s) => s.addProduct);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [ready]);

  const categories = useMemo(() => {
    const products = catalog.search('', 500);
    return ['Todas', ...Array.from(new Set(products.map((p) => p.category))).sort()];
  }, [catalog, ready]);

  const results: Product[] = useMemo(() => {
    const found = catalog.search(query, 100);
    return found.filter((p) => category === 'Todas' || p.category === category).slice(0, 60);
  }, [catalog, category, query, ready]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const exact = catalog.getByBarcode(query.trim());
    const target = exact ?? results[0];
    if (target) {
      addProduct(toSnapshot(target));
      setQuery('');
    }
  };

  return (
    <section className="flex flex-col min-h-0 h-full bg-bg">

      {/* ── Sticky header: title + search ── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-line bg-bg">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-text tracking-tight leading-none">Catálogo</h1>
          <span className="text-xs text-muted font-bold mt-0.5 block">{catalog.size()} productos</span>
        </div>
        <div className="relative flex-[2] min-w-0 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none select-none">
            🔍
          </span>
          <input
            ref={inputRef}
            className="w-full h-9 pl-8 pr-3 bg-surface border border-line rounded-lg text-sm text-text placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="Buscar o escanear código"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
          />
        </div>
      </header>

      {/* ── Sticky category strip ── */}
      <nav
        className="flex-shrink-0 flex gap-2 px-4 py-2.5 overflow-x-auto border-b border-line bg-bg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Categorías"
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={[
              'flex-shrink-0 h-7 px-3 rounded-full text-xs font-bold border transition-all',
              cat === category
                ? 'bg-accent/15 border-accent/50 text-accent'
                : 'bg-panel-2 border-line text-muted hover:border-line hover:text-text',
            ].join(' ')}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* ── Scrollable product grid ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
            <span className="text-3xl opacity-40">🔍</span>
            <p className="text-sm font-bold">Sin resultados para "{query}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2.5">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={() => addProduct(toSnapshot(p))} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProductCard({ product: p, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="group flex flex-col items-start gap-1.5 p-3 bg-panel border border-line rounded-lg text-left transition-all hover:border-accent/50 hover:bg-panel-2 active:scale-[0.98]"
    >
      <span className="text-[10px] font-black text-muted uppercase tracking-wide truncate w-full">
        {p.category}
      </span>
      <span className="text-[13px] font-bold text-text leading-snug line-clamp-2 w-full min-h-[2.5rem]">
        {p.name}
      </span>
      <span className="text-[10px] font-bold text-muted mt-auto">{p.sku}</span>
      <span className="text-base font-black text-accent leading-none">
        {formatMoney({ minorUnits: p.unitPrice.minorUnits, currency: p.unitPrice.currency })}
      </span>
    </button>
  );
}

function toSnapshot(p: Product) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    priceMinorUnits: p.unitPrice.minorUnits,
    currency: p.unitPrice.currency,
    taxRatePercent: p.taxRatePercent,
    trackInventory: p.trackInventory,
    active: p.active,
  };
}
