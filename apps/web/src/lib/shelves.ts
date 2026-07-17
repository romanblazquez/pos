// Shelf cards — the browse surface shared by the home page and the category index.
//
// Both surfaces must agree on which shelves exist and how many games each holds,
// so the count query lives here once rather than being re-derived per page.
import { listProducts } from './api';
import { THEMES, type Theme } from './themes';
import { identityFor, type CategoryIdentity } from './category-identity';

export interface Shelf {
  theme: Theme;
  identity: CategoryIdentity;
  count: number;
}

/**
 * Every shelf that currently holds at least one game, busiest first.
 *
 * One indexed lookup per theme (~16), each `limit: 1` because the card art is
 * the shelf's own identity — we need the total, not the products. ISR caches the
 * result, so the cost is per-revalidation, not per-visit.
 */
export async function listShelves(): Promise<Shelf[]> {
  const shelves = await Promise.all(
    THEMES.map(async (theme) => {
      const { total } = await listProducts({
        mechanics: theme.tags,
        minPlayers: theme.players,
        limit: 1,
        sortBy: 'rank_score',
      });
      return { theme, identity: identityFor(theme), count: total };
    }),
  );
  return shelves
    .filter((s) => s.count > 0) // a shelf with nothing on it is a dead end
    .sort((a, b) => b.count - a.count);
}
