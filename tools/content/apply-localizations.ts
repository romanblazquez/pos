// Idempotent loader: writes curated bilingual copy into entity_localization as
// APPROVED overrides so the marketplace API actually serves it (it only serves
// APPROVED rows). Re-running updates in place — never duplicates. Every row we
// write carries localizationNotes='curated-v1' so the batch is auditable and
// reversible (delete by that tag to roll back without touching the legacy MT).
//
// Usage:
//   DATABASE_URL=…  pnpm tsx tools/content/apply-localizations.ts --dry
//   DATABASE_URL=…  pnpm tsx tools/content/apply-localizations.ts
//
// See docs/content-seo/PLAYBOOK.md §6.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { TIER1 } from './data/tier1.js';
import type { CuratedProduct, LocaleCopy } from './types.js';

const PROVENANCE = 'curated-v1';
const ENTITY_TYPE = 'mkt_product';
const LOCALE_TO_CODE = { en: 'en-US', es: 'es-MX' } as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_PATH = join(__dirname, 'ledger.json');

const DRY = process.argv.includes('--dry');
const prisma = new PrismaClient();

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function hashCopy(p: CuratedProduct): string {
  return createHash('sha1').update(JSON.stringify({ en: p.en, es: p.es })).digest('hex').slice(0, 12);
}

type Ledger = Record<string, { locales: string[]; appliedAt: string; contentHash: string }>;

function loadLedger(): Ledger {
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as Ledger;
  } catch {
    return {};
  }
}

async function main() {
  console.log(`[content] ${DRY ? 'DRY RUN — ' : ''}applying ${TIER1.length} curated products\n`);

  // Resolve the language ids we write to once.
  const langs = await prisma.language.findMany({ where: { code: { in: Object.values(LOCALE_TO_CODE) } } });
  const langByCode = new Map(langs.map((l) => [l.code, l.id]));
  for (const code of Object.values(LOCALE_TO_CODE)) {
    if (!langByCode.has(code)) throw new Error(`Language ${code} not seeded — cannot continue.`);
  }

  const ledger = loadLedger();
  let applied = 0;
  let skippedMissing = 0;
  const missing: string[] = [];

  for (const item of TIER1) {
    const product = await prisma.mktProduct.findUnique({ where: { slug: item.slug }, select: { id: true, name: true } });
    if (!product) {
      missing.push(item.slug);
      skippedMissing++;
      console.log(`  ✗ ${item.slug} — no MktProduct with this slug (skipped)`);
      continue;
    }

    const hash = hashCopy(item);
    const doneLocales: string[] = [];

    for (const [loc, code] of Object.entries(LOCALE_TO_CODE) as Array<['en' | 'es', string]>) {
      const copy: LocaleCopy = item[loc];
      const languageId = langByCode.get(code)!;
      const data = {
        title: copy.title,
        normalizedTitle: normalize(copy.title),
        shortDescription: copy.short,
        description: copy.body,
        moderationStatus: 'APPROVED' as const,
        localizationNotes: PROVENANCE,
        reviewedAt: new Date(),
      };

      if (!DRY) {
        await prisma.entityLocalization.upsert({
          where: { entityType_entityId_languageId: { entityType: ENTITY_TYPE, entityId: product.id, languageId } },
          update: data,
          create: {
            entityType: ENTITY_TYPE,
            entityId: product.id,
            languageId,
            alternateTitles: [],
            sourceClaimIds: [],
            ...data,
          },
        });
      }
      doneLocales.push(code);
    }

    ledger[item.slug] = { locales: doneLocales, appliedAt: new Date().toISOString(), contentHash: hash };
    applied++;
    console.log(`  ✓ ${item.slug.padEnd(28)} ${doneLocales.join(', ')}  [${hash}]`);
  }

  if (!DRY) writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');

  console.log(`\n[content] ${DRY ? 'would apply' : 'applied'} ${applied} product(s); ${skippedMissing} missing slug(s).`);
  if (missing.length) console.log(`[content] missing: ${missing.join(', ')}`);
  console.log(`[content] ledger: ${LEDGER_PATH}${DRY ? ' (not written in dry run)' : ''}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
