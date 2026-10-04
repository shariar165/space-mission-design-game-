// Validation set (spec: "Validation set"). Each real mission is loaded as a player design and run through
// the full engine. If a test fails, fix the model or the data — never the expected value.
// Row kinds: "validation" = engine output vs an independent published value;
// "calibration" = the model constant was fitted to this published value, so agreement is by construction;
// "info" = reported for the Debrief, not a pass/fail check.
import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { AU_M, MU_SUN_SI, km, mu, toDays } from '../src/engine/constants';
import { DESTINATIONS, LAUNCH_VEHICLES, PARTS } from '../src/engine/data';
import { evaluateDesign, monteCarloMission } from '../src/engine/index';
import { missionPreset, presetDesign } from '../src/engine/missions';
import { dataRate, REFERENCE_LINK } from '../src/engine/comms';
import { propellantBurned } from '../src/engine/propulsion';
import { bestArrival, bestLaunchWindow, hohmann, lambertTransfer, orbitPeriod } from '../src/engine/trajectory';
import { julianDate } from '../src/engine/ephemeris';
import { OPERATIONS } from '../src/engine/data';
import { runOperations } from '../src/engine/ops/index';
import { bodyConjunctions, perihelionJd, solarLongitude } from '../src/engine/ops/predictable';
import { prepareOps } from '../src/engine/ops/timeline';
import { opsRiskEstimate } from '../src/engine/ops/riskEstimate';
import { riskMeter } from '../src/engine/risk';
import { buildCadetDesign, defaultChoices, stepOptionIds } from '../src/engine/cadet';
import { starterDesign } from '../src/ui/starters';

const TOLERANCE = 0.1;

type Kind = 'validation' | 'calibration' | 'info';
interface Row {
  kind: Kind;
  mission: string;
  check: string;
  engine: string;
  published: string;
  error: string;
  result: 'PASS' | 'FAIL' | '—';
  estimates: string;
}
const rows: Row[] = [];

const pct = (engine: number, published: number) => (engine - published) / published;
const fmtPct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

function within(kind: Kind, mission: string, check: string, engine: number, published: number, unit: string, estimates: string) {
  const err = pct(engine, published);
  rows.push({
    kind,
    mission,
    check,
    engine: `${engine.toFixed(1)} ${unit}`,
    published: `${published} ${unit}`,
    error: fmtPct(err),
    result: Math.abs(err) <= TOLERANCE ? 'PASS' : 'FAIL',
    estimates,
  });
  return err;
}

function atLeast(mission: string, check: string, engine: number, needed: number, unit: string, estimates: string) {
  const pass = engine >= needed;
  rows.push({
    kind: 'validation',
    mission,
    check,
    engine: `${engine.toFixed(0)} ${unit}`,
    published: `≥ ${needed} ${unit}`,
    error: `margin ${fmtPct((engine - needed) / engine)}`,
    result: pass ? 'PASS' : 'FAIL',
    estimates,
  });
  return pass;
}

function flag(mission: string, check: string, ok: boolean, engine: string, published: string, estimates = '') {
  rows.push({ kind: 'validation', mission, check, engine, published, error: '—', result: ok ? 'PASS' : 'FAIL', estimates });
  return ok;
}

function info(mission: string, check: string, engine: string, published = '—', estimates = '') {
  rows.push({ kind: 'info', mission, check, engine, published, error: '—', result: '—', estimates });
}

const PLACEHOLDER_LV = 'PLACEHOLDER curve — not real evidence until LSP data is loaded';

