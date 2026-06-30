-- PostgreSQL-only invariants, search indexes, partitions, and read models that
-- Prisma cannot express. All tables are empty when this migration first runs.

-- Domain invariants ----------------------------------------------------------
ALTER TABLE "master_game"
  ADD CONSTRAINT master_game_player_range_ck CHECK (
    "minPlayers" IS NULL OR "maxPlayers" IS NULL OR "minPlayers" <= "maxPlayers"
  ),
  ADD CONSTRAINT master_game_play_time_range_ck CHECK (
    "minPlayTimeMinutes" IS NULL OR "maxPlayTimeMinutes" IS NULL OR "minPlayTimeMinutes" <= "maxPlayTimeMinutes"
  ),
  ADD CONSTRAINT master_game_age_range_ck CHECK (
    "minAge" IS NULL OR "maxAge" IS NULL OR "minAge" <= "maxAge"
  ),
  ADD CONSTRAINT master_game_complexity_ck CHECK (
    "complexityWeight" IS NULL OR "complexityWeight" BETWEEN 0 AND 5
  );

ALTER TABLE "accessory_compatibility"
  ADD CONSTRAINT accessory_compatibility_one_target_ck CHECK (
    num_nonnulls("compatibleMasterGameId", "compatibleEditionId", "compatibleProductId") = 1
  ),
  ADD CONSTRAINT accessory_compatibility_confidence_ck CHECK (
    "confidenceScore" BETWEEN 0 AND 1
  );

ALTER TABLE "external_identifier"
  ADD CONSTRAINT external_identifier_confidence_ck CHECK (
    "confidenceScore" BETWEEN 0 AND 1
  );

ALTER TABLE "source_claim"
  ADD CONSTRAINT source_claim_confidence_ck CHECK (
    "sourceConfidence" BETWEEN 0 AND 1
  );

ALTER TABLE "product_match_candidate"
  ADD CONSTRAINT product_match_candidate_score_ck CHECK (score BETWEEN 0 AND 1);

ALTER TABLE "knowledge_graph_edge"
  ADD CONSTRAINT knowledge_graph_edge_confidence_ck CHECK (
    "confidenceScore" BETWEEN 0 AND 1
  ),
  ADD CONSTRAINT knowledge_graph_edge_no_self_ck CHECK (
    ("sourceEntityType", "sourceEntityId") <> ("targetEntityType", "targetEntityId")
  );

ALTER TABLE "game_relationship"
  ADD CONSTRAINT game_relationship_confidence_ck CHECK (
    "confidenceScore" BETWEEN 0 AND 1
  ),
  ADD CONSTRAINT game_relationship_no_self_ck CHECK ("sourceGameId" <> "targetGameId");

ALTER TABLE "seller_offer_current"
  ADD CONSTRAINT seller_offer_price_ck CHECK (
    "priceMinor" >= 0
    AND ("compareAtPriceMinor" IS NULL OR "compareAtPriceMinor" >= 0)
    AND ("shippingPriceMinor" IS NULL OR "shippingPriceMinor" >= 0)
  ),
  ADD CONSTRAINT seller_offer_delivery_range_ck CHECK (
    "deliveryMinDays" IS NULL OR "deliveryMaxDays" IS NULL OR "deliveryMinDays" <= "deliveryMaxDays"
  );

ALTER TABLE "local_image_asset"
  ADD CONSTRAINT local_image_asset_dimensions_ck CHECK (
    width > 0 AND height > 0 AND "fileSizeBytes" > 0
  );

ALTER TABLE "user_collection_item"
  ADD CONSTRAINT user_collection_item_one_entity_ck CHECK (
    num_nonnulls("masterGameId", "catalogProductId") = 1
  );

ALTER TABLE "wishlist_item"
  ADD CONSTRAINT wishlist_item_one_entity_ck CHECK (
    num_nonnulls("masterGameId", "catalogProductId") = 1
  );

ALTER TABLE "user_alert"
  ADD CONSTRAINT user_alert_one_entity_ck CHECK (
    num_nonnulls("masterGameId", "catalogProductId") = 1
  ),
  ADD CONSTRAINT user_alert_price_ck CHECK (
    "targetPriceMinor" IS NULL OR "targetPriceMinor" >= 0
  );

ALTER TABLE "seo_page"
  ADD CONSTRAINT seo_page_quality_score_ck CHECK ("qualityScore" BETWEEN 0 AND 1);

-- Identifier and canonical lookup indexes -----------------------------------
CREATE UNIQUE INDEX external_identifier_verified_value_uq
  ON "external_identifier" (
    "namespaceId",
    "normalizedValue",
    COALESCE("marketplaceCountry", '')
  )
  WHERE "verificationStatus" = 'VERIFIED';

CREATE INDEX external_identifier_value_trgm_idx
  ON "external_identifier" USING gin ("normalizedValue" gin_trgm_ops);

CREATE INDEX master_game_title_trgm_idx
  ON "master_game" USING gin (immutable_unaccent(lower("normalizedTitle")) gin_trgm_ops);

CREATE INDEX catalog_product_title_trgm_idx
  ON "catalog_product" USING gin (immutable_unaccent(lower("normalizedTitle")) gin_trgm_ops);

CREATE INDEX entity_localization_title_trgm_idx
  ON "entity_localization" USING gin (immutable_unaccent(lower("normalizedTitle")) gin_trgm_ops);

CREATE INDEX seller_source_product_title_trgm_idx
  ON "seller_source_product" USING gin (immutable_unaccent(lower("normalizedTitle")) gin_trgm_ops);

