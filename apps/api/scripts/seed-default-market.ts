/**
 * Seeds the MX/MXN/es default market reference rows (Country, Currency,
 * Language, TenantMarket) so apps/api/src/markets/markets.service.ts has
 * real data instead of only its hardcoded fallback. Idempotent — safe to
 * run multiple times.
 *
 * Usage: DATABASE_URL=... npx tsx apps/api/scripts/seed-default-market.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = 'tenant-demo';

async function main() {
  const currency = await prisma.currency.upsert({
    where: { code: 'MXN' },
    create: { code: 'MXN', numericCode: '484', name: 'Peso mexicano', symbol: '$', minorUnits: 2 },
    update: {},
  });

  const language = await prisma.language.upsert({
    where: { code: 'es' },
    create: { code: 'es', iso6391: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
    update: {},
  });

  const country = await prisma.country.upsert({
    where: { code: 'MX' },
    create: {
      code: 'MX',
      iso3Code: 'MEX',
      name: 'México',
      defaultCurrency: currency.code,
      defaultLanguage: language.code,
      timezone: 'America/Mexico_City',
    },
    update: { defaultCurrency: currency.code, defaultLanguage: language.code },
  });

  const tenant = await prisma.tenant.findUnique({ where: { id: DEFAULT_TENANT_ID } });
  if (!tenant) {
    console.log(`Tenant "${DEFAULT_TENANT_ID}" not found — skipping TenantMarket row. ` +
      'Country/Currency/Language reference rows are seeded; markets.service.ts default fallback still works.');
  } else {
    await prisma.tenantMarket.upsert({
      where: {
        tenantId_countryId_currencyCode_defaultLanguageCode: {
          tenantId: tenant.id,
          countryId: country.id,
          currencyCode: currency.code,
          defaultLanguageCode: language.code,
        },
      },
      create: {
        tenantId: tenant.id,
        countryId: country.id,
        currencyCode: currency.code,
        defaultLanguageCode: language.code,
        timezone: 'America/Mexico_City',
      },
      update: {},
    });
    console.log(`Seeded TenantMarket for tenant "${DEFAULT_TENANT_ID}".`);
  }

  console.log('Seeded default market: MX / MXN / es.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
