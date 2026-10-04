// Each equation checked against a hand calculation (spec: tests/physics.test.ts).
// Hand calculations are written out in the comments so they can be checked on paper.
import { describe, expect, it } from 'vitest';
import * as C from '../src/engine/constants';
import { DESTINATIONS, LAUNCH_VEHICLES } from '../src/engine/data';
import * as E from '../src/engine/ephemeris';
import * as T from '../src/engine/trajectory';
import * as P from '../src/engine/propulsion';
import * as L from '../src/engine/launch';
import * as PW from '../src/engine/power';
import * as CM from '../src/engine/comms';
import * as MC from '../src/engine/massCost';
import * as R from '../src/engine/risk';
import * as CR from '../src/engine/crisis';
import * as SC from '../src/engine/scoring';
import { evaluateDesign, monteCarloMission, simulateMission } from '../src/engine/index';
import { presetDesign } from '../src/engine/missions';
import type { Design, Sourced } from '../src/engine/types';

const isSourced = (x: unknown): x is Sourced<unknown> =>
  typeof x === 'object' &&
  x !== null &&
  'value' in x &&
  typeof (x as Sourced<unknown>).unit === 'string' &&
  typeof (x as Sourced<unknown>).source === 'string' &&
  (x as Sourced<unknown>).source.length > 0 &&
  typeof (x as Sourced<unknown>).isGameEstimate === 'boolean';

describe('constants', () => {
  it('every exported constant is Sourced with a non-empty source', () => {
    for (const [name, v] of Object.entries(C.CONSTANTS)) {
      expect(isSourced(v), name).toBe(true);
    }
  });

  it('exact SI / IAU definitions are not game estimates', () => {
    expect(C.G0.value).toBe(9.80665);
    expect(C.AU.value).toBe(149_597_870.7);
    expect(C.SPEED_OF_LIGHT.value).toBe(299_792.458);
    for (const k of [C.G0, C.AU, C.SPEED_OF_LIGHT, C.S0, C.MU_EARTH, C.R_EARTH]) {
      expect(k.isGameEstimate).toBe(false);
    }
  });

  it('values the spec marks "approx."/"confirm" are flagged as game estimates', () => {
    expect(C.MU_SUN.isGameEstimate).toBe(true);
    expect(C.GAME_RULES.massGrowthMargin.isGameEstimate).toBe(true);
    expect(C.GAME_RULES.tankFraction.isGameEstimate).toBe(true);
    expect(C.GAME_RULES.trajectoryCorrection_ms.isGameEstimate).toBe(true);
  });

  it('SI conversions', () => {
    expect(C.AU_M).toBeCloseTo(1.495978707e11, 0);
    expect(C.C_MS).toBe(299_792_458);
    expect(C.MU_SUN_SI).toBeCloseTo(1.32712e20, -10);
    expect(C.MU_EARTH_SI).toBe(3.986e14);
    expect(C.R_EARTH_M).toBeCloseTo(6_378_100, 6);
    expect(C.km(1)).toBe(1000);
    expect(C.days(1)).toBe(86_400);
    expect(C.toDays(86_400)).toBe(1);
  });
});

// ---------------------------------------------------------------------------

const MKM = 1e9; // metres per million km

