import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Bricolage_Grotesque, Hanken_Grotesk, Space_Mono } from 'next/font/google';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { organizationLd, webSiteLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/JsonLd';
import { Analytics } from '@/components/Analytics';
import { MeepleMark } from '@/components/MeepleMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { MobileMenu } from '@/components/MobileMenu';
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
  applicationName: SITE_NAME,
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  title: {
    default: `${SITE_NAME} — Compara precios de juegos de mesa`,
    template: `%s · ${SITE_NAME}`,
  },
  description: 'Compara precios, stock real y créditos de juegos de mesa en tiendas verificadas.',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'es_MX',
    url: SITE_URL,
    title: `${SITE_NAME} — Compara, juega, colecciona`,
    description: 'Compara precios, stock real y créditos de juegos de mesa en tiendas verificadas.',
    images: [{
      url: '/og-default.png',
      width: 1200,
      height: 630,
      alt: 'Juegospedia — El mejor juego al mejor precio',
      type: 'image/png',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Compara, juega, colecciona`,
    description: 'Compara precios, stock real y créditos de juegos de mesa en tiendas verificadas.',
    images: ['/twitter-card.png'],
  },
  other: {
    'msapplication-TileColor': '#B4502E',
    'msapplication-config': '/browserconfig.xml',
    'mobile-web-app-capable': 'yes',
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
      ? { games: 'Juegos', cats: 'Categorías', guides: 'Guías', search: 'Buscar', tagline: 'La enciclopedia de juegos de mesa con el mejor precio.' }
      : { games: 'Games', cats: 'Categories', guides: 'Guides', search: 'Search', tagline: 'The board-game encyclopedia with the best price.' };

  return (
    <html
      lang={locale}
      className={`${hanken.variable} ${bricolage.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#B4502E" />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var match = document.cookie.match(/(?:^|;\\s*)jp-theme=(light|dark)(?:;|$)/);
            var theme = match ? match[1] : localStorage.getItem('jp-theme');
            if (theme !== 'light' && theme !== 'dark') {
              theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            document.documentElement.dataset.theme = theme;
            document.documentElement.style.colorScheme = theme;
          } catch (_) {}
        ` }} />
      </head>
      <body>
        <Analytics />
        <JsonLd data={[organizationLd(), webSiteLd()]} />
        <header className="site-header">
          <div className="container">
            <Link href={`/${locale}`} className="brand" aria-label={SITE_NAME}>
              <span className="brand-mark"><MeepleMark /></span>
              <span>Juegos<span className="brand-word-accent">pedia</span></span>
            </Link>
            <nav className="nav nav-desktop" aria-label={locale === 'es' ? 'Principal' : 'Main'}>
              <Link href={listingPath('games', locale)}>{t.games}</Link>
              <Link href={listingPath('categories', locale)}>{t.cats}</Link>
              <Link href={listingPath('guides', locale)}>{t.guides}</Link>
            </nav>
            <span className="nav-spacer" />
            <Link className="header-search nav-desktop" href={listingPath('search', locale)}>
              <span aria-hidden="true">⌕</span> {t.search}
            </Link>
            <div className="header-controls nav-desktop">
              <LocaleSwitcher locale={locale} />
              <ThemeToggle locale={locale} />
            </div>
            <MobileMenu locale={locale} />
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="container">
            <span className="brand footer-brand">
              <span className="brand-mark"><MeepleMark size={17} /></span>
              <span>Juegos<span className="brand-word-accent">pedia</span></span>
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
