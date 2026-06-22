import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { organizationLd, webSiteLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { LOCALES, isLocale, segmentFor, type Locale } from '@/lib/segments';
import '../globals.css';

// With [locale] as the top segment this IS the root layout: it owns <html> and
// sets lang per request, so /es and /en emit the correct language signal.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Compara precios de juegos de mesa`,
    template: `%s | ${SITE_NAME}`,
  },
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  return (
    <html lang={locale}>
      <body>
        <JsonLd data={[organizationLd(), webSiteLd()]} />
        <header className="container" style={{ paddingBottom: 0 }}>
          <Link href={`/${locale}`} style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {SITE_NAME}
          </Link>
          {' · '}
          <Link href={`/${locale}/${segmentFor('games', locale)}`}>
            {locale === 'es' ? 'Juegos de mesa' : 'Board games'}
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
