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

  return (
    <CatalogSearchBar
      endpoint="/api/search-suggestions"
      value={value}
      onValueChange={setValue}
      onSearch={(term) => router.push(`${searchPath}?q=${encodeURIComponent(term)}`)}
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
