/**
 * Idempotent SellerMarket backfill, derived from the offers sellers actually publish.
 *
 * Market eligibility currently infers a market from the currency an offer is
 * quoted in. That is a proxy, and the honest replacement is the seller declaring
 * which markets they sell into. Nobody has declared anything yet, so this
 * reconstructs the declaration from evidence: a seller pricing in MXN is selling
 * into Mexico.
 *
 * Defaults are the MINIMUM implied by selling into a market, never an invented
 * international claim: a seller trading in Mexico necessarily delivers within
 * Mexico, so `shippingCountries` seeds to that one country and `languageCodes`
 * to the market's own locales. Anything wider — shipping abroad — is a claim
 * only the seller can make, and they edit it in the seller portal.
 *
 * Existing non-empty values are never overwritten: a seller who has already told
 * us where they ship outranks any default we would compute.
 *
 * Run after Prisma migrations:
 *   pnpm tsx apps/api/scripts/backfill-seller-markets.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Currency -> country. Sound only where a currency maps to exactly one country
 * we trade in; EUR would need real seller input rather than a guess, so it is
 * absent rather than wrong.
 */
const CURRENCY_COUNTRY: Readonly<Record<string, string>> = {
  MXN: 'MX',
  ARS: 'AR',
};

async function main() {
  const listings = await prisma.listing.findMany({
    where: { active: true },
    select: { sellerId: true, currency: true },
    distinct: ['sellerId', 'currency'],
  });

  const countries = await prisma.country.findMany({ select: { id: true, code: true } });
  const countryByCode = new Map(countries.map((c) => [c.code, c.id]));

  const commerceMarkets = await prisma.commerceMarket.findMany({
    select: { id: true, countryCode: true, locales: { select: { localeCode: true } } },
  });
  const marketByCountry = new Map(commerceMarkets.map((m) => [m.countryCode, m]));

  const sellers = await prisma.seller.findMany({ select: { id: true, country: true } });
  const sellerCountry = new Map(sellers.map((seller) => [seller.id, seller.country]));

  let created = 0;
  let linked = 0;
  const skipped: string[] = [];

  for (const listing of listings) {
    const currency = listing.currency.toUpperCase();
    const countryCode = CURRENCY_COUNTRY[currency];
    if (!countryCode) {
      skipped.push(`${listing.sellerId}:${currency}`);
      continue;
    }
    const countryId = countryByCode.get(countryCode);
    if (!countryId) {
      skipped.push(`${listing.sellerId}:${countryCode}(country unseeded)`);
      continue;
    }

    // A public market may not exist for every country a seller trades in — AR
    // has supply but is not launched. The SellerMarket is still recorded, just
    // unlinked, so launching AR later is a link rather than a discovery job.
    const market = marketByCountry.get(countryCode) ?? null;
    const commerceMarketId = market?.id ?? null;
    const languageCodes = market?.locales.map((locale) => locale.localeCode) ?? [];

    const existing = await prisma.sellerMarket.findFirst({
      where: { sellerId: listing.sellerId, countryId, settlementCurrencyCode: currency },
      select: {
        id: true,
        commerceMarketId: true,
        languageCodes: true,
        shippingCountries: true,
        shipsFromCountryCode: true,
      },
    });

    if (existing) {
      // Fill only what is genuinely blank — a seller's own answer always wins.
      const patch: Record<string, unknown> = {};
      if (commerceMarketId && existing.commerceMarketId !== commerceMarketId) {
        patch.commerceMarketId = commerceMarketId;
      }
      if (existing.languageCodes.length === 0 && languageCodes.length > 0) {
        patch.languageCodes = languageCodes;
      }
      if (existing.shippingCountries.length === 0) patch.shippingCountries = [countryCode];
      if (!existing.shipsFromCountryCode) {
        patch.shipsFromCountryCode = sellerCountry.get(listing.sellerId) ?? countryCode;
      }
      if (Object.keys(patch).length > 0) {
        await prisma.sellerMarket.update({ where: { id: existing.id }, data: patch });
        linked++;
      }
      continue;
    }

    await prisma.sellerMarket.create({
      data: {
        sellerId: listing.sellerId,
        countryId,
        settlementCurrencyCode: currency,
        languageCodes,
        shippingCountries: [countryCode],
        shipsFromCountryCode: sellerCountry.get(listing.sellerId) ?? countryCode,
        commerceMarketId,
        active: true,
      },
    });
    created++;
  }

  const total = await prisma.sellerMarket.count();
  const withMarket = await prisma.sellerMarket.count({ where: { commerceMarketId: { not: null } } });
  console.log(JSON.stringify({ created, linked, total, withMarket, skipped }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
