import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';

type JobCounts = Record<string, number>;
import { BggScraperClientService } from './bgg-scraper-client.service.js';
import { MktCatalogService } from './mkt-catalog.service.js';

const DISCOVERY_QUEUE = 'bgg-discovery';
const IMPORT_QUEUE = 'bgg-import';

// Re-authenticate periodically in case the BGG session expires during a long run.
const RELOGIN_EVERY_PAGES = 100;
// BGG XML API guidance: roughly one request per second.
const IMPORT_RATE_LIMIT_MS = 1100;

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

interface DiscoveryJobData {
  pageNum: number;
  cookies?: string;
  pagesSinceLogin: number;
}

interface ImportJobData {
  bggId: string;
}

export interface FullCatalogImportStatus {
  running: boolean;
  total: number;
  imported: number;
  skipped: number;
  error?: string;
}

@Injectable()
export class BggDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BggDiscoveryService.name);
  private discoveryQueue!: Queue<DiscoveryJobData>;
  private importQueue!: Queue<ImportJobData>;
  private discoveryWorker!: Worker<DiscoveryJobData>;
  private importWorker!: Worker<ImportJobData>;
  private fullCatalogStatus: FullCatalogImportStatus = { running: false, total: 0, imported: 0, skipped: 0 };

  constructor(
    @Inject(BggScraperClientService) private readonly scraper: BggScraperClientService,
    @Inject(MktCatalogService) private readonly mktCatalog: MktCatalogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.discoveryQueue = new Queue(DISCOVERY_QUEUE, { connection: redisConnection });
    this.importQueue = new Queue(IMPORT_QUEUE, { connection: redisConnection });

    this.discoveryWorker = new Worker<DiscoveryJobData>(
      DISCOVERY_QUEUE,
      (job) => this.processDiscoveryJob(job),
      { connection: redisConnection, concurrency: 1 },
    );
    this.discoveryWorker.on('failed', (job, err) =>
      this.log.error(`Discovery page ${job?.data.pageNum} failed: ${err.message}`),
    );

    this.importWorker = new Worker<ImportJobData>(
      IMPORT_QUEUE,
      (job) => this.mktCatalog.importByBggId(job.data.bggId, 'pending').then(() => undefined),
      { connection: redisConnection, concurrency: 1, limiter: { max: 1, duration: IMPORT_RATE_LIMIT_MS } },
    );
    this.importWorker.on('failed', (job, err) =>
      this.log.error(`Import of BGG ${job?.data.bggId} failed: ${err.message}`),
    );

    this.log.log('BGG discovery/import workers initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.discoveryWorker?.close();
    await this.importWorker?.close();
    await this.discoveryQueue?.close();
    await this.importQueue?.close();
  }

  /** Kick off discovery from the given browse page (default: the very first page). */
  async startDiscovery(startPage = 1): Promise<{ started: boolean; startPage: number }> {
    await this.discoveryQueue.add(
      'discover',
      { pageNum: startPage, pagesSinceLogin: RELOGIN_EVERY_PAGES },
      { jobId: `discover-${startPage}` },
    );
    return { started: true, startPage };
  }

  async status(): Promise<{ discovery: JobCounts; import: JobCounts }> {
    return {
      discovery: await this.discoveryQueue.getJobCounts(),
      import: await this.importQueue.getJobCounts(),
    };
  }

  /**
   * Bulk-import BGG's full ranks dump (~178k games, rank/rating data only — no
   * description/images/designer, which need the registration-gated XML API).
   * Runs in the background; poll fullCatalogImportStatus() for progress.
   */
  startFullCatalogImport(): { started: boolean } {
    if (this.fullCatalogStatus.running) return { started: false };
    const { username, password } = this.credentials();
    this.fullCatalogStatus = { running: true, total: 0, imported: 0, skipped: 0 };
    this.runFullCatalogImport(username, password).catch((err: Error) => {
      this.fullCatalogStatus.running = false;
      this.fullCatalogStatus.error = err.message;
      this.log.error(`Full catalog import failed: ${err.message}`);
    });
    return { started: true };
  }

  fullCatalogImportStatus(): FullCatalogImportStatus {
    return this.fullCatalogStatus;
  }

  private async runFullCatalogImport(username: string, password: string): Promise<void> {
    this.log.log('Fetching BGG ranks dump...');
    const games = await this.scraper.ranksDump(username, password);
    this.fullCatalogStatus.total = games.length;
    this.log.log(`Got ${games.length} games — importing...`);

    const result = await this.mktCatalog.importFromRanksDump(games, (progress) => {
      this.fullCatalogStatus.imported = progress.imported;
      this.fullCatalogStatus.skipped = progress.skipped;
    });

    this.fullCatalogStatus.imported = result.imported;
    this.fullCatalogStatus.skipped = result.skipped;
    this.fullCatalogStatus.running = false;
    this.log.log(`Full catalog import complete: ${result.imported} imported, ${result.skipped} skipped`);
  }

  private credentials(): { username: string; password: string } {
    const username = process.env.BGG_USERNAME;
    const password = process.env.BGG_PASSWORD;
    if (!username || !password) {
      throw new Error('BGG_USERNAME / BGG_PASSWORD not configured');
    }
    return { username, password };
  }

  private async processDiscoveryJob(job: Job<DiscoveryJobData>): Promise<{ done: boolean; pageNum: number; found?: number }> {
    let { pageNum, cookies, pagesSinceLogin } = job.data;

    if (!cookies || pagesSinceLogin >= RELOGIN_EVERY_PAGES) {
      const { username, password } = this.credentials();
      cookies = await this.scraper.login(username, password);
      pagesSinceLogin = 0;
    }

    const games = await this.scraper.scrapePage(pageNum, cookies);

    if (games.length === 0) {
      this.log.log(`Discovery finished — no games found on page ${pageNum}`);
      return { done: true, pageNum };
    }

    await this.importQueue.addBulk(
      games.map((g) => ({
        name: 'import',
        data: { bggId: String(g.bgg_id) },
        opts: {
          jobId: `import-${g.bgg_id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      })),
    );

    await this.discoveryQueue.add(
      'discover',
      { pageNum: pageNum + 1, cookies, pagesSinceLogin: pagesSinceLogin + 1 },
      { jobId: `discover-${pageNum + 1}`, delay: 1500 },
    );

    this.log.log(`Page ${pageNum}: found ${games.length} games, queued for import`);
    return { done: false, pageNum, found: games.length };
  }
}
