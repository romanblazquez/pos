'use client';

import { useState } from 'react';

export interface ShareBarProps {
  /**
   * The URL to share. Must be the CANONICAL url, never the address the visitor
   * happens to be on: shares from the app host would otherwise accumulate on a
   * duplicate that carries no ranking and shows no rich card.
   */
  url: string;
  title: string;
  /** Optional summary — some networks seed the composer with it. */
  text?: string;
  /**
   * Absolute URL of the page's social card.
   *
   * Every other network scrapes the page for `og:image`. Pinterest does not
   * reliably do that from its bookmarklet endpoint — it wants the image handed
   * to it as `media`, and without it a pin is created with no picture, on a
   * network where the picture is the entire unit of content.
   */
  image?: string;
  locale: 'es' | 'en';
  className?: string;
}

/** Trim to a whole word — a description cut mid-word reads as a bug. */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:—-]+$/, '')}…`;
}

const COPY = {
  es: { label: 'Compartir:', copy: 'Copiar enlace', copied: '¡Copiado!', more: 'Más opciones' },
  en: { label: 'Share:', copy: 'Copy link', copied: 'Copied!', more: 'More options' },
} as const;

/**
 * Social share row.
 *
 * The buttons only open each network's composer. What actually renders the rich
 * card is the canonical URL plus the OG/Twitter tags on the page behind it — so
 * a share button on a page without those produces a bare link, and the fix is
 * always the metadata, never the button.
 *
 * Network set is deliberately not "every network": each one here either drives
 * real board-game traffic (Reddit, Pinterest) or is how people actually pass
 * links to each other in Mexico and Argentina (WhatsApp, Telegram). Adding
 * networks nobody uses costs a row of dead icons and a wider tap target hunt.
 */
export function ShareBar({ url, title, text, image, locale, className }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const t = COPY[locale];

  const enc = encodeURIComponent;
  const u = enc(url);
  const titleEnc = enc(title);
  // Pinterest renders the description under the pin, so a 300-character product
  // blurb is a wall of text on a card that is mostly picture. One clause is the
  // format that reads.
  const summary = enc(text ? `${title} — ${clip(text, 180)}` : title);
  const media = image ? `&media=${enc(image)}` : '';

  const targets: Array<{ key: string; label: string; href: string; path: string }> = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      // wa.me, not api.whatsapp.com: the former is the universal link, so it
      // opens the installed app on a phone instead of bouncing through
      // WhatsApp Web. The URL goes last — WhatsApp previews the final link in a
      // message, and a title trailing it suppresses the card on some clients.
      href: `https://wa.me/?text=${titleEnc}%20${u}`,
      path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.695.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
    },
    {
      key: 'telegram',
      label: 'Telegram',
      href: `https://t.me/share/url?url=${u}&text=${titleEnc}`,
      path: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
    },
    {
      key: 'x',
      label: 'X',
      href: `https://twitter.com/intent/tweet?url=${u}&text=${titleEnc}`,
      path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    },
    {
      key: 'facebook',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
    },
    {
      key: 'reddit',
      label: 'Reddit',
      href: `https://www.reddit.com/submit?url=${u}&title=${titleEnc}`,
      path: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286A.72.72 0 0 0 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199a1.999 1.999 0 1 1-1.947 2.46v.002a2.37 2.37 0 0 0-2.032 2.341v.007c1.334.024 2.554.396 3.53 1.003a2.44 2.44 0 1 1 2.68 4.007v.02c0 2.75-3.222 4.98-7.196 4.98s-7.196-2.23-7.196-4.98v-.02a2.44 2.44 0 1 1 2.68-4.007c.976-.607 2.196-.98 3.53-1.003v-.007a3.75 3.75 0 0 1 3.4-3.72 2 2 0 0 1 1.55-1.083Zm-6.846 8.469a1.208 1.208 0 1 0 0 2.416 1.208 1.208 0 0 0 0-2.416Zm4.916 0a1.208 1.208 0 1 0 0 2.416 1.208 1.208 0 0 0 0-2.416Zm-4.741 4.669a.4.4 0 0 0-.282.68c.83.83 2.229.895 2.552.895h.014c.323 0 1.722-.065 2.552-.895a.4.4 0 1 0-.565-.567c-.523.522-1.646.639-1.987.639h-.014c-.341 0-1.464-.117-1.987-.64a.4.4 0 0 0-.283-.112Z',
    },
    {
      key: 'pinterest',
      label: 'Pinterest',
      href: `https://pinterest.com/pin/create/button/?url=${u}${media}&description=${summary}`,
      path: 'M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z',
    },
  ];

  async function nativeOrCopy() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className={className ?? 'share-bar'}>
      <span className="share-bar-label">{t.label}</span>
      {targets.map((target) => (
        <a
          key={target.key}
          className="share-btn"
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={target.label}
          title={target.label}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={target.path} />
          </svg>
        </a>
      ))}
      <button type="button" className="share-btn" onClick={nativeOrCopy} aria-label={t.copy} title={t.copy}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
      {copied && <span className="share-copied" role="status">{t.copied}</span>}
    </div>
  );
}
