// Promo slots — seller ads + featured products (design system §05, "Promo banners").
//
// UI LAYER ONLY. The placements, tones and disclosure rules are final; the
// content below is placeholder copy standing in for what the back office will
// serve. `getPromos()` is the single seam — when the BO lands, swap its body for
// the API call and every surface keeps working unchanged.
//
// Two things here are policy, not decoration, and must survive the BO wiring:
//   1. `kind: 'sponsored'` ALWAYS renders a visible advertising disclosure.
//      Paid placement that reads as editorial is deceptive (and, for the EU
//      market this ships to, unlawful under the UCPD/DSA).
//   2. Tone rotation follows clay → gold → forest → felt so three stacked
//      placements never repeat a background.
import type { Locale } from './segments';

/** The design system's four banner backgrounds, in rotation order. */
export const PROMO_TONES = ['clay', 'gold', 'forest', 'felt'] as const;
export type PromoTone = (typeof PROMO_TONES)[number];

export type PromoKind =
  /** Paid seller placement — always disclosed. */
  | 'sponsored'
  /** House sale/campaign run by the marketplace itself. */
  | 'sale'
  /** Editorially chosen title — never paid. */
  | 'featured';

export interface Promo {
  id: string;
  kind: PromoKind;
  tone: PromoTone;
  /** Mono kicker above the headline, e.g. "Spring sale · ends Sunday". */
  kicker: Record<Locale, string>;
  /** Display headline. `{accent}` marks the phrase that takes the accent colour. */
  headline: Record<Locale, string>;
  cta: Record<Locale, string>;
  href: string;
  /** Mono stat line beside the CTA, e.g. "600+ titles · new & used". */
  stat?: Record<Locale, string>;
  /** Motif key repeated as the decorative right-hand mark. */
  motif?: string;
  /** Seller display name — required for `sponsored`, shown in the disclosure. */
  seller?: string;
}

/**
 * Assign a background to each placement in a stack.
 *
 * Each promo keeps its own tone — that's an editorial choice (a co-op pick wants
 * forest, a clearance wants clay). Rotation only steps in to break a tie: if a
 * promo would repeat the tone directly above it, it advances through
 * `PROMO_TONES` to the next free one, which is what the design system's
 * "never repeat a background" rule is actually protecting against.
 */
export function rotateTones<T extends { tone: PromoTone }>(items: T[]): { item: T; tone: PromoTone }[] {
  let prev: PromoTone | undefined;
  return items.map((item) => {
    let tone = item.tone;
    if (tone === prev) {
      const from = PROMO_TONES.indexOf(tone);
      tone = PROMO_TONES[(from + 1) % PROMO_TONES.length];
    }
    prev = tone;
    return { item, tone };
  });
}

// ── Placeholder inventory (BO replaces this) ────────────────────────────────
const PLACEHOLDER: Promo[] = [
  {
    id: 'house-strategy-sale',
    kind: 'sale',
    tone: 'clay',
    kicker: { es: 'Ofertas de temporada · hasta el domingo', en: 'Seasonal sale · ends Sunday' },
    headline: {
      es: 'Hasta un {accent:30% menos} en juegos de estrategia',
      en: 'Up to {accent:30% off} strategy games',
    },
    cta: { es: 'Ver ofertas', en: 'Shop the sale' },
    href: '/es/juegos-de-mesa?sort=price_asc',
    stat: { es: '600+ títulos · nuevos y de segunda mano', en: '600+ titles · new & used' },
    motif: 'strategy',
  },
  {
    id: 'featured-coop',
    kind: 'featured',
    tone: 'forest',
    kicker: { es: 'Elección de la redacción', en: "Editor's pick" },
    headline: {
      es: 'Cooperativos que {accent:aguantan diez partidas}',
      en: 'Co-ops that {accent:survive ten plays}',
    },
    cta: { es: 'Explorar cooperativos', en: 'Browse co-ops' },
    href: '/es/categorias/juegos-cooperativos',
    stat: { es: 'seleccionados a mano · sin pago de por medio', en: 'hand-picked · never paid placement' },
    motif: 'cooperative',
  },
];

/**
 * Promos for a placement. Returns [] when the slot has no inventory — every
 * caller must render nothing rather than a gap.
 */
export function getPromos(placement: 'home' | 'categories' | 'listing', limit = 2): Promo[] {
  // BO seam: replace with the served inventory for `placement`.
  const byPlacement: Record<typeof placement, string[]> = {
    home: ['house-strategy-sale', 'featured-coop'],
    categories: ['featured-coop'],
    listing: ['house-strategy-sale'],
  };
  const ids = byPlacement[placement] ?? [];
  return ids
    .map((id) => PLACEHOLDER.find((p) => p.id === id))
    .filter((p): p is Promo => Boolean(p))
    .slice(0, limit);
}

/** Split `{accent:…}` headlines into plain/accented runs for rendering. */
export function parseHeadline(text: string): { text: string; accent: boolean }[] {
  const parts: { text: string; accent: boolean }[] = [];
  const re = /\{accent:([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), accent: false });
    parts.push({ text: m[1], accent: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), accent: false });
  return parts;
}
