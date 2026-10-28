// The coming-up ribbon's layout (sdGeometry ribbonSlots): two lanes of labels that never overlap. Found by the
// screenshot run: on Moon 1 a course fix, the arrival and an eclipse season all fall in the first week.
import { describe, expect, it } from 'vitest';
import { ribbonSlots } from '../src/ui/sdGeometry';

const at = (...lefts: number[]) => lefts.map((left, i) => ({ id: i, left }));

describe('coming-up ribbon lanes', () => {
  it('well-spaced events alternate lanes, as the design draws them', () => {
    const s = ribbonSlots(at(0.1, 0.4, 0.7), 0.2);
    expect(s.map((x) => x.lane)).toEqual([0, 1, 0]);
    expect(s.every((x) => x.items.length === 1)).toBe(true);
  });

  it('a third event in the same week joins the slot before it instead of covering a label', () => {
    // 0.01 → lane 0; 0.03 → lane 1 (lane 0 is 0.02 away, under the 0.2 gap); 0.035 → no lane has room: joins 0.03
    const s = ribbonSlots(at(0.01, 0.03, 0.035, 0.5), 0.2);
    expect(s.map((x) => [x.lane, x.items.map((i) => i.id)])).toEqual([
      [0, [0]],
      [1, [1, 2]],
      [0, [3]],
    ]);
  });

  it('an event too close in its turn takes the other lane', () => {
    // 0.1 → 0; 0.4 → 1; 0.45 would be lane 0 by turn (0.35 from 0.1: room) → 0; 0.5: turn 1 is 0.1 from 0.4, lane 0 is
    // 0.05 from 0.45: no room in either → joins the 0.45 slot
    const s = ribbonSlots(at(0.1, 0.4, 0.45, 0.5), 0.2);
    expect(s.map((x) => [x.lane, x.items.length])).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
    ]);
  });

  it('on the phone the slots stop short of the right edge', () => {
    expect(ribbonSlots(at(0.99), 0.3, 0.92)[0]!.left).toBe(0.92);
  });
});
