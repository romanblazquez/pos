# Juegospedia v2 implementation examples

These examples target the implemented Prisma models. They are patterns for the NestJS modules and BullMQ workers introduced during the phased cutover, not alternate schemas.

## 1. Canonical repository queries

### Find a game by localized slug

Resolve through SEO identity so historical slugs and locale rules stay outside the catalog table:

```ts
async function findGameBySlug(prisma: PrismaClient, locale: string, slug: string) {
  const page = await prisma.seoPage.findFirst({
    where: {
      locale,
      slug,
      entityType: 'master_game',
      indexable: true,
    },
    select: { entityId: true },
  });

  if (!page?.entityId) return null;

  return prisma.masterGame.findFirst({
    where: {
      id: page.entityId,
      canonicalStatus: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      deletedAt: null,
    },
    include: {
      designers: { include: { designer: true }, orderBy: { sortOrder: 'asc' } },
      artists: { include: { artist: true }, orderBy: { sortOrder: 'asc' } },
      mechanics: { include: { mechanic: true } },
      categories: { include: { category: true } },
      editions: { where: { canonicalStatus: 'PUBLISHED', deletedAt: null } },
    },
  });
}
```

### Find a product by GTIN/EAN/UPC/ISBN

```ts
async function findProductByTradeId(
  prisma: PrismaClient,
  type: 'gtin' | 'ean' | 'upc' | 'isbn_10' | 'isbn_13',
  rawValue: string,
) {
  const normalizedValue = rawValue.replace(/[^0-9X]/gi, '').toUpperCase();
  const identifier = await prisma.externalIdentifier.findFirst({
    where: {
      namespace: { code: type },
      normalizedValue,
      entityType: 'catalog_product',
      verificationStatus: 'VERIFIED',
    },
    orderBy: [{ confidenceScore: 'desc' }, { verifiedAt: 'desc' }],
    select: { entityId: true },
  });

  return identifier
    ? prisma.catalogProduct.findUnique({ where: { id: identifier.entityId } })
    : null;
}
```

### Find the best offer for a country

The ranking policy prefers purchasable offers, then landed price, then organic rank. Shipping destination-specific calculations may supersede the stored base shipping amount.

```ts
async function findBestOffer(
  prisma: PrismaClient,
  catalogProductId: string,
  countryCode: string,
  currencyCode: string,
) {
  return prisma.sellerOfferCurrent.findFirst({
    where: {
      catalogProductId,
      country: { code: countryCode },
      currencyCode,
      active: true,
      stockStatus: { in: ['IN_STOCK', 'LOW_STOCK', 'PREORDER', 'BACKORDER'] },
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
    orderBy: [
      { priceMinor: 'asc' },
      { shippingPriceMinor: 'asc' },
      { rankScore: 'desc' },
    ],
    include: {
      seller: { include: { score: true } },
      shippingOptions: { where: { active: true, shippingCountryCode: countryCode } },
      returnPolicy: true,
      coupons: { where: { active: true } },
      cashbackRules: { where: { active: true } },
    },
  });
}
```

### Find all offers for a product

```ts
const offers = await prisma.sellerOfferCurrent.findMany({
  where: {
    catalogProductId,
    country: { code: 'MX' },
    active: true,
  },
  orderBy: [{ stockStatus: 'asc' }, { priceMinor: 'asc' }, { rankScore: 'desc' }],
  include: { seller: true, marketplace: true, shippingOptions: true },
});
```

### Find compatible accessories

```ts
const accessories = await prisma.accessoryCompatibility.findMany({
  where: {
    compatibleMasterGameId: masterGameId,
    moderationStatus: 'APPROVED',
    accessoryProduct: {
      canonicalStatus: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      deletedAt: null,
    },
  },
  include: {
    accessoryProduct: {
      include: { images: { where: { isPrimary: true }, include: { asset: true } } },
    },
  },
  orderBy: { confidenceScore: 'desc' },
});
```

### Find expansions for a game

The expansion is the source and its base game is the target for `EXPANSION_OF`:

```ts
const expansions = await prisma.gameRelationship.findMany({
  where: {
    targetGameId: baseGameId,
    relationshipType: { in: ['EXPANSION_OF', 'STANDALONE_EXPANSION'] },
    moderationStatus: 'APPROVED',
  },
  include: { sourceGame: true },
  orderBy: [{ confidenceScore: 'desc' }, { sourceGame: { yearPublished: 'asc' } }],
});
```

### Find products requiring match review

```ts
const reviewQueue = await prisma.productMatchCandidate.findMany({
  where: { status: 'NEEDS_REVIEW' },
  include: {
    sourceProduct: { include: { seller: true, integration: true } },
    candidateProduct: true,
  },
  orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
  take: 100,
});
```

