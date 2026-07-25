import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { CheckoutModule } from './checkout/checkout.module.js';
import { RankingsModule } from './rankings/rankings.module.js';
import { LoyaltyModule } from './loyalty/loyalty.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { MarketsModule } from './markets/markets.module.js';
import { ShelfModule } from './shelf/shelf.module.js';
import { RedisThrottlerStorage } from './common/redis-throttler.storage.js';
import { AnalyticsModule } from './analytics/analytics.module.js';

const throttlers = [{ ttl: 60_000, limit: 120, blockDuration: 60_000 }];
const useRedisThrottling = process.env.NODE_ENV === 'production'
  || process.env.REDIS_THROTTLE_ENABLED === 'true';
const throttlerConfig = {
  throttlers,
  getTracker: (request: Record<string, unknown>) => {
    const user = request.user as { sub?: string } | undefined;
    return `${String(request.ip ?? 'unknown')}:${user?.sub ?? 'anonymous'}`;
  },
  ...(useRedisThrottling ? { storage: new RedisThrottlerStorage() } : {}),
};

@Module({
  imports: [
    ThrottlerModule.forRoot(throttlerConfig),
    PrismaModule,    // @Global — PrismaService available everywhere
    SearchModule,    // @Global — TypesenseService available everywhere
    AuthModule,      // Global JWT guard + seller/customer auth endpoints
    CatalogModule,
    MarketplaceModule,
    MktCatalogModule,
    SellersModule,
    ConnectorsModule,
    CheckoutModule,
    RankingsModule,
    LoyaltyModule,
    CustomersModule,
    MarketsModule,
    ShelfModule,
    AnalyticsModule,
  ],
  controllers: [SyncController, HealthController, PaymentsController, OnboardingController],
  providers: [
    SyncService,
    MpOAuthService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
