-- Editorial content becomes database-owned. Source modules remain idempotent
-- seed fixtures for the accompanying migrate-editorial-content.ts data migration.

CREATE TABLE "editorial_author" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" CHAR(2) NOT NULL,
    "from" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "bio" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "expertise" JSONB NOT NULL,
    "reviewPrinciples" JSONB NOT NULL,
    "leans" JSONB NOT NULL,
    "signoff" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "editorial_author_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "editorial_article" (
    "id" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "originalLocale" CHAR(2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "heroImage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "editorial_article_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "editorial_article_translation" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locale" CHAR(2) NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "intro" JSONB NOT NULL,
    "picks" JSONB NOT NULL,
    "sections" JSONB,
    "faq" JSONB,
    "sources" JSONB,
    "wordCount" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "editorial_article_translation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "editorial_article_revision" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "actorId" TEXT,
    "changeNote" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "editorial_article_revision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "editorial_author_slug_key" ON "editorial_author"("slug");
CREATE INDEX "editorial_author_locale_status_name_idx" ON "editorial_author"("locale", "status", "name");
CREATE UNIQUE INDEX "editorial_article_canonicalKey_key" ON "editorial_article"("canonicalKey");
CREATE INDEX "editorial_article_status_publishedAt_idx" ON "editorial_article"("status", "publishedAt");
CREATE INDEX "editorial_article_authorId_status_publishedAt_idx" ON "editorial_article"("authorId", "status", "publishedAt");
CREATE UNIQUE INDEX "editorial_article_translation_locale_slug_key" ON "editorial_article_translation"("locale", "slug");
CREATE UNIQUE INDEX "editorial_article_translation_articleId_locale_key" ON "editorial_article_translation"("articleId", "locale");
CREATE INDEX "editorial_article_translation_locale_updatedAt_idx" ON "editorial_article_translation"("locale", "updatedAt");
CREATE UNIQUE INDEX "editorial_article_revision_articleId_revision_key" ON "editorial_article_revision"("articleId", "revision");
CREATE INDEX "editorial_article_revision_articleId_createdAt_idx" ON "editorial_article_revision"("articleId", "createdAt");

ALTER TABLE "editorial_article"
  ADD CONSTRAINT "editorial_article_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "editorial_author"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "editorial_article_translation"
  ADD CONSTRAINT "editorial_article_translation_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "editorial_article"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "editorial_article_revision"
  ADD CONSTRAINT "editorial_article_revision_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "editorial_article"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
