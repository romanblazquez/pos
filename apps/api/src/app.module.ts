import { Module } from '@nestjs/common';
import { PrismaModule } from '@retail-os/db-postgres';
import { SyncController } from './sync/sync.controller.js';
import { SyncService } from './sync/sync.service.js';
import { HealthController } from './health/health.controller.js';
import { PaymentsController } from './payments/payments.controller.js';
import { MpOAuthService } from './payments/mp-oauth.service.js';
import { OnboardingController } from './onboarding/onboarding.controller.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { SearchModule } from './search/search.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { MktCatalogModule } from './mkt-catalog/mkt-catalog.module.js';
import { SellersModule } from './sellers/sellers.module.js';
import { ConnectorsModule } from './connectors/connectors.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    PrismaModule,    // @Global — PrismaService available everywhere
    SearchModule,    // @Global — TypesenseService available everywhere
    AuthModule,      // Global JWT guard + seller/customer auth endpoints
    CatalogModule,
    MarketplaceModule,
    MktCatalogModule,
    SellersModule,
    ConnectorsModule,
  ],
  controllers: [SyncController, HealthController, PaymentsController, OnboardingController],
  providers: [SyncService, MpOAuthService],
})
export class AppModule {}
