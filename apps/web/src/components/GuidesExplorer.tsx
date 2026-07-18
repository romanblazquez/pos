'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CardShareButton } from './CardShareButton';

export interface GuideCardData {
  slug: string;
  href: string;
  shareUrl: string;
  title: string;
  excerpt: string;
  author?: { name: string; from: string };
  dateISO: string;
  dateLabel: string;
  cover?: string;
  kicker?: string;
  token?: string;
  tokenTone?: 'clay' | 'forest' | 'ochre' | 'ink' | 'parchment';
  autoTranslated?: boolean;
}

const PAGE_SIZE = 9;

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function GuidesExplorer({
  guides,
  locale,
}: {
  guides: GuideCardData[];
  locale: 'es' | 'en';
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const t = {
    search: locale === 'es' ? 'Buscar guías…' : 'Search guides…',
    searchLabel: locale === 'es' ? 'Buscar guías' : 'Search guides',
    results: (n: number) =>
      locale === 'es'
        ? `${n} ${n === 1 ? 'guía' : 'guías'}`
        : `${n} ${n === 1 ? 'guide' : 'guides'}`,
    empty:
      locale === 'es'
        ? 'No encontramos guías para tu búsqueda.'
        : 'No guides matched your search.',
    clear: locale === 'es' ? 'Limpiar' : 'Clear',
    by: locale === 'es' ? 'Por' : 'By',
    prev: locale === 'es' ? 'Anterior' : 'Previous',
    next: locale === 'es' ? 'Siguiente' : 'Next',
    auto: locale === 'es' ? 'Traducción automática' : 'Auto-translated',
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guides;
    return guides.filter((g) =>
      [g.title, g.excerpt, g.kicker ?? '', g.author?.name ?? '', g.author?.from ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [guides, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="guides-hub">
      <div className="guides-search">
        <svg className="guides-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          className="guides-search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t.search}
          aria-label={t.searchLabel}
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="guides-search-clear" onClick={() => { setQuery(''); setPage(1); }}>
            {t.clear}
          </button>
        )}
      </div>

      <p className="muted" aria-live="polite" style={{ margin: '0 0 1rem' }}>{t.results(filtered.length)}</p>

      {visible.length > 0 ? (
        <div className="guides-grid">
          {visible.map((g) => (
            <article key={g.slug} className="guide-hit">
              <CardShareButton url={g.shareUrl} title={g.title} locale={locale} />
              <Link href={g.href} className="guide-hit-cover" aria-hidden="true" tabIndex={-1}>
                {g.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.cover} alt="" loading="lazy" width={400} height={225} />
                ) : (
                  <span className="guide-hit-glyph" aria-hidden="true">🎲</span>
                )}
                {g.kicker && <span className="guide-hit-kicker">{g.kicker}</span>}
                <span className="guide-hit-token" data-tone={g.tokenTone ?? 'clay'} aria-hidden="true">
                  <span className="guide-hit-token-ring" />
                  <span className="guide-hit-token-mark">{g.token ?? '⬡'}</span>
                </span>
              </Link>
              <div className="guide-hit-body">
                <h2 className="guide-hit-title">
                  <Link href={g.href}>{g.title}</Link>
                </h2>
                <p className="guide-hit-excerpt">{g.excerpt}</p>
                <div className="guide-hit-meta">
                  {g.author && (
                    <span className="guide-hit-author">
                      <span className="guide-hit-avatar" aria-hidden="true">{initials(g.author.name)}</span>
                      <span>
                        {t.by} <b>{g.author.name}</b>
                        <span className="muted"> · {g.author.from}</span>
                      </span>
                    </span>
                  )}
                  <time className="muted guide-hit-date" dateTime={g.dateISO}>
                    {g.dateLabel}
                    {g.autoTranslated && <span className="guide-hit-auto">{t.auto}</span>}
                  </time>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="lede">{t.empty}</p>
      )}

      {pageCount > 1 && (
        <nav className="guides-pager" aria-label={locale === 'es' ? 'Paginación' : 'Pagination'}>
          <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)}>{t.prev}</button>
          <span className="muted">{current} / {pageCount}</span>
          <button type="button" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>{t.next}</button>
        </nav>
      )}
    </div>
  );
}
