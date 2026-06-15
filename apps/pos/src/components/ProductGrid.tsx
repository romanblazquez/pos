import { useMemo, useState, useRef, useEffect, useCallback, memo } from 'react';
import { formatMoney } from '@retail-os/ui-react';
import type { Product } from '@retail-os/catalog';
import { useCart } from '../store/cart-store.js';

const PAGE_SIZE = 48;

export function ProductGrid() {
  const catalog = useCart((s) => s.catalog);
  const ready = useCart((s) => s.ready);
  const addProduct = useCart((s) => s.addProduct);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [page, setPage] = useState(0);
  const [variantSheet, setVariantSheet] = useState<Product[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [ready]);

  // Reset page when search/category changes
  useEffect(() => { setPage(0); }, [query, category]);

  const categories = useMemo(() => {
    const products = catalog.search('', 1000);
    return ['Todas', ...Array.from(new Set(products.map((p) => p.category))).sort()];
  }, [catalog, ready]);

  const results: Product[] = useMemo(() => {
    const found = catalog.search(query, 2000);
    return found.filter((p) => category === 'Todas' || p.category === category);
  }, [catalog, category, query, ready]);

  // Group by templateId so we show one card per template (with variant picker if needed)
  const displayProducts = useMemo(() => {
    const seen = new Set<string>();
    const out: Product[] = [];
    for (const p of results) {
      const key = p.templateId ?? p.id;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(p);
      }
    }
    return out;
  }, [results]);

  const totalPages = Math.ceil(displayProducts.length / PAGE_SIZE);
  const paginated = displayProducts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSelect = useCallback(
    (p: Product) => {
      // Find all variants with the same templateId
      const siblings = p.templateId
        ? results.filter((r) => r.templateId === p.templateId)
        : [p];
      if (siblings.length > 1) {
        setVariantSheet(siblings);
      } else {
        addProduct(toSnapshot(p));
      }
    },
    [results, addProduct],
  );

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

      {/* ── Sticky header ── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-line bg-bg">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-text tracking-tight leading-none">Catálogo</h1>
          <span className="text-xs text-muted font-bold mt-0.5 block">{catalog.size()} productos</span>
        </div>
        <div className="relative flex-[2] min-w-0 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none select-none">🔍</span>
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

      {/* ── Category strip ── */}
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

      {/* ── Product grid ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
            <span className="text-3xl opacity-40">🔍</span>
            <p className="text-sm font-bold">Sin resultados para "{query}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2.5">
            {paginated.map((p) => {
              const variantCount = p.templateId
                ? results.filter((r) => r.templateId === p.templateId).length
                : 1;
              return (
                <ProductCard
                  key={p.templateId ?? p.id}
                  product={p}
                  variantCount={variantCount}
                  onAdd={() => handleSelect(p)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <footer className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-line bg-bg text-xs text-muted">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="h-7 px-3 rounded-md border border-line bg-panel-2 font-bold disabled:opacity-40 hover:border-accent/50 hover:text-accent transition-all"
          >
            ← Anterior
          </button>
          <span className="font-medium">
            Página {page + 1} de {totalPages} · {displayProducts.length} artículos
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="h-7 px-3 rounded-md border border-line bg-panel-2 font-bold disabled:opacity-40 hover:border-accent/50 hover:text-accent transition-all"
          >
            Siguiente →
          </button>
        </footer>
      )}

      {/* ── Variant picker sheet ── */}
      {variantSheet && (
        <VariantSheet
          variants={variantSheet}
          onSelect={(v) => { addProduct(toSnapshot(v)); setVariantSheet(null); }}
          onClose={() => setVariantSheet(null)}
        />
      )}
    </section>
  );
}

// Resolves Odoo-authenticated images via IPC proxy; external URLs load directly.
const ProductImage = memo(function ProductImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const retailOdoo = (window as unknown as Record<string, unknown>).retailOdoo as
    | { fetchImage(url: string): Promise<string | null> }
    | undefined;

  useEffect(() => {
    let cancelled = false;
    if (!url.startsWith('http://localhost')) {
      setSrc(url);
      return;
    }
    void retailOdoo?.fetchImage(url).then((d) => { if (!cancelled) setSrc(d ?? null); });
    return () => { cancelled = true; };
  }, [url, retailOdoo]);

  if (!src) return <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">📦</div>;
  return <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" onError={() => setSrc(null)} />;
});

function ProductCard({
  product: p,
  variantCount,
  onAdd,
}: {
  product: Product;
  variantCount: number;
  onAdd: () => void;
}) {
  return (
    <button
      onClick={onAdd}
      className="group flex flex-col items-start gap-1.5 p-0 bg-panel border border-line rounded-lg text-left transition-all hover:border-accent/50 hover:bg-panel-2 active:scale-[0.98] overflow-hidden"
    >
      {/* Product image */}
      <div className="w-full aspect-square bg-panel-2 overflow-hidden flex-shrink-0 relative">
        {p.imageUrl ? (
          <ProductImage url={p.imageUrl} alt={p.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">
            📦
          </div>
        )}
        {variantCount > 1 && (
          <span className="absolute top-1 right-1 bg-accent text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
            {variantCount} vars
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 p-2 w-full">
        <span className="text-[10px] font-black text-muted uppercase tracking-wide truncate w-full">
          {p.category}
        </span>
        <span className="text-[13px] font-bold text-text leading-snug line-clamp-2 w-full min-h-[2.5rem]">
          {p.name}
          {p.variantDescription && (
            <span className="text-muted font-normal"> · {p.variantDescription}</span>
          )}
        </span>
        <span className="text-[10px] font-bold text-muted">{p.sku}</span>
        <span className="text-base font-black text-accent leading-none">
          {formatMoney({ minorUnits: p.unitPrice.minorUnits, currency: p.unitPrice.currency })}
        </span>
      </div>
    </button>
  );
}

function VariantSheet({
  variants,
  onSelect,
  onClose,
}: {
  variants: Product[];
  onSelect: (v: Product) => void;
  onClose: () => void;
}) {
  const baseName = variants[0]?.name ?? '';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-bg border-t border-line rounded-t-2xl p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-text">{baseName}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-xl leading-none w-7 h-7 flex items-center justify-center rounded-md hover:bg-panel-2 transition"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-muted -mt-2">Selecciona una variante</p>
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {variants.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className="flex flex-col items-start gap-1 p-3 bg-panel border border-line rounded-lg hover:border-accent/50 hover:bg-panel-2 transition-all text-left"
            >
              {v.imageUrl && (
                <div className="w-full aspect-video rounded mb-1 overflow-hidden">
                  <ProductImage url={v.imageUrl} alt={v.name} />
                </div>
              )}
              <span className="text-xs font-bold text-text line-clamp-2">
                {v.variantDescription ?? v.name}
              </span>
              <span className="text-[10px] text-muted">{v.sku}</span>
              <span className="text-sm font-black text-accent">
                {formatMoney({ minorUnits: v.unitPrice.minorUnits, currency: v.unitPrice.currency })}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
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
    templateId: p.templateId,
    variantDescription: p.variantDescription,
    imageUrl: p.imageUrl,
  };
}
