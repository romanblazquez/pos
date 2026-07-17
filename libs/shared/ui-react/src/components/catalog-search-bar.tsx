'use client';

import * as React from 'react';
import { cn } from '../lib/utils.js';
import { CatalogSearch, type CatalogSearchProps } from './catalog-search.js';

export interface CatalogSearchBarProps extends CatalogSearchProps {
  /** Accessible name for the submit button; also its visible text on >=640px. */
  submitLabel: string;
  /** Slot after the submit button — the filter trigger goes here. */
  trailing?: React.ReactNode;
  /** Class for the row wrapper (width/max-width live here, not on the input). */
  barClassName?: string;
}

/**
 * The catalogue search bar: input + submit + an optional trailing control.
 *
 * `CatalogSearch` is only the input, so every caller composed its own submit
 * button — and the SEO app composed none at all, which is why the same shared
 * input rendered a lens button on the SPA and nothing on the SEO site. Owning
 * the row here is what actually makes the bar consistent across both domains.
 *
 * The submit button is a real `type="submit"`, which matters beyond looks: the
 * SEO app's search is a no-JS GET <form> (the input carries `name="q"`), so
 * without a button, submitting required pressing Enter.
 */
export function CatalogSearchBar({ submitLabel, trailing, barClassName, ...search }: CatalogSearchBarProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', barClassName)}>
      <CatalogSearch {...search} />
      <button
        type="submit"
        aria-label={submitLabel}
        className="inline-flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl bg-(--primary) px-3.5
                   text-[15px] font-semibold text-(--primary-foreground) transition-colors
                   hover:bg-[color-mix(in_srgb,var(--primary)_88%,#000)] sm:px-4"
      >
        <SearchIcon />
        <span className="hidden sm:inline">{submitLabel}</span>
      </button>
      {trailing}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
