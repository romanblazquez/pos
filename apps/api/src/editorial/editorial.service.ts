import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@retail-os/db-postgres';
import type { Prisma } from '@prisma/client';

type EditorialRow = Prisma.EditorialArticleTranslationGetPayload<{
  include: {
    article: {
      include: {
        author: true;
        translations: { select: { locale: true; slug: true } };
      };
    };
  };
}>;

@Injectable()
export class EditorialService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async publishedGuides(locale: string) {
    const normalized = locale === 'en' ? 'en' : 'es';
    const rows = await this.prisma.editorialArticleTranslation.findMany({
      where: {
        locale: normalized,
        article: { status: 'published', publishedAt: { lte: new Date() } },
      },
      include: {
        article: {
          include: {
            author: true,
            translations: { select: { locale: true, slug: true } },
          },
        },
      },
      orderBy: [{ article: { publishedAt: 'desc' } }, { title: 'asc' }],
    });
    return rows.map((row) => this.toGuide(row));
  }

  async publishedGuide(slug: string, locale: string) {
    const normalized = locale === 'en' ? 'en' : 'es';
    const row = await this.prisma.editorialArticleTranslation.findFirst({
      where: {
        locale: normalized,
        slug,
        article: { status: 'published', publishedAt: { lte: new Date() } },
      },
      include: {
        article: {
          include: {
            author: true,
            translations: { select: { locale: true, slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Editorial article not found');
    return this.toGuide(row);
  }

  async authors(locale?: string) {
    return this.prisma.editorialAuthor.findMany({
      where: {
        status: 'active',
        ...(locale === 'es' || locale === 'en' ? { locale } : {}),
      },
      orderBy: [{ locale: 'asc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, locale: true, from: true,
        countryCode: true, bio: true, role: true, expertise: true,
        reviewPrinciples: true, voice: true, leans: true, signoff: true,
        _count: { select: { articles: true } },
      },
    });
  }

  async adminArticles() {
    return this.prisma.editorialArticle.findMany({
      include: {
        author: { select: { id: true, name: true } },
        translations: {
          select: {
            locale: true, slug: true, title: true, wordCount: true,
            reviewedAt: true, updatedAt: true,
          },
        },
        _count: { select: { revisions: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  private toGuide(row: EditorialRow) {
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      authorId: row.article.authorId,
      originalLocale: row.article.originalLocale,
      intro: row.intro,
      picks: row.picks,
      sections: row.sections ?? [],
      faq: row.faq ?? [],
      sources: row.sources ?? [],
      publishedAt: row.article.publishedAt!.toISOString().slice(0, 10),
      updatedAt: row.updatedAt.toISOString().slice(0, 10),
      ogImage: row.article.heroImage,
      autoTranslated: row.reviewedAt === null,
      alternates: Object.fromEntries(
        row.article.translations.map((translation) => [
          translation.locale,
          translation.slug,
        ]),
      ),
      author: {
        id: row.article.author.id,
        // Drives the byline link and the Article/Person `url` on the web side.
        slug: row.article.author.slug,
        name: row.article.author.name,
        locale: row.article.author.locale,
        from: row.article.author.from,
        countryCode: row.article.author.countryCode,
        bio: row.article.author.bio,
        role: row.article.author.role,
        voice: row.article.author.voice,
        expertise: row.article.author.expertise,
        reviewPrinciples: row.article.author.reviewPrinciples,
        leans: row.article.author.leans,
        signoff: row.article.author.signoff,
      },
    };
  }

}
