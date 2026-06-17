import { Injectable } from '@nestjs/common';

export interface ScrapedListGame {
  bgg_id: number;
  title: string;
  bgg_rank: number | null;
  year_published: number | null;
}

export interface RankedGame {
  bgg_id: number;
  name: string;
  year_published: number | null;
  rank: number | null;
  bayes_average: number | null;
  average: number | null;
  users_rated: number | null;
  is_expansion: boolean;
}

const BASE_URL = process.env.BGG_SCRAPER_URL ?? 'http://localhost:3001';

/** HTTP client for the apps/bgg-scraper Playwright/Steel service. */
@Injectable()
export class BggScraperClientService {
  async login(username: string, password: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(`bgg-scraper login failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { cookies: string };
    return data.cookies;
  }

  async scrapePage(pageNum: number, cookies: string): Promise<ScrapedListGame[]> {
    const res = await fetch(`${BASE_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: pageNum, cookies }),
    });
    if (!res.ok) throw new Error(`bgg-scraper scrape failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { games: ScrapedListGame[] };
    return data.games;
  }

  /**
   * Full BGG catalog (~178k games) with rank/rating data — one request, no pagination.
   * Pass `cookie` (a raw `Cookie:` header from an already-authenticated browser session)
   * to skip the login-form automation entirely — useful when BGG's bot detection blocks
   * the headless login flow. Falls back to username/password form-login otherwise.
   */
  async ranksDump(auth: { username?: string; password?: string; cookie?: string }): Promise<RankedGame[]> {
    const res = await fetch(`${BASE_URL}/ranks-dump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auth),
    });
    if (!res.ok) throw new Error(`bgg-scraper ranks-dump failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { games: RankedGame[] };
    return data.games;
  }
}
