// Engine functions the UI calls, so the UI only formats numbers and never computes them.
// Hand calculations are in the comments, as in physics.test.ts.
import { describe, expect, it } from 'vitest';
import { compareWithRealMission, designDelta, METER_KEYS, REAL_MISSION_FOR } from '../src/engine/compare';
import { evaluateDesign, MONTE_CARLO_SEED, monteCarloMission, previewCrisis, simulateMission } from '../src/engine/index';
import { presetDesign } from '../src/engine/missions';
import { MAX_SCORE, nextStar, nextStarHint, SCORE_GRADES, scoreGrade } from '../src/engine/scoring';
import { bestLaunchWindow, lambertTransfer } from '../src/engine/trajectory';
import type { Design } from '../src/engine/types';

const maven = presetDesign('maven');
const ev = evaluateDesign(maven);

describe('evaluateDesign details for the UI', () => {
  it('costBreakdown adds up to the development cost', () => {
    // MAVEN preset: medium bus 180 + MAVEN payload 80 + hydrazine engine 15
    // + array 12 m² × 1.5 $M/m² = 18 + comms 10 + 3 $M/m² × π (2.0 m / 2)² = 19.42
    // = 312.42 $M
    const b = ev.details.costBreakdown;
    expect(b.bus).toBe(180);
    expect(b.instruments).toEqual([{ id: 'maven-science-payload', cost_M: 80 }]);
    expect(b.engine).toBe(15);
    expect(b.power).toBeCloseTo(18, 9);
    expect(b.comms).toBeCloseTo(10 + 3 * Math.PI, 9);
    const sum = b.bus + b.instruments.reduce((s, i) => s + i.cost_M, 0) + b.engine + b.power + b.comms;
    expect(sum).toBeCloseTo(ev.details.cost.development_M, 9);
    expect(ev.details.cost.development_M).toBeCloseTo(312.42, 2);
  });

  it('massBreakdown is the concept roll-up: dry = subtotal + 30% growth', () => {
    // bus 450 + payload 65 + array 12 m² × 4 kg/m² = 48 + battery + comms + tanks 0.12 × 1645 = 197.4
    // comms = 5 kg electronics + 8 kg/m² × π (2.0 m / 2)² + 0.1 kg/W × 100 W = 5 + 25.13 + 10 = 40.13 kg
    const m = ev.details.massBreakdown;
    expect(m.bus).toBe(450);
    expect(m.instruments).toEqual([{ id: 'maven-science-payload', kg: 65 }]);
    expect(m.powerGeneration).toBeCloseTo(48, 9);
    expect(m.tanks).toBeCloseTo(197.4, 9);
    expect(m.comms).toBeCloseTo(5 + 8 * Math.PI + 10, 9);
    const subtotal = m.bus + 65 + m.powerGeneration + m.battery + m.comms + m.tanks;
    expect(m.subtotal).toBeCloseTo(subtotal, 9);
    expect(m.growthMargin).toBeCloseTo(0.3 * subtotal, 9);
    // MAVEN flies its published dry mass (809 kg), not the roll-up.
    expect(ev.details.dryMass_kg).toBe(809);
  });

  it('a concept design (no as-flown mass) uses the roll-up as its dry mass', () => {
    const { asFlownDryMass_kg: _drop, ...concept } = maven;
    const c = evaluateDesign(concept);
    expect(c.details.dryMass_kg).toBeCloseTo(c.details.massBreakdown.subtotal + c.details.massBreakdown.growthMargin, 9);
  });
});

describe('Meter.headroom', () => {
  it('is limit − used on every meter (e.g. launch capacity left in kg)', () => {
    for (const m of Object.values(ev.meters)) expect(m.headroom).toBeCloseTo(m.limit - m.used, 9);
    // MAVEN: Atlas V 401 capacity at the Lambert C3 − 2,454 kg wet
    expect(ev.meters.mass.headroom).toBeCloseTo(ev.details.launchCapacity_kg - 2454, 9);
  });
});

