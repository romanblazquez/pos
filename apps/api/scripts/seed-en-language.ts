/**
 * Seeds a handful of hand-written, APPROVED EntityLocalization rows for real
 * products already in the dev DB (against the English Language row already
 * created by the canonical reference seed migration), so the marketplace's
 * ES/EN toggle has something real to show for product name/description (see
 * apps/api/src/marketplace/marketplace.service.ts's getProductLocalizations).
 * Idempotent — safe to run multiple times.
 *
 * Not a translation pipeline: this is 3 hand-written demo rows, not bulk/AI
 * translation (that stays future roadmap work — Phase 3 of the markets
 * i18n roadmap: Google Translate drafts -> moderation queue).
 *
 * Usage: DATABASE_URL=... npx tsx apps/api/scripts/seed-en-language.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRODUCT_ENTITY_TYPE = 'mkt_product';

const DEMO_TRANSLATIONS: Array<{ slug: string; title: string; description: string }> = [
  {
    slug: 'ticket-to-ride-9209',
    title: 'Ticket to Ride',
    description:
      'A gateway board game about building railway routes across North America. Collect train car '
      + 'cards, claim routes, and complete Destination Tickets for bonus points — easy to learn in '
      + 'under 15 minutes, with real strategic tension over route timing.',
  },
  {
    slug: '7-wonders-duel-173346',
    title: '7 Wonders Duel',
    description:
      'A fast two-player civilization game. Draft cards across three ages to build your city\'s '
      + 'economy, military, and science, racing toward one of several distinct victory paths.',
  },
  {
    slug: 'iss-vanguard-325494',
    title: 'ISS Vanguard',
    description:
      'A narrative-driven cooperative campaign game set aboard a deep-space exploration vessel. '
      + 'Manage your crew, upgrade the ship, and make campaign-shaping decisions across an evolving '
      + 'science-fiction story.',
  },
];

async function main() {
  // The canonical reference seed (20260630012000_canonical_reference_seed)
  // already inserts English as code 'en-US' / iso6391 'en' — reuse it
  // instead of creating a competing 'en' row.
  const language = await prisma.language.findFirst({ where: { iso6391: 'en' } });
  if (!language) {
    throw new Error(
      "No Language row with iso6391 'en' found. Run `prisma migrate deploy` first "
      + '(20260630012000_canonical_reference_seed creates it).',
    );
  }

  let seeded = 0;
  let skipped = 0;

  for (const item of DEMO_TRANSLATIONS) {
    const product = await prisma.mktProduct.findUnique({ where: { slug: item.slug } });
    if (!product) {
      console.warn(`Skipping "${item.slug}" — no matching MktProduct in this database.`);
      skipped++;
      continue;
    }

    await prisma.entityLocalization.upsert({
      where: {
        entityType_entityId_languageId: {
          entityType: PRODUCT_ENTITY_TYPE,
          entityId: product.id,
          languageId: language.id,
        },
      },
      create: {
        entityType: PRODUCT_ENTITY_TYPE,
        entityId: product.id,
        languageId: language.id,
        title: item.title,
        normalizedTitle: item.title.toLowerCase(),
        description: item.description,
        moderationStatus: 'APPROVED',
        reviewedBy: 'seed-script',
        reviewedAt: new Date(),
      },
      update: {
        title: item.title,
        normalizedTitle: item.title.toLowerCase(),
        description: item.description,
        moderationStatus: 'APPROVED',
      },
    });
    seeded++;
  }

  console.log(`Seeded ${seeded} product localizations against Language "${language.code}" (skipped ${skipped}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
