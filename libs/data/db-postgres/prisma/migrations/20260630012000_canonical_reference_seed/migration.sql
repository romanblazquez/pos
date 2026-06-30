-- Stable reference data only. No sample games/products are inserted in production.

INSERT INTO "country" (id, code, "iso3Code", name, "defaultCurrency", "defaultLanguage", timezone, "updatedAt") VALUES
  ('country_mx', 'MX', 'MEX', 'Mexico', 'MXN', 'es-MX', 'America/Mexico_City', now()),
  ('country_ar', 'AR', 'ARG', 'Argentina', 'ARS', 'es-AR', 'America/Argentina/Buenos_Aires', now()),
  ('country_es', 'ES', 'ESP', 'Spain', 'EUR', 'es-ES', 'Europe/Madrid', now()),
  ('country_us', 'US', 'USA', 'United States', 'USD', 'en-US', 'America/New_York', now()),
  ('country_gb', 'GB', 'GBR', 'United Kingdom', 'GBP', 'en-GB', 'Europe/London', now()),
  ('country_de', 'DE', 'DEU', 'Germany', 'EUR', 'de-DE', 'Europe/Berlin', now()),
  ('country_fr', 'FR', 'FRA', 'France', 'EUR', 'fr-FR', 'Europe/Paris', now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO "currency" (id, code, "numericCode", name, symbol, "minorUnits", "updatedAt") VALUES
  ('currency_mxn', 'MXN', '484', 'Mexican Peso', '$', 2, now()),
  ('currency_ars', 'ARS', '032', 'Argentine Peso', '$', 2, now()),
  ('currency_usd', 'USD', '840', 'US Dollar', '$', 2, now()),
  ('currency_eur', 'EUR', '978', 'Euro', '€', 2, now()),
  ('currency_gbp', 'GBP', '826', 'Pound Sterling', '£', 2, now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO "language" (id, code, "iso6391", name, "nativeName", direction, "updatedAt") VALUES
  ('language_es_mx', 'es-MX', 'es', 'Spanish (Mexico)', 'Español (México)', 'ltr', now()),
  ('language_es_ar', 'es-AR', NULL, 'Spanish (Argentina)', 'Español (Argentina)', 'ltr', now()),
  ('language_es_es', 'es-ES', NULL, 'Spanish (Spain)', 'Español (España)', 'ltr', now()),
  ('language_en_us', 'en-US', 'en', 'English (United States)', 'English (United States)', 'ltr', now()),
  ('language_en_gb', 'en-GB', NULL, 'English (United Kingdom)', 'English (United Kingdom)', 'ltr', now()),
  ('language_de_de', 'de-DE', 'de', 'German', 'Deutsch', 'ltr', now()),
  ('language_fr_fr', 'fr-FR', 'fr', 'French', 'Français', 'ltr', now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO "marketplace" (id, code, name, "baseUrl", "marketplaceType", "updatedAt") VALUES
  ('marketplace_amazon', 'amazon', 'Amazon', 'https://www.amazon.com', 'affiliate_marketplace', now()),
  ('marketplace_mercadolibre', 'mercado-libre', 'Mercado Libre', 'https://www.mercadolibre.com', 'marketplace', now()),
  ('marketplace_shopify', 'shopify', 'Shopify', 'https://www.shopify.com', 'commerce_platform', now()),
  ('marketplace_tiendanube', 'tiendanube', 'Tiendanube', 'https://www.tiendanube.com', 'commerce_platform', now()),
  ('marketplace_woocommerce', 'woocommerce', 'WooCommerce', 'https://woocommerce.com', 'commerce_platform', now()),
  ('marketplace_ebay', 'ebay', 'eBay', 'https://www.ebay.com', 'marketplace', now()),
  ('marketplace_etsy', 'etsy', 'Etsy', 'https://www.etsy.com', 'marketplace', now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO "data_source" (
  id, code, name, "sourceType", "baseUrl", "trustPriority", "defaultConfidence",
  "imageImportAllowed", "updatedAt"
) VALUES
  ('source_manual_admin', 'manual-admin', 'Juegospedia verified admin', 'manual', NULL, 1, 1.0, true, now()),
  ('source_publisher', 'publisher-official', 'Official publisher feeds', 'publisher', NULL, 10, 0.98, true, now()),
  ('source_gtin_registry', 'gtin-registry', 'Verified GTIN registries', 'identifier_registry', NULL, 20, 0.97, false, now()),
  ('source_bgg', 'boardgamegeek', 'BoardGameGeek', 'catalog', 'https://boardgamegeek.com', 30, 0.90, false, now()),
  ('source_wikidata', 'wikidata', 'Wikidata', 'knowledge_graph', 'https://www.wikidata.org', 40, 0.85, true, now()),
  ('source_amazon', 'amazon', 'Amazon Product Advertising API', 'marketplace', 'https://www.amazon.com', 60, 0.75, true, now()),
  ('source_mercadolibre', 'mercado-libre', 'Mercado Libre API', 'marketplace', 'https://www.mercadolibre.com', 60, 0.75, true, now()),
  ('source_shopify', 'shopify', 'Shopify seller feeds', 'seller_feed', 'https://www.shopify.com', 70, 0.70, true, now()),
  ('source_tiendanube', 'tiendanube', 'Tiendanube seller feeds', 'seller_feed', 'https://www.tiendanube.com', 70, 0.70, true, now()),
  ('source_woocommerce', 'woocommerce', 'WooCommerce seller feeds', 'seller_feed', 'https://woocommerce.com', 70, 0.70, true, now()),
  ('source_ai', 'ai-inference', 'AI-assisted inference', 'ai', NULL, 100, 0.50, false, now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO "identifier_namespace" (
  id, code, "displayName", "entityScope", "caseSensitive", "countryScoped", "updatedAt"
) VALUES
  ('idns_bgg', 'boardgamegeek_id', 'BoardGameGeek ID', ARRAY['master_game','game_edition'], false, false, now()),
  ('idns_bga', 'boardgamearena_id', 'Board Game Arena ID', ARRAY['master_game','digital_implementation'], false, false, now()),
  ('idns_bgatlas', 'boardgameatlas_id', 'Board Game Atlas ID', ARRAY['master_game'], false, false, now()),
  ('idns_wikidata', 'wikidata_id', 'Wikidata QID', ARRAY['master_game','designer','artist','publisher'], false, false, now()),
  ('idns_isbn10', 'isbn_10', 'ISBN-10', ARRAY['game_printing','catalog_product'], false, false, now()),
  ('idns_isbn13', 'isbn_13', 'ISBN-13', ARRAY['game_printing','catalog_product'], false, false, now()),
  ('idns_ean', 'ean', 'EAN', ARRAY['game_printing','catalog_product','product_variant'], false, false, now()),
  ('idns_upc', 'upc', 'UPC', ARRAY['game_printing','catalog_product','product_variant'], false, false, now()),
  ('idns_gtin', 'gtin', 'GTIN', ARRAY['game_printing','catalog_product','product_variant'], false, false, now()),
  ('idns_asin', 'amazon_asin', 'Amazon ASIN', ARRAY['seller_source_product','catalog_product'], false, true, now()),
  ('idns_parent_asin', 'amazon_parent_asin', 'Amazon parent ASIN', ARRAY['seller_source_product','catalog_product'], false, true, now()),
  ('idns_amazon_marketplace', 'amazon_marketplace', 'Amazon marketplace', ARRAY['seller_source_product'], false, true, now()),
  ('idns_amazon_sku', 'amazon_seller_sku', 'Amazon seller SKU', ARRAY['seller_source_product','seller_offer_current'], true, true, now()),
  ('idns_fnsku', 'amazon_fnsku', 'Amazon FNSKU', ARRAY['seller_source_product','seller_offer_current'], true, true, now()),
  ('idns_meli_item', 'mercadolibre_id', 'Mercado Libre item ID', ARRAY['seller_source_product','seller_offer_current'], false, true, now()),
  ('idns_meli_catalog', 'mercadolibre_catalog_product_id', 'Mercado Libre catalog product ID', ARRAY['seller_source_product','catalog_product'], false, true, now()),
  ('idns_shopify_product', 'shopify_product_id', 'Shopify product ID', ARRAY['seller_source_product'], true, false, now()),
  ('idns_shopify_variant', 'shopify_variant_id', 'Shopify variant ID', ARRAY['seller_source_product','seller_offer_current'], true, false, now()),
  ('idns_tiendanube_product', 'tiendanube_product_id', 'Tiendanube product ID', ARRAY['seller_source_product'], true, false, now()),
  ('idns_tiendanube_variant', 'tiendanube_variant_id', 'Tiendanube variant ID', ARRAY['seller_source_product','seller_offer_current'], true, false, now()),
  ('idns_wc_product', 'woocommerce_product_id', 'WooCommerce product ID', ARRAY['seller_source_product'], true, false, now()),
  ('idns_wc_variant', 'woocommerce_variant_id', 'WooCommerce variant ID', ARRAY['seller_source_product','seller_offer_current'], true, false, now()),
  ('idns_ebay_item', 'ebay_item_id', 'eBay item ID', ARRAY['seller_source_product','seller_offer_current'], false, true, now()),
  ('idns_etsy_listing', 'etsy_listing_id', 'Etsy listing ID', ARRAY['seller_source_product','seller_offer_current'], false, true, now()),
  ('idns_publisher_sku', 'publisher_sku', 'Publisher SKU', ARRAY['game_printing','catalog_product'], true, false, now()),
  ('idns_manufacturer_sku', 'manufacturer_sku', 'Manufacturer SKU', ARRAY['game_printing','catalog_product'], true, false, now()),
  ('idns_distributor_sku', 'distributor_sku', 'Distributor SKU', ARRAY['seller_source_product','catalog_product'], true, false, now()),
  ('idns_seller_sku', 'seller_sku', 'Seller SKU', ARRAY['seller_source_product','seller_offer_current'], true, false, now()),
  ('idns_custom', 'custom_source_id', 'Custom source ID', ARRAY['*'], true, false, now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO "language_dependency" (id, code, rank, name, description, "updatedAt") VALUES
  ('langdep_none', 'none', 0, 'No necessary in-game text', 'Playable without reading in-game text.', now()),
  ('langdep_low', 'low', 1, 'Some necessary text', 'Limited language dependency or icon-supported text.', now()),
  ('langdep_moderate', 'moderate', 2, 'Moderate in-game text', 'Players should understand the game language.', now()),
  ('langdep_high', 'high', 3, 'Extensive in-game text', 'Fluency in the game language is important.', now())
ON CONFLICT (code) DO NOTHING;
