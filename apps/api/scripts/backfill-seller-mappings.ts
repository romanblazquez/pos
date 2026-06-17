/**
 * One-time backfill for the seller-product-matching pipeline (see PLAN.md /
 * the matching-pipeline feature). Run once after the SellerProductMapping
 * migration lands and before/just after the new sync code deploys.
 *
 * Without this, every existing seller's first post-deploy sync would treat
 * every SKU as brand-new (no cache row exists yet) and re-run fuzzy matching
 * for everything that already has a working Listing.
 *
 * What it does:
 * 1. For every existing Listing with no SellerProductMapping yet, creates one
 *    with status 'auto_matched' / matchMethod 'legacy_unreviewed' — seeds the
 *    cache so future syncs of the same SKU skip straight to the fast path.
 * 2. For Listings whose MktProduct was created by the old sync bug (no bggId,
 *    canonicalStatus 'pending' — i.e. never matched against anything, just
 *    blindly created), marks the mapping 'escalated' instead, so it surfaces
 *    in the admin "Solicitudes de mapeo" queue for real triage.
 *
 * Usage: DATABASE_URL=... npx tsx apps/api/scripts/backfill-seller-mappings.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CHUNK_SIZE = 50;

async function main() {
  const listings = await prisma.listing.findMany({
    where: { mapping: null },
    select: {
      id: true,
      sellerId: true,
      sellerProductId: true,
      sellerSku: true,
      productId: true,
      product: { select: { bggId: true, canonicalStatus: true } },
    },
  });

  console.log(`Found ${listings.length} listings with no SellerProductMapping yet.`);

  let seeded = 0;
  let escalated = 0;
  let skipped = 0;

  for (let i = 0; i < listings.length; i += CHUNK_SIZE) {
    const batch = listings.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      batch.map(async (listing) => {
        const externalKey = listing.sellerProductId ?? listing.sellerSku;
        if (!externalKey) {
          // No stable key to cache against — nothing to backfill for this one.
          skipped++;
          return;
        }

        const isPolluted = !listing.product.bggId && listing.product.canonicalStatus === 'pending';

        try {
          await prisma.sellerProductMapping.upsert({
            where: { sellerId_externalKey: { sellerId: listing.sellerId, externalKey } },
            create: {
              sellerId: listing.sellerId,
              externalKey,
              sellerSku: listing.sellerSku,
              sellerProductId: listing.sellerProductId,
              rawPayload: {},
              status: isPolluted ? 'escalated' : 'auto_matched',
              productId: listing.productId,
              matchMethod: 'legacy_unreviewed',
              listingId: listing.id,
              adminNote: isPolluted
                ? 'Auto-created under legacy matching bug (no fuzzy threshold, non-BGG product minted on no-match) — needs review against BGG/master catalog.'
                : undefined,
              resolvedAt: isPolluted ? undefined : new Date(),
              resolvedBy: isPolluted ? undefined : 'backfill',
            },
            update: {},
          });
          if (isPolluted) escalated++; else seeded++;
        } catch (err) {
          console.warn(`Failed to backfill listing ${listing.id}: ${String(err)}`);
          skipped++;
        }
      }),
    );
    console.log(`Progress: ${Math.min(i + CHUNK_SIZE, listings.length)} / ${listings.length}`);
  }

  console.log(`Done. Seeded cache: ${seeded}, escalated for admin review: ${escalated}, skipped: ${skipped}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
