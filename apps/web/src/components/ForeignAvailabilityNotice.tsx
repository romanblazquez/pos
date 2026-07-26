import type { Locale } from '@/lib/segments';

interface Props {
  /** Offers that exist outside this market — counts and currencies only. */
  foreign: { currencies: string[]; offerCount: number };
  /** Human market name, e.g. "México". */
  marketName: string;
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
 * Shown when a market has no offers but the product is stocked elsewhere.
 *
 * Filtering offers by market is correct, but an empty page is a dead end. This
 * says what we actually know — that N sellers abroad list this game — without
 * implying we know they will ship here. We do not: sellers declare no shipping
 * destinations yet, so the copy promises verification, never delivery. Prices
 * are deliberately absent; an amount in another currency is not an offer to this
 * shopper and would read like one.
 */
export function ForeignAvailabilityNotice({ foreign, marketName, locale }: Props) {
  if (foreign.offerCount < 1) return null;

  const where = places(foreign.currencies, locale);
  const plural = foreign.offerCount === 1;

  return (
    <section className="foreign-availability" aria-labelledby="foreign-availability-title">
      <h2 id="foreign-availability-title" className="foreign-availability-title">
        {locale === 'es'
          ? `No encontramos una oferta disponible en ${marketName}.`
          : `We couldn't find an offer available in ${marketName}.`}
      </h2>
      <p className="foreign-availability-lede">
        {locale === 'es'
          ? `Sí lo encontramos con ${foreign.offerCount} ${plural ? 'vendedor' : 'vendedores'}${where ? ` en ${where}` : ' en otros países'}. `
          : `We did find it with ${foreign.offerCount} ${plural ? 'seller' : 'sellers'}${where ? ` in ${where}` : ' in other countries'}. `}
        <strong>
          {locale === 'es'
            ? 'Estar disponible en otro país no significa que el envío a México esté confirmado.'
            : `Being available in another country does not mean shipping to ${marketName} is confirmed.`}
        </strong>
      </p>
      <ul className="foreign-availability-list">
        <li>
          {locale === 'es'
            ? 'Podemos preguntar a vendedores locales si pueden conseguirlo por pedido especial.'
            : 'We can ask local sellers whether they can source it on special order.'}
        </li>
        <li>
          {locale === 'es'
            ? 'Podemos verificar si algún vendedor internacional envía a tu país, con el costo total.'
            : 'We can check whether an international seller ships to you, with the full landed cost.'}
        </li>
        <li>
          {locale === 'es'
            ? 'Te avisamos en cuanto aparezca una oferta local.'
            : "We'll tell you as soon as a local offer appears."}
        </li>
      </ul>
      <p className="foreign-availability-note">
        {locale === 'es'
          ? 'Aún no mostramos precios de otros países: convertirlos sin confirmar envío, impuestos y aduana daría una cifra que no podemos sostener.'
          : 'We do not show prices from other countries yet: converting them without confirmed shipping, tax and customs would produce a figure we cannot stand behind.'}
      </p>
    </section>
  );
}