CREATE UNIQUE INDEX product_image_one_primary_uq
  ON "product_image" ("catalogProductId") WHERE "isPrimary";

CREATE UNIQUE INDEX entity_image_one_primary_uq
  ON "entity_image" ("entityType", "entityId", role) WHERE "isPrimary";

CREATE UNIQUE INDEX master_game_one_primary_category_uq
  ON "master_game_category" ("masterGameId") WHERE "isPrimary";

CREATE INDEX source_claim_value_gin_idx ON "source_claim" USING gin (value jsonb_path_ops);
CREATE INDEX raw_source_record_payload_gin_idx ON "raw_source_record" USING gin ("rawPayload" jsonb_path_ops);
CREATE INDEX seller_source_product_payload_gin_idx ON "seller_source_product" USING gin ("rawPayload" jsonb_path_ops);
CREATE INDEX search_document_facets_gin_idx ON "search_document" USING gin ("structuredFacets" jsonb_path_ops);

-- Current-offer hot paths. History never participates in normal page reads.
CREATE INDEX seller_offer_active_best_price_idx
  ON "seller_offer_current" ("catalogProductId", "countryId", "currencyCode", "priceMinor", "rankScore" DESC)
  WHERE active AND "stockStatus" IN ('IN_STOCK', 'LOW_STOCK', 'PREORDER', 'BACKORDER');

CREATE INDEX seller_offer_stale_idx
  ON "seller_offer_current" ("lastSeenAt", "sellerId") WHERE active;

CREATE INDEX seo_page_indexable_idx
  ON "seo_page" (locale, "countryCode", "pageType", "qualityScore" DESC)
  WHERE indexable AND "minimumDataMet";

CREATE UNIQUE INDEX seo_slug_current_entity_uq
  ON "seo_slug" ("seoPageId", locale) WHERE "isCurrent";

-- PostgreSQL full-text + semantic search -------------------------------------
CREATE OR REPLACE FUNCTION set_search_document_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW."searchVector" := to_tsvector(
    'simple',
    immutable_unaccent(
      concat_ws(' ', NEW.title, array_to_string(NEW."alternateTitles", ' '), NEW."searchableText")
    )
  );
  RETURN NEW;
END
$function$;

CREATE TRIGGER search_document_vector_trg
BEFORE INSERT OR UPDATE OF title, "alternateTitles", "searchableText"
ON "search_document"
FOR EACH ROW EXECUTE FUNCTION set_search_document_vector();

CREATE INDEX search_document_vector_gin_idx
  ON "search_document" USING gin ("searchVector");

-- pgvector is optional. Prisma uses the portable float8[] `embedding` fields;
-- installations with pgvector get unmanaged vector columns for ANN queries.
DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'ALTER TABLE "search_document" ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)';
    EXECUTE 'ALTER TABLE "recommendation_profile" ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS search_document_embedding_hnsw_idx
      ON "search_document" USING hnsw (embedding_vector vector_cosine_ops)
      WITH (m = 16, ef_construction = 128) WHERE embedding_vector IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS recommendation_profile_embedding_hnsw_idx
      ON "recommendation_profile" USING hnsw (embedding_vector vector_cosine_ops)
      WITH (m = 16, ef_construction = 128) WHERE embedding_vector IS NOT NULL';
  END IF;
END
$block$;

-- Monthly partitions: one month behind through twelve months ahead, plus a
-- default safety partition. A scheduled DBA job runs this block monthly.
DO $block$
DECLARE
  parent_name text;
  month_start date;
  month_end date;
  partition_name text;
BEGIN
  FOREACH parent_name IN ARRAY ARRAY[
    'seller_offer_price_history',
    'seller_offer_inventory_history',
    'affiliate_click_event',
    'analytics_event'
  ]
  LOOP
    FOR month_start IN
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - interval '1 month',
        date_trunc('month', CURRENT_DATE) + interval '12 months',
        interval '1 month'
      )::date
    LOOP
      month_end := (month_start + interval '1 month')::date;
      partition_name := parent_name || '_' || to_char(month_start, 'YYYY_MM');
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        parent_name,
        month_start,
        month_end
      );
    END LOOP;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I DEFAULT',
      parent_name || '_default',
      parent_name
    );
  END LOOP;
END
$block$;

-- Rebuildable read model used by price-comparison pages and the search outbox.
CREATE MATERIALIZED VIEW catalog_product_offer_summary AS
SELECT
  o."catalogProductId" AS catalog_product_id,
  o."countryId" AS country_id,
  o."currencyCode" AS currency_code,
  count(*) FILTER (WHERE o.active) AS offer_count,
  count(*) FILTER (
    WHERE o.active AND o."stockStatus" IN ('IN_STOCK', 'LOW_STOCK', 'PREORDER', 'BACKORDER')
  ) AS available_offer_count,
  min(o."priceMinor") FILTER (WHERE o.active) AS low_price_minor,
  max(o."priceMinor") FILTER (WHERE o.active) AS high_price_minor,
  max(o."updatedAt") AS offers_updated_at
FROM "seller_offer_current" o
GROUP BY o."catalogProductId", o."countryId", o."currencyCode"
WITH NO DATA;

CREATE UNIQUE INDEX catalog_product_offer_summary_uq
  ON catalog_product_offer_summary (catalog_product_id, country_id, currency_code);

CREATE INDEX catalog_product_offer_summary_available_idx
  ON catalog_product_offer_summary (country_id, currency_code, available_offer_count DESC, low_price_minor);
