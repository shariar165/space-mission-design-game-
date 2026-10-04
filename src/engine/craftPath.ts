// Where the craft is, from the trajectory alone (no evaluateDesign import, so power.ts, flightMap.ts and
// Mission operations can all share it). Positions are ecliptic x, y in metres: heliocentric, or Earth-centred
// for the Moon (spec: Ephemeris).
// - Cruise: along the transfer path, which trajectory.ts samples evenly in time (Lambert), so a time fraction
//   maps to a path fraction. The Moon transfer is a half ellipse sampled evenly in angle, so there the
//   position comes from Kepler's equation in time. The fixed Bennu route is sampled piecewise (approximate).
// - At the destination: the destination's ephemeris position.
// - Trip home (sample return): a straight line from the destination back to Earth (approximate; the return
//   transfer is not modelled, spec: Assumptions).
import { heliocentricPosition, solveKepler, sunDistance } from './ephemeris';
import type { DestinationId } from './types';

export type XY = [number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The point a fraction of the way along a sampled path (linear between samples). */
export function positionAt(path: XY[], fraction: number): XY {
  if (path.length === 0) return [0, 0];
  const f = clamp01(fraction) * (path.length - 1);
  const i = Math.floor(f);
  return lerp(path[i]!, path[Math.min(i + 1, path.length - 1)]!, f - i);
}

/**
 * Position on a periapsis → apoapsis half ellipse a time fraction of the way along: M = π·fraction,
 * M = E − e sin E, r = a(1 − e cos E), ν from E. The ellipse is read off the path's end points.
 */
export function onHalfEllipse(path: XY[], fraction: number): XY {
  const r1 = Math.hypot(...(path[0] ?? [0, 0]));
  const r2 = Math.hypot(...(path[path.length - 1] ?? [0, 0]));
  const a = (r1 + r2) / 2;
  const e = (r2 - r1) / (r2 + r1);
  const E = solveKepler(Math.PI * clamp01(fraction), e);
  const r = a * (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  return [r * Math.cos(nu), r * Math.sin(nu)];
}

export interface CraftPathInput {
  destination: DestinationId;
  jdLaunch: number;
  /** Transfer time (days, may be fractional) and the sampled transfer path. */
  flightDays: number;
  path: XY[];
  /** Last science day and, for sample return, the last day of the trip home. */
  scienceEndDay: number;
  returnEndDay?: number;
}

/**
 * Craft distance from the Sun on a mission day (m). The Moon sits at Earth's distance from the Sun.
 * At the destination (arrival through the end of science, and any extension) it is the destination's own.
 */
export function craftSunDistance(c: CraftPathInput, day: number): number {
  const jd = c.jdLaunch + day;
  if (c.destination === 'moon') return sunDistance('earth', jd);
  const xy = (body: 'earth' | DestinationId, d: number): XY => {
    const p = heliocentricPosition(body, c.jdLaunch + d);
    return [p[0], p[1]];
  };
  if (day <= 0) return Math.hypot(...xy('earth', 0));
  if (day < c.flightDays) return Math.hypot(...positionAt(c.path, day / c.flightDays));
  if (c.returnEndDay === undefined || day <= c.scienceEndDay) return sunDistance(c.destination, jd);
  const t = clamp01((day - c.scienceEndDay) / (c.returnEndDay - c.scienceEndDay));
  return Math.hypot(...lerp(xy(c.destination, c.scienceEndDay), xy('earth', c.returnEndDay), t));
}
