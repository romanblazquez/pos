// Shelf hero — the landing page's half of the category identity (§06).
//
// The index promises a shelf with an accent, a motif and (where commissioned)
// its own artwork; this carries that promise through the click instead of
// dropping the visitor onto a bare <h1>. Same tint, same accent, same art — the
// `[hero]` 16:9 crop of the tile they just tapped.
//
// Deliberately restrained in height: this page's job is to show games, so the
// hero establishes place and then gets out of the way.
import { CategoryMotif } from './CategoryMotif';
import type { CategoryIdentity } from '@/lib/category-identity';
import type { Locale } from '@/lib/segments';

export function ShelfHero({
  identity: id,
  title,
  lede,
  total,
  locale,
}: {
  identity: CategoryIdentity;
  title: string;
  /** Empty on paginated pages — the shelf's intro, not a per-page restatement. */
  lede: string;
  total: number;
  locale: Locale;
}) {
  const hero = id.art?.replace('.webp', '-hero.webp');
  const games = locale === 'es' ? (total === 1 ? 'juego' : 'juegos') : total === 1 ? 'game' : 'games';

  return (
    <section
      className="shelf-hero"
      data-art={hero ? 'true' : undefined}
      data-dark={id.dark ? 'true' : undefined}
      style={{ '--cat-tint': id.tint, '--cat-accent': id.accent } as React.CSSProperties}
    >
      {hero ? (
        // The LCP element on this page — eager and high priority, never lazy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="shelf-hero-art"
          src={hero}
          alt=""
          width={1100}
          height={619}
          fetchPriority="high"
          decoding="async"
        />
      ) : (
        <CategoryMotif motif={id.motif} className="shelf-hero-motif" size={140} />
      )}

      <div className="shelf-hero-body">
        <h1 className="shelf-hero-title">{title}</h1>
        <p className="shelf-hero-count">
          {total} {games}
        </p>
        {lede ? <p className="shelf-hero-lede">{lede}</p> : null}
      </div>
    </section>
  );
}
