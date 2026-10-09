// NASA DONKI records → the Daily's real solar storms (engine: src/engine/spaceWeather.ts; spec UI rule 37).
// The edge cases run on a hand-written snapshot in the documented DONKI record format (no real week has them all);
// the recorded block runs on real CCMC responses the DONKI GitHub Action saved (tests/fixtures/donki/recorded.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dailyDesign } from '../src/engine/daily';
import { HAZARDS } from '../src/engine/data';
import { prepareOps } from '../src/engine/ops/timeline';
import {
  flareFlux_Wm2,
  isFresh,
  readSnapshot,
  realStorms,
  SPACE_WEATHER,
  stormCandidates,
  stormOnset,
  stormSourced,
  type DonkiSnapshot,
  type RealStorm,
} from '../src/engine/spaceWeather';
import { starterDesign } from '../src/ui/starters';

const fixture = (name: string) => new URL(`./fixtures/donki/${name}`, import.meta.url);
const sampleText = readFileSync(fixture('documented-format-sample.json'), 'utf8');
const sample = readSnapshot(sampleText)!;

describe('DONKI → storms: edge cases (hand-written documented-format sample)', () => {
  it('reads a snapshot; anything else (a web page, bad JSON, a missing window) is no snapshot', () => {
    expect(sample.window).toEqual({ startDate: '2030-01-01', endDate: '2030-01-07' });
    expect(sample.flr.records.length).toBe(5);
    expect(sample.cme.records.length).toBe(5);
    expect(readSnapshot('<!DOCTYPE html><html><body>Signal Delay</body></html>')).toBeUndefined(); // Vite's fallback page
    expect(readSnapshot('{"window": 3}')).toBeUndefined();
    expect(readSnapshot('')).toBeUndefined();
    const { window: _w, ...noWindow } = JSON.parse(sampleText) as DonkiSnapshot;
    expect(readSnapshot(JSON.stringify(noWindow))).toBeUndefined();
  });

  it('a quiet week (no records) is a live snapshot with no storms, not an offline one', () => {
    const quiet = readSnapshot(JSON.stringify({ ...JSON.parse(sampleText), flr: { url: 'f', records: [] }, cme: { url: 'c', records: [] } }))!;
    expect(quiet).toBeDefined();
    expect(realStorms(quiet)).toEqual([]);
  });

  it('fresh while the window ended at most maxAge_days (2) before today', () => {
    // Window ends 2030-01-07: today 01-07 → 0 d, 01-08 → 1 d, 01-09 → 2 d (fresh); 01-10 → 3 d (stale).
    expect(SPACE_WEATHER.donki.maxAge_days.value).toBe(2);
    expect(isFresh(sample, '2030-01-07')).toBe(true);
    expect(isFresh(sample, '2030-01-08')).toBe(true);
    expect(isFresh(sample, '2030-01-09')).toBe(true);
    expect(isFresh(sample, '2030-01-10')).toBe(false);
    // A window that ends after today is not trusted.
    expect(isFresh(sample, '2030-01-06')).toBe(false);
  });

  it('flare class → GOES peak flux: M = 10⁻⁵ W/m², X = 10⁻⁴, each letter a factor of ten', () => {
    expect(flareFlux_Wm2('M1.0')).toBeCloseTo(1e-5, 15);
    expect(flareFlux_Wm2('M2.3')).toBeCloseTo(2.3e-5, 15);
    expect(flareFlux_Wm2('X2.1')).toBeCloseTo(2.1e-4, 15);
    expect(flareFlux_Wm2('C9.9')).toBeCloseTo(9.9e-6, 15);
    expect(flareFlux_Wm2('B5')).toBeCloseTo(5e-7, 15);
    expect(flareFlux_Wm2('nonsense')).toBeUndefined();
  });

  it('filters, merges linked pairs, keeps the 4 strongest and returns them in time order', () => {
    // Qualifying (M/X flares at peak time, CMEs ≥ 1000 km/s at start time; strength = value / tier threshold):
    //   M1.0 Jan 2 00:00 (1.0), X2.1 Jan 3 06:00 + linked CME 1800 km/s (tier X: max(2.1, 1800/1500 = 1.2) = 2.1),
    //   CME 1000 km/s Jan 4 (1.0), M5.0 Jan 5 (5.0), CME 1600 km/s Jan 6 00:00 (first analysis, none marked most
    //   accurate; tier X: 1600/1500 = 1.07), M1.2 Jan 6 12:00 (1.2).
    // Dropped: C9.9 (below 10⁻⁵), CME 999 km/s, CME with no analyses.
    // Rank: X2.1+CME, CME 1600, M5.0, M1.2 | M1.0, CME 1000 (cap 4). In time order:
    const storms = realStorms(sample);
    expect(SPACE_WEATHER.storms.maxStorms.value).toBe(4);
    expect(storms.map((s) => s.id)).toEqual([
      '2030-01-03T06:00:00-FLR-001',
      '2030-01-05T00:00:00-FLR-001',
      '2030-01-06T00:00:00-CME-001',
      '2030-01-06T12:00:00-FLR-001',
    ]);
    const [x, m5, cme, m12] = storms as [RealStorm, RealStorm, RealStorm, RealStorm];
    expect(x).toMatchObject({ kind: 'flare+cme', classType: 'X2.1', speed_kms: 1800, time: '2030-01-03T06:00Z', date: '2030-01-03', link: 'https://example.invalid/donki-sample/FLR/3' });
    expect(x.eventIds).toEqual(['2030-01-03T06:00:00-FLR-001', '2030-01-03T06:24:00-CME-001']);
    expect(m5).toMatchObject({ kind: 'flare', classType: 'M5.0', date: '2030-01-05' });
    expect(m5.speed_kms).toBeUndefined();
    expect(cme).toMatchObject({ kind: 'cme', speed_kms: 1600, date: '2030-01-06', link: 'https://example.invalid/donki-sample/CME/4' });
    expect(m12).toMatchObject({ kind: 'flare', classType: 'M1.2' });
    // Position in the 7-day window: Jan 3 06:00 is 2.25 d after Jan 1 00:00 → 2.25 / 7.
    expect(x.windowFraction).toBeCloseTo(2.25 / 7, 12);
    expect(m12.windowFraction).toBeCloseTo(5.5 / 7, 12);
  });

  it('the thresholds sit exactly on the edges: M1.0 and 1000 km/s are kept, C9.9 and 999 km/s are not', () => {
    // With the cap lifted, every qualifying storm shows: 6 of them.
    const all = realStorms(sample, { maxStorms: 99 });
    const ids = all.map((s) => s.id);
    expect(ids).toContain('2030-01-02T00:00:00-FLR-001'); // M1.0
    expect(ids).toContain('2030-01-04T00:00:00-CME-001'); // 1000 km/s
    expect(ids).not.toContain('2030-01-01T12:00:00-FLR-001'); // C9.9
    expect(ids).not.toContain('2030-01-01T18:00:00-CME-001'); // 999 km/s
    expect(ids).not.toContain('2030-01-07T09:00:00-CME-001'); // no analysis
    expect(all.length).toBe(6);
  });

  it('ⓘ: a Sourced record that names the DONKI events and links the record', () => {
    const src = stormSourced(realStorms(sample)[0]!);
    expect(src.url).toBe('https://example.invalid/donki-sample/FLR/3');
    expect(src.isGameEstimate).toBe(false);
    expect(src.source).toContain('NASA DONKI');
    expect(src.source).toContain('2030-01-03T06:00:00-FLR-001');
    expect(src.source).toContain('2030-01-03T06:24:00-CME-001');
    expect(src.value).toContain('X2.1');
  });
});

