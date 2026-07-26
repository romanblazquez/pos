import type { Locale } from '@/lib/segments';
import type { AvailabilityState } from '@/lib/availability';

interface Props {
  state: AvailabilityState;
  /** Offers that exist outside this market — counts and currencies only. */
  foreign?: { currencies: string[]; offerCount: number };
  /** Human market name, e.g. "México". */
  marketName: string;
  /** Product name, so the catalogue-only copy can name what it is talking about. */
  productName: string;
  locale: Locale;
}

const CURRENCY_COUNTRY: Readonly<Record<string, { es: string; en: string }>> = {
  ARS: { es: 'Argentina', en: 'Argentina' },
  MXN: { es: 'México', en: 'Mexico' },
  USD: { es: 'Estados Unidos', en: 'the United States' },
  EUR: { es: 'Europa', en: 'Europe' },
};

function places(currencies: string[], locale: Locale): string {
  const names = currencies.map((c) => CURRENCY_COUNTRY[c]?.[locale] ?? c);
  if (names.length <= 1) return names[0] ?? '';
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(', ')} ${locale === 'es' ? 'y' : 'and'} ${last}`;
}

/**
 * The honest answer to "can I buy this here?" whenever the answer is no.
 *
 * One component for both negative states, because they differ only in what we
 * know, not in what the shopper needs: a plain statement, what we can do next,
 * and why no price is shown. Rendering nothing — which is what a catalogue-only
 * product used to do — is the one option that isn't allowed. It leaves a page
 * full of specifications with no indication that the game isn't for sale, which
 * reads as a broken store rather than an encyclopedia entry.
 */
export function AvailabilityNotice({ state, foreign, marketName, productName, locale }: Props) {
  if (state === 'available') return null;

  const es = locale === 'es';
  const foreignCount = foreign?.offerCount ?? 0;
  const showForeign = state === 'no_local_offer' && foreignCount > 0;
  const where = showForeign ? places(foreign?.currencies ?? [], locale) : '';
  const one = foreignCount === 1;

  return (
    <section className="availability-notice" aria-labelledby="availability-notice-title">
      <h2 id="availability-notice-title" className="availability-notice-title">
        {showForeign
          ? es
            ? `No encontramos una oferta disponible en ${marketName}.`
            : `We couldn't find an offer available in ${marketName}.`
          : es
            ? `Todavía ninguna tienda verificada vende ${productName}.`
            : `No verified store sells ${productName} yet.`}
      </h2>

      <p className="availability-notice-lede">
        {showForeign ? (
          <>
            {es
              ? `Sí lo encontramos con ${foreignCount} ${one ? 'vendedor' : 'vendedores'}${where ? ` en ${where}` : ' en otros países'}. `
              : `We did find it with ${foreignCount} ${one ? 'seller' : 'sellers'}${where ? ` in ${where}` : ' in other countries'}. `}
            <strong>
              {es
                ? `Estar disponible en otro país no significa que el envío a ${marketName} esté confirmado.`
                : `Being available in another country does not mean shipping to ${marketName} is confirmed.`}
            </strong>
          </>
        ) : (
          // Said plainly and without spin. The catalogue is far larger than the
          // supply, and a shopper is better served by a clear "not for sale"
          // than by a page that leaves them hunting for a buy button.
          <>
            {es
              ? 'Esta ficha es informativa: reunimos datos, fotos y nuestra opinión editorial, pero '
              : 'This entry is informational: we gather data, photos and our editorial take, but '}
            <strong>
              {es
                ? `hoy no hay ninguna oferta que comparar en ${marketName}.`
                : `there is no offer to compare in ${marketName} today.`}
            </strong>
          </>
        )}
      </p>

      <ul className="availability-notice-list">
        {showForeign && (
          <li>
            {es
              ? 'Podemos verificar si algún vendedor internacional envía a tu país, con el costo total.'
              : 'We can check whether an international seller ships to you, with the full landed cost.'}
          </li>
        )}
        <li>
          {es
            ? 'Podemos preguntar a vendedores locales si pueden conseguirlo por pedido especial.'
            : 'We can ask local sellers whether they can source it on special order.'}
        </li>
        <li>
          {es
            ? 'Te avisamos en cuanto aparezca una oferta local.'
            : "We'll tell you as soon as a local offer appears."}
        </li>
      </ul>

      <p className="availability-notice-note">
        {showForeign
          ? es
            ? 'Aún no mostramos precios de otros países: convertirlos sin confirmar envío, impuestos y aduana daría una cifra que no podemos sostener.'
            : 'We do not show prices from other countries yet: converting them without confirmed shipping, tax and customs would produce a figure we cannot stand behind.'
          : es
            ? 'No mostramos un precio estimado ni el de otra tienda: un precio que nadie te puede cobrar no es un precio.'
            : 'We show neither an estimate nor another store’s price: a price nobody can actually charge you is not a price.'}
      </p>
    </section>
  );
}
