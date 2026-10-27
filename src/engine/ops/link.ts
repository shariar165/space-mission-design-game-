// Behind the Moon (spec: Moon orbit). In a low lunar orbit the craft spends part of every orbit on the far side,
// where the Moon blocks the line to Earth: no orders reach it and nothing it sends gets home. The orbit is fixed in
// inertial space with mean anomaly M = n·(t − arrivalDay), and Earth's direction is the Moon's sub-Earth point, so
// every loss of signal (LOS) and acquisition of signal (AOS) has an exact time.
import { earthDirection, inShadow, orbitPosition } from './predictable';
import type { OpsEnvironment } from './types';
import type { Vec3 } from '../types';

const DAY_S = 86_400;
/** Search step (fraction of an orbit) and the bisection tolerance (days, about 0.01 s). */
const STEPS_PER_ORBIT = 180;
const TOL_DAYS = 1e-7;

/** True when this moment is in the science orbit at the Moon, where the far side can hide the craft. */
function inFarSideOrbit(env: OpsEnvironment, t: number): boolean {
  return env.farSide !== undefined && env.days[Math.floor(t)]?.visibleFraction !== undefined;
}

function hidden(env: OpsEnvironment, t: number, earth: Vec3): boolean {
  const o = env.farSide!.orbit;
  return inShadow(orbitPosition(o, o.n * (t - env.arrivalDay) * DAY_S), earth, o.bodyRadius);
}

const earthAt = (env: OpsEnvironment, t: number) => earthDirection(env.design.destination, env.jdLaunch + t)!;

/** Can Earth see the craft at mission time t (days)? Always, except behind the Moon. */
export function linkUpAt(env: OpsEnvironment, t: number): boolean {
  return !inFarSideOrbit(env, t) || !hidden(env, t, earthAt(env, t));
}

/** The first time ≥ t (days) the link is up: t itself when Earth can see the craft, else the next AOS. */
export function nextAos(env: OpsEnvironment, t: number): number {
  if (linkUpAt(env, t)) return t;
  const step = env.farSide!.orbit.period_s / STEPS_PER_ORBIT / DAY_S;
  const down = (x: number) => !linkUpAt(env, x);
  let lo = t;
  let hi = t + step;
  for (let k = 0; k <= STEPS_PER_ORBIT && down(hi); k++) {
    lo = hi;
    hi += step;
  }
  while (hi - lo > TOL_DAYS) {
    const mid = (lo + hi) / 2;
    if (down(mid)) lo = mid;
    else hi = mid;
  }
  return hi;
}
