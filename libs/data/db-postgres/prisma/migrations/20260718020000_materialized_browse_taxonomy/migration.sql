-- Data-driven browse taxonomy for marketplace products.
-- Product type (board-game/expansion) remains on MktProduct.category; semantic
-- browse membership is materialized into the indexed M:N bridge.

CREATE TABLE "category_rule" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "stringValue" TEXT,
  "intValue" INTEGER,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "category_rule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "category_rule_categoryId_fkey" FOREIGN KEY ("categoryId")
    REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "category_rule_value_check" CHECK (
    ("ruleType" = 'tag' AND "stringValue" IS NOT NULL AND "intValue" IS NULL) OR
    ("ruleType" = 'player_count' AND "intValue" IS NOT NULL AND "stringValue" IS NULL)
  )
);

CREATE UNIQUE INDEX "category_rule_category_rule_value_uq"
  ON "category_rule" ("categoryId", "ruleType", COALESCE("stringValue", ''), COALESCE("intValue", -1));
CREATE INDEX "category_rule_type_string_idx" ON "category_rule"("ruleType", "stringValue");
CREATE INDEX "category_rule_type_int_idx" ON "category_rule"("ruleType", "intValue");
CREATE INDEX "category_rule_priority_category_idx" ON "category_rule"("priority", "categoryId");

INSERT INTO "category" ("id", "canonicalName", "normalizedName", "description", "createdAt", "updatedAt") VALUES
  ('browse_strategy', 'Strategy', 'strategy', 'Strategy, economy, worker-placement and area-control games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_euro', 'Eurogames', 'euro', 'Economic and resource-management eurogames.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_coop', 'Cooperative', 'coop', 'Games where players win or lose together.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_two_player', 'For 2 players', 'two-player', 'Games supporting exactly two players.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_card', 'Card games', 'card', 'Card-driven tabletop games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_deckbuilding', 'Deck building', 'deckbuilding', 'Deck, bag and pool-building games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_solo', 'Solo', 'solo', 'Games supporting solitaire play.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_thematic', 'Thematic & adventure', 'thematic', 'Adventure, exploration and miniatures-driven games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_horror', 'Horror', 'horror', 'Horror, zombies and murder-mystery games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_fantasy', 'Fantasy', 'fantasy', 'Fantasy, medieval and mythology games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_scifi', 'Science fiction', 'scifi', 'Science-fiction and space-exploration games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_dice', 'Dice games', 'dice', 'Dice rolling and push-your-luck games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_party', 'Party', 'party', 'Party, humour and word games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_abstract', 'Abstract', 'abstract', 'Abstract strategy games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_wargame', 'Wargames', 'wargame', 'War and historical-conflict games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('browse_campaign', 'Campaign & legacy', 'campaign', 'Campaign, scenario and legacy games.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("normalizedName") DO UPDATE SET
  "canonicalName" = EXCLUDED."canonicalName",
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Stable priority determines the canonical/primary breadcrumb category.
WITH rules(category_key, priority, rule_type, string_value, int_value) AS (VALUES
  ('strategy',10,'tag','Economic',NULL), ('strategy',10,'tag','Territory Building',NULL), ('strategy',10,'tag','Area Majority / Influence',NULL), ('strategy',10,'tag','Civilization',NULL), ('strategy',10,'tag','Political',NULL), ('strategy',10,'tag','Worker Placement',NULL), ('strategy',10,'tag','City Building',NULL),
  ('euro',20,'tag','Income',NULL), ('euro',20,'tag','Market',NULL), ('euro',20,'tag','Industry / Manufacturing',NULL), ('euro',20,'tag','End Game Bonuses',NULL),
  ('coop',30,'tag','Cooperative Game',NULL),
  ('two-player',40,'player_count',NULL,2),
  ('card',50,'tag','Card Game',NULL),
  ('deckbuilding',60,'tag','Deck, Bag, and Pool Building',NULL),
  ('solo',70,'tag','Solo / Solitaire Game',NULL),
  ('thematic',80,'tag','Adventure',NULL), ('thematic',80,'tag','Exploration',NULL), ('thematic',80,'tag','Fighting',NULL), ('thematic',80,'tag','Miniatures',NULL), ('thematic',80,'tag','Novel-based',NULL),
  ('horror',90,'tag','Horror',NULL), ('horror',90,'tag','Zombies',NULL), ('horror',90,'tag','Murder/Mystery',NULL),
  ('fantasy',100,'tag','Fantasy',NULL), ('fantasy',100,'tag','Medieval',NULL), ('fantasy',100,'tag','Mythology',NULL),
  ('scifi',110,'tag','Science Fiction',NULL), ('scifi',110,'tag','Space Exploration',NULL),
  ('dice',120,'tag','Dice Rolling',NULL), ('dice',120,'tag','Dice',NULL), ('dice',120,'tag','Push Your Luck',NULL),
  ('party',130,'tag','Party Game',NULL), ('party',130,'tag','Humor',NULL), ('party',130,'tag','Word Game',NULL),
  ('abstract',140,'tag','Abstract Strategy',NULL),
  ('wargame',150,'tag','Wargame',NULL), ('wargame',150,'tag','Wars',NULL), ('wargame',150,'tag','World War II',NULL), ('wargame',150,'tag','American Civil War',NULL),
  ('campaign',160,'tag','Scenario / Mission / Campaign Game',NULL), ('campaign',160,'tag','Legacy Game',NULL), ('campaign',160,'tag','Campaign / Battle Card Driven',NULL)
)
INSERT INTO "category_rule" ("id", "categoryId", "ruleType", "stringValue", "intValue", "priority", "createdAt", "updatedAt")
SELECT 'rule_' || c."normalizedName" || '_' || row_number() OVER (PARTITION BY c.id ORDER BY r.rule_type, COALESCE(r.string_value, ''), COALESCE(r.int_value, -1)),
       c.id, r.rule_type, r.string_value, r.int_value, r.priority, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM rules r JOIN "category" c ON c."normalizedName" = r.category_key
ON CONFLICT ("id") DO UPDATE SET "priority" = EXCLUDED."priority", "updatedAt" = CURRENT_TIMESTAMP;

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
  ), ranked AS (
    SELECT "categoryId", row_number() OVER (ORDER BY priority, "categoryId") = 1 AS "isPrimary"
    FROM matches
  )
  INSERT INTO "mkt_product_category" ("productId", "categoryId", "isPrimary", "createdAt", "updatedAt")
  SELECT target_product_id, "categoryId", "isPrimary", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM ranked
  ON CONFLICT ("productId", "categoryId") DO UPDATE SET
    "isPrimary" = EXCLUDED."isPrimary", "updatedAt" = CURRENT_TIMESTAMP;
END
$function$;

CREATE OR REPLACE FUNCTION sync_mkt_product_categories_trigger()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  PERFORM sync_mkt_product_categories(NEW.id);
  RETURN NEW;
END
$function$;

CREATE TRIGGER mkt_product_categories_sync_trg
AFTER INSERT OR UPDATE OF tags, "minPlayers", "maxPlayers" ON "MktProduct"
FOR EACH ROW EXECUTE FUNCTION sync_mkt_product_categories_trigger();

DO $block$ DECLARE product_id TEXT; BEGIN
  FOR product_id IN SELECT id FROM "MktProduct" LOOP
    PERFORM sync_mkt_product_categories(product_id);
  END LOOP;
END $block$;
