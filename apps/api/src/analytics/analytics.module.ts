import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsRetentionService } from './analytics-retention.service.js';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRetentionService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
