export interface PlayerSlot {
  /** First seat count this slot covers. */
  start: number;
  /** Last seat count this slot covers. Equal to `start` for a single seat. */
  end: number;
  /** "4" for a single seat, "3–18" for a group. */
  label: string;
  /**
   * `no`   — below the minimum; the game cannot be played at this count.
   * `min`  — exactly the minimum of a range: playable, but the thinnest version.
   * `good` — comfortably inside the supported range.
   */
  kind: 'no' | 'min' | 'good';
}

/** Beyond this many seats, individual tiles stop being readable. */
const MAX_INDIVIDUAL_SLOTS = 8;

/**
 * Seat tiles for the player-count graphic.
 *
 * One tile per seat is right for the games most people own, and unusable past
 * that: a 1–99 party game rendered ninety-nine tiles squeezed into a flex row,
 * each a few pixels wide. Large ranges collapse to the three facts a tile row
 * is actually communicating — what does not work, what barely works, and what
 * works — instead of enumerating counts nobody reads.
 */
export function playerFitSlots(minPlayers: number, maxPlayers: number): PlayerSlot[] {
  const min = Math.max(1, Math.floor(minPlayers));
  const max = Math.max(min, Math.floor(maxPlayers));

  const label = (start: number, end: number) => (start === end ? String(start) : `${start}–${end}`);
  const kindFor = (start: number): PlayerSlot['kind'] => {
    if (start < min) return 'no';
    if (start === min && min < max) return 'min';
    return 'good';
  };

  if (max <= MAX_INDIVIDUAL_SLOTS) {
    return Array.from({ length: max }, (_, index) => {
      const seat = index + 1;
      return { start: seat, end: seat, label: label(seat, seat), kind: kindFor(seat) };
    });
  }

  const slots: PlayerSlot[] = [];
  // Counts below the minimum, as one "doesn't work" block rather than a run of
  // identical struck-through tiles.
  if (min > 1) slots.push({ start: 1, end: min - 1, label: label(1, min - 1), kind: 'no' });
  slots.push({ start: min, end: min, label: label(min, min), kind: kindFor(min) });
  if (max > min) {
    slots.push({ start: min + 1, end: max, label: label(min + 1, max), kind: 'good' });
  }
  return slots;
}
