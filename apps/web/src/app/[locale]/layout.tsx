import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Inter, Fraunces } from 'next/font/google';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { organizationLd, webSiteLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { LOCALES, isLocale, listingPath, type Locale } from '@/lib/segments';
import '../globals.css';

// Self-hosted at build (zero layout shift): Inter for UI/body (brand match),
// Fraunces as the display serif for the "encyclopedia/almanac" identity.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Compara precios de juegos de mesa`,
    template: `%s · ${SITE_NAME}`,
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
  const t =
    locale === 'es'
      ? { games: 'Juegos', cats: 'Categorías', search: 'Buscar', tagline: 'La enciclopedia de juegos de mesa con el mejor precio.' }
      : { games: 'Games', cats: 'Categories', search: 'Search', tagline: 'The board-game encyclopedia with the best price.' };

  return (
    <html lang={locale} className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <JsonLd data={[organizationLd(), webSiteLd()]} />
        <header className="site-header">
          <div className="container">
            <Link href={`/${locale}`} className="brand" aria-label={SITE_NAME}>
              Juegos<b>pedia</b>
            </Link>
            <nav className="nav" aria-label={locale === 'es' ? 'Principal' : 'Main'}>
              <Link href={listingPath('games', locale)}>{t.games}</Link>
              <Link href={listingPath('categories', locale)}>{t.cats}</Link>
              <Link href={listingPath('search', locale)}>{t.search}</Link>
            </nav>
            <span className="nav-spacer" />
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="container">
            <span className="brand" style={{ fontSize: '1.05rem' }}>
              Juegos<b>pedia</b>
            </span>
            <span>{t.tagline}</span>
            <span className="nav-spacer" />
            <Link href={listingPath('games', locale)}>{t.games}</Link>
            <Link href={listingPath('categories', locale)}>{t.cats}</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
