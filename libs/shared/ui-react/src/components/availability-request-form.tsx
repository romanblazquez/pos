'use client';

import { useState } from 'react';


interface Props {
  slug: string;
  /** Uppercase market code the shopper is waiting in, e.g. 'MX'. */
  market: string;
  marketName: string;
  locale: 'es' | 'en';
}

type Status = 'idle' | 'sending' | 'done' | 'error';

/**
 * Email capture behind "we'll tell you when a local offer appears".
 *
 * The notice made that promise on every product nobody sells yet, with nowhere
 * to write the request down — which made it a promise that could not be kept
 * rather than one merely outstanding. This is the smallest thing that makes it
 * keepable.
 */
export function AvailabilityRequestForm({ slug, market, marketName, locale }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [waiting, setWaiting] = useState(0);
  const es = locale === 'es';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const response = await fetch('/api/availability-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, email, market, locale }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { waiting?: number };
      setWaiting(payload.waiting ?? 0);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <p className="availability-notice-done" role="status">
        {es
          ? `Listo. Te escribimos a ${email} en cuanto haya una oferta en ${marketName}.`
          : `Done. We'll write to ${email} as soon as there's an offer in ${marketName}.`}
        {waiting > 1 && (
          <span className="availability-notice-waiting">
            {es
              ? ` Hay ${waiting} personas esperando este juego.`
              : ` ${waiting} people are waiting for this game.`}
          </span>
        )}
      </p>
    );
  }

  return (
    <form className="availability-notice-form" onSubmit={submit}>
      <label className="availability-notice-label" htmlFor="availability-email">
        {es ? 'Avísame cuando llegue' : 'Tell me when it arrives'}
      </label>
      <div className="availability-notice-row">
        <input
          id="availability-email"
          className="availability-notice-input"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={es ? 'tu@correo.com' : 'you@email.com'}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === 'sending'}
        />
        <button className="availability-notice-submit" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? (es ? 'Enviando…' : 'Sending…') : es ? 'Avisarme' : 'Notify me'}
        </button>
      </div>
      <p className="availability-notice-fineprint">
        {status === 'error'
          ? es
            ? 'No pudimos guardarlo. Inténtalo de nuevo en un momento.'
            : "We couldn't save that. Try again in a moment."
          : es
            ? 'Solo para avisarte de este juego. Sin newsletter, sin compartir tu correo.'
            : 'Only to tell you about this game. No newsletter, no sharing your address.'}
      </p>
    </form>
  );
}
