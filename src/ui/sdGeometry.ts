// Pixel layout for the Signal Delay screens: map projection, swipe thresholds, the signal ring. No physics:
// positions come from the engine in metres and are only scaled into the drawing.
import { useEffect, useState } from 'react';
import type { XY } from '../engine/flightMap';
import type { TargetBody } from '../engine/targets';

/** The CRT map's drawing: 1000 × 600 units, the Sun (or Earth for the Moon) at the centre (as the design). */
export const MAP_W = 1000;
export const MAP_H = 600;
export const MAP_CX = 500;
export const MAP_CY = 300;
/** The largest orbit reaches this far from the centre (design: Mars ring r = 230 of a 600-unit-high screen). */
export const MAP_REACH = 250;
/** The phone shows a square around the centre (design: viewBox 250 50 500 500). */
export const MAP_VIEW_DESKTOP = `0 0 ${MAP_W} ${MAP_H}`;
export const MAP_VIEW_PHONE = `${MAP_CX - 250} ${MAP_CY - 250} 500 500`;

export function projector(extent_m: number) {
  const s = MAP_REACH / extent_m;
  const at = (p: XY): [number, number] => [MAP_CX + p[0] * s, MAP_CY - p[1] * s];
  const d = (ps: XY[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${at(p)[0].toFixed(1)} ${at(p)[1].toFixed(1)}`).join('');
  return { at, d };
}

/** Point a fraction of the way from a to b (the signal pulse on the Earth–craft line). */
export const along = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A point `px` pixels from a toward b (labels set beside a marker). */
export function toward(a: [number, number], b: [number, number], px: number): [number, number] {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [a[0] + ((b[0] - a[0]) * px) / d, a[1] + ((b[1] - a[1]) * px) / d];
}

/** The part of the drawing a layout shows (the viewBoxes above). */
const mapBox = (phone: boolean) => (phone ? { x0: MAP_CX - 250, y0: MAP_CY - 250, x1: MAP_CX + 250, y1: MAP_CY + 250 } : { x0: 0, y0: 0, x1: MAP_W, y1: MAP_H });
/**
 * Where an off-map Sun may sit: the visible map less the strip the map buttons cover at the bottom (desktop: the
 * action row; phone: two rows of buttons). Distances from the centre, in drawing units.
 */
const SUN_REACH = { desktop: { left: 470, right: 470, up: 272, down: 236 }, phone: { left: 226, right: 226, up: 236, down: 196 } };

/**
 * Where to draw the Sun: where it is when it is on the map (the heliocentric maps), else on the visible edge in its
 * true direction from the centre (the Moon map, where the Sun is about 1 AU away).
 */
export function sunOnMap(sun: [number, number], phone: boolean): { at: [number, number]; offMap: boolean } {
  const v = mapBox(phone);
  if (sun[0] >= v.x0 && sun[0] <= v.x1 && sun[1] >= v.y0 && sun[1] <= v.y1) return { at: sun, offMap: false };
  const reach = phone ? SUN_REACH.phone : SUN_REACH.desktop;
  const dx = sun[0] - MAP_CX;
  const dy = sun[1] - MAP_CY;
  const kx = dx ? (dx < 0 ? reach.left : reach.right) / Math.abs(dx) : Infinity;
  const ky = dy ? (dy < 0 ? reach.up : reach.down) / Math.abs(dy) : Infinity;
  const k = Math.min(kx, ky);
  return { at: [MAP_CX + dx * k, MAP_CY + dy * k], offMap: true };
}

/** The edge Sun's label: beside it, on the side toward the middle of the map, so it never sits on the Moon. */
export function sunLabel(at: [number, number], big: boolean): { x: number; y: number; anchor: 'start' | 'end' } {
  const gap = big ? 30 : 26;
  const right = at[0] <= MAP_CX;
  return { x: at[0] + (right ? gap : -gap), y: at[1] + 7, anchor: right ? 'start' : 'end' };
}

/** The storm wave: three ripples this many pixels apart, flat fronts this long either side of their middle. */
export const STORM_RIPPLES = 3;
export const STORM_RIPPLE_PX = 16;
export const STORM_FRONT_HALF_PX = 150;

/**
 * Path data for a solar-storm wave a fraction `progress` of the way from the Sun to the craft. With the Sun on the
 * map: arcs about the Sun, `width_deg` wide, centred on the craft's direction. With the Sun off the map (Moon):
 * flat fronts across the Sun's direction, since a shell 1 AU wide is flat at that scale. Drawing only.
 */
export function stormWave(
  sun: [number, number],
  craft: [number, number],
  progress: number,
  width_deg: number,
  flat: boolean,
): { paths: string[]; tip: [number, number] } {
  const dx = craft[0] - sun[0];
  const dy = craft[1] - sun[1];
  const dist = Math.hypot(dx, dy);
  const paths: string[] = [];
  const f = (n: number) => n.toFixed(1);
  // The label goes at the end of the leading front nearer the middle of the map, clear of the Sun and the robot.
  const inner = (a: [number, number], b: [number, number]): [number, number] =>
    Math.hypot(a[0] - MAP_CX, a[1] - MAP_CY) <= Math.hypot(b[0] - MAP_CX, b[1] - MAP_CY) ? a : b;
  let tip: [number, number] = along(sun, craft, progress);
  if (flat) {
    // Fronts move along the Sun's true direction (the centre seen from the marker), crossing the craft at 1.
    const u = toward([0, 0], [MAP_CX - sun[0], MAP_CY - sun[1]], 1);
    const n: [number, number] = [-u[1], u[0]];
    const head = tip;
    for (let i = 0; i < STORM_RIPPLES; i++) {
      const back = i * STORM_RIPPLE_PX;
      if (i > 0 && back > progress * dist) break;
      const c: [number, number] = [head[0] - u[0] * back, head[1] - u[1] * back];
      const h = STORM_FRONT_HALF_PX * (1 - i * 0.18);
      const a: [number, number] = [c[0] - n[0] * h, c[1] - n[1] * h];
      const b: [number, number] = [c[0] + n[0] * h, c[1] + n[1] * h];
      if (i === 0) tip = inner(a, b);
      paths.push(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`);
    }
    return { paths, tip };
  }
  const th = Math.atan2(dy, dx);
  const half = (width_deg * Math.PI) / 360;
  for (let i = 0; i < STORM_RIPPLES; i++) {
    const r = progress * dist - i * STORM_RIPPLE_PX;
    if (r <= 4) break;
    const a: [number, number] = [sun[0] + r * Math.cos(th - half), sun[1] + r * Math.sin(th - half)];
    const b: [number, number] = [sun[0] + r * Math.cos(th + half), sun[1] + r * Math.sin(th + half)];
    if (i === 0) tip = inner(a, b);
    paths.push(`M${f(a[0])} ${f(a[1])}A${f(r)} ${f(r)} 0 0 1 ${f(b[0])} ${f(b[1])}`);
  }
  return { paths, tip };
}

