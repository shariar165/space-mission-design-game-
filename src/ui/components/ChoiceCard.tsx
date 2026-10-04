// One big choice card in the guided build. Its chips are the engine's absolute values for that card's
// design (cadetOptions → chips): what the part weighs, makes and costs. A red tag names any gauge the
// card would push over its limit.
import type { CadetOption } from '../../engine/cadet';
import { LAUNCH_VEHICLES, RIDESHARES } from '../../engine/data';
import { GAUGE_ICON, OPTION_NAME, OPTION_TAG, RED_TAG } from '../cadetWords';
import * as f from '../format';
import { Check } from './icons';

export function ChoiceCard({ o, onChoose }: { o: CadetOption; onChoose: () => void }) {
  const name = o.step === 'rocket' ? (LAUNCH_VEHICLES[o.id]?.name ?? RIDESHARES[o.id]?.name ?? o.id) : (OPTION_NAME[o.id] ?? o.id);
  const tag = OPTION_TAG[o.id];
  return (
    <button type="button" className={`choice step-${o.step}${o.chosen ? ' chosen' : ''}`} aria-pressed={o.chosen} onClick={onChoose}>
      <span className="choice-art" aria-hidden="true">
        <CardArt step={o.step} id={o.id} />
      </span>
      <span className="choice-main">
        <span className="choice-name">
          {name}
          {tag && <span className={`tier tier-${tag.toLowerCase()}`}>{tag}</span>}
        </span>
        <span className="chips-row">
          <Chips o={o} />
          {o.redGauges.map((g) => (
            <span key={g} className="cchip red">
              {GAUGE_ICON[g]} {RED_TAG[g]}
            </span>
          ))}
        </span>
      </span>
      {o.chosen && (
        <span className="on-board">
          <Check size={13} /> On board
        </span>
      )}
    </button>
  );
}

function Chips({ o }: { o: CadetOption }) {
  const c = o.chips;
  const chip = (key: string, icon: string, text: string, title: string) => (
    <span key={key} className="cchip" title={title}>
      <span aria-hidden="true">{icon}</span> {text}
    </span>
  );
  const coinChip = c.coins !== undefined ? chip('cost', '', f.coins(c.coins), `Costs ${f.money(c.cost_M ?? 0)}`) : null;
  switch (o.step) {
    case 'science':
      return (
        <>
          {chip('mass', '⚖', f.kg(c.mass_kg), 'Weight')}
          {chip('photos', '📷', `${f.photos(c.photosTaken ?? 0)}/day`, 'Photos taken per day')}
          {coinChip}
        </>
      );
    case 'power':
      return (
        <>
          {chip('mass', '⚖', f.kg(c.mass_kg), 'Weight')}
          {chip('power', '🔋', f.watts(c.powerMade_W ?? 0), 'Power made on arrival')}
          {coinChip}
        </>
      );
    case 'radio':
      return (
        <>
          {chip('mass', '⚖', f.kg(c.mass_kg), 'Weight')}
          {chip('photos', '📡', `${f.photos(c.photosSent ?? 0)}/day`, 'Photos sent home per day')}
          {coinChip}
        </>
      );
    case 'fuel':
      return (
        <>
          {chip('mass', '⚖', f.kg(c.mass_kg), 'Weight of fuel and tanks')}
          {chip('spare', '⛽', `${f.signedKg(c.spareFuel_kg ?? 0)} spare`, 'Fuel left over after every burn')}
        </>
      );
    case 'rocket':
      return (
        <>
          {chip('lift', '🏋', f.kg(c.lift_kg ?? 0), c.shared ? 'Your seat: the mass allowed for the second craft on board' : 'How much it can send on this trip')}
          {chip('record', '✓', `${f.num(c.successes ?? 0)}/${f.num(c.flights ?? 0)}`, 'Successful flights')}
          {c.launchPrice_M !== undefined && chip('price', '🎟', f.money(c.launchPrice_M), c.shared ? 'Your share of the rocket price (paid outside the cost cap)' : 'Rocket price (paid outside the cost cap)')}
        </>
      );
  }
}

