import { Controller, Inject, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RankingSchedulerService } from './ranking-scheduler.service.js';
import { Roles } from '../auth/auth.guard.js';

@ApiTags('admin')
@Roles('admin')
@Controller('api/v1/admin/rankings')
export class RankingsController {
  constructor(
    @Inject(RankingSchedulerService)
    private readonly scheduler: RankingSchedulerService,
  ) {}

  @ApiOperation({ summary: 'Trigger a full ranking pass immediately' })
  @Post('trigger')
  trigger() {
    return this.scheduler.triggerNow();
  }
}
