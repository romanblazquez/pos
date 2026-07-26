// Shelf card — one browse shelf (design system §06, Category Cards spec).
//
// Art fills the 4:3 `[shelf]` slot; shelves still awaiting it fall back to their
// tint + motif, which is the designed placeholder rather than a hole. Over the
// art sits the medal — a ficha in the shelf's seal colour carrying its motif in
// white, half-sunk into the card body. That stamp is what keeps the set reading
// as one family: same seal, same position, one motif per shelf.
import Link from 'next/link';
import { CategoryMotif } from './CategoryMotif';
import { CardShareButton } from './CardShareButton';
import { entityPath, type Locale } from '@/lib/segments';
import { absoluteUrl } from '@/lib/site';
import type { Shelf } from '@/lib/shelves';

function gamesWord(n: number, locale: Locale): string {
  if (locale === 'es') return n === 1 ? 'juego' : 'juegos';
  return n === 1 ? 'game' : 'games';
}

/** Widths the tile grid actually renders — see the comment at the <picture>. */
const TILE_SIZES = '(max-width: 680px) 45vw, (max-width: 900px) 30vw, 290px';

/** `/categories/card.webp` -> "…-360.avif 360w, …-640.avif 640w" */
function srcSet(art: string, ext: 'avif' | 'webp'): string {
  const base = art.replace(/\.webp$/, '');
  return `${base}-360.${ext} 360w, ${base}.${ext} 640w`;
}

export function ShelfCard({
  shelf,
  locale, market,
  share = true,
}: {
  shelf: Shelf;
  locale: Locale;
  /** Keeps the shelf link inside the shopper's market. */
  market?: string;
  /** Share affordance belongs on the browse hub, not in a compact home rail. */
  share?: boolean;
}) {
  const { theme, identity: id, count } = shelf;
  const href = entityPath('categories', locale, theme.slug[locale], market);
  const label = theme.label[locale];

  return (
    <article
      className="category-card"
      data-dark={id.dark ? 'true' : undefined}
      style={
        {
          '--cat-tint': id.tint,
          '--cat-accent': id.accent,
          '--cat-seal': id.seal ?? id.accent,
        } as React.CSSProperties
      }
    >
      <Link href={href} className="category-card-link" aria-label={label}>
        <div className="category-card-media">
          {id.art ? (
            // Tiles render ~175px (mobile, 2-up) to ~286px (desktop, 4-up), so a
            // flat 640w over-serves every slot by ~2x. Two widths let the browser
            // pick: 360w covers 1x desktop and 2x mobile, 640w covers 2x desktop.
            // AVIF first (~47% lighter than WebP here); WebP is the fallback.
            <picture>
              <source type="image/avif" srcSet={srcSet(id.art, 'avif')} sizes={TILE_SIZES} />
              <source type="image/webp" srcSet={srcSet(id.art, 'webp')} sizes={TILE_SIZES} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={id.art} alt="" width={640} height={480} loading="lazy" decoding="async" />
            </picture>
          ) : (
            <CategoryMotif motif={id.motif} className="category-card-motif" size={96} />
          )}
          {/* The medal reads as one object, so the whole stamp is aria-hidden —
              the shelf name below is the accessible label. */}
          <span className="category-card-seal" aria-hidden="true">
            <span className="category-card-seal-ring" />
            <CategoryMotif motif={id.motif} className="category-card-seal-motif" size={22} />
          </span>
        </div>
        <div className="category-card-body">
          <h2 className="category-card-name">{label}</h2>
          <span className="category-card-count">
            {count} {gamesWord(count, locale)}
          </span>
        </div>
      </Link>
      {share ? <CardShareButton url={absoluteUrl(href)} title={label} locale={locale} /> : null}
    </article>
  );
}
