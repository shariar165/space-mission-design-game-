// Engine functions the UI calls, so the UI only formats numbers and never computes them.
// Hand calculations are in the comments, as in physics.test.ts.
import { describe, expect, it } from 'vitest';
import { compareWithRealMission, designDelta, METER_KEYS, REAL_MISSION_FOR } from '../src/engine/compare';
import { evaluateDesign, MONTE_CARLO_SEED, monteCarloMission, previewCrisis, simulateMission } from '../src/engine/index';
import { presetDesign } from '../src/engine/missions';
import { MAX_SCORE, nextStar, nextStarHint, SCORE_GRADES, scoreGrade } from '../src/engine/scoring';
import { bestLaunchWindow, lambertTransfer } from '../src/engine/trajectory';
import type { Design } from '../src/engine/types';
import * as cadet from '../src/engine/cadet';
import { COST_CAPS } from '../src/engine/massCost';
import { LAUNCH_VEHICLES as LVS } from '../src/engine/data';
import { starterDesign } from '../src/ui/starters';

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
  it('data limit rests on the published MRO link, whose station pairing is inferred (labelled)', () => {
    expect(ev.meters.data.calibrated).toBe(true);
    expect(ev.meters.data.limitSource?.value).toBe(34);
    expect(ev.meters.data.limitSource?.isGameEstimate).toBe(true);
  });
});

