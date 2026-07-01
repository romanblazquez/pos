import type { ShelfStatus } from './context/ShelfContext.js';

// Single source of truth for shelf-status icon/label — shared by ShelfButtons.tsx
// (product page) and AccountPage.tsx (shelf grid) so they can't drift out of
// sync the way they previously did (ShelfButtons mislabeled 'want-to-play' as
// "already played" while AccountPage had it correct).
export const SHELF_STATUS_META: Record<NonNullable<ShelfStatus>, { icon: string; activeIcon?: string; labelKey: string }> = {
  owned: { icon: '📦', labelKey: 'shelf.owned' },
  wishlist: { icon: '♡', activeIcon: '♥', labelKey: 'shelf.wishlist' },
  'want-to-play': { icon: '🎲', labelKey: 'shelf.wantToPlay' },
  played: { icon: '🎯', labelKey: 'shelf.played' },
  'previously-owned': { icon: '📤', labelKey: 'shelf.previouslyOwned' },
  'for-trade': { icon: '🔄', labelKey: 'shelf.forTrade' },
  preordered: { icon: '📅', labelKey: 'shelf.preordered' },
  'spare-parts': { icon: '🧩', labelKey: 'shelf.spareParts' },
};

export const SHELF_STATUS_ORDER: NonNullable<ShelfStatus>[] = [
  'owned', 'wishlist', 'want-to-play', 'played', 'previously-owned', 'for-trade', 'preordered', 'spare-parts',
];
