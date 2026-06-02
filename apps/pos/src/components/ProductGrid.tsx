import { useMemo, useState, useRef, useEffect } from 'react';
import { formatMoney } from '@retail-os/ui-react';
import type { Product } from '@retail-os/catalog';
import { useCart } from '../store/cart-store.js';

/**
 * ProductGrid — instant in-memory search (target < 50ms) plus barcode entry.
 * Typing a full barcode and pressing Enter adds the matching product directly,
 * emulating a hardware scanner.
 */
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
    <section className="product-grid">
      <header className="product-toolbar">
        <div>
          <h1>Catalogo</h1>
          <span>{catalog.size()} productos locales</span>
        </div>
        <input
          ref={inputRef}
          className="search"
          placeholder="Buscar o escanear codigo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
      </header>
      <nav className="category-strip" aria-label="Categorias">
        {categories.map((cat) => (
          <button key={cat} className={cat === category ? 'active' : ''} onClick={() => setCategory(cat)}>
            {cat}
          </button>
        ))}
      </nav>
      <div className="grid">
        {results.map((p) => (
          <button key={p.id} className="product-card" onClick={() => addProduct(toSnapshot(p))}>
            <span className="cat">{p.category}</span>
            <span className="name">{p.name}</span>
            <span className="sku">{p.sku}</span>
            <span className="price">
              {formatMoney({ minorUnits: p.unitPrice.minorUnits, currency: p.unitPrice.currency })}
            </span>
          </button>
        ))}
        {results.length === 0 && <p className="empty">Sin resultados</p>}
      </div>
    </section>
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
