// Events computed from geometry and shown to the player in advance (spec: Mission operations, "Events known in
// advance"): solar conjunction (Sun–Earth–probe angle), eclipse seasons in the science orbit, Mars solar
// longitude (dust-storm season) and the Jupiter radiation dose.
import { km, mu as muSI, OBLIQUITY_J2000 } from '../constants';
import { DESTINATIONS, OPERATIONS } from '../data';
import { elementsAt, heliocentricPosition, heliocentricVelocity, solveKepler, type Body } from '../ephemeris';
import type { DestinationId, Design, Vec3 } from '../types';
import { cross, dot, norm, scale, sub } from '../vec';

const DEG = Math.PI / 180;
const J2000 = 2451545.0;
const unit = (v: Vec3): Vec3 => scale(v, 1 / norm(v));
const wrap360 = (x: number) => ((x % 360) + 360) % 360;

// ---------------------------------------------------------------------------
// Solar conjunction

/** Sun–Earth–probe angle (deg): cos ε = (−r_E)·(r_c − r_E) / (|r_E||r_c − r_E|). Heliocentric positions. */
export function sunEarthProbeAngle(rEarth: Vec3, rCraft: Vec3): number {
  const toSun = scale(rEarth, -1);
  const toCraft = sub(rCraft, rEarth);
  const c = dot(toSun, toCraft) / (norm(toSun) * norm(toCraft));
  return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
}

/** Sun–Earth–body angle on a Julian date (deg). */
export function bodySepAngle(body: Exclude<Body, 'moon' | 'earth'>, jd: number): number {
  return sunEarthProbeAngle(heliocentricPosition('earth', jd), heliocentricPosition(body, jd));
}

export interface ConjunctionJd {
  startJd: number;
  endJd: number;
  minJd: number;
  minAngle_deg: number;
}

function bisect(f: (x: number) => boolean, lo: number, hi: number, iterations = 40): number {
  // f(lo) !== f(hi); returns the switch point.
  const flo = f(lo);
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) === flo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Golden-section minimum of f on [lo, hi]. */
function goldenMin(f: (x: number) => number, lo: number, hi: number, iterations = 60): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  for (let i = 0; i < iterations; i++) {
    if (f(c) < f(d)) b = d;
    else a = c;
    c = b - g * (b - a);
    d = a + g * (b - a);
  }
  return (a + b) / 2;
}

/**
 * Windows when a body is within the threshold of the Sun as seen from Earth (the commanding moratorium).
 * Scans daily, then refines both edges by bisection and the minimum by golden section.
 */
