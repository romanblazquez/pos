// Category shelf art pipeline — masters -> responsive AVIF/WebP (design system §06).
//
// Regenerates every derivative under apps/web/public/categories/ from the master
// renders. Idempotent: safe to re-run, overwrites in place.
//
//   node tools/media/build-category-art.mjs --src /path/to/masters
//
// The masters are ~2.3MB PNGs (1448x1086) and are NOT committed — they're build
// inputs, not artefacts. Archive them alongside the design project; this script
// plus `MASTERS` below is the record of which render belongs to which shelf.
//
// Outputs per shelf, in both AVIF and WebP (AVIF ~50% smaller; WebP is the
// fallback for anything that can't decode it):
//   <key>-360.webp   card tile, 1x desktop / 2x mobile   ([shelf] 1:1)
//   <key>.webp       card tile, 2x desktop               ([shelf] 1:1)
//   <key>-hero.webp  landing hero                        ([hero] 16:9)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const OUT = resolve(import.meta.dirname, '../../apps/web/public/categories');

const srcFlag = process.argv.indexOf('--src');
const SRC = srcFlag > -1 ? process.argv[srcFlag + 1] : null;
if (!SRC) {
  console.error('usage: node tools/media/build-category-art.mjs --src <masters-dir>');
  process.exit(1);
}

/** Master render -> shelf key. Each matched to the shelf's §06 art-direction line. */
const MASTERS = {
  '11912b6a-1000021440.png': 'two-player',   // two meeples facing across a bridged river
  '67f863eb-1000021441.png': 'strategy',     // modular hex map, worker, cubes, tracks
  '44c0dd46-1000021442.png': 'thematic',     // unfolding map, compass, explorers
  '4af64800-1000021443.png': 'coop',         // distinct pieces converge on a shared goal
  '8281e316-1000021444.png': 'wargame',      // fronts, flanks, arrows over hex terrain
  'a92314c7-1000021445.png': 'euro',         // cubes, tracks, production chains
  '75ec5799-1000021446.png': 'fantasy',      // castle, dragon, runes, wizards
  '875ddb9c-1000021447.png': 'card',         // a fan of cards in motion
  '73fdfed8-1000021448.png': 'party',        // meeples, speech bubbles, hourglass
  '977cd74d-1000021449.png': 'dice',         // dice in the air before the result
  '714e4dfd-1000021450.png': 'horror',       // haunted mansion, moonlight, investigators
  '5ea0b8bb-1000021451.png': 'abstract',     // pure form, no theme
  '426a96fa-1000021452.png': 'scifi',        // orbits, colonies, the long voyage
  '9961ad91-1000021453.png': 'deckbuilding', // faction decks + market row
  '0d21513e-1000021454.png': 'solo',         // one position, one warm light
  'a88a3d4c-1000021455.png': 'campaign',     // sealed envelopes, campaign log, chapters
};

// Tiles render 175px (mobile 2-up) to 286px (desktop 4-up), so 360/640 covers
// every slot at 1x and 2x without over-serving. The hero spans the 1200px
// container; 1100w is honest at 1x and acceptable at 2x for a decorative band.
const VARIANTS = [
  { suffix: '-360', w: 360, h: 360, webp: 76, avif: 50 },
  { suffix: '', w: 640, h: 640, webp: 78, avif: 52 },
  { suffix: '-hero', w: 1100, h: 619, webp: 74, avif: 48 },
];

mkdirSync(OUT, { recursive: true });

let totals = { webp: 0, avif: 0 };
for (const [file, key] of Object.entries(MASTERS)) {
  const src = resolve(SRC, file);
  const line = [key.padEnd(13)];
  for (const v of VARIANTS) {
    const pipe = () => sharp(src).resize(v.w, v.h, { fit: 'cover', position: 'centre' });
    const w = await pipe().webp({ quality: v.webp }).toFile(`${OUT}/${key}${v.suffix}.webp`);
    const a = await pipe().avif({ quality: v.avif, effort: 4 }).toFile(`${OUT}/${key}${v.suffix}.avif`);
    totals.webp += w.size;
    totals.avif += a.size;
    line.push(`${(v.suffix || '-640').padEnd(5)} ${String(Math.round(a.size / 1024)).padStart(3)}/${String(Math.round(w.size / 1024)).padStart(3)}KB`);
  }
  console.log(line.join('  '));
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`\n${Object.keys(MASTERS).length} shelves x ${VARIANTS.length} sizes`);
console.log(`  avif total ${kb(totals.avif)}   webp total ${kb(totals.webp)}   (avif is ${Math.round((1 - totals.avif / totals.webp) * 100)}% smaller)`);
console.log(`  note: a page loads ONE size per tile, not all of them.`);
