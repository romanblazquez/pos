// JSON-LD generators (spec §6). Every emitted node mirrors content that is
// actually visible on the page. We deliberately DO NOT emit AggregateRating or
// Review: the only rating available (bggRating) is BoardGameGeek's, not our own
// review corpus, so claiming it as the product's rating would misrepresent the
// page. Add it only once real, visible, first-party reviews exist.
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

function offerLd(listing: Listing, canonicalUrl: string): Json {
  return {
    '@type': 'Offer',
    url: canonicalUrl,
    price: (listing.priceMinorUnits / 100).toFixed(2),
    priceCurrency: listing.currency,
    availability: availability(listing),
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@type': 'Organization', name: listing.sellerName },
  };
}

// Marketplace product with multiple seller offers -> Product + AggregateOffer
// (spec §5, §6). When a single offer exists, AggregateOffer still validates and
// keeps the shape uniform.
export function productLd(product: ProductDetail, canonicalPath: string): Json {
  const url = absoluteUrl(canonicalPath);
  const listings = product.listings ?? [];
  const prices = listings.map((l) => l.priceMinorUnits).filter((p) => p > 0);
  const currency = listings[0]?.currency ?? 'MXN';

  const node: Json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url,
    ...(product.description ? { description: product.description } : {}),
    ...(product.images?.length ? { image: product.images } : {}),
    ...(product.publisher ? { brand: { '@type': 'Brand', name: product.publisher } } : {}),
    ...(product.bggId
      ? {
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'BGG ID', value: product.bggId },
          ],
        }
      : {}),
  };

  if (prices.length) {
    node.offers =
      prices.length > 1
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: currency,
            lowPrice: (Math.min(...prices) / 100).toFixed(2),
            highPrice: (Math.max(...prices) / 100).toFixed(2),
            offerCount: prices.length,
            offers: listings.map((l) => offerLd(l, url)),
          }
        : offerLd(listings[0], url);
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
