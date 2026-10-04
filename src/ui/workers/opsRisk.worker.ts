// Web Worker: flies the Mission operations Monte Carlo behind the Risk meter off the main thread. It only calls
// the engine and posts the running tally; the meter itself is built by the engine (riskEstimateFromTally).
import { emptyTally, mergeTallies, riskBatch, riskEnvironment } from '../../engine/ops/riskEstimate';
import type { RiskJob, RiskMessage } from '../riskRunner';

let current = 0;

const pause = () => new Promise<void>((resolve) => setTimeout(resolve));

async function run(job: RiskJob) {
  current = job.id;
  await pause(); // let a newer job, already queued, replace this one before the expensive set-up
  if (current !== job.id) return;
  try {
    const env = riskEnvironment(job.design);
    let tally = emptyTally();
    for (let from = 0; from < job.runs; from += job.chunk) {
      if (current !== job.id) return;
      tally = mergeTallies(tally, riskBatch(job.design, env, job.seed, from, Math.min(job.chunk, job.runs - from)));
      postMessage({ id: job.id, tally } satisfies RiskMessage);
      await pause();
    }
  } catch (e) {
    postMessage({ id: job.id, error: String(e) } satisfies RiskMessage);
  }
}

self.onmessage = (e: MessageEvent<RiskJob>) => {
  void run(e.data);
};
