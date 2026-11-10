// Science-orbit presets on the Mars Pack (spec UI rule 59). Three orbits, each winning something: stay in the capture
// orbit (no burn, the most fuel left), MAVEN's science orbit (sourced; Phobos in reach, the best atmosphere and
// surface scores) and a high orbit (game rule; both moons in reach with the extra tank). Hand calculations in comments.
import { describe, expect, it } from 'vitest';
import { evaluateDesign } from '../src/engine/index';
import * as ops from '../src/engine/ops/index';
import { scienceReturned } from '../src/engine/ops/observe';
import { missionAlbum } from '../src/engine/ops/scienceView';
import { missionPreset } from '../src/engine/missions';
import { ORBIT_PRESETS, orbitCards, orbitIdOf, orbitPresets, withOrbit } from '../src/engine/orbitPresets';
import { buildPackDesign, initialPack, packPart, shelfFor, unpackPart, type PartId } from '../src/engine/pack';
import { starterDesign } from '../src/ui/starters';
import type { Design } from '../src/engine/types';
import type { OpsState } from '../src/engine/ops/types';

const ORDER = ['phobos', 'deimos', 'limb', 'olympus-mons', 'valles-marineris', 'north-polar-cap'];
/** A sensible player on seed 2013: safest answers, every target ordered as the science phase opens. */
function fly(d: Design): OpsState {
  let s = ops.startOperations(d, { seed: 2013 });
  const until = s.env.timeline.find((x) => x.phase === 'science')!.startDay + 0.1;
  while (s.status === 'flying' && s.t < until) {
    const t0 = s.t;
    s = ops.advanceOperations(s, { until });
    for (const id of s.newDecisions) {
      const dec = s.decisions.find((x) => x.id === id)!;
      if (dec.kind === 'hazard' && !dec.commanded) s = ops.decide(s, id, dec.safestOptionId!).state;
    }
    if (s.t <= t0 && s.newDecisions.length === 0) break;
  }
  for (const id of ORDER) if (s.status === 'flying') s = ops.advanceOperations(ops.sendCommand(s, { kind: 'observe', targetId: id }).state, { days: 0.5 });
  return ops.finishOperations(s, { policy: 'safe' });
}
const mars = (objective?: Design['objective']): Design => ({ ...starterDesign('mars', '2028-11-15'), scienceTargets: true, ...(objective ? { objective } : {}) });
function pack(base: Design, add: PartId[] = [], remove: PartId[] = []): Design {
  let p = initialPack(base, shelfFor('mars'));
  for (const id of remove) p = unpackPart(p, id);
  for (const id of add) p = packPart(p, id)!;
  return buildPackDesign(base, p);
}

describe('the presets', () => {
  it('Mars only: capture, MAVEN, high; MAVEN’s is the sourced orbit, the high one a game rule', () => {
    expect(orbitPresets('mars')).toEqual(['capture', 'maven', 'high']);
    for (const d of ['moon', 'venus', 'bennu', 'jupiter'] as const) expect(orbitPresets(d)).toEqual([]);
    const so = missionPreset('maven').design.scienceOrbit!;
    expect(ORBIT_PRESETS.maven.periapsis_km).toBe(so.periapsis_km);
    expect(ORBIT_PRESETS.maven.apoapsis_km).toBe(so.apoapsis_km);
    expect(ORBIT_PRESETS.maven.periapsis_km.isGameEstimate).toBe(false);
    expect(ORBIT_PRESETS.high.periapsis_km.value).toBe(400);
    expect(ORBIT_PRESETS.high.apoapsis_km.value).toBe(20000);
    expect(ORBIT_PRESETS.high.apoapsis_km.isGameEstimate).toBe(true);
  });

  it('the Mars starter flies MAVEN’s orbit; a preset keeps the orbit’s orientation; the capture orbit is the arrival orbit', () => {
    const base = mars();
    expect(orbitIdOf(base)).toBe('maven');
    const high = withOrbit(base, 'high');
    expect(high.scienceOrbit).toEqual({ ...base.scienceOrbit, periapsis_km: 400, apoapsis_km: 20000 });
    expect(orbitIdOf(high)).toBe('high');
    const cap = withOrbit(base, 'capture');
    expect(cap.scienceOrbit!.periapsis_km).toBe(base.captureOrbit.periapsis_km);
    expect(cap.scienceOrbit!.apoapsis_km).toBe(base.captureOrbit.apoapsis_km);
    expect(cap.scienceOrbit!.inclination_deg).toBe(base.scienceOrbit!.inclination_deg);
    expect(orbitIdOf(cap)).toBe('capture');
    expect(orbitIdOf(withOrbit(cap, 'maven'))).toBe('maven');
  });
});