### Find stale offers

```ts
const staleBefore = new Date(Date.now() - 30 * 60_000);
const stale = await prisma.sellerOfferCurrent.findMany({
  where: { active: true, lastSeenAt: { lt: staleBefore } },
  select: { id: true, sellerId: true, integrationId: true, lastSeenAt: true },
  orderBy: { lastSeenAt: 'asc' },
  take: 1_000,
});
```

### Generate product structured data

```ts
async function productJsonLd(prisma: PrismaClient, productId: string, countryCode: string) {
  const product = await prisma.catalogProduct.findUniqueOrThrow({
    where: { id: productId },
    include: {
      publisher: true,
      images: { where: { isPrimary: true }, include: { asset: true } },
      offers: {
        where: { country: { code: countryCode }, active: true },
        include: { seller: true, shippingOptions: true, returnPolicy: true },
      },
    },
  });

  const available = product.offers.filter((offer) =>
    ['IN_STOCK', 'LOW_STOCK', 'PREORDER', 'BACKORDER'].includes(offer.stockStatus),
  );
  const currencies = new Set(available.map((offer) => offer.currencyCode));
  if (currencies.size > 1) throw new Error('AggregateOffer must be scoped to one currency');
  const prices = available.map((offer) => offer.priceMinor);
  const currency = available[0]?.currencyCode;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `https://juegospedia.com/products/${product.id}#product`,
    name: product.canonicalTitle,
    description: product.description,
    image: product.images.map((image) => image.asset.cdnUrl ?? image.asset.localPath),
    brand: product.publisher ? { '@type': 'Brand', name: product.publisher.canonicalName } : undefined,
    ...(prices.length && currency
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: currency,
            lowPrice: Number(prices.reduce((a, b) => (a < b ? a : b))) / 100,
            highPrice: Number(prices.reduce((a, b) => (a > b ? a : b))) / 100,
            offerCount: prices.length,
          },
        }
      : {}),
  };
}
```

Money conversion above is only for JSON serialization at the edge. Domain calculations stay in `bigint` minor units.

## 2. Repository transaction: accept a source claim

Canonical writes, audit history, and projection invalidation must share a transaction/outbox boundary:

```ts
async function acceptCanonicalTitle(
  prisma: PrismaClient,
  input: { gameId: string; claimId: string; reviewerId: string; correlationId: string },
) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.sourceClaim.findUniqueOrThrow({ where: { id: input.claimId } });
    if (claim.entityType !== 'master_game' || claim.entityId !== input.gameId || claim.fieldPath !== 'canonicalTitle') {
      throw new Error('Claim target mismatch');
    }

    const title = String(claim.value);
    const before = await tx.masterGame.findUniqueOrThrow({ where: { id: input.gameId } });
    const after = await tx.masterGame.update({
      where: { id: input.gameId },
      data: { canonicalTitle: title, normalizedTitle: normalizeTitle(title) },
    });
    await tx.sourceClaim.update({
      where: { id: claim.id },
      data: { status: 'ACCEPTED', reviewedBy: input.reviewerId, reviewedAt: new Date() },
    });
    await tx.canonicalAuditLog.create({
      data: {
        entityType: 'master_game',
        entityId: input.gameId,
        action: 'claim.accepted',
        actorType: 'admin',
        actorId: input.reviewerId,
        correlationId: input.correlationId,
        before,
        after,
        sourceClaimIds: [claim.id],
      },
    });

    // Production implementation also writes a transactional outbox event here.
    return after;
  });
}
```

## 3. Product matching worker

```ts
type MatchSignal = {
  name: string;
  score: number;
  trusted?: boolean;
  conflict?: boolean;
  detail: string;
};

function classify(signals: MatchSignal[], runnerUpScore: number | null) {
  if (signals.some((signal) => signal.conflict && signal.trusted)) {
    return { score: 0, status: 'NEEDS_REVIEW' as const, level: 'LOW' as const };
  }

  const exactTrusted = signals.some((signal) => signal.trusted && signal.score >= 0.95);
  const score = exactTrusted
    ? Math.max(...signals.filter((signal) => signal.trusted).map((signal) => signal.score))
    : Math.min(1, signals.reduce((sum, signal) => sum + signal.score, 0));
  const margin = runnerUpScore == null ? 1 : score - runnerUpScore;

  if (exactTrusted && score >= 0.95) return { score, status: 'AUTO_APPROVED' as const, level: 'EXACT' as const };
  if (score >= 0.85 && margin >= 0.10) return { score, status: 'AUTO_APPROVED' as const, level: 'HIGH' as const };
  if (score >= 0.65) return { score, status: 'NEEDS_REVIEW' as const, level: 'MEDIUM' as const };
  return { score, status: 'REJECTED' as const, level: 'LOW' as const };
}