describe('replaying the real week across the Daily flight', () => {
  const env = prepareOps(dailyDesign(starterDesign('mars', '2026-10-08')));
  const cruiseStart = env.days.findIndex((d) => d.phase === 'cruise');
  const span = env.primeEndDay - cruiseStart;
  const lead = HAZARDS['solar-storm']!.warningLead_days.value;
  const allowed = HAZARDS['solar-storm']!.phases;
  const at = (windowFraction: number): RealStorm => ({ ...realStorms(sample)[0]!, windowFraction });

  it('an event halfway through the week strikes halfway from the start of cruise to the end of the prime mission', () => {
    // onset = cruiseStart + 0.5 × (primeEndDay − cruiseStart); Earth is warned warningLead_days (1 d) before.
    const onset = cruiseStart + 0.5 * span;
    expect(allowed).toContain(env.days[Math.floor(onset)]!.phase);
    expect(stormOnset(env, at(0.5))).toBeCloseTo(onset, 9);
    expect(stormOnset(env, at(0))).toBeCloseTo(cruiseStart, 9);
    const [c] = stormCandidates(env, [at(0.5)], () => 0.25);
    expect(c!.t).toBeCloseTo(onset - lead, 9);
    expect(c!.uAccept).toBe(0);
    expect(c!.uOutcome).toBe(0.25);
    expect(c!.real?.id).toBe('2030-01-03T06:00:00-FLR-001');
  });

  it('an onset on a day storms cannot strike (the arrival burn) moves to the next day they can', () => {
    expect(allowed).not.toContain(env.days[env.arrivalDay]!.phase);
    const f = (env.arrivalDay + 0.25 - cruiseStart) / span;
    const next = env.days.find((d) => d.day > env.arrivalDay && allowed.includes(d.phase))!.day;
    expect(stormOnset(env, at(f))).toBe(next);
  });

  it('candidates come in time order, one per storm, each with its own outcome draw', () => {
    const storms = realStorms(sample);
    const draws = [0.1, 0.2, 0.3, 0.4];
    let i = 0;
    const cs = stormCandidates(env, storms, () => draws[i++]!);
    expect(cs.map((c) => c.real!.id)).toEqual(storms.map((s) => s.id));
    expect(cs.map((c) => c.uOutcome)).toEqual(draws);
    for (let k = 1; k < cs.length; k++) expect(cs[k]!.t).toBeGreaterThanOrEqual(cs[k - 1]!.t);
  });
});

