// Where the craft is during the flight, for the Flight map and Mission Control (Cadet). Positions are
// ecliptic x, y in metres: heliocentric, or Earth-centred for the Moon (spec: Ephemeris).
// - Cruise: along the transfer path, which trajectory.ts samples evenly in time (Lambert), so a time
//   fraction maps to a path fraction. The Moon transfer is a half ellipse sampled evenly in angle, so there
//   the position comes from Kepler's equation in time. The fixed Bennu route is sampled piecewise; there
//   the position is approximate (drawing and light delay only, never physics).
// - At the destination: the destination's ephemeris position.
// - Trip home (sample return): a straight line from the destination back to Earth (approximate; the
//   return transfer is not modelled, spec: Assumptions).
import { REAL_MISSION_FOR } from './compare';
import { lightDelay_s } from './comms';
import { phaseOnDay, timeline, type PhaseWindow } from './crisis';
import { DESTINATIONS } from './data';
import { earthDistance, heliocentricPosition, julianDate, solveKepler } from './ephemeris';
import { evaluateDesign, type FullEvaluation } from './index';
import { missionPreset, presetDesign, type MissionId } from './missions';
import type { Phase } from './risk';
import { EARTH_ORBIT_PERIOD } from './constants';
import { lerp, onHalfEllipse, positionAt, type XY } from './craftPath';
import type { Design } from './types';

export type { XY } from './craftPath';
export { positionAt } from './craftPath';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function missionTimeline(ev: FullEvaluation): PhaseWindow[] {
  return timeline({
    flightDays: ev.trajectory.flightDays,
    scienceDays: ev.details.scienceDays,
    returnDays: ev.details.sampleReturn ? Math.round(ev.trajectory.flightDays) : undefined,
  });
}

/** Earth, destination and the frame they are drawn in, on a mission day. */
function bodies(design: Design, ev: FullEvaluation) {
  const jd0 = julianDate(ev.details.launchDate);
  if (design.destination === 'moon') {
    const r = earthDistance('moon', jd0);
    const period = DESTINATIONS.moon.orbitPeriod_days.value;
    const flight = ev.trajectory.flightDays;
    return {
      frame: 'earth' as const,
      earth: (_day: number): XY => [0, 0],
      // The transfer ends on the far side ([−r, 0]); the Moon is there on arrival and keeps orbiting.
      dest: (day: number): XY => {
        const th = Math.PI + (2 * Math.PI * (day - flight)) / period;
        return [r * Math.cos(th), r * Math.sin(th)];
      },
      destDistance: (_day: number) => r,
    };
  }
  const xy = (body: 'earth' | Design['destination'], day: number): XY => {
    const p = heliocentricPosition(body, jd0 + day);
    return [p[0], p[1]];
  };
  return {
    frame: 'sun' as const,
    earth: (day: number) => xy('earth', day),
    dest: (day: number) => xy(design.destination, day),
    destDistance: (day: number) => earthDistance(design.destination, jd0 + day),
  };
}

/** Craft position on a mission day (may be fractional). */
export function craftPosition(design: Design, day: number, ev: FullEvaluation = evaluateDesign(design)): XY {
  const b = bodies(design, ev);
  const tl = missionTimeline(ev);
  const flight = ev.trajectory.flightDays;
  const science = tl.find((w) => w.phase === 'science')!;
  const ret = tl.find((w) => w.phase === 'return');
  if (day <= 0) return b.frame === 'earth' ? ev.trajectory.path[0] ?? [0, 0] : b.earth(0);
  if (day < flight) return b.frame === 'earth' ? onHalfEllipse(ev.trajectory.path, day / flight) : positionAt(ev.trajectory.path, day / flight);
  if (!ret || day <= science.endDay) return b.dest(day);
  return lerp(b.dest(science.endDay), b.earth(ret.endDay), clamp01((day - science.endDay) / (ret.endDay - science.endDay)));
}

/** Earth–craft distance and one-way light time on a mission day: t = d / c. */
export function signalDelay(
  design: Design,
  day: number,
  ev: FullEvaluation = evaluateDesign(design),
): { distance_m: number; oneWay_s: number; roundTrip_s: number } {
  const b = bodies(design, ev);
  const tl = missionTimeline(ev);
  const science = tl.find((w) => w.phase === 'science')!;
  const atDestination = day >= ev.trajectory.flightDays && day <= science.endDay;
  const distance_m = atDestination ? b.destDistance(day) : dist(craftPosition(design, day, ev), b.earth(day));
  const oneWay_s = lightDelay_s(distance_m);
  // News of a crisis needs one trip to reach Earth, and a reply one more trip back to the craft.
  return { distance_m, oneWay_s, roundTrip_s: 2 * oneWay_s };
}

