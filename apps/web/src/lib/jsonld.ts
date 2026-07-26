// JSON-LD generators (spec §6). Every emitted node mirrors content that is
// actually visible on the page. We deliberately DO NOT emit AggregateRating or
// Review: the only rating available (bggRating) is BoardGameGeek's, not our own
// review corpus, so claiming it as the product's rating would misrepresent the
// page. Add it only once real, visible, first-party reviews exist.
import { majorUnits } from '@retail-os/ui-react';
import { ORGANIZATION, SITE_NAME, SITE_URL, absoluteUrl } from './site';
import type { ProductDetail, ProductSummary, Listing } from './api';

type Json = Record<string, unknown>;

export function organizationLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    url: ORGANIZATION.url,
    logo: ORGANIZATION.logo,
  };
}

export function webSiteLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/es/buscar?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbLd(crumbs: Crumb[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

// Maps internal stock status to a schema.org Offer availability URL.
function availability(listing: Listing): string {
  return listing.stock > 0
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';
}

// Google flags Offers with no price-validity horizon; a rolling ~30-day window
// (the page is ISR-revalidated well within it) clears the warning honestly.
function priceValidUntil(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function offerLd(listing: Listing, canonicalUrl: string): Json {
  return {
    '@type': 'Offer',
    url: canonicalUrl,
    price: majorUnits(listing.priceMinorUnits, listing.currency).toFixed(2),
    priceCurrency: listing.currency.trim().toUpperCase(),
    priceValidUntil: priceValidUntil(),
    availability: availability(listing),
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@type': 'Organization', name: listing.sellerName },
  };
}

/**
 * Offers this page is allowed to publish as structured data.
 *
 * Structured data is the one surface where a wrong currency is not merely
 * embarrassing: Google reads `priceCurrency` as a machine claim, compares it to
 * the rendered page, and suppresses rich results — or distrusts the domain —
 * when they disagree. So the rule is stricter here than in the UI: an offer is
 * published only if it carries a well-formed currency, a real price, and that
 * currency is the one this market actually transacts in.
 *
 * The API already market-scopes listings. This is the second lock, on the door
 * that matters most.
 */
function publishableOffers(listings: Listing[], marketCurrency?: string): Listing[] {
  const wanted = marketCurrency?.trim().toUpperCase();
  return listings.filter((listing) => {
    const code = listing.currency?.trim().toUpperCase() ?? '';
    if (!/^[A-Z]{3}$/.test(code)) return false;
    if (listing.priceMinorUnits <= 0) return false;
    return !wanted || code === wanted;
  });
}

// Marketplace product with multiple seller offers -> Product + AggregateOffer
// (spec §5, §6). When a single offer exists, AggregateOffer still validates and
// keeps the shape uniform.
//
// `marketCurrency` is the currency the page itself quotes. Pass it: without it
// the aggregate took its `priceCurrency` from whichever offer happened to sort
// first, so a product with one Mexican and two Argentine offers could publish
// ARS amounts labelled MXN — the same first-row-wins bug already removed from
// the cart, the search index and the price ranges, surviving where only a
// crawler would ever notice.
export function productLd(
  product: ProductDetail,
  canonicalPath: string,
  marketCurrency?: string,
): Json {
  const url = absoluteUrl(canonicalPath);
  const offers = publishableOffers(product.listings ?? [], marketCurrency);
  const prices = offers.map((l) => majorUnits(l.priceMinorUnits, l.currency));
  // Every surviving offer shares one currency, so this is a fact, not a guess.
  const currency = offers[0]?.currency.trim().toUpperCase();

  const node: Json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url,
    ...(product.description ? { description: product.description } : {}),
    ...(product.images?.length ? { image: product.images } : {}),
    ...(product.category ? { category: product.category } : {}),
    ...(product.publisher ? { brand: { '@type': 'Brand', name: product.publisher } } : {}),
    ...(product.bggId
      ? {
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'BGG ID', value: product.bggId },
          ],
        }
      : {}),
  };

  // No publishable offer means no `offers` node at all. A catalogue page with
  // nothing for sale must not invent an AggregateOffer: that is a fabricated
  // price to Google, and it earns a manual action rather than a rich result.
  if (prices.length && currency) {
    node.offers =
      prices.length > 1
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: currency,
            lowPrice: Math.min(...prices).toFixed(2),
            highPrice: Math.max(...prices).toFixed(2),
            offerCount: prices.length,
            offers: offers.map((l) => offerLd(l, url)),
          }
        : offerLd(offers[0], url);
  }

  return node;
}

