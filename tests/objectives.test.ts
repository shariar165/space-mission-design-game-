// Mission objectives (spec: Mission objectives). A Mars flight picks atmosphere, surface or moons. The objective's
// targets carry objectiveShare of the science, but only when the craft packs one of the objective's instruments;
// without one they count at the same rate as every other target. No objective = today's (balanced) weights.
import { describe, expect, it } from 'vitest';
import * as ops from '../src/engine/ops/index';
import { objectiveResult, scienceReturned, targetScience } from '../src/engine/ops/observe';
import { missionAlbum, scienceTargetsView } from '../src/engine/ops/scienceView';
import { OBJECTIVE_IDS, OBJECTIVE_RULES, objectiveOf, targetWeight, type ObjectiveId } from '../src/engine/objectives';
import { buildPackDesign, initialPack, packPart, shelfFor, unpackPart, type Packed, type PartId } from '../src/engine/pack';
import { presetDesign } from '../src/engine/missions';
import { TARGETS } from '../src/engine/targets';
import { starterDesign } from '../src/ui/starters';
import type { Design } from '../src/engine/types';
import type { OpsState } from '../src/engine/ops/types';

const calm = { rng: () => 0.999999 };
const ORDER = ['phobos', 'deimos', 'limb', 'olympus-mons', 'valles-marineris', 'north-polar-cap'];
const w = (design: Design, id: string) => targetWeight(design, TARGETS.find((t) => t.id === id)!);

/** A Cadet Mars craft carrying one science instrument (the sniffer is the starter's). */
function marsPack(instrument: PartId, objective?: ObjectiveId): Design {
  const base = starterDesign('mars', '2028-11-15');
  let p: Packed = unpackPart(initialPack(base, shelfFor('mars')), 'sniffer');
  p = packPart(p, instrument)!;
  return { ...buildPackDesign(base, p), ...(objective ? { objective } : {}) };
}

/** Fly to the science orbit, order every target (the craft refuses what it cannot pay for), fly to the end. */
function flyAll(d: Design): OpsState {
  let s = ops.startOperations(d, { seed: 7, ...calm });
  const sci = s.env.timeline.find((x) => x.phase === 'science')!;
  s = ops.advanceOperations(s, { until: sci.startDay + 0.1 });
  for (const id of ORDER) s = ops.advanceOperations(ops.sendCommand(s, { kind: 'observe', targetId: id }).state, { days: 0.5 });
  return ops.finishOperations(s);
}

describe('mission objectives: data', () => {
  it('three Mars objectives, each favouring one kind of target and naming the instruments that do its science', () => {
    expect(OBJECTIVE_IDS).toEqual(['atmosphere', 'surface', 'moons']);
    expect(objectiveOf('atmosphere').favours).toEqual(['limb']);
    expect(objectiveOf('surface').favours).toEqual(['surface']);
    expect(objectiveOf('moons').favours).toEqual(['moon']);
    for (const id of OBJECTIVE_IDS) expect(objectiveOf(id).instruments.length).toBeGreaterThan(0);
  });

  it('the share and the met threshold are game rules, never NASA data', () => {
    expect(OBJECTIVE_RULES.share.value).toBe(0.6);
    expect(OBJECTIVE_RULES.metFraction.value).toBe(0.5);
    for (const r of Object.values(OBJECTIVE_RULES)) expect(r.isGameEstimate).toBe(true);
  });
});

describe('mission objectives: target weights', () => {
  it('no objective keeps the balanced weights (Moon, the Daily and real missions are unchanged)', () => {
    const maven = presetDesign('maven');
    for (const t of TARGETS) expect(targetWeight(maven, t)).toBe(t.weight.value);
  });

  it('atmosphere with the sniffer: the limb carries 60%, the rest share 40% pro rata', () => {
    const d = marsPack('sniffer', 'atmosphere');
    // limb: 0.6 × 0.20 / 0.20 = 0.60; Olympus: 0.4 × 0.18 / 0.80 = 0.09; Phobos: 0.4 × 0.20 / 0.80 = 0.10
    expect(w(d, 'limb')).toBeCloseTo(0.6, 12);
    expect(w(d, 'olympus-mons')).toBeCloseTo(0.09, 12);
    expect(w(d, 'phobos')).toBeCloseTo(0.1, 12);
    expect(TARGETS.reduce((a, t) => a + targetWeight(d, t), 0)).toBeCloseTo(1, 12);
  });

  it('without a matching instrument the objective’s targets count at the others’ rate', () => {
    const d = marsPack('camera', 'atmosphere');
    // every target × (1 − 0.6) / (1 − 0.20) = × 0.5; limb 0.20 × 0.5 = 0.10, the set sums to 0.5
    expect(w(d, 'limb')).toBeCloseTo(0.1, 12);
    expect(w(d, 'olympus-mons')).toBeCloseTo(0.09, 12);
    expect(TARGETS.reduce((a, t) => a + targetWeight(d, t), 0)).toBeCloseTo(0.5, 12);
  });

  it('surface favours the three surface targets; moons favours Phobos and Deimos', () => {
    const s = marsPack('camera', 'surface');
    // surface weight 0.18 + 0.16 + 0.14 = 0.48: Olympus 0.6 × 0.18 / 0.48 = 0.225; Phobos 0.4 × 0.20 / 0.52 ≈ 0.153846
    expect(w(s, 'olympus-mons')).toBeCloseTo(0.225, 12);
    expect(w(s, 'phobos')).toBeCloseTo(0.4 * 0.2 / 0.52, 12);
    const m = marsPack('spectrometer', 'moons');
    // moons 0.20 + 0.12 = 0.32: Phobos 0.6 × 0.20 / 0.32 = 0.375; limb 0.4 × 0.20 / 0.68 ≈ 0.117647
    expect(w(m, 'phobos')).toBeCloseTo(0.375, 12);
    expect(w(m, 'limb')).toBeCloseTo(0.4 * 0.2 / 0.68, 12);
  });

  it('the Science Targets cards and the album show the objective’s weights', () => {
    const s = flyAll(marsPack('sniffer', 'atmosphere'));
    expect(missionAlbum(s)!.frames.find((f) => f.targetId === 'limb')!.weight).toBeCloseTo(0.6, 12);
    let live = ops.startOperations(marsPack('sniffer', 'atmosphere'), { seed: 7, ...calm });
    live = ops.advanceOperations(live, { until: live.env.timeline.find((x) => x.phase === 'science')!.startDay + 0.1 });
    expect(scienceTargetsView(live)!.cards.find((c) => c.id === 'limb')!.weight).toBeCloseTo(0.6, 12);
  });
});

