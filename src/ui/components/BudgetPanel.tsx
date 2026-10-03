import { METER_KEYS } from '../../engine/compare';
import type { FullEvaluation } from '../../engine/index';
import type { Design, MeterStatus } from '../../engine/types';
import { MeterCard } from './MeterCard';
import { StatusIcon } from './icons';

const COUNT_LABEL: Record<MeterStatus, string> = { ok: 'OK', warning: 'WARNING', over: 'OVER LIMIT' };

export function BudgetPanel({ ev, design, engineer }: { ev: FullEvaluation; design: Design; engineer: boolean }) {
  const counts: Record<MeterStatus, number> = { ok: 0, warning: 0, over: 0 };
  for (const k of METER_KEYS) counts[ev.meters[k].status] += 1;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 2px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="h2">Mission Budget</h2>
          <span className="faint mono" style={{ fontSize: 11 }}>
            LIVE
          </span>
        </div>
        <div className="counts">
          {(Object.keys(counts) as MeterStatus[])
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <span key={s} className={`chip ${s}`} style={{ height: 24 }}>
                <StatusIcon status={s} />
                {counts[s]} {COUNT_LABEL[s]}
              </span>
            ))}
        </div>
      </div>
      {METER_KEYS.map((k) => (
        <MeterCard key={k} k={k} m={ev.meters[k]} ev={ev} design={design} engineer={engineer} />
      ))}
    </>
  );
}
