// Rescue History (Cadet): a real lost mission, its published design sheet and the clues from its failure
// report. The player finds the bug before launch. Every fact is Sourced (src/data/rescueCases.json); the
// consequence numbers are computed here from those facts.
import rescueCasesJson from '../data/rescueCases.json';
import { G0 } from './constants';
import { gameEstimate, sourced, type DestinationId, type Sourced } from './types';

export interface RescueClue {
  id: string;
  title: string;
  /** What the player sees before looking closer. */
  text: string;
  isBug: boolean;
  /** What the game says when this clue is picked. */
  verdict: string;
  /** The finding in the failure report (ⓘ). */
  evidence: Sourced<string>;
}

export interface RescueCase {
  id: string;
  title: string;
  year: string;
  destination: DestinationId;
  lost: Sourced<string>;
  facts: {
    launchDate: Sourced<string>;
    launchVehicle: Sourced<string>;
    launchMass_kg: Sourced<number>;
    dryMass_kg: Sourced<number>;
    propellant_kg: Sourced<number>;
    powerAtMars_W: Sourced<number>;
    mainEngineThrust_N: Sourced<number>;
    arrivalDate: Sourced<string>;
    earthDistanceAtArrival_1e6km: Sourced<number>;
    lightTimeAtArrival_s: Sourced<number>;
    plannedPeriapsis_km: Sourced<number>;
    predictedBeforeArrival_km: Sourced<number>;
    survivableMinPeriapsis_km: Sourced<number>;
    estimatedPeriapsis_km: Sourced<number>;
  };
  clues: RescueClue[];
}

export type RescueCaseId = 'mco';

const CASES = rescueCasesJson as unknown as Record<RescueCaseId, Omit<RescueCase, 'id'>>;

export const RESCUE_CASE_IDS = Object.keys(CASES) as RescueCaseId[];

/** One pound-force in newtons: 0.45359237 kg × g₀ (both exact), so the factor is exact. */
export const LBF_TO_N = sourced(0.45359237 * G0.value, 'N per lbf', 'Exact by definition: 1 lbf = 0.45359237 kg × 9.80665 m/s² (NIST SP 811)', {
  url: 'https://www.nist.gov/pml/special-publication-811',
});

/** Stars for finding the bug: three on the first try, one fewer per wrong guess, at least one. */
export const RESCUE_MAX_STARS = gameEstimate(3, 'stars', 'Game rule (Rescue History): three stars on the first try, one fewer per wrong guess, never fewer than one');

export function rescueCase(id: RescueCaseId): RescueCase {
  const c = CASES[id];
  if (!c) throw new Error(`Unknown rescue case "${id}"`);
  return { id, ...c };
}

export function inspectClue(caseId: RescueCaseId, clueId: string): RescueClue {
  const clue = rescueCase(caseId).clues.find((x) => x.id === clueId);
  if (!clue) throw new Error(`Unknown clue "${clueId}" for ${caseId}`);
  return clue;
}

/**
 * The bare number of an impulse written in lbf·s, read by software that expects N·s. The value is the
 * same number, so the true impulse (× 4.448) is under-counted by the factor LBF_TO_N.
 */
export const impulseReadAsNewtonSeconds = (lbfSeconds: number): number => lbfSeconds;

/** What the bug did on arrival: how far below plan the craft came in, and how far below the survivable limit. */
export function rescueConsequence(caseId: RescueCaseId): {
  factor: Sourced<number>;
  planned_km: number;
  survivable_km: number;
  estimated_km: number;
  missedBy_km: number;
  belowSurvivable_km: number;
} {
  const f = rescueCase(caseId).facts;
  return {
    factor: LBF_TO_N,
    planned_km: f.plannedPeriapsis_km.value,
    survivable_km: f.survivableMinPeriapsis_km.value,
    estimated_km: f.estimatedPeriapsis_km.value,
    missedBy_km: f.plannedPeriapsis_km.value - f.estimatedPeriapsis_km.value,
    belowSurvivable_km: f.survivableMinPeriapsis_km.value - f.estimatedPeriapsis_km.value,
  };
}

export function rescueStars(attempts: number): number {
  return Math.max(1, RESCUE_MAX_STARS.value - Math.max(0, attempts - 1));
}