/** The expanding ring around the pulse: radius and opacity from a 0–1 phase (design: r 8→30, fading). */
export const ring = (phase: number) => ({ r: 8 + phase * 22, opacity: (1 - phase) * 0.8 });
/** One ring cycle every 700 ms. */
export const RING_MS = 700;

/** A danger card dragged further than this many pixels chooses that side (design: 90 px). */
export const SWIPE_CHOOSE_PX = 90;
/** Past this the side's button lights up (design: 40 px). */
export const SWIPE_HINT_PX = 40;
/** Degrees of tilt per pixel dragged (design: x / 18). */
export const SWIPE_TILT = 1 / 18;
/** The ribbon item past this share of the window flips its label to the left of its icon (design: 0.72). */
export const RIBBON_FLIP = 0.72;
/** On the phone, ribbon items stop short of the right edge (design: 92%). */
export const RIBBON_PHONE_MAX = 0.92;

/** Phone layout below this width (design: 390 px frames; the app switches at 760 px). */
export const PHONE_MAX_PX = 760;

export function useIsPhone(): boolean {
  const q = `(max-width: ${PHONE_MAX_PX}px)`;
  const [m, setM] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [q]);
  return m;
}

/** A 0–1 phase that cycles every `ms` while `on` (the signal ring); still when off. */
export function useCycle(ms: number, on: boolean): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t0 = Date.now();
    const id = setInterval(() => setP(((Date.now() - t0) % ms) / ms), 40);
    return () => clearInterval(id);
  }, [ms, on]);
  return on ? p : 0;
}

