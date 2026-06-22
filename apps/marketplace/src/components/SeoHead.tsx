import { useEffect } from 'react';

const SITE_URL = 'https://juegospedia.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-default.jpg`;
const SEO_INDEXING_ENABLED = import.meta.env.VITE_SEO_INDEXING_ENABLED === 'true';
const GOOGLE_SITE_VERIFICATION = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION?.trim();

export interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'product';
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  noindex?: boolean;
}

export function SeoHead({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = 'website',
  jsonLd,
  noindex = false,
}: SeoHeadProps) {
  useEffect(() => {
    const shouldNoindex = noindex || !SEO_INDEXING_ENABLED;
    const canonicalUrl = new URL(path, SITE_URL).toString();
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', shouldNoindex ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:locale', 'es_MX');
    setMeta('property', 'og:site_name', 'Juegospedia');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
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
  }, [description, image, jsonLd, noindex, path, title, type]);

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

function setLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}
