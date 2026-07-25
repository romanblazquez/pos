-- Browse taxonomy: full product coverage.
--
-- Three things change, all in service of one invariant — EVERY marketplace
-- product belongs to at least one browse category:
--
--   1. New categories (family, deduction, sports, trains, history) plus extra
--      tag rules on existing ones, so the long tail of BGG tags that matched
--      nothing (Animals, Deduction, Trains, Sports, Ancient…) lands somewhere
--      real instead of nowhere.
--   2. A `fallback` rule type. A product with no tags and no player counts (a
--      bare catalogue stub awaiting enrichment) can never match a tag or
--      player_count rule, so the sync function assigns the fallback category
--      when nothing else matches. It is rule-managed like any other membership,
--      so the row disappears by itself once enrichment gives the product tags.
--   3. A fixed rule string: 'Murder/Mystery' never existed in BGG's vocabulary
--      (the real tag is 'Murder / Mystery'), so that horror rule matched zero
--      products.

-- ── 1. Allow ruleType = 'fallback' (no tag, no player count) ─────────────────
ALTER TABLE "category_rule" DROP CONSTRAINT "category_rule_value_check";
ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_value_check" CHECK (
  ("ruleType" = 'tag' AND "stringValue" IS NOT NULL AND "intValue" IS NULL) OR
  ("ruleType" = 'player_count' AND "intValue" IS NOT NULL AND "stringValue" IS NULL) OR
  ("ruleType" = 'fallback' AND "stringValue" IS NULL AND "intValue" IS NULL)
);

