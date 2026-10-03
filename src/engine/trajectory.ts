// Spec section: "Trajectory model". Patched conics: Hohmann (Cadet), Lambert (Engineer), capture burn.
// All inputs and outputs in SI (m, s, m/s); C3 is reported in km²/s² as the launch industry quotes it.
import { AU_M, days, GAME_RULES, km, mu as muSI, MU_EARTH_SI, MU_SUN_SI, R_EARTH_M, toDays } from './constants';
import { DESTINATIONS } from './data';
import { elementsAt, heliocentricPosition, heliocentricVelocity, julianDate, stateFromElements, type Elements } from './ephemeris';
import type { Design, DestinationId, Sourced, Vec3 } from './types';
import { cross, dot, norm, scale, sub } from './vec';

export interface HohmannResult {
  a_m: number;
  tFlight_s: number;
  vInfDep_ms: number;
  vInfArr_ms: number;
  c3_km2s2: number;
}

/**
 * Hohmann transfer between circular orbits r1 and r2:
 * a_t = (r1+r2)/2, t = π√(a_t³/μ), v∞dep = |√(μ(2/r1−1/a_t)) − √(μ/r1)|, C3 = v∞dep²,
 * v∞arr = |√(μ/r2) − √(μ(2/r2−1/a_t))|
 */
export function hohmann(r1: number, r2: number, mu: number): HohmannResult {
  const a = (r1 + r2) / 2;
  const tFlight_s = Math.PI * Math.sqrt(a ** 3 / mu);
  const vInfDep_ms = Math.abs(Math.sqrt(mu * (2 / r1 - 1 / a)) - Math.sqrt(mu / r1));
  const vInfArr_ms = Math.abs(Math.sqrt(mu / r2) - Math.sqrt(mu * (2 / r2 - 1 / a)));
  return { a_m: a, tFlight_s, vInfDep_ms, vInfArr_ms, c3_km2s2: (vInfDep_ms / 1000) ** 2 };
}

/** Hohmann phase rule: the target must lead Earth by θ = 180° − n_target·t_flight. */
export function phaseAngleDeg(tFlight_s: number, targetPeriod_s: number): number {
  return 180 - (360 / targetPeriod_s) * tFlight_s;
}

/** Capture burn: Δv = √(v∞² + 2μ/rp) − √(μ(2/rp − 2/(rp+ra))). Radii from the body centre. */
export function captureDeltaV(vInf_ms: number, mu: number, rp: number, ra: number): number {
  return Math.sqrt(vInf_ms ** 2 + (2 * mu) / rp) - Math.sqrt(mu * (2 / rp - 2 / (rp + ra)));
}

/** Speed on an orbit with apsides rp, ra at radius r (vis-viva): v = √(μ(2/r − 2/(rp + ra))). */
function visViva(mu: number, r: number, rp: number, ra: number): number {
  return Math.sqrt(mu * (2 / r - 2 / (rp + ra)));
}

/**
 * Two-burn coplanar change from orbit (rp₁, ra₁) to (rp₂, ra₂), each burn at an apsis, using vis-viva.
 * Order A: at periapsis set the new apoapsis, then at that apoapsis set the new periapsis.
 * Order B: at apoapsis set the new periapsis, then at that periapsis set the new apoapsis. Returns the cheaper.
 */
export function orbitChangeDeltaV(
  mu: number,
  from: { rp: number; ra: number },
  to: { rp: number; ra: number },
): number {
  const a1 = Math.abs(visViva(mu, from.rp, from.rp, to.ra) - visViva(mu, from.rp, from.rp, from.ra));
  const a2 = Math.abs(visViva(mu, to.ra, to.rp, to.ra) - visViva(mu, to.ra, from.rp, to.ra));
  const b1 = Math.abs(visViva(mu, from.ra, to.rp, from.ra) - visViva(mu, from.ra, from.rp, from.ra));
  const b2 = Math.abs(visViva(mu, to.rp, to.rp, to.ra) - visViva(mu, to.rp, to.rp, from.ra));
  return Math.min(a1 + a2, b1 + b2);
}