describe('designDelta (catalogue cards)', () => {
  it('a bigger array adds its own mass and cost, and more power', () => {
    const { asFlownDryMass_kg: _drop, ...base } = maven;
    const bigger: Design = { ...base, power: { ...base.power, arrayArea_m2: 18 } };
    const d = designDelta(base, bigger);
    // +6 m² × 1.5 $M/m² = +9 $M development
    expect(d.developmentCost_M).toBeCloseTo(9, 9);
    // dry mass: +6 m² × 4 kg/m² = 24 kg of array, × 1.3 growth = +31.2 kg. The battery is sized by the
    // load and the eclipse, not by array area, so it does not change → +31.2 kg wet
    expect(d.wetMass_kg).toBeCloseTo(31.2, 6);
    // power available scales with area: × 18/12
    const p0 = evaluateDesign(base).details.power.available_W;
    expect(d.powerAvailable_W).toBeCloseTo(p0 * 0.5, 6);
    expect(d.meters.power.marginAfter).toBeGreaterThan(d.meters.power.marginBefore);
    expect(Object.keys(d.meters)).toEqual(METER_KEYS);
  });

  it('no change → all zeros, nothing fixed or broken', () => {
    const d = designDelta(maven, { ...maven });
    expect(d.wetMass_kg).toBe(0);
    expect(d.developmentCost_M).toBe(0);
    expect(d.fixes).toEqual([]);
    expect(d.breaks).toEqual([]);
    expect(d.blockersAdded).toEqual([]);
  });

  it('too much propellant breaks the mass meter and adds a launch blocker', () => {
    const heavy = { ...maven, propellant_kg: 4000 };
    const d = designDelta(maven, heavy);
    expect(d.breaks).toContain('mass');
    expect(d.blockersAdded.length).toBeGreaterThan(0);
  });
});

describe('compareWithRealMission (Debrief "You vs MAVEN")', () => {
  it('the MAVEN column matches NASA figures and hand calculations', () => {
    const c = compareWithRealMission(maven, ev)!;
    expect(c.missionId).toBe('maven');
    const them = (k: string) => c.rows.find((r) => r.metric === k)!;
    // NASA Science: MAVEN — 2,454 kg wet, 809 kg dry, so 2,454 − 809 = 1,645 kg propellant
    expect(them('wetMass').them).toBe(2454);
    expect(them('dryMass').them).toBe(809);
    expect(them('propellant').them).toBe(1645);
    expect(them('dryMass').themSource.isGameEstimate).toBe(false);
    // Δv = Isp g₀ ln(m_wet / m_dry) = 225 × 9.80665 × ln(2454 / 809)
    //    = 2206.496 × ln(3.033375) = 2206.496 × 1.109676 = 2448.50 m/s
    expect(them('deltaVCapability').them).toBeCloseTo(2448.5, 1);
    // NASA Science: MAVEN — the 12 m² arrays make 1,150–1,700 W at Mars; arrival-day power must lie in that range
    expect(them('powerAtArrival').them).toBeGreaterThanOrEqual(1150);
    expect(them('powerAtArrival').them).toBeLessThanOrEqual(1700);
  });

  it('a concept MAVEN (30% growth margin, no as-flown mass) shows the gap where it should', () => {
    // Same parts, but dry mass from the roll-up: subtotal × 1.3 instead of the published 809 kg.
    // Only dry mass (and wet mass, Δv) can differ; propellant is identical (1,645 kg both).
    const { asFlownDryMass_kg: _drop, ...concept } = maven;
    const c = compareWithRealMission(concept)!;
    const dry = c.rows.find((r) => r.metric === 'dryMass')!;
    const cev = evaluateDesign(concept);
    // relDiff = (roll-up − 809) / 809, with roll-up = 1.3 × subtotal
    expect(dry.relDiff).toBeCloseTo((1.3 * cev.details.massBreakdown.subtotal - 809) / 809, 9);
    expect(c.rows.find((r) => r.metric === 'propellant')!.relDiff).toBe(0);
    expect(c.biggestGap).toBe('dryMass');
  });

  it('compares mass, power and Δv only (no cost: different accounting basis)', () => {
    const c = compareWithRealMission(maven, ev)!;
    expect(c.rows.map((r) => r.metric)).toEqual(['wetMass', 'dryMass', 'propellant', 'powerAtArrival', 'deltaVCapability']);
  });

  it('half the propellant → propellant row −50% and it is the biggest gap', () => {
    const c = compareWithRealMission({ ...maven, propellant_kg: 822.5 })!;
    const prop = c.rows.find((r) => r.metric === 'propellant')!;
    expect(prop.relDiff).toBeCloseTo(-0.5, 9);
    expect(c.biggestGap).toBe('propellant');
  });

  it('only Mars and Bennu have a real mission to compare with', () => {
    expect(REAL_MISSION_FOR).toEqual({ mars: 'maven', bennu: 'osiris-rex' });
    expect(compareWithRealMission({ ...maven, destination: 'venus' })).toBeUndefined();
  });
});