// ---------------------------------------------------------------------------
// The Mars globe in the CRT (Science Targets): an orthographic view of the NASA surface map.

/** Where the globe looks from at the overview: centred over Tharsis, tilted north so the polar cap shows (layout choice). */
export const GLOBE_VIEW: GlobeView = { lat_deg: 22, lon_deg: -100 };
/** Where each moon sits on its (equatorial) ring: angle round the ring, radians, from the view's right. */
export const GLOBE_MOON_AT = { phobos: 2.7, deimos: 0.9 } as const;
/** The limb target: a point on the lit edge of the disc (angle from +x, radians). */
export const GLOBE_LIMB_AT = 0.42;

const R = Math.PI / 180;

export interface GlobeView {
  lat_deg: number;
  lon_deg: number;
}
/** A point around the globe in the view frame: unit = Mars radius, x right, y up, z toward the viewer. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Orthographic projection of (lat, lon) onto the unit disc seen from the view centre: x right, y down; front = visible. */
export function globePoint(lat_deg: number, lon_deg: number, view = GLOBE_VIEW): { x: number; y: number; front: boolean } {
  const v = globeVec(lat_deg, lon_deg, view);
  return { x: v.x, y: -v.y, front: v.z > 0 };
}

/** A surface point (lat, lon) as a unit vector in the view frame. */
export function globeVec(lat_deg: number, lon_deg: number, view = GLOBE_VIEW): Vec3 {
  const p = lat_deg * R;
  const l = (lon_deg - view.lon_deg) * R;
  const p0 = view.lat_deg * R;
  return {
    x: Math.cos(p) * Math.sin(l),
    y: Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l),
    z: Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l),
  };
}

/** Inverse orthographic: the (lat, lon) under a disc point, or undefined off the disc. */
export function globeLatLon(x: number, y: number, view = GLOBE_VIEW): { lat_deg: number; lon_deg: number; z: number } | undefined {
  const yy = -y;
  const rho = Math.hypot(x, yy);
  if (rho > 1) return undefined;
  const p0 = view.lat_deg * R;
  if (rho === 0) return { lat_deg: view.lat_deg, lon_deg: view.lon_deg, z: 1 };
  const c = Math.asin(rho);
  const lat = Math.asin(Math.cos(c) * Math.sin(p0) + (yy * Math.sin(c) * Math.cos(p0)) / rho);
  const lon = view.lon_deg * R + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(p0) - yy * Math.sin(c) * Math.sin(p0));
  let lon_deg = lon / R;
  lon_deg = ((((lon_deg + 180) % 360) + 360) % 360) - 180;
  return { lat_deg: lat / R, lon_deg, z: Math.cos(c) };
}

// ---------------------------------------------------------------------------
// The hero globe (spec: UI rule 41): the same drawing for the three.js globe and the flat one, in the view frame.

/**
 * Altitudes are drawn compressed (a picture; every label shows the engine's real km): the band up to lowBand_km is
 * stretched over lowSpan Mars radii so a dip of a few tens of km shows, and above it the drawn radius grows with the
 * square root, so Deimos still fits. r = 1 + lowSpan · min(h, b)/b + highK · √(max(0, h − b)/R).
 */
export const GLOBE_ALT = { lowBand_km: 300, lowSpan: 0.8, highK: 0.5, marsRadius_km: 3396.2 } as const;

export function orbitDrawRadius(alt_m: number): number {
  const h = Math.max(0, alt_m / 1000);
  const b = GLOBE_ALT.lowBand_km;
  return 1 + (GLOBE_ALT.lowSpan * Math.min(h, b)) / b + GLOBE_ALT.highK * Math.sqrt(Math.max(0, h - b) / GLOBE_ALT.marsRadius_km);
}

