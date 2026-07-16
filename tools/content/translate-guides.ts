// Build-time editorial auto-translation. For every guide, translate its authored
// (original-locale) content into every OTHER locale with Google Translate, and
// write the result to apps/web/src/content/editorial/translations.gen.json, which
// the guide loader reads. This is what makes "every editorial is auto-translated,
// regardless of its original language" true. See docs/content-seo/PLAYBOOK.md §9.
//
// Idempotent + cheap: translate.ts caches every string on disk, so re-runs only
// hit the network for genuinely new/changed text. A locale that already has a
// HUMAN-reviewed translation in the guide module is skipped (the human wins).
//
// Usage:  pnpm tsx tools/content/translate-guides.ts

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allGuidesRaw } from '../../apps/web/src/lib/guides.js';
import type { Guide, GuideContent } from '../../apps/web/src/lib/guides.js';
import { translateText, translateAll, saveCache } from './translate.js';

const LOCALES = ['es', 'en'] as const;
type Locale = (typeof LOCALES)[number];

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../../apps/web/src/content/editorial/translations.gen.json');

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** The authored content of a guide (its base fields are always original-locale). */
function originalContent(g: Guide): GuideContent {
  const { slug, title, description, intro, picks, sections, faq } = g;
  return { slug, title, description, intro, picks, sections, faq };
}

async function translateContent(src: GuideContent, from: Locale, to: Locale): Promise<GuideContent> {
  // MT sometimes appends a full stop to a headline; titles never end in one.
  const title = (await translateText(src.title, from, to)).replace(/\s*[.。]\s*$/, '').trim();
  return {
    slug: slugify(title),
    title,
    description: await translateText(src.description, from, to),
    intro: await translateAll(src.intro, from, to),
    picks: await Promise.all(
      src.picks.map(async (p) => ({ gameSlug: p.gameSlug, blurb: await translateText(p.blurb, from, to) })),
    ),
    sections: src.sections
      ? await Promise.all(
          src.sections.map(async (s) => ({
            heading: await translateText(s.heading, from, to),
            paragraphs: await translateAll(s.paragraphs, from, to),
          })),
        )
      : undefined,
    faq: src.faq
      ? await Promise.all(
          src.faq.map(async (f) => ({ q: await translateText(f.q, from, to), a: await translateText(f.a, from, to) })),
        )
      : undefined,
  };
}

async function main() {
  const out: Record<string, Partial<Record<Locale, GuideContent>>> = {};
  let translated = 0;
  let skipped = 0;

  for (const guide of allGuidesRaw()) {
    const original = (guide.originalLocale ?? 'es') as Locale;
    const src = originalContent(guide);
    out[guide.slug] = {};

    for (const to of LOCALES) {
      if (to === original) continue;
      if (guide.translations?.[to]) {
        skipped++;
        console.log(`  – ${guide.slug} → ${to}: human translation present, skipping MT`);
        continue;
      }
      process.stdout.write(`  · ${guide.slug} → ${to} …`);
      out[guide.slug]![to] = await translateContent(src, original, to);
      translated++;
      console.log(' done');
    }
  }

  saveCache();
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`\n[translate] machine-translated ${translated} guide-locale(s); ${skipped} skipped (human override).`);
  console.log(`[translate] wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
