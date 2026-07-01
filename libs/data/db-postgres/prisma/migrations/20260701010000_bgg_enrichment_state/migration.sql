CREATE TABLE "bgg_enrichment_state" (
    "productId" TEXT NOT NULL,
    "bggId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3),
    "imageDownloadedAt" TIMESTAMP(3),
    "translatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bgg_enrichment_state_pkey" PRIMARY KEY ("productId")
);

CREATE UNIQUE INDEX "bgg_enrichment_state_bggId_key" ON "bgg_enrichment_state"("bggId");
CREATE INDEX "bgg_enrichment_state_status_nextRetryAt_idx" ON "bgg_enrichment_state"("status", "nextRetryAt");

ALTER TABLE "bgg_enrichment_state"
ADD CONSTRAINT "bgg_enrichment_state_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "MktProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