/** The disc's diameter as a share of the globe box's shorter side at the overview (where the arrival lands). */
export const GLOBE_DISC_FILL = { desktop: 0.7, phone: 0.62 } as const;
/** The disc's radius at the overview for a globe box (CSS px). */
export const globeDiscPx = (w: number, h: number, phone: boolean) => (GLOBE_DISC_FILL[phone ? 'phone' : 'desktop'] * Math.min(w, h)) / 2;
/** How each kind of target is framed: the disc's scale against the overview (moons: their ring must fit). */
export const GLOBE_ZOOM = { overview: 1, surface: 1.3, limb: 1.1, phobos: 0.52, deimos: 0.42 } as const;

/** Each globe's look (spec: UI rule 44): where the overview looks and how each target is framed. */
export const GLOBE_BODY: Record<TargetBody, { view: GlobeView; zoom: Record<keyof typeof GLOBE_ZOOM, number> }> = {
  mars: { view: GLOBE_VIEW, zoom: GLOBE_ZOOM },
  // From the south-east, like the design: the four Moon targets face the camera and Earth sits up and to the left.
  // Smaller than Mars at the overview, so Earth fits beside it.
  moon: { view: { lat_deg: -45, lon_deg: 50 }, zoom: { ...GLOBE_ZOOM, overview: 0.78, surface: 1.05 } },
};
/** The camera eases to a new target in this long (3D only; the flat globe cuts). */
export const GLOBE_EASE_MS = 900;
/** The orbiter's pass over a target when an OBSERVE order lands, and the scan flash in it. */
export const GLOBE_FLYOVER_MS = 1800;
/** The orbit's arc swept by the flyover, either side of the periapsis (radians). */
export const GLOBE_FLYOVER_ARC = 0.9;
/** Where the orbiter is in a flyover at progress k (0–1): it slows over the target (the periapsis) for the scan. */
export const flyoverTheta = (k: number) => {
  const u = 2 * Math.max(0, Math.min(1, k)) - 1;
  return GLOBE_FLYOVER_ARC * Math.sign(u) * Math.abs(u) ** 1.8;
};
/** The low (drag) arc tinted on a dipping pass, either side of the periapsis (radians). */
export const GLOBE_DRAG_ARC = 0.55;
/** The overview turns slowly, like the design (one turn in this many seconds). */
export const GLOBE_SPIN_S = 90;
/** A surface target is looked at from no further north or south than this (the pole stays readable). */
export const GLOBE_MAX_TILT_DEG = 62;
/**
 * A surface target sits this far left of the view centre (deg of longitude), so the orbit over it is seen from the
 * side: face on, a dip would point straight at the viewer and could not be seen.
 */
export const GLOBE_SIDE_DEG = 50;

function norm(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** The overview's periapsis: front, lower left, so the far side of the orbit swings back behind the globe. */
export const GLOBE_OVERVIEW_PERI: Vec3 = norm({ x: -0.62, y: -0.3, z: 0.72 });

/** Mars' north pole in the view frame. */
export const globeNorth = (view: GlobeView) => globeVec(90, 0, view);

/** A moon on its equatorial ring (drawn radius), in the view frame. */
export function moonVec(moon: 'phobos' | 'deimos', orbit_m: number, view: GlobeView): Vec3 {
  const n = globeNorth(view);
  const e1: Vec3 = { x: 1, y: 0, z: 0 };
  const e2 = norm(cross(e1, n));
  const a = GLOBE_MOON_AT[moon];
  const r = orbitDrawRadius(orbit_m - GLOBE_ALT.marsRadius_km * 1000);
  return scale(add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a))), r);
}

/** A moon's whole ring (drawn radius), in the view frame. */
export function moonRing(orbit_m: number, view: GlobeView, n = 120): Vec3[] {
  const nn = globeNorth(view);
  const e1: Vec3 = { x: 1, y: 0, z: 0 };
  const e2 = norm(cross(e1, nn));
  const r = orbitDrawRadius(orbit_m - GLOBE_ALT.marsRadius_km * 1000);
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return scale(add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a))), r);
  });
}

/** The limb target's point on the disc's edge. */
export const limbVec = (): Vec3 => ({ x: Math.cos(GLOBE_LIMB_AT), y: Math.sin(GLOBE_LIMB_AT), z: 0 });

/** An orbit's plane: p points at the periapsis, q along the motion there. */
export interface OrbitBasis {
  p: Vec3;
  q: Vec3;
}

