// MISSION LIMITS (spec UI rule 57): the four limits a solo Cadet packs against — weight, budget, power, data — as bars
// with three states (fine, nearly full, over). Hovering a shelf part previews where each bar would go if it were
// packed. Every number is the engine's (pack.ts packLimits / packLimitsWith); this only formats units.
import type { CSSProperties } from 'react';
import type { LimitKey, PackLimit } from '../../../engine/pack';
import * as f from '../../format';
import { LIMIT_WORDS } from '../../sdWords';

const UNIT: Record<LimitKey, (x: number) => string> = { weight: f.kg, budget: (x) => f.money(x), power: f.watts, data: f.bits };
const fill = (x: number) => ({ '--fill': x }) as CSSProperties;

interface Props {
  limits: PackLimit[];
  /** The limits with the hovered shelf part packed too, and that part's name. */
  preview?: { part: string; limits: PackLimit[] };
  compact?: boolean;
}

export function MissionLimits({ limits, preview, compact }: Props) {
  return (
    <section className={`ml${compact ? ' compact' : ''}`} aria-label={LIMIT_WORDS.label}>
      <div className="ml-top">
        <span className="ml-title">{LIMIT_WORDS.title}</span>
        {preview && <span className="ml-peek">{LIMIT_WORDS.preview(preview.part)}</span>}
      </div>
      {limits.map((l) => {
        const p = preview?.limits.find((x) => x.key === l.key);
        const moves = p && (p.used !== l.used || p.limit !== l.limit);
        const value = LIMIT_WORDS.value[l.key](UNIT[l.key](l.used), UNIT[l.key](l.limit));
        const shown = moves ? p! : l;
        return (
          <div key={l.key} className={`ml-row ${shown.status}${moves ? ' moves' : ''}`}>
            <div className="ml-head">
              <span className="ml-name">{LIMIT_WORDS.names[l.key]}</span>
              {shown.status !== 'ok' && <span className="ml-state">{LIMIT_WORDS.status[shown.status]}</span>}
              <span className="ml-v">{moves ? LIMIT_WORDS.value[l.key](UNIT[l.key](p!.used), UNIT[l.key](p!.limit)) : value}</span>
            </div>
            <div className={`ml-bar ${l.status}`} role="img" aria-label={LIMIT_WORDS.bar(LIMIT_WORDS.names[l.key], value, LIMIT_WORDS.status[l.status])}>
              {moves && <span className={`ml-ghost ${p!.status}`} style={fill(p!.fill)} />}
              <span className="ml-fill" style={fill(l.fill)} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
