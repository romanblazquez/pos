import { describe, expect, it } from 'vitest';
import { AUTHORS_BY_ID } from '../content/editorial/authors.js';
import { allGuidesRaw, localizeGuide } from './guides.js';
import { articleLd } from './jsonld.js';

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
