/**
 * Force a search-index rebuild for storefront products.
 *
 * Exists because the index can hold a document that is stale in a way nothing
 * will correct on its own: a document is only rewritten when something touches
 * its product, so a bug in how documents are built leaves every previously
 * written document wrong until each product is touched again. Fixing the
 * indexer does not fix what it already wrote.
 *
 * Runs the real ProductIndexerService through the application's own DI
 * container, so it cannot drift from what the API does at runtime.
 *
 *   docker cp tools/reindex-products.ts retail-os-api:/app/tools/
 *   docker exec retail-os-api pnpm exec tsx --tsconfig apps/api/tsconfig.json \
 *     tools/reindex-products.ts [--suspended-sellers | --all]
 *
 * --suspended-sellers  Only products carrying a listing from a non-active
 *                      seller. The narrow, fast repair.
 * --all                Every storefront product. Slow; use after an indexer
 *                      change that affects documents generally.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module.js';
import { PrismaService } from '@retail-os/db-postgres';
import { ProductIndexerService } from '../apps/api/src/search/product-indexer.service.js';

async function main() {
  const mode = process.argv.includes('--all') ? 'all' : 'suspended-sellers';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const indexer = app.get(ProductIndexerService);

    const products = mode === 'all'
      ? await prisma.mktProduct.findMany({ select: { id: true, slug: true } })
      : await prisma.mktProduct.findMany({
          where: { listings: { some: { seller: { status: { not: 'active' } } } } },
          select: { id: true, slug: true },
        });

    console.log(`Reindexing ${products.length} product(s) [${mode}]`);

    let ok = 0;
    const failures: string[] = [];
    for (const product of products) {
      try {
        await indexer.syncProduct(product.id);
        ok += 1;
      } catch (err) {
        failures.push(`${product.slug}: ${String(err)}`);
      }
    }

    console.log(`Done: ${ok}/${products.length} reindexed`);
    // Report rather than swallow: a partial pass that looks successful is how a
    // stale document survives a repair.
    for (const failure of failures.slice(0, 10)) console.error(`  FAILED ${failure}`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
