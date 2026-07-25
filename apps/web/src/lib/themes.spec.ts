import { describe, expect, it } from 'vitest';
import { INDEXABLE_THEMES, THEMES, getThemeBySlug, primaryTheme } from './themes';
import { CATEGORY_IDENTITY } from './category-identity';
import { LOCALES } from './segments';

// A shelf is only real when its taxonomy, its identity and its motif all exist —
// the browse index, the category page and the sitemap each read a different one
// of those three, so a half-added shelf renders as a nameless or artless card.
describe('browse shelves', () => {
  it('gives every theme an identity and a unique key', () => {
    const keys = THEMES.map((theme) => theme.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const theme of THEMES) {
      expect(CATEGORY_IDENTITY[theme.key], `identity missing for ${theme.key}`).toBeDefined();
    }
  });

  it('gives every theme a resolvable, unique slug and label per locale', () => {
    for (const locale of LOCALES) {
      const slugs = THEMES.map((theme) => theme.slug[locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const theme of THEMES) {
        expect(theme.slug[locale]).toMatch(/^[a-z0-9-]+$/);
        expect(theme.label[locale].length).toBeGreaterThan(0);
        expect(theme.description[locale].length).toBeGreaterThan(0);
        expect(getThemeBySlug(locale, theme.slug[locale])?.key).toBe(theme.key);
      }
    }
  });

  it('keeps exactly one catch-all shelf, and keeps it out of the indexable set', () => {
    const catchAll = THEMES.filter((theme) => theme.noindex);
    expect(catchAll).toHaveLength(1);
    // It must have no rules of its own: membership comes from the database's
    // fallback rule, which fires only when nothing else matched.
    expect(catchAll[0].tags).toBeUndefined();
    expect(catchAll[0].players).toBeUndefined();
    expect(INDEXABLE_THEMES).toHaveLength(THEMES.length - 1);
    expect(INDEXABLE_THEMES.some((theme) => theme.noindex)).toBe(false);
  });

  it('never names the catch-all as a product’s primary theme', () => {
    // A tagless, player-count-less stub is the case the catch-all exists for, and
    // client-side matching must return nothing rather than guess a shelf.
    expect(primaryTheme({ tags: [], minPlayers: undefined, maxPlayers: undefined })).toBeUndefined();
    expect(primaryTheme({ tags: ['Cooperative Game'], minPlayers: 1, maxPlayers: 4 })?.key).toBe('coop');
    // Genre wins over the player-count shelf, matching the database's rule priority.
    expect(primaryTheme({ tags: ['Economic'], minPlayers: 2, maxPlayers: 2 })?.key).toBe('strategy');
  });
});
