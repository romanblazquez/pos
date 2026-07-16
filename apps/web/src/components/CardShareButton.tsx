'use client';

import { useRef, useState } from 'react';

/** A single, card-safe share action: native share where available, copy otherwise. */
export function CardShareButton({
  url,
  title,
  locale,
}: {
  url: string;
  title: string;
  locale: 'es' | 'en';
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  const label = locale === 'es' ? `Compartir ${title}` : `Share ${title}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // The browser blocked both available sharing paths.
    }
  }

  return (
    <button
      type="button"
      className="card-share-button"
      onClick={share}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="m5 12 4 4L19 6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
        </svg>
      )}
      <span className="card-share-status" aria-live="polite">
        {copied ? (locale === 'es' ? 'Enlace copiado' : 'Link copied') : ''}
      </span>
    </button>
  );
}
