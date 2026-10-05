// Pixel layout for the Signal Delay screens: map projection, swipe thresholds, the signal ring. No physics:
// positions come from the engine in metres and are only scaled into the drawing.
import { useEffect, useState } from 'react';
import type { XY } from '../engine/flightMap';

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
