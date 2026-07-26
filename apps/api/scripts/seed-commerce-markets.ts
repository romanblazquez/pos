/**
 * Idempotent commerce-market seed.
 *
 * Seeds Mexico as the first public market with its two locales, and leaves it
 * INACTIVE and NON-INDEXABLE. Activation is an admin decision, not a side effect
 * of deploying — see docs/adr/0007-language-market-separation.md.
 *
 * Run after Prisma migrations:
 *   pnpm tsx apps/api/scripts/seed-commerce-markets.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LocaleSeed {
  languageCode: string;
  localeCode: string;
  urlPrefix: string;
  isDefault: boolean;
}

interface MarketSeed {
  code: string;
  name: string;
  countryCode: string;
  canonicalCurrency: string;
  displayCurrencies: string[];
  defaultLanguage: string;
  timezone: string;
  taxMode: string;
  sortOrder: number;
  locales: LocaleSeed[];
}

// Only Mexico ships today. Spain/US/Ireland/Argentina are added through the
// admin Markets module, which is the acceptance test for the whole programme:
// a new market must need no code change.
const MARKETS: MarketSeed[] = [
  {
    code: 'MX',
    name: 'México',
    countryCode: 'MX',
    canonicalCurrency: 'MXN',
    displayCurrencies: ['MXN', 'USD'],
    defaultLanguage: 'es',
    timezone: 'America/Mexico_City',
    taxMode: 'inclusive',
    sortOrder: 10,
    locales: [
      { languageCode: 'es', localeCode: 'es-MX', urlPrefix: 'es-mx', isDefault: true },
      { languageCode: 'en', localeCode: 'en-MX', urlPrefix: 'en-mx', isDefault: false },
    ],
  },
];

async function main() {
  for (const seed of MARKETS) {
    const country = await prisma.country.findUnique({ where: { code: seed.countryCode } });
    if (!country) {
      throw new Error(
        `Country ${seed.countryCode} is not seeded; run the country reference seed first.`,
      );
    }

    // `active` and `indexable` are intentionally absent from the update payload:
    // re-running the seed must never silently re-close a market an admin opened,
    // nor re-open one they closed.
    const data = {
      name: seed.name,
      countryId: country.id,
      countryCode: seed.countryCode,
      canonicalCurrency: seed.canonicalCurrency,
      displayCurrencies: seed.displayCurrencies,
      defaultLanguage: seed.defaultLanguage,
      timezone: seed.timezone,
      taxMode: seed.taxMode,
      sortOrder: seed.sortOrder,
    };

    const market = await prisma.commerceMarket.upsert({
      where: { code: seed.code },
      create: { code: seed.code, ...data },
      update: data,
    });

    for (const locale of seed.locales) {
      const localeData = {
        localeCode: locale.localeCode,
        urlPrefix: locale.urlPrefix,
        isDefault: locale.isDefault,
      };
      await prisma.commerceMarketLocale.upsert({
        where: {
          marketId_languageCode: { marketId: market.id, languageCode: locale.languageCode },
        },
        create: { marketId: market.id, languageCode: locale.languageCode, ...localeData },
        update: localeData,
      });
    }
  }

  const [markets, locales] = await Promise.all([
    prisma.commerceMarket.count(),
    prisma.commerceMarketLocale.count(),
  ]);
  console.log(JSON.stringify({ markets, locales }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
