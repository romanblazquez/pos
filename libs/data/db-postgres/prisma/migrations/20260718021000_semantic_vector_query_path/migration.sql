-- Keep a fast database-side semantic query path. pgvector/HNSW is preferred;
-- the immutable array function is the portable exact-ranking fallback.

CREATE OR REPLACE FUNCTION cosine_similarity_float8(a DOUBLE PRECISION[], b DOUBLE PRECISION[])
RETURNS DOUBLE PRECISION
LANGUAGE SQL IMMUTABLE PARALLEL SAFE STRICT
AS $function$
  SELECT CASE WHEN sums.ma = 0 OR sums.mb = 0 THEN NULL
    ELSE sums.dot / (sqrt(sums.ma) * sqrt(sums.mb)) END
  FROM (
    SELECT sum(x * y) AS dot, sum(x * x) AS ma, sum(y * y) AS mb
    FROM unnest(a, b) pair(x, y)
  ) sums
$function$;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'ALTER TABLE "search_document" ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)';
    EXECUTE 'UPDATE "search_document" SET embedding_vector = embedding::vector
      WHERE cardinality(embedding) = 1536 AND (embedding_vector IS NULL OR embedding_vector != embedding::vector)';
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION sync_search_document_embedding_vector()
      RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        NEW.embedding_vector := CASE WHEN cardinality(NEW.embedding) = 1536 THEN NEW.embedding::vector ELSE NULL END;
        RETURN NEW;
      END $fn$
    $sql$;
    EXECUTE 'DROP TRIGGER IF EXISTS search_document_embedding_vector_trg ON "search_document"';
    EXECUTE 'CREATE TRIGGER search_document_embedding_vector_trg BEFORE INSERT OR UPDATE OF embedding
      ON "search_document" FOR EACH ROW EXECUTE FUNCTION sync_search_document_embedding_vector()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS search_document_embedding_hnsw_idx
      ON "search_document" USING hnsw (embedding_vector vector_cosine_ops)
      WITH (m = 16, ef_construction = 128) WHERE embedding_vector IS NOT NULL';
  END IF;
END
$block$;
