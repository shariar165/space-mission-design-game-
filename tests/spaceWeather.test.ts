// NASA DONKI records → the live Daily's real dangers (engine: src/engine/spaceWeather.ts; spec UI rule 37).
// A solar energetic particle event (SEP) is a solar radiation storm; a CME is a danger only when NASA's WSA-ENLIL
// model predicts it reaches Mars, and then it is a CME shock that arrives at the predicted time. Flares are only
// context, named on the card of the SEP or CME DONKI links them to.
// The edge cases run on a hand-written snapshot in the documented DONKI record format (no real week has them all);
// the recorded block runs on real CCMC responses the DONKI GitHub Action saved (tests/fixtures/donki/recorded.json).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dailyDesign } from '../src/engine/daily';
import { HAZARDS } from '../src/engine/data';
import { prepareOps } from '../src/engine/ops/timeline';
import {
  isFresh,
  predictionSourced,
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
const DAY = 86_400_000;

describe('DONKI → dangers: edge cases (hand-written documented-format sample)', () => {
  it('reads a snapshot; anything else (a web page, bad JSON, a missing window) is no snapshot', () => {
    expect(sample.window).toEqual({ startDate: '2030-01-01', endDate: '2030-01-07' });
    expect(sample.flr.records.length).toBe(4);
    expect(sample.cme.records.length).toBe(7);
    expect(sample.sep.records.length).toBe(3);
    expect(readSnapshot('<!DOCTYPE html><html><body>Signal Delay</body></html>')).toBeUndefined(); // Vite's fallback page
    expect(readSnapshot('{"window": 3}')).toBeUndefined();
    expect(readSnapshot('')).toBeUndefined();
    const { window: _w, ...noWindow } = JSON.parse(sampleText) as DonkiSnapshot;
    expect(readSnapshot(JSON.stringify(noWindow))).toBeUndefined();
  });

  it('a snapshot from before SEP was fetched still reads, with no SEP events', () => {
    const { sep: _s, ...old } = JSON.parse(sampleText) as DonkiSnapshot;
    const s = readSnapshot(JSON.stringify(old))!;
    expect(s.sep.records).toEqual([]);
    expect(realStorms(s).every((x) => x.hazard === 'cme-shock')).toBe(true);
  });

  it('a quiet week (no records) is a live snapshot with no dangers, not an offline one', () => {
    const quiet = readSnapshot(
      JSON.stringify({ ...JSON.parse(sampleText), flr: { url: 'f', records: [] }, cme: { url: 'c', records: [] }, sep: { url: 's', records: [] } }),
    )!;
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

  it('dangers: every SEP, and each CME the most-accurate analysis’s ENLIL run predicts at Mars; never a flare', () => {
    // Qualifying, with severity (direct 1, glancing 0.5, minor 0.25, both → the smaller):
    //   CME Jan 2 00:00 (glancing + minor → 0.25), CME Jan 3 06:24 (direct, 1), SEP Jan 3 08:00 (1),
    //   CME Jan 4 00:00 (glancing, 0.5), CME Jan 5 00:00 (minor, 0.25), CME Jan 6 06:00 (direct, 1), SEP Jan 6 12:00 (1).
    // Not dangers: the four flares (context only), the 999 km/s CME that misses Mars, the CME with no analyses.
    const all = realStorms(sample, { maxStorms: 99 });
    expect(all.map((s) => s.id)).toEqual([
      '2030-01-02T00:00:00-CME-001',
      '2030-01-03T06:24:00-CME-001',
      '2030-01-03T08:00:00-SEP-001',
      '2030-01-04T00:00:00-CME-001',
      '2030-01-05T00:00:00-CME-001',
      '2030-01-06T06:00:00-CME-001',
      '2030-01-06T12:00:00-SEP-001',
    ]);
    expect(all.map((s) => s.severity)).toEqual([0.25, 1, 1, 0.5, 0.25, 1, 1]);
    expect(all.map((s) => s.hazard)).toEqual(['cme-shock', 'cme-shock', 'solar-storm', 'cme-shock', 'cme-shock', 'cme-shock', 'solar-storm']);
    expect(all.some((s) => s.id.includes('FLR'))).toBe(false);
  });

  it('the cap keeps the 4 most severe (ties: earlier first), in time order', () => {
    // Severity 1: CME Jan 3 06:24, SEP Jan 3 08:00, CME Jan 6 06:00, SEP Jan 6 12:00 — exactly four.
    expect(SPACE_WEATHER.storms.maxStorms.value).toBe(4);
    expect(realStorms(sample).map((s) => s.id)).toEqual([
      '2030-01-03T06:24:00-CME-001',
      '2030-01-03T08:00:00-SEP-001',
      '2030-01-06T06:00:00-CME-001',
      '2030-01-06T12:00:00-SEP-001',
    ]);
  });

  it('a CME arrives when the latest ENLIL run of its most-accurate analysis says, never from another analysis', () => {
    const c = realStorms(sample).find((s) => s.id === '2030-01-03T06:24:00-CME-001')!;
    // Two runs (10:00 and 14:00); the 14:00 run's Mars arrival 2030-01-05T12:24Z counts. The 1500 km/s analysis that is
    // not the most accurate (arrival Jan 4) is ignored. Transit = Jan 5 12:24 − Jan 3 06:24 = 2 d 6 h = 2.25 d.
    expect(c).toMatchObject({ kind: 'cme', hazard: 'cme-shock', speed_kms: 1800, flare: 'X2.1', time: '2030-01-03T06:24Z', date: '2030-01-03' });
    expect(c.arrival).toMatchObject({ location: 'Mars', time: '2030-01-05T12:24Z', isGlancingBlow: false, isMinorImpact: false, link: 'https://example.invalid/donki-sample/WSA-ENLIL/2c' });
    expect(c.arrival!.transit_days).toBeCloseTo(2.25, 12);
    // Every tracked location of that run is kept for future levels.
    expect(c.impacts.map((i) => i.location).sort()).toEqual(['Mars', 'Psyche']);
    expect(c.eventIds).toEqual(['2030-01-03T06:00:00-FLR-001', '2030-01-03T06:24:00-CME-001']);
    // Position in the 7-day window: Jan 3 06:24 is 2 d 6 h 24 min after Jan 1 00:00.
    expect(c.windowFraction).toBeCloseTo((2 + 6.4 / 24) / 7, 12);
  });

  it('a flare linked only from its own side is still named on the CME card', () => {
    const all = realStorms(sample, { maxStorms: 99 });
    expect(all.find((s) => s.id === '2030-01-05T00:00:00-CME-001')!.flare).toBe('M5.0');
    expect(all.find((s) => s.id === '2030-01-04T00:00:00-CME-001')!.flare).toBeUndefined();
  });

  it('an SEP is a radiation storm at its event time, with the linked flare and the instruments that saw it', () => {
    const s = realStorms(sample).find((x) => x.id === '2030-01-03T08:00:00-SEP-001')!;
    expect(s).toMatchObject({ kind: 'sep', hazard: 'solar-storm', severity: 1, flare: 'X2.1', time: '2030-01-03T08:00Z' });
    expect(s.arrival).toBeUndefined();
    expect(s.link).toBe('https://example.invalid/donki-sample/SEP/2030-01-03T08:00:00-SEP-001');
  });

  it('SEP records DONKI links to the same flare (one per instrument) are one radiation storm', () => {
    // 08:00 (GOES) and 09:30 (STEREO A) both link to the X2.1 flare: one storm at the earlier time, both instruments.
    const seps = realStorms(sample, { maxStorms: 99 }).filter((x) => x.kind === 'sep');
    expect(seps.map((x) => x.id)).toEqual(['2030-01-03T08:00:00-SEP-001', '2030-01-06T12:00:00-SEP-001']);
    const s = seps[0]!;
    expect(s.instruments).toEqual(['GOES-P: SEISS >10 MeV', 'STEREO A: IMPACT 13-100 MeV']);
    expect(s.eventIds).toEqual(['2030-01-03T06:00:00-FLR-001', '2030-01-03T08:00:00-SEP-001', '2030-01-03T09:30:00-SEP-001']);
  });

  it('ⓘ: the DONKI record for what was observed, and a separate WSA-ENLIL record for the predicted arrival', () => {
    const [cme, sep] = realStorms(sample) as [RealStorm, RealStorm];
    const obs = stormSourced(cme);
    expect(obs.url).toBe(cme.link);
    expect(obs.isGameEstimate).toBe(false);
    expect(obs.source).toContain('NASA DONKI');
    expect(obs.source).toContain('2030-01-03T06:24:00-CME-001');
    expect(obs.value).toContain('X2.1');
    const pred = predictionSourced(cme)!;
    expect(pred.source).toContain('NASA WSA-ENLIL model prediction');
    expect(pred.source).toMatch(/not an observation/);
    expect(pred.url).toBe('https://example.invalid/donki-sample/WSA-ENLIL/2c');
    expect(pred.value).toContain('2030-01-05 12:24 UTC');
    expect(predictionSourced(sep)).toBeUndefined();
    expect(stormSourced(sep).value).toMatch(/solar energetic particle/i);
  });
});

describe('replaying the real week across the Daily flight', () => {
  const env = prepareOps(dailyDesign(starterDesign('mars', '2026-10-08')));
  const cruiseStart = env.days.findIndex((d) => d.phase === 'cruise');
  const span = env.primeEndDay - cruiseStart;
  const lead = HAZARDS['solar-storm']!.warningLead_days.value;
  const allowed = HAZARDS['solar-storm']!.phases;
  const storms = realStorms(sample);
  const sep = storms.find((s) => s.kind === 'sep')!;
  const cme = storms.find((s) => s.kind === 'cme')!;
  const at = (s: RealStorm, windowFraction: number): RealStorm => ({ ...s, windowFraction });

  it('an SEP halfway through the week strikes halfway from the start of cruise to the end of the prime mission', () => {
    // onset = cruiseStart + 0.5 × (primeEndDay − cruiseStart); Earth is warned warningLead_days (1 d) before.
    const onset = cruiseStart + 0.5 * span;
    expect(allowed).toContain(env.days[Math.floor(onset)]!.phase);
    expect(stormOnset(env, at(sep, 0.5))).toBeCloseTo(onset, 9);
    expect(stormOnset(env, at(sep, 0))).toBeCloseTo(cruiseStart, 9);
    const c = stormCandidates(env, [at(sep, 0.5)], () => 0.25)['solar-storm']![0]!;
    expect(c.t).toBeCloseTo(onset - lead, 9);
    expect(c.uAccept).toBe(0);
    expect(c.uOutcome).toBe(0.25);
    expect(c.real?.id).toBe(sep.id);
  });

  it('a CME is seen when it erupts (its replayed time) and strikes after its real ENLIL transit, unscaled', () => {
    // Eruption at f = 0.5 → Earth sees it at cruiseStart + 0.5 × span; the shock arrives 2.25 days later (ENLIL).
    const seen = cruiseStart + 0.5 * span;
    expect(stormOnset(env, at(cme, 0.5))).toBeCloseTo(seen + 2.25, 9);
    const c = stormCandidates(env, [at(cme, 0.5)], () => 0.5)['cme-shock']![0]!;
    expect(c.t).toBeCloseTo(seen, 9);
  });

  it('an onset on a day storms cannot strike (the arrival burn) moves to the next day they can', () => {
    expect(allowed).not.toContain(env.days[env.arrivalDay]!.phase);
    const next = env.days.find((d) => d.day > env.arrivalDay && allowed.includes(d.phase))!.day;
    expect(stormOnset(env, at(sep, (env.arrivalDay + 0.25 - cruiseStart) / span))).toBe(next);
    // A CME keeps its real transit: the warning moves with the onset.
    const f = (env.arrivalDay + 0.25 - 2.25 - cruiseStart) / span;
    expect(stormOnset(env, at(cme, f))).toBe(next);
    expect(stormCandidates(env, [at(cme, f)], () => 0.5)['cme-shock']![0]!.t).toBeCloseTo(next - 2.25, 9);
  });

  it('candidates: one per storm, per hazard, in time order, each with its own outcome draw', () => {
    const draws = [0.1, 0.2, 0.3, 0.4];
    let i = 0;
    const cs = stormCandidates(env, storms, () => draws[i++]!);
    expect(cs['solar-storm']!.map((c) => c.real!.id)).toEqual(storms.filter((s) => s.kind === 'sep').map((s) => s.id));
    expect(cs['cme-shock']!.map((c) => c.real!.id)).toEqual(storms.filter((s) => s.kind === 'cme').map((s) => s.id));
    expect([...cs['solar-storm']!, ...cs['cme-shock']!].map((c) => c.uOutcome).sort()).toEqual(draws);
    for (const list of Object.values(cs)) for (let k = 1; k < list.length; k++) expect(list[k]!.t).toBeGreaterThanOrEqual(list[k - 1]!.t);
  });
});

const body = (u: URL) => {
  const t = readFileSync(u, 'utf8');
  return t.trim() === '' ? [] : (JSON.parse(t) as unknown[]);
};
const recordedSep = fixture('sep-2024-05-08_2024-05-14.json');

describe('recorded 2024-05-08 → 14 week, the Gannon storm (real CCMC responses)', () => {
  const snapshot = () =>
    readSnapshot(
      JSON.stringify({
        fetchedAt: '2024-05-15T00:20:00.000Z',
        source: { base: SPACE_WEATHER.donki.apiBase.value, announcement: SPACE_WEATHER.donki.apiBase.url },
        window: { startDate: '2024-05-08', endDate: '2024-05-14' },
        flr: { url: 'recorded', records: body(fixture('flr-2024-05-08_2024-05-14.json')) },
        cme: { url: 'recorded', records: body(fixture('cme-2024-05-08_2024-05-14.json')) },
        sep: { url: 'recorded', records: body(recordedSep) },
      }),
    )!;

  it('the real responses read as a snapshot, with flares and CMEs', () => {
    const s = snapshot();
    expect(s).toBeDefined();
    expect(s.flr.records.length).toBeGreaterThan(0);
    expect(s.cme.records.length).toBeGreaterThan(0);
  });

  it('the week of the May 2024 storms fills the deck; each CME card has a predicted Mars arrival after its eruption', () => {
    const storms = realStorms(snapshot());
    expect(storms.length).toBe(SPACE_WEATHER.storms.maxStorms.value);
    for (const s of storms) {
      expect(s.link).toMatch(/^https:\/\//);
      expect(s.date >= '2024-05-08' && s.date <= '2024-05-14').toBe(true);
      if (s.kind === 'cme') {
        expect(s.arrival!.location).toBe('Mars');
        expect(Date.parse(s.arrival!.time)).toBeGreaterThan(Date.parse(s.time));
        expect(s.arrival!.transit_days).toBeCloseTo((Date.parse(s.arrival!.time) - Date.parse(s.time)) / DAY, 9);
      }
    }
    expect(realStorms(snapshot())).toEqual(storms);
  });

  it('the 14 recorded SEP records are 4 radiation storms: one per flare DONKI links them to', () => {
    // From the recorded IDs and links: May 9 13:59 + 14:25 (X2.2), May 10 12:59 + 13:02 + 13:35 + 14:50 (X3.9),
    // May 11 02:10 + 04:07 (X5.8), May 13 12:44 … 18:07 (six records, M6.6).
    const seps = realStorms(snapshot(), { maxStorms: 99 }).filter((s) => s.kind === 'sep');
    expect(body(recordedSep).length).toBe(14);
    expect(seps.map((s) => [s.id, s.flare])).toEqual([
      ['2024-05-09T13:59:00-SEP-001', 'X2.2'],
      ['2024-05-10T12:59:00-SEP-001', 'X3.9'],
      ['2024-05-11T02:10:00-SEP-001', 'X5.8'],
      ['2024-05-13T12:44:00-SEP-001', 'M6.6'],
    ]);
    expect(seps.every((s) => s.hazard === 'solar-storm' && s.link.startsWith('https://'))).toBe(true);
    expect(seps.map((s) => s.eventIds.filter((id) => id.includes('SEP')).length)).toEqual([2, 4, 2, 6]);
  });
});

// The Pages build fetches the day's snapshot just before it runs the tests (pages.yml), so a malformed one never
// deploys. Pull requests and fresh clones have none (it is never committed): then there is nothing to check.
const liveSnapshot = new URL('../public/data/donki-latest.json', import.meta.url);

describe.skipIf(!existsSync(liveSnapshot))('the snapshot about to be deployed (fetched by the Pages build)', () => {
  it('reads as a snapshot with a 7-day window; its dangers all link to DONKI (shape only: the content changes daily)', () => {
    const live = readSnapshot(readFileSync(liveSnapshot, 'utf8'));
    expect(live).toBeDefined();
    // endDate − startDate = 6 days → a 7-day window.
    expect((Date.parse(live!.window.endDate) - Date.parse(live!.window.startDate)) / DAY).toBe(SPACE_WEATHER.donki.windowDays.value - 1);
    for (const s of realStorms(live!)) expect(s.link).toMatch(/^https:\/\//);
  });
});
