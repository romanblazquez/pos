import { useEffect } from 'react';
import { useMarket } from '../context/MarketContext.js';

const SITE_URL = 'https://juegospedia.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;
const DEFAULT_TWITTER_IMAGE = `${SITE_URL}/twitter-card.png`;
const SEO_INDEXING_ENABLED = import.meta.env.VITE_SEO_INDEXING_ENABLED === 'true';
const GOOGLE_SITE_VERIFICATION = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION?.trim();

export interface SeoHeadProps {
  title: string;
  description: string;
  /** This app's own path — used for analytics and as the canonical fallback. */
  path: string;
  /**
   * Absolute canonical URL, when the indexable version of this view lives
   * somewhere other than this host's path.
   *
   * The app renders the same catalogue as the public site, so almost every page
   * here is a duplicate of one there. Left to derive from `path`, a view like
   * `/search?category=x` canonicalises to a public URL that is both redirected
   * and disallowed by robots.txt — which points the crawler at nothing at all.
   */
  canonical?: string;
  image?: string;
  type?: 'website' | 'product';
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  noindex?: boolean;
}

export function SeoHead({
  title,
  description,
  path,
  canonical,
  image = DEFAULT_IMAGE,
  type = 'website',
  jsonLd,
  noindex = false,
}: SeoHeadProps) {
  const { uiLocale } = useMarket();
  useEffect(() => {
    const shouldNoindex = noindex || !SEO_INDEXING_ENABLED;
    const canonicalUrl = canonical ?? new URL(path, SITE_URL).toString();
    const resolvedImage = new URL(image, SITE_URL).toString();
    const defaultImage = resolvedImage === DEFAULT_IMAGE;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta(
      'name',
      'robots',
      shouldNoindex ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large',
    );
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', resolvedImage);
    setMeta('property', 'og:image:secure_url', resolvedImage);
    setMeta('property', 'og:image:alt', title);
    if (defaultImage) {
      setMeta('property', 'og:image:type', 'image/png');
      setMeta('property', 'og:image:width', '1200');
      setMeta('property', 'og:image:height', '630');
    } else {
      removeMeta('property', 'og:image:type');
      removeMeta('property', 'og:image:width');
      removeMeta('property', 'og:image:height');
    }
    setMeta('property', 'og:locale', uiLocale === 'en' ? 'en_US' : 'es_MX');
    setMeta('property', 'og:site_name', 'Juegospedia');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', defaultImage ? DEFAULT_TWITTER_IMAGE : resolvedImage);
    setMeta('name', 'twitter:image:alt', title);
    if (GOOGLE_SITE_VERIFICATION) {
      setMeta('name', 'google-site-verification', GOOGLE_SITE_VERIFICATION);
    }
    setLink('canonical', canonicalUrl);

    const id = 'page-structured-data';
    document.getElementById(id)?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => document.getElementById(id)?.remove();
  }, [canonical, description, image, jsonLd, noindex, path, title, type, uiLocale]);

  return null;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function removeMeta(attribute: 'name' | 'property', key: string) {
  document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)?.remove();
}

function setLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}
