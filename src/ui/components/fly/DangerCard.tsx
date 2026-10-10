// The danger card (design: cream card with a red header, choices on either side; swipe it on a phone).
// Time stops while it is open. ← and → (and ↓ for a third choice) pick on a keyboard.
import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Sourced } from '../../../engine/types';
import { SourceInfo } from '../SourceInfo';
import { SDIcon, type SDIconName } from '../sd/SDIcon';
import { SWIPE_CHOOSE_PX, SWIPE_HINT_PX, SWIPE_TILT } from '../../sdGeometry';

export interface ChipView {
  icon: SDIconName;
  text: string;
  tone: 'cost' | 'gain' | 'risk' | 'info';
  title?: string;
}

export interface ChoiceView {
  id: string;
  label: string;
  sub: string;
  chips: ChipView[];
  /** Engineer line (failure chance and effect, costs in units). */
  eng?: string;
  disabled: boolean;
  /** Why a disabled choice cannot be paid for. */
  blocker?: string;
  /** "THE ROBOT'S DEFAULT", "STANDING ORDER". */
  tag?: string;
}

export interface CardView {
  icon: SDIconName;
  kicker: string;
  title: string;
  line: string;
  day: string;
  /** s: the ⓘ of the time (a real CME's WSA-ENLIL prediction). */
  hits: { k: string; v: string; s?: Sourced<string> };
  takes: { k: string; v: string };
  history?: { k: string; s: Sourced<string>; badge?: string };
  choices: ChoiceView[];
  /** Footer under the card (e.g. "LET THE ROBOT DECIDE"). */
  footer?: { label: string; onClick: () => void };
}

const SIDE_HINT = ['◂ SWIPE LEFT / ← KEY', '→ KEY / SWIPE RIGHT ▸', '▾ ↓ KEY'];
const SIDE_HINT_PHONE = ['◂ SWIPE LEFT', 'SWIPE RIGHT ▸', 'TAP'];

function Chips({ chips }: { chips: ChipView[] }) {
  return (
    <span className="dc-chips">
      {chips.map((k, i) => (
        <span key={i} className={`sd-chip ${k.tone}`} title={k.title}>
          <SDIcon icon={k.icon} size={18} />
          {k.text}
        </span>
      ))}
    </span>
  );
}

function Choice({ c, side, engineer, phone, hot, onPick }: { c: ChoiceView; side: number; engineer: boolean; phone: boolean; hot: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      className={`dc-choice side-${side}${hot ? ' hot' : ''}`}
      disabled={c.disabled}
      aria-label={`${c.label}: ${c.sub}`}
      aria-keyshortcuts={side === 0 ? 'ArrowLeft' : side === 1 ? 'ArrowRight' : 'ArrowDown'}
      onClick={onPick}
    >
      <span className="dc-hint">{(phone ? SIDE_HINT_PHONE : SIDE_HINT)[side]}</span>
      <span className="dc-label">{c.label}</span>
      {!phone && <span className="dc-sub">{c.sub}</span>}
      {c.tag && <span className="dc-tag">{c.tag}</span>}
      <Chips chips={c.chips} />
      {c.disabled && c.blocker && <span className="dc-blocker">{c.blocker}</span>}
      {engineer && c.eng && !phone && <span className="dc-eng">{c.eng}</span>}
    </button>
  );
}

