import { Module } from '@nestjs/common';
import { PrismaModule } from '@retail-os/db-postgres';
import { RankingSchedulerService } from './ranking-scheduler.service.js';
import { RankingsController } from './rankings.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [RankingsController],
  providers: [RankingSchedulerService],
  exports: [RankingSchedulerService],
})
export class RankingsModule {}