-- ── 2. New browse categories ────────────────────────────────────────────────
-- `other` is the fallback shelf: it exists so the invariant holds and so every
-- product stays reachable by browsing, but the web app keeps it out of the
-- sitemap and marks it noindex — a shelf of un-enriched stubs is not a search
-- landing page.
INSERT INTO "category" ("id", "canonicalName", "normalizedName", "description", "createdAt", "updatedAt") VALUES
  ('browse_family', 'Family & kids', 'family', 'Family and children''s games: quick to teach, easy to love.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_deduction', 'Deduction & bluffing', 'deduction', 'Deduction, bluffing and hidden-role games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_sports', 'Sports & racing', 'sports', 'Sports and racing games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_trains', 'Trains & transport', 'trains', 'Trains, routes and transport games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_history', 'Historical', 'history', 'Games set in real historical periods.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_other', 'Other games', 'other', 'Games still awaiting the enrichment that places them on a themed shelf.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("normalizedName") DO UPDATE SET
  "canonicalName" = EXCLUDED."canonicalName",
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

-- ── 3. Fix the rule that matched nothing ────────────────────────────────────
UPDATE "category_rule" SET "stringValue" = 'Murder / Mystery', "updatedAt" = CURRENT_TIMESTAMP
WHERE "ruleType" = 'tag' AND "stringValue" = 'Murder/Mystery';

-- ── 4. Rules ───────────────────────────────────────────────────────────────
-- Priority decides which membership becomes the breadcrumb (`isPrimary`), so
-- rules added to an EXISTING category inherit that category's current priority
-- rather than hardcoding it twice. New categories declare their own: `family`
-- slots in early (a family game reads as "Familiares" before "De dados"), the
-- rest sit after the original sixteen, and the fallback is last by construction.
WITH declared(category_key, priority, rule_type, string_value) AS (VALUES
  -- New: family & kids
  ('family', 35, 'tag', 'Children''s Game'),
  ('family', 35, 'tag', 'Animals'),
  ('family', 35, 'tag', 'Educational'),
  ('family', 35, 'tag', 'Memory'),
  ('family', 35, 'tag', 'Maze'),
  ('family', 35, 'tag', 'Number'),
  -- New: deduction & bluffing
  ('deduction', 170, 'tag', 'Deduction'),
  ('deduction', 170, 'tag', 'Bluffing'),
  ('deduction', 170, 'tag', 'Betting and Bluffing'),
  ('deduction', 170, 'tag', 'Murder / Mystery'),
  ('deduction', 170, 'tag', 'Spies / Secret Agents'),
  ('deduction', 170, 'tag', 'Hidden Movement'),
  ('deduction', 170, 'tag', 'Negotiation'),
  ('deduction', 170, 'tag', 'Voting'),
  ('deduction', 170, 'tag', 'Mafia'),
  -- New: sports & racing
  ('sports', 180, 'tag', 'Sports'),
  ('sports', 180, 'tag', 'Racing'),
  ('sports', 180, 'tag', 'Race'),
  -- New: trains & transport
  ('trains', 190, 'tag', 'Trains'),
  ('trains', 190, 'tag', 'Transportation'),
  ('trains', 190, 'tag', 'Network and Route Building'),
  ('trains', 190, 'tag', 'Pick-up and Deliver'),
  ('trains', 190, 'tag', 'Nautical'),
  ('trains', 190, 'tag', 'Aviation / Flight'),
  ('trains', 190, 'tag', 'Travel'),
  -- New: historical settings
  ('history', 200, 'tag', 'Ancient'),
  ('history', 200, 'tag', 'Renaissance'),
  ('history', 200, 'tag', 'Prehistoric'),
  ('history', 200, 'tag', 'American West'),
  ('history', 200, 'tag', 'Napoleonic'),
  ('history', 200, 'tag', 'Post-Napoleonic'),
  ('history', 200, 'tag', 'Age of Reason'),
  ('history', 200, 'tag', 'Pike and Shot'),
  ('history', 200, 'tag', 'Arabian'),
  ('history', 200, 'tag', 'Religious'),
  -- Existing categories, widened (priority resolved below)
  ('coop', NULL, 'tag', 'Semi-Cooperative Game'),
  ('coop', NULL, 'tag', 'Team-Based Game'),
  ('card', NULL, 'tag', 'Trick-taking'),
  ('euro', NULL, 'tag', 'Farming'),
  ('party', NULL, 'tag', 'Real-time'),
  ('party', NULL, 'tag', 'Real-Time'),
  ('party', NULL, 'tag', 'Trivia'),
  ('party', NULL, 'tag', 'Action / Dexterity'),
  ('party', NULL, 'tag', 'Take That'),
  ('party', NULL, 'tag', 'Music'),
  ('abstract', NULL, 'tag', 'Puzzle'),
  ('abstract', NULL, 'tag', 'Pattern Building'),
  ('abstract', NULL, 'tag', 'Pattern Recognition'),
  ('abstract', NULL, 'tag', 'Tile Placement'),
  ('abstract', NULL, 'tag', 'Paper-and-Pencil'),
  ('thematic', NULL, 'tag', 'Storytelling'),
  ('thematic', NULL, 'tag', 'Role Playing'),
  ('thematic', NULL, 'tag', 'Simulation'),
  ('thematic', NULL, 'tag', 'Pirates'),
  ('thematic', NULL, 'tag', 'Environmental'),
  ('thematic', NULL, 'tag', 'Medical'),
  ('thematic', NULL, 'tag', 'Movies / TV / Radio theme'),
  ('thematic', NULL, 'tag', 'Video Game Theme'),
  ('thematic', NULL, 'tag', 'Comic Book / Strip'),
  ('thematic', NULL, 'tag', 'Book'),
  -- The catch-all, always last
  ('other', 9999, 'fallback', NULL)
)
INSERT INTO "category_rule" ("id", "categoryId", "ruleType", "stringValue", "intValue", "priority", "createdAt", "updatedAt")
SELECT
  -- Readable, deterministic id. Case is PRESERVED because BGG ships tags that
  -- differ only by case ('Real-time' and 'Real-Time' are both real, both used),
  -- and lowercasing them would collide into one id.
  'rule_' || c."normalizedName" || '_'
    || regexp_replace(coalesce(d.string_value, d.rule_type), '[^a-zA-Z0-9]+', '_', 'g'),
  c.id,
  d.rule_type,
  d.string_value,
  NULL,
  coalesce(d.priority, (SELECT min(existing."priority") FROM "category_rule" existing WHERE existing."categoryId" = c.id), 500),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM declared d JOIN "category" c ON c."normalizedName" = d.category_key
ON CONFLICT ("id") DO UPDATE SET
  "stringValue" = EXCLUDED."stringValue",
  "priority" = EXCLUDED."priority",
  "updatedAt" = CURRENT_TIMESTAMP;

-- ── 5. Sync function: fall back when no rule matches ────────────────────────
CREATE OR REPLACE FUNCTION sync_mkt_product_categories(target_product_id TEXT)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  DELETE FROM "mkt_product_category" pc
  USING "category_rule" rule
  WHERE pc."productId" = target_product_id AND pc."categoryId" = rule."categoryId";

  WITH matches AS (
    SELECT rule."categoryId", min(rule."priority") AS priority
    FROM "MktProduct" product
    JOIN "category_rule" rule ON
      (rule."ruleType" = 'tag' AND rule."stringValue" = ANY(product.tags)) OR
      (rule."ruleType" = 'player_count' AND product."minPlayers" <= rule."intValue" AND product."maxPlayers" >= rule."intValue")
    WHERE product.id = target_product_id
    GROUP BY rule."categoryId"
  ), fallback AS (
    -- Only when nothing matched: an un-enriched product still has to be
    -- browsable, and every product must carry at least one category.
    SELECT rule."categoryId", rule."priority"
    FROM "category_rule" rule
    WHERE rule."ruleType" = 'fallback' AND NOT EXISTS (SELECT 1 FROM matches)
    ORDER BY rule."priority", rule."categoryId"
    LIMIT 1
  ), resolved AS (
    SELECT * FROM matches UNION ALL SELECT * FROM fallback
  ), ranked AS (
    SELECT "categoryId", row_number() OVER (ORDER BY priority, "categoryId") = 1 AS "isPrimary"
    FROM resolved
  )
  INSERT INTO "mkt_product_category" ("productId", "categoryId", "isPrimary", "createdAt", "updatedAt")
  SELECT target_product_id, "categoryId", "isPrimary", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM ranked
  ON CONFLICT ("productId", "categoryId") DO UPDATE SET
    "isPrimary" = EXCLUDED."isPrimary", "updatedAt" = CURRENT_TIMESTAMP;
END
$function$;

-- ── 6. Rebuild every membership ────────────────────────────────────────────
-- Set-based rather than the per-product loop the first migration used: the
-- discovery pool is ~178k rows, and each of them now needs at least the
-- fallback row.
DELETE FROM "mkt_product_category" pc
USING "category_rule" rule
WHERE pc."categoryId" = rule."categoryId";

WITH matches AS (
  SELECT product.id AS product_id, rule."categoryId", min(rule."priority") AS priority
  FROM "MktProduct" product
  JOIN "category_rule" rule ON
    (rule."ruleType" = 'tag' AND rule."stringValue" = ANY(product.tags)) OR
    (rule."ruleType" = 'player_count' AND product."minPlayers" <= rule."intValue" AND product."maxPlayers" >= rule."intValue")
  GROUP BY product.id, rule."categoryId"
), fallback_rule AS (
  SELECT "categoryId", "priority" FROM "category_rule"
  WHERE "ruleType" = 'fallback' ORDER BY "priority", "categoryId" LIMIT 1
), fallback AS (
  SELECT product.id AS product_id, r."categoryId", r."priority"
  FROM "MktProduct" product CROSS JOIN fallback_rule r
  WHERE NOT EXISTS (SELECT 1 FROM matches m WHERE m.product_id = product.id)
), resolved AS (
  SELECT * FROM matches UNION ALL SELECT * FROM fallback
), ranked AS (
  SELECT product_id, "categoryId",
         row_number() OVER (PARTITION BY product_id ORDER BY priority, "categoryId") = 1 AS "isPrimary"
  FROM resolved
)
INSERT INTO "mkt_product_category" ("productId", "categoryId", "isPrimary", "createdAt", "updatedAt")
SELECT product_id, "categoryId", "isPrimary", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM ranked
ON CONFLICT ("productId", "categoryId") DO UPDATE SET
  "isPrimary" = EXCLUDED."isPrimary", "updatedAt" = CURRENT_TIMESTAMP;
