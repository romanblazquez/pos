'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogSearchBar } from '@retail-os/ui-react';
import type { Locale } from '@/lib/segments';

export function CatalogSearchField({
  locale,
  initialValue = '',
  searchPath,
  productBase,
  className,
  inputClassName,
  placeholder,
  trailing,
}: {
  locale: Locale;
  initialValue?: string;
  searchPath: string;
  productBase: string;
  className?: string;
  inputClassName?: string;
  placeholder: string;
  trailing?: ReactNode;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  // A new query starts a fresh search, so it must not inherit the current
  // facet filters. The filter rail is a no-JS GET form of uncontrolled inputs
  // (defaultChecked), so a soft router.push to the clean ?q= URL leaves those
  // checked inputs stale — the filters would look cleared yet ride along on the
  // next submit. A full-document load to just ?q= remounts the rail with empty
  // defaults, which is what actually clears the filters for the new query.
  const runSearch = (term: string) => {
    const q = term.trim();
    window.location.assign(q ? `${searchPath}?q=${encodeURIComponent(q)}` : searchPath);
  };

  return (
    <CatalogSearchBar
      endpoint="/api/search-suggestions"
      value={value}
      onValueChange={setValue}
      onSearch={runSearch}
      // Clearing the box has to put the unfiltered listing back, or the field
      // reads empty while the page still shows results for the old term. Guarded
      // on initialValue: that is only set where a query is actually applied, so
      // clearing the home hero stays a local edit instead of a navigation.
      onClear={initialValue.trim() ? () => runSearch('') : undefined}
      onProduct={(slug) => router.push(`${productBase}/${slug}`)}
      locale={locale}
      placeholder={placeholder}
      inputName="q"
      globalShortcut
      className={inputClassName}
      barClassName={className}
      submitLabel={locale === 'es' ? 'Buscar' : 'Search'}
      trailing={trailing}
    />
  );
}
