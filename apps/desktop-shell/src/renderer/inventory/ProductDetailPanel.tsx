import { useEffect, useState } from 'react';
import { cn } from '@retail-os/ui-react';

interface StockLocation {
  locationId: string;
  locationName: string;
  stock: number;
}

interface VariantRow {
  id: string;
  sku: string;
  variantDescription?: string;
  imageUrl?: string;
  trackInventory: boolean;
  locationName?: string;
  onHand?: number;
  available?: number;
  stockLocations?: StockLocation[];
}

interface ProductContext {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  source: 'odoo' | 'tiendanube';
  variants: VariantRow[];
}

function OdooImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    if (!url.startsWith('http://localhost')) {
      setSrc(url);
      return;
    }
    void window.retailOdoo?.fetchImage(url).then((dataUri) => {
      if (!cancelled) setSrc(dataUri ?? null);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!src) {
    return (
      <div className={cn('bg-panel-2 flex items-center justify-center text-6xl opacity-10', className)}>
        📦
      </div>
    );
  }
  return <img src={src} alt={alt} className={cn('object-cover', className)} onError={() => setSrc(null)} />;
}

function StockPill({ available, onHand }: { available: number; onHand: number }) {
  const color =
    available <= 0 ? 'bg-danger text-white' :
    onHand > 0 && available / onHand < 0.2 ? 'bg-amber-500 text-white' :
    'bg-ok text-white';
  return (
    <span className={cn('text-[11px] font-black px-2 py-0.5 rounded-full', color)}>
      {available <= 0 ? 'Sin stock' : `${available} disp.`}
    </span>
  );
}

export function ProductDetailPanel({ context }: { context?: unknown } = {}) {
  const [product, setProduct] = useState<ProductContext | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<VariantRow | null>(null);

  useEffect(() => {
    try {
      // In dockview: context comes as a prop. In standalone: read from URL.
      const ctx = context
        ? (context as ProductContext)
        : (() => {
            const raw = new URLSearchParams(window.location.search).get('retailContext');
            return raw ? (JSON.parse(raw) as ProductContext) : null;
          })();
      if (!ctx) return;
      setProduct(ctx);
      setSelectedVariant(ctx.variants[0] ?? null);
    } catch { /* malformed context */ }
  }, [context]);

  if (!product) {
    return (
      <div className="flex h-full items-center justify-center text-muted text-sm">
        Cargando producto…
      </div>
    );
  }

  const displayVariant = selectedVariant ?? product.variants[0];
  const displayImage = displayVariant?.imageUrl ?? product.imageUrl;
  const isOdoo = product.source === 'odoo';

  return (
    <div className="flex flex-col h-full bg-bg overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-line bg-panel flex items-center gap-3">
        {/* Back button only in standalone window — dockview has its own close tab */}
        {!context && (
          <button
            onClick={() => window.close()}
            className="flex items-center justify-center size-7 rounded-lg border border-line bg-panel-2 text-muted hover:text-text hover:border-accent/50 transition-all flex-shrink-0"
            title="Cerrar"
          >
            ‹
          </button>
        )}
        <span className={cn(
          'text-[10px] font-black px-2 py-1 rounded-full',
          isOdoo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#7B3FE4]/20 text-[#a070ff]',
        )}>
          {isOdoo ? '🟢 Odoo' : '🟣 Tiendanube'}
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-text truncate">{product.name}</h1>
          <p className="text-xs text-muted">{product.category}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col md:flex-row gap-0 h-full">

          {/* ── Left: image ── */}
          <div className="flex-shrink-0 md:w-72 bg-panel-2 border-b md:border-b-0 md:border-r border-line">
            <div className="aspect-square w-full overflow-hidden">
              {displayImage ? (
                <OdooImage url={displayImage} alt={product.name} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl opacity-10">📦</div>
              )}
            </div>
          </div>

          {/* ── Right: detail ── */}
          <div className="flex-1 flex flex-col gap-0 min-w-0">

            {/* Product info */}
            <section className="px-5 py-4 border-b border-line">
              <h2 className="text-base font-black text-text">{product.name}</h2>
              <p className="text-xs text-muted mt-0.5 uppercase tracking-wide font-bold">{product.category}</p>
              {product.variants.length === 1 && product.variants[0]?.sku && (
                <p className="text-xs font-mono text-muted mt-2">SKU: {product.variants[0].sku}</p>
              )}
            </section>

            {/* Variants */}
            {product.variants.length > 0 && (
              <section className="flex-1 px-5 py-4">
                <p className="text-[10px] font-black text-muted uppercase tracking-wide mb-3">
                  {product.variants.length === 1 ? 'Variante' : `${product.variants.length} Variantes`}
                </p>
                <div className="flex flex-col gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                        selectedVariant?.id === v.id
                          ? 'border-accent/50 bg-accent/5'
                          : 'border-line bg-panel hover:border-line/60 hover:bg-panel-2',
                      )}
                    >
                      {v.imageUrl && v.imageUrl !== product.imageUrl && (
                        <div className="size-10 rounded-lg overflow-hidden flex-shrink-0">
                          <OdooImage url={v.imageUrl} alt="" className="w-full h-full" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-text truncate">
                          {v.variantDescription ?? v.sku ?? product.name}
                        </p>
                        {v.sku && v.variantDescription && (
                          <p className="text-[10px] font-mono text-muted">{v.sku}</p>
                        )}
                        {v.locationName && (
                          <p className="text-[10px] text-muted truncate">{v.locationName}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {v.trackInventory && v.available !== undefined ? (
                          <StockPill available={v.available} onHand={v.onHand ?? 0} />
                        ) : !v.trackInventory ? (
                          <span className="text-[10px] text-muted italic">Sin control</span>
                        ) : null}
                        {v.stockLocations && v.stockLocations.length > 1 && (
                          <div className="flex flex-col gap-0.5 items-end">
                            {v.stockLocations.map((loc) => (
                              <span key={loc.locationId} className="text-[10px] text-muted">
                                {loc.locationName}: <strong className="text-text">{loc.stock}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
