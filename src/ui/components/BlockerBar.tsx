import { METER_KEYS } from '../../engine/compare';
import type { FullEvaluation } from '../../engine/index';
import { warningText } from '../meters';
import type { RiskState } from '../riskRunner';
import { StatusChip } from './StatusChip';

/** Plain-language blockers (engine), meter warnings, and engine notes. */
export function BlockerBar({ ev, engineer, risk }: { ev: FullEvaluation; engineer: boolean; risk?: RiskState }) {
  const warnings = METER_KEYS.filter((k) => ev.meters[k].status === 'warning');
  const riskMeter = risk?.status === 'done' ? risk.estimate.meter : undefined;
  const blocked = ev.blockers.length > 0;
  return (
    <div className={`blockers${blocked ? '' : ' clear'}`} role="status" aria-live="polite">
      <div className="blockers-head">
        <span>{blocked ? 'Launch blocked' : 'Ready to launch'}</span>
        <span className="faint mono" style={{ fontSize: 11 }}>
          {blocked ? `Fix ${ev.blockers.length} ${ev.blockers.length === 1 ? 'issue' : 'issues'} to continue` : 'All limits met'}
        </span>
      </div>
      {ev.blockers.map((b) => (
        <div className="blocker" key={b}>
          <StatusChip status="over" plain short />
          <span>{b}</span>
        </div>
      ))}
      {warnings.map((k) => (
        <div className="blocker" key={k}>
          <StatusChip status="warning" plain />
          <span>{warningText(k, ev.meters[k])}</span>
        </div>
      ))}
      {riskMeter && riskMeter.status !== 'ok' && (
        <div className="blocker">
          <StatusChip status="warning" plain />
          <span>{warningText('risk', riskMeter)}</span>
        </div>
      )}
      {ev.notes.length > 0 && (engineer || blocked || ev.notes.some((n) => n.includes('not modelled'))) && (
        <div className="notes">
          {ev.notes.map((n) => (
            <div key={n}>· {n}</div>
          ))}
        </div>
      )}
    </div>
  );
}
