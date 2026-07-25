import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { Button } from '@retail-os/ui-react';
import { trackEvent } from '../analytics.js';

export function ProductShareButton({
  slug,
  name,
  locale,
}: {
  slug: string;
  name: string;
  locale: 'es' | 'en';
}) {
  const [copied, setCopied] = useState(false);
  const url = `https://juegospedia.com/${locale}/${locale === 'es' ? 'juegos-de-mesa' : 'board-games'}/${slug}`;
  const text = locale === 'es'
    ? `${name}: compara precios y disponibilidad en Juegospedia`
    : `${name}: compare prices and availability on Juegospedia`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text, url });
        trackEvent('share', { entityType: 'game', entityId: slug, method: 'native' });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent('share', { entityType: 'game', entityId: slug, method: 'clipboard' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Sharing is an enhancement and must never interrupt product actions.
    }
  }

  return (
    <Button type="button" variant="outline" onClick={share} aria-live="polite">
      {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
      {copied
        ? (locale === 'es' ? 'Enlace copiado' : 'Link copied')
        : (locale === 'es' ? 'Compartir ficha' : 'Share game')}
    </Button>
  );
}
