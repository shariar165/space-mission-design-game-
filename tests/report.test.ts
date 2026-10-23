// Mission Report (engine: src/engine/ops/report.ts): the 4-panel comic, what saved you / what hurt you, the
// comparison with the real mission, and the star rules as Sourced values. Hand calculations in comments.
import { describe, expect, it } from 'vitest';
import { compareWithRealMission } from '../src/engine/compare';
import { evaluateDesign } from '../src/engine/index';
import { presetDesign } from '../src/engine/missions';
import { advanceOperations, decide, operationsDebrief, runOperations, startOperations, type OpsState } from '../src/engine/ops/index';
import { finalTransmission, reportCompare, reportPanels, reportVerdict } from '../src/engine/ops/report';
import { oneWayAt } from '../src/engine/ops/commands';
import { robotMessages } from '../src/engine/ops/voice';
import { STAR_RULES, stars } from '../src/engine/scoring';
import { buildPackDesign, initialPack, packPart, shelfFor } from '../src/engine/pack';
import { starterDesign } from '../src/ui/starters';

const maven = presetDesign('maven');

/** Fly a whole prime mission with a policy, ending it at the extension decision. */
const fly = (opts: { seed?: number; rng?: () => number }, policy: 'safe' | 'risky' | 'default' = 'safe'): OpsState =>
  runOperations(maven, { ...opts, policy, extension: 'end' }).state;

describe('star rules are Sourced', () => {
  it('one star for the first science home, two at 50% of the science, three at 80%', () => {
    expect(STAR_RULES.scienceForSecondStar.value).toBe(50);
    expect(STAR_RULES.scienceForThirdStar.value).toBe(80);
    expect(STAR_RULES.scienceForSecondStar.isGameEstimate).toBe(true);
    expect(stars({ firstScienceHome: true, scienceScore: 49.9 })).toBe(1);
    expect(stars({ firstScienceHome: true, scienceScore: 80 })).toBe(3);
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

// ---------------------------------------------------------------------------
// FINAL TRANSMISSION: the robot's last words come off the teletype before the report (design screen 03).

describe('final transmission', () => {
  const maven = presetDesign('maven');
  const DAY_S = 86_400;

  it('a complete mission: opening, its moments in time order, then the sign-off; 3–5 lines', () => {
    const s = runOperations(maven, { rng: () => 0.999999 }).state;
    const ft = finalTransmission(s)!;
    expect(ft.ending).toBe('complete');
    expect(ft.lines.length).toBeGreaterThanOrEqual(3);
    expect(ft.lines.length).toBeLessThanOrEqual(5);
    expect(ft.lines[0]!.kind).toBe('opening');
    expect(ft.lines.at(-1)!.kind).toBe('sign-off');
    // The opening says the day it was sent and the science days flown.
    expect(ft.lines[0]!.values.day).toBe(Math.floor(ft.sentAt));
    expect(ft.lines[0]!.values.scienceDays).toBe(Math.floor(s.scienceDaysAchieved));
    const middleDays = ft.lines.slice(1, -1).map((l) => l.values.day ?? 0);
    expect([...middleDays].sort((a, b) => a - b)).toEqual(middleDays);
    // A calm MAVEN: the arrival burn (its Δv) and the first conjunction (its length) are its moments.
    const arrival = ft.lines.find((l) => l.kind === 'arrival')!;
    expect(arrival.values.dv_ms).toBe(s.env.burns.find((b) => b.kind === 'arrival')!.dv_ms);
    const conj = ft.lines.find((l) => l.kind === 'conjunction')!;
    const w = s.env.conjunctions[0]!;
    expect(conj.values.days).toBe(w.endDay - w.startDay + 1);
  });

  it('it is the robot’s last message: sent when it signed off, received one light time later', () => {
    const s = runOperations(maven, { rng: () => 0.999999 }).state;
    const ft = finalTransmission(s)!;
    const last = robotMessages(s).at(-1)!;
    expect(last.kind).toBe('signing-off');
    expect(ft.sentAt).toBe(last.sentAt);
    expect(ft.receivedAt).toBeCloseTo(ft.sentAt + oneWayAt(s.env, ft.sentAt) / DAY_S, 12);
    expect(ft.delay_s).toBeCloseTo(oneWayAt(s.env, ft.sentAt), 6);
  });

  it('a lost robot: what happened, then a line cut off mid-word', () => {
    // Seed 6: lost in the science phase after a missed deadline (the robot's default answer failed).
    const s = runOperations(maven, { seed: 6, policy: 'default' }).state;
    expect(s.status).toBe('lost');
    const ft = finalTransmission(s)!;
    expect(ft.ending).toBe('lost');
    expect(ft.cutOff).toBe(true);
    expect(ft.sentAt).toBeCloseTo(s.failureT!, 9);
    expect(ft.lines.length).toBeGreaterThanOrEqual(3);
    expect(ft.lines.length).toBeLessThanOrEqual(5);
    expect(ft.lines.at(-1)!.kind).toBe('cut-off');
    const cause = ft.lines.find((l) => l.kind === 'cause')!;
    const bad = s.events.find((e) => e.code === 'response-outcome' && e.values.bad && Math.abs(e.t - s.failureT!) < 1e-9);
    expect(cause.values.cause).toBe(bad ? 'hazard' : cause.values.cause);
    if (bad) expect(cause.values.hazardType).toBe(s.hazards.find((h) => h.id === bad.values.hazardId)!.type);
  });

  it('an extended mission: fuel left, the years flown, and STILL HERE', () => {
    const s = runOperations(maven, { rng: () => 0.999999, extension: 'longest' }).state;
    const ft = finalTransmission(s)!;
    expect(ft.ending).toBe('extended');
    expect(ft.cutOff).toBe(false);
    const ext = ft.lines.find((l) => l.kind === 'extension')!;
    expect(ext.values.years).toBe(s.extension!.years);
    const fuel = ft.lines.find((l) => l.kind === 'fuel')!;
    expect(fuel.values.propellantLeft_kg).toBeCloseTo(s.mass_kg - s.env.dryMass_kg, 9);
    expect(ft.lines.length).toBeLessThanOrEqual(5);
  });

  it('a launch failure sends nothing', () => {
    expect(finalTransmission(runOperations(maven, { rng: () => 0 }).state)).toBeUndefined();
  });

  it('the same flight gives the same transmission', () => {
    expect(finalTransmission(runOperations(maven, { seed: 2013 }).state)).toEqual(finalTransmission(runOperations(maven, { seed: 2013 }).state));
  });
});