describe('previewCrisis + simulateMission', () => {
  it('the previewed card is the one the flight meets, for the same seed', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const pc = previewCrisis(maven, seed)!;
      const choice = pc.options[pc.options.length - 1]!.id;
      const r = simulateMission(maven, { seed, crisisPolicy: () => choice });
      expect(r.crisis!.cardId).toBe(pc.card.id);
      expect(r.crisis!.day).toBe(pc.day);
      expect(r.crisis!.optionId).toBe(choice);
    }
  });

  it('a blocked design has no crisis to preview', () => {
    const blocked = { ...presetDesign('osiris-rex'), trajectoryOption: 'direct' as const };
    expect(previewCrisis(blocked, 1)).toBeUndefined();
  });

  it('propellant spent on a cruise crisis = rocket equation at the wet mass', () => {
    // Find a seed whose crisis is in cruise and whose chosen option costs Δv.
    for (let seed = 1; seed <= 200; seed++) {
      const pc = previewCrisis(maven, seed)!;
      const opt = pc.options.find((o) => (o.cost.deltaV_ms?.value ?? 0) > 0);
      if (pc.phase !== 'cruise' || !opt) continue;
      const r = simulateMission(maven, { seed, crisisPolicy: () => opt.id });
      if (!r.crisis!.reached) continue;
      const dv = opt.cost.deltaV_ms!.value;
      // m = m₀ (1 − e^(−Δv / (Isp g₀))); e.g. 15 m/s: 2454 × (1 − e^(−15 / (225 × 9.80665))) = 16.63 kg
      const expected = 2454 * (1 - Math.exp(-dv / (225 * 9.80665)));
      expect(r.crisis!.deltaVSpent_ms).toBe(dv);
      expect(r.crisis!.propellantSpent_kg).toBeCloseTo(expected, 6);
      return;
    }
    throw new Error('no cruise crisis with a Δv option in 200 seeds');
  });

  it('endDay: last planned day when complete; Earth distance is from the ephemeris', () => {
    const r = simulateMission(maven, { rng: () => 0.999999 });
    // MAVEN: Nov 18 2013 → Sep 21 2014 = 307 days, + 365 science days = day 672
    expect(r.completed).toBe(true);
    expect(r.endDay).toBe(307 + 365);
    // Mars–Earth distance always lies within 54.6–401.4 million km (Mars Fact Sheet)
    expect(r.earthDistanceAtEnd_m).toBeGreaterThan(54.6e9);
    expect(r.earthDistanceAtEnd_m).toBeLessThan(401.4e9);
    // goal = 1,500 Mbit/day × 365 days = 547.5 Gbit
    expect(r.goal_Gbit).toBeCloseTo(547.5, 9);
    expect(r.plannedScienceDays).toBe(365);
  });

  it('a launch failure ends on day 0 and the hint is about mission success', () => {
    const r = simulateMission(maven, { rng: () => 0 });
    expect(r.endDay).toBe(0);
    expect(r.hintCategory).toBe('success');
  });
});

