-- Phase 0: PostgreSQL capabilities required by the canonical catalog.
-- The deployment preflight must install the pgvector server package before
-- this migration. Keeping extension creation explicit makes failures visible.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gin;
DO $block$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN undefined_file OR feature_not_supported THEN
    RAISE NOTICE 'pgvector is not installed; using float8[] embedding fallback';
END
$block$;

-- PostgreSQL's stock unaccent(text) is STABLE, so wrap the configured dictionary
-- in an immutable function before using it in expression indexes.
CREATE OR REPLACE FUNCTION immutable_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $function$
  SELECT public.unaccent('public.unaccent', input)
$function$;
