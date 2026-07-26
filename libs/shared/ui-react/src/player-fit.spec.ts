import { describe, expect, it } from 'vitest';
import { playerFitSlots } from './player-fit.js';

const shape = (min: number, max: number) =>
  playerFitSlots(min, max).map((slot) => `${slot.label}:${slot.kind}`);

describe('player count fit', () => {
  it('gives a tile per seat for an ordinary game', () => {
    expect(shape(2, 4)).toEqual(['1:no', '2:min', '3:good', '4:good']);
  });

  it('marks the minimum of a range as playable but thin', () => {
    // A 2–4 game at exactly 2 works; it is not the same recommendation as 3.
    expect(playerFitSlots(2, 4)[1].kind).toBe('min');
    // A fixed-count game has no "thinnest" version to warn about.
    expect(shape(4, 4)).toEqual(['1:no', '2:no', '3:no', '4:good']);
  });

  it('collapses a party game instead of drawing ninety-nine tiles', () => {
    // The reported bug: 1–99 rendered 99 tiles a few pixels wide each.
    expect(shape(1, 99)).toEqual(['1:min', '2–99:good']);
    expect(playerFitSlots(1, 99)).toHaveLength(2);
  });

  it('keeps the unplayable range as one block, not a run of identical tiles', () => {
    expect(shape(3, 18)).toEqual(['1–2:no', '3:min', '4–18:good']);
  });

  it('never draws more tiles than a row can hold', () => {
    for (let max = 1; max <= 200; max += 1) {
      for (const min of [1, 2, Math.max(1, Math.floor(max / 2)), max]) {
        expect(playerFitSlots(min, max).length, `${min}-${max}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('survives nonsense input rather than rendering a negative-length row', () => {
    expect(playerFitSlots(0, 0)).toEqual([{ start: 1, end: 1, label: '1', kind: 'good' }]);
    // max below min is contradictory data; clamp max up to min rather than
    // throwing or producing a negative-length row. 5 seats is under the
    // grouping threshold, so it still draws one tile each.
    expect(shape(5, 2)).toEqual(['1:no', '2:no', '3:no', '4:no', '5:good']);
  });
});
