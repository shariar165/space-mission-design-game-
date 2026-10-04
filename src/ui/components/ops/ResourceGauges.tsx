// Resources column (mockup: Battery, Fuel tank, Photos waiting, Ops budget). Cadet reads a sentence; Engineer
// reads the numbers, the equation and the ⓘ sources. Every value is consoleView().gauges.
import type { ConsoleGauges } from '../../../engine/ops/console';
import { cssPct } from '../../opsGeometry';
import * as f from '../../format';
import { GAUGE_NAME, gaugeLine, STATUS_LABEL, type GaugeKey } from '../../opsWords';
import { StatusIcon } from '../icons';
import { SourceInfo } from '../SourceInfo';

interface Props {
  gauges: ConsoleGauges;
  engineer: boolean;
  destName: string;
}

const KEYS: GaugeKey[] = ['power', 'fuel', 'recorder', 'budget'];

function big(k: GaugeKey, g: ConsoleGauges, engineer: boolean): { value: string; sub: string } {
  switch (k) {
    case 'power':
      return engineer
        ? { value: f.signedPct(g.power.margin, 0), sub: 'margin today' }
        : { value: f.pct(g.power.fill, 0), sub: 'power to spare' };
    case 'fuel':
      return engineer ? { value: f.speed(g.fuel.limit), sub: 'Δv left' } : { value: f.kg(g.fuel.propellantLeft_kg), sub: 'fuel left' };
    case 'recorder':
      return { value: f.pct(g.recorder.fill, 0), sub: 'of memory' };
    case 'budget':
      return engineer ? { value: f.money(g.budget.spare_M, 1), sub: 'spare' } : { value: f.num(g.budget.spareCoins), sub: 'coins spare' };
  }
}

function rows(k: GaugeKey, g: ConsoleGauges): [string, string][] {
  switch (k) {
    case 'power':
      return [
        ['Available / required', `${f.watts(g.power.limit)} / ${f.watts(g.power.used)}`],
        ['Eclipse today', f.pct(g.power.eclipseFraction, 1)],
      ];
    case 'fuel':
      return [
        ['Δv have / need', `${f.speed(g.fuel.limit)} / ${f.speed(g.fuel.used)}`],
        ['Propellant left', f.kg(g.fuel.propellantLeft_kg)],
      ];
    case 'recorder':
      return [
        ['Recorder', `${f.bits(g.recorder.used)} / ${f.bits(g.recorder.limit)}`],
        ['Made / sent last day', `${f.bits(g.recorder.producedToday_bits)} / ${f.bits(g.recorder.downlinkedToday_bits)}`],
      ];
    case 'budget':
      return [
        ['Reserve / extras', `${f.money(g.budget.limit, 1)} / ${f.money(g.budget.used, 2)}`],
        ['Operations so far', f.money(g.budget.operations_M, 1)],
      ];
  }
}

export function ResourceGauges({ gauges, engineer, destName }: Props) {
  return (
    <aside className="ops-res" aria-label="Resources">
      <div className="ops-res-head">
        <span className="h2">Resources</span>
        <span className="ops-label">TODAY</span>
      </div>
      {KEYS.map((k) => {
        const g = gauges[k];
        const b = big(k, gauges, engineer);
        return (
          <section key={k} className={`ops-gauge s-${g.status}`} aria-label={GAUGE_NAME[k].cadet}>
            <div className="ops-gauge-head">
              <span className="h3">{engineer ? GAUGE_NAME[k].engineer : GAUGE_NAME[k].cadet}</span>
              <span className={`chip ${g.status}`}>
                <StatusIcon status={g.status} />
                {STATUS_LABEL[g.status]}
              </span>
            </div>
            <div className="ops-gauge-big">
              <span className="mono">{b.value}</span>
              <span>{b.sub}</span>
            </div>
            {k === 'power' && (
              <div className="ops-batt" aria-hidden="true">
                <div className="ops-batt-body">
                  <div className="ops-batt-fill" style={{ width: cssPct(g.fill) }} />
                </div>
                <div className="ops-batt-tip" />
              </div>
            )}
            {(k === 'fuel' || k === 'budget') && (
              <div className={`ops-bar${g.status === 'over' ? ' hatched' : ''}`} aria-hidden="true">
                <div className="ops-bar-fill" style={{ width: cssPct(g.fill) }} />
                {g.mark !== undefined && <div className="ops-bar-mark" style={{ left: cssPct(g.mark) }} />}
              </div>
            )}
            {k === 'fuel' && !engineer && <div className="ops-mark-label">▲ still needed for the burns ahead</div>}
            {k === 'recorder' && <RecorderCells fill={g.fill} status={g.status} />}
            {!engineer && <div className="ops-gauge-line">{gaugeLine(k, gauges, destName)}</div>}
            {engineer && (
              <div className="ops-gauge-eng">
                {rows(k, gauges).map(([a, v]) => (
                  <div key={a} className="ops-row mono">
                    <span className="faint">{a}</span>
                    <span>{v}</span>
                  </div>
                ))}
                <div className="ops-eq mono">{g.equation}</div>
                <div className="ops-inputs">
                  {Object.entries(g.inputs).map(([name, s]) => (
                    <span key={name} className="ops-input">
                      <span className="faint">{name}</span>
                      <SourceInfo s={s} title={name} />
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}

/** Ten memory cells, lit by how full the recorder is (the mockup's photo cells). */
function RecorderCells({ fill, status }: { fill: number; status: string }) {
  const lit = Math.round(fill * 10);
  return (
    <div className="ops-cells" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={i < lit ? `on ${status}` : ''} />
      ))}
    </div>
  );
}
