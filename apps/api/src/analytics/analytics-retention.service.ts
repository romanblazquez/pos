import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { AnalyticsService } from './analytics.service.js';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

@Injectable()
export class AnalyticsRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsRetentionService.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  async onModuleInit() {
    if (process.env.ANALYTICS_JOBS_ENABLED === 'false') return;
    this.queue = new Queue('analytics-operations', { connection });
    this.worker = new Worker('analytics-operations', (job: Job) => {
      if (job.name === 'analytics-retention') return this.analytics.runRetention();
      if (job.name === 'analytics-aggregate') return this.analytics.aggregateDay(new Date(Date.now() - 86_400_000));
      return Promise.resolve();
    }, { connection, concurrency: 1 });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Analytics job ${job?.id ?? 'unknown'} failed: ${error.message}`));
    await this.queue.upsertJobScheduler(
      'daily-analytics-retention',
      { pattern: '17 3 * * *' },
      { name: 'analytics-retention' },
    );
    await this.queue.upsertJobScheduler(
      'daily-analytics-aggregate',
      { pattern: '42 2 * * *' },
      { name: 'analytics-aggregate' },
    );
    this.logger.log('Daily analytics retention job registered');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
