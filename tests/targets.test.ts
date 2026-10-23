// Mars science targets data (src/data/targets.json; spec: Science targets and downlink). Every target has a real
// NASA image whose optimised copy ships in public/, a credit and usage terms, and the weights share out the
// whole of the mission's science.
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MARS_GLOBE, MARS_MOONS, TARGETS, targetById, targetFacts } from '../src/engine/targets';

const publicFile = (p: string) => new URL(`../public/${p}`, import.meta.url);

describe('science targets data', () => {
  it('has the six targets of the design, in order', () => {
    expect(TARGETS.map((t) => t.id)).toEqual(['olympus-mons', 'valles-marineris', 'north-polar-cap', 'phobos', 'deimos', 'limb']);
  });

  it('weights share out the whole mission science', () => {
    // 0.18 + 0.16 + 0.14 + 0.20 + 0.12 + 0.20 = 1.00
    const sum = TARGETS.reduce((a, t) => a + t.weight.value, 0);
    expect(sum).toBeCloseTo(1, 12);
    for (const t of TARGETS) expect(t.weight.value).toBeGreaterThan(0);
  });

  it('every image is a NASA catalogue picture with a credit, usage terms and a shipped copy under 200 KB', () => {
    for (const t of TARGETS) {
      expect(t.image.nasaId).toMatch(/^PIA\d{5}$/);
      expect(t.image.credit).toMatch(/^NASA\//);
      expect(t.image.usage.value.length).toBeGreaterThan(20);
      expect(t.image.usage.url).toMatch(/^https:\/\//);
      expect(t.image.usage.isGameEstimate).toBe(false);
      const f = publicFile(t.image.file);
      expect(existsSync(f), t.image.file).toBe(true);
      expect(statSync(f).size).toBeLessThan(200 * 1024);
    }
  });

  it('the globe map ships and is public domain', () => {
    expect(existsSync(publicFile(MARS_GLOBE.file))).toBe(true);
    expect(MARS_GLOBE.usage.value).toMatch(/public domain/i);
    expect(MARS_GLOBE.lon0_deg.value).toBe(-180);
  });

  it('surface targets have a location, moon targets a moon', () => {
    for (const t of TARGETS) {
      if (t.kind === 'surface') {
        expect(Math.abs(t.lat_deg!.value)).toBeLessThanOrEqual(90);
        expect(Math.abs(t.lon_deg!.value)).toBeLessThanOrEqual(180);
      }
      if (t.kind === 'moon') expect(MARS_MOONS[t.moon!]).toBeDefined();
    }
    // JPL mean elements: Phobos 9375 km, Deimos 23457 km.
    expect(MARS_MOONS.phobos.a_km.value).toBe(9375);
    expect(MARS_MOONS.deimos.a_km.value).toBe(23457);
  });

  it('Olympus Mons is about 2.5 times taller than Everest (copy fix)', () => {
    // 21.9 km / 8.849 km = 2.475 → 2.5 to one decimal.
    expect(targetFacts().olympusVsEverest).toBe(2.5);
    expect(targetById('olympus-mons')!.learn.value).toContain('2.5 times taller than Everest');
  });

  it('looks targets up by id', () => {
    expect(targetById('phobos')?.name).toBe('Phobos');
    expect(targetById('nope')).toBeUndefined();
  });
});