describe('science return depends on the downlink', () => {
  it('each day sends min(produced, capacity): a radio far too small caps the science', () => {
    // A 0.1 m dish has (0.1 / 2)² = 1/400 of the 2 m dish gain, so capacity falls ~400× and the radio,
    // not the instruments, limits the science.
    const tiny = { ...maven, comms: { ...maven.comms, dishDiameter_m: 0.1 } };
    const r = simulateMission(tiny, { rng: () => 0.999999 });
    expect(r.completed).toBe(true);
    expect(r.radioLimited).toBe(true);
    expect(r.downlinked_Gbit).toBeLessThan(r.goal_Gbit);
    expect(r.downlinkCalibrated).toBe(true);
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

// ---------------------------------------------------------------------------
// Cadet mode: guided build choices, metaphor gauges and the Test Flight (cadet.ts).

const FROM = '2026-10-04';
const cadetBase = (d: Design['destination']) => starterDesign(d, FROM);

describe('Cadet sizing: sizeKnob', () => {
  const mars = cadetBase('mars');
  it('worst power margin = the lower of arrival day and end of science (panels age, the Sun moves away)', () => {
    const e = evaluateDesign(mars);
    const end = e.details.power.atEndOfScience;
    expect(cadet.worstPowerMargin(e)).toBe(Math.min(e.meters.power.margin, (end.available_W - end.required_W) / end.required_W));
  });
  it('the smallest array that reaches a 25% power margin (one input step smaller misses it)', () => {
    const d = cadet.sizeKnob(mars, 'arrayArea', 0.25);
    const area = d.power.arrayArea_m2!;
    expect(cadet.worstPowerMargin(evaluateDesign(d))).toBeGreaterThanOrEqual(0.25);
    const smaller = { ...d, power: { ...d.power, arrayArea_m2: area - cadet.KNOB_STEP.arrayArea } };
    expect(cadet.worstPowerMargin(evaluateDesign(smaller))).toBeLessThan(0.25);
  });
  it('the least propellant that reaches a 10% Δv margin', () => {
    const d = cadet.sizeKnob(mars, 'propellant', 0.1);
    expect(evaluateDesign(d).meters.deltaV.margin).toBeGreaterThanOrEqual(0.1);
    const less = { ...d, propellant_kg: d.propellant_kg - cadet.KNOB_STEP.propellant };
    expect(evaluateDesign(less).meters.deltaV.margin).toBeLessThan(0.1);
  });
  it('RTGs come in whole units: the fewest that reach the margin', () => {
    const d = cadet.sizeKnob({ ...mars, power: { type: 'rtg', rtgCount: 1 } }, 'rtgCount', 0.25);
    expect(Number.isInteger(d.power.rtgCount)).toBe(true);
    expect(cadet.worstPowerMargin(evaluateDesign(d))).toBeGreaterThanOrEqual(0.25);
    expect(cadet.worstPowerMargin(evaluateDesign({ ...d, power: { type: 'rtg', rtgCount: d.power.rtgCount! - 1 } }))).toBeLessThan(0.25);
  });
});

describe('Cadet guided build: options per step', () => {
  const base = cadetBase('mars');
  const choices = cadet.defaultChoices(base);

  it('five steps, in the order the player sees them', () => {
    expect(cadet.CADET_STEPS).toEqual(['science', 'power', 'radio', 'fuel', 'rocket']);
  });

  it('every step offers 2–3 cards and exactly one is chosen', () => {
    for (const step of cadet.CADET_STEPS) {
      const opts = cadet.cadetOptions(base, choices, step);
      expect(opts.length).toBeGreaterThanOrEqual(2);
      expect(opts.length).toBeLessThanOrEqual(3);
      expect(opts.filter((o) => o.chosen)).toHaveLength(1);
    }
  });

  it('power cards: lean solar ≈ 10% margin, balanced solar ≈ 25%, RTG reaches 25%', () => {
    const opts = cadet.cadetOptions(base, choices, 'power');
    const m = (id: string) => cadet.worstPowerMargin(evaluateDesign(opts.find((o) => o.id === id)!.design));
    expect(m('solar-lean')).toBeGreaterThanOrEqual(cadet.CADET_TIERS.lean.value);
    expect(m('solar-lean')).toBeLessThan(cadet.CADET_TIERS.balanced.value);
    expect(m('solar-balanced')).toBeGreaterThanOrEqual(cadet.CADET_TIERS.balanced.value);
    expect(m('rtg')).toBeGreaterThanOrEqual(cadet.CADET_TIERS.balanced.value);
  });

  it('fuel cards set the Δv margin to the lean / balanced / roomy tiers', () => {
    const opts = cadet.cadetOptions(base, choices, 'fuel');
    for (const tier of ['lean', 'balanced', 'roomy'] as const) {
      const margin = evaluateDesign(opts.find((o) => o.id === tier)!.design).meters.deltaV.margin;
      expect(margin).toBeGreaterThanOrEqual(cadet.CADET_TIERS[tier].value);
      expect(margin).toBeLessThan(cadet.CADET_TIERS[tier].value + 0.02); // within a few kg of propellant
    }
  });

  it('radio cards are the 1 m, 2 m (MAVEN) and 3 m (MRO) dishes; a bigger dish sends more photos', () => {
    const opts = cadet.cadetOptions(base, choices, 'radio');
    expect(opts.map((o) => o.design.comms.dishDiameter_m)).toEqual([1, 2, 3]);
    const sent = opts.map((o) => o.chips.photosSent);
    expect(sent[0]!).toBeLessThanOrEqual(sent[1]!);
    expect(sent[1]!).toBeLessThanOrEqual(sent[2]!);
  });

  it('rocket cards are every launch vehicle in the catalogue', () => {
    expect(cadet.cadetOptions(base, choices, 'rocket').map((o) => o.id)).toEqual(Object.keys(LVS));
  });

  it('changing power re-sizes the fuel for the new mass, so the Δv tier still holds', () => {
    const rtg = cadet.buildCadetDesign(base, { ...choices, power: 'rtg' });
    const solar = cadet.buildCadetDesign(base, choices);
    expect(rtg.propellant_kg).not.toBe(solar.propellant_kg);
    expect(evaluateDesign(rtg).meters.deltaV.margin).toBeGreaterThanOrEqual(cadet.CADET_TIERS.balanced.value);
  });

  it('the default cadet build flies to the Moon, Venus, Mars and Bennu; Jupiter cannot leave Earth', () => {
    for (const d of ['moon', 'venus', 'mars', 'bennu'] as const) {
      const b = cadetBase(d);
      expect(evaluateDesign(cadet.buildCadetDesign(b, cadet.defaultChoices(b))).blockers, d).toEqual([]);
    }
    const j = cadetBase('jupiter');
    const ev = evaluateDesign(cadet.buildCadetDesign(j, cadet.defaultChoices(j)));
    expect(ev.meters.mass.status).toBe('over');
    expect(ev.blockers.some((b) => /cannot reach C3/.test(b))).toBe(true);
  });
});

describe('Cadet chips (absolute: what the part on this card weighs, makes and costs)', () => {
  const base = cadetBase('mars');
  const choices = cadet.defaultChoices(base);
  const coin = cadet.COIN_FRACTION.value * COST_CAPS.discovery.value; // 0.05 × $500M = $25M per coin

  it('power card: generation + battery mass, power made, coins = ceil(cost / $25M)', () => {
    const o = cadet.cadetOptions(base, choices, 'power').find((x) => x.id === 'solar-balanced')!;
    const e = evaluateDesign(o.design);
    expect(o.chips.mass_kg).toBeCloseTo(e.details.massBreakdown.powerGeneration + e.details.massBreakdown.battery, 9);
    expect(o.chips.powerMade_W).toBeCloseTo(e.details.power.available_W, 9);
    expect(o.chips.cost_M).toBeCloseTo(e.details.costBreakdown.power, 9);
    expect(o.chips.coins).toBe(Math.ceil(e.details.costBreakdown.power / coin));
  });

  it('coins: $0 → 0, $1M → 1, $25M → 1, $26M → 2 (Discovery cap)', () => {
    expect(cadet.coins(0, COST_CAPS.discovery.value)).toBe(0);
    expect(cadet.coins(1, COST_CAPS.discovery.value)).toBe(1);
    expect(cadet.coins(25, COST_CAPS.discovery.value)).toBe(1);
    expect(cadet.coins(26, COST_CAPS.discovery.value)).toBe(2);
  });

  it('science card: instrument mass, power used and photos taken per day', () => {
    const o = cadet.cadetOptions(base, choices, 'science').find((x) => x.id === 'snapshot')!;
    // camera only: 15 kg, 20 W, 2,000 Mbit/day ÷ 8.388608 Mbit per photo = 238.4 photos/day
    expect(o.chips.mass_kg).toBe(15);
    expect(o.chips.powerUsed_W).toBe(20);
    expect(o.chips.photosTaken).toBeCloseTo(2000 / 8.388608, 6);
  });

  it('fuel card: propellant + tanks mass, and spare propellant beyond what the trip needs', () => {
    const o = cadet.cadetOptions(base, choices, 'fuel').find((x) => x.id === 'roomy')!;
    const e = evaluateDesign(o.design);
    expect(o.chips.mass_kg).toBeCloseTo(e.details.propellant_kg + e.details.massBreakdown.tanks, 9);
    // spare = m_prop − m_dry(e^(Δv_req/(Isp g₀)) − 1)
    const need = e.details.dryMass_kg * (Math.exp(e.details.deltaVRequired_ms / (e.details.isp_s * 9.80665)) - 1);
    expect(o.chips.spareFuel_kg).toBeCloseTo(e.details.propellant_kg - need, 6);
    expect(o.chips.spareFuel_kg).toBeGreaterThan(0);
  });

  it('rocket card: how much it lifts on this trip, and its flight record', () => {
    const o = cadet.cadetOptions(base, choices, 'rocket').find((x) => x.id === 'atlas-v-401')!;
    expect(o.chips.lift_kg).toBeCloseTo(evaluateDesign(o.design).details.launchCapacity_kg, 9);
    expect(o.chips.flights).toBe(LVS['atlas-v-401']!.flights.value);
    expect(o.chips.successes).toBe(LVS['atlas-v-401']!.successes.value);
  });

  it('a card that would turn a gauge red says which one', () => {
    for (const o of cadet.cadetOptions(base, choices, 'rocket')) {
      const e = evaluateDesign(o.design);
      expect(o.redGauges.includes('weight')).toBe(e.meters.mass.status === 'over');
    }
  });
});

describe('Cadet gauges (metaphors over the meters)', () => {
  it('each gauge carries its meter status and demand ÷ supply', () => {
    const e = evaluateDesign(maven);
    const g = cadet.cadetGauges(e);
    const pairs = { weight: 'mass', power: 'power', fuel: 'deltaV', photos: 'data', budget: 'cost' } as const;
    for (const [gk, mk] of Object.entries(pairs)) {
      const gauge = g[gk as keyof typeof pairs];
      expect(gauge.status).toBe(e.meters[mk].status);
      expect(gauge.meter).toBe(mk);
      expect(gauge.ratio).toBeCloseTo(e.meters[mk].used / e.meters[mk].limit, 12);
    }
  });
  it('photos: taken = produced ÷ frame, sent = min(produced, downlinked) ÷ frame', () => {
    const e = evaluateDesign(maven);
    const g = cadet.cadetGauges(e);
    const frame = cadet.PHOTO_FRAME_Mbit.value * 1e6;
    expect(g.photos.taken).toBeCloseTo(e.details.data.producedPerDay_bits / frame, 9);
    expect(g.photos.sent).toBeCloseTo(Math.min(e.details.data.producedPerDay_bits, e.details.data.downlinkedPerDayAtArrival_bits) / frame, 9);
  });
});

describe('Test Flight (where the mission would fail, before launch)', () => {
  const base = cadetBase('mars');
  const good = cadet.buildCadetDesign(base, cadet.defaultChoices(base));

  it('a balanced design passes every checkpoint; checkpoints follow the mission timeline', () => {
    const t = cadet.testFlight(good);
    expect(t.checkpoints.map((c) => c.phase)).toEqual(['launch', 'cruise', 'arrival', 'science']);
    expect(t.firstFail).toBeUndefined();
    expect(t.checkpoints.every((c) => c.status === 'pass')).toBe(true);
    expect(t.checkpoints[2]!.startDay).toBe(Math.round(evaluateDesign(good).trajectory.flightDays));
  });
  it('too heavy for the rocket → fails at launch', () => {
    const t = cadet.testFlight({ ...good, propellant_kg: 20000 });
    expect(t.firstFail).toBe('launch');
    expect(t.checkpoints[0]!.reasons).toContain('too-heavy');
  });
  it('too little power → fails in cruise', () => {
    const t = cadet.testFlight({ ...good, power: { type: 'solar', arrayArea_m2: 1 } });
    expect(t.firstFail).toBe('cruise');
    expect(t.checkpoints[1]!.reasons).toContain('no-power');
  });
  it('too little fuel → fails at arrival', () => {
    const t = cadet.testFlight({ ...good, propellant_kg: 100 });
    expect(t.firstFail).toBe('arrival');
    expect(t.checkpoints[2]!.reasons).toContain('no-fuel');
  });
  it('an ion engine cannot brake into orbit → fails at arrival', () => {
    const t = cadet.testFlight({ ...good, engineId: 'ion-xenon' });
    expect(t.checkpoints[2]!.reasons).toContain('engine-cannot-capture');
  });
  it('a thin Δv margin is shaky at arrival (risk factor > 1)', () => {
    const t = cadet.testFlight(cadet.sizeKnob(good, 'propellant', 0.03));
    expect(t.checkpoints[2]!.status).toBe('shaky');
    expect(t.checkpoints[2]!.reasons).toContain('low-fuel');
  });
  it('a sample-return mission has a return checkpoint; loss chances come from the seeded Monte Carlo', () => {
    const b = cadetBase('bennu');
    const d = cadet.buildCadetDesign(b, cadet.defaultChoices(b));
    const t = cadet.testFlight(d, { runs: 200 });
    expect(t.checkpoints.map((c) => c.phase)).toContain('return');
    const mc = monteCarloMission(d, { runs: 200, seed: MONTE_CARLO_SEED });
    for (const c of t.checkpoints) expect(c.lossChance).toBeCloseTo((mc.failuresByPhase[c.phase] ?? 0) / 200, 12);
    expect(t.successRate).toBe(mc.successRate);
  });
});