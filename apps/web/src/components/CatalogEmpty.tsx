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
      {/* Native <a> for a full-document load: this sits inside the filter GET
          form, and a soft nav would leave the uncontrolled chip inputs checked.
          See the Clear control in SearchFilters. */}
      <a href={clearHref}>{locale === 'es' ? 'Limpiar filtros' : 'Clear filters'}</a>
    </div>
  );
}
