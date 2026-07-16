// Google Translate helper for the editorial layer. Every editorial is authored in
// one language and auto-translated into the others by this module (see
// docs/content-seo/PLAYBOOK.md §9). Translations are CACHED on disk keyed by a
// hash of (from,to,text) so re-runs are free and deterministic, and the endpoint
// is never hit twice for the same string. This is a build-time tool — never call
// it at request time.
//
// Uses the free translate_a/single endpoint (no key). If that ever stops working,
// swap `rawTranslate` for a keyed Cloud Translation call or a local py fallback;
// the cache and callers stay unchanged.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, 'translations-cache.json');

type Cache = Record<string, string>;
let cache: Cache | null = null;

function loadCache(): Cache {
  if (cache) return cache;
  cache = existsSync(CACHE_PATH) ? (JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Cache) : {};
  return cache;
}

export function saveCache(): void {
  if (cache) writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}

function key(from: string, to: string, text: string): string {
  return createHash('sha1').update(`${from}|${to}|${text}`).digest('hex');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rawTranslate(text: string, from: string, to: string): Promise<string> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx' +
    `&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`translate ${from}->${to} failed: ${res.status}`);
  const data = (await res.json()) as [Array<[string, string]>, ...unknown[]];
  // data[0] is an array of [translatedSegment, originalSegment, ...]; join segments.
  return (data[0] ?? []).map((seg) => seg[0]).join('');
}

/**
 * Translate one string, using the on-disk cache. Locales are BCP-47-ish
 * ('es'/'en'); we pass the base language to the endpoint. Empty/whitespace and
 * cache hits never hit the network.
 */
export async function translateText(text: string, from: string, to: string): Promise<string> {
  if (from === to || !text.trim()) return text;
  const c = loadCache();
  const k = key(from, to, text);
  if (c[k] !== undefined) return c[k];
  const out = await rawTranslate(text, from, to);
  c[k] = out;
  await sleep(120); // be gentle on the free endpoint
  return out;
}

/** Translate an array of strings in order. */
export function translateAll(texts: string[], from: string, to: string): Promise<string[]> {
  return texts.reduce<Promise<string[]>>(
    async (accP, t) => {
      const acc = await accP;
      acc.push(await translateText(t, from, to));
      return acc;
    },
    Promise.resolve([]),
  );
}
