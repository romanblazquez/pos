import express, { type Request, type Response } from 'express';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
// Steel browser exposes its CDP/WebSocket on the same port as its HTTP API (3000).
const STEEL_CDP = process.env.STEEL_CDP || 'ws://localhost:3000';

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

async function connect(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.connectOverCDP(STEEL_CDP);
  const context = browser.contexts()[0] || (await browser.newContext());
  return { browser, context };
}

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('https://boardgamegeek.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('a:has-text("Sign In")');
  await page.waitForSelector('input[name="username"], #inputUsername', { timeout: 10000 });
  await page.fill('input[name="username"], #inputUsername', username);
  await page.fill('input[name="password"], #inputPassword', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function scrapePage(page: Page, pageNum: number): Promise<ScrapedGame[]> {
  await page.goto(`https://boardgamegeek.com/browse/boardgame/page/${pageNum}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr[id^="row_"]');
    return Array.from(rows)
      .map((row) => {
        const rankEl = row.querySelector('.collection_rank');
        const linkEl = row.querySelector('a[href*="/boardgame/"]');
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

// Login to BGG and return session cookies
app.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  let browser: Browser | undefined;
  try {
    const conn = await connect();
    browser = conn.browser;
    const { context } = conn;
    const page = await context.newPage();

    await login(page, username, password);

    const cookies = await context.cookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    await page.close();

    res.json({ success: true, cookies: cookieString, cookieCount: cookies.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (browser) await browser.close();
  }
});

// Scrape a single BGG browse page with cookies
app.post('/scrape', async (req: Request, res: Response) => {
  const { page: pageNum = 1, cookies } = req.body;

  let browser: Browser | undefined;
  try {
    const conn = await connect();
    browser = conn.browser;
    const { context } = conn;

    if (cookies) {
      const cookieList = (cookies as string).split('; ').map((c) => {
        const [name, value] = c.split('=');
        return { name, value, domain: '.boardgamegeek.com', path: '/' };
      });
      await context.addCookies(cookieList);
    }

    const page = await context.newPage();
    const games = await scrapePage(page, pageNum);
    await page.close();

    res.json({ success: true, page: pageNum, games, count: games.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (browser) await browser.close();
  }
});

// Combined: login + scrape a fixed number of pages
app.post('/scrape-with-login', async (req: Request, res: Response) => {
  const { username, password, startPage = 1, pages = 1 } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  let browser: Browser | undefined;
  try {
    const conn = await connect();
    browser = conn.browser;
    const { context } = conn;
    const page = await context.newPage();

    await login(page, username, password);

    const allGames: ScrapedGame[] = [];
    for (let i = 0; i < pages; i++) {
      const pageNum = startPage + i;
      const games = await scrapePage(page, pageNum);
      allGames.push(...games);
    }

    await page.close();

    res.json({ success: true, startPage, pagesScraped: pages, games: allGames, totalCount: allGames.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (browser) await browser.close();
  }
});

// Login + scrape every browse page until BGG stops returning games (or maxPages is hit)
app.post('/scrape-all', async (req: Request, res: Response) => {
  const { username, password, startPage = 1, maxPages = 1000, delayMs = 1500 } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  let browser: Browser | undefined;
  try {
    const conn = await connect();
    browser = conn.browser;
    const { context } = conn;
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

    await page.close();

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
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`BGG Scraper API running on port ${PORT}`);
  console.log(`Steel CDP: ${STEEL_CDP}`);
});
