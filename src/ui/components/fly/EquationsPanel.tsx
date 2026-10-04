// Engineer drawer: each resource's equation and every input with its ⓘ source (spec UI rule 2).
import type { ConsoleGauges } from '../../../engine/ops/index';
import { FLY_RULES, TILE_EQUATION } from '../../../engine/ops/fly';
import { SourceInfo } from '../SourceInfo';
import * as f from '../../format';

const NAME: Record<keyof ConsoleGauges, string> = { power: 'POWER TODAY', fuel: 'Δv LEFT', recorder: 'RECORDER', budget: 'BUDGET RESERVE' };

export function EquationsPanel({ gauges, onClose }: { gauges: ConsoleGauges; onClose: () => void }) {
  return (
    <section className="fly-eqs" aria-label="Equations">
      <div className="fly-eqs-head">
        <span>EQUATIONS · SOURCES</span>
        <button type="button" className="fly-action" onClick={onClose} aria-label="Close equations">
          ✕
        </button>
      </div>
      {(Object.keys(NAME) as (keyof ConsoleGauges)[]).map((k) => (
        <div key={k} className="fly-eq">
          <span className="fly-eq-k">{NAME[k]}</span>
          <span className="fly-eq-v ops-eq">{gauges[k].equation}</span>
          <ul>
            {Object.entries(gauges[k].inputs).map(([name, s]) => (
              <li key={name}>
                <span>{f.label(name)}</span>
                <span className="mono">{f.sourcedValue(s)}</span>
                <SourceInfo s={s} title={f.label(name)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="fly-eq">
        <span className="fly-eq-k">TILES</span>
        <span className="fly-eq-v">{TILE_EQUATION}</span>
        <ul>
          {(['gaugeSegments', 'powerFullMargin', 'systemsPenalty'] as const).map((k) => (
            <li key={k}>
              <span>{f.label(k)}</span>
              <span className="mono">{f.sourcedValue(FLY_RULES[k])}</span>
              <SourceInfo s={FLY_RULES[k]} title={f.label(k)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
