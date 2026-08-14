'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/segments';

export interface EntityChip {
  label: string;
  href: string;
  count: number;
}

/**
 * The index of a taxonomy — publishers, mechanics, stores.
 *
 * These lists are long (995 publishers) and were rendered as one flat chip
 * wall, which is unusable: no way to find a publisher without Ctrl+F, and no
 * sense of which ones actually carry a catalogue.
 *
 * Filtering is deliberately client-side over a fully server-rendered list
 * rather than a search route. Every chip stays in the initial HTML as a real
 * <a>, so crawlers still see the whole taxonomy and the internal linking that
 * makes these hubs worth having — while a shopper gets instant narrowing with
 * no round trip. A server-side search box would have traded that away.
 */
export function EntityFilter({
  items,
  locale,
  placeholder,
  /** Chips shown before the reader asks for more. */
  initialVisible = 120,
}: {
  items: EntityChip[];
  locale: Locale;
  placeholder: string;
  initialVisible?: number;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'count' | 'alpha'>('count');
  const [expanded, setExpanded] = useState(false);

  // Accent- and case-insensitive: "mecanica" should find "Mecánica", and a
  // shopper typing "kosmos" should find "KOSMOS".
  const normalise = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const filtered = useMemo(() => {
    const q = normalise(query.trim());
    const matched = q ? items.filter((item) => normalise(item.label).includes(q)) : items;
    return sort === 'alpha'
      ? [...matched].sort((a, b) => a.label.localeCompare(b.label))
      : [...matched].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [items, query, sort]);

  // A search is an explicit request to see everything that matches, so it
  // overrides the fold — nothing is more confusing than searching and being
  // shown a truncated answer.
  const searching = query.trim().length > 0;
  const unfolded = expanded || searching;
  const shownCount = unfolded ? filtered.length : Math.min(initialVisible, filtered.length);
  const hidden = filtered.length - shownCount;

  const t = locale === 'es'
    ? { showing: 'Mostrando', of: 'de', popular: 'Más juegos', alpha: 'A–Z',
        more: (n: number) => `Ver ${n.toLocaleString('es-MX')} más`, none: 'Sin resultados para', clear: 'Limpiar' }
    : { showing: 'Showing', of: 'of', popular: 'Most games', alpha: 'A–Z',
        more: (n: number) => `Show ${n.toLocaleString('en-US')} more`, none: 'No matches for', clear: 'Clear' };

  return (
    <div className="entity-filter">
      <div className="entity-filter-bar">
        <input
          type="search"
          className="entity-filter-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <div className="entity-filter-sorts" role="group">
          <button
            type="button"
            onClick={() => setSort('count')}
            aria-pressed={sort === 'count'}
            className={sort === 'count' ? 'is-active' : undefined}
          >
            {t.popular}
          </button>
          <button
            type="button"
            onClick={() => setSort('alpha')}
            aria-pressed={sort === 'alpha'}
            className={sort === 'alpha' ? 'is-active' : undefined}
          >
            {t.alpha}
          </button>
        </div>
      </div>

      <p className="entity-filter-count muted" aria-live="polite">
        {t.showing} {shownCount.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')}{' '}
        {t.of} {items.length.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')}
      </p>

      {filtered.length === 0 ? (
        <p className="entity-filter-empty">
          {t.none} “{query}”.{' '}
          <button type="button" className="linklike" onClick={() => setQuery('')}>{t.clear}</button>
        </p>
      ) : (
        // Every chip is always in the DOM and the fold is CSS-only. Slicing the
        // array instead would have dropped 875 publisher links out of the
        // server-rendered HTML — removing the crawlable internal linking these
        // hub pages exist to provide, which is the opposite of the intent.
        <div className="taglist">
          {filtered.map((item, i) => (
            <Link
              key={item.href}
              className={i < shownCount ? 'chip' : 'chip is-folded'}
              href={item.href}
            >
              {item.label} <span className="muted">({item.count.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')})</span>
            </Link>
          ))}
        </div>
      )}

      {hidden > 0 && (
        <button type="button" className="entity-filter-more" onClick={() => setExpanded(true)}>
          {t.more(hidden)}
        </button>
      )}
    </div>
  );
}
