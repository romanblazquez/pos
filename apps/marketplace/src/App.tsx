import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, LogOut, Menu, Moon, ShoppingCart, Store, Sun, User, Wallet, X } from 'lucide-react';
import SearchPage from './pages/SearchPage.js';
import ProductPage from './pages/ProductPage.js';
import HomePage from './pages/HomePage.js';
import AccountPage from './pages/AccountPage.js';
import WalletPage from './pages/WalletPage.js';
import OrdersPage from './pages/OrdersPage.js';
import AddressesPage from './pages/AddressesPage.js';
import { CartProvider, useCart } from './cart/CartContext.js';
import CartDrawer from './cart/CartDrawer.js';
import { CustomerProvider, useCustomer } from './context/CustomerContext.js';
import { ShelfProvider, useShelf } from './context/ShelfContext.js';
import { MarketProvider, useMarket } from './context/MarketContext.js';
import { IntlProvider, useIntl } from 'react-intl';
import esMessages from './i18n/messages/es.json';
import enMessages from './i18n/messages/en.json';
import { useWallet } from './hooks/useWallet.js';
import AuthModal from './components/AuthModal.js';
import { BrandMark } from './components/BrandMark.js';
import { Button } from './components/ui/index.js';
import { CatalogSearchBar, LocaleSwitcher, MarketSwitcher } from '@retail-os/ui-react';
import { formatMoney, WALLET_CURRENCY } from './marketplace-meta.js';
import { trackPageView, trackEvent } from './analytics.js';
import { type Route, parseRoute, routePath } from './routing.js';
import { API_BASE, marketplaceApi } from './lib/api-client.js';

const MESSAGES: Record<'es' | 'en', Record<string, string>> = { es: esMessages, en: enMessages };

/** Sits inside MarketProvider (needs uiLocale) and outside every useIntl() consumer. */
function AppIntlProvider({ children }: { children: ReactNode }) {
  const { uiLocale } = useMarket();
  return (
    <IntlProvider locale={uiLocale} messages={MESSAGES[uiLocale]} defaultLocale="es">
      {children}
    </IntlProvider>
  );
}


type Theme = 'light' | 'dark';

const UI_LOCALES = ['es', 'en'] as const;