export function bodyConjunctions(
  body: Exclude<Body, 'moon' | 'earth'>,
  jdFrom: number,
  jdTo: number,
  threshold_deg = OPERATIONS.conjunction.commandThreshold_deg.value,
): ConjunctionJd[] {
  const angle = (jd: number) => bodySepAngle(body, jd);
  const inside = (jd: number) => angle(jd) < threshold_deg;
  const out: ConjunctionJd[] = [];
  let startDay: number | undefined;
  for (let jd = jdFrom; jd <= jdTo + 1; jd += 1) {
    const now = inside(jd);
    if (now && startDay === undefined) startDay = jd;
    if (!now && startDay !== undefined) {
      const startJd = startDay > jdFrom ? bisect(inside, startDay - 1, startDay) : startDay;
      const endJd = bisect(inside, jd - 1, jd);
      const minJd = goldenMin(angle, startJd, endJd);
      out.push({ startJd, endJd, minJd, minAngle_deg: angle(minJd) });
      startDay = undefined;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Planet orientation (IAU pole) and the science orbit in the ecliptic frame

/** J2000 equatorial → J2000 ecliptic: rotate about x by the obliquity ε₀. */
export function equatorialToEcliptic(v: Vec3): Vec3 {
  const e = OBLIQUITY_J2000.value * DEG;
  return [v[0], v[1] * Math.cos(e) + v[2] * Math.sin(e), -v[1] * Math.sin(e) + v[2] * Math.cos(e)];
}

/** The planet's equatorial frame (X = IAU node at α₀ + 90°, Z = north pole) as ecliptic unit vectors. */
export function planetFrame(dest: DestinationId, jd: number): { X: Vec3; Y: Vec3; Z: Vec3 } {
  const d = DESTINATIONS[dest];
  if (!d.poleRA_deg || !d.poleDec_deg) {
    // No pole data (Bennu): use the ecliptic frame.
    return { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
  }
  const T = (jd - J2000) / 36525;
  const a = (d.poleRA_deg.value[0] + d.poleRA_deg.value[1] * T) * DEG;
  const de = (d.poleDec_deg.value[0] + d.poleDec_deg.value[1] * T) * DEG;
  const Zq: Vec3 = [Math.cos(de) * Math.cos(a), Math.cos(de) * Math.sin(a), Math.sin(de)];
  const Xq: Vec3 = [-Math.sin(a), Math.cos(a), 0];
  const Z = equatorialToEcliptic(Zq);
  const X = equatorialToEcliptic(Xq);
  return { X, Y: cross(Z, X), Z };
}

/** A closed orbit about a body, fixed in inertial space: periapsis direction P̂ and in-plane normal Q̂ (ecliptic). */
export interface OrbitGeometry {
  mu: number;
  bodyRadius: number;
  a: number;
  e: number;
  /** Mean motion (rad/s) and period (s). */
  n: number;
  period_s: number;
  P: Vec3;
  Q: Vec3;
}

export function orbitFromVectors(mu: number, bodyRadius: number, rp: number, ra: number, P: Vec3, Q: Vec3): OrbitGeometry {
  const a = (rp + ra) / 2;
  const n = Math.sqrt(mu / a ** 3);
  return { mu, bodyRadius, a, e: (ra - rp) / (ra + rp), n, period_s: (2 * Math.PI) / n, P: unit(P), Q: unit(Q) };
}

/** The design's science orbit (altitudes → radii), oriented from the planet's equator (defaults: operations.json). */
export function scienceOrbitGeometry(design: Design, jd: number): OrbitGeometry | undefined {
  const dest = DESTINATIONS[design.destination];
  if (dest.missionType !== 'orbiter') return undefined;
  const o = design.scienceOrbit ?? design.captureOrbit;
  const def = OPERATIONS.orbitDefaults;
  const i = ((design.scienceOrbit?.inclination_deg ?? def.inclination_deg.value) * DEG);
  const Om = ((design.scienceOrbit?.raan_deg ?? def.raan_deg.value) * DEG);
  const w = ((design.scienceOrbit?.argPeriapsis_deg ?? def.argPeriapsis_deg.value) * DEG);
  // Perifocal axes in the planet's equatorial frame.
  const Pp: Vec3 = [
    Math.cos(Om) * Math.cos(w) - Math.sin(Om) * Math.sin(w) * Math.cos(i),
    Math.sin(Om) * Math.cos(w) + Math.cos(Om) * Math.sin(w) * Math.cos(i),
    Math.sin(w) * Math.sin(i),
  ];
  const Qp: Vec3 = [
    -Math.cos(Om) * Math.sin(w) - Math.sin(Om) * Math.cos(w) * Math.cos(i),
    -Math.sin(Om) * Math.sin(w) + Math.cos(Om) * Math.cos(w) * Math.cos(i),
    Math.cos(w) * Math.sin(i),
  ];
  const f = planetFrame(design.destination, jd);
  const toEcl = (v: Vec3): Vec3 => [
    v[0] * f.X[0] + v[1] * f.Y[0] + v[2] * f.Z[0],
    v[0] * f.X[1] + v[1] * f.Y[1] + v[2] * f.Z[1],
    v[0] * f.X[2] + v[1] * f.Y[2] + v[2] * f.Z[2],
  ];
  const R = km(dest.radius_km.value);
  return orbitFromVectors(muSI(dest.gm_km3s2.value), R, R + km(o.periapsis_km), R + km(o.apoapsis_km), toEcl(Pp), toEcl(Qp));
}

/** Body-centred position at mean anomaly M (Kepler's equation). */
export function orbitPosition(o: OrbitGeometry, M: number): Vec3 {
  const E = solveKepler(M, o.e);
  const x = o.a * (Math.cos(E) - o.e);
  const y = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
  return [o.P[0] * x + o.Q[0] * y, o.P[1] * x + o.Q[1] * y, o.P[2] * x + o.Q[2] * y];
}

// ---------------------------------------------------------------------------
// Eclipses (cylindrical shadow)

/** In the cylindrical shadow: behind the body (r·ŝ < 0) and closer to the shadow axis than the body radius. */
export function inShadow(r: Vec3, sunDir: Vec3, bodyRadius: number): boolean {
  const along = dot(r, sunDir);
  if (along >= 0) return false;
  return norm(sub(r, scale(sunDir, along))) < bodyRadius;
}

/**
 * Eclipse in one orbit for a fixed Sun direction: the fraction of the orbit in shadow and the longest single
 * eclipse (s). The orbit is sampled at n mean anomalies, then each shadow edge is refined by bisection in mean
 * anomaly (time is proportional to mean anomaly).
 */
export function eclipse(o: OrbitGeometry, sunDir: Vec3, n = 360): { fraction: number; longest_s: number } {
  const s = unit(sunDir);
  const shadow = (M: number) => inShadow(orbitPosition(o, M), s, o.bodyRadius);
  const step = (2 * Math.PI) / n;
  const flags = Array.from({ length: n }, (_, k) => shadow(k * step));
  if (!flags.some(Boolean)) return { fraction: 0, longest_s: 0 };
  if (flags.every(Boolean)) return { fraction: 1, longest_s: o.period_s };
  const at = (k: number) => flags[((k % n) + n) % n]!;
  let total = 0;
  let longest = 0;
  for (let k = 0; k < n; k++) {
    if (!(at(k) && !at(k - 1))) continue; // an entry between samples k−1 and k
    const entry = bisect(shadow, (k - 1) * step, k * step);
    let j = k + 1;
    while (at(j)) j++;
    const exit = bisect(shadow, (j - 1) * step, j * step);
    const len = exit - entry;
    total += len;
    longest = Math.max(longest, len);
  }
  return { fraction: total / (2 * Math.PI), longest_s: longest / o.n };
}

/** Sun direction seen from a destination: ŝ = −r_planet/|r_planet| (the Moon sits at Earth's position). */
export function sunDirection(dest: DestinationId, jd: number): Vec3 {
  return unit(scale(heliocentricPosition(dest, jd), -1));
}

// ---------------------------------------------------------------------------
// Mars solar longitude (dust-storm season)

/**
 * Areocentric solar longitude Ls (deg) from the IAU pole and the ephemeris. The northern spring equinox
 * direction is ê = p̂ × ĥ (ĥ: orbit normal), and Ls = atan2((ĥ × ê)·ŝ, ê·ŝ) with ŝ the Sun direction.
 */
export function solarLongitude(body: 'mars', jd: number): number {
  const r = heliocentricPosition(body, jd);
  const h = unit(cross(r, heliocentricVelocity(body, jd)));
  const p = planetFrame(body, jd).Z;
  const e = unit(cross(p, h));
  const s = unit(scale(r, -1));
  return wrap360(Math.atan2(dot(cross(h, e), s), dot(e, s)) / DEG);
}

/** Julian date of the body's perihelion passage nearest to jd (mean anomaly = 0), by Newton steps. */
export function perihelionJd(body: Exclude<Body, 'moon'>, nearJd: number): number {
  let jd = nearJd;
  for (let i = 0; i < 20; i++) {
    const M = elementsAt(body, jd).M;
    const Mw = Math.atan2(Math.sin(M), Math.cos(M));
    const rate = (elementsAt(body, jd + 1).M - M) || 1e-9; // rad/day
    jd -= Mw / rate;
  }
  return jd;
}

// ---------------------------------------------------------------------------
// Jupiter radiation dose (game estimates, to verify)

/** Dose rate behind the vault at distance r from the planet's centre (rad/h): Ḋ_ref (r_ref/r)^k inside the belts. */
export function radiationDoseRate_radPerHour(dest: DestinationId, r_m: number): number {
  const rad = DESTINATIONS[dest].radiation;
  if (!rad) return 0;
  const R = km(DESTINATIONS[dest].radius_km.value);
  if (r_m >= rad.beltOuter_radii.value * R) return 0;
  return rad.doseRateRef_radPerHour.value * ((rad.refRadius_radii.value * R) / r_m) ** rad.exponent.value;
}

/** Orbit-averaged dose per day (rad/day): the mean over equal steps in mean anomaly (equal steps in time). */
export function orbitDoseRate_radPerDay(dest: DestinationId, o: OrbitGeometry, n = 720): number {
  if (!DESTINATIONS[dest].radiation) return 0;
  let sum = 0;
  for (let k = 0; k < n; k++) sum += radiationDoseRate_radPerHour(dest, norm(orbitPosition(o, (2 * Math.PI * k) / n)));
  return (sum / n) * 24;
}

/** ISO date (YYYY-MM-DD) of a Julian date. */
export function isoDate(jd: number): string {
  return new Date((jd - 2440587.5) * 86_400_000).toISOString().slice(0, 10);
}