/** Seconds left before a signal arrives, a fraction of the way through its trip. */
export function countdown(oneWay_s: number, fraction: number): number {
  return oneWay_s * (1 - clamp01(fraction));
}

export interface FlightFrame {
  day: number;
  phase: Phase;
  craft: XY;
  earth: XY;
  dest: XY;
  earthDistance_m: number;
  /** One-way light time Earth ↔ craft (s). */
  oneWay_s: number;
}

/**
 * Frames for the Flight screen: whole days from launch to endDay, evenly spread, always including the
 * arrival day and the crisis day so the animation can stop exactly there.
 */
export function flightFrames(
  design: Design,
  opts: { endDay: number; crisisDay?: number; frames?: number },
  ev: FullEvaluation = evaluateDesign(design),
): FlightFrame[] {
  const n = Math.max(2, opts.frames ?? 80);
  const tl = missionTimeline(ev);
  const b = bodies(design, ev);
  const days = new Set<number>();
  for (let i = 0; i < n; i++) days.add(Math.round((opts.endDay * i) / (n - 1)));
  const arrival = Math.round(ev.trajectory.flightDays);
  if (arrival <= opts.endDay) days.add(arrival);
  if (opts.crisisDay !== undefined && opts.crisisDay <= opts.endDay) days.add(opts.crisisDay);
  const last = tl[tl.length - 1]!.phase;
  return [...days]
    .sort((a, b2) => a - b2)
    .map((day) => {
      const s = signalDelay(design, day, ev);
      return {
        day,
        phase: phaseOnDay(tl, day) ?? last,
        craft: craftPosition(design, day, ev),
        earth: b.earth(day),
        dest: b.dest(day),
        earthDistance_m: s.distance_m,
        oneWay_s: s.oneWay_s,
      };
    });
}

export interface FlightMapGeometry {
  /** 'sun': heliocentric; 'earth': Earth-centred (Moon). */
  frame: 'sun' | 'earth';
  earthOrbit: XY[];
  destOrbit: XY[];
  /** The player's transfer (evaluateDesign().trajectory.path). */
  path: XY[];
  /** Half-width of a square that holds everything (m), for drawing. */
  extent_m: number;
}

/** Static map: one full orbit of Earth and of the destination, and the transfer path. */
export function flightMap(design: Design, ev: FullEvaluation = evaluateDesign(design)): FlightMapGeometry {
  const b = bodies(design, ev);
  const loop = (f: (day: number) => XY, period: number, n: number) => Array.from({ length: n + 1 }, (_, i) => f((period * i) / n));
  const earthOrbit = b.frame === 'sun' ? loop(b.earth, EARTH_ORBIT_PERIOD.value, 96) : [];
  const destOrbit = loop(b.dest, DESTINATIONS[design.destination].orbitPeriod_days.value, 128);
  const path = ev.trajectory.path;
  const extent_m = 1.08 * Math.max(...[...earthOrbit, ...destOrbit, ...path].map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
  return { frame: b.frame, earthOrbit, destOrbit, path, extent_m };
}

export interface Ghost {
  missionId: MissionId;
  /** The real mission's label, e.g. "MAVEN (2013–2025)". */
  label: string;
  launchDate: string;
  /** The real mission's flight time (days), from the same engine. */
  flightDays: number;
  /** How far the real path is turned about the Sun to start beside the player (rad). */
  rotation_rad: number;
  path: XY[];
  /** The ghost craft on a mission day: by real flight time, waiting at the destination after arrival. */
  at: (day: number) => XY;
}

/**
 * The real NASA mission's path for the flight map (Mars: MAVEN, Bennu: OSIRIS-REx; spec UI rule 5),
 * from its sourced preset through the same evaluateDesign. It flew in another year, when the planets
 * stood elsewhere, so the path is turned about the Sun to start where the player starts. A rotation keeps
 * its shape and every Sun distance. No ghost where there is no sourced preset.
 */
export function ghostFor(design: Design, ev: FullEvaluation = evaluateDesign(design)): Ghost | undefined {
  const id = REAL_MISSION_FOR[design.destination];
  if (!id) return undefined;
  const real = evaluateDesign(presetDesign(id));
  const rp = real.trajectory.path;
  const pp = ev.trajectory.path;
  if (!rp[0] || !pp[0]) return undefined;
  const rotation_rad = Math.atan2(pp[0][1], pp[0][0]) - Math.atan2(rp[0][1], rp[0][0]);
  const c = Math.cos(rotation_rad);
  const s = Math.sin(rotation_rad);
  const path = rp.map(([x, y]): XY => [x * c - y * s, x * s + y * c]);
  const flightDays = real.trajectory.flightDays;
  return {
    missionId: id,
    label: missionPreset(id).label,
    launchDate: real.details.launchDate,
    flightDays,
    rotation_rad,
    path,
    at: (day) => positionAt(path, day / flightDays),
  };
}
