// The Risk meter: the Mission operations Monte Carlo, flown in a Web Worker (riskRunner.ts). While it runs the
// card shows the runs so far and a provisional value; the status only appears when every run is in.
import type { FullEvaluation } from '../../engine/index';
import type { Design } from '../../engine/types';
import * as f from '../format';
import type { RiskState } from '../riskRunner';
import { MeterCard } from './MeterCard';

export function RiskMeterCard({ risk, ev, design, engineer }: { risk: RiskState; ev: FullEvaluation; design: Design; engineer: boolean }) {
  if (risk.status === 'done') {
    return (
      <div className="risk-wrap">
        <MeterCard k="risk" m={risk.estimate.meter} ev={ev} design={design} engineer={engineer} />
        <RunsLine runs={risk.estimate.tally.runs} seed={risk.estimate.seed} />
      </div>
    );
  }
  if (risk.status === 'error') {
    return (
      <section className="meter risk-pending" aria-label="Risk meter">
        <div className="meter-head">
          <span className="h3">Risk</span>
          <span className="sub">simulation stopped</span>
        </div>
        <div className="meter-say">The operations simulation could not finish: {risk.error}</div>
      </section>
    );
  }
  const e = risk.estimate;
  const done = e?.tally.runs ?? 0;
  const planned = e?.planned ?? 0;
  return (
    <section className="meter risk-pending" aria-label="Risk meter" aria-busy="true">
      <div className="meter-head">
        <span className="h3">Risk</span>
        <span className="sub">chance of losing the mission</span>
        <span className="chip computing" role="status">
          <span className="spinner" aria-hidden="true" />
          Simulating
        </span>
      </div>
      <div className="meter-vals">
        <span className="big">
          {e ? f.pct(e.meter.used) : '—'}
          <span className="unit"> provisional</span>
        </span>
      </div>
      <div className="bar" role="progressbar" aria-label="Simulated missions" aria-valuemin={0} aria-valuemax={planned || undefined} aria-valuenow={done}>
        <div className="bar-fill computing" style={{ width: planned ? `${(done / planned) * 100}%` : '0%' }} />
      </div>
      <div className="meter-say">
        {e ? `Flying the mission day by day: ${f.num(done)} of ${f.num(planned)} runs so far.` : 'Preparing the mission timeline for the operations simulation…'}
      </div>
    </section>
  );
}

function RunsLine({ runs, seed }: { runs: number; seed: number }) {
  return (
    <div className="risk-runs mono">
      {f.num(runs)} simulated missions · seed {String(seed)} · Mission operations model
    </div>
  );
}
