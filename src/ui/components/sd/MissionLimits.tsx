// MISSION LIMITS (spec UI rule 57): the four limits a solo Cadet packs against — weight, budget, power, data — as bars
// with three states (fine, nearly full, over). Hovering a shelf part previews where each bar would go if it were
// packed. Every number is the engine's (pack.ts packLimits / packLimitsWith); this only formats units.
import type { CSSProperties } from 'react';
import type { LimitChange, LimitKey, PackLimit } from '../../../engine/pack';
import * as f from '../../format';
import { LAST_WORDS, LIMIT_WORDS } from '../../sdWords';
import { SDIcon } from './SDIcon';

const UNIT: Record<LimitKey, (x: number) => string> = { weight: f.kg, budget: (x) => f.money(x), power: f.watts, data: f.bits };
const fill = (x: number) => ({ '--fill': x }) as CSSProperties;
const SIGNED: Record<LimitKey, (x: number) => string> = { weight: f.signedKg, budget: f.signedMoney, power: f.signedWatts, data: f.signedBits };

interface Props {
  limits: PackLimit[];
  /** The limits with the hovered shelf part packed too, and that part's name. */
  preview?: { part: string; limits: PackLimit[] };
  compact?: boolean;
  /** The last flight of this level (spec UI rule 60): its stars, science home and each bar's change since. */
  last?: { stars: number; science: number; changes: LimitChange[] };
}

export function MissionLimits({ limits, preview, compact, last }: Props) {
  return (
    <section className={`ml${compact ? ' compact' : ''}`} aria-label={LIMIT_WORDS.label}>
      {last && (
        <div className="lf" role="group" aria-label={LAST_WORDS.label}>
          <span className="lf-k">{LAST_WORDS.title}</span>
          <span className="lf-stars" role="img" aria-label={LAST_WORDS.stars(f.num(last.stars))}>
            {[1, 2, 3].map((i) => (
              <SDIcon key={i} icon="star" size={13} color={i <= last.stars ? 'var(--sd-gold)' : 'var(--sd-ink-4)'} fill={i <= last.stars} />
            ))}
          </span>
          <span className="lf-sci">{LAST_WORDS.science(f.pct(last.science, 0))}</span>
        </div>
      )}
      <div className="ml-top">
        <span className="ml-title">{LIMIT_WORDS.title}</span>
        {preview && <span className="ml-peek">{LIMIT_WORDS.preview(preview.part)}</span>}
      </div>
      {limits.map((l) => {
        const p = preview?.limits.find((x) => x.key === l.key);
        const moves = p && (p.used !== l.used || p.limit !== l.limit);
        const value = LIMIT_WORDS.value[l.key](UNIT[l.key](l.used), UNIT[l.key](l.limit));
        const shown = moves ? p! : l;
        const ch = last?.changes.find((c) => c.key === l.key);
        const changeText = ch && [
          ...(ch.used !== 0 ? [LAST_WORDS.change(SIGNED[l.key](ch.used))] : []),
          ...(ch.limit !== 0 ? [LAST_WORDS.limitChange(SIGNED[l.key](ch.limit))] : []),
        ].join(' \u00b7 ');
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
              {ch && <span className="ml-last" style={fill(ch.lastFill)} />}
            </div>
            {changeText && <span className="ml-change">{changeText}</span>}
          </div>
        );
      })}
    </section>
  );
}