describe('mission objectives: different designs win', () => {
  // Every pack reaches the same five targets in a calm flight (Deimos needs 750 m/s): Olympus, Valles, the cap,
  // Phobos and the limb; balanced 0.88. The objective decides which instrument makes that worth the most.
  const packs: PartId[] = ['sniffer', 'camera', 'spectrometer'];
  const science = Object.fromEntries(
    OBJECTIVE_IDS.map((o) => [o, Object.fromEntries(packs.map((p) => [p, scienceReturned(flyAll(marsPack(p, o)))]))]),
  ) as Record<ObjectiveId, Record<PartId, number>>;

  it('atmosphere: the sniffer pack wins (0.94 against 0.44)', () => {
    // 0.60 + 0.5 × (0.88 − 0.20) = 0.94; unmatched 0.5 × 0.88 = 0.44
    expect(science.atmosphere.sniffer).toBeCloseTo(0.94, 9);
    expect(science.atmosphere.camera).toBeCloseTo(0.44, 9);
  });

  it('surface: the camera pack wins (about 0.91 against 0.68)', () => {
    // 0.6 + (0.4 / 0.52) × 0.40 ≈ 0.907692; unmatched (0.4 / 0.52) × 0.88 ≈ 0.676923
    expect(science.surface.camera).toBeCloseTo(0.6 + (0.4 / 0.52) * 0.4, 9);
    expect(science.surface.sniffer).toBeCloseTo((0.4 / 0.52) * 0.88, 9);
  });

  it('moons: the spectrometer pack wins (0.775 against about 0.52)', () => {
    // Phobos 0.375 + (0.4 / 0.68) × 0.68 = 0.775; unmatched (0.4 / 0.68) × 0.88 ≈ 0.517647
    expect(science.moons.spectrometer).toBeCloseTo(0.775, 9);
    expect(science.moons.camera).toBeCloseTo((0.4 / 0.68) * 0.88, 9);
  });

  it('so each objective has a different best pack', () => {
    const best = (o: ObjectiveId) => packs.reduce((a, p) => (science[o][p] > science[o][a] ? p : a));
    expect(OBJECTIVE_IDS.map(best)).toEqual(['sniffer', 'camera', 'spectrometer']);
  });
});

describe('mission objectives: met', () => {
  it('is met when half the objective’s own weight came home with a matching instrument', () => {
    // atmosphere: the limb (all of it) home with the sniffer → 1 ≥ 0.5
    const r = objectiveResult(flyAll(marsPack('sniffer', 'atmosphere')))!;
    expect(r).toMatchObject({ objective: 'atmosphere', matched: true, met: true });
    expect(r.favouredHome).toBeCloseTo(1, 12);
    // moons: Phobos only, 0.20 / 0.32 = 0.625 ≥ 0.5
    expect(objectiveResult(flyAll(marsPack('spectrometer', 'moons')))!.favouredHome).toBeCloseTo(0.625, 12);
    expect(objectiveResult(flyAll(marsPack('spectrometer', 'moons')))!.met).toBe(true);
  });

  it('is not met without a matching instrument, and there is no result without an objective', () => {
    expect(objectiveResult(flyAll(marsPack('camera', 'atmosphere')))!).toMatchObject({ matched: false, met: false });
    expect(objectiveResult(flyAll(marsPack('sniffer')))).toBeUndefined();
  });

  it('is ignored away from Mars: the Moon keeps its own weights', () => {
    const moon = { ...starterDesign('moon', '2027-03-01'), scienceTargets: true, objective: 'surface' as const };
    const s = ops.startOperations(moon, calm);
    expect(objectiveResult(s)).toBeUndefined();
    expect(targetScience(s).fraction).toBe(0);
  });
});
