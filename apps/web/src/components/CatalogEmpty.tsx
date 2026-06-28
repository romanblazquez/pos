import Link from 'next/link';
import { SearchX } from 'lucide-react';
import type { Locale } from '@/lib/segments';

export function CatalogEmpty({ locale, clearHref }: { locale: Locale; clearHref: string }) {
  return (
    <div className="catalog-empty">
      <span className="catalog-empty-icon"><SearchX size={24} aria-hidden="true" /></span>
      <h2>{locale === 'es' ? 'Ningún juego coincide' : 'No games match'}</h2>
      <p>
        {locale === 'es'
          ? 'Prueba con una categoría distinta o amplía el rango de precio.'
          : 'Try another category or widen the price range.'}
      </p>
      <Link href={clearHref}>{locale === 'es' ? 'Limpiar filtros' : 'Clear filters'}</Link>
    </div>
  );
}
