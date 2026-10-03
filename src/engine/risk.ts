// Spec section: "Risk model and crisis cards" — phase risk and Monte Carlo.
// p_fail,phase = p_base,phase · Π f_i(margin_i). Launch uses the vehicle's Laplace p_success.
import { GAME_RULES } from './constants';
import { makeMeter } from './meter';
import { gameEstimate, type Meter, type Sourced } from './types';

export type Phase = 'launch' | 'cruise' | 'arrival' | 'science' | 'return';

/** Base failure rates for non-launch phases are game values (spec: Assumptions 10). */
export const BASE_RISK = {
  cruise: gameEstimate(0.02, 'probability', 'Game value: base cruise failure rate (spec: Risk model)'),
  arrival: gameEstimate(0.04, 'probability', 'Game value: base orbit-insertion / rendezvous failure rate (spec: Risk model)'),
  sciencePerYear: gameEstimate(0.02, 'probability per year', 'Game value: base science-operations failure rate per year'),
  return: gameEstimate(0.03, 'probability', 'Game value: base sample-return failure rate (cruise home + capsule entry)'),
};

/** f(m) at 0% margin; f rises linearly from 1 at the recommended margin to this value. */
export const MARGIN_RISK_FACTOR_AT_ZERO = gameEstimate(3, 'factor', 'Game rule: risk is 3× the base rate at 0% margin');

/** Limit of the Risk meter. */
export const ACCEPTABLE_MISSION_RISK = gameEstimate(0.2, 'probability', 'Game rule: Risk meter limit (mission failure probability)');

/**
 * f(m) = 1 at or above the recommended margin (10%), rising linearly to 3 at 0%.
 * A negative margin means the resource runs out: the phase fails for certain (f = ∞).
 */
export function marginFactor(margin: number): number {
  const rec = GAME_RULES.marginWarning.value;
  if (margin < 0) return Infinity;
  if (margin >= rec) return 1;
  return 1 + (MARGIN_RISK_FACTOR_AT_ZERO.value - 1) * ((rec - margin) / rec);
}

/** p_fail = p_base · Π f(margin_i), capped at 1. */
export function phaseFailure(base: number, margins: number[]): number {
  const p = margins.reduce((acc, m) => acc * marginFactor(m), base);
  return Math.min(1, p);
}

/** Mission failure probability = 1 − Π(1 − p_i). */
export function combine(ps: number[]): number {
  return 1 - ps.reduce((acc, p) => acc * (1 - p), 1);
}

export interface PhaseRisk {
  phase: Phase;
  pFail: number;
  base: Sourced<number>;
  /** Margin factors that multiplied the base rate, by name. */
  factors: Record<string, number>;
}

/**
 * Which margins push which phase (game rule): cruise ← power; arrival (capture or rendezvous) ← Δv;
 * science ← power, with the base rate compounding per year; return ← Δv.
 */
export function phaseRisks(p: {
  missionType: 'orbiter' | 'rendezvous';
  launchSuccess: number;
  deltaVMargin: number;
  powerMargin: number;
  scienceDays: number;
  sampleReturn?: boolean;
}): PhaseRisk[] {
  const fP = marginFactor(p.powerMargin);
  const fDv = marginFactor(p.deltaVMargin);
  const years = p.scienceDays / 365.25;
  const scienceBase = 1 - (1 - BASE_RISK.sciencePerYear.value) ** years;
  const phases: PhaseRisk[] = [
    {
      phase: 'launch',
      pFail: 1 - p.launchSuccess,
      base: gameEstimate(1 - p.launchSuccess, 'probability', 'Launch: 1 − p_success, Laplace estimate from the vehicle flight record'),
      factors: {},
    },
    { phase: 'cruise', pFail: phaseFailure(BASE_RISK.cruise.value, [p.powerMargin]), base: BASE_RISK.cruise, factors: { power: fP } },
    { phase: 'arrival', pFail: phaseFailure(BASE_RISK.arrival.value, [p.deltaVMargin]), base: BASE_RISK.arrival, factors: { deltaV: fDv } },
    { phase: 'science', pFail: phaseFailure(scienceBase, [p.powerMargin]), base: BASE_RISK.sciencePerYear, factors: { power: fP } },
  ];
  if (p.sampleReturn) {
    phases.push({ phase: 'return', pFail: phaseFailure(BASE_RISK.return.value, [p.deltaVMargin]), base: BASE_RISK.return, factors: { deltaV: fDv } });
  }
  return phases;
}

/** Risk meter: used = mission failure probability; limit = acceptable risk; margin = (limit − used)/limit. */
export function riskMeter(phases: PhaseRisk[]): Meter {
  const used = combine(phases.map((p) => p.pFail));
  const limit = ACCEPTABLE_MISSION_RISK.value;
  const inputs: Record<string, Sourced<number>> = { acceptableRisk: ACCEPTABLE_MISSION_RISK };
  for (const p of phases) inputs[`base_${p.phase}`] = p.base;
  return makeMeter(used, limit, (limit - used) / limit, 'p_fail,phase = p_base·Π f_i(margin_i); p_mission = 1 − Π(1 − p_phase)', inputs);
}

/** Seeded uniform random numbers on [0, 1) (mulberry32), so Monte Carlo runs are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fly the phases n times; each phase fails with its own probability. */
export function monteCarlo(
  phases: Pick<PhaseRisk, 'phase' | 'pFail'>[],
  n: number,
  rng: () => number,
): { successes: number; successRate: number; failuresByPhase: Partial<Record<Phase, number>> } {
  let successes = 0;
  const failuresByPhase: Partial<Record<Phase, number>> = {};
  for (let i = 0; i < n; i++) {
    const failed = phases.find((p) => rng() < p.pFail);
    if (failed) failuresByPhase[failed.phase] = (failuresByPhase[failed.phase] ?? 0) + 1;
    else successes++;
  }
  return { successes, successRate: successes / n, failuresByPhase };
}
