import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@retail-os/db-postgres';
import { ConnectorSyncService } from './sync.service.js';

const QUEUE_NAME = 'connector-sync';

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

type SyncType = 'catalog' | 'inventory' | 'prices';

interface SyncJob {
  syncType: SyncType;
  sellerId: string;
}

const SCHEDULES: Record<SyncType, number> = {
  catalog:   4 * 60 * 60 * 1000,   // 4 h
  inventory: 5 * 60 * 1000,        // 5 min
  prices:    15 * 60 * 1000,       // 15 min
};

@Injectable()
export class SyncSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SyncSchedulerService.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    @Inject(PrismaService)        private readonly prisma: PrismaService,
    @Inject(ConnectorSyncService) private readonly sync: ConnectorSyncService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(QUEUE_NAME, { connection: redisConnection });

    this.worker = new Worker<SyncJob>(
      QUEUE_NAME,
      (job) => this.processJob(job),
      { connection: redisConnection, concurrency: 3 },
    );

    this.worker.on('completed', (job) =>
      this.log.log(`[${job.data.sellerId}] ${job.data.syncType} sync job completed`)
    );
    this.worker.on('failed', (job, err) =>
      this.log.error(`[${job?.data.sellerId}] ${job?.data.syncType} sync failed: ${err.message}`)
    );

    // Three recurring dispatchers — one per sync type.
    // Each fires on schedule and enqueues one job per connected seller.
    for (const [syncType, every] of Object.entries(SCHEDULES) as [SyncType, number][]) {
      await this.queue.upsertJobScheduler(
        `dispatch-${syncType}`,
        { every },
        { name: `dispatch-${syncType}`, data: { syncType, sellerId: '__dispatch__' } },
      );
    }

    this.log.log('Connector sync scheduler initialized');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Manually enqueue an immediate sync for a specific seller + type. */
  async triggerNow(sellerId: string, syncType: SyncType, force = false): Promise<{ jobId: string }> {
    const job = await this.queue.add(
      `manual-${syncType}`,
      { syncType, sellerId, force },
      { priority: 1 },
    );
    return { jobId: job.id ?? 'queued' };
  }

  // ─── Worker ──────────────────────────────────────────────────────────────────

  private async processJob(job: Job<SyncJob & { force?: boolean }>): Promise<void> {
    const { syncType, sellerId, force } = job.data;

    // Dispatch job: find all connected sellers and enqueue per-seller jobs
    if (sellerId === '__dispatch__') {
      await this.dispatchToSellers(syncType);
      return;
    }

    // Per-seller sync job
    switch (syncType) {
      case 'catalog':
        await this.sync.syncCatalog(sellerId, { force });
        break;
      case 'inventory':
        await this.sync.syncInventory(sellerId);
        break;
      case 'prices':
        await this.sync.syncPrices(sellerId);
        break;
    }
  }

  private async dispatchToSellers(syncType: SyncType): Promise<void> {
    const sellers = await this.prisma.seller.findMany({
      where: {
        connectorType: { not: null },
        connectorConfig: { not: Prisma.DbNull },
        status: { not: 'suspended' },
      },
      select: { id: true },
    });

    if (sellers.length === 0) return;

    await this.queue.addBulk(
      sellers.map((s) => ({
        name: `scheduled-${syncType}`,
        data: { syncType, sellerId: s.id },
      })),
    );

    this.log.log(`Dispatched ${syncType} sync for ${sellers.length} sellers`);
  }
}
