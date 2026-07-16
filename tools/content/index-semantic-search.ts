import { PrismaClient } from '@prisma/client';
import { SemanticSearchService } from '../../apps/api/src/search/semantic-search.service.js';

const prisma = new PrismaClient();

try {
  const result = await new SemanticSearchService(prisma as never).indexShoppableCatalog();
  process.stdout.write(`Semantic index complete: ${result.indexed} indexed, ${result.skipped} unchanged.\n`);
} finally {
  await prisma.$disconnect();
}
