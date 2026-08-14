-- Real BGG mechanics only, distinct from the blended `tags` column.
ALTER TABLE "MktProduct" ADD COLUMN "mechanics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
