/**
 * Seeds the TenantMarket row linking the demo tenant to MX/MXN/es-MX, using
 * the Country/Currency/Language reference rows already inserted by the
 * canonical reference seed migration (20260630012000_canonical_reference_seed)
 * — this script only adds the tenant-scoped join, not the reference data
 * itself. Idempotent — safe to run multiple times.
 *
 * Usage: DATABASE_URL=... npx tsx apps/api/scripts/seed-default-market.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = 'tenant-demo';

async function main() {
  const currency = await prisma.currency.findUnique({ where: { code: 'MXN' } });
  const country = await prisma.country.findUnique({ where: { code: 'MX' } });
  // Language.code is the full locale tag ('es-MX'); iso6391 is the
  // canonical 2-letter lookup for the primary regional variant.
  const language = await prisma.language.findFirst({ where: { iso6391: 'es' } });

  if (!currency || !country || !language) {
    throw new Error(
      'MXN/MX/es reference rows not found. Run `prisma migrate deploy` first '
      + '(20260630012000_canonical_reference_seed creates them).',
    );
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: DEFAULT_TENANT_ID } });
  if (!tenant) {
    console.log(`Tenant "${DEFAULT_TENANT_ID}" not found — skipping TenantMarket row. ` +
      'Country/Currency/Language reference rows already exist; markets.service.ts default fallback still works.');
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

  console.log(`Confirmed default market reference rows: ${country.code} / ${currency.code} / ${language.code}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