async function persistCandidate(
  prisma: PrismaClient,
  sourceProductId: string,
  productId: string,
  signals: MatchSignal[],
  runnerUpScore: number | null,
  algorithmVersion: string,
) {
  const result = classify(signals, runnerUpScore);
  return prisma.productMatchCandidate.upsert({
    where: {
      sourceProductId_candidateProductId_algorithmVersion: {
        sourceProductId,
        candidateProductId: productId,
        algorithmVersion,
      },
    },
    create: {
      sourceProductId,
      candidateProductId: productId,
      score: result.score,
      confidenceLevel: result.level,
      matchReasons: signals.filter((signal) => !signal.conflict),
      conflictingSignals: signals.filter((signal) => signal.conflict),
      algorithmVersion,
      status: result.status,
      rawPayload: { signals },
    },
    update: {
      score: result.score,
      confidenceLevel: result.level,
      matchReasons: signals.filter((signal) => !signal.conflict),
      conflictingSignals: signals.filter((signal) => signal.conflict),
      status: result.status,
      rawPayload: { signals },
    },
  });
}
```

Auto approval still writes a `ProductMatchDecision`; it does not silently update `matchedCatalogProductId` without audit.

## 4. Seller import worker

```ts
async function importSellerRecord(prisma: PrismaClient, job: ImportJob<ProviderProduct>) {
  const payloadHash = sha256(stableJson(job.data.payload));

  return prisma.$transaction(async (tx) => {
    const raw = await tx.rawSourceRecord.upsert({
      where: {
        sourceId_externalKey_payloadHash: {
          sourceId: job.data.sourceId,
          externalKey: job.data.externalProductId,
          payloadHash,
        },
      },
      create: {
        sourceId: job.data.sourceId,
        importJobId: job.data.importJobId,
        externalKey: job.data.externalProductId,
        payloadHash,
        rawPayload: job.data.payload,
        sourceUrl: job.data.sourceUrl,
        sourceConfidence: job.data.confidence,
      },
      update: { observedAt: new Date() },
    });

    const sourceProduct = await tx.sellerSourceProduct.upsert({
      where: {
        sellerId_integrationId_externalProductId_externalVariantId: {
          sellerId: job.data.sellerId,
          integrationId: job.data.integrationId,
          externalProductId: job.data.externalProductId,
          externalVariantId: job.data.externalVariantId ?? '',
        },
      },
      create: normalizeProviderProduct(job.data, raw.id),
      update: {
        ...normalizeProviderProduct(job.data, raw.id),
        lastSeenAt: new Date(),
      },
    });

    return { sourceProductId: sourceProduct.id, rawRecordId: raw.id };
  });
}
```

In practice nullable external variant keys need a deterministic empty sentinel or a raw `NULLS NOT DISTINCT` unique index. The production normalization adapter owns that sentinel.

## 5. Offer sync transaction

```ts
async function upsertOffer(prisma: PrismaClient, observation: OfferObservation) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.sellerOfferCurrent.findUnique({
      where: { sellerId_sourceOfferKey: observation.key },
    });
    const offer = await tx.sellerOfferCurrent.upsert({
      where: { sellerId_sourceOfferKey: observation.key },
      create: observation.current,
      update: { ...observation.current, lastSeenAt: observation.observedAt },
    });

    if (!previous || previous.priceMinor !== offer.priceMinor || previous.shippingPriceMinor !== offer.shippingPriceMinor) {
      await tx.sellerOfferPriceHistory.create({
        data: {
          observedAt: observation.observedAt,
          offerId: offer.id,
          priceMinor: offer.priceMinor,
          compareAtPriceMinor: offer.compareAtPriceMinor,
          shippingPriceMinor: offer.shippingPriceMinor,
          currencyCode: offer.currencyCode,
          taxIncluded: offer.taxIncluded,
          rawPayload: observation.rawPayload,
        },
      });
    }

    if (!previous || previous.stockStatus !== offer.stockStatus || previous.quantityAvailable !== offer.quantityAvailable) {
      await tx.sellerOfferInventoryHistory.create({
        data: {
          observedAt: observation.observedAt,
          offerId: offer.id,
          stockStatus: offer.stockStatus,
          quantityAvailable: offer.quantityAvailable,
          rawPayload: observation.rawPayload,
        },
      });
    }

    return offer;
  });
}
```

## 6. Image enrichment worker

The worker depends on explicit security, processing, and storage ports:

```ts
interface AuthorizedImageRequest {
  sourceId: string;
  sourceUrl: string;
  entityType: string;
  entityId: string;
  role: ImageRole;
  attribution?: string;
}