/** The plane through a periapsis direction, tilted `incl_deg` to the equator where it can be (else as near as it gets). */
export function orbitBasis(peri: Vec3, north: Vec3, incl_deg: number): OrbitBasis {
  const p = norm(peri);
  let u = add(north, scale(p, -dot(north, p)));
  if (Math.hypot(u.x, u.y, u.z) < 1e-6) u = Math.abs(p.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  u = norm(add(u, scale(p, -dot(u, p))));
  const v = cross(p, u);
  const un = dot(u, north);
  const c = un > 1e-9 ? Math.max(-1, Math.min(1, Math.cos(incl_deg * R) / un)) : 0;
  const h = add(scale(u, c), scale(v, Math.sqrt(1 - c * c)));
  return { p, q: norm(cross(h, p)) };
}

/** Points along a conic with drawn periapsis and apoapsis radii, from angle `from` to `to` past the periapsis. */
export function orbitPoints(rp: number, ra: number, b: OrbitBasis, from = -Math.PI, to = Math.PI, n = 180): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) out.push(orbitAt(rp, ra, b, from + ((to - from) * i) / n));
  return out;
}

/** One point on the conic, `th` radians past the periapsis. */
export function orbitAt(rp: number, ra: number, b: OrbitBasis, th: number): Vec3 {
  const a = (rp + ra) / 2;
  const e = (ra - rp) / (ra + rp);
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(th));
  return add(scale(b.p, r * Math.cos(th)), scale(b.q, r * Math.sin(th)));
}

/** What the globe needs about a target to frame it and draw its orbit (a TargetCard's shape). */
export interface GlobeTarget {
  id: string;
  kind: 'surface' | 'moon' | 'limb';
  lat_deg?: number;
  lon_deg?: number;
  moonOrbit_m?: number;
  pass: { periapsis_m: number; apoapsis_m: number };
  dips: boolean;
  moonTransfer: boolean;
}
export interface GlobeOrbit {
  periapsis_m: number;
  apoapsis_m: number;
  inclination_deg: number;
}

/** Where the globe looks and how close, to show a target (the overview with none). */
export function globeFrame(t: GlobeTarget | undefined, body: TargetBody = 'mars'): { view: GlobeView; zoom: number } {
  const { view: home, zoom: Z } = GLOBE_BODY[body];
  if (!t) return { view: home, zoom: Z.overview };
  if (t.kind === 'surface') {
    const lat = Math.max(-GLOBE_MAX_TILT_DEG, Math.min(GLOBE_MAX_TILT_DEG, t.lat_deg ?? 0));
    // At the pole every longitude meets: no side step, the tilt already shows it from the side.
    const side = Math.abs(t.lat_deg ?? 0) > GLOBE_MAX_TILT_DEG ? 0 : GLOBE_SIDE_DEG;
    return { view: { lat_deg: lat, lon_deg: (t.lon_deg ?? 0) + side }, zoom: Z.surface };
  }
  if (t.kind === 'limb') return { view: home, zoom: Z.limb };
  return { view: home, zoom: t.id === 'deimos' ? Z.deimos : Z.phobos };
}

/** Where a target's marker sits in the view frame. */
export function targetVec(t: Pick<GlobeTarget, 'id' | 'kind' | 'lat_deg' | 'lon_deg' | 'moonOrbit_m'>, view: GlobeView): Vec3 {
  if (t.kind === 'surface') return scale(globeVec(t.lat_deg ?? 0, t.lon_deg ?? 0, view), 1.01);
  if (t.kind === 'limb') return limbVec();
  return moonVec(t.id === 'deimos' ? 'deimos' : 'phobos', t.moonOrbit_m ?? 0, view);
}

export interface GlobeOrbits {
  basis: OrbitBasis;
  /** The orbit drawn bright: the observing pass for a dip, the orbit now otherwise (drawn radii). */
  rp: number;
  ra: number;
  /** A dip: the orbit now, drawn faint behind the pass. */
  ghost?: { rp: number; ra: number };
  /** A moon: the orbit-change path out to it and back (dashed). */
  transfer?: { rp: number; ra: number };
  /** The low arc is tinted by the drag-heating risk. */
  dragArc: boolean;
}