const recordedFlr = fixture('flr-2024-05-08_2024-05-14.json');
const recordedCme = fixture('cme-2024-05-08_2024-05-14.json');

describe('recorded 2024-05-08 → 14 week, the Gannon storm (real CCMC responses)', () => {
  const body = (u: URL) => {
    const t = readFileSync(u, 'utf8');
    return t.trim() === '' ? [] : (JSON.parse(t) as unknown[]);
  };
  const snapshot = () =>
    readSnapshot(
      JSON.stringify({
        fetchedAt: '2024-05-15T00:20:00.000Z',
        source: { base: SPACE_WEATHER.donki.apiBase.value, announcement: SPACE_WEATHER.donki.apiBase.url },
        window: { startDate: '2024-05-08', endDate: '2024-05-14' },
        flr: { url: 'recorded', records: body(recordedFlr) },
        cme: { url: 'recorded', records: body(recordedCme) },
      }),
    )!;

  it('the real responses read as a snapshot, with flares and CMEs', () => {
    const s = snapshot();
    expect(s).toBeDefined();
    expect(s.flr.records.length).toBeGreaterThan(0);
    expect(s.cme.records.length).toBeGreaterThan(0);
  });

  it('the week of the May 2024 storms gives the full deck of 4, led by X flares, each linked to DONKI', () => {
    // NOAA: several X-class flares from region 3664 between May 8 and May 14, 2024.
    const storms = realStorms(snapshot());
    expect(storms.length).toBe(SPACE_WEATHER.storms.maxStorms.value);
    expect(storms.some((s) => s.classType?.startsWith('X'))).toBe(true);
    for (const s of storms) {
      expect(s.link).toMatch(/^https:\/\//);
      expect(s.date >= '2024-05-08' && s.date <= '2024-05-14').toBe(true);
    }
    expect(realStorms(snapshot())).toEqual(storms);
  });
});

describe('the committed live snapshot (public/data/donki-latest.json, refreshed daily by the Action)', () => {
  it('reads as a snapshot with a 7-day window; its storms all link to DONKI (shape only: the content changes daily)', () => {
    const live = readSnapshot(readFileSync(new URL('../public/data/donki-latest.json', import.meta.url), 'utf8'));
    expect(live).toBeDefined();
    // endDate − startDate = 6 days → a 7-day window.
    expect((Date.parse(live!.window.endDate) - Date.parse(live!.window.startDate)) / 86_400_000).toBe(SPACE_WEATHER.donki.windowDays.value - 1);
    for (const s of realStorms(live!)) expect(s.link).toMatch(/^https:\/\//);
  });
});
