-- Public marketplace markets, their language×market locales, and append-only FX.
--
-- Named `commerce_market` rather than `market` because `marketplace` already
-- means an external marketplace we ingest from, and `tenant_market` is retail-os
-- tenant configuration. See docs/adr/0007-language-market-separation.md.

CREATE TABLE "commerce_market" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "canonicalCurrency" CHAR(3) NOT NULL,
    "displayCurrencies" TEXT[],
    "defaultLanguage" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "taxMode" TEXT NOT NULL DEFAULT 'inclusive',
    "offerFreshnessHours" INTEGER NOT NULL DEFAULT 72,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "commerce_market_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commerce_market_code_key" ON "commerce_market"("code");
CREATE INDEX "commerce_market_active_indexable_sortOrder_idx" ON "commerce_market"("active", "indexable", "sortOrder");
CREATE INDEX "commerce_market_countryCode_active_idx" ON "commerce_market"("countryCode", "active");

CREATE TABLE "commerce_market_locale" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "localeCode" TEXT NOT NULL,
    "urlPrefix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "commerce_market_locale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commerce_market_locale_urlPrefix_key" ON "commerce_market_locale"("urlPrefix");
CREATE UNIQUE INDEX "commerce_market_locale_marketId_languageCode_key" ON "commerce_market_locale"("marketId", "languageCode");
CREATE INDEX "commerce_market_locale_active_indexable_idx" ON "commerce_market_locale"("active", "indexable");

-- Append-only: a displayed converted price must stay explainable for as long as
-- the price history referencing it. Never UPDATE or DELETE rows here.
CREATE TABLE "exchange_rate_snapshot" (
    "id" TEXT NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL,
    "quoteCurrency" CHAR(3) NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "provider" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exchange_rate_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exchange_rate_snapshot_baseCurrency_quoteCurrency_provider__key"
    ON "exchange_rate_snapshot"("baseCurrency", "quoteCurrency", "provider", "effectiveAt");
CREATE INDEX "exchange_rate_snapshot_baseCurrency_quoteCurrency_effective_idx"
    ON "exchange_rate_snapshot"("baseCurrency", "quoteCurrency", "effectiveAt" DESC);

-- Link existing tenant/seller market configuration to the public market.
-- Nullable so no existing row is invalidated; seller eligibility keeps falling
-- back to `shippingCountries` until backfilled.
ALTER TABLE "tenant_market" ADD COLUMN "commerceMarketId" TEXT;
ALTER TABLE "seller_market" ADD COLUMN "commerceMarketId" TEXT;

ALTER TABLE "commerce_market" ADD CONSTRAINT "commerce_market_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_market_locale" ADD CONSTRAINT "commerce_market_locale_marketId_fkey"
    FOREIGN KEY ("marketId") REFERENCES "commerce_market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_market" ADD CONSTRAINT "tenant_market_commerceMarketId_fkey"
    FOREIGN KEY ("commerceMarketId") REFERENCES "commerce_market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "seller_market" ADD CONSTRAINT "seller_market_commerceMarketId_fkey"
    FOREIGN KEY ("commerceMarketId") REFERENCES "commerce_market"("id") ON DELETE SET NULL ON UPDATE CASCADE;
