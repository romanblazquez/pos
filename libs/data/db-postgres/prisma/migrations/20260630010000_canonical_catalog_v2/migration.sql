-- CreateEnum
CREATE TYPE "canonical_record_status" AS ENUM ('DRAFT', 'PUBLISHED', 'MERGED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "moderation_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "catalog_product_type" AS ENUM ('BOARD_GAME', 'EXPANSION', 'STANDALONE_EXPANSION', 'PROMO', 'ACCESSORY', 'RPG_BOOK', 'SLEEVE', 'ORGANIZER', 'MINIATURE', 'PLAYMAT', 'RULEBOOK', 'MAGAZINE', 'DIGITAL', 'REPLACEMENT_COMPONENT', 'BUNDLE', 'OTHER');

-- CreateEnum
CREATE TYPE "contributor_kind" AS ENUM ('PERSON', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "game_relationship_type" AS ENUM ('BASE_GAME', 'EXPANSION_OF', 'STANDALONE_EXPANSION', 'COMPATIBLE_WITH', 'REQUIRES', 'REIMPLEMENTS', 'REIMPLEMENTED_BY', 'INSPIRED_BY', 'BASED_ON', 'ALTERNATIVE_ART', 'PROMO_FOR', 'SAME_UNIVERSE', 'SAME_SERIES', 'SAME_FRANCHISE', 'DIGITAL_IMPLEMENTATION', 'VIDEO_GAME_ADAPTATION', 'MOVIE_ADAPTATION', 'ACCESSORY_FOR', 'SLEEVE_FOR', 'ORGANIZER_FOR', 'UPGRADE_FOR', 'REPLACEMENT_COMPONENT_FOR');

-- CreateEnum
CREATE TYPE "relationship_direction" AS ENUM ('DIRECTED', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "identifier_verification_status" AS ENUM ('UNVERIFIED', 'VERIFIED', 'CONFLICTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "source_claim_status" AS ENUM ('OBSERVED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'CONFLICTED');

-- CreateEnum
CREATE TYPE "import_job_status" AS ENUM ('QUEUED', 'RUNNING', 'PARTIAL', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "image_role" AS ENUM ('BOX_FRONT', 'BOX_BACK', 'COMPONENTS', 'LIFESTYLE', 'RULEBOOK', 'PRODUCT', 'THUMBNAIL', 'OPEN_GRAPH', 'LOGO', 'PUBLISHER_LOGO', 'DESIGNER_PHOTO', 'ARTIST_PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "image_license_status" AS ENUM ('UNKNOWN', 'AUTHORIZED', 'RESTRICTED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "storage_provider" AS ENUM ('LOCAL_FILESYSTEM', 'S3', 'CLOUDFLARE_R2', 'GCS', 'AZURE_BLOB');

-- CreateEnum
CREATE TYPE "seller_integration_provider" AS ENUM ('AMAZON_AFFILIATE', 'MERCADO_LIBRE', 'SHOPIFY', 'TIENDANUBE', 'WOOCOMMERCE', 'EBAY', 'ETSY', 'WALMART', 'CSV', 'CUSTOM_API', 'ERP');

-- CreateEnum
CREATE TYPE "integration_status" AS ENUM ('PENDING_AUTH', 'ACTIVE', 'DEGRADED', 'PAUSED', 'REVOKED');

-- CreateEnum
CREATE TYPE "offer_stock_status" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'BACKORDER', 'DISCONTINUED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "product_condition" AS ENUM ('NEW', 'LIKE_NEW', 'USED_GOOD', 'USED_ACCEPTABLE', 'DAMAGED', 'COLLECTIBLE');

-- CreateEnum
CREATE TYPE "fulfillment_method" AS ENUM ('SELLER_FULFILLED', 'MARKETPLACE_FULFILLED', 'DROPSHIP', 'DIGITAL', 'LOCAL_PICKUP');

-- CreateEnum
CREATE TYPE "match_candidate_status" AS ENUM ('PENDING', 'AUTO_APPROVED', 'NEEDS_REVIEW', 'REJECTED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "match_confidence_level" AS ENUM ('EXACT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "match_decision_type" AS ENUM ('AUTO_APPROVE', 'HUMAN_CONFIRM', 'HUMAN_REJECT', 'REMATCH');

-- CreateEnum
CREATE TYPE "coupon_discount_type" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "sponsored_placement_status" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "affiliate_payout_status" AS ENUM ('UNATTRIBUTED', 'ESTIMATED', 'PENDING', 'CONFIRMED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "alert_type" AS ENUM ('PRICE', 'AVAILABILITY', 'RESTOCK');

-- CreateEnum
CREATE TYPE "alert_status" AS ENUM ('ACTIVE', 'PAUSED', 'TRIGGERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "collection_visibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "seo_page_type" AS ENUM ('ENTITY', 'COLLECTION', 'COMPARISON', 'BEST_LIST', 'DEALS', 'PRICE_HISTORY', 'STORE', 'COUNTRY', 'ARTICLE');

-- CreateEnum
CREATE TYPE "search_document_type" AS ENUM ('GAME', 'PRODUCT', 'OFFER', 'DESIGNER', 'PUBLISHER', 'MECHANIC', 'CATEGORY', 'COLLECTION', 'SEO_LANDING_PAGE');

-- CreateEnum
CREATE TYPE "edge_created_by" AS ENUM ('HUMAN', 'IMPORT', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "award_nomination_result" AS ENUM ('NOMINATED', 'FINALIST', 'WINNER', 'SPECIAL_MENTION');

-- CreateTable
CREATE TABLE "country" (
    "id" TEXT NOT NULL,
    "code" CHAR(2) NOT NULL,
    "iso3Code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCurrency" CHAR(3),
    "defaultLanguage" TEXT,
    "timezone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency" (
    "id" TEXT NOT NULL,
    "code" CHAR(3) NOT NULL,
    "numericCode" CHAR(3),
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "minorUnits" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "iso6391" CHAR(2),
    "name" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'ltr',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "marketplaceType" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_country" (
    "id" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "domain" TEXT,
    "externalCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_source" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "baseUrl" TEXT,
    "trustPriority" INTEGER NOT NULL DEFAULT 100,
    "defaultConfidence" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "termsUrl" TEXT,
    "attributionText" TEXT,
    "imageImportAllowed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_job" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "tenantId" TEXT,
    "integrationId" TEXT,
    "jobType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "import_job_status" NOT NULL DEFAULT 'QUEUED',
    "cursor" TEXT,
    "itemsSeen" BIGINT NOT NULL DEFAULT 0,
    "itemsSucceeded" BIGINT NOT NULL DEFAULT 0,
    "itemsFailed" BIGINT NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "sourceConfidence" DECIMAL(5,4),
    "rawPayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_job_error" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "recordKey" TEXT,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_job_error_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_source_record" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "importJobId" TEXT,
    "externalKey" TEXT NOT NULL,
    "entityHint" TEXT,
    "payloadHash" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "sourceConfidence" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_source_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_claim" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "rawRecordId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "normalizedValue" TEXT,
    "status" "source_claim_status" NOT NULL DEFAULT 'OBSERVED',
    "sourceUrl" TEXT,
    "sourceConfidence" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "rawPayload" JSONB,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_attribution" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldPath" TEXT,
    "sourceUrl" TEXT,
    "sourceConfidence" DECIMAL(5,4),
    "attributionText" TEXT,
    "license" TEXT,
    "rawPayload" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_attribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identifier_namespace" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "entityScope" TEXT[],
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "countryScoped" BOOLEAN NOT NULL DEFAULT false,
    "validationPattern" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identifier_namespace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identifier" (
    "id" TEXT NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "identifierValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "marketplaceCountry" CHAR(2),
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "verificationStatus" "identifier_verification_status" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "sourceAttribution" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_localization" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "alternateTitles" TEXT[],
    "normalizedTitle" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "localizationNotes" TEXT,
    "sourceClaimIds" TEXT[],
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_localization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game" (
    "id" TEXT NOT NULL,
    "canonicalTitle" TEXT NOT NULL,
    "originalTitle" TEXT,
    "normalizedTitle" TEXT NOT NULL,
    "originalLanguageCode" TEXT,
    "description" TEXT,
    "yearPublished" INTEGER,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "recommendedMinPlayers" INTEGER,
    "recommendedMaxPlayers" INTEGER,
    "minPlayTimeMinutes" INTEGER,
    "maxPlayTimeMinutes" INTEGER,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "complexityWeight" DECIMAL(3,2),
    "languageDependencyId" TEXT,
    "officialSiteUrl" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "mergedIntoId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_edition" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "editionName" TEXT NOT NULL,
    "normalizedEditionName" TEXT NOT NULL,
    "editionNumber" TEXT,
    "primaryLanguageCode" TEXT,
    "regionCode" TEXT,
    "publisherId" TEXT,
    "releaseYear" INTEGER,
    "coverStyle" TEXT,
    "componentDifferences" TEXT,
    "ruleChanges" TEXT,
    "localizationNotes" TEXT,
    "compatibilityNotes" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_printing" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "publisherId" TEXT,
    "printingYear" INTEGER,
    "printNumber" TEXT,
    "manufacturingCountry" TEXT,
    "componentCorrections" TEXT,
    "errata" TEXT,
    "boxWidthMm" DECIMAL(10,2),
    "boxHeightMm" DECIMAL(10,2),
    "boxDepthMm" DECIMAL(10,2),
    "weightGrams" INTEGER,
    "productionNotes" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_printing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_product" (
    "id" TEXT NOT NULL,
    "productType" "catalog_product_type" NOT NULL,
    "masterGameId" TEXT,
    "editionId" TEXT,
    "printingId" TEXT,
    "publisherId" TEXT,
    "canonicalTitle" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "description" TEXT,
    "commerceCategory" TEXT,
    "accessoryType" TEXT,
    "boxWidthMm" DECIMAL(10,2),
    "boxHeightMm" DECIMAL(10,2),
    "boxDepthMm" DECIMAL(10,2),
    "weightGrams" INTEGER,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "mergedIntoId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" TEXT NOT NULL,
    "catalogProductId" TEXT NOT NULL,
    "canonicalTitle" TEXT,
    "normalizedTitle" TEXT,
    "languageCode" TEXT,
    "regionCode" TEXT,
    "attributes" JSONB,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'PUBLISHED',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_image_asset" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "storageProvider" "storage_provider" NOT NULL DEFAULT 'LOCAL_FILESYSTEM',
    "originalUrl" TEXT,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "sourceAttribution" TEXT,
    "storageKey" TEXT NOT NULL,
    "localPath" TEXT,
    "cdnUrl" TEXT,
    "sha256" TEXT NOT NULL,
    "perceptualHash" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "dominantColors" TEXT[],
    "altText" TEXT,
    "titleText" TEXT,
    "licenseStatus" "image_license_status" NOT NULL DEFAULT 'UNKNOWN',
    "license" TEXT,
    "licenseExpiresAt" TIMESTAMP(3),
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "aiGeneratedAltText" BOOLEAN NOT NULL DEFAULT false,
    "sourceConfidence" DECIMAL(5,4),
    "rawPayload" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_image_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_asset_variant" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "cdnUrl" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_asset_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" TEXT NOT NULL,
    "catalogProductId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" "image_role" NOT NULL DEFAULT 'PRODUCT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_image" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" "image_role" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designer" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "biography" TEXT,
    "officialSiteUrl" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "biography" TEXT,
    "officialSiteUrl" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "officialSiteUrl" TEXT,
    "countryCode" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "officialSiteUrl" TEXT,
    "countryCode" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_designer" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'designer',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_designer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_artist" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'artist',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_publisher" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'original_publisher',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_studio" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'developer',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanic" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchise" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "rightsHolder" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universe" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_mechanic" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "mechanicId" TEXT NOT NULL,
    "weight" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_mechanic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_category" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_theme" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "weight" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_family" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_series" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "sequence" DECIMAL(10,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_franchise" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_franchise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_game_universe" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_game_universe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "award" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "organizationName" TEXT,
    "countryCode" TEXT,
    "description" TEXT,
    "officialSiteUrl" TEXT,
    "canonicalStatus" "canonical_record_status" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "award_nomination" (
    "id" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "categoryName" TEXT,
    "result" "award_nomination_result" NOT NULL DEFAULT 'NOMINATED',
    "sourceClaimIds" TEXT[],
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_nomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_dependency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "age_rating" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "countryCode" TEXT,
    "ratingCode" TEXT NOT NULL,
    "minimumAge" INTEGER,
    "contentNotes" TEXT,
    "sourceClaimIds" TEXT[],
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "age_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rulebook" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT,
    "editionId" TEXT,
    "printingId" TEXT,
    "languageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "assetId" TEXT,
    "officialUrl" TEXT,
    "pageCount" INTEGER,
    "checksum" TEXT,
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rulebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_implementation" (
    "id" TEXT NOT NULL,
    "masterGameId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "appStoreId" TEXT,
    "supportsOnline" BOOLEAN NOT NULL DEFAULT false,
    "supportsSolo" BOOLEAN NOT NULL DEFAULT false,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_implementation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_compatibility" (
    "id" TEXT NOT NULL,
    "accessoryProductId" TEXT NOT NULL,
    "compatibleMasterGameId" TEXT,
    "compatibleEditionId" TEXT,
    "compatibleProductId" TEXT,
    "compatibilityType" TEXT NOT NULL,
    "fitNotes" TEXT,
    "minQuantity" INTEGER,
    "maxQuantity" INTEGER,
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "sourceClaimIds" TEXT[],
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessory_compatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_relationship" (
    "id" TEXT NOT NULL,
    "sourceGameId" TEXT NOT NULL,
    "targetGameId" TEXT NOT NULL,
    "relationshipType" "game_relationship_type" NOT NULL,
    "direction" "relationship_direction" NOT NULL DEFAULT 'DIRECTED',
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "sourceClaimIds" TEXT[],
    "sourceUrl" TEXT,
    "createdBy" "edge_created_by" NOT NULL,
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_integration" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "tenantId" TEXT,
    "marketplaceId" TEXT,
    "provider" "seller_integration_provider" NOT NULL,
    "status" "integration_status" NOT NULL DEFAULT 'PENDING_AUTH',
    "externalAccountId" TEXT,
    "shopDomain" TEXT,
    "encryptedCredentials" JSONB,
    "scopes" TEXT[],
    "webhookSecretHash" TEXT,
    "syncCatalog" BOOLEAN NOT NULL DEFAULT true,
    "syncInventory" BOOLEAN NOT NULL DEFAULT true,
    "syncPrices" BOOLEAN NOT NULL DEFAULT true,
    "syncOrders" BOOLEAN NOT NULL DEFAULT false,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_market" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "defaultLanguageCode" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "taxConfiguration" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_market" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "settlementCurrencyCode" CHAR(3) NOT NULL,
    "languageCodes" TEXT[],
    "shipsFromCountryCode" CHAR(2),
    "shippingCountries" TEXT[],
    "localPickup" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_account" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT,
    "tenantId" TEXT,
    "marketplaceId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "languageCode" TEXT,
    "campaign" TEXT,
    "channel" TEXT,
    "trackingId" TEXT NOT NULL,
    "encryptedCredentials" JSONB,
    "urlTemplate" TEXT,
    "status" "integration_status" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_source_product" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "sourceId" TEXT NOT NULL,
    "rawRecordId" TEXT,
    "externalProductId" TEXT NOT NULL,
    "externalVariantId" TEXT,
    "parentExternalProductId" TEXT,
    "sellerSku" TEXT,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "brand" TEXT,
    "publisher" TEXT,
    "languageCode" TEXT,
    "editionText" TEXT,
    "printingYear" INTEGER,
    "categoryText" TEXT,
    "imageUrls" TEXT[],
    "dimensions" JSONB,
    "weightGrams" INTEGER,
    "matchedCatalogProductId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT,
    "sourceConfidence" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_source_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_match_candidate" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "candidateProductId" TEXT NOT NULL,
    "score" DECIMAL(6,5) NOT NULL,
    "confidenceLevel" "match_confidence_level" NOT NULL,
    "matchReasons" JSONB NOT NULL,
    "conflictingSignals" JSONB,
    "aiExplanation" TEXT,
    "algorithmVersion" TEXT NOT NULL,
    "status" "match_candidate_status" NOT NULL DEFAULT 'PENDING',
    "reviewer" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "sourceConfidence" DECIMAL(5,4),
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_match_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_match_decision" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "decision" "match_decision_type" NOT NULL,
    "previousStatus" "match_candidate_status",
    "newStatus" "match_candidate_status" NOT NULL,
    "reason" TEXT,
    "decidedBy" TEXT NOT NULL,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_match_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_offer_current" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "integrationId" TEXT,
    "marketplaceId" TEXT,
    "sourceProductId" TEXT,
    "catalogProductId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "countryId" TEXT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "sourceOfferKey" TEXT NOT NULL,
    "sellerSku" TEXT,
    "priceMinor" BIGINT NOT NULL,
    "compareAtPriceMinor" BIGINT,
    "shippingPriceMinor" BIGINT,
    "taxIncluded" BOOLEAN NOT NULL DEFAULT false,
    "taxProfileId" TEXT,
    "returnPolicyId" TEXT,
    "stockStatus" "offer_stock_status" NOT NULL DEFAULT 'UNKNOWN',
    "quantityAvailable" INTEGER,
    "condition" "product_condition" NOT NULL DEFAULT 'NEW',
    "fulfillmentMethod" "fulfillment_method" NOT NULL DEFAULT 'SELLER_FULFILLED',
    "deliveryMinDays" INTEGER,
    "deliveryMaxDays" INTEGER,
    "affiliateUrl" TEXT,
    "directCheckoutUrl" TEXT,
    "marketplaceUrl" TEXT,
    "sourceUrl" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPriceChangeAt" TIMESTAMP(3),
    "lastInventoryChangeAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rankScore" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "rankingAlgorithmVersion" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_offer_current_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_offer_price_history" (
    "id" BIGSERIAL NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offerId" TEXT NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "compareAtPriceMinor" BIGINT,
    "shippingPriceMinor" BIGINT,
    "currencyCode" CHAR(3) NOT NULL,
    "taxIncluded" BOOLEAN NOT NULL,
    "changeReason" TEXT,
    "sourceConfidence" DECIMAL(5,4),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_offer_price_history_pkey" PRIMARY KEY ("observedAt","id")
) PARTITION BY RANGE ("observedAt");

-- CreateTable
CREATE TABLE "seller_offer_inventory_history" (
    "id" BIGSERIAL NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offerId" TEXT NOT NULL,
    "stockStatus" "offer_stock_status" NOT NULL,
    "quantityAvailable" INTEGER,
    "sourceConfidence" DECIMAL(5,4),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_offer_inventory_history_pkey" PRIMARY KEY ("observedAt","id")
) PARTITION BY RANGE ("observedAt");

-- CreateTable
CREATE TABLE "offer_shipping_option" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "shippingCountryCode" CHAR(2) NOT NULL,
    "regionCodes" TEXT[],
    "carrier" TEXT,
    "serviceLevel" TEXT NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "freeThresholdMinor" BIGINT,
    "estimatedMinDays" INTEGER,
    "estimatedMaxDays" INTEGER,
    "localPickup" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_shipping_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_profile" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxIncluded" BOOLEAN NOT NULL DEFAULT false,
    "defaultRate" DECIMAL(7,4),
    "registrationId" TEXT,
    "rules" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_policy" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "countryCode" CHAR(2),
    "name" TEXT NOT NULL,
    "returnWindowDays" INTEGER,
    "returnFeesMinor" BIGINT,
    "currencyCode" CHAR(3),
    "acceptsReturns" BOOLEAN NOT NULL DEFAULT true,
    "returnMethod" TEXT,
    "returnPolicyUrl" TEXT,
    "conditions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "offerId" TEXT,
    "code" TEXT NOT NULL,
    "discountType" "coupon_discount_type" NOT NULL,
    "discountValueMinor" BIGINT,
    "discountPercentage" DECIMAL(7,4),
    "currencyCode" CHAR(3),
    "minimumSpendMinor" BIGINT,
    "maxRedemptions" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashback_rule" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "offerId" TEXT,
    "countryCode" CHAR(2),
    "percentage" DECIMAL(7,4),
    "fixedAmountMinor" BIGINT,
    "currencyCode" CHAR(3),
    "maxAmountMinor" BIGINT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashback_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsored_placement" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "offerId" TEXT,
    "catalogProductId" TEXT,
    "countryCode" TEXT,
    "locale" TEXT,
    "pageType" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "bidMinor" BIGINT,
    "currencyCode" CHAR(3),
    "budgetMinor" BIGINT,
    "status" "sponsored_placement_status" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "disclosureLabel" TEXT NOT NULL DEFAULT 'Sponsored',
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "clicks" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsored_placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_click_event" (
    "id" BIGSERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "affiliateAccountId" TEXT,
    "anonymousVisitorIdHash" TEXT,
    "sessionIdHash" TEXT,
    "customerId" TEXT,
    "catalogProductId" TEXT,
    "offerId" TEXT,
    "sellerId" TEXT,
    "marketplaceCode" TEXT,
    "countryCode" CHAR(2),
    "currencyCode" CHAR(3),
    "pageType" TEXT,
    "position" INTEGER,
    "rankingAlgorithmVersion" TEXT,
    "utm" JSONB,
    "referrerHost" TEXT,
    "deviceType" TEXT,
    "userAgentHash" TEXT,
    "ipPrefix" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_click_event_pkey" PRIMARY KEY ("occurredAt","id")
) PARTITION BY RANGE ("occurredAt");

-- CreateTable
CREATE TABLE "affiliate_event_deduplication" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_event_deduplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_event" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT,
    "affiliateAccountId" TEXT,
    "clickEventId" TEXT,
    "offerId" TEXT,
    "sellerId" TEXT,
    "orderReference" TEXT,
    "countryCode" CHAR(2),
    "currencyCode" CHAR(3) NOT NULL,
    "grossRevenueMinor" BIGINT,
    "estimatedCommissionMinor" BIGINT,
    "confirmedCommissionMinor" BIGINT,
    "payoutStatus" "affiliate_payout_status" NOT NULL DEFAULT 'UNATTRIBUTED',
    "convertedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversion_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_queue_item" (
    "id" TEXT NOT NULL,
    "queueType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "reasonCodes" TEXT[],
    "context" JSONB,
    "dueAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_queue_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_audit_log" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "correlationId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "sourceClaimIds" TEXT[],
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_enrichment_proposal" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "proposedValue" JSONB NOT NULL,
    "confidenceScore" DECIMAL(5,4) NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "accepted" BOOLEAN,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_enrichment_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_collection" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "visibility" "collection_visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_collection_item" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "masterGameId" TEXT,
    "catalogProductId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'owned',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "product_condition",
    "acquiredAt" TIMESTAMP(3),
    "acquisitionPriceMinor" BIGINT,
    "currencyCode" CHAR(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_collection_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "visibility" "collection_visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_item" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "masterGameId" TEXT,
    "catalogProductId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_alert" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "alertType" "alert_type" NOT NULL,
    "status" "alert_status" NOT NULL DEFAULT 'ACTIVE',
    "masterGameId" TEXT,
    "catalogProductId" TEXT,
    "countryCode" CHAR(2),
    "currencyCode" CHAR(3),
    "targetPriceMinor" BIGINT,
    "sellerIds" TEXT[],
    "channelPreferences" JSONB,
    "lastEvaluatedAt" TIMESTAMP(3),
    "lastTriggeredAt" TIMESTAMP(3),
    "nextEvaluationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_profile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "preferredPlayerCounts" INTEGER[],
    "preferredPlayTimes" INTEGER[],
    "preferredComplexityMin" DECIMAL(3,2),
    "preferredComplexityMax" DECIMAL(3,2),
    "preferredMechanicIds" TEXT[],
    "preferredCategoryIds" TEXT[],
    "preferredThemeIds" TEXT[],
    "dislikedGameIds" TEXT[],
    "embedding" DOUBLE PRECISION[],
    "consentedAt" TIMESTAMP(3),
    "lastCalculatedAt" TIMESTAMP(3),
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_page" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "languageId" TEXT NOT NULL,
    "pageType" "seo_page_type" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "countryCode" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "h1" TEXT,
    "intro" TEXT,
    "body" JSONB,
    "faq" JSONB,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "minimumDataMet" BOOLEAN NOT NULL DEFAULT false,
    "structuredData" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "lastGeneratedAt" TIMESTAMP(3),
    "generationVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_slug" (
    "id" TEXT NOT NULL,
    "seoPageId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_slug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_redirect" (
    "id" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "locale" TEXT,
    "destinationUrl" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hitCount" BIGINT NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_data_cache" (
    "id" TEXT NOT NULL,
    "seoPageId" TEXT NOT NULL,
    "schemaType" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "countryCode" TEXT,
    "structuredData" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "validationState" TEXT,
    "validationErrors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structured_data_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_document" (
    "id" TEXT NOT NULL,
    "documentType" "search_document_type" NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "alternateTitles" TEXT[],
    "normalizedTitle" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "localizedSlugs" JSONB NOT NULL,
    "summary" TEXT,
    "imageUrl" TEXT,
    "popularityScore" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "seoScore" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "availabilityScore" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "conversionScore" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "affiliateRevenueScore" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "minPriceMinor" BIGINT,
    "maxPriceMinor" BIGINT,
    "countriesAvailable" TEXT[],
    "currenciesAvailable" TEXT[],
    "structuredFacets" JSONB NOT NULL,
    "searchableText" TEXT NOT NULL,
    "searchVector" tsvector,
    "embedding" DOUBLE PRECISION[],
    "sourceVersion" BIGINT NOT NULL DEFAULT 0,
    "lastIndexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_graph_edge" (
    "id" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "direction" "relationship_direction" NOT NULL DEFAULT 'DIRECTED',
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "createdBy" "edge_created_by" NOT NULL,
    "moderationStatus" "moderation_status" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_graph_edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_event" (
    "id" BIGSERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "anonymousVisitorIdHash" TEXT,
    "sessionIdHash" TEXT,
    "customerId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "sellerId" TEXT,
    "offerId" TEXT,
    "countryCode" CHAR(2),
    "locale" TEXT,
    "pageType" TEXT,
    "position" INTEGER,
    "experiment" JSONB,
    "metrics" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_event_pkey" PRIMARY KEY ("occurredAt","id")
) PARTITION BY RANGE ("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "country_code_key" ON "country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "country_iso3Code_key" ON "country"("iso3Code");

-- CreateIndex
CREATE INDEX "country_active_code_idx" ON "country"("active", "code");

-- CreateIndex
CREATE UNIQUE INDEX "currency_code_key" ON "currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currency_numericCode_key" ON "currency"("numericCode");

-- CreateIndex
CREATE UNIQUE INDEX "language_code_key" ON "language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "language_iso6391_key" ON "language"("iso6391");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_code_key" ON "marketplace"("code");

-- CreateIndex
CREATE INDEX "marketplace_active_marketplaceType_idx" ON "marketplace"("active", "marketplaceType");

-- CreateIndex
CREATE INDEX "marketplace_country_countryId_active_idx" ON "marketplace_country"("countryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_country_marketplaceId_countryId_key" ON "marketplace_country"("marketplaceId", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "data_source_code_key" ON "data_source"("code");

-- CreateIndex
CREATE INDEX "data_source_sourceType_active_idx" ON "data_source"("sourceType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "import_job_idempotencyKey_key" ON "import_job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "import_job_sourceId_status_createdAt_idx" ON "import_job"("sourceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "import_job_status_nextRetryAt_idx" ON "import_job"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "import_job_error_importJobId_retryable_idx" ON "import_job_error"("importJobId", "retryable");

-- CreateIndex
CREATE INDEX "raw_source_record_sourceId_externalKey_observedAt_idx" ON "raw_source_record"("sourceId", "externalKey", "observedAt");

-- CreateIndex
CREATE INDEX "raw_source_record_processedAt_idx" ON "raw_source_record"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "raw_source_record_sourceId_externalKey_payloadHash_key" ON "raw_source_record"("sourceId", "externalKey", "payloadHash");

-- CreateIndex
CREATE INDEX "source_claim_entityType_entityId_fieldPath_status_idx" ON "source_claim"("entityType", "entityId", "fieldPath", "status");

-- CreateIndex
CREATE INDEX "source_claim_sourceId_status_createdAt_idx" ON "source_claim"("sourceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "source_attribution_entityType_entityId_idx" ON "source_attribution"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "source_attribution_sourceId_entityType_entityId_fieldPath_key" ON "source_attribution"("sourceId", "entityType", "entityId", "fieldPath");

-- CreateIndex
CREATE UNIQUE INDEX "identifier_namespace_code_key" ON "identifier_namespace"("code");

-- CreateIndex
CREATE INDEX "external_identifier_namespaceId_normalizedValue_verificatio_idx" ON "external_identifier"("namespaceId", "normalizedValue", "verificationStatus");

-- CreateIndex
CREATE INDEX "external_identifier_entityType_entityId_idx" ON "external_identifier"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "external_identifier_sourceId_lastSeenAt_idx" ON "external_identifier"("sourceId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "external_identifier_namespaceId_entityType_entityId_normali_key" ON "external_identifier"("namespaceId", "entityType", "entityId", "normalizedValue", "sourceId");

-- CreateIndex
CREATE INDEX "entity_localization_languageId_normalizedTitle_idx" ON "entity_localization"("languageId", "normalizedTitle");

-- CreateIndex
CREATE INDEX "entity_localization_entityType_entityId_idx" ON "entity_localization"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_localization_entityType_entityId_languageId_key" ON "entity_localization"("entityType", "entityId", "languageId");

-- CreateIndex
CREATE INDEX "master_game_normalizedTitle_idx" ON "master_game"("normalizedTitle");

-- CreateIndex
CREATE INDEX "master_game_canonicalStatus_moderationStatus_idx" ON "master_game"("canonicalStatus", "moderationStatus");

-- CreateIndex
CREATE INDEX "master_game_yearPublished_idx" ON "master_game"("yearPublished");

-- CreateIndex
CREATE INDEX "master_game_minPlayers_maxPlayers_idx" ON "master_game"("minPlayers", "maxPlayers");

-- CreateIndex
CREATE INDEX "master_game_complexityWeight_idx" ON "master_game"("complexityWeight");

-- CreateIndex
CREATE INDEX "game_edition_masterGameId_canonicalStatus_idx" ON "game_edition"("masterGameId", "canonicalStatus");

-- CreateIndex
CREATE INDEX "game_edition_publisherId_releaseYear_idx" ON "game_edition"("publisherId", "releaseYear");

-- CreateIndex
CREATE UNIQUE INDEX "game_edition_masterGameId_normalizedEditionName_primaryLang_key" ON "game_edition"("masterGameId", "normalizedEditionName", "primaryLanguageCode", "regionCode");

-- CreateIndex
CREATE INDEX "game_printing_editionId_printingYear_printNumber_idx" ON "game_printing"("editionId", "printingYear", "printNumber");

-- CreateIndex
CREATE INDEX "game_printing_publisherId_idx" ON "game_printing"("publisherId");

-- CreateIndex
CREATE INDEX "catalog_product_normalizedTitle_idx" ON "catalog_product"("normalizedTitle");

-- CreateIndex
CREATE INDEX "catalog_product_productType_canonicalStatus_moderationStatu_idx" ON "catalog_product"("productType", "canonicalStatus", "moderationStatus");

-- CreateIndex
CREATE INDEX "catalog_product_masterGameId_productType_idx" ON "catalog_product"("masterGameId", "productType");

-- CreateIndex
CREATE INDEX "catalog_product_editionId_idx" ON "catalog_product"("editionId");

-- CreateIndex
CREATE INDEX "catalog_product_printingId_idx" ON "catalog_product"("printingId");

-- CreateIndex
CREATE INDEX "catalog_product_publisherId_idx" ON "catalog_product"("publisherId");

-- CreateIndex
CREATE INDEX "product_variant_catalogProductId_canonicalStatus_idx" ON "product_variant"("catalogProductId", "canonicalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "local_image_asset_storageKey_key" ON "local_image_asset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "local_image_asset_sha256_key" ON "local_image_asset"("sha256");

-- CreateIndex
CREATE INDEX "local_image_asset_perceptualHash_idx" ON "local_image_asset"("perceptualHash");

-- CreateIndex
CREATE INDEX "local_image_asset_licenseStatus_moderationStatus_idx" ON "local_image_asset"("licenseStatus", "moderationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "image_asset_variant_storageKey_key" ON "image_asset_variant"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "image_asset_variant_assetId_variantName_mimeType_key" ON "image_asset_variant"("assetId", "variantName", "mimeType");

-- CreateIndex
CREATE INDEX "product_image_catalogProductId_isPrimary_sortOrder_idx" ON "product_image"("catalogProductId", "isPrimary", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_image_catalogProductId_assetId_role_key" ON "product_image"("catalogProductId", "assetId", "role");

-- CreateIndex
CREATE INDEX "entity_image_entityType_entityId_isPrimary_sortOrder_idx" ON "entity_image"("entityType", "entityId", "isPrimary", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "entity_image_entityType_entityId_assetId_role_key" ON "entity_image"("entityType", "entityId", "assetId", "role");

-- CreateIndex
CREATE INDEX "designer_normalizedName_idx" ON "designer"("normalizedName");

-- CreateIndex
CREATE INDEX "artist_normalizedName_idx" ON "artist"("normalizedName");

-- CreateIndex
CREATE INDEX "publisher_normalizedName_idx" ON "publisher"("normalizedName");

-- CreateIndex
CREATE INDEX "studio_normalizedName_idx" ON "studio"("normalizedName");

-- CreateIndex
CREATE INDEX "master_game_designer_designerId_masterGameId_idx" ON "master_game_designer"("designerId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_designer_masterGameId_designerId_role_key" ON "master_game_designer"("masterGameId", "designerId", "role");

-- CreateIndex
CREATE INDEX "master_game_artist_artistId_masterGameId_idx" ON "master_game_artist"("artistId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_artist_masterGameId_artistId_role_key" ON "master_game_artist"("masterGameId", "artistId", "role");

-- CreateIndex
CREATE INDEX "master_game_publisher_publisherId_masterGameId_idx" ON "master_game_publisher"("publisherId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_publisher_masterGameId_publisherId_role_key" ON "master_game_publisher"("masterGameId", "publisherId", "role");

-- CreateIndex
CREATE INDEX "master_game_studio_studioId_masterGameId_idx" ON "master_game_studio"("studioId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_studio_masterGameId_studioId_role_key" ON "master_game_studio"("masterGameId", "studioId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "mechanic_normalizedName_key" ON "mechanic"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "category_normalizedName_key" ON "category"("normalizedName");

-- CreateIndex
CREATE INDEX "category_parentId_idx" ON "category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "theme_normalizedName_key" ON "theme"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "family_normalizedName_key" ON "family"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "series_normalizedName_key" ON "series"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "franchise_normalizedName_key" ON "franchise"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "universe_normalizedName_key" ON "universe"("normalizedName");

-- CreateIndex
CREATE INDEX "master_game_mechanic_mechanicId_masterGameId_idx" ON "master_game_mechanic"("mechanicId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_mechanic_masterGameId_mechanicId_key" ON "master_game_mechanic"("masterGameId", "mechanicId");

-- CreateIndex
CREATE INDEX "master_game_category_categoryId_masterGameId_idx" ON "master_game_category"("categoryId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_category_masterGameId_categoryId_key" ON "master_game_category"("masterGameId", "categoryId");

-- CreateIndex
CREATE INDEX "master_game_theme_themeId_masterGameId_idx" ON "master_game_theme"("themeId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_theme_masterGameId_themeId_key" ON "master_game_theme"("masterGameId", "themeId");

-- CreateIndex
CREATE INDEX "master_game_family_familyId_masterGameId_idx" ON "master_game_family"("familyId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_family_masterGameId_familyId_key" ON "master_game_family"("masterGameId", "familyId");

-- CreateIndex
CREATE INDEX "master_game_series_seriesId_sequence_idx" ON "master_game_series"("seriesId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_series_masterGameId_seriesId_key" ON "master_game_series"("masterGameId", "seriesId");

-- CreateIndex
CREATE INDEX "master_game_franchise_franchiseId_masterGameId_idx" ON "master_game_franchise"("franchiseId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_franchise_masterGameId_franchiseId_key" ON "master_game_franchise"("masterGameId", "franchiseId");

-- CreateIndex
CREATE INDEX "master_game_universe_universeId_masterGameId_idx" ON "master_game_universe"("universeId", "masterGameId");

-- CreateIndex
CREATE UNIQUE INDEX "master_game_universe_masterGameId_universeId_key" ON "master_game_universe"("masterGameId", "universeId");

-- CreateIndex
CREATE UNIQUE INDEX "award_normalizedName_organizationName_key" ON "award"("normalizedName", "organizationName");

-- CreateIndex
CREATE INDEX "award_nomination_masterGameId_year_idx" ON "award_nomination"("masterGameId", "year");

-- CreateIndex
CREATE INDEX "award_nomination_awardId_year_result_idx" ON "award_nomination"("awardId", "year", "result");

-- CreateIndex
CREATE UNIQUE INDEX "award_nomination_awardId_masterGameId_year_categoryName_key" ON "award_nomination"("awardId", "masterGameId", "year", "categoryName");

-- CreateIndex
CREATE UNIQUE INDEX "language_dependency_code_key" ON "language_dependency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "language_dependency_rank_key" ON "language_dependency"("rank");

-- CreateIndex
CREATE INDEX "age_rating_countryCode_ratingCode_idx" ON "age_rating"("countryCode", "ratingCode");

-- CreateIndex
CREATE UNIQUE INDEX "age_rating_masterGameId_authority_countryCode_key" ON "age_rating"("masterGameId", "authority", "countryCode");

-- CreateIndex
CREATE INDEX "rulebook_masterGameId_languageId_idx" ON "rulebook"("masterGameId", "languageId");

-- CreateIndex
CREATE INDEX "rulebook_editionId_languageId_idx" ON "rulebook"("editionId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "digital_implementation_masterGameId_platform_url_key" ON "digital_implementation"("masterGameId", "platform", "url");

-- CreateIndex
CREATE INDEX "accessory_compatibility_compatibleMasterGameId_compatibilit_idx" ON "accessory_compatibility"("compatibleMasterGameId", "compatibilityType");

-- CreateIndex
CREATE INDEX "accessory_compatibility_compatibleEditionId_idx" ON "accessory_compatibility"("compatibleEditionId");

-- CreateIndex
CREATE INDEX "accessory_compatibility_compatibleProductId_idx" ON "accessory_compatibility"("compatibleProductId");

-- CreateIndex
CREATE INDEX "game_relationship_targetGameId_relationshipType_idx" ON "game_relationship"("targetGameId", "relationshipType");

-- CreateIndex
CREATE INDEX "game_relationship_sourceGameId_relationshipType_moderationS_idx" ON "game_relationship"("sourceGameId", "relationshipType", "moderationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "game_relationship_sourceGameId_targetGameId_relationshipTyp_key" ON "game_relationship"("sourceGameId", "targetGameId", "relationshipType");

-- CreateIndex
CREATE INDEX "seller_integration_tenantId_status_idx" ON "seller_integration"("tenantId", "status");

-- CreateIndex
CREATE INDEX "seller_integration_provider_status_idx" ON "seller_integration"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_integration_sellerId_provider_externalAccountId_key" ON "seller_integration"("sellerId", "provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "tenant_market_countryId_active_idx" ON "tenant_market"("countryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_market_tenantId_countryId_currencyCode_defaultLangua_key" ON "tenant_market"("tenantId", "countryId", "currencyCode", "defaultLanguageCode");

-- CreateIndex
CREATE INDEX "seller_market_countryId_active_idx" ON "seller_market"("countryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "seller_market_sellerId_countryId_settlementCurrencyCode_key" ON "seller_market"("sellerId", "countryId", "settlementCurrencyCode");

-- CreateIndex
CREATE INDEX "affiliate_account_tenantId_countryId_status_idx" ON "affiliate_account"("tenantId", "countryId", "status");

-- CreateIndex
CREATE INDEX "affiliate_account_sellerId_status_idx" ON "affiliate_account"("sellerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_account_marketplaceId_countryId_trackingId_campai_key" ON "affiliate_account"("marketplaceId", "countryId", "trackingId", "campaign", "channel");

-- CreateIndex
CREATE INDEX "seller_source_product_sellerId_active_lastSeenAt_idx" ON "seller_source_product"("sellerId", "active", "lastSeenAt");

-- CreateIndex
CREATE INDEX "seller_source_product_integrationId_lastSeenAt_idx" ON "seller_source_product"("integrationId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "seller_source_product_matchedCatalogProductId_idx" ON "seller_source_product"("matchedCatalogProductId");

-- CreateIndex
CREATE INDEX "seller_source_product_normalizedTitle_idx" ON "seller_source_product"("normalizedTitle");

-- CreateIndex
CREATE UNIQUE INDEX "seller_source_product_sellerId_integrationId_externalProduc_key" ON "seller_source_product"("sellerId", "integrationId", "externalProductId", "externalVariantId");

-- CreateIndex
CREATE INDEX "product_match_candidate_status_score_createdAt_idx" ON "product_match_candidate"("status", "score", "createdAt");

-- CreateIndex
CREATE INDEX "product_match_candidate_candidateProductId_status_idx" ON "product_match_candidate"("candidateProductId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_match_candidate_sourceProductId_candidateProductId__key" ON "product_match_candidate"("sourceProductId", "candidateProductId", "algorithmVersion");

-- CreateIndex
CREATE INDEX "product_match_decision_candidateId_createdAt_idx" ON "product_match_decision"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "product_match_decision_decidedBy_createdAt_idx" ON "product_match_decision"("decidedBy", "createdAt");

-- CreateIndex
CREATE INDEX "seller_offer_current_catalogProductId_countryId_currencyCod_idx" ON "seller_offer_current"("catalogProductId", "countryId", "currencyCode", "active", "priceMinor");

-- CreateIndex
CREATE INDEX "seller_offer_current_sellerId_active_lastSeenAt_idx" ON "seller_offer_current"("sellerId", "active", "lastSeenAt");

-- CreateIndex
CREATE INDEX "seller_offer_current_countryId_stockStatus_active_idx" ON "seller_offer_current"("countryId", "stockStatus", "active");

-- CreateIndex
CREATE INDEX "seller_offer_current_marketplaceId_countryId_active_idx" ON "seller_offer_current"("marketplaceId", "countryId", "active");

-- CreateIndex
CREATE INDEX "seller_offer_current_lastSeenAt_active_idx" ON "seller_offer_current"("lastSeenAt", "active");

-- CreateIndex
CREATE UNIQUE INDEX "seller_offer_current_sellerId_sourceOfferKey_key" ON "seller_offer_current"("sellerId", "sourceOfferKey");

-- CreateIndex
CREATE INDEX "seller_offer_price_history_offerId_observedAt_idx" ON "seller_offer_price_history"("offerId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "seller_offer_price_history_currencyCode_observedAt_idx" ON "seller_offer_price_history"("currencyCode", "observedAt");

-- CreateIndex
CREATE INDEX "seller_offer_inventory_history_offerId_observedAt_idx" ON "seller_offer_inventory_history"("offerId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "seller_offer_inventory_history_stockStatus_observedAt_idx" ON "seller_offer_inventory_history"("stockStatus", "observedAt");

-- CreateIndex
CREATE INDEX "offer_shipping_option_offerId_shippingCountryCode_active_idx" ON "offer_shipping_option"("offerId", "shippingCountryCode", "active");

-- CreateIndex
CREATE INDEX "tax_profile_countryId_active_idx" ON "tax_profile"("countryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "tax_profile_sellerId_countryId_name_key" ON "tax_profile"("sellerId", "countryId", "name");

-- CreateIndex
CREATE INDEX "return_policy_sellerId_countryCode_active_idx" ON "return_policy"("sellerId", "countryCode", "active");

-- CreateIndex
CREATE INDEX "coupon_offerId_active_startsAt_endsAt_idx" ON "coupon"("offerId", "active", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_sellerId_code_key" ON "coupon"("sellerId", "code");

-- CreateIndex
CREATE INDEX "cashback_rule_sellerId_countryCode_active_idx" ON "cashback_rule"("sellerId", "countryCode", "active");

-- CreateIndex
CREATE INDEX "cashback_rule_offerId_active_idx" ON "cashback_rule"("offerId", "active");

-- CreateIndex
CREATE INDEX "sponsored_placement_pageType_placement_countryCode_locale_s_idx" ON "sponsored_placement"("pageType", "placement", "countryCode", "locale", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "sponsored_placement_sellerId_status_idx" ON "sponsored_placement"("sellerId", "status");

-- CreateIndex
CREATE INDEX "affiliate_click_event_offerId_occurredAt_idx" ON "affiliate_click_event"("offerId", "occurredAt");

-- CreateIndex
CREATE INDEX "affiliate_click_event_sellerId_occurredAt_idx" ON "affiliate_click_event"("sellerId", "occurredAt");

-- CreateIndex
CREATE INDEX "affiliate_click_event_anonymousVisitorIdHash_occurredAt_idx" ON "affiliate_click_event"("anonymousVisitorIdHash", "occurredAt");

-- CreateIndex
CREATE INDEX "affiliate_click_event_affiliateAccountId_occurredAt_idx" ON "affiliate_click_event"("affiliateAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "affiliate_click_event_eventId_idx" ON "affiliate_click_event"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_event_deduplication_eventId_key" ON "affiliate_event_deduplication"("eventId");

-- CreateIndex
CREATE INDEX "affiliate_event_deduplication_occurredAt_idx" ON "affiliate_event_deduplication"("occurredAt");

-- CreateIndex
CREATE INDEX "conversion_event_sellerId_convertedAt_idx" ON "conversion_event"("sellerId", "convertedAt");

-- CreateIndex
CREATE INDEX "conversion_event_payoutStatus_convertedAt_idx" ON "conversion_event"("payoutStatus", "convertedAt");

-- CreateIndex
CREATE INDEX "conversion_event_clickEventId_idx" ON "conversion_event"("clickEventId");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_event_affiliateAccountId_externalEventId_key" ON "conversion_event"("affiliateAccountId", "externalEventId");

-- CreateIndex
CREATE INDEX "moderation_queue_item_moderationStatus_priority_createdAt_idx" ON "moderation_queue_item"("moderationStatus", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "moderation_queue_item_assignedTo_moderationStatus_idx" ON "moderation_queue_item"("assignedTo", "moderationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_queue_item_queueType_entityType_entityId_moderat_key" ON "moderation_queue_item"("queueType", "entityType", "entityId", "moderationStatus");

-- CreateIndex
CREATE INDEX "canonical_audit_log_entityType_entityId_createdAt_idx" ON "canonical_audit_log"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "canonical_audit_log_actorId_createdAt_idx" ON "canonical_audit_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "canonical_audit_log_correlationId_idx" ON "canonical_audit_log"("correlationId");

-- CreateIndex
CREATE INDEX "ai_enrichment_proposal_entityType_entityId_fieldPath_modera_idx" ON "ai_enrichment_proposal"("entityType", "entityId", "fieldPath", "moderationStatus");

-- CreateIndex
CREATE INDEX "ai_enrichment_proposal_modelName_generatedAt_idx" ON "ai_enrichment_proposal"("modelName", "generatedAt");

-- CreateIndex
CREATE INDEX "user_collection_visibility_updatedAt_idx" ON "user_collection"("visibility", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_collection_customerId_name_key" ON "user_collection"("customerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "user_collection_customerId_slug_key" ON "user_collection"("customerId", "slug");

-- CreateIndex
CREATE INDEX "user_collection_item_masterGameId_idx" ON "user_collection_item"("masterGameId");

-- CreateIndex
CREATE INDEX "user_collection_item_catalogProductId_idx" ON "user_collection_item"("catalogProductId");

-- CreateIndex
CREATE UNIQUE INDEX "user_collection_item_collectionId_masterGameId_catalogProdu_key" ON "user_collection_item"("collectionId", "masterGameId", "catalogProductId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_customerId_name_key" ON "wishlist"("customerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_customerId_slug_key" ON "wishlist"("customerId", "slug");

-- CreateIndex
CREATE INDEX "wishlist_item_masterGameId_idx" ON "wishlist_item"("masterGameId");

-- CreateIndex
CREATE INDEX "wishlist_item_catalogProductId_idx" ON "wishlist_item"("catalogProductId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_item_wishlistId_masterGameId_catalogProductId_key" ON "wishlist_item"("wishlistId", "masterGameId", "catalogProductId");

-- CreateIndex
CREATE INDEX "user_alert_status_nextEvaluationAt_idx" ON "user_alert"("status", "nextEvaluationAt");

-- CreateIndex
CREATE INDEX "user_alert_customerId_alertType_status_idx" ON "user_alert"("customerId", "alertType", "status");

-- CreateIndex
CREATE INDEX "user_alert_catalogProductId_countryCode_status_idx" ON "user_alert"("catalogProductId", "countryCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_profile_customerId_key" ON "recommendation_profile"("customerId");

-- CreateIndex
CREATE INDEX "seo_page_entityType_entityId_locale_idx" ON "seo_page"("entityType", "entityId", "locale");

-- CreateIndex
CREATE INDEX "seo_page_pageType_locale_indexable_idx" ON "seo_page"("pageType", "locale", "indexable");

-- CreateIndex
CREATE INDEX "seo_page_indexable_qualityScore_idx" ON "seo_page"("indexable", "qualityScore");

-- CreateIndex
CREATE UNIQUE INDEX "seo_page_locale_countryCode_slug_key" ON "seo_page"("locale", "countryCode", "slug");

-- CreateIndex
CREATE INDEX "seo_slug_seoPageId_isCurrent_idx" ON "seo_slug"("seoPageId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "seo_slug_locale_slug_key" ON "seo_slug"("locale", "slug");

-- CreateIndex
CREATE INDEX "seo_redirect_active_expiresAt_idx" ON "seo_redirect"("active", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "seo_redirect_sourcePath_locale_key" ON "seo_redirect"("sourcePath", "locale");

-- CreateIndex
CREATE INDEX "structured_data_cache_expiresAt_idx" ON "structured_data_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "structured_data_cache_seoPageId_schemaType_locale_countryCo_key" ON "structured_data_cache"("seoPageId", "schemaType", "locale", "countryCode");

-- CreateIndex
CREATE INDEX "search_document_documentType_locale_popularityScore_idx" ON "search_document"("documentType", "locale", "popularityScore" DESC);

-- CreateIndex
CREATE INDEX "search_document_slug_locale_idx" ON "search_document"("slug", "locale");

-- CreateIndex
CREATE INDEX "search_document_lastIndexedAt_idx" ON "search_document"("lastIndexedAt");

-- CreateIndex
CREATE UNIQUE INDEX "search_document_documentType_canonicalId_locale_key" ON "search_document"("documentType", "canonicalId", "locale");

-- CreateIndex
CREATE INDEX "knowledge_graph_edge_sourceEntityType_sourceEntityId_relati_idx" ON "knowledge_graph_edge"("sourceEntityType", "sourceEntityId", "relationshipType", "moderationStatus");

-- CreateIndex
CREATE INDEX "knowledge_graph_edge_targetEntityType_targetEntityId_relati_idx" ON "knowledge_graph_edge"("targetEntityType", "targetEntityId", "relationshipType", "moderationStatus");

-- CreateIndex
CREATE INDEX "knowledge_graph_edge_sourceId_createdAt_idx" ON "knowledge_graph_edge"("sourceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_graph_edge_sourceEntityType_sourceEntityId_target_key" ON "knowledge_graph_edge"("sourceEntityType", "sourceEntityId", "targetEntityType", "targetEntityId", "relationshipType");

-- CreateIndex
CREATE INDEX "analytics_event_eventType_occurredAt_idx" ON "analytics_event"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_event_entityType_entityId_occurredAt_idx" ON "analytics_event"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_event_sellerId_occurredAt_idx" ON "analytics_event"("sellerId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_event_eventId_idx" ON "analytics_event"("eventId");

-- AddForeignKey
ALTER TABLE "marketplace_country" ADD CONSTRAINT "marketplace_country_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_country" ADD CONSTRAINT "marketplace_country_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "seller_integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job_error" ADD CONSTRAINT "import_job_error_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_source_record" ADD CONSTRAINT "raw_source_record_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_source_record" ADD CONSTRAINT "raw_source_record_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_claim" ADD CONSTRAINT "source_claim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_claim" ADD CONSTRAINT "source_claim_rawRecordId_fkey" FOREIGN KEY ("rawRecordId") REFERENCES "raw_source_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_attribution" ADD CONSTRAINT "source_attribution_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identifier" ADD CONSTRAINT "external_identifier_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "identifier_namespace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identifier" ADD CONSTRAINT "external_identifier_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_localization" ADD CONSTRAINT "entity_localization_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game" ADD CONSTRAINT "master_game_languageDependencyId_fkey" FOREIGN KEY ("languageDependencyId") REFERENCES "language_dependency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game" ADD CONSTRAINT "master_game_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "master_game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_edition" ADD CONSTRAINT "game_edition_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_edition" ADD CONSTRAINT "game_edition_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_printing" ADD CONSTRAINT "game_printing_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "game_edition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_printing" ADD CONSTRAINT "game_printing_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "game_edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_printingId_fkey" FOREIGN KEY ("printingId") REFERENCES "game_printing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "catalog_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_image_asset" ADD CONSTRAINT "local_image_asset_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_asset_variant" ADD CONSTRAINT "image_asset_variant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "local_image_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "local_image_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_image" ADD CONSTRAINT "entity_image_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "local_image_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_designer" ADD CONSTRAINT "master_game_designer_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_designer" ADD CONSTRAINT "master_game_designer_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "designer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_artist" ADD CONSTRAINT "master_game_artist_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_artist" ADD CONSTRAINT "master_game_artist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_publisher" ADD CONSTRAINT "master_game_publisher_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_publisher" ADD CONSTRAINT "master_game_publisher_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_studio" ADD CONSTRAINT "master_game_studio_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_studio" ADD CONSTRAINT "master_game_studio_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_mechanic" ADD CONSTRAINT "master_game_mechanic_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_mechanic" ADD CONSTRAINT "master_game_mechanic_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "mechanic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_category" ADD CONSTRAINT "master_game_category_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_category" ADD CONSTRAINT "master_game_category_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_theme" ADD CONSTRAINT "master_game_theme_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_theme" ADD CONSTRAINT "master_game_theme_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_family" ADD CONSTRAINT "master_game_family_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_family" ADD CONSTRAINT "master_game_family_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_series" ADD CONSTRAINT "master_game_series_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_series" ADD CONSTRAINT "master_game_series_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_franchise" ADD CONSTRAINT "master_game_franchise_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_franchise" ADD CONSTRAINT "master_game_franchise_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_universe" ADD CONSTRAINT "master_game_universe_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_game_universe" ADD CONSTRAINT "master_game_universe_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "universe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "award_nomination" ADD CONSTRAINT "award_nomination_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "award"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "award_nomination" ADD CONSTRAINT "award_nomination_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "age_rating" ADD CONSTRAINT "age_rating_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rulebook" ADD CONSTRAINT "rulebook_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rulebook" ADD CONSTRAINT "rulebook_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "game_edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rulebook" ADD CONSTRAINT "rulebook_printingId_fkey" FOREIGN KEY ("printingId") REFERENCES "game_printing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rulebook" ADD CONSTRAINT "rulebook_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_implementation" ADD CONSTRAINT "digital_implementation_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_compatibility" ADD CONSTRAINT "accessory_compatibility_accessoryProductId_fkey" FOREIGN KEY ("accessoryProductId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_compatibility" ADD CONSTRAINT "accessory_compatibility_compatibleMasterGameId_fkey" FOREIGN KEY ("compatibleMasterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_compatibility" ADD CONSTRAINT "accessory_compatibility_compatibleEditionId_fkey" FOREIGN KEY ("compatibleEditionId") REFERENCES "game_edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_compatibility" ADD CONSTRAINT "accessory_compatibility_compatibleProductId_fkey" FOREIGN KEY ("compatibleProductId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_relationship" ADD CONSTRAINT "game_relationship_sourceGameId_fkey" FOREIGN KEY ("sourceGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_relationship" ADD CONSTRAINT "game_relationship_targetGameId_fkey" FOREIGN KEY ("targetGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_integration" ADD CONSTRAINT "seller_integration_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_integration" ADD CONSTRAINT "seller_integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_integration" ADD CONSTRAINT "seller_integration_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_market" ADD CONSTRAINT "tenant_market_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_market" ADD CONSTRAINT "tenant_market_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_market" ADD CONSTRAINT "seller_market_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_market" ADD CONSTRAINT "seller_market_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_account" ADD CONSTRAINT "affiliate_account_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_account" ADD CONSTRAINT "affiliate_account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_account" ADD CONSTRAINT "affiliate_account_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_account" ADD CONSTRAINT "affiliate_account_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_source_product" ADD CONSTRAINT "seller_source_product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_source_product" ADD CONSTRAINT "seller_source_product_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "seller_integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_source_product" ADD CONSTRAINT "seller_source_product_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_source_product" ADD CONSTRAINT "seller_source_product_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_source_product" ADD CONSTRAINT "seller_source_product_rawRecordId_fkey" FOREIGN KEY ("rawRecordId") REFERENCES "raw_source_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_source_product" ADD CONSTRAINT "seller_source_product_matchedCatalogProductId_fkey" FOREIGN KEY ("matchedCatalogProductId") REFERENCES "catalog_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_match_candidate" ADD CONSTRAINT "product_match_candidate_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "seller_source_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_match_candidate" ADD CONSTRAINT "product_match_candidate_candidateProductId_fkey" FOREIGN KEY ("candidateProductId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_match_decision" ADD CONSTRAINT "product_match_decision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "product_match_candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "seller_integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "seller_source_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "catalog_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_taxProfileId_fkey" FOREIGN KEY ("taxProfileId") REFERENCES "tax_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_current" ADD CONSTRAINT "seller_offer_current_returnPolicyId_fkey" FOREIGN KEY ("returnPolicyId") REFERENCES "return_policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_price_history" ADD CONSTRAINT "seller_offer_price_history_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "seller_offer_current"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_offer_inventory_history" ADD CONSTRAINT "seller_offer_inventory_history_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "seller_offer_current"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_shipping_option" ADD CONSTRAINT "offer_shipping_option_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "seller_offer_current"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_profile" ADD CONSTRAINT "tax_profile_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_profile" ADD CONSTRAINT "tax_profile_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_policy" ADD CONSTRAINT "return_policy_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "seller_offer_current"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashback_rule" ADD CONSTRAINT "cashback_rule_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashback_rule" ADD CONSTRAINT "cashback_rule_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "seller_offer_current"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsored_placement" ADD CONSTRAINT "sponsored_placement_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsored_placement" ADD CONSTRAINT "sponsored_placement_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "seller_offer_current"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_click_event" ADD CONSTRAINT "affiliate_click_event_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "affiliate_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_click_event" ADD CONSTRAINT "affiliate_click_event_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "seller_offer_current"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_click_event" ADD CONSTRAINT "affiliate_click_event_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_event" ADD CONSTRAINT "conversion_event_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "affiliate_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_event" ADD CONSTRAINT "conversion_event_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "seller_offer_current"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_event" ADD CONSTRAINT "conversion_event_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MktCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collection_item" ADD CONSTRAINT "user_collection_item_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "user_collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collection_item" ADD CONSTRAINT "user_collection_item_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collection_item" ADD CONSTRAINT "user_collection_item_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "catalog_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MktCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "catalog_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_alert" ADD CONSTRAINT "user_alert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MktCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_alert" ADD CONSTRAINT "user_alert_masterGameId_fkey" FOREIGN KEY ("masterGameId") REFERENCES "master_game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_alert" ADD CONSTRAINT "user_alert_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_profile" ADD CONSTRAINT "recommendation_profile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MktCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_page" ADD CONSTRAINT "seo_page_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_page" ADD CONSTRAINT "seo_page_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_slug" ADD CONSTRAINT "seo_slug_seoPageId_fkey" FOREIGN KEY ("seoPageId") REFERENCES "seo_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_data_cache" ADD CONSTRAINT "structured_data_cache_seoPageId_fkey" FOREIGN KEY ("seoPageId") REFERENCES "seo_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_graph_edge" ADD CONSTRAINT "knowledge_graph_edge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
