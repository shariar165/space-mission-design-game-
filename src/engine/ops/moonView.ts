// The Moon orbit on the globe (spec: UI rules 45–46; Moon orbit). What the globe needs to draw the Moon scene, in
// the Moon's body-fixed frame (x through the sub-Earth point (0°, 0°), z the north pole): Earth's direction, the
// science orbit's plane now and the craft's place on it, the arcs where the far side hides the craft from Earth and
// where the Moon's shadow covers it, a pass over each Moon 3 target, and the next station-keeping pair. The arcs use
// the same cylinder test as the engine's loss of signal and eclipses (inShadow), on the true orbit radius, so the
// drawing's dashed half is the physics' far side. Pure functions of the state; the UI only projects and formats.
import { stationKeeping } from '../propulsion';
import type { Vec3 } from '../types';
import { linkUpAt } from './link';
import { hasTargets, targetsOf } from './observe';
import { earthDirection, inShadow, orbitPosition, planetFrame, sunDirection } from './predictable';
import type { OpsState } from './types';

const DAY_S = 86_400;
const TAU = 2 * Math.PI;
/** Ring samples for the arcs (0.5° each), then each edge is bisected. */
const ARC_SAMPLES = 720;

/** A stretch of the ring, in radians from the plane's p toward q: to > from, and it may run past 2π. */
export interface Arc {
  from: number;
  to: number;
}

/** An orbit plane in the body frame: the craft is at cos θ p + sin θ q (times the orbit radius). */
export interface OrbitPlane {
  p: Vec3;
  q: Vec3;
  /** Where the far side hides the craft from Earth (none: the whole orbit is in view). */
  farSide?: Arc;
  /** Where the Moon's shadow covers the craft (none: no eclipse on this orbit). */
  shadow?: Arc;
}

export interface MoonOrbitView {
  /** The craft is in its science orbit and flying: the orbit panel can open. */
  available: boolean;
  /** Earth: its direction in the body frame (the sub-Earth point), its distance and the one-way light time. */
  earth: { dir: Vec3; distance_m: number; oneWay_s: number };
  /** The science orbit now, and the craft's angle on it. */
  now: OrbitPlane & { theta: number };
  /** Moon 3: the pass flown over each target, polar and through it, with the target at θ = 0 (none on Moon 1 and 2). */
  passes: Record<string, OrbitPlane>;
  /** The link now (engine), the loss of signal and the eclipse in each orbit today, and the orbit period (s). */
  link: { up: boolean; losPerOrbit_s: number; eclipsePerOrbit_s: number; period_s: number };
  /** The next station-keeping pair (spec: Moon orbit): how long until it (s) and its Δv (m/s). */
  stationKeeping?: { nextBurn_s: number; pairDeltaV_ms: number };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};
const wrap = (th: number) => ((th % TAU) + TAU) % TAU;

/** Is θ on the arc? */
export const onArc = (a: Arc | undefined, th: number) => a !== undefined && wrap(th - a.from) <= a.to - a.from;
/** Can Earth see a craft at θ on this plane? (The globe asks this as it moves the orbiter round its ring.) */
export const linkUpOnRing = (pl: OrbitPlane, th: number) => !onArc(pl.farSide, th);

/** The arc of a circular orbit of radius k (body radii) hidden by the body seen along `dir` (the cylinder test). */
export function hiddenArc(p: Vec3, q: Vec3, dir: Vec3, k: number): Arc | undefined {
  const at = (th: number): Vec3 => [k * (Math.cos(th) * p[0] + Math.sin(th) * q[0]), k * (Math.cos(th) * p[1] + Math.sin(th) * q[1]), k * (Math.cos(th) * p[2] + Math.sin(th) * q[2])];
  const hid = (th: number) => inShadow(at(th), dir, 1);
  const step = TAU / ARC_SAMPLES;
  const flags = Array.from({ length: ARC_SAMPLES }, (_, i) => hid(i * step));
  if (!flags.some(Boolean)) return undefined;
  if (flags.every(Boolean)) return { from: 0, to: TAU };
  const f = (i: number) => flags[((i % ARC_SAMPLES) + ARC_SAMPLES) % ARC_SAMPLES]!;
  let i0 = 0;
  while (!(f(i0) && !f(i0 - 1))) i0++;
  let i1 = i0;
  while (f(i1 + 1)) i1++;
  // Refine each edge between its samples (the cylinder meets a circle in one arc).
  const edge = (out: number, inside: number) => {
    let a = out;
    let b = inside;
    for (let n = 0; n < 40; n++) {
      const m = (a + b) / 2;
      if (hid(m)) b = m;
      else a = m;
    }
    return b;
  };
  const from = edge((i0 - 1) * step, i0 * step);
  const to = edge((i1 + 1) * step, i1 * step);
  return { from: wrap(from), to: wrap(from) + (to - from) };
}

/** The Moon orbit panel's view, or undefined away from the Moon. */
export function moonOrbitView(s: OpsState): MoonOrbitView | undefined {
  const env = s.env;
  const dest = env.design.destination;
  const o = env.farSide?.orbit;
  if (dest !== 'moon' || !o) return undefined;
  const d = Math.min(Math.floor(s.t), env.horizonDay);
  const day = env.days[d]!;
  const jd = env.jdLaunch + s.t;
  // The body frame: x toward Earth (the sub-Earth point), z the pole.
  const X = earthDirection(dest, jd)!;
  const Z = planetFrame(dest, jd).Z;
  const Y = cross(Z, X);
  const toBody = (v: Vec3): Vec3 => [dot(v, X), dot(v, Y), dot(v, Z)];
  const k = o.a / o.bodyRadius;
  const earth: Vec3 = [1, 0, 0];
  const sun = unit(toBody(sunDirection(dest, jd)));
  const plane = (p: Vec3, q: Vec3): OrbitPlane => {
    const far = hiddenArc(p, q, earth, k);
    const shade = hiddenArc(p, q, sun, k);
    return { p, q, ...(far ? { farSide: far } : {}), ...(shade ? { shadow: shade } : {}) };
  };

  const p = unit(toBody(o.P));
  const q = unit(toBody(o.Q));
  const r = orbitPosition(o, o.n * (s.t - env.arrivalDay) * DAY_S);
  const theta = wrap(Math.atan2(dot(r, o.Q), dot(r, o.P)));

  const passes: Record<string, OrbitPlane> = {};
  if (hasTargets(env))
    for (const t of targetsOf(env)) {
      if (!t.lat_deg || !t.lon_deg) continue;
      const la = (t.lat_deg.value * Math.PI) / 180;
      const lo = (t.lon_deg.value * Math.PI) / 180;
      // Polar through the target: p over it, q due north along its meridian.
      passes[t.id] = plane([Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)], [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)]);
    }

  const sk = stationKeeping(env.design);
  const next = sk ? env.burns.find((b) => b.kind === 'station-keeping' && b.day > s.t) : undefined;
  const phase = day.phase;
  return {
    available: s.status === 'flying' && day.visibleFraction !== undefined && (phase === 'science' || phase === 'extended'),
    earth: { dir: earth, distance_m: day.earthDistance_m, oneWay_s: day.oneWay_s },
    now: { ...plane(p, q), theta },
    passes,
    link: { up: linkUpAt(env, s.t), losPerOrbit_s: day.losPerOrbit_s ?? 0, eclipsePerOrbit_s: day.longestEclipse_s, period_s: o.period_s },
    ...(sk && next ? { stationKeeping: { nextBurn_s: (next.day - s.t) * DAY_S, pairDeltaV_ms: sk.pair_ms } } : {}),
  };
}
