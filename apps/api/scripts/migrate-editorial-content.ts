/**
 * Idempotent editorial data migration.
 *
 * The typed source modules are seed fixtures, not the runtime source of truth.
 * Run after Prisma migrations:
 *   pnpm tsx apps/api/scripts/migrate-editorial-content.ts
 */
import { PrismaClient } from '@prisma/client';
import { AUTHORS } from '../../../apps/web/src/content/editorial/authors.js';
import { allGuidesRaw, localizeGuide, type Guide } from '../../../apps/web/src/lib/guides.js';
import type { Locale } from '../../../apps/web/src/lib/segments.js';

const prisma = new PrismaClient();
const locales: Locale[] = ['es', 'en'];

function wordCount(guide: Guide): number {
  return [
    guide.title,
    guide.description,
    ...guide.intro,
    ...guide.picks.flatMap((pick) => [pick.blurb]),
    ...(guide.sections ?? []).flatMap((section) => [section.heading, ...section.paragraphs]),
    ...(guide.faq ?? []).flatMap((item) => [item.q, item.a]),
  ].join(' ').trim().split(/\s+/).filter(Boolean).length;
}

async function main() {
  for (const author of AUTHORS) {
    const data = {
      slug: author.id,
      name: author.name,
      locale: author.locale,
      from: author.from,
      countryCode: author.countryCode,
      bio: author.bio,
      role: author.role,
      voice: author.voice,
      expertise: author.expertise,
      reviewPrinciples: author.reviewPrinciples,
      leans: author.leans,
      signoff: author.signoff,
      status: 'active',
    };
    await prisma.editorialAuthor.upsert({
      where: { id: author.id },
      create: { id: author.id, ...data },
      update: data,
    });
  }

  for (const raw of allGuidesRaw()) {
    if (!raw.authorId) throw new Error(`Guide ${raw.slug} has no author`);
    const article = await prisma.editorialArticle.upsert({
      where: { canonicalKey: raw.slug },
      create: {
        canonicalKey: raw.slug,
        authorId: raw.authorId,
        originalLocale: raw.originalLocale ?? 'es',
        status: 'published',
        heroImage: raw.ogImage,
        publishedAt: new Date(`${raw.publishedAt}T00:00:00.000Z`),
      },
      update: {
        authorId: raw.authorId,
        originalLocale: raw.originalLocale ?? 'es',
        status: 'published',
        heroImage: raw.ogImage,
        publishedAt: new Date(`${raw.publishedAt}T00:00:00.000Z`),
      },
    });

    for (const locale of locales) {
      const guide = localizeGuide(raw, locale);
      const data = {
        articleId: article.id,
        locale,
        slug: guide.slug,
        title: guide.title,
        description: guide.description,
        intro: guide.intro,
        picks: guide.picks,
        sections: guide.sections ?? [],
        faq: guide.faq ?? [],
        sources: guide.sources ?? [],
        wordCount: wordCount(guide),
        reviewedAt: guide.autoTranslated ? null : new Date(`${guide.updatedAt}T00:00:00.000Z`),
      };
      await prisma.editorialArticleTranslation.upsert({
        where: { articleId_locale: { articleId: article.id, locale } },
        create: data,
        update: data,
      });
    }

    const existingRevision = await prisma.editorialArticleRevision.findUnique({
      where: { articleId_revision: { articleId: article.id, revision: 1 } },
      select: { id: true },
    });
    if (!existingRevision) {
      await prisma.editorialArticleRevision.create({
        data: {
          articleId: article.id,
          revision: 1,
          actorId: 'content-migration',
          changeNote: 'Initial database migration from reviewed source fixtures',
          snapshot: {
            canonicalKey: raw.slug,
            authorId: raw.authorId,
            status: 'published',
            translations: Object.fromEntries(
              locales.map((locale) => [locale, localizeGuide(raw, locale)]),
            ),
          },
        },
      });
    }
  }

  const [authors, articles, translations, revisions] = await Promise.all([
    prisma.editorialAuthor.count(),
    prisma.editorialArticle.count(),
    prisma.editorialArticleTranslation.count(),
    prisma.editorialArticleRevision.count(),
  ]);
  console.log(JSON.stringify({ authors, articles, translations, revisions }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
