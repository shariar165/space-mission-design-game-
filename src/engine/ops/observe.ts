// Science targets in Mission operations (spec: Science targets and downlink). An OBSERVE order is a command on the
// light-delayed path; when it arrives the craft prices the picture with science.ts from its own orbit and mass,
// observes, and keeps the picture in its image queue until a DSN pass sends it home. A picture is home one light
// time after its last bit leaves the craft. Science returned at Mars is the weight of the targets home.
import { DESTINATIONS, OPERATIONS } from '../data';
import { observationPlan, SCIENCE_RULES, type ObservationPlan } from '../science';
import { TARGETS, targetById, type Target } from '../targets';
import { gameEstimate, type Sourced } from '../types';
import type { ImageRecord, OpsEnvironment, OpsState } from './types';

/** Game rules for the drag-heating hazard's rate (registered in the data audit). */
export const OBSERVE_RULES = {
  dragHeatingRate_perDay: gameEstimate(
    0.004,
    'per day at MAVEN’s nominal periapsis density',
    'Game estimate (Science targets): the drag-heating hazard’s rate, scaled by ρ/ρ_nominal while a low pass or a deep dip lasts',
  ),
} satisfies Record<string, Sourced<number>>;

/** True at Mars: the destination with science targets. */
export const hasTargets = (env: OpsEnvironment) => env.design.destination === 'mars';

/** The orbit the craft flies in the science phase (altitudes, km) and its inclination. */
export function scienceOrbitOf(env: OpsEnvironment) {
  const d = env.design;
  const o = d.scienceOrbit ?? d.captureOrbit;
  return { periapsis_km: o.periapsis_km, apoapsis_km: o.apoapsis_km, inclination_deg: d.scienceOrbit?.inclination_deg ?? OPERATIONS.orbitDefaults.inclination_deg.value };
}

export function inDustSeason(ls: number | undefined): boolean {
  const d = OPERATIONS.marsDust;
  return ls !== undefined && ls >= d.seasonStartLs_deg.value && ls < d.seasonEndLs_deg.value;
}

/** What observing a target costs at time t: the craft's orbit and mass now, and that day's dust season. */
export function observationFor(s: OpsState, target: Target, t = s.t): ObservationPlan {
  const env = s.env;
  const o = scienceOrbitOf(env);
  const R_km = DESTINATIONS.mars.radius_km.value;
  const day = env.days[Math.max(0, Math.min(Math.floor(t), env.horizonDay))]!;
  return observationPlan(target, {
    rp_m: (R_km + o.periapsis_km) * 1000,
    ra_m: (R_km + o.apoapsis_km) * 1000,
    inclination_deg: o.inclination_deg,
    area_m2: (env.design.power.arrayArea_m2 ?? 0) + SCIENCE_RULES.busFace_m2.value,
    mass_kg: s.mass_kg,
    inDustSeason: inDustSeason(day.ls_deg),
  });
}

/** The drag-heating factor of every observation under way at t (0 when none flies low). */
export function dragFactorAt(s: OpsState, t: number): number {
  return s.images.reduce((a, im) => (im.status !== 'refused' && im.startedAt <= t && t < im.takenAt ? a + im.dragFactor : a), 0);
}

/** Extra camera load at t (W). */
export function observeLoadAt(s: OpsState, t: number): number {
  return s.images.reduce((a, im) => (im.status !== 'refused' && im.startedAt <= t && t < im.takenAt ? a + im.load_W : a), 0);
}

/** The picture of a target, if it was ordered and not refused. */
export const imageOf = (s: OpsState, targetId: string): ImageRecord | undefined =>
  s.images.find((im) => im.targetId === targetId && im.status !== 'refused');

/** A picture counts once its last bit has left the craft within the prime mission (it reaches Earth whatever happens next). */
export const countsForScience = (s: OpsState, im: ImageRecord) =>
  im.status === 'sent' && im.sentAt !== undefined && im.sentAt < s.env.primeEndDay + 1;

export interface TargetScience {
  /** Science returned, 0–1: Σ weights of the targets whose pictures came home. */
  fraction: number;
  /** Targets whose pictures came home (or are on their way home), in data order. */
  home: string[];
  /** Cut off part-way down when the craft was lost: share of the bits that made it. */
  partial: { targetId: string; fraction: number }[];
}

export function targetScience(s: OpsState): TargetScience {
  const home: string[] = [];
  const partial: TargetScience['partial'] = [];
  let fraction = 0;
  for (const t of TARGETS) {
    const im = imageOf(s, t.id);
    if (!im) continue;
    if (countsForScience(s, im)) {
      home.push(t.id);
      fraction += t.weight.value;
    } else if (im.sentBits > 0 && im.bits > 0) partial.push({ targetId: t.id, fraction: im.sentBits / im.bits });
  }
  return { fraction: Math.min(1, fraction), home, partial };
}

/** Prime science returned, 0–1 (spec: Scoring): target weights at Mars, data downlinked ÷ goal elsewhere. */
export function scienceReturned(s: OpsState): number {
  if (hasTargets(s.env)) return targetScience(s).fraction;
  const sci = s.env.timeline.find((w) => w.phase === 'science')!;
  const goal = s.env.loads.instruments.reduce((a, i) => a + i.data_bitsPerDay, 0) * (sci.endDay - sci.startDay + 1);
  return goal > 0 ? Math.min(1, s.downlinkedPrime_bits / goal) : 0;
}

/** The first science has come home (Mars: the first picture sent; elsewhere: the first data). */
export function firstScienceHome(s: OpsState): boolean {
  return hasTargets(s.env) ? s.images.some((im) => countsForScience(s, im)) : s.downlinkedPrime_bits > 0;
}

export { targetById };
