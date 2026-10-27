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

describe('Moon targets data (src/data/moonTargets.json; spec: Moon orbit, Targets)', () => {
  it('has the design’s four targets, in order, each from the Gazetteer or LROC’s published Apollo 11 position', async () => {
    const { TARGET_SETS } = await import('../src/engine/targets');
    const moon = TARGET_SETS.moon;
    expect(moon.targets.map((t) => t.id)).toEqual(['apollo-11', 'tycho', 'shackleton', 'tsiolkovskiy']);
    // IAU Gazetteer solution 1 (planetographic, +East) and LROC 2016 for the lunar module
    const at = (id: string) => [moon.targets.find((t) => t.id === id)!.lat_deg!.value, moon.targets.find((t) => t.id === id)!.lon_deg!.value];
    expect(at('apollo-11')).toEqual([0.67416, 23.47314]);
    expect(at('tycho')).toEqual([-43.3, -11.22]);
    expect(at('shackleton')).toEqual([-89.67, 129.78]);
    expect(at('tsiolkovskiy')).toEqual([-20.38, 128.97]);
    for (const t of moon.targets) {
      expect(t.kind).toBe('surface');
      expect(t.body).toBe('moon');
      expect(t.lat_deg!.isGameEstimate).toBe(false);
      expect(t.lat_deg!.url).toMatch(/planetarynames\.wr\.usgs\.gov\/Feature|nssdc\.gsfc\.nasa\.gov/);
    }
  });

  it('weights share out the whole of Moon 3’s science: 0.20 + 0.25 + 0.30 + 0.25 = 1', async () => {
    const { TARGET_SETS } = await import('../src/engine/targets');
    expect(TARGET_SETS.moon.targets.reduce((a, t) => a + t.weight.value, 0)).toBeCloseTo(1, 12);
  });

  it('every picture is a public-domain LROC PDS frame, credited NASA/GSFC/Arizona State University, shipped under 250 KB', async () => {
    const { TARGET_SETS } = await import('../src/engine/targets');
    for (const t of TARGET_SETS.moon.targets) {
      expect(t.image.nasaId).toMatch(/^M\d{9,10}[LR](\/R)?$/);
      expect(t.image.credit).toBe('NASA/GSFC/Arizona State University');
      expect(t.image.usage.value).toMatch(/^Public domain: an LROC data product from the PDS archive/);
      expect(t.image.usage.url).toMatch(/^https:\/\/data\.lroc\.im-ldi\.com\/lroc\/view_lroc\/LRO-L-LROC-3-CDR-V1\.0\//);
      const f = publicFile(t.image.file);
      expect(existsSync(f), t.image.file).toBe(true);
      expect(statSync(f).size).toBeLessThan(250 * 1024);
    }
  });

  it('the camera is LROC’s NAC (10 µrad: 0.5 m per pixel from 50 km) and the globe map is NASA SVS’s CGI Moon Kit', async () => {
    const { TARGET_SETS } = await import('../src/engine/targets');
    const moon = TARGET_SETS.moon;
    expect(moon.camera.ifov_urad.value).toBe(10);
    // 0.5 m ÷ 10 µrad = 50,000 m
    expect(moon.camera.ifov_urad.isGameEstimate).toBe(false);
    expect(existsSync(publicFile(moon.globe.file))).toBe(true);
    expect(moon.globe.credit).toMatch(/Scientific Visualization Studio/);
    expect(moon.globe.lon0_deg.value).toBe(-180);
    // Mars keeps its own set
    expect(TARGET_SETS.mars.targets).toBe(TARGETS);
    expect(TARGET_SETS.mars.globe).toBe(MARS_GLOBE);
  });

  it('target ids are unique across both bodies, and targetById finds either', async () => {
    const { TARGET_SETS } = await import('../src/engine/targets');
    const ids = [...TARGET_SETS.mars.targets, ...TARGET_SETS.moon.targets].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(targetById('tycho')!.body).toBe('moon');
    expect(targetById('phobos')!.body).toBe('mars');
  });
});
