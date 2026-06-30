import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [source, bggNamespace, eanNamespace, language] = await Promise.all([
    prisma.dataSource.findUniqueOrThrow({ where: { code: 'manual-admin' } }),
    prisma.identifierNamespace.findUniqueOrThrow({ where: { code: 'boardgamegeek_id' } }),
    prisma.identifierNamespace.findUniqueOrThrow({ where: { code: 'ean' } }),
    prisma.language.findUniqueOrThrow({ where: { code: 'es-MX' } }),
  ]);

  const existingBggId = await prisma.externalIdentifier.findFirst({
    where: {
      namespaceId: bggNamespace.id,
      normalizedValue: '13',
      entityType: 'master_game',
      verificationStatus: 'VERIFIED',
    },
  });

  const result = await prisma.$transaction(async (tx) => {
    const game = existingBggId
      ? await tx.masterGame.findUniqueOrThrow({ where: { id: existingBggId.entityId } })
      : await tx.masterGame.create({
          data: {
            canonicalTitle: 'Catan',
            originalTitle: 'Die Siedler von Catan',
            normalizedTitle: 'catan',
            originalLanguageCode: 'de-DE',
            yearPublished: 1995,
            minPlayers: 3,
            maxPlayers: 4,
            minPlayTimeMinutes: 60,
            maxPlayTimeMinutes: 120,
            minAge: 10,
            complexityWeight: 2.3,
            canonicalStatus: 'PUBLISHED',
            moderationStatus: 'APPROVED',
            reviewedBy: 'seed:canonical-example',
            reviewedAt: new Date(),
          },
        });

    const localization = await tx.entityLocalization.upsert({
      where: {
        entityType_entityId_languageId: {
          entityType: 'master_game',
          entityId: game.id,
          languageId: language.id,
        },
      },
      create: {
        entityType: 'master_game',
        entityId: game.id,
        languageId: language.id,
        title: 'Catan',
        alternateTitles: ['Los colonos de Catán'],
        normalizedTitle: 'catan',
        shortDescription: 'Juego de negociación, rutas y construcción de asentamientos.',
        sourceClaimIds: [],
        moderationStatus: 'APPROVED',
        reviewedBy: 'seed:canonical-example',
        reviewedAt: new Date(),
      },
      update: {},
    });

    const edition =
      (await tx.gameEdition.findFirst({
        where: {
          masterGameId: game.id,
          normalizedEditionName: 'spanish-fifth-edition',
          primaryLanguageCode: 'es-MX',
          regionCode: 'MX',
        },
      })) ??
      (await tx.gameEdition.create({
        data: {
          masterGameId: game.id,
          editionName: 'Edición en español, quinta edición',
          normalizedEditionName: 'spanish-fifth-edition',
          editionNumber: '5',
          primaryLanguageCode: 'es-MX',
          regionCode: 'MX',
          releaseYear: 2015,
          canonicalStatus: 'PUBLISHED',
          moderationStatus: 'APPROVED',
          reviewedBy: 'seed:canonical-example',
          reviewedAt: new Date(),
        },
      }));

    const printing =
      (await tx.gamePrinting.findFirst({
        where: { editionId: edition.id, printingYear: 2023, printNumber: '1' },
      })) ??
      (await tx.gamePrinting.create({
        data: {
          editionId: edition.id,
          printingYear: 2023,
          printNumber: '1',
          manufacturingCountry: 'DE',
          boxWidthMm: 295,
          boxHeightMm: 295,
          boxDepthMm: 72,
          weightGrams: 1_200,
          canonicalStatus: 'PUBLISHED',
          moderationStatus: 'APPROVED',
          reviewedBy: 'seed:canonical-example',
          reviewedAt: new Date(),
        },
      }));

    const product =
      (await tx.catalogProduct.findFirst({ where: { printingId: printing.id, productType: 'BOARD_GAME' } })) ??
      (await tx.catalogProduct.create({
        data: {
          productType: 'BOARD_GAME',
          masterGameId: game.id,
          editionId: edition.id,
          printingId: printing.id,
          canonicalTitle: 'Catan — edición en español — impresión 2023',
          normalizedTitle: 'catan-edicion-espanol-impresion-2023',
          commerceCategory: 'board-game',
          boxWidthMm: 295,
          boxHeightMm: 295,
          boxDepthMm: 72,
          weightGrams: 1_200,
          canonicalStatus: 'PUBLISHED',
          moderationStatus: 'APPROVED',
          reviewedBy: 'seed:canonical-example',
          reviewedAt: new Date(),
        },
      }));

    await Promise.all([
      tx.externalIdentifier.upsert({
        where: {
          namespaceId_entityType_entityId_normalizedValue_sourceId: {
            namespaceId: bggNamespace.id,
            entityType: 'master_game',
            entityId: game.id,
            normalizedValue: '13',
            sourceId: source.id,
          },
        },
        create: {
          namespaceId: bggNamespace.id,
          entityType: 'master_game',
          entityId: game.id,
          identifierValue: '13',
          normalizedValue: '13',
          sourceId: source.id,
          confidenceScore: 1,
          verificationStatus: 'VERIFIED',
          verifiedBy: 'seed:canonical-example',
          verifiedAt: new Date(),
        },
        update: { lastSeenAt: new Date() },
      }),
      tx.externalIdentifier.upsert({
        where: {
          namespaceId_entityType_entityId_normalizedValue_sourceId: {
            namespaceId: eanNamespace.id,
            entityType: 'catalog_product',
            entityId: product.id,
            normalizedValue: '4002051692682',
            sourceId: source.id,
          },
        },
        create: {
          namespaceId: eanNamespace.id,
          entityType: 'catalog_product',
          entityId: product.id,
          identifierValue: '4002051692682',
          normalizedValue: '4002051692682',
          sourceId: source.id,
          marketplaceCountry: 'MX',
          confidenceScore: 1,
          verificationStatus: 'VERIFIED',
          verifiedBy: 'seed:canonical-example',
          verifiedAt: new Date(),
        },
        update: { lastSeenAt: new Date() },
      }),
    ]);

    return { game, localization, edition, printing, product };
  });

  console.info({
    masterGameId: result.game.id,
    editionId: result.edition.id,
    printingId: result.printing.id,
    catalogProductId: result.product.id,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
