import express, { type Request, type Response } from 'express';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import AdmZip from 'adm-zip';
import { parse as parseCsv } from 'csv-parse/sync';

// BGG sits behind Cloudflare's managed JS challenge. The stealth plugin patches
// the automation tells (navigator.webdriver, etc.) that the challenge checks for —
// without it, the challenge never clears, regardless of source IP.
chromium.use(StealthPlugin());

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

interface ScrapedGame {
  bgg_id: number | null;
  title: string;
  bgg_rank: number | null;
  year_published: number | null;
  thumbnail_url: string | null;
  bgg_url: string;
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// One Chromium instance for the process lifetime — launching is slow, contexts are cheap.
let browserPromise: Promise<Browser> | undefined;
function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = chromium.launch({ headless: true }) as unknown as Promise<Browser>;
  return browserPromise;
}

async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext();
}

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('https://boardgamegeek.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.click('a:has-text("Sign In")');
  await page.waitForSelector('input[name="username"], #inputUsername', { timeout: 10000 });
  await page.fill('input[name="username"], #inputUsername', username);
  await page.fill('input[name="password"], #inputPassword', password);
  await page.click('gg-login-form button.btn-primary:has-text("Sign In")');
  await page.waitForTimeout(3000);
}

async function scrapePage(page: Page, pageNum: number): Promise<ScrapedGame[]> {
  await page.goto(`https://boardgamegeek.com/browse/boardgame/page/${pageNum}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('tr[id^="row_"]', { timeout: 30000 });

  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[id^="row_"]');
    return Array.from(rows)
      .map((row) => {
        const rankEl = row.querySelector('.collection_rank');
        // Each row has two /boardgame/ links — a thumbnail anchor (no text) and the
        // title anchor (class="primary"). Scope to the title one explicitly.
        const linkEl = row.querySelector('a.primary[href*="/boardgame/"]');
        const yearMatch = row.textContent?.match(/\((\d{4})\)/) ?? null;
        const thumbEl = row.querySelector('img[src*="geekdo-images"]') as HTMLImageElement | null;

        if (!linkEl) return null;

        const href = linkEl.getAttribute('href') ?? '';
        const idMatch = href.match(/\/boardgame\/(\d+)/);

        return {
          bgg_id: idMatch ? parseInt(idMatch[1], 10) : null,
          title: linkEl.textContent?.trim() ?? '',
          bgg_rank: rankEl ? parseInt(rankEl.textContent?.trim() ?? '', 10) : null,
          year_published: yearMatch ? parseInt(yearMatch[1], 10) : null,
          thumbnail_url: thumbEl ? thumbEl.src : null,
          bgg_url: `https://boardgamegeek.com${href}`,
        };
      })
      .filter((g): g is ScrapedGame => g !== null && g.bgg_id !== null);
  });
}