// ---------------------------------------------------------------------------
// Lambert's problem — universal variables (Curtis, Orbital Mechanics for Engineering Students, Alg. 5.2)

function stumpffC(z: number): number {
  if (z > 1e-8) return (1 - Math.cos(Math.sqrt(z))) / z;
  if (z < -1e-8) return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
  return 1 / 2 - z / 24;
}

function stumpffS(z: number): number {
  if (z > 1e-8) {
    const s = Math.sqrt(z);
    return (s - Math.sin(s)) / s ** 3;
  }
  if (z < -1e-8) {
    const s = Math.sqrt(-z);
    return (Math.sinh(s) - s) / s ** 3;
  }
  return 1 / 6 - z / 120;
}

/**
 * Zero-revolution Lambert solver: the velocities at r1 and r2 for a transfer taking tof seconds.
 * Solves F(z) = 0 by bisection, which is robust because F rises monotonically in z for 0-rev transfers.
 */
export function lambert(r1v: Vec3, r2v: Vec3, tof: number, mu: number, prograde = true): { v1: Vec3; v2: Vec3 } {
  const r1 = norm(r1v);
  const r2 = norm(r2v);
  const cosDTheta = Math.min(1, Math.max(-1, dot(r1v, r2v) / (r1 * r2)));
  let dTheta = Math.acos(cosDTheta);
  const cz = cross(r1v, r2v)[2];
  if (prograde ? cz < 0 : cz >= 0) dTheta = 2 * Math.PI - dTheta;

  const A = Math.sin(dTheta) * Math.sqrt((r1 * r2) / (1 - Math.cos(dTheta)));
  if (!Number.isFinite(A) || A === 0) throw new Error('Lambert: transfer angle of 0° or 360° is undefined');

  const y = (z: number) => r1 + r2 + (A * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z));
  const sqrtMuT = Math.sqrt(mu) * tof;
  const F = (z: number) => {
    const yz = y(z);
    if (yz < 0) return -sqrtMuT; // y < 0 lies below every root (see Curtis §5.3)
    return (yz / stumpffC(z)) ** 1.5 * stumpffS(z) + A * Math.sqrt(yz) - sqrtMuT;
  };

  let hi = 4 * Math.PI ** 2 * (1 - 1e-12); // F → +∞ as z → 4π²
  let lo = -4 * Math.PI ** 2;
  while (F(lo) > 0) {
    lo *= 2; // very short (hyperbolic) transfers
    if (lo < -1e6) throw new Error('Lambert: no solution bracket');
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (F(mid) > 0) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-13 * Math.max(1, Math.abs(mid))) break;
  }
  const z = (lo + hi) / 2;
  const yz = y(z);
  const f = 1 - yz / r1;
  const g = A * Math.sqrt(yz / mu);
  const gdot = 1 - yz / r2;
  return {
    v1: scale(sub(r2v, scale(r1v, f)), 1 / g),
    v2: scale(sub(scale(r2v, gdot), r1v), 1 / g),
  };
}

// ---------------------------------------------------------------------------
// State ↔ elements, used to draw the transfer path and to check Lambert solutions.

export function elementsFromState(r: Vec3, v: Vec3, mu: number): Elements {
  const rn = norm(r);
  const h = cross(r, v);
  const hn = norm(h);
  const nodeVec: Vec3 = [-h[1], h[0], 0];
  const nn = norm(nodeVec);
  const eVec = scale(sub(scale(r, dot(v, v) - mu / rn), scale(v, dot(r, v))), 1 / mu);
  const e = norm(eVec);
  const a = 1 / (2 / rn - dot(v, v) / mu);
  const i = Math.acos(h[2] / hn);

  let Omega = 0;
  let omega: number;
  if (nn > 1e-12 * hn) {
    Omega = Math.atan2(nodeVec[1], nodeVec[0]);
    omega = Math.atan2(dot(cross(nodeVec, eVec), h) / hn, dot(nodeVec, eVec));
  } else {
    omega = Math.atan2(eVec[1], eVec[0]) * Math.sign(h[2] || 1);
  }
  const nu = Math.atan2(dot(cross(eVec, r), h) / hn, dot(eVec, r));
  const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
  return { a, e, i, Omega, omega, M: E - e * Math.sin(E) };
}

