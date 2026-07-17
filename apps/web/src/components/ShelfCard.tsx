// Shelf card — one of the sixteen shelves (design system §06).
//
// Art, when commissioned, fills the 1:1 `[shelf]` slot; shelves still awaiting it
// fall back to their tint + motif, which is the designed placeholder rather than
// a hole. Either way the accent rule under the art keeps the set reading as one
// family.
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

export function ShelfCard({
  shelf,
  locale,
  share = true,
}: {
  shelf: Shelf;
  locale: Locale;
  /** Share affordance belongs on the browse hub, not in a compact home rail. */
  share?: boolean;
}) {
  const { theme, identity: id, count } = shelf;
  const href = entityPath('categories', locale, theme.slug[locale]);
  const label = theme.label[locale];

  return (
    <article
      className="category-card"
      data-dark={id.dark ? 'true' : undefined}
      style={{ '--cat-tint': id.tint, '--cat-accent': id.accent } as React.CSSProperties}
    >
      <Link href={href} className="category-card-link" aria-label={label}>
        <div className="category-card-media">
          {id.art ? (
            // Tiles render ~175px (mobile, 2-up) to ~286px (desktop, 4-up), so a
            // flat 640w over-serves every slot by ~2x. Two widths let the browser
            // pick: 360w covers 1x desktop and 2x mobile, 640w covers 2x desktop.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={id.art}
              srcSet={`${id.art.replace('.webp', '-360.webp')} 360w, ${id.art} 640w`}
              sizes="(max-width: 680px) 45vw, (max-width: 900px) 30vw, 290px"
              alt=""
              width={640}
              height={640}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <CategoryMotif motif={id.motif} className="category-card-motif" size={96} />
          )}
        </div>
        <span className="category-card-rule" aria-hidden="true" />
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
