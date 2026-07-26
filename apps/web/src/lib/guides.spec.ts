import { describe, expect, it } from 'vitest';
import { AUTHORS, AUTHORS_BY_ID } from '../content/editorial/authors.js';
import { allGuidesRaw, editorPath, editorSlug, localizeGuide } from './guides.js';
import { articleLd, personLd } from './jsonld.js';

describe('editorial guide catalogue', () => {
  const guides = allGuidesRaw();

  it('has one valid author and two unique localized slugs per article', () => {
    expect(guides).toHaveLength(17);
    const seen = new Set<string>();
    for (const guide of guides) {
      expect(AUTHORS_BY_ID[guide.authorId ?? '']).toBeDefined();
      for (const locale of ['es', 'en'] as const) {
        const localized = localizeGuide(guide, locale);
        const key = `${locale}:${localized.slug}`;
        expect(seen.has(key), `duplicate localized slug ${key}`).toBe(false);
        expect(localized.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        seen.add(key);
      }
    }
  });

  it('keeps every product link and article block bounded and useful', () => {
    for (const guide of guides) {
      expect(guide.intro.length).toBeGreaterThanOrEqual(2);
      expect(guide.picks.length).toBeGreaterThanOrEqual(4);
      expect(guide.faq?.length ?? 0).toBeGreaterThanOrEqual(2);
      for (const pick of guide.picks) {
        expect(pick.gameSlug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(pick.blurb.length).toBeGreaterThan(80);
      }
    }
  });

  it('publishes Irish and Polish editors in English and translates their frontend copy', () => {
    for (const authorId of ['eoin-ie', 'kasia-pl']) {
      const author = AUTHORS_BY_ID[authorId];
      expect(author.locale).toBe('en');

      const authoredGuides = guides.filter((guide) => guide.authorId === authorId);
      expect(authoredGuides.length).toBeGreaterThan(0);
      for (const guide of authoredGuides) {
        expect(guide.originalLocale).toBe('en');
        expect(guide.translations?.es).toBeUndefined();
        expect(localizeGuide(guide, 'es').autoTranslated).toBe(true);
      }
    }
  });

  it('emits accountable Article structured data', () => {
    const json = articleLd({
      title: 'A useful guide',
      description: 'Original editorial description',
      path: '/es/guias/una-guia',
      datePublished: '2026-07-26',
      dateModified: '2026-07-26',
      inLanguage: 'es',
      articleSection: 'Guías de juegos de mesa',
      wordCount: 900,
      citations: ['https://example.org/primary-source'],
      author: {
        name: 'Núria Ferrer',
        url: '/es/guias#editor-nuria-es',
        description: 'Perfil editorial',
        knowsAbout: ['Diseño', 'Abstractos'],
      },
    }) as Record<string, unknown>;
    expect(json).toMatchObject({
      '@type': 'Article',
      inLanguage: 'es',
      wordCount: 900,
      isAccessibleForFree: true,
      citation: ['https://example.org/primary-source'],
      author: {
        '@type': 'Person',
        name: 'Núria Ferrer',
        knowsAbout: ['Diseño', 'Abstractos'],
      },
      publisher: { '@type': 'Organization' },
    });
  });
});

describe('editor profiles', () => {
  it('gives every editor a unique, human-readable profile slug in both locales', () => {
    const slugs = new Set<string>();
    for (const author of AUTHORS) {
      const slug = editorSlug(author);
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(slugs.has(slug), `duplicate editor slug ${slug}`).toBe(false);
      slugs.add(slug);
      expect(editorPath(author, 'es', 'mx')).toBe(`/es-mx/editores/${slug}`);
      expect(editorPath(author, 'en', 'mx')).toBe(`/en-mx/editors/${slug}`);
    }
    expect(slugs.size).toBe(6);
    expect(editorSlug(AUTHORS_BY_ID['sofia-mx'])).toBe('sofia-herrera');
  });

  // A byline and its profile page must resolve to the same URL even when the
  // author object arrives from a different API shape carrying a stale slug.
  it('ignores a stored slug so a byline can never point away from its profile', () => {
    expect(editorSlug({ ...AUTHORS[0], slug: 'sofia-mx' })).toBe('sofia-herrera');
    expect(editorSlug({ ...AUTHORS[0], slug: undefined })).toBe('sofia-herrera');
  });

  it('points every guide byline at a profile page that exists', () => {
    const profiles = new Set(AUTHORS.map((author) => editorPath(author, 'es')));
    for (const guide of allGuidesRaw()) {
      const author = AUTHORS_BY_ID[guide.authorId ?? ''];
      expect(profiles.has(editorPath(author, 'es'))).toBe(true);
    }
  });

  it('emits a ProfilePage whose Person url matches the guide author url', () => {
    const author = AUTHORS_BY_ID['nuria-es'];
    const path = editorPath(author, 'es');
    const profile = personLd({
      name: author.name,
      path,
      jobTitle: author.role,
      description: author.bio,
      knowsAbout: author.expertise,
      authored: [{ title: 'Una guía', path: '/es/guias/una-guia' }],
    }) as Record<string, any>;
    const article = articleLd({
      title: 'Una guía',
      description: 'Descripción',
      path: '/es/guias/una-guia',
      datePublished: '2026-07-26',
      dateModified: '2026-07-26',
      author: { name: author.name, url: path },
    }) as Record<string, any>;

    expect(profile['@type']).toBe('ProfilePage');
    expect(profile.mainEntity['@type']).toBe('Person');
    expect(profile.mainEntity.jobTitle).toBe(author.role);
    expect(profile.mainEntity.knowsAbout).toEqual(author.expertise);
    expect(profile.hasPart).toHaveLength(1);
    // The authorship graph only connects if both URLs are byte-identical.
    expect(article.author.url).toBe(profile.mainEntity.url);
  });
});
