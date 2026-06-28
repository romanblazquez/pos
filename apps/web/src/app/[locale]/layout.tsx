import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Bricolage_Grotesque, Hanken_Grotesk, Space_Mono } from 'next/font/google';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { organizationLd, webSiteLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { Analytics } from '@/components/Analytics';
import { MeepleMark } from '@/components/MeepleMark';
import { LOCALES, isLocale, listingPath, type Locale } from '@/lib/segments';
import '../globals.css';

const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken', display: 'swap' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});
const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
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
    <html lang={locale} className={`${hanken.variable} ${bricolage.variable} ${mono.variable}`}>
      <body>
        <Analytics />
        <JsonLd data={[organizationLd(), webSiteLd()]} />
        <header className="site-header">
          <div className="container">
            <Link href={`/${locale}`} className="brand" aria-label={SITE_NAME}>
              <span className="brand-mark"><MeepleMark /></span>
              <span>Juegospedia</span>
            </Link>
            <nav className="nav" aria-label={locale === 'es' ? 'Principal' : 'Main'}>
              <Link href={listingPath('games', locale)}>{t.games}</Link>
              <Link href={listingPath('categories', locale)}>{t.cats}</Link>
            </nav>
            <span className="nav-spacer" />
            <Link className="header-search" href={listingPath('search', locale)}>
              <span aria-hidden="true">⌕</span> {t.search}
            </Link>
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="container">
            <span className="brand footer-brand">
              <span className="brand-mark"><MeepleMark size={17} /></span>
              <span>Juegospedia</span>
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
