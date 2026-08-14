/**
 * One-time backfill for the Typesense `sellerSlugs` field (added alongside
 * the seller storefront pages) on documents indexed before that field
 * existed. New/changed listings already populate it correctly going forward
 * via ProductIndexerService — this only patches the historical gap.
 *
 * Usage: DATABASE_URL=... npx tsx apps/api/scripts/backfill-seller-slugs.ts
 */
import { PrismaClient } from '@prisma/client';
import Typesense from 'typesense';

const prisma = new PrismaClient();
const search = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST ?? 'localhost',
    port: Number(process.env.TYPESENSE_PORT ?? 8108),
    protocol: 'http',
  }],
  apiKey: process.env.TYPESENSE_API_KEY ?? 'dev-typesense-key',
  connectionTimeoutSeconds: 10,
});

const CHUNK_SIZE = 1000;

async function main() {
  // Same visibility rule as ProductIndexerService: active listing, non-
  // suspended seller.
  const products = await prisma.mktProduct.findMany({
    where: { listings: { some: { active: true, seller: { status: 'active' } } } },
    select: {
      id: true,
      listings: {
        where: { active: true, seller: { status: 'active' } },
        select: { seller: { select: { slug: true } } },
      },
    },
  });
  console.log(`Backfilling sellerSlugs for ${products.length} products with a visible active listing...`);

  const docs = products.map((p) => ({
    id: p.id,
    sellerSlugs: [...new Set(p.listings.map((l) => l.seller.slug))],
  }));

  let patched = 0;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const batch = docs.slice(i, i + CHUNK_SIZE);
    try {
      await search.collections('mkt_products').documents().import(batch, { action: 'update' });
      patched += batch.length;
    } catch (err) {
      console.warn(`Batch at offset ${i} had errors: ${String(err)}`);
    }
  }
  console.log(`Typesense: ${patched}/${docs.length} documents patched.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
