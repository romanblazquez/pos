// Centralized SEO metadata service (spec §4).
//
// Every page type calls buildMetadata() with a canonical path + locale and gets
// a consistent Next Metadata object: title, description, canonical, hreflang
// alternates, robots, Open Graph and Twitter cards.
//
// hreflang policy (spec §3): alternates are emitted ONLY for indexable locales.
// While EN is noindex, an ES page self-references (canonical + hreflang es +
// x-default=es) and does NOT point hreflang at the noindex EN page — putting a
// noindex URL in an hreflang cluster is contradictory and gets ignored anyway.
import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, absoluteUrl } from './site';
import {
  type EntityKind,
  type Locale,
  INDEXABLE_LOCALES,
  isIndexable,
  segmentFor,
} from './segments';

export interface SeoInput {
  locale: Locale;
  /** Canonical path for THIS locale, e.g. /es/juegos-de-mesa/catan */
  path: string;
  title: string;
  description: string;
  /** Per-locale paths for the same entity, used to build hreflang. */
  alternates?: Partial<Record<Locale, string>>;
  images?: string[];
  /** Force noindex even on an indexable locale (e.g. search results). */
  noindex?: boolean;
  type?: 'website' | 'article' | 'product';
}

const OG_LOCALE: Record<Locale, string> = { es: 'es_MX', en: 'en_US' };
const DEFAULT_OG_IMAGE = absoluteUrl('/og-default.png');
const DEFAULT_TWITTER_IMAGE = absoluteUrl('/twitter-card.png');
const DEFAULT_SOCIAL_ALT = 'Juegospedia — El mejor juego al mejor precio';

export function buildMetadata(input: SeoInput): Metadata {
  const canonical = absoluteUrl(input.path);
  const indexable = isIndexable(input.locale) && !input.noindex;

  // hreflang cluster: only indexable locales that have a known alternate path.
  const languages: Record<string, string> = {};
  if (indexable && input.alternates) {
    for (const locale of INDEXABLE_LOCALES) {
      const altPath = input.alternates[locale];
      if (altPath) languages[locale] = absoluteUrl(altPath);
    }
    const xDefault = input.alternates.es ?? input.path;
    if (xDefault) languages['x-default'] = absoluteUrl(xDefault);
  }

  const suppliedImages = (input.images ?? []).filter(Boolean).map(absoluteUrl).slice(0, 4);
  const openGraphImages = suppliedImages.length
    ? suppliedImages
    : [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: DEFAULT_SOCIAL_ALT,
          type: 'image/png',
        },
      ];
  const twitterImages = suppliedImages.length
    ? suppliedImages.slice(0, 1)
    : [{ url: DEFAULT_TWITTER_IMAGE, alt: DEFAULT_SOCIAL_ALT }];

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical,
      ...(Object.keys(languages).length ? { languages } : {}),
    },
    robots: indexable
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        }
      : { index: false, follow: true },
    openGraph: {
      type: input.type === 'article' ? 'article' : 'website',
      siteName: SITE_NAME,
      locale: OG_LOCALE[input.locale],
      url: canonical,
      title: input.title,
      description: input.description,
      images: openGraphImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: twitterImages,
    },
  };
}

/** Convenience: localized alternates for an entity across all locales. */
export function entityAlternates(kind: EntityKind, slug: string): Partial<Record<Locale, string>> {
  return {
    es: `/es/${segmentFor(kind, 'es')}/${slug}`,
    en: `/en/${segmentFor(kind, 'en')}/${slug}`,
  };
}

export { SITE_URL };