describe('score grades and the next-star category', () => {
  it('the score runs 0–100: weights 0.30 + 0.20 + 0.15 + 3 × 0.10 + 0.05 = 1', () => {
    expect(MAX_SCORE).toBeCloseTo(100, 9);
  });

  it('STRONG ≥ 70, FAIR 40–69, WEAK < 40 (game rule)', () => {
    expect(SCORE_GRADES.strongFrom.isGameEstimate).toBe(true);
    expect(scoreGrade(100)).toBe('strong');
    expect(scoreGrade(70)).toBe('strong');
    expect(scoreGrade(69.9)).toBe('fair');
    expect(scoreGrade(40)).toBe('fair');
    expect(scoreGrade(39.9)).toBe('weak');
    expect(scoreGrade(0)).toBe('weak');
  });

  it('nextStar names the category; nextStarHint is the same text', () => {
    const c = {
      stars: 2,
      radioLimited: false,
      scienceScore: 90,
      margins: { deltaV: 0.39, power: 0.2, mass: 0.2 },
      deltaV: { required_ms: 1760, capability_ms: 2448, isp_s: 225, dry_kg: 809, propellant_kg: 1645, asFlown: true },
      launch: { capacity_kg: 3163, wet_kg: 2454 },
      power: { available_W: 1590, required_W: 1300, type: 'solar' as const, arrayArea_m2: 12 },
    };
    expect(nextStar(c).category).toBe('deltaV');
    expect(nextStar(c).hint).toBe(nextStarHint(c));
    expect(nextStar({ ...c, stars: 3 }).category).toBeUndefined();
    expect(nextStar({ ...c, stars: 1 }).category).toBe('science');
    expect(nextStar({ ...c, margins: { deltaV: 0.2, power: 0.05, mass: 0.2 } }).category).toBe('power');
  });
});

describe('bestLaunchWindow', () => {
  it('finds the 2013 Mars window that MAVEN launched in', () => {
    // Searching from June 2013 must land inside MAVEN's published 20-day launch period,
    // Nov 18 – Dec 7, 2013 (NASA: The 2013 MAVEN Mission To Mars), and must be no more expensive (C3)
    // than MAVEN's real dates.
    const w = bestLaunchWindow('mars', '2013-06-01');
    expect(w.launchDate >= '2013-11-18' && w.launchDate <= '2013-12-07').toBe(true);
    expect(w.c3_km2s2).toBeLessThanOrEqual(lambertTransfer('mars', '2013-11-18', '2014-09-21').c3_km2s2);
    expect(w.flightDays).toBeLessThan(518); // inside the < 2 t_Hohmann cap
  });

  it('never returns a launch date before fromDate', () => {
    const w = bestLaunchWindow('venus', '2026-10-03');
    expect(w.launchDate >= '2026-10-03').toBe(true);
    expect(w.arrivalDate > w.launchDate).toBe(true);
  });

  it('Jupiter direct needs C3 far above what the Atlas V curve covers (the "very hard" lesson)', () => {
    // Hohmann alone needs C3 ≈ 77 km²/s² (spec: Special cases)
    expect(bestLaunchWindow('jupiter', '2026-10-03').c3_km2s2).toBeGreaterThan(70);
  });
});

describe('limits that are game estimates are labelled at the meter', () => {
  it('risk limit is the 20% acceptable mission risk, a game estimate', () => {
    expect(ev.meters.risk.limitSource?.value).toBe(0.2);
    expect(ev.meters.risk.limitSource?.isGameEstimate).toBe(true);
  });
  it('cost limit is the NASA Discovery cap ($500M FY2019), not an estimate', () => {
    expect(ev.meters.cost.limitSource?.value).toBe(500);
    expect(ev.meters.cost.limitSource?.isGameEstimate).toBe(false);
  });
  it('data limit rests on the placeholder comms reference link', () => {
    expect(ev.meters.data.calibrated).toBe(false);
    expect(ev.meters.data.limitSource?.isGameEstimate).toBe(true);
  });
});

describe('science return depends on the (uncalibrated) downlink', () => {
  it('each day sends min(produced, capacity): a radio far too small caps the science', () => {
    // A 0.1 m dish has (0.1 / 2)² = 1/400 of the 2 m dish gain, so capacity falls ~400× and the radio,
    // not the instruments, limits the science.
    const tiny = { ...maven, comms: { ...maven.comms, dishDiameter_m: 0.1 } };
    const r = simulateMission(tiny, { rng: () => 0.999999 });
    expect(r.completed).toBe(true);
    expect(r.radioLimited).toBe(true);
    expect(r.downlinked_Gbit).toBeLessThan(r.goal_Gbit);
    expect(r.downlinkCalibrated).toBe(false);
    expect(r.downlinkAnchor.isGameEstimate).toBe(true);
  });
});

describe('Monte Carlo is reproducible', () => {
  it('same design, default seed → identical result, and the seed is reported', () => {
    const a = monteCarloMission(maven, { runs: 200 });
    const b = monteCarloMission(maven, { runs: 200 });
    expect(a).toEqual(b);
    expect(a.seed).toBe(MONTE_CARLO_SEED);
  });
});
