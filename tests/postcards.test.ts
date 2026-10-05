// Postcards from space (engine: src/engine/postcards.ts). Real NASA pictures unlock as the flight's science reaches
// Earth: a card opens when downlinked / goal ≥ its unlockAt (and some data has arrived at all).
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { presetDesign } from '../src/engine/missions';
import * as ops from '../src/engine/ops/index';
import { goalGbit } from '../src/engine/ops/fly';
import { newPostcards, postcardAlbum, POSTCARDS, postcardsEarned, postcardsFor } from '../src/engine/postcards';

const maven = presetDesign('maven');

describe('postcard data', () => {
  it('three per flyable destination, ordered first data → half → all of the science goal', () => {
    for (const d of ['moon', 'mars', 'venus', 'bennu'] as const) {
      const c = postcardsFor(d);
      expect(c.length).toBe(3);
      expect(c.map((x) => x.unlockAt.value)).toEqual([0, 0.5, 1]);
    }
  });

  it('every picture is in public/, and every caption cites its NASA library page', () => {
    for (const c of POSTCARDS) {
      expect(existsSync(new URL(`../public/${c.image}`, import.meta.url))).toBe(true);
      expect(c.caption.url).toBe(`https://images.nasa.gov/details/${c.nasaId}`);
      expect(c.credit).toMatch(/NASA/);
      expect(c.unlockAt.isGameEstimate).toBe(true);
    }
    expect(new Set(POSTCARDS.map((c) => c.id)).size).toBe(POSTCARDS.length);
  });
});

describe('postcards earned on a flight', () => {
  it('none before any science reaches Earth', () => {
    expect(postcardsEarned(ops.startOperations(maven, { rng: () => 0.999999 }))).toEqual([]);
    // still none in cruise: nothing has been downlinked
    const cruise = ops.advanceOperations(ops.startOperations(maven, { rng: () => 0.999999 }), { until: 100 });
    expect(cruise.downlinkedPrime_bits).toBe(0);
    expect(postcardsEarned(cruise)).toEqual([]);
  });

  it('the first card with the first data; the rest as downlinked / goal passes ½ and 1', () => {
    const full = ops.runOperations(maven, { rng: () => 0.999999 }).state;
    const goal = goalGbit(full) * 1e9;
    const share = full.downlinkedPrime_bits / goal;
    const want = postcardsFor('mars')
      .filter((c) => c.unlockAt.value <= share + 1e-12)
      .map((c) => c.id);
    expect(postcardsEarned(full)).toEqual(want);
    expect(want[0]).toBe('mars-globe');
    // Part way through the science phase: a share between 0 and ½ has only the first card
    const sci = full.env.timeline.find((w) => w.phase === 'science')!;
    let s = ops.startOperations(maven, { rng: () => 0.999999 });
    for (let i = 0; i < 1000 && s.t < sci.startDay + 20 && s.status === 'flying'; i++) s = ops.advanceOperations(s, { until: sci.startDay + 20 });
    const part = s.downlinkedPrime_bits / (goalGbit(s) * 1e9);
    expect(part).toBeGreaterThan(0);
    expect(part).toBeLessThan(0.5);
    expect(postcardsEarned(s)).toEqual(['mars-globe']);
  });

  it('a lost craft keeps the cards it had already earned', () => {
    const s = ops.runOperations(maven, { seed: 6, policy: 'default' }).state;
    expect(s.status).toBe('lost');
    const share = s.downlinkedPrime_bits / (goalGbit(s) * 1e9);
    expect(postcardsEarned(s)).toEqual(postcardsFor('mars').filter((c) => s.downlinkedPrime_bits > 0 && c.unlockAt.value <= share).map((c) => c.id));
  });

  it('a launch failure earns nothing', () => {
    expect(postcardsEarned(ops.runOperations(maven, { rng: () => 0 }).state)).toEqual([]);
  });
});

describe('the album', () => {
  it('every card in data order, open when earned; counts', () => {
    const a = postcardAlbum(['mars-globe', 'moon-tycho']);
    expect(a.total).toBe(POSTCARDS.length);
    expect(a.got).toBe(2);
    expect(a.cards.map((c) => c.id)).toEqual(POSTCARDS.map((c) => c.id));
    expect(a.cards.filter((c) => c.open).map((c) => c.id).sort()).toEqual(['mars-globe', 'moon-tycho']);
    // unknown ids (an old save) are ignored
    expect(postcardAlbum(['nope']).got).toBe(0);
  });

  it('new cards: earned now, not before, in data order', () => {
    expect(newPostcards(['mars-globe'], ['mars-dunes', 'mars-globe'])).toEqual(['mars-dunes']);
    expect(newPostcards(['mars-globe'], ['mars-globe'])).toEqual([]);
  });
});
