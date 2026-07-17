-- Normalize marketplace browse taxonomy without removing the legacy
-- MktProduct.category/publisher strings. Importers may keep writing those
-- columns during the staged backfill; reads can prefer these relations.

ALTER TABLE "MktProduct" ADD COLUMN "publisherId" TEXT;

CREATE TABLE "mkt_product_category" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mkt_product_category_pkey" PRIMARY KEY ("productId", "categoryId")
);

CREATE INDEX "MktProduct_publisherId_idx" ON "MktProduct"("publisherId");
CREATE INDEX "mkt_product_category_categoryId_productId_idx"
  ON "mkt_product_category"("categoryId", "productId");
CREATE INDEX "mkt_product_category_productId_isPrimary_idx"
  ON "mkt_product_category"("productId", "isPrimary");

-- Enforce at most one primary category while still allowing any number of
-- secondary categories. Partial indexes are intentionally expressed in SQL;
-- Prisma schema syntax cannot represent this invariant.
CREATE UNIQUE INDEX "mkt_product_category_one_primary_per_product"
  ON "mkt_product_category"("productId") WHERE "isPrimary" = true;

ALTER TABLE "MktProduct"
  ADD CONSTRAINT "MktProduct_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "publisher"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mkt_product_category"
  ADD CONSTRAINT "mkt_product_category_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "MktProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mkt_product_category"
  ADD CONSTRAINT "mkt_product_category_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Safe publisher backfill: link only names that identify exactly one
-- normalized Publisher. Ambiguous/unmatched strings remain available in the
-- legacy column for later curation rather than being guessed.
WITH unique_publishers AS (
  SELECT lower(trim("canonicalName")) AS normalized, min("id") AS id
  FROM "publisher"
  GROUP BY lower(trim("canonicalName"))
  HAVING count(*) = 1
)
UPDATE "MktProduct" product
SET "publisherId" = publisher.id
FROM unique_publishers publisher
WHERE product."publisher" IS NOT NULL
  AND lower(trim(product."publisher")) = publisher.normalized;