interface SafeFetcher {
  fetchToQuarantine(url: string, limits: { maxBytes: number; timeoutMs: number }): Promise<{
    path: string;
    detectedMime: string;
    size: bigint;
  }>;
}

interface ImageProcessor {
  inspect(path: string): Promise<{ width: number; height: number; sha256: string; perceptualHash: string }>;
  variants(path: string): Promise<Array<{
    name: string;
    path: string;
    width: number;
    height: number;
    bytes: bigint;
    mimeType: string;
  }>>;
}

interface MediaStore {
  put(contentAddress: string, sourcePath: string, mimeType: string): Promise<{ storageKey: string; url: string }>;
}

async function enrichImage(
  prisma: PrismaClient,
  fetcher: SafeFetcher,
  processor: ImageProcessor,
  store: MediaStore,
  request: AuthorizedImageRequest,
) {
  const source = await prisma.dataSource.findUniqueOrThrow({ where: { id: request.sourceId } });
  if (!source.imageImportAllowed) throw new Error('Source is not authorized for image ingestion');

  const downloaded = await fetcher.fetchToQuarantine(request.sourceUrl, {
    maxBytes: 25 * 1024 * 1024,
    timeoutMs: 15_000,
  });
  const inspected = await processor.inspect(downloaded.path);
  const duplicate = await prisma.localImageAsset.findUnique({ where: { sha256: inspected.sha256 } });
  if (duplicate) return duplicate;

  const processed = await processor.variants(downloaded.path);
  const stored = await Promise.all(processed.map(async (variant) => ({
    variant,
    object: await store.put(`${inspected.sha256}/${variant.name}`, variant.path, variant.mimeType),
  })));

  return prisma.localImageAsset.create({
    data: {
      sourceId: source.id,
      originalUrl: request.sourceUrl,
      sourceUrl: request.sourceUrl,
      sourceName: source.name,
      sourceAttribution: request.attribution,
      storageKey: stored[0].object.storageKey,
      cdnUrl: stored[0].object.url,
      sha256: inspected.sha256,
      perceptualHash: inspected.perceptualHash,
      width: inspected.width,
      height: inspected.height,
      fileSizeBytes: downloaded.size,
      mimeType: downloaded.detectedMime,
      dominantColors: [],
      licenseStatus: 'AUTHORIZED',
      moderationStatus: 'PENDING',
      entityAttachments: {
        create: { entityType: request.entityType, entityId: request.entityId, role: request.role },
      },
      variants: {
        create: stored.map(({ variant, object }) => ({
          variantName: variant.name,
          storageKey: object.storageKey,
          cdnUrl: object.url,
          width: variant.width,
          height: variant.height,
          fileSizeBytes: variant.bytes,
          mimeType: variant.mimeType,
        })),
      },
    },
  });
}
```

The filesystem adapter writes to a temporary name, `fsync`s, then atomically renames. Object-store adapters upload with immutable cache headers and content hashes.

## 7. SEO page generation worker

```ts
async function generateGameSeoPage(prisma: PrismaClient, gameId: string, languageId: string, locale: string) {
  const [game, localization] = await Promise.all([
    prisma.masterGame.findUniqueOrThrow({
      where: { id: gameId },
      include: { designers: { include: { designer: true } }, mechanics: { include: { mechanic: true } } },
    }),
    prisma.entityLocalization.findUnique({
      where: { entityType_entityId_languageId: { entityType: 'master_game', entityId: gameId, languageId } },
    }),
  ]);

  const title = localization?.title ?? game.canonicalTitle;
  const slug = slugify(title);
  const dataComplete = Boolean(localization?.description && game.minPlayers && game.maxPlayers);
  const structuredData = buildGameJsonLd(game, localization, locale, slug);

  return prisma.$transaction(async (tx) => {
    const page = await tx.seoPage.upsert({
      where: { locale_countryCode_slug: { locale, countryCode: null, slug } },
      create: {
        languageId,
        pageType: 'ENTITY',
        entityType: 'master_game',
        entityId: game.id,
        slug,
        locale,
        canonicalUrl: `https://juegospedia.com/${locale}/juegos/${slug}`,
        title: `${title} — reglas, ediciones y precios`,
        metaDescription: summarize(localization?.description ?? game.description ?? '', 155),
        indexable: dataComplete && game.canonicalStatus === 'PUBLISHED' && game.moderationStatus === 'APPROVED',
        minimumDataMet: dataComplete,
        qualityScore: calculateSeoQuality(game, localization),
        structuredData,
        lastGeneratedAt: new Date(),
        generationVersion: 'game-v1',
      },
      update: {
        title: `${title} — reglas, ediciones y precios`,
        metaDescription: summarize(localization?.description ?? game.description ?? '', 155),
        indexable: dataComplete && game.canonicalStatus === 'PUBLISHED' && game.moderationStatus === 'APPROVED',
        minimumDataMet: dataComplete,
        qualityScore: calculateSeoQuality(game, localization),
        structuredData,
        lastGeneratedAt: new Date(),
        generationVersion: 'game-v1',
      },
    });
    return page;
  });
}
```

If a generated slug changes, the same transaction closes the old `SeoSlug`, inserts the new slug, and creates a one-hop 301 redirect.

## 8. Reindexing worker

```ts
async function projectProductSearchDocument(prisma: PrismaClient, productId: string, locale: string) {
  const product = await prisma.catalogProduct.findUniqueOrThrow({
    where: { id: productId },
    include: {
      masterGame: {
        include: {
          designers: { include: { designer: true } },
          mechanics: { include: { mechanic: true } },
          categories: { include: { category: true } },
          themes: { include: { theme: true } },
        },
      },
      images: { where: { isPrimary: true }, include: { asset: true } },
      offers: { where: { active: true } },
    },
  });

  const prices = product.offers.map((offer) => offer.priceMinor);
  const document = await prisma.searchDocument.upsert({
    where: { documentType_canonicalId_locale: { documentType: 'PRODUCT', canonicalId: product.id, locale } },
    create: buildProductDocument(product, prices, locale),
    update: buildProductDocument(product, prices, locale),
  });

  // Publish `document` to a versioned Typesense/OpenSearch collection using an idempotent upsert.
  return document;
}
```

Full rebuilds use keyset pagination by canonical ID, write a new collection version, compare counts/golden queries, then switch the engine alias atomically.

## 9. NestJS API route pattern

```ts
@Controller('api/v2/products')
export class CanonicalProductController {
  constructor(private readonly catalog: CanonicalProductService) {}

