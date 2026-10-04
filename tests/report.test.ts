// Mission Report (engine: src/engine/ops/report.ts): the 4-panel comic, what saved you / what hurt you, the
// comparison with the real mission, and the star rules as Sourced values. Hand calculations in comments.
import { describe, expect, it } from 'vitest';
import { compareWithRealMission } from '../src/engine/compare';
import { evaluateDesign } from '../src/engine/index';
import { presetDesign } from '../src/engine/missions';
import { advanceOperations, decide, operationsDebrief, runOperations, startOperations, type OpsState } from '../src/engine/ops/index';
import { reportCompare, reportPanels, reportVerdict } from '../src/engine/ops/report';
import { STAR_RULES, stars } from '../src/engine/scoring';
import { buildPackDesign, initialPack, packPart, shelfFor } from '../src/engine/pack';
import { starterDesign } from '../src/ui/starters';

const maven = presetDesign('maven');

/** Fly a whole prime mission with a policy, ending it at the extension decision. */
const fly = (opts: { seed?: number; rng?: () => number }, policy: 'safe' | 'risky' | 'default' = 'safe'): OpsState =>
  runOperations(maven, { ...opts, policy, extension: 'end' }).state;

describe('star rules are Sourced', () => {
  it('one star for reaching science (3 phases), two at a science score of 70', () => {
    expect(STAR_RULES.phasesToReachScience.value).toBe(3);
    expect(STAR_RULES.scienceForSecondStar.value).toBe(70);
    expect(STAR_RULES.scienceForSecondStar.isGameEstimate).toBe(true);
    const margins = { deltaV: 0.2, power: 0.2, mass: 0.2 };
    expect(stars({ reachedScience: true, scienceScore: 69.9, margins })).toBe(1);
    expect(stars({ reachedScience: true, scienceScore: 70, margins })).toBe(3);
  });
});

describe('the comic: four key moments', () => {
  it('a quiet mission: launch, arrival, the solar conjunction, then the end of the prime mission, in time order', () => {
    const s = fly({ rng: () => 0.999999 });
    const p = reportPanels(s);
    expect(p.length).toBe(4);
    expect(p[0]!.kind).toBe('launch');
    expect(p[0]!.day).toBe(0);
    expect(p[3]!.kind).toBe('complete');
    expect(p.map((x) => x.kind)).toContain('arrival');
    for (let i = 1; i < p.length; i++) expect(p[i]!.day).toBeGreaterThanOrEqual(p[i - 1]!.day);
    const arr = p.find((x) => x.kind === 'arrival')!;
    expect(arr.day).toBe(s.env.arrivalDay);
    expect(arr.dv_ms).toBeGreaterThan(0);
  });

  it('a hazard you answered takes a middle panel, with your choice and how it went', () => {
    const s = fly({ seed: 2013 }, 'safe');
    const p = reportPanels(s);
    const h = p.find((x) => x.kind === 'hazard')!;
    const rec = s.hazards.find((x) => x.choice && Math.floor(x.onset) === h.day)!;
    expect(h.hazardType).toBe(rec.type);
    expect(h.optionId).toBe(rec.choice!.optionId);
    expect(h.bad).toBe(rec.choice!.badOutcome ?? false);
  });

  it('a lost craft ends on the loss', () => {
    let s = startOperations(maven, { seed: 2013 });
    s = advanceOperations(s);
    const dec = s.decisions.find((d) => !d.commanded && d.kind === 'hazard')!;
    s = decide(s, dec.id, dec.hazardOptions!.at(-1)!.id).state;
    const lost: OpsState = { ...advanceOperations(s, { until: s.t + 5 }), status: 'lost', failureT: s.t + 2, failedPhase: 'cruise' };
    expect(reportPanels(lost).at(-1)!.kind).toBe('lost');
  });
});

describe('what saved you, what hurt you', () => {
  it('a packed shield that met a solar storm is what saved you; a bad outcome is what hurt you', () => {
    const mars = starterDesign('mars', '2026-10-05');
    const shielded = buildPackDesign(mars, packPart(initialPack(mars, shelfFor('mars')), 'shield')!);
    const s = runOperations(shielded, { seed: 2013, policy: 'safe', extension: 'end' }).state;
    const v = reportVerdict(s);
    const storm = s.hazards.find((h) => h.type === 'solar-storm' && h.choice && !h.choice.badOutcome);
    if (storm) expect(v.saved).toEqual({ code: 'part', part: 'shield', hazardType: 'solar-storm' });
    const bad = s.hazards.find((h) => h.choice?.badOutcome);
    if (bad) expect(v.hurt).toMatchObject({ code: 'bad-outcome', hazardType: bad.type, optionId: bad.choice!.optionId });
  });

  it('a quiet mission: nothing to save you from; the weakest score category is what hurt you', () => {
    const s = fly({ rng: () => 0.999999 });
    const v = reportVerdict(s);
    expect(v.saved.code).toBe('quiet');
    const d = operationsDebrief(s);
    const weakest = [...d.breakdown].sort((a, b) => a.score - b.score)[0]!;
    if (weakest.score < 40) expect(v.hurt).toEqual({ code: 'category', category: weakest.category, score: weakest.score });
    else expect(v.hurt.code).toBe('nothing');
  });
});

describe('you vs the real one', () => {
  it('launch date and planned science life from the preset, then the engine’s mass, power and Δv rows', () => {
    const ev = evaluateDesign(maven);
    const c = reportCompare(maven, ev)!;
    expect(c.missionId).toBe('maven');
    expect(c.launch.you).toBe(ev.details.launchDate);
    expect(c.launch.them.value).toBe(presetDesign('maven').launchDate);
    expect(c.scienceDays.you).toBe(ev.details.scienceDays);
    expect(c.scienceDays.them!.value).toBe(presetDesign('maven').scienceDays);
    expect(c.rows).toEqual(compareWithRealMission(maven, ev)!.rows);
    const venus = starterDesign('venus', '2026-10-05');
    expect(reportCompare(venus, evaluateDesign(venus))).toBeUndefined();
  });
});
