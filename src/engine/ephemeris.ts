// JPL "Approximate Positions of the Planets" (Table 1, 1800–2050 AD) → heliocentric position on a date.
// Bennu uses its JPL SBDB osculating elements propagated as a two-body orbit.
// Output frame: J2000 ecliptic, metres and m/s. Runs offline, no API call.
import { AU_M, EARTH_ORBIT_PERIOD, km, MU_SUN_SI } from './constants';
import {
  DESTINATIONS,
  ORBITAL_ELEMENTS,
  type EphemerisBody,
  type JplApproxElements,
  type OsculatingElements,
} from './data';
import type { DestinationId, Vec3 } from './types';

const DEG = Math.PI / 180;
const J2000 = 2451545.0;
const JULIAN_CENTURY_DAYS = 36525;

/** Julian date from an ISO date string (UTC; the ~69 s TDB−UTC offset is ignored). */
export function julianDate(iso: string): number {
  const ms = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${iso}`);
  return ms / 86_400_000 + 2440587.5;
}

/** Wrap an angle to [−π, π]. */
function wrapPi(x: number): number {
  const twoPi = 2 * Math.PI;
  return x - twoPi * Math.floor((x + Math.PI) / twoPi);
}

/** Solve Kepler's equation M = E − e sin E for E (elliptic orbits, e < 1). Newton's method. */
export function solveKepler(M: number, e: number): number {
  const Mw = wrapPi(M);
  let E = e < 0.8 ? Mw : Math.PI * Math.sign(Mw || 1);
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - Mw) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-14) break;
  }
  return E + (M - Mw);
}

/** Classical elements (SI, radians) for one instant. */
export interface Elements {
  a: number; // m
  e: number;
  i: number; // rad
  Omega: number; // rad, longitude of ascending node
  omega: number; // rad, argument of perihelion
  M: number; // rad, mean anomaly
}

function jplElements(el: JplApproxElements, jd: number): Elements {
  const T = (jd - J2000) / JULIAN_CENTURY_DAYS;
  const at = (x: [number, number]) => x[0] + x[1] * T;
  const varpi = at(el.varpi) * DEG;
  const Omega = at(el.Omega) * DEG;
  return {
    a: at(el.a) * AU_M,
    e: at(el.e),
    i: at(el.I) * DEG,
    Omega,
    omega: varpi - Omega,
    M: at(el.L) * DEG - varpi,
  };
}

function osculatingElements(el: OsculatingElements, jd: number): Elements {
  return {
    a: el.a * AU_M,
    e: el.e,
    i: el.i * DEG,
    Omega: el.om * DEG,
    omega: el.w * DEG,
    M: (el.ma + el.n * (jd - el.epochJD)) * DEG,
  };
}

export function elementsAt(body: EphemerisBody, jd: number): Elements {
  const el = ORBITAL_ELEMENTS[body].value;
  return el.kind === 'jpl-approx' ? jplElements(el, jd) : osculatingElements(el, jd);
}

/** Rotate orbital-plane coordinates (x', y') into the J2000 ecliptic frame. */
function toEcliptic(el: Elements, xp: number, yp: number): Vec3 {
  const cw = Math.cos(el.omega);
  const sw = Math.sin(el.omega);
  const cO = Math.cos(el.Omega);
  const sO = Math.sin(el.Omega);
  const ci = Math.cos(el.i);
  const si = Math.sin(el.i);
  return [
    (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

/** Position and velocity from elements (two-body, Sun-centred). */
export function stateFromElements(el: Elements, mu = MU_SUN_SI): { r: Vec3; v: Vec3 } {
  const E = solveKepler(el.M, el.e);
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  const n = Math.sqrt(mu / el.a ** 3);
  const Edot = n / (1 - el.e * Math.cos(E));
  const r = toEcliptic(el, el.a * (Math.cos(E) - el.e), b * Math.sin(E));
  const v = toEcliptic(el, -el.a * Math.sin(E) * Edot, b * Math.cos(E) * Edot);
  return { r, v };
}

/** Bodies the ephemeris can place. The Moon is Earth-centred and sits at Earth's heliocentric position. */
export type Body = EphemerisBody | DestinationId;

const ephemerisBody = (body: Body): EphemerisBody => (body === 'moon' ? 'earth' : body);

/** Heliocentric J2000-ecliptic position in metres. */
export function heliocentricPosition(body: Body, jd: number): Vec3 {
  return stateFromElements(elementsAt(ephemerisBody(body), jd)).r;
}

/** Heliocentric J2000-ecliptic velocity in m/s. */
export function heliocentricVelocity(body: Body, jd: number): Vec3 {
  return stateFromElements(elementsAt(ephemerisBody(body), jd)).v;
}

/** Distance from the Sun in metres. */
export function sunDistance(body: Body, jd: number): number {
  return Math.hypot(...heliocentricPosition(body, jd));
}

/** Distance from Earth in metres. For the Moon this is its mean distance (Destinations table). */
export function earthDistance(body: Body, jd: number): number {
  if (body === 'moon') return km(DESTINATIONS.moon.earthDistance_1e6km!.value * 1e6);
  const p = heliocentricPosition(body, jd);
  const e = heliocentricPosition('earth', jd);
  return Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]);
}

/** Time between launch windows: S = 1 / |1/T_Earth − 1/T_planet| (same units as the inputs). */
export function synodicPeriod(tEarth: number, tPlanet: number): number {
  return 1 / Math.abs(1 / tEarth - 1 / tPlanet);
}

/** Synodic period of a destination in days, from the sourced orbit periods. */
export function synodicPeriodDays(dest: Exclude<DestinationId, 'moon'>): number {
  return synodicPeriod(EARTH_ORBIT_PERIOD.value, DESTINATIONS[dest].orbitPeriod_days.value);
}