/** Two-body propagation of an elliptic state by dt seconds. */
export function propagate(r: Vec3, v: Vec3, dt: number, mu: number): { r: Vec3; v: Vec3 } {
  const el = elementsFromState(r, v, mu);
  if (!(el.e < 1) || !(el.a > 0)) throw new Error('propagate: only elliptic orbits are supported');
  const n = Math.sqrt(mu / el.a ** 3);
  return stateFromElements({ ...el, M: el.M + n * dt }, mu);
}

/** Sample a transfer arc as ecliptic [x, y] points (metres). Falls back to a straight line if not elliptic. */
function samplePath(r1: Vec3, v1: Vec3, r2: Vec3, tof: number, mu: number, points = 64): [number, number][] {
  const el = elementsFromState(r1, v1, mu);
  const path: [number, number][] = [];
  for (let k = 0; k <= points; k++) {
    const t = (tof * k) / points;
    if (el.e < 1 && el.a > 0) {
      const p = stateFromElements({ ...el, M: el.M + Math.sqrt(mu / el.a ** 3) * t }, mu).r;
      path.push([p[0], p[1]]);
    } else {
      path.push([r1[0] + ((r2[0] - r1[0]) * k) / points, r1[1] + ((r2[1] - r1[1]) * k) / points]);
    }
  }
  return path;
}

// ---------------------------------------------------------------------------
// Transfers to destinations

export interface TransferResult {
  method: 'lambert' | 'hohmann' | 'fixed-route';
  c3_km2s2: number;
  vInfDep_ms: number;
  vInfArr_ms: number;
  flightDays: number;
  path: [number, number][];
}

/** Lambert transfer from Earth on launchDate to the target on arrivalDate (heliocentric). */
export function lambertTransfer(dest: Exclude<DestinationId, 'moon'>, launchDate: string, arrivalDate: string): TransferResult {
  const jd1 = julianDate(launchDate);
  const jd2 = julianDate(arrivalDate);
  if (!(jd2 > jd1)) throw new Error('Arrival date must be after launch date');
  const tof = days(jd2 - jd1);
  const r1 = heliocentricPosition('earth', jd1);
  const r2 = heliocentricPosition(dest, jd2);
  const { v1, v2 } = lambert(r1, r2, tof, MU_SUN_SI);
  const vInfDep_ms = norm(sub(v1, heliocentricVelocity('earth', jd1)));
  const vInfArr_ms = norm(sub(v2, heliocentricVelocity(dest, jd2)));
  return {
    method: 'lambert',
    c3_km2s2: (vInfDep_ms / 1000) ** 2,
    vInfDep_ms,
    vInfArr_ms,
    flightDays: jd2 - jd1,
    path: samplePath(r1, v1, r2, tof, MU_SUN_SI),
  };
}

/**
 * Moon (spec: Special cases): Earth-centred Hohmann from a low parking orbit to the Moon's distance.
 * The launch vehicle pays trans-lunar injection (reported as C3 = v² − 2μ/r); v∞ is relative to the Moon.
 */
export function moonTransfer(parkingAlt_m = km(GAME_RULES.earthParkingOrbitAlt_km.value)): TransferResult {
  const r1 = R_EARTH_M + parkingAlt_m;
  const r2 = km(DESTINATIONS.moon.earthDistance_1e6km!.value * 1e6);
  const h = hohmann(r1, r2, MU_EARTH_SI);
  const vTLI = Math.sqrt(MU_EARTH_SI / r1) + h.vInfDep_ms;
  const path: [number, number][] = [];
  for (let k = 0; k <= 64; k++) {
    const nu = (Math.PI * k) / 64;
    const e = (r2 - r1) / (r2 + r1);
    const r = (h.a_m * (1 - e * e)) / (1 + e * Math.cos(nu));
    path.push([r * Math.cos(nu), r * Math.sin(nu)]);
  }
  return {
    method: 'hohmann',
    c3_km2s2: (vTLI ** 2 - (2 * MU_EARTH_SI) / r1) / 1e6,
    vInfDep_ms: h.vInfDep_ms,
    vInfArr_ms: h.vInfArr_ms,
    flightDays: toDays(h.tFlight_s),
    path,
  };
}

