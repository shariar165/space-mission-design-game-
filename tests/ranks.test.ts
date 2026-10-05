// Ranks and badges (engine: src/engine/ranks.ts, data src/data/ranks.json). Ranks follow real Mission Control
// jobs and rise with the stars earned across the levels; badges come from deeds (Notebook facts, postcards, the
// Daily streak, Rescue History).
import { describe, expect, it } from 'vitest';
import { presetDesign } from '../src/engine/missions';
import { emptyFacts, flightFacts, mergeFacts } from '../src/engine/notebook';
import * as ops from '../src/engine/ops/index';
import { postcardsFor } from '../src/engine/postcards';
import { BADGES, badges, RANKS, rankFor, starTotals } from '../src/engine/ranks';
import { starterDesign } from '../src/ui/starters';

const maven = presetDesign('maven');
// The levels' best stars (levels.ts maxStars): three per flight, one for the Jupiter lesson.
const MAX = { 'moon-1': 3, 'moon-2': 3, 'moon-3': 3, mars: 3, venus: 3, bennu: 3, jupiter: 1 };

describe('stars and ranks', () => {
  it('stars are the best per level, capped at each level’s maximum; other progress (rescues) does not count', () => {
    // 2 + 3 + 1 = 6; rescue-mco is not a level. Max = 6 × 3 + 1 = 19
    expect(starTotals({ 'moon-1': 2, 'moon-2': 3, 'moon-3': 1, 'rescue-mco': 3 }, MAX)).toEqual({ stars: 6, maxStars: 19 });
    // a stray value above the level's maximum is capped: jupiter 5 → 1
    expect(starTotals({ jupiter: 5 }, MAX).stars).toBe(1);
  });

  it('cadet → flight controller (3) → CAPCOM (8) → flight director (14) → mission legend (all 19)', () => {
    const at = (stars: number) => rankFor(stars, 19);
    expect(at(0).rank.id).toBe('cadet');
    expect(at(0).next!.id).toBe('flight-controller');
    expect(at(0).starsToNext).toBe(3);
    expect(at(2).starsToNext).toBe(1);
    expect(at(3).rank.id).toBe('flight-controller');
    expect(at(8).rank.id).toBe('capcom');
    expect(at(13).rank.id).toBe('capcom');
    expect(at(14).rank.id).toBe('flight-director');
    expect(at(14).next!.id).toBe('mission-legend');
    expect(at(14).starsToNext).toBe(5); // 19 − 14
    expect(at(19).rank.id).toBe('mission-legend');
    expect(at(19).next).toBeUndefined();
    expect(at(19).starsToNext).toBeUndefined();
  });

  it('every real job description is Sourced and marked to verify', () => {
    for (const r of RANKS) expect(r.job.isGameEstimate).toBe(true);
  });
});

describe('flight facts for badges', () => {
  it('a calm MAVEN flight: storm-free, no brownout through its eclipse season, no extension, no sample', () => {
    const f = flightFacts(ops.runOperations(maven, { rng: () => 0.999999 }).state);
    expect(f.stormNoLoss).toBe(false);
    expect(f.eclipseNoBrownout).toBe(true);
    expect(f.extended).toBe(false);
    expect(f.sampleReturned).toBe(false);
    expect(flightFacts(ops.runOperations(maven, { rng: () => 0.999999, extension: 'longest' }).state).extended).toBe(true);
  });

  it('a solar storm survived with every instrument: storm survivor', () => {
    // Seed 4 draws solar storms (tests/fly.test.ts); the safe policy shelters and keeps the instruments.
    const s = ops.runOperations(maven, { seed: 4 }).state;
    expect(s.hazards.some((h) => h.type === 'solar-storm')).toBe(true);
    expect(flightFacts(s).stormNoLoss).toBe(s.status !== 'lost' && s.instrumentsLost.length === 0);
  });

  it('Bennu home with a sample: sample-home', () => {
    const s = ops.runOperations(starterDesign('bennu', '2026-10-04'), { rng: () => 0.999999 }).state;
    expect(flightFacts(s).sampleReturned).toBe(s.status === 'complete');
    expect(s.status).toBe('complete');
  });

  it('a lost craft earns none of them', () => {
    const f = flightFacts(ops.runOperations(maven, { seed: 6, policy: 'default' }).state);
    expect([f.stormNoLoss, f.eclipseNoBrownout, f.sampleReturned]).toEqual([false, false, false]);
  });

  it('facts only ever add up; an old save without the new facts reads as false', () => {
    const old = { hazards: {}, conjunction: true, eclipse: true, progress: {} } as unknown as ReturnType<typeof emptyFacts>;
    const m = mergeFacts(old, { stormNoLoss: true });
    expect(m.stormNoLoss).toBe(true);
    expect(m.extended).toBe(false);
    expect(mergeFacts(m, { stormNoLoss: false }).stormNoLoss).toBe(true);
  });
});

describe('badges', () => {
  const none = { facts: emptyFacts(), postcards: [] as string[], dailyStreak: 0 };

  it('nothing at the start; every badge in data order', () => {
    const b = badges(none);
    expect(b.map((x) => x.id)).toEqual(BADGES.map((x) => x.id));
    expect(b.some((x) => x.earned)).toBe(false);
  });

  it('each rule', () => {
    const on = (input: Partial<typeof none>, id: string) => badges({ ...none, ...input }).find((x) => x.id === id)!.earned;
    expect(on({ facts: { ...emptyFacts(), progress: { 'moon-1': 1 } } }, 'first-flight')).toBe(true);
    expect(on({ facts: { ...emptyFacts(), stormNoLoss: true } }, 'storm-survivor')).toBe(true);
    expect(on({ facts: { ...emptyFacts(), conjunction: true } }, 'through-the-sun')).toBe(true);
    expect(on({ facts: { ...emptyFacts(), eclipseNoBrownout: true } }, 'night-shift')).toBe(true);
    expect(on({ facts: { ...emptyFacts(), extended: true } }, 'bonus-time')).toBe(true);
    expect(on({ facts: { ...emptyFacts(), sampleReturned: true } }, 'sample-home')).toBe(true);
    expect(on({ postcards: postcardsFor('venus').map((c) => c.id) }, 'shutterbug')).toBe(true);
    expect(on({ postcards: postcardsFor('venus').slice(0, 2).map((c) => c.id) }, 'shutterbug')).toBe(false);
    expect(on({ dailyStreak: 2 }, 'daily-streak')).toBe(false);
    expect(on({ dailyStreak: 3 }, 'daily-streak')).toBe(true);
    expect(on({ facts: { ...emptyFacts(), progress: { 'rescue-mco': 1 } } }, 'rescuer')).toBe(true);
    expect(on({ facts: { ...emptyFacts(), progress: { jupiter: 1 } } }, 'big-thinker')).toBe(true);
    // a rescue star is not a level star
    expect(on({ facts: { ...emptyFacts(), progress: { 'rescue-mco': 3 } } }, 'first-flight')).toBe(false);
  });
});