/** Sample f(jd) daily over [jd0, jd1] and return min and max. */
function range(f: (jd: number) => number, jd0: number, jd1: number, step = 1) {
  let min = Infinity;
  let max = -Infinity;
  for (let jd = jd0; jd <= jd1; jd += step) {
    const v = f(jd);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

describe('ephemeris', () => {
  const JD2000 = E.julianDate('2000-01-01T12:00:00Z');
  const JD2050 = E.julianDate('2050-01-01T00:00:00Z');

  it('Julian date of J2000.0 is 2451545.0', () => {
    expect(JD2000).toBe(2451545.0);
    expect(E.julianDate('2013-11-18')).toBe(2456614.5);
  });

  it('Kepler solver satisfies M = E − e sin E', () => {
    for (const e of [0, 0.0167, 0.2, 0.7, 0.95]) {
      for (const M of [0.01, 1, 3, -2.5]) {
        const Ea = E.solveKepler(M, e);
        expect(Ea - e * Math.sin(Ea)).toBeCloseTo(M, 12);
      }
    }
  });

  it('Earth: perihelion 147.09, aphelion 152.10 million km (NASA Earth Fact Sheet), ±0.3%', () => {
    const r = range((jd) => E.sunDistance('earth', jd), JD2000, JD2000 + 366, 0.25);
    expect(Math.abs(r.min / MKM / 147.092 - 1)).toBeLessThan(0.003);
    expect(Math.abs(r.max / MKM / 152.099 - 1)).toBeLessThan(0.003);
  });

  it('Earth: mean orbital speed ≈ 29.78 km/s (NASA Earth Fact Sheet), ±0.5%', () => {
    let sum = 0;
    const n = 365;
    for (let i = 0; i < n; i++) {
      const v = E.heliocentricVelocity('earth', JD2000 + i);
      sum += Math.hypot(...v);
    }
    expect(Math.abs(sum / n / 29_780 - 1)).toBeLessThan(0.005);
  });

  it('position and velocity agree (finite difference)', () => {
    const jd = E.julianDate('2014-03-01');
    for (const body of ['earth', 'mars', 'bennu', 'jupiter', 'venus'] as const) {
      const h = 0.01; // days
      const a = E.heliocentricPosition(body, jd - h);
      const b = E.heliocentricPosition(body, jd + h);
      const fd = a.map((_, i) => (b[i]! - a[i]!) / (2 * h * 86_400));
      const v = E.heliocentricVelocity(body, jd);
      const err = Math.hypot(fd[0]! - v[0], fd[1]! - v[1], fd[2]! - v[2]) / Math.hypot(...v);
      expect(err, body).toBeLessThan(2e-3);
    }
  });

  it('Mars: Sun distance stays within 206.65–249.26 million km (Mars Fact Sheet), ±0.5%', () => {
    const r = range((jd) => E.sunDistance('mars', jd), JD2000, JD2050, 2);
    expect(Math.abs(r.min / MKM / 206.65 - 1)).toBeLessThan(0.005);
    expect(Math.abs(r.max / MKM / 249.26 - 1)).toBeLessThan(0.005);
  });

  it('Mars: Earth distance 2000–2050 spans 54.6–401.4 million km (Mars Fact Sheet), ±3%', () => {
    const r = range((jd) => E.earthDistance('mars', jd), JD2000, JD2050, 1);
    expect(Math.abs(r.min / MKM / DESTINATIONS.mars.minEarthDistance_1e6km!.value - 1)).toBeLessThan(0.03);
    expect(Math.abs(r.max / MKM / DESTINATIONS.mars.maxEarthDistance_1e6km!.value - 1)).toBeLessThan(0.03);
  });

  it('Bennu: Sun distance spans q = 0.8969 au to Q = 1.3559 au (JPL SBDB)', () => {
    const jd0 = E.julianDate('2016-01-01');
    const r = range((jd) => E.sunDistance('bennu', jd), jd0, jd0 + 440, 0.5);
    expect(r.min / C.AU_M).toBeCloseTo(0.8969, 3);
    expect(r.max / C.AU_M).toBeCloseTo(1.3559, 3);
  });

  it('Moon is Earth-centred: Sun distance = Earth’s, Earth distance = 0.384 million km', () => {
    const jd = E.julianDate('2009-06-23');
    expect(E.sunDistance('moon', jd)).toBe(E.sunDistance('earth', jd));
    expect(E.earthDistance('moon', jd) / MKM).toBeCloseTo(0.384, 6);
  });

  it('synodic period S = 1/|1/T_E − 1/T_p| matches the Destinations table', () => {
    // Mars: 1/|1/365.256 − 1/686.98| = 779.9 d
    expect(E.synodicPeriod(365.256, 686.98)).toBeCloseTo(779.94, 0);
    expect(E.synodicPeriod(365.256, 224.7)).toBeCloseTo(583.9, 0);
    expect(E.synodicPeriod(365.256, 4331)).toBeCloseTo(398.9, 0);
  });
});

// ---------------------------------------------------------------------------
describe('trajectory', () => {
  const AU = C.AU_M;
  const MU = C.MU_SUN_SI;
  const marsR = C.km(DESTINATIONS.mars.sunDistance_1e6km.value * 1e6);
  const jupR = C.km(DESTINATIONS.jupiter.sunDistance_1e6km.value * 1e6);

  it('Hohmann Earth→Mars: ≈259 d, C3 ≈ 8.7 km²/s², v∞arr ≈ 2.65 km/s (spec: Trajectory model)', () => {
    // a_t = (149.598 + 227.956)/2 = 188.777e6 km; t = π√(a³/μ) = 2.2368e7 s = 258.9 d
    // v∞dep = √(μ(2/r1 − 1/a)) − √(μ/r1) = 32.73 − 29.78 = 2.945 km/s → C3 = 8.67
    const h = T.hohmann(AU, marsR, MU);
    expect(C.toDays(h.tFlight_s)).toBeCloseTo(258.9, 0);
    expect(Math.abs(h.c3_km2s2 - 8.7)).toBeLessThan(0.1);
    expect(Math.abs(h.vInfArr_ms / 1000 - 2.65)).toBeLessThan(0.05);
  });

  it('Hohmann Earth→Jupiter needs C3 ≈ 77 km²/s² (spec: Special cases)', () => {
    // v_p = √(μ(2/r1 − 1/a)) = 38.58 km/s; v∞ = 38.58 − 29.785 = 8.79 km/s; C3 = 77.3
    expect(Math.abs(T.hohmann(AU, jupR, MU).c3_km2s2 - 77)).toBeLessThan(1);
  });

  it('Hohmann phase angle for Mars ≈ 44° (θ = 180° − n·t)', () => {
    // 180 − 360 × 258.9 / 686.98 = 44.3°
    const h = T.hohmann(AU, marsR, MU);
    const theta = T.phaseAngleDeg(h.tFlight_s, C.days(DESTINATIONS.mars.orbitPeriod_days.value));
    expect(theta).toBeCloseTo(44.3, 0);
  });

  it('capture Δv into a 400 km circular Mars orbit from v∞ = 2.65 km/s ≈ 2.080 km/s', () => {
    // rp = 3396.2 + 400 = 3796.2 km
    // √(2.65² + 2·42828/3796.2) − √(42828/3796.2) = 5.43931 − 3.35884 = 2.08047 km/s
    const mu = C.mu(42828);
    const rp = C.km(3796.2);
    expect(T.captureDeltaV(2650, mu, rp, rp) / 1000).toBeCloseTo(2.0805, 3);
  });

  it('an elliptical capture orbit costs less than a low circular one', () => {
    const mu = C.mu(42828);
    const rp = C.km(3546.2);
    expect(T.captureDeltaV(2650, mu, rp, C.km(9596.2))).toBeLessThan(T.captureDeltaV(2650, mu, rp, rp));
  });

  it('Lambert solver reproduces Curtis Example 5.2 (Orbital Mechanics for Engineering Students)', () => {
    const r1: [number, number, number] = [5000e3, 10000e3, 2100e3];
    const r2: [number, number, number] = [-14600e3, 2500e3, 7000e3];
    const { v1, v2 } = T.lambert(r1, r2, 3600, C.mu(398600));
    const exp1 = [-5.9925, 1.9254, 3.2456];
    const exp2 = [-3.3125, -4.1966, -0.38529];
    for (let i = 0; i < 3; i++) {
      expect(v1[i]! / 1000).toBeCloseTo(exp1[i]!, 3);
      expect(v2[i]! / 1000).toBeCloseTo(exp2[i]!, 3);
    }
  });

  it('Lambert over (almost) 180° with the Hohmann flight time matches the Hohmann speed', () => {
    const h = T.hohmann(AU, marsR, MU);
    const th = 179.9 * (Math.PI / 180);
    const { v1 } = T.lambert([AU, 0, 0], [marsR * Math.cos(th), marsR * Math.sin(th), 0], h.tFlight_s, MU);
    const vHohmann = Math.sqrt(MU / AU) + Math.sqrt(h.c3_km2s2) * 1000;
    expect(Math.abs(Math.hypot(...v1) / vHohmann - 1)).toBeLessThan(0.005);
  });

  it('Lambert solution propagated by Kepler arrives at r2', () => {
    const jd1 = E.julianDate('2013-11-18');
    const jd2 = E.julianDate('2014-09-21');
    const r1 = E.heliocentricPosition('earth', jd1);
    const r2 = E.heliocentricPosition('mars', jd2);
    const { v1 } = T.lambert(r1, r2, C.days(jd2 - jd1), MU);
    const end = T.propagate(r1, v1, C.days(jd2 - jd1), MU);
    const err = Math.hypot(end.r[0] - r2[0], end.r[1] - r2[1], end.r[2] - r2[2]);
    expect(err / Math.hypot(...r2)).toBeLessThan(1e-6);
  });

  it('Lambert transfer for MAVEN dates gives a plausible Mars C3 and v∞ (sanity range)', () => {
    const t = T.lambertTransfer('mars', '2013-11-18', '2014-09-21');
    expect(t.c3_km2s2).toBeGreaterThan(8);
    expect(t.c3_km2s2).toBeLessThan(20);
    expect(t.vInfArr_ms / 1000).toBeGreaterThan(2);
    expect(t.vInfArr_ms / 1000).toBeLessThan(4);
    expect(t.flightDays).toBe(307);
    expect(t.path.length).toBeGreaterThan(10);
  });

  it('Moon is Earth-centred: TLI from a 185 km parking orbit gives C3 ≈ −2.04, ≈5 days, v∞ ≈ 0.83 km/s', () => {
    // r1 = 6563.1 km, r2 = 384400 km, a = 195481.6 km
    // v_p = √(398600·(2/6563.1 − 1/195481.6)) = 10.928 km/s; C3 = v_p² − 2μ/r1 = 119.43 − 121.47 = −2.04
    // t = π√(a³/μ) = 4.98 d; v∞ = √(μ/r2) − v_apogee = 1.0183 − 0.1866 = 0.832 km/s
    const t = T.moonTransfer();
    expect(t.c3_km2s2).toBeCloseTo(-2.04, 1);
    expect(t.flightDays).toBeCloseTo(4.98, 1);
    expect(t.vInfArr_ms / 1000).toBeCloseTo(0.832, 2);
  });

  it('Bennu rendezvous Δv equals the arrival v∞ (negligible gravity)', () => {
    expect(T.arrivalDeltaV('bennu', 5000, { periapsis_km: 1, apoapsis_km: 1 })).toBe(5000);
  });

  it('bestArrival scans flight times and returns the lowest-cost Lambert transfer', () => {
    const best = T.bestArrival('mars', '2013-11-18');
    for (const d of [best.flightDays - 20, best.flightDays + 20]) {
      const arr = new Date(Date.parse('2013-11-18T00:00:00Z') + d * 86_400_000).toISOString().slice(0, 10);
      const other = T.lambertTransfer('mars', '2013-11-18', arr);
      expect(other.vInfDep_ms + other.vInfArr_ms).toBeGreaterThanOrEqual(best.vInfDep_ms + best.vInfArr_ms);
    }
  });

  it('orbit change by vis-viva: circular 300 km → GEO equals the textbook Hohmann 3.893 km/s', () => {
    // v_LEO = √(398600/6678) = 7.7258; v_p = √(398600(2/6678 − 1/24421)) = 10.1516 → 2.4258
    // v_a = √(398600(2/42164 − 1/24421)) = 1.6078; v_GEO = 3.0747 → 1.4669; total 3.8927 km/s
    const mu = C.mu(398600);
    const dv = T.orbitChangeDeltaV(mu, { rp: C.km(6678), ra: C.km(6678) }, { rp: C.km(42164), ra: C.km(42164) });
    expect(Math.abs(dv / 1000 - 3.8927)).toBeLessThan(0.002);
  });

  it('MAVEN-like capture 380 × 44,600 km → science orbit 150 × 6,200 km (altitudes) ≈ 553 m/s', () => {
    // Radii: capture rp 3776.2, ra 47996.2; science rp 3546.2, ra 9596.2 km. Cheaper of the two orderings:
    // at apoapsis lower rp: 0.36079 → 0.35040 (10.4 m/s); at periapsis lower ra: 4.74262 → 4.19962 (543.0 m/s)
    // total ≈ 553.4 m/s (the other ordering costs ≈ 586.8 m/s)
    const mu = C.mu(42828);
    const dv = T.orbitChangeDeltaV(mu, { rp: C.km(3776.2), ra: C.km(47996.2) }, { rp: C.km(3546.2), ra: C.km(9596.2) });
    expect(Math.abs(dv - 553.4)).toBeLessThan(2);
  });

  it('Kepler III: orbit period from apsides, and apoapsis from period + periapsis', () => {
    // MAVEN science orbit 150 × 6,300 km altitude (NASAfacts): rp 3546.2, ra 9696.2 km, a = 6621.2 km
    // T = 2π√(a³/μ) = 2π√(2.90276e20 / 4.2828e13) = 16,358 s = 4.54 h  (NASA: 4.5 h)
    const mu = C.mu(42828);
    expect(T.orbitPeriod(mu, C.km(3546.2), C.km(9696.2)) / 3600).toBeCloseTo(4.54, 2);
    // Capture orbit 35 h with periapsis 380 km altitude: a = (μT²/4π²)^(1/3) = 25,825 km
    // ra = 2a − rp = 51,650 − 3,776.2 = 47,874 km → apoapsis altitude ≈ 44,478 km
    const ra = T.apoapsisFromPeriod(mu, C.km(3776.2), 35 * 3600);
    expect(Math.abs(ra / 1000 - 47_874)).toBeLessThan(5);
    expect(T.orbitPeriod(mu, C.km(3776.2), ra)).toBeCloseTo(35 * 3600, 6);
  });

  it('no orbit change costs nothing', () => {
    const o = { rp: C.km(3546.2), ra: C.km(9596.2) };
    expect(T.orbitChangeDeltaV(C.mu(42828), o, o)).toBeCloseTo(0, 9);
  });

  it('transfer cap: less than one revolution of the Hohmann transfer orbit (2 × t_Hohmann)', () => {
    // Mars: 2 × 258.9 = 517.8 d. Bennu (168e6 km): a = 158.799e6 km, t = π√(a³/μ) = 199.73 d → 399.5 d
    expect(T.maxFlightDays('mars')).toBeCloseTo(517.8, 0);
    expect(T.maxFlightDays('bennu')).toBeCloseTo(399.5, 0);
  });

  it('bestArrival never searches beyond the cap', () => {
    expect(T.bestArrival('bennu', '2016-09-08').flightDays).toBeLessThan(T.maxFlightDays('bennu'));
  });

  it('NASA real route to Bennu (Earth flyby) uses the published launch C3 of 29.29678 km²/s²', () => {
    const r = T.fixedRoute('bennu', 'nasa-earth-flyby');
    expect(r.method).toBe('fixed-route');
    expect(r.c3_km2s2).toBe(29.29678);
    // post-flyby leg flyby → approach start is 325 days, inside the cap, so Lambert applies
    expect(r.postFlybyLegDays).toBe(325);
    expect(r.postFlybyLegDays).toBeLessThan(T.maxFlightDays('bennu'));
    expect(r.vInfArr_ms).toBeGreaterThan(0);
    expect(r.extraDeltaV.value).toBeGreaterThan(0); // deep-space manoeuvre (estimate)
    expect(r.flightDays).toBe(816);
  });
});

// ---------------------------------------------------------------------------
describe('propulsion', () => {
  // MAVEN (NASA Science): 2,454 kg wet, 809 kg dry → ln(2454/809) = ln(3.033375) = 1.109676
  it('rocket equation, MAVEN at Isp 220 s ≈ 2394 m/s and at 230 s ≈ 2503 m/s', () => {
    // 220 × 9.80665 × 1.109676 = 2394.1 ; 230 × 9.80665 × 1.109676 = 2502.9
    expect(P.deltaVCapability(220, 2454, 809)).toBeCloseTo(2394.1, 0);
    expect(P.deltaVCapability(230, 2454, 809)).toBeCloseTo(2502.9, 0);
  });

  it('propellant needed is the inverse of the rocket equation', () => {
    const dv = P.deltaVCapability(225, 2454, 809);
    expect(P.propellantForDeltaV(dv, 225, 809)).toBeCloseTo(1645, 6);
    // 1 km/s at 300 s on 1000 kg dry: 1000 × (e^(1000/2941.995) − 1) = 1000 × (e^0.339906 − 1) = 404.81 kg
    expect(P.propellantForDeltaV(1000, 300, 1000)).toBeCloseTo(404.81, 1);
  });

  it('propellant burned from a start mass: m₀(1 − e^(−Δv/(Isp·g₀)))', () => {
    // 2454 kg, 1142 m/s at 225 s: 1142/2206.496 = 0.517562; 2454 × (1 − e^−0.517562) = 2454 × 0.404013 = 991.4 kg
    expect(P.propellantBurned(2454, 1142, 225)).toBeCloseTo(991.4, 0);
    // consistent with the rocket equation: burning all propellant gives the full capability
    expect(P.propellantBurned(2454, P.deltaVCapability(225, 2454, 809), 225)).toBeCloseTo(1645, 6);
  });

  it('tank + feed mass is 12% of propellant (game rule)', () => {
    expect(P.tankMass(1645)).toBeCloseTo(197.4, 6);
  });

  it('Δv budget = arrival burn + 50 m/s corrections + maintenance', () => {
    // 2080 + 50 + 20 m/s/yr × 1 yr = 2150
    expect(P.deltaVBudget({ arrival_ms: 2080, scienceDays: 365.25 }).total_ms).toBeCloseTo(2150, 6);
    expect(P.deltaVBudget({ arrival_ms: 2080, scienceDays: 730.5 }).total_ms).toBeCloseTo(2170, 6);
  });

  it('Δv budget adds the science-orbit transfer and a mission-lifetime reserve', () => {
    // reserve = 20 m/s/yr × (lifetime − science) = 20 × (4094 − 365.25)/365.25 = 204.18 m/s
    // total = 2080 + 553.4 + 50 + 20 + 204.18 = 2907.58 m/s
    const b = P.deltaVBudget({ arrival_ms: 2080, orbitTransfer_ms: 553.4, scienceDays: 365.25, lifetimeDays: 4094 });
    expect(b.lifetimeReserve_ms).toBeCloseTo(204.18, 2);
    expect(b.total_ms).toBeCloseTo(2907.58, 2);
    // lifetime shorter than science never gives a negative reserve
    expect(P.deltaVBudget({ arrival_ms: 0, scienceDays: 365, lifetimeDays: 100 }).lifetimeReserve_ms).toBe(0);
  });

  it('Δv meter: margin = (capability − required)/required; <10% warning, <0% over', () => {
    expect(P.deltaVMeter(2394, 2150, {}).margin).toBeCloseTo(0.11349, 4);
    expect(P.deltaVMeter(2394, 2150, {}).status).toBe('ok');
    expect(P.deltaVMeter(2300, 2150, {}).status).toBe('warning');
    expect(P.deltaVMeter(2000, 2150, {}).status).toBe('over');
  });

  it('ion engines cannot do a capture burn', () => {
    expect(P.engineBlockers('ion-xenon', 'orbiter')).toHaveLength(1);
    expect(P.engineBlockers('ion-xenon', 'rendezvous')).toHaveLength(0);
    expect(P.engineBlockers('hydrazine-mono', 'orbiter')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('launch', () => {
  const curve: [number, number][] = [
    [0, 1000],
    [10, 800],
    [20, 500],
  ];

  it('piecewise-linear payload(C3)', () => {
    // m = 1000 + (800 − 1000)(5 − 0)/(10 − 0) = 900
    expect(L.payloadAtC3(curve, 5).mass_kg).toBe(900);
    expect(L.payloadAtC3(curve, 15).mass_kg).toBe(650);
    expect(L.payloadAtC3(curve, 10).mass_kg).toBe(800);
  });

  it('below the data range it holds the first point (conservative); above it there is no capacity', () => {
    expect(L.payloadAtC3(curve, -1)).toEqual({ mass_kg: 1000, inRange: false });
    expect(L.payloadAtC3(curve, 25)).toEqual({ mass_kg: 0, inRange: false });
  });

  it('mass margin = (m_max − m_wet)/m_max and a plain-language blocker when over', () => {
    const ok = L.launchMassCheck(curve, 10, 600);
    expect(ok.meter.margin).toBeCloseTo(0.25, 10);
    expect(ok.blocker).toBeUndefined();
    const over = L.launchMassCheck(curve, 12, 880);
    // m_max(12) = 800 + (500 − 800)(2/10) = 740 → too heavy by 140 kg
    expect(over.meter.status).toBe('over');
    expect(over.blocker).toBe('Too heavy by 140 kg for this rocket at C3 = 12');
  });

  it('Laplace launch reliability (successes + 1)/(flights + 2)', () => {
    expect(L.launchSuccessProbability(0, 0)).toBe(0.5);
    expect(L.launchSuccessProbability(10, 10)).toBeCloseTo(11 / 12, 12);
    expect(L.launchSuccessProbability(40, 41)).toBeCloseTo(41 / 43, 12);
  });

  it('every launch vehicle curve is C3-ascending and payload-descending', () => {
    for (const [id, lv] of Object.entries(LAUNCH_VEHICLES)) {
      const pts = lv.payloadCurve.value;
      for (let i = 1; i < pts.length; i++) {
        expect(pts[i]![0], id).toBeGreaterThan(pts[i - 1]![0]);
        expect(pts[i]![1], id).toBeLessThan(pts[i - 1]![1]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe('power', () => {
  const peri = 206.65e9; // Mars perihelion, m (Mars Fact Sheet)
  const aph = 249.26e9; // Mars aphelion, m

  it('solar power at Mars perihelion, MAVEN 12 m², η = 0.20 ≈ 1712 W', () => {
    // 1361 × (149.5979/206.65)² × 12 × 0.20 = 1361 × 0.524059 × 2.4 = 1711.8 W
    expect(PW.solarPower({ area_m2: 12, sunDistance_m: peri })).toBeCloseTo(1711.8, 0);
  });

  it('solar power at Mars aphelion ≈ 1177 W', () => {
    // 1361 × (149.5979/249.26)² × 12 × 0.20 = 1361 × 0.360202 × 2.4 = 1176.6 W
    expect(PW.solarPower({ area_m2: 12, sunDistance_m: aph })).toBeCloseTo(1176.6, 0);
  });

  it('calibration: MAVEN 1,700 W at perihelion and 1,150 W at aphelion give η ≈ 0.199 and 0.196', () => {
    expect(PW.calibrateEta(1700, 12, peri)).toBeCloseTo(0.1986, 3);
    expect(PW.calibrateEta(1150, 12, aph)).toBeCloseTo(0.1955, 3);
  });

  it('Sun angle and degradation terms: cos θ and (1 − d)^t', () => {
    const base = PW.solarPower({ area_m2: 10, sunDistance_m: C.AU_M });
    // 1361 × 10 × 0.2 = 2722 W at 1 AU
    expect(base).toBeCloseTo(2722, 6);
    expect(PW.solarPower({ area_m2: 10, sunDistance_m: C.AU_M, sunAngle_rad: Math.PI / 3 })).toBeCloseTo(1361, 6);
    expect(PW.solarPower({ area_m2: 10, sunDistance_m: C.AU_M, degradationPerYear: 0.01, years: 2 })).toBeCloseTo(2722 * 0.9801, 6);
  });

  it('RTG: 110 W and 45 kg each (NASA MMRTG fact sheet), independent of the Sun', () => {
    expect(PW.rtgPower(2)).toBe(220);
    expect(PW.rtgMass(2)).toBe(90);
  });

  it('heater power rises as sunlight falls (game rule)', () => {
    // 80 × (1 + 2 × (1 − 0.431)) = 171.04 W
    expect(PW.heaterPower(80, 0.431)).toBeCloseTo(171.04, 6);
    expect(PW.heaterPower(80, 1.91)).toBe(80);
  });

  it('longest eclipse, circular 400 km Mars orbit ≈ 2503 s (T·asin(R/r)/π)', () => {
    // r = 3796.2 km; T = 2π√(r³/μ) = 7101.3 s; asin(3396.2/3796.2)/π = 0.35242 → 2502.7 s
    const e = PW.longestEclipse_s(C.mu(42828), C.km(3396.2), C.km(3796.2), C.km(3796.2));
    expect(Math.abs(e / 2502.7 - 1)).toBeLessThan(0.005);
  });

  it('an eccentric orbit has a longer worst-case eclipse (slow near apoapsis)', () => {
    const mu = C.mu(42828);
    const circ = PW.longestEclipse_s(mu, C.km(3396.2), C.km(3796.2), C.km(3796.2));
    expect(PW.longestEclipse_s(mu, C.km(3396.2), C.km(3546.2), C.km(9596.2))).toBeGreaterThan(circ);
  });

  it('battery mass = energy needed / specific energy', () => {
    // 2502.7 s × 500 W = 347.6 Wh; / 100 Wh/kg = 3.476 kg
    expect(PW.batteryMass(2502.7, 500)).toBeCloseTo(3.476, 3);
  });

  it('power meter margin = (available − required)/required', () => {
    const m = PW.powerMeter(1176.6, 900, {});
    expect(m.margin).toBeCloseTo(0.30733, 4);
    expect(m.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
describe('power: worst day of the mission, eclipses included (one model with Mission operations)', () => {
  it('battery capacity = eclipse × load / depth of discharge', async () => {
    const { batteryCapacity_Wh } = await import('../src/engine/powerProfile');
    // 2502.7 s × 500 W = 347.6 Wh; / 0.3 depth of discharge = 1158.66 Wh (→ 11.59 kg at 100 Wh/kg)
    expect(batteryCapacity_Wh(2502.7, 500, 0.3)).toBeCloseTo(1158.66, 1);
    expect(batteryCapacity_Wh(2502.7, 500, 1)).toBeCloseTo(347.6, 1);
  });

  const maven = presetDesign('maven');
  const ev = evaluateDesign(maven);

  it('the Power meter reads the worst day: its margin is the lowest of every prime-mission day', async () => {
    const { powerProfileFor } = await import('../src/engine/powerProfile');
    const prof = powerProfileFor(maven, ev);
    const prime = prof.days.filter((d) => d.day <= prof.primeEndDay);
    const lowest = Math.min(...prime.map((d) => d.margin));
    expect(ev.meters.power.margin).toBeCloseTo(lowest, 12);
    expect(ev.meters.power.limit).toBeCloseTo(ev.details.power.worstDay.available_W, 9);
    expect(ev.meters.power.used).toBeCloseTo(ev.details.power.worstDay.required_W, 9);
    // never better than the old arrival-day, sunlit, all-instruments-on figure
    const arrival = (ev.details.power.available_W - ev.details.power.required_W) / ev.details.power.required_W;
    expect(ev.meters.power.margin).toBeLessThanOrEqual(arrival + 1e-12);
  });

  it('cruise has no eclipse: available = generation, and the instruments are off', async () => {
    const { powerProfileFor } = await import('../src/engine/powerProfile');
    const prof = powerProfileFor(maven, ev);
    const cruise = prof.days.filter((d) => d.phase === 'cruise');
    expect(cruise.length).toBeGreaterThan(100);
    for (const d of cruise) {
      expect(d.eclipseFraction).toBe(0);
      expect(d.available_W).toBe(d.generation_W);
    }
    const sci = prof.days.find((d) => d.phase === 'science')!;
    // the science day draws the instruments too: the MAVEN payload's 120 W (parts.json, game estimate)
    expect(sci.required_W - sci.heaterNeed_W - (cruise[0]!.required_W - cruise[0]!.heaterNeed_W)).toBeCloseTo(120, 9);
  });

  it('eclipse days: P_avail = P_gen(1 − f_ecl), because a battery sized within its depth of discharge never limits', async () => {
    const { powerProfileFor } = await import('../src/engine/powerProfile');
    const prof = powerProfileFor(maven, ev);
    const ecl = prof.days.filter((d) => d.eclipseFraction > 0);
    expect(ecl.length).toBeGreaterThan(0);
    for (const d of ecl) {
      expect(d.available_W).toBeCloseTo(d.generation_W * (1 - d.eclipseFraction), 9);
      // E_batt / t_ecl ≥ load / DoD (t_ecl ≤ the worst case the battery was sized for)
      expect(prof.battery.capacity_Wh / (d.longestEclipse_s / 3600)).toBeGreaterThanOrEqual(prof.battery.load_W / prof.battery.depthOfDischarge - 1e-6);
    }
  });

  it('circular 400 km polar Mars orbit with the Sun in its plane: the eclipse cuts the day by asin(R/r)/π ≈ 35.2%', async () => {
    const { powerProfileFor } = await import('../src/engine/powerProfile');
    const d: Design = { ...presetDesign('maven'), scienceOrbit: { periapsis_km: 400, apoapsis_km: 400, inclination_deg: 90 } };
    const e = evaluateDesign(d);
    const prof = powerProfileFor(d, e);
    const deepest = prof.days.reduce((a, b) => (b.eclipseFraction > a.eclipseFraction ? b : a));
    // asin(3396.2/3796.2)/π = 0.35221; the inertial orbit reaches β ≈ 0 at least once in a Mars year
    expect(deepest.eclipseFraction).toBeCloseTo(0.35221, 2);
    expect(deepest.available_W).toBeCloseTo(deepest.generation_W * (1 - deepest.eclipseFraction), 9);
    expect(e.details.power.worstDay.eclipseFraction).toBeGreaterThan(0.3);
  });

  it('Mission operations reads the same days: prepareOps available power = the profile, day for day', async () => {
    const { powerProfileFor } = await import('../src/engine/powerProfile');
    const { prepareOps } = await import('../src/engine/ops/timeline');
    const env = prepareOps(maven);
    const prof = powerProfileFor(maven, ev, env.horizonDay);
    for (const day of [0, 50, env.arrivalDay, env.arrivalDay + 40, env.primeEndDay, env.horizonDay]) {
      expect(env.days[day]!.available_W).toBe(prof.days[day]!.available_W);
      expect(env.days[day]!.eclipseFraction).toBe(prof.days[day]!.eclipseFraction);
    }
    expect(env.battery_Wh).toBe(ev.details.power.battery.capacity_Wh);
  });

  it('the battery is sized for the worst-case eclipse at the heaviest science-day load, within the depth of discharge', () => {
    const b = ev.details.power.battery;
    // battery mass = capacity / specific energy (100 Wh/kg)
    expect(b.mass_kg).toBeCloseTo(b.capacity_Wh / 100, 9);
    expect(b.capacity_Wh).toBeCloseTo((b.sizedForEclipse_s / 3600) * b.load_W / 0.3, 6);
    expect(ev.details.massBreakdown.battery).toBe(b.mass_kg);
  });
});

describe('comms', () => {
  const ref = CM.REFERENCE_LINK;
  const same = {
    txPower_W: ref.txPower_W.value,
    dishDiameter_m: ref.dishDiameter_m.value,
    groundDish_m: ref.groundDish_m.value as 34 | 70,
    distance_m: ref.distance_m.value,
  };

  it('the reference link is MRO (DESCANSO Article 12): ≥500 kbps at 400 million km, 100 W, 3 m HGA', () => {
    expect(ref.rate_bps.value).toBe(500_000);
    expect(ref.distance_m.value).toBe(400e9);
    expect(ref.txPower_W.value).toBe(100);
    expect(ref.dishDiameter_m.value).toBe(3);
    for (const k of ['rate_bps', 'distance_m', 'txPower_W', 'dishDiameter_m'] as const) {
      expect(ref[k].isGameEstimate, k).toBe(false);
      expect(ref[k].url).toMatch(/descanso\.jpl\.nasa\.gov/);
    }
    // The article does not name the station for the 500 kbps figure; 34 m is inferred, so it stays labelled.
    expect(ref.groundDish_m.value).toBe(34);
    expect(ref.groundDish_m.isGameEstimate).toBe(true);
  });

  it('reproduces the reference rate with the reference link', () => {
    expect(CM.dataRate(same)).toBeCloseTo(ref.rate_bps.value, 6);
  });

  it('70 m vs 34 m uses the DSN 810-005 X-band gains: 74.55 − 68.24 = 6.31 dB → 4.276×', () => {
    // 810-005 101 Rev I Table 2: DSS-14 X-only 74.55 dBi (8420 MHz); 104 Rev Q Table 6: DSS-24 X-only 68.24 dBi (8425 MHz)
    // 10^(6.31/10) = 4.2756 (close to the (70/34)² = 4.24 diameter rule the spec used before)
    expect(CM.DSN_X_BAND_GAIN_DBI[70].value).toBe(74.55);
    expect(CM.DSN_X_BAND_GAIN_DBI[34].value).toBe(68.24);
    expect(CM.DSN_X_BAND_GAIN_DBI[70].isGameEstimate).toBe(false);
    const r34 = CM.dataRate({ ...same, groundDish_m: 34 });
    const r70 = CM.dataRate({ ...same, groundDish_m: 70 });
    expect(r70 / r34).toBeCloseTo(4.2756, 4);
  });

  it('a 2 m, 100 W craft at 1 AU to a 34 m dish', () => {
    // R = 500 kbps × (100/100) × (2/3)² × (400e9 / 1.495978707e11)² = 500e3 × 0.44444 × 7.1494 = 1.5888 Mbps
    const r = CM.dataRate({ txPower_W: 100, dishDiameter_m: 2, groundDish_m: 34, distance_m: 1.495978707e11 });
    expect(r).toBeCloseTo(1_588_754, -1);
    // same to a 70 m dish: × 4.2756 = 6.7929 Mbps
    expect(CM.dataRate({ txPower_W: 100, dishDiameter_m: 2, groundDish_m: 70, distance_m: 1.495978707e11 })).toBeCloseTo(6_792_922, -1);
  });

  it('rate ∝ P_t, ∝ D_sc², ∝ 1/d²', () => {
    const r = CM.dataRate(same);
    expect(CM.dataRate({ ...same, distance_m: same.distance_m * 2 }) / r).toBeCloseTo(0.25, 12);
    expect(CM.dataRate({ ...same, txPower_W: same.txPower_W * 2 }) / r).toBeCloseTo(2, 12);
    expect(CM.dataRate({ ...same, dishDiameter_m: same.dishDiameter_m * 2 }) / r).toBeCloseTo(4, 12);
  });

  it('data per day = R × 8-hour DSN pass', () => {
    // 1000 bit/s × 8 × 3600 s = 28.8 Mbit
    expect(CM.dataPerDay_bits(1000)).toBe(28_800_000);
  });

  it('light delay t = d/c: Mars 3.0 to 22.3 minutes (54.6–401.4 million km)', () => {
    // 54.6e9 / 299792458 = 182.13 s = 3.035 min; 401.4e9 / 299792458 = 1338.9 s = 22.32 min
    expect(CM.lightDelay_s(54.6e9) / 60).toBeCloseTo(3.035, 2);
    expect(CM.lightDelay_s(401.4e9) / 60).toBeCloseTo(22.32, 2);
  });

  it('one anchor value is inferred, so the meter is calibrated but still shows that estimate', () => {
    expect(CM.COMMS_CALIBRATED).toBe(true);
    const m = CM.dataMeter(1000e6, 500e6, {});
    expect(m.calibrated).toBe(true);
    // the meter's limit badge points at the inferred station pairing
    expect(m.limitSource).toBe(ref.groundDish_m);
    expect(m.margin).toBeCloseTo(-0.5, 12);
    expect(m.status).toBe('over');
  });
});

// ---------------------------------------------------------------------------
describe('massCost', () => {
  it('m_dry = (1 + 0.30)(bus + instruments + power + comms + tanks)', () => {
    // 450 + (15 + 25) + 48 + 40 + 120 = 698 kg; × 1.3 = 907.4 kg
    const m = MC.massRollup({ bus: 450, instruments: [15, 25], power: 48, comms: 40, tanks: 120 });
    expect(m.subtotal_kg).toBe(698);
    expect(m.dry_kg).toBeCloseTo(907.4, 9);
    expect(m.growthMargin_kg).toBeCloseTo(209.4, 9);
  });

  it('m_wet = m_dry + m_prop', () => {
    expect(MC.wetMass(907.4, 1000)).toBeCloseTo(1907.4, 9);
  });

  const design: Design = {
    destination: 'mars',
    launchVehicleId: 'atlas-v-401',
    launchDate: '2026-11-01',
    arrivalDate: '2027-09-01',
    busId: 'medium-bus',
    instrumentIds: ['camera', 'spectrometer'],
    power: { type: 'solar', arrayArea_m2: 10 },
    comms: { dishDiameter_m: 2, txPower_W: 50, groundDish_m: 34 },
    engineId: 'hydrazine-mono',
    propellant_kg: 1000,
    captureOrbit: { periapsis_km: 300, apoapsis_km: 6000 },
  };

  it('component masses from the parts catalogue', () => {
    // power: 10 m² × 4 kg/m² + 5 kg battery = 45; comms: 5 + 8·π·1² + 0.1·50 = 35.1327; tanks: 0.12 × 1000 = 120
    const c = MC.componentMasses(design, 5);
    expect(c.bus).toBe(450);
    expect(c.instruments).toEqual([15, 25]);
    expect(c.power).toBeCloseTo(45, 9);
    expect(c.comms).toBeCloseTo(35.1327, 4);
    expect(c.tanks).toBeCloseTo(120, 9);
    // subtotal 690.1327 → dry 897.1726
    expect(MC.massRollup(c).dry_kg).toBeCloseTo(897.1726, 3);
  });

  it('development cost roll-up (Phases A–D): bus + instruments + engine + power + comms', () => {
    // 180 + (25 + 35) + 15 + 10 × 1.5 + (10 + 3·π·1²) = 289.4248 $M
    expect(MC.developmentCost(design)).toBeCloseTo(289.4248, 4);
  });

  it('cost caps by mission class (Discovery sourced, New Frontiers estimate)', () => {
    expect(MC.COST_CAPS.discovery.value).toBe(500);
    expect(MC.COST_CAPS.discovery.isGameEstimate).toBe(false);
    expect(MC.COST_CAPS.newFrontiers.isGameEstimate).toBe(true);
  });

  it('cost meter: development vs cap; launch and operations counted separately', () => {
    const c = MC.costEvaluation(design);
    expect(c.meter.used).toBeCloseTo(289.4248, 4);
    expect(c.meter.limit).toBe(500);
    expect(c.meter.margin).toBeCloseTo((500 - 289.4248) / 500, 6);
    expect(c.meter.status).toBe('ok');
    expect(c.launch_M).toBe(110);
    // ops: 365 days × $20M/yr
    expect(c.operations_M).toBeCloseTo(20 * (365 / 365.25), 6);
    const over = MC.costMeter(520, 500, {});
    expect(over.status).toBe('over');
  });
});

// ---------------------------------------------------------------------------
describe('risk', () => {
  it('margin factor f(m): 1 at or above the recommended 10%, rising linearly to 3 at 0%, certain failure below 0', () => {
    expect(R.marginFactor(0.2)).toBe(1);
    expect(R.marginFactor(0.1)).toBe(1);
    // 1 + 2 × (0.10 − 0.05)/0.10 = 2
    expect(R.marginFactor(0.05)).toBeCloseTo(2, 12);
    expect(R.marginFactor(0)).toBeCloseTo(3, 12);
    expect(R.marginFactor(-0.01)).toBe(Infinity);
  });

  it('p_fail,phase = p_base · Π f_i(margin_i), capped at 1', () => {
    // 0.04 × f(0.05) × f(0.2) = 0.04 × 2 × 1 = 0.08
    expect(R.phaseFailure(0.04, [0.05, 0.2])).toBeCloseTo(0.08, 12);
    expect(R.phaseFailure(0.04, [-0.1])).toBe(1);
  });

  it('mission failure = 1 − Π(1 − p_phase)', () => {
    // 1 − 0.9 × 0.8 = 0.28
    expect(R.combine([0.1, 0.2])).toBeCloseTo(0.28, 12);
  });

  it('phase risks: launch from the Laplace record; capture from Δv margin; science grows with years', () => {
    const phases = R.phaseRisks({
      missionType: 'orbiter',
      launchSuccess: 41 / 43,
      deltaVMargin: 0.05,
      powerMargin: 0.2,
      scienceDays: 730.5,
    });
    const by = Object.fromEntries(phases.map((p) => [p.phase, p.pFail]));
    expect(by.launch).toBeCloseTo(2 / 43, 12);
    // arrival: p_base × f(0.05) = 2 × p_base
    expect(by.arrival).toBeCloseTo(2 * R.BASE_RISK.arrival.value, 12);
    // science: 1 − (1 − p_year)^2
    expect(by.science).toBeCloseTo(1 - (1 - R.BASE_RISK.sciencePerYear.value) ** 2, 12);
    expect(phases.map((p) => p.phase)).toEqual(['launch', 'cruise', 'arrival', 'science']);
  });

  it('sample-return rendezvous adds a return phase', () => {
    const phases = R.phaseRisks({
      missionType: 'rendezvous',
      launchSuccess: 0.95,
      deltaVMargin: 0.2,
      powerMargin: 0.2,
      scienceDays: 365.25,
      sampleReturn: true,
    });
    expect(phases.map((p) => p.phase)).toEqual(['launch', 'cruise', 'arrival', 'science', 'return']);
  });

  it('risk meter: used = mission failure probability vs the acceptable limit', () => {
    const m = R.riskMeter([
      { phase: 'launch', pFail: 0.1, base: R.BASE_RISK.cruise, factors: {} },
      { phase: 'cruise', pFail: 0.2, base: R.BASE_RISK.cruise, factors: {} },
    ]);
    expect(m.used).toBeCloseTo(0.28, 12);
    expect(m.limit).toBe(R.ACCEPTABLE_MISSION_RISK.value);
  });

  it('seeded random numbers are reproducible and uniform on [0, 1)', () => {
    const a = R.makeRng(42);
    const b = R.makeRng(42);
    const xs = Array.from({ length: 10_000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(Math.abs(xs.reduce((s, x) => s + x, 0) / xs.length - 0.5)).toBeLessThan(0.01);
  });

  it('Monte Carlo success rate matches the analytic value within 3σ (1,000 runs)', () => {
    const phases = [
      { phase: 'launch' as const, pFail: 0.05, base: R.BASE_RISK.cruise, factors: {} },
      { phase: 'arrival' as const, pFail: 0.1, base: R.BASE_RISK.cruise, factors: {} },
    ];
    const mc = R.monteCarlo(phases, 1000, R.makeRng(7));
    const p = 0.95 * 0.9; // 0.855
    const sigma = Math.sqrt((p * (1 - p)) / 1000); // 0.0111
    expect(Math.abs(mc.successRate - p)).toBeLessThan(3 * sigma);
    expect((mc.failuresByPhase.launch ?? 0) + (mc.failuresByPhase.arrival ?? 0) + mc.successes).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
describe('crisis', () => {
  const tl = CR.timeline({ flightDays: 307, scienceDays: 365 });

  it('timeline: a day-214 event on a 307-day Mars transfer is a cruise event (spec: Timeline rule)', () => {
    expect(CR.phaseOnDay(tl, 0)).toBe('launch');
    expect(CR.phaseOnDay(tl, 214)).toBe('cruise');
    expect(CR.phaseOnDay(tl, 307)).toBe('arrival');
    expect(CR.phaseOnDay(tl, 308)).toBe('science');
    expect(CR.phaseOnDay(tl, 672)).toBe('science');
  });

  it('every card has its real-history summary flagged for checking against NASA LLIS', () => {
    for (const card of CR.CRISIS_CARDS) {
      expect(card.realHistory.isGameEstimate, card.id).toBe(true);
      expect(card.realHistory.url, card.id).toBe('https://llis.nasa.gov/');
      expect(card.options.length, card.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('False touchdown is a lander card and is never drawn for orbiters or rendezvous missions', () => {
    expect(CR.applicableCards('orbiter', false).map((c) => c.id)).not.toContain('false-touchdown');
    expect(CR.applicableCards('rendezvous', true).map((c) => c.id)).not.toContain('false-touchdown');
    // the Genesis card needs a return phase
    expect(CR.applicableCards('orbiter', false).map((c) => c.id)).not.toContain('upside-down-sensor');
    expect(CR.applicableCards('rendezvous', true).map((c) => c.id)).toContain('upside-down-sensor');
  });

  it('a drawn card always has its day inside its phase (500 draws)', () => {
    const rng = R.makeRng(3);
    for (let i = 0; i < 500; i++) {
      const d = CR.drawCrisis(tl, 'orbiter', false, rng);
      expect(CR.phaseOnDay(tl, d.day)).toBe(d.phase);
      if (d.card.eventPhase !== 'any') expect(d.phase).toBe(d.card.eventPhase);
    }
  });

  it('options the margins cannot pay for are not offered', () => {
    const card = CR.CRISIS_CARDS.find((c) => c.id === 'unit-mismatch')!;
    const rich = CR.availableOptions(card, { deltaV_ms: 500, budget_M: 100, powerMargin: 0.3 });
    const poor = CR.availableOptions(card, { deltaV_ms: 5, budget_M: 100, powerMargin: 0.3 });
    expect(rich.map((o) => o.id)).toContain('nav-check');
    expect(poor.map((o) => o.id)).not.toContain('nav-check');
    expect(poor.length).toBeGreaterThan(0); // the free option is always there
  });

  it('the free option stays on offer even when a spare margin is negative (over budget is not a blocker)', () => {
    // Over the cost cap: budget spare −$20M. The free option costs nothing, so it is still offered.
    for (const card of CR.CRISIS_CARDS) {
      const broke = CR.availableOptions(card, { deltaV_ms: -10, budget_M: -20, powerMargin: -0.1 });
      expect(broke.map((o) => o.id), card.id).toEqual(card.options.filter((o) => !o.cost.deltaV_ms && !o.cost.budget_M && !o.requires).map((o) => o.id));
      expect(broke.length, card.id).toBeGreaterThan(0);
    }
  });

  it('an over-budget craft that launches can still meet its crisis (no crash)', () => {
    const maven = presetDesign('maven');
    const pricey: Design = {
      ...maven,
      busId: 'large-bus',
      instrumentIds: [...maven.instrumentIds, 'radar', 'camera', 'spectrometer'],
      power: { type: 'solar', arrayArea_m2: 30 },
    };
    const e = evaluateDesign(pricey);
    expect(e.meters.cost.status).toBe('over');
    expect(e.blockers).toEqual([]); // it launches
    for (let seed = 1; seed <= 20; seed++) expect(() => simulateMission(pricey, { seed })).not.toThrow();
  });

  it('crisis handling score: outcome vs risk taken', () => {
    expect(CR.crisisScore(true, false)).toBe(100); // safe choice, good outcome
    expect(CR.crisisScore(false, false)).toBe(70); // risky, got lucky
    expect(CR.crisisScore(true, true)).toBe(50); // safe, unlucky
    expect(CR.crisisScore(false, true)).toBe(0); // risky, lost
  });
});

// ---------------------------------------------------------------------------
describe('scoring', () => {
  it('weights are the spec values and sum to 1', () => {
    const w = SC.WEIGHTS;
    expect(w.science.value).toBe(0.3);
    expect(w.success.value).toBe(0.2);
    expect(w.budget.value).toBe(0.15);
    expect(w.deltaV.value + w.power.value + w.mass.value).toBeCloseTo(0.3, 12);
    expect(w.crisis.value).toBe(0.05);
    expect(Object.values(w).reduce((s, x) => s + x.value, 0)).toBeCloseTo(1, 12);
  });

  it('margin band: 100 inside 10–30%, linear to 0 at 0% and at 80%', () => {
    expect(SC.marginBandScore(0.2)).toBe(100);
    expect(SC.marginBandScore(0.1)).toBe(100);
    expect(SC.marginBandScore(0.3)).toBe(100);
    expect(SC.marginBandScore(0.05)).toBeCloseTo(50, 9);
    expect(SC.marginBandScore(0)).toBe(0);
    expect(SC.marginBandScore(0.55)).toBeCloseTo(50, 9);
    expect(SC.marginBandScore(0.8)).toBeCloseTo(0, 9);
    expect(SC.marginBandScore(-0.1)).toBe(0);
    expect(SC.marginBandScore(1.02)).toBe(0);
  });

  it('budget: 100 at or under cap, falling steeply to 0 at 20% over', () => {
    expect(SC.budgetScore(400, 500)).toBe(100);
    expect(SC.budgetScore(500, 500)).toBe(100);
    expect(SC.budgetScore(550, 500)).toBeCloseTo(50, 9);
    expect(SC.budgetScore(600, 500)).toBeCloseTo(0, 9);
    expect(SC.budgetScore(700, 500)).toBe(0);
  });

  it('science goal = Σ instrument data/day × planned science days', () => {
    // camera 2000 + spectrometer 1000 Mbit/day = 3e9 bit/day × 365 d = 1095 Gbit
    expect(SC.scienceGoal_Gbit(3e9, 365)).toBeCloseTo(1095, 9);
  });

  it('science = downlinked ÷ goal, capped at 100; success = phases completed ÷ phases', () => {
    expect(SC.scienceScore(250, 500)).toBe(50);
    expect(SC.scienceScore(900, 500)).toBe(100);
    expect(SC.missionSuccessScore(3, 4)).toBe(75);
  });

  it('total = Σ wᵢ sᵢ and the breakdown adds up', () => {
    const s = { science: 80, success: 100, budget: 100, deltaV: 50, power: 100, mass: 0, crisis: 70 };
    // 0.3·80 + 0.2·100 + 0.15·100 + 0.1·50 + 0.1·100 + 0.1·0 + 0.05·70 = 24 + 20 + 15 + 5 + 10 + 0 + 3.5 = 77.5
    const t = SC.totalScore(s);
    expect(t.total).toBeCloseTo(77.5, 9);
    expect(t.breakdown.reduce((a, b) => a + b.contribution, 0)).toBeCloseTo(77.5, 9);
  });

  it('stars are earned in order: reach science, ≥ 70% science, all margins in band', () => {
    const band = { deltaV: 0.2, power: 0.15, mass: 0.25 };
    expect(SC.stars({ reachedScience: false, scienceScore: 100, margins: band })).toBe(0);
    expect(SC.stars({ reachedScience: true, scienceScore: 60, margins: band })).toBe(1);
    expect(SC.stars({ reachedScience: true, scienceScore: 70, margins: { ...band, power: 0.5 } })).toBe(2);
    expect(SC.stars({ reachedScience: true, scienceScore: 70, margins: band })).toBe(3);
  });

  it('next-star hint: extra propellant from the rocket equation (as-flown dry mass)', () => {
    // dry 1000 kg, Isp 300 s, required 2000 m/s → 10% margin needs 2200 m/s:
    // m_prop = 1000(e^(2200/2941.995) − 1) = 1112.33 kg; current 1041.74 kg (2100 m/s) → 70.59 kg more
    const p = SC.propellantForMargin({ targetMargin: 0.1, required_ms: 2000, isp_s: 300, dry_kg: 1000, propellant_kg: 1041.74, asFlown: true });
    expect(p - 1041.74).toBeCloseTo(70.59, 0);
  });

  it('next-star hint: concept designs grow tanks and growth margin with the propellant', () => {
    // dry = 1000 + 1.3·0.12·m_prop = 1000 + 0.156·m_prop; e^(2200/2941.995) − 1 = 1.1123307
    // m_prop = 1000·1.1123307 / (1 − 0.156·1.1123307) = 1345.87 kg
    const p = SC.propellantForMargin({ targetMargin: 0.1, required_ms: 2000, isp_s: 300, dry_kg: 1000, propellant_kg: 0, asFlown: false });
    expect(p).toBeCloseTo(1345.87, 0);
  });

  it('next-star hint text checks the extra propellant against unused launch capacity', () => {
    const hint = SC.nextStarHint({
      stars: 2,
      radioLimited: false,
      scienceScore: 100,
      margins: { deltaV: 0.05, power: 0.2, mass: 0.2 },
      deltaV: { required_ms: 2000, capability_ms: 2100, isp_s: 300, dry_kg: 1000, propellant_kg: 1041.74, asFlown: true },
      launch: { capacity_kg: 2600, wet_kg: 2041.74 },
      power: { available_W: 1200, required_W: 1000, type: 'solar', arrayArea_m2: 10 },
    });
    expect(hint).toMatch(/Carry 71 kg more propellant/);
    expect(hint).toMatch(/fits/);
  });
});

// ---------------------------------------------------------------------------
describe('simulateMission', () => {
  const maven = presetDesign('maven');

  it('is reproducible for a given seed', () => {
    expect(simulateMission(maven, { seed: 11 })).toEqual(simulateMission(maven, { seed: 11 }));
  });

  it('with no bad luck every phase completes and the score is the open weighted sum', () => {
    const r = simulateMission(maven, { rng: () => 0.999999 });
    expect(r.launched).toBe(true);
    expect(r.completed).toBe(true);
    expect(r.phasesCompleted).toBe(r.totalPhases);
    expect(r.scores.success).toBe(100);
    expect(r.crisis?.reached).toBe(true);
    expect(r.crisis?.badOutcome).toBe(false);
    expect(r.score).toBeCloseTo(r.breakdown.reduce((s, b) => s + b.contribution, 0), 9);
    expect(r.stars).toBeGreaterThanOrEqual(1);
  });

  it('the crisis day falls inside its phase (timeline rule) across seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = simulateMission(maven, { seed });
      const ev = evaluateDesign(maven);
      const tl = CR.timeline({ flightDays: ev.trajectory.flightDays, scienceDays: maven.scienceDays ?? 365 });
      expect(CR.phaseOnDay(tl, r.crisis!.day)).toBe(r.crisis!.phase);
    }
  });

  it('when launch fails, nothing else happens and the hint names the phase', () => {
    const r = simulateMission(maven, { rng: () => 0 });
    expect(r.failedPhase).toBe('launch');
    expect(r.phasesCompleted).toBe(0);
    expect(r.stars).toBe(0);
    expect(r.hint).toMatch(/launch phase/);
  });

  it('a blocked design does not launch and the hint is the first blocker', () => {
    const blocked = { ...presetDesign('osiris-rex'), trajectoryOption: 'direct' as const };
    const r = simulateMission(blocked, { seed: 1 });
    expect(r.launched).toBe(false);
    expect(r.stars).toBe(0);
    expect(r.hint).toMatch(/^Fix this first: /);
  });

  it('the single-card flight Monte Carlo agrees with its own phase formula within 3σ (+ crisis chances)', () => {
    const ev = evaluateDesign(maven);
    const p = 1 - R.riskMeter(ev.details.phaseRisks).used;
    const mc = monteCarloMission(maven, { runs: 1000, seed: 5 });
    const sigma = Math.sqrt((p * (1 - p)) / 1000);
    // safe crisis choices fail at most 1% of the time, so the MC rate can sit up to ~0.01 below p
    expect(mc.successRate).toBeLessThan(p + 3 * sigma);
    expect(mc.successRate).toBeGreaterThan(p - 3 * sigma - 0.01);
    expect(mc.starsHistogram.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('evaluateDesign keeps the flight’s phase risks but no Risk meter: that is the Mission operations Monte Carlo', () => {
    const ev = evaluateDesign(maven);
    expect('risk' in ev.meters).toBe(false);
    const flight = R.riskMeter(ev.details.phaseRisks).used;
    expect(flight).toBeGreaterThan(0);
    expect(flight).toBeLessThan(1);
    expect(ev.details.phaseRisks.map((ph) => ph.phase)).toEqual(['launch', 'cruise', 'arrival', 'science']);
  });
});

describe('cadet sizing: smallest value on an input grid (bisection)', () => {
  it('x² ≥ 2 on a 0.01 grid from 0 → 1.42 (√2 = 1.41421…, rounded up to the grid)', async () => {
    const { smallestOnGrid } = await import('../src/engine/cadet');
    expect(smallestOnGrid((x) => x * x, 2, 0, 10, 0.01)).toBeCloseTo(1.42, 10);
  });
  it('ln(1 + x) ≥ 10 is out of reach on [0, 100] → undefined', async () => {
    const { smallestOnGrid } = await import('../src/engine/cadet');
    expect(smallestOnGrid((x) => Math.log(1 + x), 10, 0, 100, 1)).toBeUndefined();
  });
  it('already met at lo → lo', async () => {
    const { smallestOnGrid } = await import('../src/engine/cadet');
    expect(smallestOnGrid((x) => x, -1, 0, 10, 1)).toBe(0);
  });
});

describe('units: pound-force to newtons (Mars Climate Orbiter)', () => {
  it('1 lbf = 0.45359237 kg × 9.80665 m/s² = 4.4482216152605 N (exact by definition)', async () => {
    const { LBF_TO_N } = await import('../src/engine/rescue');
    expect(LBF_TO_N.value).toBeCloseTo(0.45359237 * 9.80665, 12);
    expect(LBF_TO_N.value).toBeCloseTo(4.4482216152605, 12);
  });
  it('an impulse logged as 1 lbf·s but read as 1 N·s is under-counted by the factor the board found (4.45)', async () => {
    const { LBF_TO_N, impulseReadAsNewtonSeconds } = await import('../src/engine/rescue');
    // true impulse 1 lbf·s = 4.448 N·s; navigation reads the bare number "1" as 1 N·s → low by 4.448×
    expect(impulseReadAsNewtonSeconds(1)).toBe(1);
    expect(LBF_TO_N.value / impulseReadAsNewtonSeconds(1)).toBeCloseTo(4.45, 2);
  });
  it('light time at MCO arrival: 196.2 million km / c = 654.45 s ≈ the press kit 10 min 56 s (656 s; distance rounded)', () => {
    const t = CM.lightDelay_s(196.2e9);
    expect(t).toBeCloseTo(654.45, 2);
    expect(Math.abs(t - 656) / 656).toBeLessThan(0.005);
  });
});

// ---------------------------------------------------------------------------
// Mission operations: geometry known in advance and hazard rates (spec: "Mission operations")
const DEG = Math.PI / 180;

describe('ops: solar conjunction geometry (Mars)', () => {
  it('the Sun–Earth–probe angle is the angle at Earth between the Sun and the craft', async () => {
    const { sunEarthProbeAngle } = await import('../src/engine/ops/predictable');
    // Earth at (1, 0, 0) AU; craft at (1, 1, 0): the craft is 90° from the Sun direction (−x) seen from Earth
    expect(sunEarthProbeAngle([1, 0, 0], [1, 1, 0])).toBeCloseTo(90, 10);
    // craft straight behind the Sun at (−1.5, 0, 0): 0°
    expect(sunEarthProbeAngle([1, 0, 0], [-1.5, 0, 0])).toBeCloseTo(0, 6);
  });

  it('each 2° window centres on heliocentric opposition (Earth and Mars longitudes 180° apart) within 1 day', async () => {
    const { bodyConjunctions } = await import('../src/engine/ops/predictable');
    const ws = bodyConjunctions('mars', E.julianDate('2015-01-01'), E.julianDate('2024-01-01'), 2);
    expect(ws.length).toBe(5); // 2015, 2017, 2019, 2021, 2023: one per synodic period (~780 days)
    const lonDiff = (jd: number) => {
      const m = E.heliocentricPosition('mars', jd);
      const e = E.heliocentricPosition('earth', jd);
      const d = (Math.atan2(m[1], m[0]) - Math.atan2(e[1], e[0])) / DEG;
      return ((d % 360) + 360) % 360;
    };
    for (const w of ws) {
      // the opposition day by bisection on λ_M − λ_E − 180° (λ_M − λ_E falls through 180° as Earth overtakes)
      let lo = w.minJd - 5;
      let hi = w.minJd + 5;
      const fLo = lonDiff(lo) > 180;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        if (lonDiff(mid) > 180 === fLo) lo = mid;
        else hi = mid;
      }
      expect(Math.abs(w.minJd - (lo + hi) / 2)).toBeLessThan(1);
      expect(w.minAngle_deg).toBeLessThan(2);
    }
  });

  it('a 2° window lasts 2ε_th/ε̇: ε ≈ r_M/(r_E + r_M)·φ with φ̇ = n_E − n_M', async () => {
    const { bodyConjunctions } = await import('../src/engine/ops/predictable');
    const [w] = bodyConjunctions('mars', E.julianDate('2015-01-01'), E.julianDate('2015-12-31'), 2);
    const rE = E.sunDistance('earth', w!.minJd);
    const rM = E.sunDistance('mars', w!.minJd);
    // n_E = 360/365.256 = 0.98561 °/day, n_M = 360/686.98 = 0.52403 °/day → φ̇ = 0.46158 °/day
    // (2015: r_M ≈ 1.52 AU, r_E ≈ 1.016 AU → ε̇ ≈ 0.600 × 0.4616 = 0.277 °/day → 2 × 2 / 0.277 ≈ 14.4 days)
    const phiDot = 360 / C.EARTH_ORBIT_PERIOD.value - 360 / DESTINATIONS.mars.orbitPeriod_days.value;
    const hand = (2 * 2) / ((rM / (rE + rM)) * phiDot);
    expect(w!.endJd - w!.startJd).toBeGreaterThan(hand - 1.5);
    expect(w!.endJd - w!.startJd).toBeLessThan(hand + 1.5);
  });

  it('inside a window the angle is below the threshold; a day outside each edge it is above', async () => {
    const { bodyConjunctions, bodySepAngle } = await import('../src/engine/ops/predictable');
    for (const w of bodyConjunctions('mars', E.julianDate('2017-01-01'), E.julianDate('2017-12-31'), 2)) {
      for (let jd = w.startJd + 0.01; jd < w.endJd; jd += 0.5) expect(bodySepAngle('mars', jd)).toBeLessThan(2);
      expect(bodySepAngle('mars', w.startJd - 1)).toBeGreaterThan(2);
      expect(bodySepAngle('mars', w.endJd + 1)).toBeGreaterThan(2);
    }
  });
});

describe('ops: light delay for commands', () => {
  it('t_arrive − t_send = d/c, with d the same distance signalDelay gives (transfer path in cruise, Mars after)', async () => {
    const { commandArrival } = await import('../src/engine/ops/commands');
    const { prepareOps } = await import('../src/engine/ops/timeline');
    const { signalDelay } = await import('../src/engine/flightMap');
    const maven = presetDesign('maven');
    const env = prepareOps(maven);
    for (const day of [10, 150, env.arrivalDay + 30, env.primeEndDay - 5]) {
      const d = env.days[day]!;
      expect(d.oneWay_s).toBeCloseTo(signalDelay(maven, day, env.ev).oneWay_s, 6);
      expect((commandArrival(env, day) - day) * 86_400).toBeCloseTo(d.earthDistance_m / 299_792_458, 6);
    }
    // Mars at its farthest: 401.4e9 m / 299,792,458 m/s = 1338.93 s
    expect(CM.lightDelay_s(401.4e9)).toBeCloseTo(1338.93, 1);
  });

  it('no command takes effect before d/c; once the craft has left Earth, never in under a second', async () => {
    const { commandArrival, oneWayAt } = await import('../src/engine/ops/commands');
    const { prepareOps } = await import('../src/engine/ops/timeline');
    const env = prepareOps(presetDesign('maven'));
    // on the launch pad d = 0, so a command arrives as it is sent
    expect(commandArrival(env, 0)).toBe(0);
    for (let t = 1; t < env.primeEndDay; t += 37.3) {
      expect(commandArrival(env, t) - t).toBeGreaterThanOrEqual(oneWayAt(env, t) / 86_400 - 1e-12);
      expect(commandArrival(env, t)).toBeGreaterThan(t + 1 / 86_400);
    }
  });
});

describe('ops: eclipses in the science orbit', () => {
  const R = 3396.2e3;
  const muM = 42_828e9;
  const rp = R + 150e3;
  const ra = R + 6300e3;

  it('Sun in the orbit plane, shadow centred on apoapsis → the Power section worst case (longestEclipse_s), 0.5%', async () => {
    const { eclipse, orbitFromVectors } = await import('../src/engine/ops/predictable');
    // periapsis points at the Sun (P̂ = ŝ), so the shadow axis (−ŝ) passes through apoapsis
    const o = orbitFromVectors(muM, R, rp, ra, [1, 0, 0], [0, 1, 0]);
    const ecl = eclipse(o, [1, 0, 0]);
    const worst = PW.longestEclipse_s(muM, R, rp, ra);
    expect(Math.abs(ecl.longest_s - worst) / worst).toBeLessThan(0.005);
    expect(ecl.fraction).toBeCloseTo(ecl.longest_s / o.period_s, 9); // one eclipse per orbit
  });

  it('orbit normal pointing at the Sun (β = 90°) → never in shadow', async () => {
    const { eclipse, orbitFromVectors } = await import('../src/engine/ops/predictable');
    const o = orbitFromVectors(muM, R, rp, ra, [1, 0, 0], [0, 1, 0]);
    expect(eclipse(o, [0, 0, 1])).toEqual({ fraction: 0, longest_s: 0 });
  });

  it('circular low orbit with the Sun in plane: shadow fraction = asin(R/r)/π (cylinder geometry)', async () => {
    const { eclipse, orbitFromVectors } = await import('../src/engine/ops/predictable');
    const r = R + 400e3;
    // half-angle of the shadow seen from the centre: asin(3396.2/3796.2) = 1.1065 rad → fraction 0.35221
    const o = orbitFromVectors(muM, R, r, r, [1, 0, 0], [0, 1, 0]);
    expect(eclipse(o, [1, 0, 0]).fraction).toBeCloseTo(Math.asin(R / r) / Math.PI, 6);
  });

  it('a fixed polar orbit at Mars has eclipse seasons whose longest eclipse falls where the Sun crosses the plane (β = 0)', async () => {
    const { prepareOps } = await import('../src/engine/ops/timeline');
    const { scienceOrbitGeometry, sunDirection } = await import('../src/engine/ops/predictable');
    const design: Design = { ...presetDesign('maven'), scienceOrbit: { periapsis_km: 2000, apoapsis_km: 2000, inclination_deg: 90 }, scienceDays: 700 };
    const env = prepareOps(design);
    const o = scienceOrbitGeometry(design, env.jdLaunch)!;
    const h: [number, number, number] = [o.P[1] * o.Q[2] - o.P[2] * o.Q[1], o.P[2] * o.Q[0] - o.P[0] * o.Q[2], o.P[0] * o.Q[1] - o.P[1] * o.Q[0]];
    const beta = (day: number) => {
      const s = sunDirection('mars', env.days[day]!.jd);
      return Math.asin(h[0] * s[0] + h[1] * s[1] + h[2] * s[2]) / DEG;
    };
    // a circular orbit at r = R + 2000 km is eclipsed while |β| < asin(R/r) = asin(3396.2/5396.2) = 39.0°
    const betaStar = Math.asin(R / (R + 2000e3)) / DEG;
    const full = env.eclipseSeasons.filter((s) => s.startDay > env.arrivalDay + 1 && s.endDay < env.primeEndDay);
    expect(full.length).toBeGreaterThan(0);
    for (const s of full) {
      let best = s.startDay;
      for (let d = s.startDay; d <= s.endDay; d++) if (Math.abs(beta(d)) < Math.abs(beta(best))) best = d;
      const longestDay = env.days.slice(s.startDay, s.endDay + 1).reduce((a, b) => (b.longestEclipse_s > a.longestEclipse_s ? b : a));
      expect(Math.abs(longestDay.day - best)).toBeLessThanOrEqual(3);
      expect(Math.abs(Math.abs(beta(s.startDay)) - betaStar)).toBeLessThan(1);
    }
  });
});

describe('ops: Mars solar longitude', () => {
  it('Ls at perihelion ≈ 251.0° + 0.0065°·(yr − 2000) (Mars24), from the IAU pole and the ephemeris, ±2°', async () => {
    const { perihelionJd, solarLongitude } = await import('../src/engine/ops/predictable');
    for (const near of ['2001-01-01', '2016-11-01', '2022-06-21']) {
      const jd = perihelionJd('mars', E.julianDate(near));
      const yr = 2000 + (jd - 2451545) / 365.25;
      expect(Math.abs(solarLongitude('mars', jd) - (251.0 + 0.0064891 * (yr - 2000)))).toBeLessThan(2);
    }
  });

  it('Ls runs fastest at perihelion: rate ratio = (r_a / r_p)² = (249.26/206.65)² = 1.455 (Kepler second law)', async () => {
    const { perihelionJd, solarLongitude } = await import('../src/engine/ops/predictable');
    const peri = perihelionJd('mars', E.julianDate('2022-06-21'));
    const rate = (jd: number) => (solarLongitude('mars', jd + 1) - solarLongitude('mars', jd) + 360) % 360;
    const aphelion = peri + DESTINATIONS.mars.orbitPeriod_days.value / 2;
    expect(rate(peri) / rate(aphelion)).toBeCloseTo((249.26 / 206.65) ** 2, 1);
  });
});

describe('ops: hazard rates', () => {
  it('solar activity is 0 at the published minima and 1 at the maxima, and repeats every 11 years', async () => {
    const { solarActivity } = await import('../src/engine/ops/random');
    expect(solarActivity(E.julianDate('2008-12-01'))).toBeCloseTo(0, 12);
    expect(solarActivity(E.julianDate('2014-04-01'))).toBeCloseTo(1, 12);
    expect(solarActivity(E.julianDate('2019-12-01'))).toBeCloseTo(0, 12);
    expect(solarActivity(E.julianDate('2024-10-01'))).toBeCloseTo(1, 12);
    const L = 11 * 365.25;
    expect(solarActivity(E.julianDate('2024-10-01') + L)).toBeCloseTo(1, 12);
    expect(solarActivity(E.julianDate('2014-04-01') - L)).toBeCloseTo(1, 12);
  });

  it('mean storm rate over a cycle at 1 AU = NOAA S3 + S4 count / cycle length (13 / 4017.75 days)', async () => {
    const { stormRate_perDay } = await import('../src/engine/ops/random');
    const L = 11 * 365.25;
    const jd0 = E.julianDate('2019-12-01');
    let sum = 0;
    const n = 20_000;
    for (let k = 0; k < n; k++) sum += stormRate_perDay(jd0 + ((k + 0.5) * L) / n, C.AU_M);
    // each (1 ∓ cos)/2 half averages 1/2, so mean λ = λ_max(1 + ρ)/2 = N/L = 13 / 4017.75 = 3.2357e-3 per day
    expect(sum / n).toBeCloseTo(13 / L, 7);
  });

  it('storm rate falls as (1 AU / r)²: at 1.524 AU it is 1/1.524² = 0.4306× the rate at 1 AU', async () => {
    const { stormRate_perDay } = await import('../src/engine/ops/random');
    const jd = E.julianDate('2024-10-01');
    expect(stormRate_perDay(jd, 1.524 * C.AU_M) / stormRate_perDay(jd, C.AU_M)).toBeCloseTo(1 / 1.524 ** 2, 10);
  });

  it('Mars dust: zero outside Ls 180–360°, and one storm per 3 Mars years on average', async () => {
    const { dustStormRate_perDay, dustSeasonDays } = await import('../src/engine/ops/random');
    expect(dustStormRate_perDay(90)).toBe(0);
    expect(dustStormRate_perDay(251)).toBeGreaterThan(0);
    // southern spring + summer is the short half of the Mars year (the perihelion season)
    const T = DESTINATIONS.mars.orbitPeriod_days.value;
    expect(dustSeasonDays()).toBeLessThan(T / 2);
    expect(dustSeasonDays()).toBeGreaterThan(0.4 * T);
    // rate × season length = 1/3 storm per Mars year
    expect(dustStormRate_perDay(251) * dustSeasonDays()).toBeCloseTo(1 / 3, 6);
  });

  it('reaction wheel hazard: Weibull h(t) = (β/η)(t/η)^(β−1) rises with age (β = 2, η = 15 y)', async () => {
    const { wheelHazard_perYear } = await import('../src/engine/ops/random');
    // at t = η: h = β/η = 2/15 = 0.13333 per year; at t = η/2: (2/15)(1/2) = 0.06667
    expect(wheelHazard_perYear(15)).toBeCloseTo(2 / 15, 12);
    expect(wheelHazard_perYear(7.5)).toBeCloseTo(1 / 15, 12);
    expect(wheelHazard_perYear(0)).toBe(0);
  });

  it('memory upsets rise with a solar storm (×6), the dose rate, and a cold day (×2)', async () => {
    const { memoryRate_perDay } = await import('../src/engine/ops/random');
    const base = memoryRate_perDay({ stormActive: false, doseRate_radPerDay: 0, cold: false });
    // 0.2 per year / 365.25 = 5.4757e-4 per day
    expect(base).toBeCloseTo(0.2 / 365.25, 12);
    expect(memoryRate_perDay({ stormActive: true, doseRate_radPerDay: 0, cold: false }) / base).toBeCloseTo(6, 12);
    expect(memoryRate_perDay({ stormActive: false, doseRate_radPerDay: 0, cold: true }) / base).toBeCloseTo(2, 12);
  });

  it('orbit-insertion anomaly chance = BASE_RISK.arrival × f(Δv margin): 0.04 at 10%+, 0.08 at 5%', async () => {
    const { insertionAnomalyChance } = await import('../src/engine/ops/random');
    // f(5%) = 1 + (3 − 1)(0.10 − 0.05)/0.10 = 2 → 0.04 × 2 = 0.08
    expect(insertionAnomalyChance(0.2)).toBeCloseTo(0.04, 12);
    expect(insertionAnomalyChance(0.05)).toBeCloseTo(0.08, 12);
    expect(insertionAnomalyChance(-0.01)).toBe(1);
  });

  it('thinning: mean accepted count over 2,000 seeds = ∫λ dt within 3σ (storms over one cycle at 1 AU)', async () => {
    const { drawCandidates, stormRate_perDay, stormRateMax_perDay, subRng, thin } = await import('../src/engine/ops/random');
    const L = 11 * 365.25;
    const jd0 = E.julianDate('2019-12-01');
    const bound = stormRateMax_perDay();
    let total = 0;
    const seeds = 2000;
    for (let s = 1; s <= seeds; s++) {
      const c = drawCandidates(subRng(s, 'solar-storm'), bound, L);
      total += thin(c, (t) => stormRate_perDay(jd0 + t, C.AU_M), bound).length;
    }
    // ∫λ dt over a cycle = 13; Poisson σ of the mean = sqrt(13/2000) = 0.0806
    expect(Math.abs(total / seeds - 13)).toBeLessThan(3 * Math.sqrt(13 / seeds));
  });

  it('separate streams: the same seed and name repeat; different names differ', async () => {
    const { subRng } = await import('../src/engine/ops/random');
    const a = subRng(7, 'solar-storm');
    const b = subRng(7, 'solar-storm');
    const c = subRng(7, 'reaction-wheel');
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect([c(), c(), c()]).not.toEqual(xs);
  });
});

describe('ops: Jupiter radiation dose (game estimates)', () => {
  it('power law: Ḋ(2 r_ref) = Ḋ_ref·2^−k inside the belts, 0 outside', async () => {
    const { radiationDoseRate_radPerHour } = await import('../src/engine/ops/predictable');
    const rad = DESTINATIONS.jupiter.radiation!;
    const RJ = DESTINATIONS.jupiter.radius_km.value * 1000;
    // at r = 2 R_J with r_ref = 1 R_J, k = 3: 200 × (1/2)³ = 25 rad/h
    expect(radiationDoseRate_radPerHour('jupiter', 2 * RJ)).toBeCloseTo(rad.doseRateRef_radPerHour.value * 0.5 ** rad.exponent.value, 9);
    expect(radiationDoseRate_radPerHour('jupiter', 5 * RJ)).toBe(0);
    expect(radiationDoseRate_radPerHour('mars', 1e6)).toBe(0);
  });

  it('a circular orbit gives a constant dose rate: 2 R_J → 25 rad/h × 24 = 600 rad/day', async () => {
    const { orbitDoseRate_radPerDay, orbitFromVectors } = await import('../src/engine/ops/predictable');
    const RJ = DESTINATIONS.jupiter.radius_km.value * 1000;
    const o = orbitFromVectors(126_686_534e9, RJ, 2 * RJ, 2 * RJ, [1, 0, 0], [0, 1, 0]);
    expect(orbitDoseRate_radPerDay('jupiter', o)).toBeCloseTo(600, 6);
  });
});

describe('ops: resources', () => {
  it('fault protection keeps the bus, then heaters, then radio; instruments are shed first', async () => {
    const { shedLoads } = await import('../src/engine/ops/resources');
    const want = { bus: 400, heaters: 160, instruments: 120, radio: 286 };
    // 900 W: bus 400 → heaters 160 → radio 286 (= 846) → instruments get the last 54 W
    expect(shedLoads(900, want)).toEqual({ bus: 400, heaters: 160, radio: 286, instruments: 54 });
    // 500 W: bus 400 → heaters 100 → nothing left for radio or instruments
    expect(shedLoads(500, want)).toEqual({ bus: 400, heaters: 100, radio: 0, instruments: 0 });
    // 300 W: the bus itself is short (a brownout)
    expect(shedLoads(300, want)).toEqual({ bus: 300, heaters: 0, radio: 0, instruments: 0 });
  });

  it('DSN aperture fee AF = R_B[A_W(0.9 + F_C/10)]: 34 m $1691.2/h, 70 m $6764.8/h; a day = (8 + 1) h', async () => {
    const { apertureFee_perHour, dsnDayCost_M, dsnExtraCost_M } = await import('../src/engine/ops/resources');
    // 1057 × 1 × (0.9 + 7/10) = 1057 × 1.6 = 1691.2; × 4 = 6764.8
    expect(apertureFee_perHour(34)).toBeCloseTo(1691.2, 9);
    expect(apertureFee_perHour(70)).toBeCloseTo(6764.8, 9);
    // 8 h pass + 1 h set-up and tear-down: 9 × 1691.2 = $15,220.8 = 0.0152208 $M
    expect(dsnDayCost_M({ dish: 34, hours: 8 })).toBeCloseTo(0.0152208, 12);
    // upgrade to 70 m: 9 × 6764.8 − 15,220.8 = 60,883.2 − 15,220.8 = $45,662.4
    expect(dsnExtraCost_M({ dish: 70, hours: 8 }, { dish: 34, hours: 8 })).toBeCloseTo(0.0456624, 12);
    // fewer hours than the default pass is not a refund
    expect(dsnExtraCost_M({ dish: 34, hours: 4 }, { dish: 34, hours: 8 })).toBe(0);
  });

  it('downlink capacity = link rate × booked hours; 70 m / 34 m = 10^(6.31/10) = 4.2756; zero in a conjunction', async () => {
    const { downlinkCapacity_bitsPerDay } = await import('../src/engine/ops/resources');
    const { prepareOps } = await import('../src/engine/ops/timeline');
    const maven = presetDesign('maven');
    const env = prepareOps(maven);
    const day = env.days[env.arrivalDay + 40]!;
    // the same value simulateMission uses for that date: dataPerDay_bits(dataRate(...)) with an 8-hour pass
    const same = CM.dataPerDay_bits(CM.dataRate({ ...maven.comms, distance_m: E.earthDistance('mars', day.jd) }));
    expect(downlinkCapacity_bitsPerDay(day, { dish: maven.comms.groundDish_m, hours: 8 })).toBeCloseTo(same, 0);
    expect(downlinkCapacity_bitsPerDay(day, { dish: 70, hours: 8 }) / downlinkCapacity_bitsPerDay(day, { dish: 34, hours: 8 })).toBeCloseTo(4.2756, 4);
    const conj = env.days[env.conjunctions[0]!.minDay]!;
    expect(downlinkCapacity_bitsPerDay(conj, { dish: 70, hours: 8 })).toBe(0);
  });

  it('the default plan asks for what the Power meter needs (bus + instruments + radio + heaters), within 0.5%', async () => {
    const { demand, defaultPowerPlan } = await import('../src/engine/ops/resources');
    const { prepareOps } = await import('../src/engine/ops/timeline');
    const env = prepareOps(presetDesign('maven'));
    const d = demand(env, env.days[env.arrivalDay]!, defaultPowerPlan(env), { scienceOn: true });
    // the meter uses the fractional arrival date; the ledger uses the whole arrival day (heaters move slightly)
    const need = env.ev.details.power.required_W;
    expect(Math.abs(d.bus + d.heaters + d.instruments + d.radio - need) / need).toBeLessThan(0.005);
  });

  it('with no bad luck, the Δv left after the prime mission = capability − (required − lifetime reserve)', async () => {
    const { runOperations } = await import('../src/engine/ops/index');
    const maven = presetDesign('maven');
    const r = runOperations(maven, { rng: () => 0.999999 });
    const d = evaluateDesign(maven).details;
    // Δv adds up across burns: Isp g₀ ln(m0/m1) + Isp g₀ ln(m1/m2) = Isp g₀ ln(m0/m2)
    expect(r.state.hazards).toEqual([]);
    expect(r.debrief.deltaV.left_ms).toBeCloseTo(d.deltaVCapability_ms - (d.deltaVRequired_ms - d.deltaVBudget.lifetimeReserve_ms), 6);
  });
});