// ---------------------------------------------------------------------------
describe('MAVEN (Mars, 2013) — NASA Science', () => {
  const preset = missionPreset('maven');
  const design = presetDesign('maven');
  const ev = evaluateDesign(design);
  const pub = preset.published;
  const M = preset.label;

  it('power range at Mars: 1,700 W at perihelion and 1,150 W at aphelion, ±10% (calibration)', () => {
    const range = ev.details.solarPowerRange_W!;
    const est = 'η_sys = 0.20 was fitted to these MAVEN figures';
    const e1 = within('calibration', M, 'Solar power at Mars perihelion', range.atPerihelion, pub.solarPowerMax_W!.value, 'W', est);
    const e2 = within('calibration', M, 'Solar power at Mars aphelion', range.atAphelion, pub.solarPowerMin_W!.value, 'W', est);
    expect(Math.abs(e1)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(e2)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('Δv capability from the rocket equation ≈ 2.4–2.5 km/s, ±10%', () => {
    const isp = PARTS.engines[design.engineId]!.isp_s;
    const err = within(
      'validation',
      M,
      'Δv capability (rocket equation)',
      ev.details.deltaVCapability_ms,
      pub.deltaVCapability_ms!.value,
      'm/s',
      `Isp ${isp.value} s (textbook midpoint, game estimate)`,
    );
    expect(Math.abs(err)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('transfer time ≈ 10 months (307 days), ±10%: best Lambert arrival for the real launch date', () => {
    const best = bestArrival('mars', design.launchDate);
    const err = within('validation', M, 'Transfer time (best Lambert arrival from launch date)', best.flightDays, pub.transferDays!.value, 'days', 'μ☉ (approx.)');
    info(M, '  ↳ best arrival date / C3 / v∞ at that date', `${best.arrivalDate} / ${best.c3_km2s2.toFixed(2)} km²/s² / ${(best.vInfArr_ms / 1000).toFixed(2)} km/s`);
    expect(Math.abs(err)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('launch-window search lands inside the MAVEN published 20-day launch period (Nov 18 – Dec 7, 2013)', () => {
    // bestLaunchWindow minimises departure v∞ + arrival v∞ (spec: "Best launch window"). A real launch period is
    // the set of days the vehicle can deliver the needed C3 to a fixed arrival, so its opening day is not the
    // optimum; the check is that the optimum lies inside the published period.
    const lp = missionPreset('maven').launchPeriod!;
    const w = bestLaunchWindow('mars', '2013-06-01');
    const inside = w.launchDate >= lp.open.value && w.launchDate <= lp.close.value;
    flag(M, 'Launch-window search (min v∞,dep + v∞,arr) inside the published launch period', inside, `${w.launchDate} (C3 ${w.c3_km2s2.toFixed(2)} km²/s²)`, `${lp.open.value} – ${lp.close.value}`, 'μ☉ (approx.); JPL approximate ephemeris');
    const open = lambertTransfer('mars', lp.open.value, lp.plannedOrbitInsertion!.value);
    info(M, '  ↳ C3 on the opening day to the planned Sept 22, 2014 arrival', `${open.c3_km2s2.toFixed(2)} km²/s²`, '—', 'launch periods open where the vehicle first meets the C3, not at the optimum');
    expect(inside).toBe(true);
  });

  it('Hohmann minimum-energy transfer time (Cadet explanation, for information only)', () => {
    const h = hohmann(AU_M, km(DESTINATIONS.mars.sunDistance_1e6km.value * 1e6), MU_SUN_SI);
    const days = toDays(h.tFlight_s);
    info(M, 'Hohmann transfer time (not a check)', `${days.toFixed(1)} days`, `${pub.transferDays!.value} days`, `${fmtPct(pct(days, pub.transferDays!.value))}: real orbits are elliptical/inclined, hence Lambert`);
    expect(days).toBeGreaterThan(0);
  });

  it('Atlas V 401 capacity at the 2013 Mars C3 (Lambert, real dates) ≥ 2,454 kg', () => {
    info(M, 'Launch C3 from Lambert (Nov 18 2013 → Sep 21 2014)', `${ev.trajectory.c3.toFixed(2)} km²/s²`);
    info(M, 'Arrival v∞ from Lambert', `${ev.trajectory.vInfArr.toFixed(2)} km/s`);
    const lv = LAUNCH_VEHICLES[design.launchVehicleId]!;
    const ok = atLeast(M, 'Atlas V 401 payload at that C3', ev.details.launchCapacity_kg, pub.wetMass_kg!.value, 'kg', lv.payloadCurve.isGameEstimate ? PLACEHOLDER_LV : '');
    expect(ok).toBe(true);
  });

  it('science orbit 150 × 6,300 km gives the published 4.5-hour period (Kepler III), ±10%', () => {
    const mars = DESTINATIONS.mars;
    const R = km(mars.radius_km.value);
    const so = design.scienceOrbit!;
    const T_h = orbitPeriod(mu(mars.gm_km3s2.value), R + km(so.periapsis_km), R + km(so.apoapsis_km)) / 3600;
    const err = within('validation', M, 'Science-orbit period from published altitudes', T_h, pub.scienceOrbitPeriod_h!.value, 'h', '');
    expect(Math.abs(err)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('the orbit-insertion burn uses more than half of the propellant (NASAfacts)', () => {
    const b = ev.details.deltaVBudget;
    const used = propellantBurned(ev.details.wetMass_kg, b.arrival_ms, ev.details.isp_s);
    const fraction = used / design.propellant_kg;
    const ok = flag(
      M,
      'Capture burn propellant (Lambert v∞ + capture equation + rocket equation)',
      fraction > pub.moiPropellantFractionMin!.value,
      `${used.toFixed(0)} kg = ${(fraction * 100).toFixed(1)}% of ${design.propellant_kg} kg`,
      '> 50% of the fuel on board',
      'Isp 225 s (estimate)',
    );
    expect(ok).toBe(true);
  });

  it('Δv budget and margin with the science-orbit transfer; planned prime mission only (information)', () => {
    const b = ev.details.deltaVBudget;
    const co = design.captureOrbit;
    info(M, `Capture burn into 380 × ${co.apoapsis_km.toFixed(0)} km (35-h orbit, apoapsis by Kepler III)`, `${b.arrival_ms.toFixed(0)} m/s`);
    info(M, 'Capture → science orbit 150 × 6,300 km (vis-viva)', `${b.orbitTransfer_ms.toFixed(0)} m/s`);
    info(M, 'Trajectory corrections + maintenance (1-yr prime mission)', `${(b.trajectoryCorrections_ms + b.maintenance_ms).toFixed(0)} m/s`, '—', '50 m/s rule; 20 m/s/yr estimate');
    info(M, 'Lifetime reserve (planned prime mission = science phase)', `${b.lifetimeReserve_ms.toFixed(0)} m/s`, '—', 'no extended mission planned at launch');
    // Decision 8: planned 1-year prime mission (NASAfacts), not the as-flown 4,094 days.
    // lifetime 365 d = science 365 d → reserve = 20 m/s/yr × (365 − 365)/365.25 = 0 m/s
    // maintenance = 20 m/s/yr × 365/365.25 = 19.99 m/s; corrections = 50 m/s (game rules)
    expect(b.lifetimeReserve_ms).toBe(0);
    expect(b.maintenance_ms).toBeCloseTo(19.986, 3);
    expect(b.trajectoryCorrections_ms).toBe(50);
    info(M, 'Δv required (total)', `${b.total_ms.toFixed(0)} m/s`);
    info(M, 'Δv margin (capability vs required)', fmtPct(ev.meters.deltaV.margin), 'band 10–30%', 'deep-dip campaigns (NASAfacts: five dips to ~125 km) are not modelled');
    info(M, 'Light delay on arrival day', `${(ev.details.lightDelayAtArrival_s / 60).toFixed(1)} min`);
    expect(ev.blockers).toEqual([]);
  });

  it('1,000-run Monte Carlo of the MAVEN design (information)', () => {
    const mc = monteCarloMission(design, { runs: 1000, seed: 2013 });
    info(M, 'Monte Carlo success rate (1,000 runs, safe crisis choices)', `${(mc.successRate * 100).toFixed(1)}%`, '—', 'non-launch base rates are game values; LV record is an estimate');
    info(M, 'Monte Carlo mean score / stars 0–3', `${mc.meanScore.toFixed(1)} / [${mc.starsHistogram.join(', ')}]`, '—', 'science goal and part data are estimates');
    expect(mc.runs).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
describe('Comms reference link — MRO (DESCANSO Article 12)', () => {
  const C = 'Comms (MRO link)';
  it('scaled link vs the other MRO rates in the same article (information, not a check)', () => {
    const mro = { txPower_W: 100, dishDiameter_m: 3, groundDish_m: 34 as const, distance_m: 100e9 };
    // Anchor: ≥500 kbps at 400 million km. Inverse-square scaling to 100 million km: × (400/100)² = × 16 → 8 Mbps (34 m)
    const r34 = dataRate(mro);
    const r70 = dataRate({ ...mro, groundDish_m: 70 });
    info(C, 'Anchor (by construction)', `${(dataRate({ ...mro, distance_m: REFERENCE_LINK.distance_m.value }) / 1e3).toFixed(0)} kbps at 400 million km`, '≥ 500 kbps at 400 million km', 'station for the anchor inferred (34 m)');
    info(C, 'Model at 100 million km, 34 m / 70 m', `${(r34 / 1e6).toFixed(1)} / ${(r70 / 1e6).toFixed(1)} Mbps`, '3–4 Mbps "for several months"; "as high as 6 Mbps"', 'published close-range rates are capped by coding and decoder limits (e.g. turbo decoding ≤ 1.6 Mbps), which the game does not model');
    expect(r34 / 1e6).toBeCloseTo(8, 6);
  });
});

describe('OSIRIS-REx (Bennu, 2016) — arXiv 1702.06981', () => {
  const preset = missionPreset('osiris-rex');
  const design = presetDesign('osiris-rex');
  const ev = evaluateDesign(design);
  const pub = preset.published;
  const M = preset.label;

  it('the "NASA real route (Earth flyby)" option uses the published C3 = 29.29678 km²/s²', () => {
    const ok = flag(M, 'Route C3 used by the engine = published', ev.trajectory.c3 === pub.launchC3_km2s2!.value, `${ev.trajectory.c3} km²/s² (${ev.trajectory.method})`, `${pub.launchC3_km2s2!.value} km²/s²`);
    expect(ok).toBe(true);
  });

  it('Atlas V 411 capacity at that C3, from the engine, ≥ 2,105 kg', () => {
    const lv = LAUNCH_VEHICLES[design.launchVehicleId]!;
    const ok = atLeast(M, 'Atlas V 411 payload at C3 29.3 (evaluateDesign)', ev.details.launchCapacity_kg, pub.wetMass_kg!.value, 'kg', lv.payloadCurve.isGameEstimate ? PLACEHOLDER_LV : '');
    expect(ok).toBe(true);
  });

  it('the game flags that the real mission used an Earth flyby, and labels the route', () => {
    const flyby = ev.notes.some((n) => /flyby/i.test(n) && /not modelled/i.test(n));
    const route = ev.notes.some((n) => n.startsWith('NASA real route (Earth flyby)'));
    const ok = flag(M, 'Evaluation says flybys are not modelled and labels the NASA route', flyby && route, flyby && route ? 'flagged + labelled' : 'missing', 'Earth flyby, Sept 2017');
    expect(ok).toBe(true);
  });

  it('a direct transfer with the real 816-day dates is blocked (< 1 revolution cap)', () => {
    const direct = evaluateDesign({ ...design, trajectoryOption: 'direct' });
    const blocked = direct.blockers.some((b) => /full loop/.test(b));
    const ok = flag(M, 'Direct transfer on the real dates is blocked', blocked, blocked ? 'blocked' : 'not blocked', `cap ${Math.floor(direct.trajectory.maxFlightDays!)} days`);
    expect(ok).toBe(true);
  });

  it('route numbers for information', () => {
    const b = ev.details.deltaVBudget;
    info(M, 'Post-flyby leg arrival v∞ (Lambert, flyby → approach start)', `${ev.trajectory.vInfArr.toFixed(2)} km/s`, '—', 'flyby day Sept 22, 2017 is to verify');
    info(M, 'Deep-space manoeuvre charged to the spacecraft', `${b.other_ms.toFixed(0)} m/s`, '—', 'DSM size is a game estimate (not in the paper)');
    info(M, 'Δv required / capability', `${b.total_ms.toFixed(0)} / ${ev.details.deltaVCapability_ms.toFixed(0)} m/s`, '—', 'dry 870 kg midpoint and Isp are estimates');
    info(M, 'Published solar power range (not checked: array area unknown)', '—', `${pub.solarPowerMin_W!.value}–${pub.solarPowerMax_W!.value} W`, 'candidate independent check of η_sys once array area is sourced');
    const best = bestArrival('bennu', design.launchDate);
    info(M, 'Best direct arrival from the real launch date (for comparison)', `${best.arrivalDate} (${best.flightDays} d) / C3 ${best.c3_km2s2.toFixed(2)} km²/s²`, `${pub.launchC3_km2s2!.value} km²/s² (with flyby)`);
    info(M, 'Blockers on the NASA route', ev.blockers.join(' · ') || 'none');
    expect(best.flightDays).toBeLessThan(ev.trajectory.flightDays);
  });
});

// ---------------------------------------------------------------------------
describe('Mission operations — Mars conjunctions, Ls, loss rate', () => {
  const M = 'Mars (ops)';
  // Published command moratoria (JPL news). The engine's least Sun–Earth–Mars angle must fall within ±2 days of
  // each window's middle; the 2015 window ("within two degrees") must also match in length.
  const MORATORIA = [
    { year: 2015, open: '2015-06-07', close: '2015-06-21' },
    { year: 2017, open: '2017-07-22', close: '2017-08-01' },
    { year: 2019, open: '2019-08-28', close: '2019-09-07' },
  ];

  it('conjunction centres match the published moratoria (±2 days)', () => {
    for (const m of MORATORIA) {
      const open = julianDate(m.open);
      const close = julianDate(m.close);
      const [w] = bodyConjunctions('mars', open - 30, close + 30);
      const mid = (open + close) / 2;
      const off = w!.minJd - mid;
      const ok = flag(M, `${m.year} conjunction: least Sun–Earth–Mars angle vs moratorium middle (±2 d)`, Math.abs(off) <= 2,
        `${off >= 0 ? '+' : ''}${off.toFixed(1)} d (least angle ${w!.minAngle_deg.toFixed(2)}°)`, `${m.open} – ${m.close}`, '2° threshold (JPL 2015)');
      expect(ok).toBe(true);
    }
  });

  it('the 2015 window at 2° matches the published length (±2 days)', () => {
    const [w] = bodyConjunctions('mars', julianDate('2015-05-01'), julianDate('2015-07-31'));
    const len = w!.endJd - w!.startJd;
    const published = julianDate('2015-06-21') - julianDate('2015-06-07');
    const ok = flag(M, '2015 window length at 2°', Math.abs(len - published) <= 2, `${len.toFixed(1)} d`, `${published} d (June 7–21)`);
    expect(ok).toBe(true);
  });

  it('Mars perihelion Ls from the IAU pole and the ephemeris vs Mars24 (±2°)', () => {
    const jd = perihelionJd('mars', julianDate('2022-06-21'));
    const yr = 2000 + (jd - 2451545) / 365.25;
    const published = OPERATIONS.marsDust.perihelionLs_deg.value + OPERATIONS.marsDust.perihelionLsRate_degPerYear.value * (yr - 2000);
    const ls = solarLongitude('mars', jd);
    const ok = flag(M, 'Ls at perihelion (2022)', Math.abs(ls - published) <= 2, `${ls.toFixed(2)}°`, `${published.toFixed(2)}° (Mars24)`, 'Mars pole: NASA fact sheet');
    expect(ok).toBe(true);
  });

  it('info: the Risk meter (Ops Monte Carlo) vs the single-card flight’s phase formula', () => {
    const maven = presetDesign('maven');
    const e = opsRiskEstimate(maven);
    const formula = riskMeter(evaluateDesign(maven).details.phaseRisks).used;
    info('MAVEN (ops)', `Risk meter: prime-mission loss rate over ${e.tally.runs} seeded Ops runs (safest responses, seed ${e.seed}) vs the single-card flight's phase formula`,
      `${(100 * e.meter.used).toFixed(1)}% ± ${(100 * e.stdErr).toFixed(1)}`, `${(100 * formula).toFixed(1)}% (phase formula)`, 'hazard rates and response failure chances');
    expect(e.tally.lost).toBeLessThan(e.tally.runs);
  }, 120_000);
});

describe('Moon rideshare (LRO 2009, the LCROSS secondary slot)', () => {
  it('info: Moon Cadet crafts in the 1000 kg secondary slot vs a whole Atlas V 401', () => {
    const base = starterDesign('moon', '2026-10-04');
    const margins = (rocket: string) =>
      stepOptionIds('moon', 'science').flatMap((science) =>
        ['lean', 'balanced', 'roomy'].map((fuel) => evaluateDesign(buildCadetDesign(base, { ...defaultChoices(base), science, fuel, rocket })).meters.mass.margin),
      );
    const fmt = (m: number[]) => `${(100 * Math.min(...m)).toFixed(0)}–${(100 * Math.max(...m)).toFixed(0)}%`;
    const inBand = (m: number[]) => m.filter((x) => x >= 0.1 && x <= 0.3).length;
    const ride = margins('lro-lcross-2009');
    const whole = margins('atlas-v-401');
    info('Moon (Cadet)', `Mass margin of the 9 science × fuel cards: shared ride (1000 kg slot, NTRS 20100028203) vs whole Atlas V 401`,
      `${fmt(ride)} (${inBand(ride)} of 9 in the 10–30% band)`, `${fmt(whole)} (${inBand(whole)} of 9 in band)`, 'Atlas V curve (placeholder), part masses');
    expect(inBand(ride)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
afterAll(() => {
  const header = ['Kind', 'Mission', 'Check', 'Engine', 'Published / needed', 'Error', 'Result', 'Game estimates in the inputs'];
  const md = [
    '# Validation results',
    '',
    `Generated by \`tests/validation.test.ts\` on ${new Date().toISOString().slice(0, 10)}. Tolerance ±${TOLERANCE * 100}%.`,
    '',
    '- **validation**: engine output compared with an independent published value.',
    '- **calibration**: a model constant was fitted to this published value, so agreement is by construction, not evidence.',
    '- **info**: reported for the Debrief and Sources page; not a pass/fail check.',
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${[r.kind, r.mission, r.check, r.engine, r.published, r.error, r.result, r.estimates].join(' | ')} |`),
    '',
  ].join('\n');
  writeFileSync(new URL('../docs/VALIDATION_RESULTS.md', import.meta.url), md, 'utf8');
});
