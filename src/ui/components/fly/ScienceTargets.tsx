// SCIENCE TARGETS (spec: UI rule 39; Signal Delay design screen 01). After arrival the CRT turns to Mars: the
// globe, a card per target with what it teaches and what it costs, and OBSERVE. Every number is the engine's
// (scienceTargetsView); the screen only lays them out. Picking a card or a marker selects it; OBSERVE sends the order.
import type { ReactNode } from 'react';
import type { ScienceTargetsView, TargetCard } from '../../../engine/ops/index';
import { targetById } from '../../../engine/targets';
import * as f from '../../format';
import { SCIENCE, targetName } from '../../sdWords';
import { SDIcon } from '../sd/SDIcon';

interface Props {
  view: ScienceTargetsView;
  selected: string;
  onSelect: (id: string) => void;
  onObserve: () => void;
  onDone: () => void;
  robotName: string;
  destName: string;
  engineer: boolean;
  phone: boolean;
  /** The globe (3D or 2D), sized by the screen. */
  globe: ReactNode;
  /** The arrival transition is running: the keys wait for it. */
  busy?: boolean;
}

const bars = (q: 1 | 2 | 3) => '▮'.repeat(q) + '▯'.repeat(3 - q);

function Card({ c, on, onSelect, engineer, phone }: { c: TargetCard; on: boolean; onSelect: () => void; engineer: boolean; phone: boolean }) {
  const t = targetById(c.id)!;
  const done = c.state !== 'ready' && c.state !== 'refused';
  const dead = !done && c.blocker !== undefined;
  return (
    <button type="button" className={`sci-card${on ? ' on' : ''}${done ? ' done' : ''}${dead ? ' dead' : ''}`} aria-pressed={on} onClick={onSelect}>
      <span className="sci-card-head">
        <span className="sci-card-num">{f.pad2(c.ordinal)}</span>
        <span className="sci-card-name">{targetName(c.id)}</span>
        {phone && (
          <span className="sci-card-q">
            {bars(c.quality)} <span className="sci-card-ql">{SCIENCE.quality[c.quality]}</span>
          </span>
        )}
        {done && !phone && <span className="sci-card-state">{SCIENCE.state[c.state as keyof typeof SCIENCE.state]}</span>}
      </span>
      {!phone && (
        <span className="sci-card-q">
          {SCIENCE.image} {bars(c.quality)} <span className="sci-card-ql">{SCIENCE.quality[c.quality]}</span>
        </span>
      )}
      <span className="sci-card-learn">{t.learn.value}</span>
      {engineer && <span className="sci-card-eng">{SCIENCE.eng(f.meters(c.resolution_m), f.bits(c.image_bits), f.speed(c.dv_ms), f.days(c.days))}</span>}
      <span className="sci-card-chips">
        <span className={`sci-chip${c.fuelSegments ? ' cost' : ' free'}${c.blocker === 'fuel' ? ' alarm' : ''}`}>
          <SDIcon icon="fuel" size={phone ? 12 : 14} />
          {f.signedInt(-c.fuelSegments)}
        </span>
        <span className="sci-chip cost">
          <SDIcon icon="power" size={phone ? 12 : 14} />
          {f.signedInt(-c.powerSegments)}
        </span>
        {c.riskLevel === 'none' && c.dust ? (
          <span className="sci-chip risk dust">⚠ {SCIENCE.dust}</span>
        ) : (
          <span className={`sci-chip risk ${c.riskLevel}`}>⚠ {SCIENCE.risk[c.riskLevel]}</span>
        )}
        {done && phone && <span className="sci-card-state">{SCIENCE.state[c.state as keyof typeof SCIENCE.state]}</span>}
      </span>
    </button>
  );
}

export function ScienceTargets({ view, selected, onSelect, onObserve, onDone, robotName, destName, engineer, phone, globe, busy = false }: Props) {
  const sel = view.cards.find((c) => c.id === selected) ?? view.cards[0]!;
  const ok = sel.blocker === undefined;
  const takes = f.durationWords(view.orderTakes_s);
  const [sub, subShort] = ok
    ? [SCIENCE.orderTakes(targetName(sel.id), takes, robotName.toUpperCase()), SCIENCE.orderTakesShort(takes)]
    : SCIENCE.blocked[sel.blocker!];
  const finish = view.ordered ? (phone ? SCIENCE.doneShort : SCIENCE.done) : phone ? SCIENCE.skipShort : SCIENCE.skip;
  const hint = view.ordered ? SCIENCE.hintSome(f.num(view.ordered)) : SCIENCE.hint;
  const keys = (
    <div className="sci-keys">
      <button type="button" className={`sci-observe${ok ? '' : ' off'}`} disabled={!ok || busy} onClick={onObserve} aria-label={`${SCIENCE.observe}: ${targetName(sel.id)}`}>
        <span className="sci-observe-k">{SCIENCE.observe}{phone ? ' ▸' : ''}</span>
        <span className="sci-observe-sub">{phone ? subShort : sub}</span>
        {!phone && <span className="sci-observe-arrow">▸</span>}
      </button>
      <button type="button" className="sci-done" disabled={busy} onClick={onDone}>
        {finish} ▸
      </button>
    </div>
  );
  if (phone)
    return (
      <section className="sci phone" aria-label={SCIENCE.titlePhone}>
        <div className="sci-globe-box">
          <span className="sci-globe-k">{SCIENCE.titlePhone}</span>
          {globe}
          <span className="sci-globe-sel">{SCIENCE.marker(f.num(sel.ordinal), targetName(sel.id))}</span>
        </div>
        <div className="sci-list">
          {view.cards.map((c) => (
            <Card key={c.id} c={c} on={c.id === sel.id} onSelect={() => onSelect(c.id)} engineer={engineer} phone />
          ))}
        </div>
        {keys}
      </section>
    );
  return (
    <section className="sci" aria-label={SCIENCE.title(destName.toUpperCase())}>
      <div className="sci-left">
        <span className="sci-title">{SCIENCE.title(destName.toUpperCase())}</span>
        <span className="sci-hint">{hint}</span>
        <div className="sci-globe-wrap">{globe}</div>
        <span className="sci-credit">{SCIENCE.globeCredit}</span>
      </div>
      <div className="sci-right">
        <div className="sci-grid">
          {view.cards.map((c) => (
            <Card key={c.id} c={c} on={c.id === sel.id} onSelect={() => onSelect(c.id)} engineer={engineer} phone={false} />
          ))}
        </div>
        {keys}
      </div>
    </section>
  );
}