/** The robot's orbit for the target in view: its plane runs over the target (or out to the moon). */
export function globeOrbits(orbit: GlobeOrbit, t: GlobeTarget | undefined, view: GlobeView): GlobeOrbits {
  const north = globeNorth(view);
  const now = { rp: orbitDrawRadius(orbit.periapsis_m), ra: orbitDrawRadius(orbit.apoapsis_m) };
  if (!t) return { basis: orbitBasis(GLOBE_OVERVIEW_PERI, north, orbit.inclination_deg), ...now, dragArc: false };
  if (t.moonTransfer) {
    // The periapsis opposite the moon, so the apoapsis reaches it where the orbit crosses the equator (no plane change).
    const basis = orbitBasis(scale(targetVec(t, view), -1), north, orbit.inclination_deg);
    return { basis, ...now, transfer: { rp: orbitDrawRadius(t.pass.periapsis_m), ra: orbitDrawRadius(t.pass.apoapsis_m) }, dragArc: false };
  }
  const peri = t.kind === 'limb' ? limbVec() : globeVec(t.lat_deg ?? 0, t.lon_deg ?? 0, view);
  const basis = orbitBasis(peri, north, orbit.inclination_deg);
  if (!t.dips) return { basis, ...now, dragArc: false };
  return { basis, rp: orbitDrawRadius(t.pass.periapsis_m), ra: orbitDrawRadius(t.pass.apoapsis_m), ghost: now, dragArc: true };
}

/** The periapsis point of the bright orbit, and the transfer's far end (where their labels sit). */
export const periapsisAt = (o: GlobeOrbits): Vec3 => scale(o.basis.p, o.rp);
export const transferApoAt = (o: GlobeOrbits): Vec3 | undefined => (o.transfer ? scale(o.basis.p, -o.transfer.ra) : undefined);

/** Hidden behind the globe: further from the viewer than the disc and inside its outline. */
export const behindGlobe = (v: Vec3) => v.z < 0 && v.x * v.x + v.y * v.y < 1;

/** Shortest turn from one longitude to another (deg), for easing the view. */
export const lonDelta = (from: number, to: number) => ((((to - from + 180) % 360) + 360) % 360) - 180;
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/**
 * Globe labels sit beside their point: the target's to the right, the orbit labels outward, each flipped or slid in
 * so it stays inside the box. Their width is estimated from the text (CRT font px per character), so the flat globe
 * can place them as it renders and the 3D globe without measuring every frame.
 */
export const GLOBE_LABEL = { pad: { sel: 22, orbit: 14, selPhone: 16, orbitPhone: 10 }, edge: 8, charPx: { desktop: 10, phone: 8 } } as const;

export function labelPlace(name: string, x: number, w: number, width: number, phone: boolean): { x: number; left: boolean; below: boolean } {
  const pad = name === 'sel' ? (phone ? GLOBE_LABEL.pad.selPhone : GLOBE_LABEL.pad.sel) : phone ? GLOBE_LABEL.pad.orbitPhone : GLOBE_LABEL.pad.orbit;
  const e = GLOBE_LABEL.edge;
  const fitsR = x + pad + width <= w - e;
  const fitsL = x - pad - width >= e;
  let left = name === 'sel' ? !fitsR && fitsL : x < w / 2;
  if (left && !fitsL && fitsR) left = false;
  if (!left && !fitsR && fitsL) left = true;
  // Neither side fits: slide the point in so the label does.
  const ax = left ? Math.max(x, e + width + pad) : Math.min(x, w - e - width - pad);
  // An orbit label that has to read inward drops below the target's marker instead of covering it.
  return { x: ax, left, below: name !== 'sel' && left !== x < w / 2 };
}

// ---------------------------------------------------------------------------
// The Moon scene (spec: UI rule 45; design 3d/Moon Globe.html): Earth over the near side at a shortened distance,
// the signal line with its // break, the ring solid where Earth sees the craft and dashed behind the Moon, the
// shadow arc and the trim-burn tag. Every arc and plane is the engine's (moonOrbitView, in the Moon's body frame:
// x through (0°, 0°), z north); this only turns them into the view frame and lays them out.

