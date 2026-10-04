import type { ReactNode } from 'react';
import type { PanelKey } from '../../engine/compare';
import type { FullEvaluation } from '../../engine/index';
import type { Design, Meter } from '../../engine/types';
import { label, signedPct, sourcedValue } from '../format';
import { barGeometry, meterView } from '../meters';
import { SourceInfo } from './SourceInfo';
import { StatusChip } from './StatusChip';

/**
 * One Mission Budget meter. Cadet: used / limit, margin and a one-liner.
 * Engineer: also the meter's equation and every input, each with its ⓘ source.
 */
export function MeterCard({ k, m, ev, design, engineer }: { k: PanelKey; m: Meter; ev: FullEvaluation; design: Design; engineer: boolean }) {
  const v = meterView(k, m, ev, design);
  const g = barGeometry(m);
  const inputs = Object.entries(m.inputs);
  const main = inputs[0]?.[1];
  return (
    <section className="meter" aria-label={`${v.title} meter`}>
      <div className="meter-head">
        <span className="h3">{v.title}</span>
        <span className="sub">{v.sub}</span>
        {main && <SourceInfo s={main} title={label(inputs[0]![0])} />}
        <StatusChip status={m.status} />
      </div>
      <div className="meter-vals">
        <span className="big" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span>
            {v.used}
            <span className="unit"> / {v.limit}</span>
          </span>
          {m.limitSource && <SourceInfo s={m.limitSource} title={`${v.title} limit`} />}
        </span>
        <span style={{ fontSize: 12, color: `var(--${m.status === 'ok' ? 'ok' : m.status === 'warning' ? 'warn' : 'bad'})` }}>{signedPct(m.margin)}</span>
      </div>
      <div className="bar" role="presentation">
        <div className={`bar-fill ${m.status}`} style={{ width: `${g.fill * 100}%` }} />
        <div className="bar-limit" style={{ left: `${g.limitAt * 100}%` }} />
      </div>
      <div className="meter-say">{v.say}</div>
      {(m.calibrated === false || m.limitSource?.isGameEstimate) && (
        <span className="badge est" title={m.limitSource?.source}>
          {m.calibrated === false ? 'UNCALIBRATED · GAME ESTIMATE' : 'LIMIT RESTS ON A GAME ESTIMATE'}
        </span>
      )}
      {engineer && (
        <div className="eng">
          <div className="eq">{m.equation}</div>
          <div className="inputs">
            {inputs.map(([key, s]) => (
              <Row key={key} name={label(key)} value={sourcedValue(s)}>
                <SourceInfo s={s} title={label(key)} />
              </Row>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ name, value, children }: { name: string; value: string; children: ReactNode }) {
  return (
    <>
      <span className="k">{name}</span>
      <span className="v">{value}</span>
      {children}
    </>
  );
}
