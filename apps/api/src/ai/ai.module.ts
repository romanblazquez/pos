import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiUsageService } from './ai-usage.service.js';
import { AiUsageController } from './ai-usage.controller.js';

@Module({
  controllers: [AiUsageController],
  providers: [AiService, AiUsageService],
  exports: [AiService, AiUsageService],
})
export class AiModule {}