export const MOON_SCENE = {
  /** Earth's drawn distance (Moon radii; really about 221) and its drawn radius. */
  earthDistance: 2.3,
  earthRadius: 0.14,
  /** The // break sits this far along the signal line from Earth. */
  breakAt: 0.34,
  /** The orbiter laps its drawn ring in this many seconds (a sped-up picture; the link state is the engine's). */
  lapS: 24,
  /** Margin (px) the scene keeps from the box's edges, and the band along the top it leaves to the HUD lines. */
  edge: 14,
  hud: { desktop: 52, phone: 56 },
  /** The night side keeps this much light (earthshine, and so the map still reads). */
  nightGlow: 0.3,
  /** The overview looks at the ring this far off face-on (radians): it opens to an ellipse cos(55°) = 0.57 wide. */
  ringTilt: (55 * Math.PI) / 180,
} as const;

/**
 * The Moon's overview: the camera looks at the orbit from the side, `ringTilt` off face-on, so the ring opens up with
 * the near half on Earth's side and the far half away from it, and Earth sits beside the Moon (like the design). The
 * orbit is fixed in space while the Moon turns under it, so this view follows the plane through the month. From the
 * south, where the Moon 3 targets are; whole degrees, so the flat globe repaints only when it has moved.
 */
export function moonOverview(pl: { p: readonly [number, number, number]; q: readonly [number, number, number] }): GlobeView {
  const v = (a: readonly [number, number, number]): Vec3 => ({ x: a[0], y: a[1], z: a[2] });
  const e: Vec3 = { x: 1, y: 0, z: 0 };
  let n = norm(cross(v(pl.p), v(pl.q)));
  if (dot(n, e) < 0) n = scale(n, -1);
  let m = add(e, scale(n, -dot(e, n)));
  m = Math.hypot(m.x, m.y, m.z) < 1e-6 ? { x: 0, y: 0, z: -1 } : norm(m);
  let w = cross(n, m);
  if (w.z > 0) w = scale(w, -1);
  const a = MOON_SCENE.ringTilt;
  const c = add(scale(n, Math.cos(a)), scale(w, Math.sin(a)));
  const lat = Math.max(-GLOBE_MAX_TILT_DEG, Math.min(GLOBE_MAX_TILT_DEG, Math.asin(Math.max(-1, Math.min(1, c.z))) / R));
  return { lat_deg: Math.round(lat), lon_deg: Math.round(Math.atan2(c.y, c.x) / R) };
}

/** Where the Moon globe looks: at a picked target like Mars, else the overview along the orbit now. */
export function moonFrame(now: Parameters<typeof moonOverview>[0], t: GlobeTarget | undefined): { view: GlobeView; zoom: number } {
  return t ? globeFrame(t, 'moon') : { view: moonOverview(now), zoom: GLOBE_BODY.moon.zoom.overview };
}

/** A body-frame vector (engine moonOrbitView) in the view frame. */
export function bodyToView(v: readonly [number, number, number], view: GlobeView): Vec3 {
  const ex = globeVec(0, 0, view);
  const ey = globeVec(0, 90, view);
  const ez = globeVec(90, 0, view);
  return add(add(scale(ex, v[0]), scale(ey, v[1])), scale(ez, v[2]));
}

/** Earth in the view frame at its drawn distance. */
export const moonEarthAt = (dir: readonly [number, number, number], view: GlobeView): Vec3 => scale(bodyToView(dir, view), MOON_SCENE.earthDistance);

/**
 * Where the Moon's disc sits in its box, so the Moon (with its ring) and Earth fit together: the pair is centred,
 * then the disc shrinks if it still does not fit. Returns the disc's centre and radius (px).
 */
