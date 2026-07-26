import { withMarket } from '../lib/api-client.js';
import { useQuery } from '@tanstack/react-query';
import { useIntl } from 'react-intl';
import { ProductCard, type Product } from './ProductCard.js';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function fetchSimilar(slug: string): Promise<Product[]> {
  const res = await fetch(`${API}/api/v1/products/${slug}/similar?${withMarket(new URLSearchParams())}`);
  if (!res.ok) return [];
  return res.json() as Promise<Product[]>;
}

/** Same-category recommendations rail — horizontal scroll on mobile, grid from lg: up. Reuses ProductCard as-is, no new card needed. */
export function SimilarProducts({ slug, onSelect }: { slug: string; onSelect: (slug: string) => void }) {
  const intl = useIntl();
  const { data } = useQuery({
    queryKey: ['similar-products', slug],
    queryFn: () => fetchSimilar(slug),
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-10 border-t border-[--border] pt-6">
      <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-[--tx]">
        {intl.formatMessage({ id: 'product.similarProducts' })}
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {data.map((product) => (
          <div key={product.id} className="w-[220px] shrink-0 lg:w-auto">
            <ProductCard product={product} onClick={() => onSelect(product.slug)} />
          </div>
        ))}
      </div>
    </section>
  );
}
