// Runs the Risk meter's Mission operations Monte Carlo: in a Web Worker in the browser, or in small time slices
// on the main thread where there is no Worker (jsdom tests). The UI never computes the meter: every partial
// tally goes through the engine's riskEstimateFromTally.
import { useEffect, useState } from 'react';
import { emptyTally, mergeTallies, riskBatch, riskEnvironment, riskEstimateFromTally, RISK_RUNS, RISK_SEED, type RiskEstimate, type RiskTally } from '../engine/ops/riskEstimate';
import type { Design } from '../engine/types';

export interface RiskJob {
  id: number;
  design: Design;
  seed: number;
  runs: number;
  /** Runs per partial result. */
  chunk: number;
}

export type RiskMessage = { id: number; tally: RiskTally } | { id: number; error: string };

export interface RiskRunner {
  /** Start a job; onTally gets the running tally after each chunk. Returns a cancel function. */
  start(job: RiskJob, onTally: (t: RiskTally) => void, onError: (e: string) => void): () => void;
}

/** Main-thread runner: one chunk per timer tick, so the page stays responsive. */
export function inlineRunner(): RiskRunner {
  return {
    start(job, onTally, onError) {
      let cancelled = false;
      const runs = job.runs;
      let tally = emptyTally();
      let env: ReturnType<typeof riskEnvironment> | undefined;
      const step = (from: number) => {
        if (cancelled) return;
        try {
          env ??= riskEnvironment(job.design);
          tally = mergeTallies(tally, riskBatch(job.design, env, job.seed, from, Math.min(job.chunk, runs - from)));
          onTally(tally);
          if (from + job.chunk < runs) setTimeout(() => step(from + job.chunk));
        } catch (e) {
          onError(String(e));
        }
      };
      setTimeout(() => step(0));
      return () => {
        cancelled = true;
      };
    },
  };
}

/** Web Worker runner: one worker for the page; a new job replaces the one in progress. */
export function workerRunner(): RiskRunner {
  let worker: Worker | undefined;
  const listeners = new Map<number, { onTally: (t: RiskTally) => void; onError: (e: string) => void }>();
  return {
    start(job, onTally, onError) {
      if (!worker) {
        worker = new Worker(new URL('./workers/opsRisk.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<RiskMessage>) => {
          const l = listeners.get(e.data.id);
          if (!l) return;
          if ('error' in e.data) l.onError(e.data.error);
          else l.onTally(e.data.tally);
        };
      }
      listeners.clear();
      listeners.set(job.id, { onTally, onError });
      worker.postMessage(job);
      return () => listeners.delete(job.id);
    },
  };
}

let runner: RiskRunner | undefined;
let defaultRuns: number | undefined;
/** Tests swap in the inline runner and fewer runs (the engine still flies every one of them). */
export function setRiskRunner(r: RiskRunner | undefined, runs?: number) {
  runner = r;
  defaultRuns = runs;
}
const activeRunner = () => (runner ??= typeof Worker === 'undefined' ? inlineRunner() : workerRunner());

/** Wait this long after the last design change before flying the Monte Carlo again (layout timing). */
export const RISK_DEBOUNCE_MS = 300;
const CHUNK = 25;

let nextId = 1;
const cache = new Map<string, RiskEstimate>();

export type RiskState = { status: 'computing'; estimate?: RiskEstimate } | { status: 'done'; estimate: RiskEstimate } | { status: 'error'; error: string };

/** The Risk meter for a design, filled in as the Monte Carlo runs. Finished results are cached per design. */
export function useOpsRisk(design: Design, opts: { runs?: number; seed?: number } = {}): RiskState {
  const runs = opts.runs ?? defaultRuns ?? RISK_RUNS.value;
  const seed = opts.seed ?? RISK_SEED.value;
  const key = JSON.stringify([design, runs, seed]);
  const [state, setState] = useState<RiskState>(() => {
    const hit = cache.get(key);
    return hit ? { status: 'done', estimate: hit } : { status: 'computing' };
  });

  useEffect(() => {
    const hit = cache.get(key);
    if (hit) {
      setState({ status: 'done', estimate: hit });
      return;
    }
    setState((s) => ({ status: 'computing', ...(s.status !== 'error' && s.estimate ? { estimate: s.estimate } : {}) }));
    let cancel: (() => void) | undefined;
    const timer = setTimeout(() => {
      const id = nextId++;
      cancel = activeRunner().start(
        { id, design, seed, runs, chunk: CHUNK },
        (t) => {
          const estimate = riskEstimateFromTally(t, seed, runs);
          if (estimate.complete) {
            cache.set(key, estimate);
            setState({ status: 'done', estimate });
          } else setState({ status: 'computing', estimate });
        },
        (error) => setState({ status: 'error', error }),
      );
    }, RISK_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      cancel?.();
    };
    // `key` captures the design, run count and seed.
  }, [key]);
  return state;
}
