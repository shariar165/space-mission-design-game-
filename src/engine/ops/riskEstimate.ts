// The Risk meter from Mission operations (spec: Risk model, v0.5). The engine flies the design many times
// through the day-by-day Ops simulation and counts how often the prime mission is lost. There is no separate
// risk formula: the meter is the Monte Carlo, shown with its run count and seed.
//
// Pure and worker-safe: plain data in, plain data out. Run i always uses the same seed, so the result does not
// depend on how the runs are split into batches (a Web Worker reports partial results as it goes).
import { ACCEPTABLE_MISSION_RISK } from '../risk';
import { makeMeter } from '../meter';
import { gameEstimate, sourced, type Design, type Meter, type Sourced } from '../types';
import { runOperations } from './index';
import { fnv1a } from './random';
import { prepareOps } from './timeline';
import type { OpsEnvironment, OpsPhase } from './types';

/** Runs behind the meter (game rule): enough for a standard error of about ±1.3 points at a 10% loss rate. */
export const RISK_RUNS = gameEstimate(500, 'runs', 'Game rule: Mission operations Monte Carlo runs behind the Risk meter');
/** Seed of the risk Monte Carlo: the same seed as Engineer mode's Monte Carlo (decision 17), so demos repeat. */
export const RISK_SEED = gameEstimate(2013, 'seed', 'Game rule: fixed seed so the Risk meter is reproducible (spec decision 17)');

export type LossPhase = OpsPhase | 'not-launched';

export interface RiskTally {
  runs: number;
  lost: number;
  lostByPhase: Partial<Record<LossPhase, number>>;
}

export const emptyTally = (): RiskTally => ({ runs: 0, lost: 0, lostByPhase: {} });

/** The seed of run i: the meter's seed mixed with the run's own hash (as subRng mixes hazard streams). */
export function runSeed(seed: number, i: number): number {
  return (Math.imul(seed >>> 0, 0x9e3779b1) ^ fnv1a(`risk-run-${i}`)) >>> 0;
}

/** Everything the runs share: built once per design (the expensive part). */
export const riskEnvironment = (design: Design): OpsEnvironment => prepareOps(design);

/**
 * Fly runs [from, from + count) with the safest response to every hazard and no extension (game rule: the
 * meter is the design's risk with a careful team). A design that cannot launch is lost in every run.
 */
export function riskBatch(design: Design, env: OpsEnvironment, seed: number, from: number, count: number): RiskTally {
  const t = emptyTally();
  for (let i = from; i < from + count; i++) {
    const { debrief } = runOperations(design, { seed: runSeed(seed, i), env, policy: 'safe', extension: 'end' });
    t.runs++;
    if (debrief.completed) continue;
    t.lost++;
    const phase: LossPhase = debrief.launched ? (debrief.failedPhase ?? 'science') : 'not-launched';
    t.lostByPhase[phase] = (t.lostByPhase[phase] ?? 0) + 1;
  }
  return t;
}

export function mergeTallies(a: RiskTally, b: RiskTally): RiskTally {
  const lostByPhase: RiskTally['lostByPhase'] = { ...a.lostByPhase };
  for (const [k, v] of Object.entries(b.lostByPhase) as [LossPhase, number][]) lostByPhase[k] = (lostByPhase[k] ?? 0) + v;
  return { runs: a.runs + b.runs, lost: a.lost + b.lost, lostByPhase };
}

export interface RiskEstimate {
  meter: Meter;
  tally: RiskTally;
  seed: number;
  /** Runs planned; the estimate is complete when tally.runs = planned. */
  planned: number;
  complete: boolean;
  /** Standard error of the loss fraction: √(p(1 − p)/N). */
  stdErr: number;
}

const derived = (value: number, unit: string, equation: string): Sourced<number> => sourced(value, unit, `Computed by the engine: ${equation}`);

/** Risk meter: used = lost runs / runs; limit = acceptable mission risk; margin = (limit − used)/limit. */
export function riskEstimateFromTally(t: RiskTally, seed: number, planned: number): RiskEstimate {
  const n = Math.max(1, t.runs);
  const p = t.lost / n;
  const stdErr = Math.sqrt((p * (1 - p)) / n);
  const limit = ACCEPTABLE_MISSION_RISK.value;
  const inputs: Record<string, Sourced<number>> = {
    runs: derived(t.runs, 'runs', 'Mission operations Monte Carlo runs flown so far'),
    lostRuns: derived(t.lost, 'runs', 'runs whose prime mission was lost'),
    standardError: derived(stdErr, 'probability', '√(p(1 − p)/N)'),
    seed: RISK_SEED.value === seed ? RISK_SEED : sourced(seed, 'seed', 'Seed of this Monte Carlo'),
    acceptableRisk: ACCEPTABLE_MISSION_RISK,
  };
  const meter = makeMeter(p, limit, (limit - p) / limit, 'p_loss ≈ lost runs / N (Mission operations Monte Carlo, safest responses, seeded)', inputs);
  meter.limitSource = ACCEPTABLE_MISSION_RISK;
  return { meter, tally: t, seed, planned, complete: t.runs >= planned, stdErr };
}

/** The whole estimate in one call (tests and the no-worker fallback). */
export function opsRiskEstimate(design: Design, opts: { runs?: number; seed?: number; env?: OpsEnvironment } = {}): RiskEstimate {
  const runs = opts.runs ?? RISK_RUNS.value;
  const seed = opts.seed ?? RISK_SEED.value;
  const env = opts.env ?? riskEnvironment(design);
  return riskEstimateFromTally(riskBatch(design, env, seed, 0, runs), seed, runs);
}
