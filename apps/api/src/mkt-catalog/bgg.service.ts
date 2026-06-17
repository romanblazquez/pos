import { Injectable, Logger } from '@nestjs/common';

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

interface ScraperGameDetail {
  bgg_id: number;
  name: string;
  description: string;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  min_age: number | null;
  play_time_minutes: number | null;
  image_url: string | null;
  rating: number | null;
  weight: number | null;
  designer: string | null;
  publisher: string | null;
  categories: string[];
  mechanics: string[];
}

// BGG's XML API (/thing, /search) now requires a registered application + token
// (BGG policy change, 2025-07-02) that this project doesn't have. Its HTML game
// pages aren't gated the same way, so apps/bgg-scraper scrapes those instead
// (see apps/bgg-scraper/src/main.ts's /game/:id, which reads the page's embedded
// GEEK.geekitemPreload data blob).
const SCRAPER_URL = process.env.BGG_SCRAPER_URL ?? 'http://localhost:3001';

function cleanDesc(raw: string): string {
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

@Injectable()
export class BggService {
  private readonly log = new Logger(BggService.name);

  /**
   * Not currently functional — BGG's /search XML API endpoint requires the same
   * registered application/token as /thing. Left in place for when that's set up;
   * callers (MktCatalogController's bgg/search route) will just get an empty result
   * until then.
   */
  async searchGames(_query: string): Promise<BggSearchResult[]> {
    this.log.warn('searchGames is unavailable: BGG XML API requires a registered application');
    return [];
  }

  async getGame(bggId: string): Promise<BggGame | null> {
    try {
      const res = await fetch(`${SCRAPER_URL}/game/${bggId}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { game: ScraperGameDetail };
      const g = data.game;

      return {
        bggId,
        name: g.name,
        description: cleanDesc(g.description),
        yearPublished: g.year_published,
        minPlayers: g.min_players,
        maxPlayers: g.max_players,
        minAge: g.min_age,
        playTimeMinutes: g.play_time_minutes,
        rating: g.rating,
        weight: g.weight,
        thumbnail: g.image_url,
        image: g.image_url,
        publisher: g.publisher,
        designer: g.designer,
        categories: g.categories,
        mechanics: g.mechanics,
      };
    } catch (err) {
      this.log.warn(`BGG fetch failed for ${bggId}: ${String(err)}`);
      return null;
    }
  }
}
