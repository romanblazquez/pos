// Promo banner — site hero / email header / paid social (design system §05).
//
// Layout is the design system's: mono kicker, display headline with one accented
// phrase, solid CTA + mono stat line, and the motif repeated at two sizes as a
// low-opacity right-hand mark.
//
// Sponsored placements render a disclosure chip. That is deliberate and load-
// bearing — see the policy note in `lib/promos.ts`.
import Link from 'next/link';
import { CategoryMotif } from './CategoryMotif';
import { parseHeadline, type Promo, type PromoTone } from '@/lib/promos';
import type { Locale } from '@/lib/segments';

const DISCLOSURE: Record<Locale, string> = { es: 'Publicidad', en: 'Sponsored' };

/** "Sponsored by <seller>" — names who paid, which the chip alone doesn't. */
function sponsorLine(locale: Locale, seller: string): string {
  return locale === 'es' ? `Publicidad · ${seller}` : `Sponsored · ${seller}`;
}

export function PromoBanner({
  promo,
  locale,
  tone,
}: {
  promo: Promo;
  locale: Locale;
  /** Overrides the promo's own tone when a caller is rotating a stack. */
  tone?: PromoTone;
}) {
  const t = tone ?? promo.tone;
  const sponsored = promo.kind === 'sponsored';
  const runs = parseHeadline(promo.headline[locale]);

  return (
    <aside className={`promo promo-${t}`} aria-label={promo.kicker[locale]}>
      {promo.motif ? (
        <div className="promo-marks" aria-hidden="true">
          <CategoryMotif motif={promo.motif} size={64} />
          <CategoryMotif motif={promo.motif} size={92} />
        </div>
      ) : null}

      <div className="promo-body">
        <p className="promo-kicker">
          {sponsored && promo.seller ? sponsorLine(locale, promo.seller) : promo.kicker[locale]}
        </p>

        <p className="promo-headline">
          {runs.map((run, i) =>
            run.accent ? (
              <span key={i} className="promo-headline-accent">
                {run.text}
              </span>
            ) : (
              <span key={i}>{run.text}</span>
            ),
          )}
        </p>

        <div className="promo-actions">
          <Link href={promo.href} className="promo-cta">
            {promo.cta[locale]}
          </Link>
          {promo.stat ? <span className="promo-stat">{promo.stat[locale]}</span> : null}
        </div>
      </div>

      {sponsored ? <span className="promo-disclosure">{DISCLOSURE[locale]}</span> : null}
    </aside>
  );
}

/** Trust strip — shipping/returns reassurance. Forest bar, one idea, no CTA. */
export function PromoStrip({ locale }: { locale: Locale }) {
  return (
    <div className="promo-strip">
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h11v9H3z" />
        <path d="M14 9h4l3 3v3h-7z" />
        <circle cx="7" cy="18.2" r="1.7" />
        <circle cx="17.4" cy="18.2" r="1.7" />
      </svg>
      <span className="promo-strip-lead">
        {locale === 'es' ? 'Envío gratis desde 60 €' : 'Free shipping over €60'}
      </span>
      <span className="promo-strip-dot" aria-hidden="true" />
      <span className="promo-strip-detail">
        {locale === 'es'
          ? 'entrega en 1–2 días hábiles · devoluciones 2 años'
          : 'ships in 1–2 business days · 2-year returns'}
      </span>
    </div>
  );
}