interface RankedGame {
  bgg_id: number;
  name: string;
  year_published: number | null;
  rank: number | null;
  bayes_average: number | null;
  average: number | null;
  users_rated: number | null;
  is_expansion: boolean;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// BGG's per-item XML API (/thing, /search) now requires a registered application +
// token (BGG policy as of 2025-07-02) — not something we have. But BGG also publishes
// a daily CSV dump of every game with rank/rating data, downloadable while logged in,
// no registration required (https://boardgamegeek.com/data_dumps/bg_ranks). That's a
// far better fit anyway: one fetch gets the ~178k-game catalog instead of 1500+ paginated,
// Cloudflare-gated browse requests.
app.post('/ranks-dump', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  let context: BrowserContext | undefined;
  try {
    context = await newContext();
    const page = await context.newPage();

    await login(page, username, password);
    await page.goto('https://boardgamegeek.com/data_dumps/bg_ranks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Angular renders the download link client-side — domcontentloaded fires before
    // that, so wait for it explicitly instead of racing it.
    await page.waitForSelector('a[download]', { timeout: 15000 });
    const downloadUrl = await page.evaluate(() => document.querySelector('a[download]')?.getAttribute('href') ?? null);
    if (!downloadUrl) throw new Error('Download link not found on /data_dumps/bg_ranks — page layout may have changed');

    // The download link is a presigned S3 URL — no Cloudflare in front of it, plain fetch works.
    const zipRes = await fetch(downloadUrl);
    if (!zipRes.ok) throw new Error(`S3 dump fetch failed: ${zipRes.status}`);
    const zipBuf = Buffer.from(await zipRes.arrayBuffer());

    const zip = new AdmZip(zipBuf);
    const csvEntry = zip.getEntries().find((e) => e.entryName.endsWith('.csv'));
    if (!csvEntry) throw new Error('No CSV found in ranks dump ZIP');

    const records = parseCsv(csvEntry.getData().toString('utf8'), { columns: true, skip_empty_lines: true }) as Record<string, string>[];

    const games: RankedGame[] = records
      .map((r) => ({
        bgg_id: parseInt(r.id, 10),
        name: r.name,
        year_published: num(r.yearpublished),
        // BGG's dump uses rank=0 to mean "Not Ranked" — ranks start at 1, so 0 → null.
        rank: num(r.rank) || null,
        bayes_average: num(r.bayesaverage),
        average: num(r.average),
        users_rated: num(r.usersrated),
        is_expansion: r.is_expansion === '1',
      }))
      .filter((g) => Number.isFinite(g.bgg_id));

    res.json({ success: true, count: games.length, games });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (context) await context.close();
  }
});

interface GeekitemLink {
  name: string;
}

interface GeekitemData {
  item: {
    name?: string;
    description?: string;
    yearpublished?: string;
    minplayers?: string;
    maxplayers?: string;
    minplaytime?: string;
    maxplaytime?: string;
    minage?: string;
    imageurl?: string;
    links?: Record<string, GeekitemLink[]>;
    stats?: { average?: string; avgweight?: string };
  };
}

// BGG's game detail pages (plain HTML, no registration gate unlike /thing) embed a
// full structured data blob at window.GEEK.geekitemPreload — that's a far richer and
// more reliable source for description/image/designer/publisher than scraping rendered
// DOM text would be.
app.get('/game/:id', async (req: Request, res: Response) => {
  const id = req.params.id;

  let context: BrowserContext | undefined;
  try {
    context = await newContext();
    const page = await context.newPage();
    const response = await page.goto(`https://boardgamegeek.com/boardgame/${id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (!response || response.status() === 404) {
      res.status(404).json({ error: `BGG game ${id} not found` });
      return;
    }

    const data = await page.evaluate(() => (window as unknown as { GEEK?: { geekitemPreload?: GeekitemData } }).GEEK?.geekitemPreload);
    const item = data?.item;
    if (!item) {
      res.status(502).json({ error: 'geekitemPreload not found on page — BGG layout may have changed' });
      return;
    }

    const linkNames = (type: string) => (item.links?.[type] ?? []).map((l) => l.name);

    res.json({
      success: true,
      game: {
        bgg_id: parseInt(id, 10),
        name: item.name ?? '',
        description: item.description ?? '',
        year_published: num(item.yearpublished),
        min_players: num(item.minplayers),
        max_players: num(item.maxplayers),
        min_age: num(item.minage),
        play_time_minutes: num(item.maxplaytime) ?? num(item.minplaytime),
        image_url: item.imageurl ?? null,
        rating: num(item.stats?.average),
        weight: num(item.stats?.avgweight),
        designer: linkNames('boardgamedesigner')[0] ?? null,
        publisher: linkNames('boardgamepublisher')[0] ?? null,
        categories: linkNames('boardgamecategory').slice(0, 6),
        mechanics: linkNames('boardgamemechanic').slice(0, 8),
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (context) await context.close();
  }
});

// Login to BGG and return session cookies
app.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  let context: BrowserContext | undefined;
  try {
    context = await newContext();
    const page = await context.newPage();

    await login(page, username, password);

    const cookies = await context.cookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    res.json({ success: true, cookies: cookieString, cookieCount: cookies.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (context) await context.close();
  }
});

// Scrape a single BGG browse page with cookies
app.post('/scrape', async (req: Request, res: Response) => {
  const { page: pageNum = 1, cookies } = req.body;

  let context: BrowserContext | undefined;
  try {
    context = await newContext();

    if (cookies) {
      const cookieList = (cookies as string).split('; ').map((c) => {
        const [name, value] = c.split('=');
        return { name, value, domain: '.boardgamegeek.com', path: '/' };
      });
      await context.addCookies(cookieList);
    }

    const page = await context.newPage();
    const games = await scrapePage(page, pageNum);

    res.json({ success: true, page: pageNum, games, count: games.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (context) await context.close();
  }
});

// Combined: login + scrape a fixed number of pages
app.post('/scrape-with-login', async (req: Request, res: Response) => {
  const { username, password, startPage = 1, pages = 1 } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  let context: BrowserContext | undefined;
  try {
    context = await newContext();
    const page = await context.newPage();

    await login(page, username, password);

    const allGames: ScrapedGame[] = [];
    for (let i = 0; i < pages; i++) {
      const pageNum = startPage + i;
      const games = await scrapePage(page, pageNum);
      allGames.push(...games);
    }

    res.json({ success: true, startPage, pagesScraped: pages, games: allGames, totalCount: allGames.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (context) await context.close();
  }
});

// Login + scrape every browse page until BGG stops returning games (or maxPages is hit)
app.post('/scrape-all', async (req: Request, res: Response) => {
  const { username, password, startPage = 1, maxPages = 1000, delayMs = 1500 } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  let context: BrowserContext | undefined;
  try {
    context = await newContext();
    const page = await context.newPage();

    await login(page, username, password);

    const allGames: ScrapedGame[] = [];
    let pageNum = startPage;
    let pagesScraped = 0;

    while (pagesScraped < maxPages) {
      const games = await scrapePage(page, pageNum);
      if (games.length === 0) break;

      allGames.push(...games);
      pagesScraped++;
      pageNum++;

      if (delayMs > 0) await page.waitForTimeout(delayMs);
    }

    res.json({
      success: true,
      startPage,
      pagesScraped,
      lastPageReached: pageNum - 1,
      games: allGames,
      totalCount: allGames.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (context) await context.close();
  }
});

app.listen(PORT, () => {
  console.log(`BGG Scraper API running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  if (browserPromise) await (await browserPromise).close();
  process.exit(0);
});
