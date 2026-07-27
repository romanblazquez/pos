/**
 * Pre-render the social cards whose set is small and fixed.
 *
 * Cards are generated on demand and cached on disk by the /og route, but that
 * cache lives in the container's tmpdir — a redeploy empties it, and the next
 * person to share a guide pays 2-3s of Satori render through a crawler that
 * gives up sooner. Guides, the guide hubs and category shelves are ~120 cards
 * across both locales, so there is no reason for any of them ever to be cold.
 *
 * Products are deliberately NOT warmed: 21,000 cards is hours of work for a set
 * where almost nothing is ever shared. Those rely on the disk cache plus the
 * share row's warm-on-intent, which builds the card while the shopper is still
 * reaching for the button.
 *
 * Run after a deploy:
 *   pnpm tsx tools/warm-og-cards.ts
 *   pnpm tsx tools/warm-og-cards.ts --origin http://192.168.1.109:8091
 *
 * Point it at the ORIGIN, not the CDN — warming Cloudflare's copy leaves the
 * container's own cache empty, which is the one that has to be warm when the
 * edge entry expires.
 */
import { THEMES } from '../apps/web/src/lib/themes.js';
import { allGuidesRaw, localizeGuide } from '../apps/web/src/lib/guides.js';
import { SEGMENTS, type Locale } from '../apps/web/src/lib/segments.js';

const LOCALES: Locale[] = ['es', 'en'];
/** One at a time by default: this box has four cores and the API to share. */
const CONCURRENCY = Number(process.env.WARM_CONCURRENCY ?? 2);

function originFromArgs(): string {
  const flag = process.argv.indexOf('--origin');
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1].replace(/\/$/, '');
  return process.env.WARM_ORIGIN?.replace(/\/$/, '') ?? 'http://192.168.1.109:8091';
}

function cardUrls(origin: string): string[] {
  const urls: string[] = [];
  for (const locale of LOCALES) {
    // The editorial hub, addressed by its own segment slug.
    urls.push(`${origin}/og/guide/${locale}/${SEGMENTS.guides[locale]}.jpg`);
    for (const guide of allGuidesRaw()) {
      const localized = localizeGuide(guide, locale);
      urls.push(`${origin}/og/guide/${locale}/${localized.slug}.jpg`);
    }
    for (const theme of THEMES) {
      urls.push(`${origin}/og/category/${locale}/${theme.slug[locale]}.jpg`);
    }
  }
  return [...new Set(urls)];
}

async function warm(url: string): Promise<{ url: string; status: number; ms: number; cache: string }> {
  const started = Date.now();
  try {
    const response = await fetch(url);
    // Drain the body: an undrained response can keep the socket open and the
    // run never settles.
    await response.arrayBuffer();
    return {
      url,
      status: response.status,
      ms: Date.now() - started,
      cache: response.headers.get('x-card-cache') ?? '-',
    };
  } catch (error) {
    return { url, status: 0, ms: Date.now() - started, cache: (error as Error).message.slice(0, 40) };
  }
}

async function main() {
  const origin = originFromArgs();
  const urls = cardUrls(origin);
  console.log(`Warming ${urls.length} cards at ${origin} (concurrency ${CONCURRENCY})\n`);

  let done = 0;
  let failed = 0;
  const queue = [...urls];
  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const result = await warm(next);
      done += 1;
      if (result.status !== 200) failed += 1;
      const path = result.url.slice(origin.length);
      console.log(
        `${String(done).padStart(3)}/${urls.length} ${String(result.status).padEnd(3)} ` +
        `${String(result.ms).padStart(5)}ms ${result.cache.padEnd(5)} ${path}`,
      );
    }
  });
  await Promise.all(workers);

  console.log(`\nDone. ${urls.length - failed} warmed, ${failed} failed.`);
  // Non-zero on failure so a deploy script can notice.
  if (failed) process.exitCode = 1;
}

main();