  @Get(':idOrSlug')
  @Header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
  getProduct(
    @Param('idOrSlug') idOrSlug: string,
    @Query('locale') locale = 'es-MX',
    @Query('country') country = 'MX',
    @Query('currency') currency = 'MXN',
  ) {
    return this.catalog.getProductPage({ idOrSlug, locale, country, currency });
  }

  @Get(':id/offers')
  @Header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  getOffers(
    @Param('id') id: string,
    @Query('country') country: string,
    @Query('currency') currency: string,
  ) {
    return this.catalog.getOffers({ productId: id, country, currency });
  }
}
```

Admin claim/match endpoints use authenticated role guards, idempotency keys, optimistic versions, and mandatory reason/audit fields. Seller webhook routes acknowledge only after durable raw-record/job persistence.

## 10. Background job defaults

```ts
const defaultJobOptions: JobsOptions = {
  attempts: 7,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { age: 86_400, count: 50_000 },
  removeOnFail: false,
};

await matchingQueue.add(
  'match-source-product',
  { sourceProductId },
  { ...defaultJobOptions, jobId: `match:${sourceProductId}:${algorithmVersion}` },
);
```

Provider queues define independent concurrency and rate limits. Permanent failures move to a dead-letter queue with the original job ID, error chain, correlation ID, and replay metadata.

## 11. Representative integration tests

```ts
it('keeps canonical knowledge when the last seller offer is deleted', async () => {
  const { game, product, offer } = await fixture.canonicalProductWithOffer();
  await prisma.sellerOfferCurrent.delete({ where: { id: offer.id } });
  expect(await prisma.masterGame.findUnique({ where: { id: game.id } })).not.toBeNull();
  expect(await prisma.catalogProduct.findUnique({ where: { id: product.id } })).not.toBeNull();
});

it('rejects a second verified GTIN for another entity', async () => {
  const first = await fixture.verifiedGtin();
  await expect(fixture.verifiedGtin({ entityId: 'another-product', value: first.identifierValue }))
    .rejects.toMatchObject({ code: 'P2002' });
});

it('never auto-approves a candidate with a trusted conflicting identifier', () => {
  expect(classify([
    { name: 'title', score: 0.35, detail: 'exact title' },
    { name: 'gtin-conflict', score: 0, trusted: true, conflict: true, detail: 'different verified GTIN' },
  ], null).status).toBe('NEEDS_REVIEW');
});
```

