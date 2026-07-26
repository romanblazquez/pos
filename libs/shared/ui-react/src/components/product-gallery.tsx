'use client';

import { useState } from 'react';

export interface ProductGalleryProps {
  images: string[];
  /** Product name — the alt text for the main image. */
  name: string;
  /** Rendered under the gallery, e.g. the share row. */
  children?: React.ReactNode;
  locale: 'es' | 'en';
}

const COPY = {
  es: { empty: 'Sin imagen', view: 'Ver imagen' },
  en: { empty: 'No image', view: 'View image' },
} as const;

/**
 * Product image column: one large image, with thumbnails when there are more.
 *
 * Shared so the public site and the app show the same thing. The app had a
 * five-image gallery and the public site showed a single cover, which meant the
 * indexable page — the one a shopper arrives on from search — carried less than
 * the one they reach afterwards.
 *
 * Every image is rendered into the markup even when only one is visible, so the
 * alternates are discoverable rather than existing solely in click handlers.
 */
export function ProductGallery({ images, name, children, locale }: ProductGalleryProps) {
  const [selected, setSelected] = useState(0);
  const t = COPY[locale];
  const shown = images.slice(0, 6);
  const active = shown[selected] ?? shown[0];

  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        {active ? (
          <img src={active} alt={name} width={420} height={420} />
        ) : (
          <div className="product-gallery-empty" aria-label={t.empty}>
            <span aria-hidden="true">🎲</span>
          </div>
        )}
      </div>

      {shown.length > 1 && (
        <ul className="product-gallery-thumbs">
          {shown.map((image, index) => (
            <li key={image}>
              <button
                type="button"
                className={`product-gallery-thumb${index === selected ? ' is-active' : ''}`}
                aria-label={`${t.view} ${index + 1}`}
                aria-current={index === selected}
                onClick={() => setSelected(index)}
              >
                <img src={image} alt="" loading="lazy" width={56} height={56} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {children}
    </div>
  );
}