function Paper({ card, engineer, phone, drag }: { card: CardView; engineer: boolean; phone: boolean; drag?: { x: number; handlers: Record<string, (e: RPointerEvent<HTMLDivElement>) => void> } }) {
  return (
    <div
      className="dc-paper"
      role="group"
      aria-label={card.title}
      {...(drag ? { ...drag.handlers, style: { transform: `translateX(${drag.x}px) rotate(${drag.x * SWIPE_TILT}deg)` } } : {})}
    >
      <div className="dc-head">
        <span className="dc-kicker">
          <SDIcon icon={card.icon} size={phone ? 18 : 22} color="var(--sd-paper)" />
          {card.kicker}
        </span>
        <span className="dc-day">{card.day}</span>
      </div>
      <div className="dc-body">
        <h2 className="dc-title">{card.title}</h2>
        <p className="dc-line">{card.line}</p>
        <div className="dc-facts">
          <div className="dc-fact">
            <span className="dc-fact-k">
              {card.hits.k}
              {card.hits.s && <SourceInfo s={card.hits.s} title={card.hits.k.toLowerCase()} />}
            </span>
            <span className="dc-fact-v hits">{card.hits.v}</span>
          </div>
          <div className="dc-fact">
            <span className="dc-fact-k">{card.takes.k}</span>
            <span className="dc-fact-v takes">{card.takes.v}</span>
          </div>
        </div>
        {card.history && (
          <div className="sd-history">
            <span className="sd-history-k">
              {card.history.k}
              {card.history.badge && <span className="sd-verify">{card.history.badge}</span>}
              <SourceInfo s={card.history.s} title={card.history.k.toLowerCase()} />
            </span>
            <span className="sd-history-v">{card.history.s.value}</span>
            {engineer && <span className="sd-source">SOURCE · {card.history.s.source}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function DangerCard({ card, engineer, phone, onPick }: { card: CardView; engineer: boolean; phone: boolean; onPick: (id: string) => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | undefined>(undefined);
  const [a, b, third] = card.choices;
  const pick = (c: ChoiceView | undefined) => c && !c.disabled && onPick(c.id);

  if (!phone)
    return (
      <div className="dc-overlay" role="dialog" aria-modal="true" aria-label={`${card.kicker}: ${card.title}`}>
        <div className="dc-row">
          {a && <Choice c={a} side={0} engineer={engineer} phone={false} hot={false} onPick={() => pick(a)} />}
          <div className="dc-center">
            <Paper card={card} engineer={engineer} phone={false} />
            {third && <Choice c={third} side={2} engineer={engineer} phone={false} hot={false} onPick={() => pick(third)} />}
            {card.footer && (
              <button type="button" className="dc-footer" onClick={card.footer.onClick}>
                {card.footer.label}
              </button>
            )}
          </div>
          {b && <Choice c={b} side={1} engineer={engineer} phone={false} hot={false} onPick={() => pick(b)} />}
        </div>
      </div>
    );

  const handlers = {
    onPointerDown: (e: RPointerEvent<HTMLDivElement>) => {
      start.current = e.clientX;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is optional */
      }
    },
    onPointerMove: (e: RPointerEvent<HTMLDivElement>) => {
      if (start.current !== undefined) setDx(e.clientX - start.current);
    },
    onPointerUp: () => {
      if (start.current === undefined) return;
      start.current = undefined;
      if (dx < -SWIPE_CHOOSE_PX && a && !a.disabled) pick(a);
      else if (dx > SWIPE_CHOOSE_PX && b && !b.disabled) pick(b);
      setDx(0);
    },
  };
  return (
    <div className="dc-overlay phone" role="dialog" aria-modal="true" aria-label={`${card.kicker}: ${card.title}`}>
      <Paper card={card} engineer={engineer} phone drag={{ x: dx, handlers: { ...handlers, onPointerCancel: handlers.onPointerUp } }} />
      <div className="dc-phone-choices">
        {a && <Choice c={a} side={0} engineer={engineer} phone hot={dx < -SWIPE_HINT_PX} onPick={() => pick(a)} />}
        {b && <Choice c={b} side={1} engineer={engineer} phone hot={dx > SWIPE_HINT_PX} onPick={() => pick(b)} />}
      </div>
      {third && <Choice c={third} side={2} engineer={engineer} phone hot={false} onPick={() => pick(third)} />}
      {card.footer && (
        <button type="button" className="dc-footer" onClick={card.footer.onClick}>
          {card.footer.label}
        </button>
      )}
    </div>
  );
}
