// SCIENCE TARGETS (spec: UI rule 39; Signal Delay design screen 01, with the Mars globe as the hero, docs/design/3d/).
// After arrival the CRT turns to Mars: the globe fills it, the targets are a slim list beside it (on the phone, a
// bottom sheet over it), and OBSERVE runs along the bottom. Every number is the engine's (scienceTargetsView, and the
// console's commands for an order still crossing space); the screen only lays them out. Picking a row or a marker
// selects a target and the globe turns to it; OBSERVE sends the order, which plays its trip while the panel is open.
import type { ReactNode } from 'react';
import type { ScienceTargetsView, TargetCard } from '../../../engine/ops/index';
import { targetById } from '../../../engine/targets';
import * as f from '../../format';
import { SCIENCE, targetName } from '../../sdWords';
import { SDIcon } from '../sd/SDIcon';
import { TargetSheet } from './TargetSheet';

/** An OBSERVE order still crossing space (consoleView.commands). */
export interface OrderInFlight {
  targetId: string;
  timeLeft_s: number;
}

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
  /** The globe (3D or 2D); it fills the stage. */
  globe: ReactNode;
  /** The arrival transition is running: the keys wait for it. */
  busy?: boolean;
  /** Orders on their way to the robot, oldest first. */
  orders?: OrderInFlight[];
  /** An order just landed: the robot is over this target. */
  scanning?: string;
}

const bars = (q: 1 | 2 | 3) => '▮'.repeat(q) + '▯'.repeat(3 - q);

function Row({ c, on, open, onSelect, engineer, phone }: { c: TargetCard; on: boolean; open: boolean; onSelect: () => void; engineer: boolean; phone: boolean }) {
  const t = targetById(c.id)!;
  const done = c.state !== 'ready' && c.state !== 'refused';
  const dead = !done && c.blocker !== undefined;
  return (
    <button type="button" className={`sci-card${on ? ' on' : ''}${done ? ' done' : ''}${dead ? ' dead' : ''}${open ? ' open' : ''}`} aria-pressed={on} onClick={onSelect}>
      <span className="sci-card-head">
        <span className="sci-card-num">{f.pad2(c.ordinal)}</span>
        <span className="sci-card-name">{targetName(c.id)}</span>
        {done ? (
          <span className="sci-card-state">{SCIENCE.state[c.state as keyof typeof SCIENCE.state]}</span>
        ) : (
          <span className="sci-card-q" title={SCIENCE.quality[c.quality]}>
            {bars(c.quality)}
            {open && <span className="sci-card-ql"> {SCIENCE.quality[c.quality]}</span>}
          </span>
        )}
      </span>
      {open && <span className="sci-card-learn">{t.learn.value}</span>}
      {open && engineer && <span className="sci-card-eng">{SCIENCE.eng(f.meters(c.resolution_m), f.bits(c.image_bits), f.speed(c.dv_ms), f.days(c.days))}</span>}
      <span className="sci-card-chips">
        <span className={`sci-chip${c.fuelSegments ? ' cost' : ' free'}${c.blocker === 'fuel' ? ' alarm' : ''}`}>
          <SDIcon icon="fuel" size={phone ? 12 : 13} />
          {f.signedInt(-c.fuelSegments)}
        </span>
        <span className="sci-chip cost">
          <SDIcon icon="power" size={phone ? 12 : 13} />
          {f.signedInt(-c.powerSegments)}
        </span>
        {c.riskLevel === 'none' && c.dust ? (
          <span className="sci-chip risk dust">⚠ {SCIENCE.dust}</span>
        ) : (
          <span className={`sci-chip risk ${c.riskLevel}`}>⚠ {SCIENCE.risk[c.riskLevel]}</span>
        )}
      </span>
    </button>
  );
}

export function ScienceTargets({ view, selected, onSelect, onObserve, onDone, robotName, destName, engineer, phone, globe, busy = false, orders = [], scanning }: Props) {
  const sel = view.cards.find((c) => c.id === selected) ?? view.cards[0]!;
  const ok = sel.blocker === undefined;
  const takes = f.durationWords(view.orderTakes_s);
  const name = robotName.toUpperCase();
  const [sub, subShort] = ok ? [SCIENCE.orderTakes(targetName(sel.id), takes, name), SCIENCE.orderTakesShort(takes)] : SCIENCE.blocked[sel.blocker!];
  const finish = view.ordered ? (phone ? SCIENCE.doneShort : SCIENCE.done) : phone ? SCIENCE.skipShort : SCIENCE.skip;
  const hint = view.ordered ? SCIENCE.hintSome(f.num(view.ordered)) : SCIENCE.hint;
  const next = orders[0];
  const strip = scanning
    ? SCIENCE.scanning(name, targetName(scanning))
    : next
      ? phone
        ? SCIENCE.orderOutShort(f.durationWords(next.timeLeft_s))
        : SCIENCE.orderOut(targetName(next.targetId), name, f.durationWords(next.timeLeft_s))
      : undefined;
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
  const rows = view.cards.map((c) => <Row key={c.id} c={c} on={c.id === sel.id} open={c.id === sel.id || phone} onSelect={() => onSelect(c.id)} engineer={engineer} phone={phone} />);
  const stripEl = strip && (
    <span className={`sci-strip${scanning ? ' scan' : ''}`} role="status" aria-live="polite">
      {strip}
    </span>
  );
  if (phone)
    return (
      <section className="sci hero phone" aria-label={SCIENCE.titlePhone}>
        <div className="sci-stage">
          {globe}
          <div className="sci-hud">
            <span className="sci-title">{SCIENCE.titlePhone}</span>
            {stripEl}
          </div>
        </div>
        <TargetSheet>
          <div className="sci-list">{rows}</div>
        </TargetSheet>
        {keys}
      </section>
    );
  return (
    <section className="sci hero" aria-label={SCIENCE.title(destName.toUpperCase())}>
      <div className="sci-list" role="group" aria-label={SCIENCE.sheet}>
        {rows}
      </div>
      <div className="sci-stage">
        {globe}
        <div className="sci-hud">
          <span className="sci-title">{SCIENCE.title(destName.toUpperCase())}</span>
          <span className="sci-hint">{hint}</span>
          {stripEl}
        </div>
        <span className="sci-credit">
          {SCIENCE.globeCredit} · {SCIENCE.notToScale}
        </span>
      </div>
      {keys}
    </section>
  );
}
