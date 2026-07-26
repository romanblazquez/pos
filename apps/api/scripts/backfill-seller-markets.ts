/**
 * Idempotent SellerMarket backfill, derived from the offers sellers actually publish.
 *
 * Market eligibility currently infers a market from the currency an offer is
 * quoted in. That is a proxy, and the honest replacement is the seller declaring
 * which markets they sell into. Nobody has declared anything yet, so this
 * reconstructs the declaration from evidence: a seller pricing in MXN is selling
 * into Mexico.
 *
 * Deliberately does NOT invent shipping destinations. `shippingCountries` stays
 * whatever the seller set, because "sells into" and "ships to" are different
 * claims and only the seller can make the second one.
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
    select: { id: true, countryCode: true },
  });
  const marketByCountry = new Map(commerceMarkets.map((m) => [m.countryCode, m.id]));

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
    const commerceMarketId = marketByCountry.get(countryCode) ?? null;

    const existing = await prisma.sellerMarket.findFirst({
      where: { sellerId: listing.sellerId, countryId, settlementCurrencyCode: currency },
      select: { id: true, commerceMarketId: true },
    });

    if (existing) {
      if (commerceMarketId && existing.commerceMarketId !== commerceMarketId) {
        await prisma.sellerMarket.update({
          where: { id: existing.id },
          data: { commerceMarketId },
        });
        linked++;
      }
      continue;
    }

    await prisma.sellerMarket.create({
      data: {
        sellerId: listing.sellerId,
        countryId,
        settlementCurrencyCode: currency,
        languageCodes: [],
        shippingCountries: [],
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