/** Cadet-mode Hohmann to a destination, using the circular-orbit distances in the Destinations table. */
export function hohmannToDestination(dest: DestinationId): TransferResult & { phaseAngleDeg?: number } {
  if (dest === 'moon') return moonTransfer();
  const r2 = km(DESTINATIONS[dest].sunDistance_1e6km.value * 1e6);
  const h = hohmann(AU_M, r2, MU_SUN_SI);
  const path: [number, number][] = [];
  for (let k = 0; k <= 64; k++) {
    const nu = (Math.PI * k) / 64;
    const e = Math.abs(r2 - AU_M) / (r2 + AU_M);
    const r = (h.a_m * (1 - e * e)) / (1 + Math.sign(r2 - AU_M) * e * Math.cos(nu));
    path.push([r * Math.cos(nu), r * Math.sin(nu)]);
  }
  return {
    method: 'hohmann',
    c3_km2s2: h.c3_km2s2,
    vInfDep_ms: h.vInfDep_ms,
    vInfArr_ms: h.vInfArr_ms,
    flightDays: toDays(h.tFlight_s),
    path,
    phaseAngleDeg: phaseAngleDeg(h.tFlight_s, days(DESTINATIONS[dest].orbitPeriod_days.value)),
  };
}

/**
 * Player transfers must take less than one revolution of the minimum-energy (Hohmann) transfer orbit,
 * i.e. less than 2 × t_Hohmann. Longer flights need multi-revolution or gravity-assist routes, which the
 * zero-revolution Lambert solver does not model.
 */
export function maxFlightDays(dest: Exclude<DestinationId, 'moon'>): number {
  return 2 * toDays(hohmann(AU_M, km(DESTINATIONS[dest].sunDistance_1e6km.value * 1e6), MU_SUN_SI).tFlight_s);
}

const DEFAULT_SEARCH: Record<Exclude<DestinationId, 'moon'>, [number, number]> = {
  venus: [80, 400],
  mars: [100, 500],
  bennu: [100, 900],
  jupiter: [400, 2000],
};

/**
 * For a launch date, scan arrival dates and return the Lambert transfer with the lowest
 * departure v∞ + arrival v∞ (a standard porkchop figure of merit: launch energy plus arrival burn).
 */
export function bestArrival(
  dest: Exclude<DestinationId, 'moon'>,
  launchDate: string,
  opts: { minDays?: number; maxDays?: number; stepDays?: number } = {},
): TransferResult & { arrivalDate: string } {
  const minDays = opts.minDays ?? DEFAULT_SEARCH[dest][0];
  const maxDays = Math.min(opts.maxDays ?? DEFAULT_SEARCH[dest][1], Math.ceil(maxFlightDays(dest)) - 1);
  const step = opts.stepDays ?? 1;
  const t0 = Date.parse(`${launchDate.slice(0, 10)}T00:00:00Z`);
  let best: (TransferResult & { arrivalDate: string }) | undefined;
  for (let d = minDays; d <= maxDays; d += step) {
    const arrivalDate = new Date(t0 + d * 86_400_000).toISOString().slice(0, 10);
    let t: TransferResult;
    try {
      t = lambertTransfer(dest, launchDate.slice(0, 10), arrivalDate);
    } catch {
      continue;
    }
    if (!best || t.vInfDep_ms + t.vInfArr_ms < best.vInfDep_ms + best.vInfArr_ms) best = { ...t, arrivalDate };
  }
  if (!best) throw new Error(`No Lambert solution found for ${dest} from ${launchDate}`);
  return best;
}

export type FixedRouteId = 'nasa-earth-flyby';

