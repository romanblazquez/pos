'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogSearch } from '@retail-os/ui-react';
import type { Locale } from '@/lib/segments';

export function CatalogSearchField({
  locale,
  initialValue = '',
  searchPath,
  productBase,
  className,
  inputClassName,
  placeholder,
}: {
  locale: Locale;
  initialValue?: string;
  searchPath: string;
  productBase: string;
  className?: string;
  inputClassName?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  return (
    <CatalogSearch
      endpoint="/api/search-suggestions"
      value={value}
      onValueChange={setValue}
      onSearch={(term) => router.push(`${searchPath}?q=${encodeURIComponent(term)}`)}
      onProduct={(slug) => router.push(`${productBase}/${slug}`)}
      locale={locale}
      placeholder={placeholder}
      inputName="q"
      globalShortcut
      className={className}
      inputClassName={inputClassName}
    />
  );
}
