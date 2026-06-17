import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

// Subset of BGG game data we care about
export interface BggGame {
  bggId: string;
  name: string;
  description: string;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minAge: number | null;
  playTimeMinutes: number | null;
  rating: number | null;
  weight: number | null; // complexity 1-5
  thumbnail: string | null;
  image: string | null;
  publisher: string | null;
  designer: string | null;
  categories: string[];
  mechanics: string[];
}

export interface BggSearchResult {
  bggId: string;
  name: string;
  yearPublished: number | null;
}

// BGG's XML API sits behind the same Cloudflare challenge as its HTML pages —
// a plain fetch() gets a 401. Route through the bgg-scraper's stealth-browser
// proxy instead, which actually clears the challenge.
const BGG_API = `${process.env.BGG_SCRAPER_URL ?? 'http://localhost:3001'}/xmlapi2`;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function num(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) || n === 0 ? null : n;
}

function firstStr(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstStr(v[0]);
  if (typeof v === 'object' && v !== null && '#text' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)['#text']);
  }
  return String(v);
}

@Injectable()
export class BggService {
  private readonly log = new Logger(BggService.name);

  async searchGames(query: string): Promise<BggSearchResult[]> {
    const url = `${BGG_API}/search?query=${encodeURIComponent(query)}&type=boardgame&exact=0`;
    try {
      const res = await fetch(url);
      const xml = await res.text();
      const data = parser.parse(xml) as Record<string, unknown>;
      const items = (data as { items?: { item?: unknown } }).items;
      if (!items) return [];
      const raw = items.item;
      const arr: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return arr.slice(0, 20).map((item) => {
        const i = item as Record<string, unknown>;
        const nameVal = i['name'] as Record<string, unknown> | Array<Record<string, unknown>>;
        const primary = Array.isArray(nameVal)
          ? nameVal.find((n) => n['@_type'] === 'primary') ?? nameVal[0]
          : nameVal;
        return {
          bggId: String(i['@_id']),
          name: String(primary?.['@_value'] ?? ''),
          yearPublished: num((i['yearpublished'] as Record<string, unknown>)?.['@_value']),
        };
      });
    } catch (err) {
      this.log.warn(`BGG search failed: ${String(err)}`);
      return [];
    }
  }

  async getGame(bggId: string): Promise<BggGame | null> {
    const url = `${BGG_API}/thing?id=${bggId}&stats=1`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const xml = await res.text();
      const data = parser.parse(xml) as Record<string, unknown>;
      const items = data['items'] as Record<string, unknown> | undefined;
      if (!items) return null;
      const item = items['item'] as Record<string, unknown>;
      if (!item) return null;

      // Name: primary preferred
      const nameRaw = item['name'];
      const names: Array<Record<string, unknown>> = Array.isArray(nameRaw) ? nameRaw : [nameRaw as Record<string, unknown>];
      const primaryName = names.find((n) => n['@_type'] === 'primary') ?? names[0];

      // Links: publishers, designers, categories, mechanics
      const linksRaw = item['link'];
      const links: Array<Record<string, unknown>> = Array.isArray(linksRaw) ? linksRaw : linksRaw ? [linksRaw as Record<string, unknown>] : [];
      const byType = (type: string) =>
        links.filter((l) => l['@_type'] === type).map((l) => String(l['@_value']));

      // Stats
      const stats = item['statistics'] as Record<string, unknown> | undefined;
      const ratings = stats?.['ratings'] as Record<string, unknown> | undefined;
      const ratingVal = (ratings?.['average'] as Record<string, unknown>)?.['@_value'];
      const weightVal = (ratings?.['averageweight'] as Record<string, unknown>)?.['@_value'];

      const poll = item['poll'];
      const polls: Array<Record<string, unknown>> = Array.isArray(poll) ? poll : poll ? [poll as Record<string, unknown>] : [];
      const playersPoll = polls.find((p) => p['@_name'] === 'suggested_numplayers');
      void playersPoll; // used for future player count analysis

      return {
        bggId,
        name: String(primaryName?.['@_value'] ?? ''),
        description: this.cleanDesc(firstStr(item['description']) ?? ''),
        yearPublished: num((item['yearpublished'] as Record<string, unknown>)?.['@_value']),
        minPlayers: num((item['minplayers'] as Record<string, unknown>)?.['@_value']),
        maxPlayers: num((item['maxplayers'] as Record<string, unknown>)?.['@_value']),
        minAge: num((item['minage'] as Record<string, unknown>)?.['@_value']),
        playTimeMinutes: num((item['playingtime'] as Record<string, unknown>)?.['@_value']),
        rating: num(ratingVal),
        weight: num(weightVal),
        thumbnail: firstStr(item['thumbnail']),
        image: firstStr(item['image']),
        publisher: byType('boardgamepublisher')[0] ?? null,
        designer: byType('boardgamedesigner')[0] ?? null,
        categories: byType('boardgamecategory').slice(0, 6),
        mechanics: byType('boardgamemechanic').slice(0, 8),
      };
    } catch (err) {
      this.log.warn(`BGG fetch failed for ${bggId}: ${String(err)}`);
      return null;
    }
  }

  private cleanDesc(raw: string): string {
    return raw
      .replace(/&#10;/g, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&rsquo;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 2000);
  }
}