export interface FixedRouteResult extends TransferResult {
  method: 'fixed-route';
  label: string;
  launchDate: string;
  arrivalDate: string;
  postFlybyLegDays: number;
  /** Spacecraft Δv on the route before arrival (deep-space manoeuvre). */
  extraDeltaV: Sourced<number>;
  inputs: Record<string, Sourced<number>>;
}

/**
 * A published real-mission route offered as a fixed option. Launch C3 is the published value; the gravity
 * assist is not simulated. Only the post-flyby leg (flyby → start of approach) is computed, by Lambert, to
 * get the arrival v∞; the deep-space manoeuvre is charged as extra spacecraft Δv.
 */
export function fixedRoute(dest: DestinationId, id: FixedRouteId): FixedRouteResult {
  const route = DESTINATIONS[dest].fixedRoutes?.[id];
  if (!route || dest === 'moon') throw new Error(`No fixed route "${id}" for ${dest}`);
  const leg = lambertTransfer(dest, route.flybyDate.value, route.approachStartDate.value);
  const jdLaunch = julianDate(route.launchDate.value);
  const jdFlyby = julianDate(route.flybyDate.value);
  const preFlyby: [number, number][] = [];
  for (let k = 0; k <= 32; k++) {
    const p = heliocentricPosition('earth', jdLaunch + ((jdFlyby - jdLaunch) * k) / 32);
    preFlyby.push([p[0], p[1]]); // drawn as Earth's track: the one-year Earth-to-Earth loop is not simulated
  }
  return {
    method: 'fixed-route',
    label: route.label,
    launchDate: route.launchDate.value,
    arrivalDate: route.arrivalDate.value,
    c3_km2s2: route.launchC3_km2s2.value,
    vInfDep_ms: Math.sqrt(route.launchC3_km2s2.value) * 1000,
    vInfArr_ms: leg.vInfArr_ms,
    flightDays: julianDate(route.arrivalDate.value) - jdLaunch,
    postFlybyLegDays: leg.flightDays,
    path: [...preFlyby, ...leg.path],
    extraDeltaV: route.dsmDeltaV_ms,
    inputs: { launchC3: route.launchC3_km2s2, dsmDeltaV: route.dsmDeltaV_ms },
  };
}

/** The transfer the engine uses for a design: a fixed route if chosen, else Lambert between the dates; Moon Earth-centred. */
export function transferForDesign(
  design: Pick<Design, 'destination' | 'launchDate' | 'arrivalDate' | 'trajectoryOption'>,
): TransferResult | FixedRouteResult {
  if (design.trajectoryOption && design.trajectoryOption !== 'direct') {
    return fixedRoute(design.destination, design.trajectoryOption);
  }
  if (design.destination === 'moon') return moonTransfer();
  return lambertTransfer(design.destination, design.launchDate, design.arrivalDate);
}

/**
 * Spacecraft Δv at arrival. Orbiters: capture burn into the design's orbit, whose periapsis and
 * apoapsis are altitudes above the equatorial radius. Bennu: rendezvous Δv ≈ v∞ (negligible gravity).
 */
export function arrivalDeltaV(
  dest: DestinationId,
  vInfArr_ms: number,
  orbit: { periapsis_km: number; apoapsis_km: number },
): number {
  if (DESTINATIONS[dest].missionType === 'rendezvous') return vInfArr_ms;
  const d = DESTINATIONS[dest];
  const R = km(d.radius_km.value);
  return captureDeltaV(vInfArr_ms, muSI(d.gm_km3s2.value), R + km(orbit.periapsis_km), R + km(orbit.apoapsis_km));
}

/** Target's Sun-distance at perihelion and aphelion on a date (from the ephemeris elements). */
export function sunDistanceExtremes(dest: Exclude<DestinationId, 'moon'> | 'earth', jd: number): { perihelion_m: number; aphelion_m: number } {
  const el = elementsAt(dest, jd);
  return { perihelion_m: el.a * (1 - el.e), aphelion_m: el.a * (1 + el.e) };
}

