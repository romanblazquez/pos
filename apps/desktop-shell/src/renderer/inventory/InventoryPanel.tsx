/**
 * InventoryPanel — unified stock and catalog view.
 *
 * Sources:
 *  - Odoo: real-time stock levels per warehouse location via EWP bridge
 *  - Tiendanube: catalog products (with variants/images) from local SQLite
 *
 * Layout: card grid with images + expandable variant rows.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Input, cn } from '@retail-os/ui-react';
import type { ErpInventoryUpdatedPayload } from '@retail-os/erp-core';
import type { ProductSnapshot } from '@retail-os/catalog';
import type { OdooBridgeState } from '../shell-bridge.js';

// ── Types ──────────────────────────────────────────────────────────────────

type OdooItem = ErpInventoryUpdatedPayload['items'][number];
type Source = 'all' | 'odoo' | 'tiendanube';

interface ProductCard {
  id: string;            // templateId or single product id
  name: string;
  category: string;
  imageUrl?: string;
  source: 'odoo' | 'tiendanube';
  variants: VariantRow[];
}

interface VariantRow {
  id: string;
  sku: string;
  variantDescription?: string;
  imageUrl?: string;
  trackInventory: boolean;
  // Odoo-only
  locationName?: string;
  onHand?: number;
  available?: number;
}

// ── OdooImage: fetches authenticated Odoo images through the IPC proxy ──────

function OdooImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // Tiendanube / external HTTPS images load directly; Odoo images need auth proxy
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
      <div className={cn('bg-panel-2 flex items-center justify-center text-4xl opacity-10', className)}>
        📦
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn('object-cover', className)}
      loading="lazy"
      onError={() => setSrc(null)}
    />
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

const PAGE_SIZE = 40;

// ── Component ──────────────────────────────────────────────────────────────

export function InventoryPanel({ onProductOpen }: { onProductOpen?: (card: ProductCard) => void } = {}) {
  const retailOdoo = window.retailOdoo;
  const retailData = window.retailData;

  const [odooState, setOdooState] = useState<OdooBridgeState | null>(null);
  const [odooItems, setOdooItems] = useState<OdooItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductSnapshot[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [source, setSource] = useState<Source>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Load catalog from SQLite (both Odoo + Tiendanube products)
  const loadCatalog = useCallback(async () => {
    if (!retailData) return;
    const products = await retailData.listProducts();
    setCatalogProducts(products);
  }, [retailData]);

  useEffect(() => {
    void loadCatalog();

    if (!retailOdoo) return;
    void retailOdoo.getState().then(setOdooState);

    const offState = retailOdoo.onStateChanged((s) => {
      setOdooState(s);
    });
    const offInventory = retailOdoo.onInventoryUpdated((payload) => {
      setOdooItems(payload.items);
      setSyncedAt(payload.syncedAt);
      setPage(0);
      void loadCatalog(); // refresh SQLite catalog after Odoo sync
    });
    const offCatalog = retailOdoo.onCatalogSynced?.(() => {
      void loadCatalog();
    });

    // Tiendanube real-time delta poll
    const tn = (window as unknown as Record<string, unknown>).retailIntegrations as
      | { tiendanubeOnCatalogUpdated?: (h: () => void) => () => void }
      | undefined;
    const offTn = tn?.tiendanubeOnCatalogUpdated?.(() => { void loadCatalog(); });

    return () => {
      offState();
      offInventory();
      offCatalog?.();
      offTn?.();
    };
  }, [retailOdoo, loadCatalog]);

  useEffect(() => { setPage(0); }, [query, source]);

  const handleOdooSync = useCallback(async () => {
    if (!retailOdoo || syncing) return;
    setSyncing(true);
    try { await retailOdoo.syncInventory(); } finally { setSyncing(false); }
  }, [retailOdoo, syncing]);

  // ── Build unified product card list ────────────────────────────────────

  const cards = useMemo<ProductCard[]>(() => {
    const result: ProductCard[] = [];

    // ── Odoo cards (from real-time inventory events) ──
    if (source !== 'tiendanube') {
      // Group odoo inventory items by product (collapse per-location into one card)
      const odooByProduct = new Map<string, OdooItem[]>();
      for (const item of odooItems) {
        const g = odooByProduct.get(item.productErpId) ?? [];
        g.push(item);
        odooByProduct.set(item.productErpId, g);
      }

      // Find matching SQLite record for image/templateId
      const odooSqlite = new Map(
        catalogProducts
          .filter((p) => p.id.startsWith('odoo-'))
          .map((p) => [p.id.replace('odoo-', ''), p]),
      );

      // Group by template
      const templateMap = new Map<string, { items: OdooItem[]; sqlite?: ProductSnapshot }>();
      for (const [erpId, items] of odooByProduct) {
        const sqlite = odooSqlite.get(erpId);
        const key = sqlite?.templateId ?? `odoo-${erpId}`;
        const existing = templateMap.get(key);
        if (existing) {
          existing.items.push(...items);
        } else {
          templateMap.set(key, { items, sqlite });
        }
      }

      for (const [, { items, sqlite }] of templateMap) {
        const first = items[0];
        if (!first) continue;
        result.push({
          id: sqlite?.templateId ?? `odoo-${first.productErpId}`,
          name: first.productName,
          category: sqlite?.category ?? 'ERP',
          imageUrl: first.imageUrl ?? sqlite?.imageUrl,
          source: 'odoo',
          variants: items.map((item) => ({
            id: item.productErpId,
            sku: item.sku ?? '',
            variantDescription: item.variantDescription ?? sqlite?.variantDescription,
            imageUrl: item.imageUrl ?? sqlite?.imageUrl,
            trackInventory: item.trackInventory,
            locationName: item.locationName,
            onHand: item.onHand,
            available: item.available,
          })),
        });
      }
    }

    // ── Tiendanube cards (from SQLite catalog) ──
    if (source !== 'odoo') {
      const tnProducts = catalogProducts.filter((p) => p.id.startsWith('tn-'));

      // Group by templateId
      const templateMap = new Map<string, ProductSnapshot[]>();
      for (const p of tnProducts) {
        const key = p.templateId ?? p.id;
        const group = templateMap.get(key) ?? [];
        group.push(p);
        templateMap.set(key, group);
      }

      for (const [templateId, products] of templateMap) {
        const first = products[0];
        if (!first) continue;
        result.push({
          id: templateId,
          name: first.name,
          category: first.category,
          imageUrl: first.imageUrl,
          source: 'tiendanube',
          variants: products.flatMap((p) => {
            // If multi-location, expand into one row per location
            if (p.stockLocations && p.stockLocations.length > 1) {
              return p.stockLocations.map((loc) => ({
                id: `${p.id}:${loc.locationId}`,
                sku: p.sku,
                variantDescription: p.variantDescription,
                imageUrl: p.imageUrl,
                trackInventory: p.trackInventory,
                locationName: loc.locationName,
                onHand: loc.stock,
                available: loc.stock,
              }));
            }
            return [{
              id: p.id,
              sku: p.sku,
              variantDescription: p.variantDescription,
              imageUrl: p.imageUrl,
              trackInventory: p.trackInventory,
              onHand: p.stockOnHand,
              available: p.stockOnHand,
              locationName: p.stockLocations?.[0]?.locationName,
            }];
          }),
        });
      }
    }

    return result;
  }, [odooItems, catalogProducts, source]);

  // ── Filter + paginate ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!query.trim()) return cards;
    const q = query.toLowerCase();
    return cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.variants.some(
          (v) =>
            v.sku?.toLowerCase().includes(q) ||
            v.variantDescription?.toLowerCase().includes(q),
        ),
    );
  }, [cards, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const odooConnected = odooState?.status === 'connected' || odooState?.status === 'syncing';
  const tnCount = catalogProducts.filter((p) => p.id.startsWith('tn-')).length;
  const odooCount = odooItems.length;

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col h-full bg-bg overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-line bg-panel">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-black text-text tracking-tight leading-none">Inventario</h1>
            <p className="text-xs text-muted mt-0.5">
              {tnCount > 0 && <span className="text-[#7B3FE4] font-medium">{tnCount} Tiendanube</span>}
              {tnCount > 0 && odooCount > 0 && <span className="text-muted"> · </span>}
              {odooCount > 0 && <span className="text-emerald-500 font-medium">{odooCount} Odoo</span>}
              {syncedAt && <span className="text-muted"> · {new Date(syncedAt).toLocaleTimeString('es-MX')}</span>}
            </p>
          </div>
          {retailOdoo && (
            <Button
              size="sm"
              variant="outline"
              loading={syncing}
              disabled={!odooConnected}
              onClick={() => void handleOdooSync()}
              title="Sincronizar inventario Odoo"
            >
              {!syncing && <RefreshIcon className="size-3.5" />}
              Odoo
            </Button>
          )}
        </div>

        {/* Source tabs */}
        <div className="flex rounded-lg border border-line bg-panel-2 p-0.5 gap-0.5 self-start w-fit">
          {(['all', 'odoo', 'tiendanube'] as Source[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                'text-xs font-bold px-3 h-7 rounded-md transition-all',
                source === s
                  ? 'bg-bg text-text shadow-sm border border-line'
                  : 'text-muted hover:text-text',
              )}
            >
              {s === 'all' ? 'Todos' : s === 'odoo' ? '🟢 Odoo' : '🟣 Tiendanube'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Search ── */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-line bg-panel">
        <Input
          placeholder="Buscar producto, SKU, variante…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* ── Empty states ── */}
      {cards.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="size-16 rounded-2xl bg-panel-2 border border-line flex items-center justify-center text-3xl">
            📦
          </div>
          <div>
            <p className="text-sm font-semibold text-text">Sin productos</p>
            <p className="text-xs text-muted mt-1 max-w-xs">
              {source === 'odoo'
                ? 'Conecta Odoo y sincroniza el inventario en Configuración → Integraciones.'
                : source === 'tiendanube'
                  ? 'Conecta Tiendanube y sincroniza el catálogo en Configuración → Integraciones.'
                  : 'Conecta Odoo o Tiendanube en Configuración → Integraciones para ver el inventario.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Card grid ── */}
      {paginated.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {paginated.map((card) => (
              <ProductCardItem
                key={card.id}
                card={card}
                isExpanded={expanded.has(card.id)}
                onToggle={() => toggleExpand(card.id)}
                onOpen={() => onProductOpen
                  ? onProductOpen(card)
                  : void window.retailShell?.openApp('product-detail', card)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer: summary + pagination ── */}
      {filtered.length > 0 && (
        <footer className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-t border-line text-xs text-muted bg-panel">
          <span>{filtered.length} productos · {filtered.reduce((n, c) => n + c.variants.length, 0)} variantes</span>
          {totalPages > 1 && (
            <span className="flex items-center gap-1 mx-auto">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-6 px-2 rounded border border-line bg-panel-2 font-bold disabled:opacity-40 hover:border-accent/50 transition-all"
              >←</button>
              <span className="px-2 font-medium">{page + 1} / {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="h-6 px-2 rounded border border-line bg-panel-2 font-bold disabled:opacity-40 hover:border-accent/50 transition-all"
              >→</button>
            </span>
          )}
          <span className="ml-auto">
            <span className="text-danger">
              {filtered.reduce((n, c) =>
                n + c.variants.filter((v) => v.trackInventory && (v.available ?? 1) <= 0).length, 0,
              )} sin stock
            </span>
          </span>
        </footer>
      )}
    </div>
  );
}

// ── ProductCardItem ────────────────────────────────────────────────────────

function ProductCardItem({
  card,
  isExpanded,
  onToggle,
  onOpen,
}: {
  card: ProductCard;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const hasMultiVariant = card.variants.length > 1;
  const showExpand = hasMultiVariant || (card.variants.length === 1 && card.variants[0].locationName);

  // For single-variant Odoo, show stock directly on card
  const singleVariant = card.variants.length === 1 ? card.variants[0] : null;

  // Aggregate stock across all variants/locations (both Odoo and Tiendanube)
  const tracksInventory = card.variants.some((v) => v.trackInventory);
  const totalAvailable = tracksInventory
    ? card.variants.reduce((s, v) => s + (v.available ?? 0), 0)
    : null;

  return (
    <div className={cn(
      'rounded-xl border bg-panel overflow-hidden flex flex-col transition-all',
      card.source === 'odoo' ? 'border-emerald-500/20' : 'border-[#7B3FE4]/20',
    )}>
      {/* ── Image (click opens detail window) ── */}
      <button
        onClick={onOpen}
        className="relative w-full aspect-[4/3] bg-panel-2 flex-shrink-0 cursor-pointer group/img block text-left"
        title="Abrir detalle del producto"
      >
        {card.imageUrl ? (
          <OdooImage url={card.imageUrl} alt={card.name} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-10">📦</div>
        )}

        {/* Source badge */}
        <span className={cn(
          'absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-full border',
          card.source === 'odoo'
            ? 'bg-emerald-500/90 text-white border-emerald-600'
            : 'bg-[#7B3FE4]/90 text-white border-[#6030c0]',
        )}>
          {card.source === 'odoo' ? 'Odoo' : 'Tiendanube'}
        </span>

        {/* Variant count badge */}
        {hasMultiVariant && (
          <span className="absolute top-2 right-2 bg-bg/90 border border-line text-text text-[9px] font-black px-1.5 py-0.5 rounded-full">
            {card.variants.length} vars
          </span>
        )}

        {/* Stock badge */}
        {tracksInventory && totalAvailable !== null && (
          <div className={cn(
            'absolute bottom-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full border',
            totalAvailable <= 0
              ? 'bg-danger/90 text-white border-danger'
              : totalAvailable < 5
                ? 'bg-amber-500/90 text-white border-amber-600'
                : 'bg-ok/90 text-white border-ok/70',
          )}>
            {totalAvailable <= 0 ? 'Sin stock' : `${totalAvailable} disp.`}
          </div>
        )}
      </button>

      {/* ── Info ── */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <span className="text-[10px] font-black text-muted uppercase tracking-wide truncate">
          {card.category}
        </span>
        <p className="text-[13px] font-bold text-text leading-snug line-clamp-2 flex-1">
          {card.name}
        </p>

        {/* Single variant: show inline */}
        {singleVariant && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {singleVariant.variantDescription && (
              <span className="text-[10px] text-muted bg-panel-2 px-1.5 py-0.5 rounded-md border border-line">
                {singleVariant.variantDescription}
              </span>
            )}
            {singleVariant.sku && (
              <span className="text-[10px] font-mono text-muted">{singleVariant.sku}</span>
            )}
          </div>
        )}

        {/* Multi-variant toggle */}
        {showExpand && (
          <button
            onClick={onToggle}
            className="mt-1 flex items-center justify-between w-full text-[11px] font-bold text-muted hover:text-text transition-colors"
          >
            <span>{hasMultiVariant ? `${card.variants.length} variantes` : 'Ubicaciones'}</span>
            <span className={cn('transition-transform text-xs', isExpanded && 'rotate-180')}>▾</span>
          </button>
        )}
      </div>

      {/* ── Expanded variants ── */}
      {isExpanded && (
        <div className="border-t border-line divide-y divide-line/50">
          {card.variants.map((v) => (
            <div key={v.id} className="flex items-center gap-2 px-3 py-2">
              {v.imageUrl && v.imageUrl !== card.imageUrl && (
                <OdooImage url={v.imageUrl} alt="" className="size-7 rounded flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-text truncate">
                  {v.variantDescription ?? v.sku}
                </p>
                {v.locationName && (
                  <p className="text-[10px] text-muted truncate">{v.locationName}</p>
                )}
              </div>
              {v.trackInventory && v.available !== undefined ? (
                <StockPill available={v.available} onHand={v.onHand ?? 0} />
              ) : !v.trackInventory ? (
                <span className="text-[10px] text-muted">—</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StockPill({ available, onHand }: { available: number; onHand: number }) {
  if (available <= 0) {
    return <Badge variant="danger" className="text-[9px] px-1.5 py-0">0</Badge>;
  }
  if (onHand > 0 && available / onHand < 0.2) {
    return <Badge variant="warning" className="text-[9px] px-1.5 py-0">{available}</Badge>;
  }
  return <Badge variant="success" className="text-[9px] px-1.5 py-0">{available}</Badge>;
}
