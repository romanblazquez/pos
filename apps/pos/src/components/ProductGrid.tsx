import { useMemo, useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  formatMoney,
} from '@retail-os/ui-react';
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
    <section className="flex h-full min-h-0 flex-col bg-background">

      {/* ── Sticky header ── */}
      <header className="flex shrink-0 items-center gap-3 border-b bg-background px-4 pb-3 pt-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold leading-none tracking-tight">Catálogo</h1>
          <span className="mt-1 block text-xs font-medium text-muted-foreground">{catalog.size()} productos</span>
        </div>
        <div className="relative flex-[2] min-w-0 max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">⌕</span>
          <Input
            ref={inputRef}
            className="pl-8"
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
        className="flex shrink-0 gap-2 overflow-x-auto border-b bg-background px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Categorías"
      >
        {categories.map((cat) => (
          <Button
            key={cat}
            type="button"
            size="sm"
            variant={cat === category ? 'default' : 'secondary'}
            onClick={() => setCategory(cat)}
            className="h-7 shrink-0 rounded-full px-3 text-xs"
          >
            {cat}
          </Button>
        ))}
      </nav>

      {/* ── Product grid ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {paginated.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
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
        <footer className="flex shrink-0 items-center justify-between border-t bg-background px-4 py-2 text-xs text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="h-7"
          >
            ← Anterior
          </Button>
          <span className="font-medium">
            Página {page + 1} de {totalPages} · {displayProducts.length} artículos
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="h-7"
          >
            Siguiente →
          </Button>
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
    <Card
      role="button"
      tabIndex={0}
      onClick={onAdd}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onAdd();
      }}
      className="group cursor-pointer gap-0 overflow-hidden rounded-lg p-0 text-left transition hover:border-primary/50 hover:bg-accent/30 active:scale-[0.98]"
    >
      {/* Product image */}
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted">
        {p.imageUrl ? (
          <ProductImage url={p.imageUrl} alt={p.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">
            📦
          </div>
        )}
        {variantCount > 1 && (
          <Badge className="absolute right-1 top-1 text-[9px] leading-none">
            {variantCount} vars
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-1 p-2 w-full">
        <span className="w-full truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {p.category}
        </span>
        <span className="line-clamp-2 min-h-[2.5rem] w-full text-[13px] font-semibold leading-snug">
          {p.name}
          {p.variantDescription && (
            <span className="font-normal text-muted-foreground"> · {p.variantDescription}</span>
          )}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">{p.sku}</span>
        <span className="text-base font-bold leading-none text-primary">
          {formatMoney({ minorUnits: p.unitPrice.minorUnits, currency: p.unitPrice.currency })}
        </span>
      </div>
    </Card>
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="top-auto bottom-0 max-w-lg translate-y-0 rounded-b-none rounded-t-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{baseName}</DialogTitle>
          <DialogDescription>Selecciona una variante</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {variants.map((v) => (
            <Card
              key={v.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(v)}
              className="cursor-pointer gap-1 rounded-lg p-3 text-left transition hover:border-primary/50 hover:bg-accent/30"
            >
              {v.imageUrl && (
                <div className="w-full aspect-video rounded mb-1 overflow-hidden">
                  <ProductImage url={v.imageUrl} alt={v.name} />
                </div>
              )}
              <span className="line-clamp-2 text-xs font-semibold">
                {v.variantDescription ?? v.name}
              </span>
              <span className="text-[10px] text-muted-foreground">{v.sku}</span>
              <span className="text-sm font-bold text-primary">
                {formatMoney({ minorUnits: v.unitPrice.minorUnits, currency: v.unitPrice.currency })}
              </span>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