function CardArt({ step, id }: { step: CadetOption['step']; id: string }) {
  switch (step) {
    case 'science':
      return (
        <svg viewBox="0 0 72 72" width="72" height="72">
          <rect x="14" y="22" width="30" height="26" rx="6" fill="#7c5cff" />
          <circle cx="29" cy="35" r="8" fill="#1b1340" stroke="#c9bbff" strokeWidth="2.5" />
          {id !== 'snapshot' && id !== 'maven' && <rect x="40" y="30" width="20" height="22" rx="5" fill={id === 'radar' ? '#22c55e' : id === 'fields' ? '#db2777' : '#14b8a6'} />}
          {id === 'radar' && <rect x="8" y="46" width="22" height="14" rx="3" fill="#22c55e" />}
          {id === 'maven' && <rect x="40" y="26" width="20" height="28" rx="5" fill="#f59e0b" />}
        </svg>
      );
    case 'power':
      if (id === 'rtg') {
        return (
          <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="38" r="26" fill="#ff8a3d" opacity="0.25" />
            <rect x="26" y="14" width="20" height="46" rx="6" fill="#3b4256" stroke="#7d8aa8" strokeWidth="2" />
            {[22, 30, 38, 46, 54].map((y) => (
              <path key={y} d={`M20 ${y} h32`} stroke="#7d8aa8" strokeWidth="2.5" />
            ))}
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 72 72" width="72" height="72">
          {(id === 'solar-lean' ? [24] : [30]).map((w) => (
            <g key={w}>
              <rect x={30 - w} y="24" width={w} height="24" rx="3" fill="#2f63e6" stroke="#dfe7ff" strokeWidth="1.5" />
              <rect x="42" y="24" width={w} height="24" rx="3" fill="#2f63e6" stroke="#dfe7ff" strokeWidth="1.5" />
            </g>
          ))}
          <rect x="30" y="26" width="12" height="20" rx="3" fill="#f2b33d" />
        </svg>
      );
    case 'radio': {
      const r = id === 'small' ? 12 : id === 'medium' ? 19 : 26;
      return (
        <svg viewBox="0 0 72 72" width="72" height="72">
          <path d={`M${36 - r} 30 Q36 ${30 + r} ${36 + r} 30 Z`} fill="#eef2fb" stroke="#fff" strokeWidth="2" />
          <path d="M36 30 V54" stroke="#c7cfdf" strokeWidth="3" />
          <rect x="28" y="54" width="16" height="10" rx="2" fill="#f2b33d" />
          <path d="M50 14 q6 6 0 12 M56 10 q9 10 0 20" stroke="#2dd4bf" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      );
    }
    case 'fuel': {
      const r = id === 'lean' ? 13 : id === 'balanced' ? 18 : 24;
      return (
        <svg viewBox="0 0 72 72" width="72" height="72">
          <circle cx="36" cy="36" r={r} fill="#cfd6e6" stroke="#fff" strokeWidth="2" />
          <path d={`M${36 - r * 0.85} ${36 + r * 0.15} A${r} ${r} 0 0 0 ${36 + r * 0.85} ${36 + r * 0.15} Z`} fill="#fb923c" />
        </svg>
      );
    }
    case 'rocket':
      return (
        <svg viewBox="0 0 72 72" width="72" height="72">
          <path d="M28 20 Q36 4 44 20 Z" fill="#f4f6fb" />
          <rect x="28" y="20" width="16" height="40" rx="2" fill="#f0a35e" />
          {id.endsWith('411') && <rect x="20" y="40" width="7" height="22" rx="3" fill="#eef1f7" />}
          {RIDESHARES[id] && (
            <g>
              <rect x="30" y="24" width="12" height="9" rx="2" fill="#8ec5ff" />
              <rect x="30" y="35" width="12" height="7" rx="2" fill="#3cd3c1" />
              <circle cx="55" cy="18" r="9" fill="#13244a" stroke="#3cd3c1" strokeWidth="2" />
              <path d="M51 18 h8 M55 14 v8" stroke="#3cd3c1" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
          <path d="M30 60 Q36 72 42 60 Z" fill="#ffb347" />
        </svg>
      );
  }
}
