// Category identity system — "Sixteen shelves, one collection" (design system §06).
//
// Each of the 16 browse themes carries a distinct accent + motif pair, legible at
// a 280px card and a 30px favicon alike. This module holds ONLY the identity
// (colour + motif key + semantic family); the taxonomy rules live in `themes.ts`
// and the two are joined by `Theme.key`.
//
// `family` is the design system's semantic label. It drives fallback matching
// (nearest-family art when a category has no commissioned illustration yet) and
// is deliberately never rendered to players.
//
// Tints/accents for the eleven categories the design system specifies are copied
// verbatim. The remaining five (deckbuilding, horror, scifi, abstract, wargame)
// predate the art direction and are derived here in the same low-chroma
// parchment family — marked `derived` so they can be replaced when the design
// system covers them.
import type { Theme } from './themes';

export interface CategoryIdentity {
  /** Semantic family — internal only, drives art fallback. Never shown to users. */
  family: string;
  /** Card/hero wash behind the motif. */
  tint: string;
  /** Motif + rule colour. Must clear 4.5:1 against `tint`. */
  accent: string;
  /** Motif key — see `CategoryMotif`. */
  motif: string;
  /**
   * Commissioned shelf illustration (`/categories/<key>.webp`, 1:1 per the
   * design system's `[shelf]` slot). Shelves still awaiting art fall back to
   * `tint` + `motif`, which is the designed placeholder — not a broken state.
   * A `-hero.webp` sibling (16:9, the `[hero]` slot) exists wherever `art` does.
   */
  art?: string;
  /** True when the wash is dark and the card must flip to light ink. */
  dark?: boolean;
  /** Tint/accent not yet specified by the design system; derived in-family. */
  derived?: boolean;
}

export const CATEGORY_IDENTITY: Record<string, CategoryIdentity> = {
  // ── Specified by the design system ───────────────────────────────────────
  'two-player':   { family: 'two-player',  tint: '#f6e4da', accent: '#b4502e', motif: 'two-player',  art: '/categories/two-player.webp' },
  card:           { family: 'cards',       tint: '#efe7d6', accent: '#8a5a12', motif: 'cards',       art: '/categories/card.webp' },
  dice:           { family: 'dice',        tint: '#f4e9cf', accent: '#8a5a12', motif: 'dice',        art: '/categories/dice.webp' },
  party:          { family: 'party',       tint: '#f0dac7', accent: '#a5431f', motif: 'party',       art: '/categories/party.webp' },
  strategy:       { family: 'strategy',    tint: '#d9e4d5', accent: '#2c6b43', motif: 'strategy',    art: '/categories/strategy.webp' },
  euro:           { family: 'economic',    tint: '#e4dcec', accent: '#574079', motif: 'economic',    art: '/categories/euro.webp' },
  fantasy:        { family: 'fantasy',     tint: '#e3ece4', accent: '#2c6b43', motif: 'fantasy',     art: '/categories/fantasy.webp' },
  coop:           { family: 'cooperative', tint: '#f2e6c8', accent: '#8a5a12', motif: 'cooperative', art: '/categories/coop.webp' },
  thematic:       { family: 'adventure',   tint: '#1e1712', accent: '#d7a654', motif: 'adventure',   art: '/categories/thematic.webp', dark: true },
  solo:           { family: 'solo',        tint: '#e9e3f0', accent: '#574079', motif: 'solo',      art: '/categories/solo.webp' },
  campaign:       { family: 'legacy',      tint: '#e3eaf1', accent: '#3a5a7d', motif: 'legacy',    art: '/categories/campaign.webp' },

  // ── Tint/accent derived in-family; art commissioned ─────────────────────
  // These five aren't named in the design system's swatch set, so their tint and
  // accent are still derived — but all sixteen now carry commissioned art, so the
  // tint only shows through as the motif wash on a card that fails to load.
  deckbuilding:   { family: 'cards',       tint: '#dfe9e6', accent: '#31564a', motif: 'deckbuilding', art: '/categories/deckbuilding.webp', derived: true },
  horror:         { family: 'adventure',   tint: '#1b1518', accent: '#d98a63', motif: 'horror', art: '/categories/horror.webp', dark: true, derived: true },
  scifi:          { family: 'adventure',   tint: '#dce8ea', accent: '#2f6470', motif: 'scifi', art: '/categories/scifi.webp', derived: true },
  abstract:       { family: 'abstract',    tint: '#e8e6e0', accent: '#5f5648', motif: 'abstract', art: '/categories/abstract.webp', derived: true },
  wargame:        { family: 'strategy',    tint: '#e2e3d3', accent: '#4f5730', motif: 'wargame', art: '/categories/wargame.webp', derived: true },
};

/** Identity for a theme, falling back to the neutral parchment wash. */
export function identityFor(theme: Pick<Theme, 'key'>): CategoryIdentity {
  return (
    CATEGORY_IDENTITY[theme.key] ?? {
      family: 'abstract',
      tint: '#efe7d6',
      accent: '#6f6557',
      motif: 'abstract',
      derived: true,
    }
  );
}
