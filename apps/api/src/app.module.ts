import { Module } from '@nestjs/common';
import { PrismaModule } from '@retail-os/db-postgres';
import { SyncController } from './sync/sync.controller.js';
import { SyncService } from './sync/sync.service.js';
import { HealthController } from './health/health.controller.js';
import { PaymentsController } from './payments/payments.controller.js';
import { MpOAuthService } from './payments/mp-oauth.service.js';
import { OnboardingController } from './onboarding/onboarding.controller.js';
import { CatalogModule } from './catalog/catalog.module.js';

@Module({
  imports: [
    PrismaModule, // global — PrismaService available in all feature modules
    CatalogModule,
  ],
  controllers: [SyncController, HealthController, PaymentsController, OnboardingController],
  providers: [SyncService, MpOAuthService],
})
export class AppModule {}
