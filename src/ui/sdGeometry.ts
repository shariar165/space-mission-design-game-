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