export function moonLayout(w: number, h: number, phone: boolean, zoom: number, earth: Vec3): { cx: number; cy: number; r: number } {
  const ring = orbitDrawRadius(50_000) + 0.06;
  const er = MOON_SCENE.earthRadius * 1.6;
  // The pair's extent in disc radii, about the Moon's centre (y up).
  const x0 = Math.min(-ring, earth.x - er);
  const x1 = Math.max(ring, earth.x + er);
  const y0 = Math.min(-ring, earth.y - er);
  const y1 = Math.max(ring, earth.y + er);
  const e = MOON_SCENE.edge;
  const top = MOON_SCENE.hud[phone ? 'phone' : 'desktop'];
  const fit = Math.min((w - 2 * e) / (x1 - x0), (h - top - 2 * e) / (y1 - y0));
  const r = Math.min(globeDiscPx(w, h, phone) * zoom, fit);
  return { cx: w / 2 - ((x0 + x1) / 2) * r, cy: top / 2 + h / 2 + ((y0 + y1) / 2) * r, r };
}

/** The Moon's orbit as drawn: its plane in the view frame, its drawn radius and the engine's arcs. */
export interface LunarRing {
  basis: OrbitBasis;
  r: number;
  farSide?: { from: number; to: number };
  shadow?: { from: number; to: number };
}

export function lunarRing(pl: { p: readonly [number, number, number]; q: readonly [number, number, number]; farSide?: { from: number; to: number }; shadow?: { from: number; to: number } }, view: GlobeView, alt_m: number): LunarRing {
  return {
    basis: { p: bodyToView(pl.p, view), q: bodyToView(pl.q, view) },
    r: orbitDrawRadius(alt_m),
    ...(pl.farSide ? { farSide: pl.farSide } : {}),
    ...(pl.shadow ? { shadow: pl.shadow } : {}),
  };
}

/** Points along the ring outside an arc (the near side), and inside it (the far side). */
export function ringSplit(m: LunarRing, n = 180): { near: Vec3[]; far: Vec3[] } {
  const a = m.farSide;
  if (!a) return { near: orbitPoints(m.r, m.r, m.basis, 0, 2 * Math.PI, n), far: [] };
  const k = Math.max(8, Math.round((n * (a.to - a.from)) / (2 * Math.PI)));
  return { near: orbitPoints(m.r, m.r, m.basis, a.to, a.from + 2 * Math.PI, n - k), far: orbitPoints(m.r, m.r, m.basis, a.from, a.to, k) };
}

/** Points along an arc of the ring (the shadow). */
export const ringArc = (m: LunarRing, a: { from: number; to: number }, n = 40): Vec3[] => orbitPoints(m.r, m.r, m.basis, a.from, a.to, n);
/** Where the trim-burn tag sits: the ring's point nearest the viewer (a picture: the burns are a pair, anywhere). */
export function trimAt(m: LunarRing): Vec3 {
  let best = orbitAt(m.r, m.r, m.basis, 0);
  for (let i = 1; i < 36; i++) {
    const v = orbitAt(m.r, m.r, m.basis, (i / 36) * 2 * Math.PI);
    if (v.z > best.z) best = v;
  }
  return best;
}



/**
 * The signal line's far end: the craft when Earth can see it; otherwise where the line from Earth first meets the
 * Moon (the break shows it does not get through), or half way if it misses the drawn disc.
 */
export function signalEnd(earth: Vec3, craft: Vec3, linked: boolean): Vec3 {
  if (linked) return craft;
  const d = { x: craft.x - earth.x, y: craft.y - earth.y, z: craft.z - earth.z };
  const a = dot(d, d);
  const b = 2 * dot(earth, d);
  const c = dot(earth, earth) - 1;
  const disc = b * b - 4 * a * c;
  const t = disc > 0 ? Math.max(MOON_SCENE.breakAt + 0.12, (-b - Math.sqrt(disc)) / (2 * a) - 0.02) : 0.55;
  return add(earth, scale(d, Math.min(1, t)));
}

/** Bottom sheet on the phone (Science Targets): the share of the panel's height each snap point shows. */
export const SHEET_SNAPS = { peek: 0.34, half: 0.58, full: 0.9 } as const;
export type SheetSnap = keyof typeof SHEET_SNAPS;
/** A drag shorter than this (px) is a tap on the handle. */
export const SHEET_TAP_PX = 8;

/** The print of a downlinked picture: its width in teletype dots, and how long the print takes. */
export const PRINT_DOTS = 180;
export const PRINT_MS = 4600;
/** The full-colour reveal after the print. */
export const REVEAL_MS = 1100;