function readSharedTheme(): Theme | null {
  const cookie = document.cookie.match(/(?:^|;\s*)jp-theme=(light|dark)(?:;|$)/)?.[1];
  return cookie === 'light' || cookie === 'dark' ? cookie : null;
}
function persistSharedTheme(theme: Theme) {
  const sharedDomain = location.hostname === 'juegospedia.com' || location.hostname.endsWith('.juegospedia.com');
  const secure = location.protocol === 'https:';
  document.cookie = [
    `jp-theme=${theme}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    sharedDomain ? 'Domain=.juegospedia.com' : '',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
  localStorage.setItem('jp-theme', theme);
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const shared = readSharedTheme();
    if (shared) return shared;
    const stored = localStorage.getItem('jp-theme') ?? localStorage.getItem('mkt_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    persistSharedTheme(theme);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#CE6A41' : '#B4502E',
    );
  }, [theme]);

  useEffect(() => {
    const syncSharedTheme = () => {
      const shared = readSharedTheme();
      if (shared) setTheme(shared);
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncSharedTheme();
    };
    window.addEventListener('focus', syncSharedTheme);
    document.addEventListener('visibilitychange', syncWhenVisible);
    return () => {
      window.removeEventListener('focus', syncSharedTheme);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, []);

  return (
    <MarketProvider>
      <AppIntlProvider>
        <CustomerProvider>
          <ShelfProvider>
            <CartProvider>
              <AppInner theme={theme} toggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
            </CartProvider>
          </ShelfProvider>
        </CustomerProvider>
      </AppIntlProvider>
    </MarketProvider>
  );
}

type CheckoutState =
  | { state: 'idle' }
  | { state: 'checking'; orderId: string }
  | { state: 'confirmed'; orderId: string }
  | { state: 'delayed'; orderId: string }
  | { state: 'failed'; message: string };

function AppInner({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, window.location.search),
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutState>({ state: 'idle' });
  const { session, isLoading: isSessionLoading } = useCustomer();
  const { awardXP } = useShelf();

  const isAccountRoute = route.page === 'account'
    || route.page === 'wallet'
    || route.page === 'orders'
    || route.page === 'addresses';

  useEffect(() => {
    if (!isSessionLoading && isAccountRoute && !session) setAuthOpen(true);
  }, [isAccountRoute, isSessionLoading, session]);

  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    trackPageView(routePath(route));
  }, [route]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Our own dev-mode fallback appends `order_id`; a real MercadoPago redirect
    // appends its own params instead — `external_reference` is the one we set to
    // our orderId when creating the preference, and `status`/`collection_status`
    // carry approved | pending | rejected (never `order_id`/`failure`, which only
    // existed in the dev-mode path and never matched a real payment redirect).
    const orderId = params.get('order_id') ?? params.get('external_reference');
    const status = params.get('status') ?? params.get('collection_status');
    if (!orderId) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (status === 'rejected' || status === 'failure') {
      setCheckout({ state: 'failed', message: 'El pago fue rechazado. Podés intentar de nuevo.' });
      return;
    }
    setCheckout({ state: 'checking', orderId });
    let cancelled = false;

    // The webhook (server push) should have already confirmed the order by the
    // time the buyer lands back here — reconcile is just a one-shot backstop in
    // case the webhook hasn't arrived yet. A short bounded retry (not indefinite
    // polling) covers that race; if it's still not confirmed after a few seconds,
    // hand off to a "still processing" state instead of an endless spinner —
    // "Mis pedidos" self-heals on view, so the buyer always has a way forward.
    async function checkStatus(id: string, attempt: number): Promise<void> {
      if (cancelled) return;
      try {
        if (attempt === 0) await marketplaceApi.fetch(`${API_BASE}/api/v1/checkout/orders/${id}/reconcile`, { method: 'POST' });
        const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/checkout/orders/${id}`);
        if (!res.ok) throw new Error();
        const order = (await res.json()) as { status: string };
        if (cancelled) return;
        if (order.status === 'confirmed') { setCheckout({ state: 'confirmed', orderId: id }); awardXP(60, 'Compra completada'); return; }
        if (order.status === 'cancelled') { setCheckout({ state: 'failed', message: 'El pago fue cancelado.' }); return; }
      } catch {
        if (cancelled) return;
      }
      if (attempt >= 3) { setCheckout({ state: 'delayed', orderId: id }); return; }
      setTimeout(() => checkStatus(id, attempt + 1), 1500);
    }
    checkStatus(orderId, 0);

    return () => { cancelled = true; };
  }, []);

  function navigate(r: Route) {
    const isAccountPage = r.page === 'account' || r.page === 'wallet' || r.page === 'orders' || r.page === 'addresses';
    if (isAccountPage && !session) { setAuthOpen(true); return; }
    setRoute(r);
    window.history.pushState({}, '', routePath(r));
    window.scrollTo(0, 0);
  }

  function replaceRoute(r: Route) {
    setRoute(r);
    window.history.replaceState({}, '', routePath(r));
    window.scrollTo(0, 0);
  }

  if (checkout.state !== 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[--bg]">
        <div className="w-full max-w-sm rounded-2xl border border-[--border] bg-[--bg-raised] p-10 text-center space-y-4 shadow-lg">
          {checkout.state === 'checking' && (
            <>
              <p className="text-4xl animate-pulse">⏳</p>
              <h1 className="text-lg font-bold text-[--tx]">Confirmando tu pago…</h1>
              <p className="text-sm text-[--tx-muted]">Esto toma solo unos segundos.</p>
            </>
          )}
          {checkout.state === 'delayed' && (
            <>
              <p className="text-4xl">📨</p>
              <h1 className="text-lg font-bold text-[--tx]">Tu pago se está procesando</h1>
              <p className="text-sm text-[--tx-muted]">
                MercadoPago todavía no nos confirma el resultado — esto puede tardar un poco más.
                Te avisaremos en "Mis pedidos" en cuanto se confirme.
              </p>
              <Button onClick={() => { setCheckout({ state: 'idle' }); navigate({ page: 'orders' }); }}>
                Ver mis pedidos
              </Button>
            </>
          )}
          {checkout.state === 'confirmed' && (
            <>
              <p className="text-4xl">🎉</p>
              <h1 className="text-lg font-bold text-[--success]">¡Pago confirmado!</h1>
              <p className="text-sm text-[--tx-muted]">
                Pedido <code className="font-mono text-xs bg-[--bg-subtle] px-1.5 py-0.5 rounded">{checkout.orderId.slice(-10)}</code> recibido.
              </p>
              <Button onClick={() => { setCheckout({ state: 'idle' }); navigate({ page: 'orders' }); }}>
                Ver mis pedidos
              </Button>
            </>
          )}
          {checkout.state === 'failed' && (
            <>
              <p className="text-4xl">❌</p>
              <h1 className="text-lg font-bold text-red-600">Pago no completado</h1>
              <p className="text-sm text-[--tx-muted]">{checkout.message}</p>
              <Button variant="outline" onClick={() => setCheckout({ state: 'idle' })}>
                Volver al marketplace
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const isAccount = route.page === 'account' || route.page === 'wallet' || route.page === 'orders' || route.page === 'addresses';

  return (
    <div className="min-h-screen bg-[--bg]">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        searchQuery={route.page === 'search' ? route.q : ''}
        onSearch={(q) => navigate({ page: 'search', q })}
        onProduct={(slug) => navigate({ page: 'product', slug })}
        onHome={() => navigate({ page: 'home' })}
        onCartOpen={() => setCartOpen(true)}
        onAccountClick={() => navigate({ page: 'account' })}
        onWalletClick={() => navigate({ page: 'wallet' })}
        onAuthClick={() => setAuthOpen(true)}
      />

      {/* Account subnav */}
      {isAccount && session && (
        <div className="border-b border-[--border] bg-[--bg-raised]">
          <nav className="max-w-3xl mx-auto px-4 flex items-center gap-1 h-10">
            {([
              { page: 'account', label: 'Resumen' },
              { page: 'wallet', label: 'Wallet' },
              { page: 'orders', label: 'Pedidos' },
              { page: 'addresses', label: 'Direcciones' },
            ] as const).map(({ page, label }) => (
              <button
                key={page}
                onClick={() => navigate({ page })}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
                  ${route.page === page
                    ? 'bg-[--success-bg] text-[--success]'
                    : 'bg-[--bg-subtle] text-[--tx-muted] hover:text-[--tx] hover:bg-[--bg-hover]'}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main className="animate-fade-in">
        {route.page === 'home' && (
          <HomePage
            onSearch={(q, category) => navigate({ page: 'search', q, category })}
            onProduct={(slug) => navigate({ page: 'product', slug })}
          />
        )}
        {route.page === 'search' && (
          <SearchPage
            query={route.q}
            category={route.category}
            onSearch={(q, category) => navigate({ page: 'search', q, category })}
            onProduct={(slug) => navigate({ page: 'product', slug })}
            onHome={() => navigate({ page: 'home' })}
          />
        )}
        {route.page === 'product' && (
          <ProductPage
            slug={route.slug}
            onCartOpen={() => setCartOpen(true)}
            onHome={() => navigate({ page: 'home' })}
            onCategory={(category) => navigate({ page: 'search', q: '', category })}
            onProduct={(slug) => navigate({ page: 'product', slug })}
          />
        )}
        {route.page === 'account' && session && (
          <AccountPage
            onNavigate={(p) => navigate({ page: p })}
            onLogout={() => replaceRoute({ page: 'home' })}
          />
        )}
        {route.page === 'wallet' && session && <WalletPage />}
        {route.page === 'orders' && session && <OrdersPage />}
        {route.page === 'addresses' && session && <AddressesPage />}
      </main>

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} onRequireAuth={() => setAuthOpen(true)} />}
      {authOpen && (
        <AuthModal
          onClose={() => {
            setAuthOpen(false);
            if (session) navigate({ page: 'account' });
            else if (isAccountRoute) replaceRoute({ page: 'home' });
          }}
          defaultTab="login"
        />
      )}
    </div>
  );
}

function Header({
  theme, onToggleTheme, searchQuery, onSearch, onProduct, onHome, onCartOpen, onAccountClick, onWalletClick, onAuthClick,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  /** Current query from the URL — the header search reflects it as single source of truth. */
  searchQuery: string;
  onSearch: (q: string) => void;
  onProduct: (slug: string) => void;
  onHome: () => void;
  onCartOpen: () => void;
  onAccountClick: () => void;
  onWalletClick: () => void;
  onAuthClick: () => void;
}) {
  const [q, setQ] = useState(searchQuery);
  const { count } = useCart();
  const { session, isLoading } = useCustomer();
  const { data: walletSummary } = useWallet(session?.customer.id);
  const { uiLocale, setUiLocale, markets, countryCode, setMarketCode } = useMarket();
  const intl = useIntl();

  // The switcher takes the shared shape; the API's market DTO is per-country.
  const marketOptions = markets.map((m) => ({
    code: m.countryCode,
    name: m.countryName,
    currency: m.currencyCode,
  }));

  // Keep the input in sync with the URL (submits, links, browser back/forward).
  useEffect(() => setQ(searchQuery), [searchQuery]);

  const walletTotal = walletSummary
    ? walletSummary.platformCreditsMinor + walletSummary.storeCredits.reduce((sum, item) => sum + item.balanceMinor, 0)
    : 0;

  // Single search-submission flow (Enter, icon, suggestion). Fires the `search`
  // analytics that used to live in SearchPage's now-removed input, trims, skips
  // empty queries, and avoids re-navigating when the query is unchanged.
  function runSearch(term: string) {
    const clean = term.trim();
    if (!clean || clean === searchQuery) return;
    trackEvent('search', { search_term: clean });
    onSearch(clean);
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    if (window.matchMedia('(max-width: 639px)').matches) {
      e.currentTarget.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      return;
    }
    runSearch(q);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[--border] bg-[color:color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:h-16 lg:flex-row lg:items-center lg:gap-4 lg:py-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Ir al inicio de Juegospedia"
            onClick={onHome}
            className="inline-flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-1 font-display text-xl font-extrabold tracking-[-0.03em] text-[--tx]
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--brand-tile)] text-[var(--brand-mark)] shadow-sm">
              <BrandMark className="h-5 w-5" />
            </span>
            <span className="max-w-[11rem] truncate">Juegos<span className="text-[var(--brand-word)]">pedia</span></span>
          </button>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <CartButton count={count} onClick={onCartOpen} compact />
            <MobileMenu
              theme={theme}
              onToggleTheme={onToggleTheme}
              onHome={onHome}
              onAccountClick={onAccountClick}
              onWalletClick={onWalletClick}
              onAuthClick={onAuthClick}
            />
          </div>
        </div>

        <form
          className="relative w-full min-w-0 flex-1 lg:max-w-2xl"
          onSubmit={submitSearch}
        >
          <CatalogSearchBar
            endpoint={`${API_BASE}/api/v1/products/suggestions`}
            value={q}
            onValueChange={setQ}
            onSearch={runSearch}
            // Goes straight to onSearch rather than through runSearch, which
            // drops empty terms so Enter on a blank box doesn't navigate.
            // Clearing is the opposite intent: an empty term *is* the reset, and
            // q:'' renders the full catalogue. Only offered while a search is
            // actually applied.
            onClear={searchQuery ? () => onSearch('') : undefined}
            onProduct={onProduct}
            placeholder={intl.formatMessage({ id: 'header.searchPlaceholder' })}
            globalShortcut
            submitLabel={intl.formatMessage({ id: 'header.search' })}
          />
        </form>

        <nav className="hidden shrink-0 items-center gap-1 lg:ml-auto lg:flex">
          {session && (
            <button
              onClick={onWalletClick}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[--success-border] bg-[--success-bg]
                         px-3 text-sm font-semibold text-[--success] transition-colors hover:brightness-105"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {walletSummary ? formatMoney(walletTotal, WALLET_CURRENCY) : 'Wallet'}
            </button>
          )}

          <a
            href={import.meta.env.VITE_SELLER_PORTAL_URL ?? 'http://localhost:4400'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[--bg-subtle] px-3 text-sm font-medium text-[--tx-muted]
                       transition-colors hover:bg-[--bg-hover] hover:text-[--tx]"
          >
            <Store className="h-4 w-4" aria-hidden="true" />
            {intl.formatMessage({ id: 'header.imASeller' })}
          </a>

          <MarketSwitcher
            markets={marketOptions}
            active={countryCode}
            onSelect={setMarketCode}
            ariaLabel={uiLocale === 'es' ? 'Cambiar de mercado' : 'Change market'}
          />

          <LocaleSwitcher
            locales={UI_LOCALES}
            active={uiLocale}
            onSelect={(l: string) => setUiLocale(l as 'es' | 'en')}
            ariaLabel={uiLocale === 'es' ? 'Idioma' : 'Language'}
          />

          <HeaderIconButton label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </HeaderIconButton>

          {!isLoading && (
            session ? (
              <button
                onClick={onAccountClick}
                className="flex h-9 items-center gap-2 rounded-lg bg-[--bg-subtle] px-2 transition-colors hover:bg-[--bg-hover]"
              >
                <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-[--primary]
                                text-xs font-bold text-[--primary-foreground]">
                  {(session.customer.name?.[0] ?? session.customer.email[0]).toUpperCase()}
                </div>
                <span className="max-w-[8rem] truncate text-sm font-medium text-[--tx]">
                  {session.customer.name?.split(' ')[0] ?? intl.formatMessage({ id: 'header.myAccount' })}
                </span>
              </button>
            ) : (
              <Button variant="outline" size="sm" onClick={onAuthClick}>
                <User className="h-4 w-4" aria-hidden="true" />
                {intl.formatMessage({ id: 'header.login' })}
              </Button>
            )
          )}

          <CartButton count={count} onClick={onCartOpen} />
        </nav>
      </div>
    </header>
  );
}

// Mobile navigation drawer — the phone counterpart to the desktop header nav.
// Trigger stays inline; the panel is portalled to <body> so the header's
// backdrop-blur can't become the containing block for the fixed overlay.
// Focus-trapped, scroll-locked, closes on scrim/Escape.
function MobileMenu({
  theme, onToggleTheme, onHome, onAccountClick, onWalletClick, onAuthClick,
}: {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onHome: () => void;
  onAccountClick: () => void;
  onWalletClick: () => void;
  onAuthClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { session, logout } = useCustomer();
  const { data: walletSummary } = useWallet(session?.customer.id);
  const { uiLocale, setUiLocale, markets, countryCode, setMarketCode } = useMarket();
  const marketOptions = markets.map((m) => ({
    code: m.countryCode,
    name: m.countryName,
    currency: m.currencyCode,
  }));
  const intl = useIntl();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const walletTotal = walletSummary
    ? walletSummary.platformCreditsMinor + walletSummary.storeCredits.reduce((sum, item) => sum + item.balanceMinor, 0)
    : 0;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 0);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (f.length === 0) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
      triggerRef.current?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);
  const run = (fn: () => void) => { setOpen(false); fn(); };

  const rowCls = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[--bg-hover]';
  const iconWrap = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[--bg-subtle] text-[--tx-muted]';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={intl.formatMessage({ id: 'header.menu' })}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx-muted] transition-colors hover:bg-[--bg-hover] hover:text-[--tx]"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-stone-950/60 backdrop-blur-md" aria-hidden="true" onClick={close} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={intl.formatMessage({ id: 'header.menu' })}
            className="animate-slide-right relative flex h-full w-[86%] max-w-sm flex-col border-l border-[--border] bg-[--bg-raised] shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[--border] px-5 py-4">
              <span className="inline-flex items-center gap-2.5 font-display text-lg font-extrabold tracking-[-0.03em] text-[--tx]">
                <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--brand-tile)] text-[var(--brand-mark)] shadow-sm">
                  <BrandMark className="h-5 w-5" />
                </span>
                Juegos<span className="text-[var(--brand-word)]">pedia</span>
              </span>
              <button
                type="button"
                data-autofocus
                aria-label={intl.formatMessage({ id: 'header.closeMenu' })}
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx-muted] transition-colors hover:bg-[--bg-hover] hover:text-[--tx]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {session ? (
                <button onClick={() => run(onAccountClick)} className={`${rowCls} border border-[--border] bg-[--bg-subtle]`}>
                  <span className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-[--primary] text-sm font-bold text-[--primary-foreground]">
                    {(session.customer.name?.[0] ?? session.customer.email[0]).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[--tx]">
                      {session.customer.name ?? intl.formatMessage({ id: 'header.myAccount' })}
                    </span>
                    <span className="block truncate text-xs text-[--tx-muted]">{session.customer.email}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[--tx-faint]" aria-hidden="true" />
                </button>
              ) : (
                <Button onClick={() => run(onAuthClick)} className="w-full justify-center py-3">
                  <User className="h-4 w-4" aria-hidden="true" />
                  {intl.formatMessage({ id: 'header.login' })}
                </Button>
              )}

              <nav className="mt-1 flex flex-col gap-1">
                {session && (
                  <button onClick={() => run(onWalletClick)} className={rowCls}>
                    <span className={iconWrap}><Wallet className="h-4 w-4" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[--tx]">{intl.formatMessage({ id: 'header.wallet' })}</span>
                      {walletSummary && <span className="block text-xs text-[--tx-muted]">{formatMoney(walletTotal, WALLET_CURRENCY)}</span>}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[--tx-faint]" aria-hidden="true" />
                  </button>
                )}

                <a
                  href={import.meta.env.VITE_SELLER_PORTAL_URL ?? 'http://localhost:4400'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                  className={rowCls}
                >
                  <span className={iconWrap}><Store className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="flex-1 text-sm font-semibold text-[--tx]">{intl.formatMessage({ id: 'header.imASeller' })}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[--tx-faint]" aria-hidden="true" />
                </a>
              </nav>
            </div>

            <div className="flex flex-col gap-3 border-t border-[--border] p-4">
              {session && (
                <button onClick={() => run(() => { void logout().then(onHome); })} className={`${rowCls} text-[--tx-muted]`}>
                  <span className={iconWrap}><LogOut className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="flex-1 text-sm font-medium">{intl.formatMessage({ id: 'header.logout' })}</span>
                </button>
              )}
              {/* Market first: it decides the currency every price on the page is
                  quoted in, so it is the setting most worth reaching on a phone. */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[--border] bg-[--bg-subtle] p-2.5">
                <span className="pl-1 text-xs font-medium uppercase tracking-wide text-[--tx-faint]">
                  {uiLocale === 'es' ? 'Mercado' : 'Market'}
                </span>
                <MarketSwitcher
                  markets={marketOptions}
                  active={countryCode}
                  onSelect={setMarketCode}
                  ariaLabel={uiLocale === 'es' ? 'Cambiar de mercado' : 'Change market'}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[--border] bg-[--bg-subtle] p-2.5">
                <span className="pl-1 text-xs font-medium uppercase tracking-wide text-[--tx-faint]">{intl.formatMessage({ id: 'header.settings' })}</span>
                <div className="flex items-center gap-2">
                  <LocaleSwitcher
                    locales={UI_LOCALES}
                    active={uiLocale}
                    onSelect={(l: string) => setUiLocale(l as 'es' | 'en')}
                    ariaLabel={uiLocale === 'es' ? 'Idioma' : 'Language'}
                  />
                  <button
                    type="button"
                    aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                    onClick={onToggleTheme}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[--border] bg-[--bg-raised] text-[--tx-muted] transition-colors hover:text-[--tx]"
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function HeaderIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx-muted]
                 transition-colors hover:bg-[--bg-hover] hover:text-[--tx]"
    >
      {children}
    </button>
  );
}

function CartButton({ count, onClick, compact = false }: { count: number; onClick: () => void; compact?: boolean }) {
  return (
    <button
      aria-label="Abrir carrito"
      title="Carrito"
      onClick={onClick}
      className={`relative inline-flex h-9 items-center justify-center rounded-lg bg-[--bg-subtle] text-[--tx] transition-colors hover:bg-[--bg-hover]
        ${compact ? 'w-9' : 'gap-2 px-3 font-medium'}`}
    >
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      {!compact && <span className="text-sm">Carrito</span>}
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full
                         bg-[--primary] px-0.5 text-[10px] font-bold text-[--primary-foreground]">
          {count}
        </span>
      )}
    </button>
  );
}