describe('the cards', () => {
  const d = pack(mars());
  const cards = orbitCards(d);
  const by = (id: string) => cards.find((c) => c.id === id)!;

  it('orbit-change fuel comes from the Δv budget: none to stay, least to go high, most to go down to MAVEN’s', () => {
    for (const c of cards) {
      const ev = evaluateDesign(withOrbit(d, c.id));
      expect(c.orbitChange_ms).toBeCloseTo(ev.details.deltaVBudget.orbitTransfer_ms, 9);
      expect(c.fuelMargin).toBeCloseTo(ev.meters.deltaV.margin, 9);
      expect(c.longestShadow_s).toBeCloseTo(ev.details.power.battery.sizedForEclipse_s, 9);
    }
    // capture 380 × 44,477 km: no burn; vis-viva two-burn changes: high ≈ 167 m/s, MAVEN ≈ 547 m/s
    expect(by('capture').orbitChange_ms).toBe(0);
    expect(by('high').orbitChange_ms).toBeGreaterThan(150);
    expect(by('high').orbitChange_ms).toBeLessThan(by('maven').orbitChange_ms);
    expect(by('maven').orbitChange_ms).toBeGreaterThan(500);
    expect(by('capture').fuelMargin).toBeGreaterThan(by('high').fuelMargin);
    expect(by('high').fuelMargin).toBeGreaterThan(by('maven').fuelMargin);
    expect(by('maven').picked).toBe(true);
  });

  it('each card prices the round trip to each moon from that orbit, and the drag of its low passes', () => {
    // Deimos orbits at a = 23,460 km (≈ 20,070 km altitude): the high orbit's apoapsis is nearly there, so its trip is
    // cheaper than from MAVEN's; Phobos (≈ 6,000 km altitude) is the reverse
    expect(by('high').moons.deimos_ms).toBeLessThan(by('maven').moons.deimos_ms);
    expect(by('maven').moons.phobos_ms).toBeLessThan(by('high').moons.phobos_ms);
    // drag scales with the air at periapsis against MAVEN's nominal corridor (0.10 kg/km³ at 158.5 km): 150 km is
    // below it, so > 1; almost none at the capture orbit's 380 km and the high orbit's 400 km (lower is more air)
    expect(by('maven').drag).toBeGreaterThan(1);
    expect(by('capture').drag).toBeLessThan(0.01);
    expect(by('capture').drag).toBeGreaterThan(by('high').drag);
  });
});

describe('same pack, same seed, different orbits: different science (seed 2013)', () => {
  it('moons with the spectrometer and the extra tank: capture 62.5%, MAVEN 77.5%, high 100%', () => {
    const base = mars('moons');
    const sci = (o: string) => {
      const s = fly(pack(withOrbit(base, o), ['spectrometer', 'tank'], ['sniffer']));
      return { s, sci: scienceReturned(s), stars: ops.operationsDebrief(s).stars };
    };
    // capture: Deimos 0.6 × 0.12 / 0.32 = 0.225, Phobos out of fuel reach, the rest (0.4 / 0.68) × 0.68 = 0.4 → 0.625
    expect(sci('capture').sci).toBeCloseTo(0.625, 9);
    // MAVEN: Phobos 0.375 + 0.4 = 0.775 (Deimos out of reach)
    expect(sci('maven').sci).toBeCloseTo(0.775, 9);
    // high: both moons 0.6 + the rest 0.4 = 1.0, three stars: the moons objective's third star is reachable
    const high = sci('high');
    expect(high.sci).toBeCloseTo(1, 9);
    expect(high.stars).toBe(3);
    expect(missionAlbum(high.s)!.frames.every((f) => f.status === 'home')).toBe(true);
  });

  it('atmosphere with the starter: MAVEN’s orbit is best (94%) and the high one still earns three stars (90%)', () => {
    const base = mars('atmosphere');
    // MAVEN: limb 0.6 + 0.5 × (0.88 − 0.20) = 0.94; high: Deimos in, Phobos out: 0.6 + 0.5 × (0.80 − 0.20) = 0.90
    expect(scienceReturned(fly(pack(withOrbit(base, 'maven'))))).toBeCloseTo(0.94, 9);
    const high = fly(pack(withOrbit(base, 'high')));
    expect(scienceReturned(high)).toBeCloseTo(0.9, 9);
    expect(ops.operationsDebrief(high).stars).toBe(3);
  });
});