export interface ItemListEntry {
  name: string;
  path: string;
}

// Category / listing pages -> ItemList of the visible products (spec §6).
export function itemListLd(entries: ItemListEntry[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.name,
      url: absoluteUrl(e.path),
    })),
  };
}

export function productSummaryName(p: ProductSummary): string {
  return p.name;
}

// Editorial hub -> Blog with a BlogPosting per guide. Richer than a bare ItemList:
// it tells search engines this is a first-party publication with dated, authored
// articles, which helps the section qualify for news/article rich results.
export function blogLd(input: {
  name: string;
  description: string;
  path: string;
  posts: Array<{
    title: string;
    path: string;
    datePublished: string;
    dateModified: string;
    author?: string;
    image?: string;
    description?: string;
  }>;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    publisher: {
      '@type': 'Organization',
      name: ORGANIZATION.name,
      logo: { '@type': 'ImageObject', url: ORGANIZATION.logo },
    },
    blogPost: input.posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: absoluteUrl(p.path),
      mainEntityOfPage: absoluteUrl(p.path),
      datePublished: p.datePublished,
      dateModified: p.dateModified,
      ...(p.description ? { description: p.description } : {}),
      ...(p.image ? { image: [p.image] } : {}),
      author: p.author
        ? { '@type': 'Person', name: p.author }
        : { '@type': 'Organization', name: SITE_NAME },
    })),
  };
}

// Editorial guide -> Article. First-party content authored by Juegospedia, so
// claiming authorship/publisher here is accurate (unlike catalogue ratings).
export function articleLd(input: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  image?: string;
  inLanguage?: string;
  articleSection?: string;
  wordCount?: number;
  citations?: string[];
  /** Named editorial profile; falls back to the organisation when absent. */
  author?: { name: string; url?: string; description?: string; knowsAbout?: string[] };
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    mainEntityOfPage: absoluteUrl(input.path),
    url: absoluteUrl(input.path),
    isAccessibleForFree: true,
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
    ...(input.articleSection ? { articleSection: input.articleSection } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    ...(input.citations?.length ? { citation: input.citations } : {}),
    author: input.author
      ? {
          '@type': 'Person',
          name: input.author.name,
          ...(input.author.url ? { url: absoluteUrl(input.author.url) } : {}),
          ...(input.author.description ? { description: input.author.description } : {}),
          ...(input.author.knowsAbout?.length ? { knowsAbout: input.author.knowsAbout } : {}),
        }
      : { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: ORGANIZATION.name,
      logo: { '@type': 'ImageObject', url: ORGANIZATION.logo },
    },
    ...(input.image ? { image: [input.image] } : {}),
  };
}

// Editor profile -> ProfilePage wrapping the Person. Google reads authorship
// from the Person that guides' Article.author points at, so the `path` here must
// be the exact URL used as `articleLd({ author: { url } })`.
export function personLd(input: {
  name: string;
  path: string;
  jobTitle: string;
  description: string;
  knowsAbout?: string[];
  /** Guides this editor wrote — evidences the expertise the profile claims. */
  authored?: Array<{ title: string; path: string }>;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: input.name,
      url: absoluteUrl(input.path),
      jobTitle: input.jobTitle,
      description: input.description,
      ...(input.knowsAbout?.length ? { knowsAbout: input.knowsAbout } : {}),
      worksFor: {
        '@type': 'Organization',
        name: ORGANIZATION.name,
        url: SITE_URL,
      },
    },
    ...(input.authored?.length
      ? {
          hasPart: input.authored.map((article) => ({
            '@type': 'Article',
            headline: article.title,
            url: absoluteUrl(article.path),
          })),
        }
      : {}),
  };
}

export function faqLd(faqs: Array<{ q: string; a: string }>): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
