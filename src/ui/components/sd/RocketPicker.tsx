// ROCKET (spec UI rule 58): a solo Cadet picks the rocket on Pack. Each option says what it lifts to this mission's C3,
// whether it lifts this craft, what it does to the budget (the level's standard rocket is free; another charges or
// refunds the price difference) and its flight record; ⓘ shows the payload curve it comes from (today a placeholder,
// so it carries the game-estimate badge). Every number is the engine's (pack.ts rocketCards).
import type { RocketCard } from '../../../engine/pack';
import { LAUNCH_VEHICLES, RIDESHARES } from '../../../engine/data';
import * as f from '../../format';
import { ROCKET_WORDS } from '../../sdWords';
import { SourceInfo } from '../SourceInfo';

interface Props {
  cards: RocketCard[];
  onPick: (id: string) => void;
  compact?: boolean;
}

/** The rocket's or the ride's own name (data: English, like mission names). */
export const rocketName = (c: Pick<RocketCard, 'id' | 'ride' | 'vehicleId'>) =>
  c.ride ? (RIDESHARES[c.id.replace(/^ride:/, '')]?.name ?? c.id) : (LAUNCH_VEHICLES[c.vehicleId]?.name ?? c.vehicleId);

export function RocketPicker({ cards, onPick, compact }: Props) {
  return (
    <section className={`rk${compact ? ' compact' : ''}`} aria-label={ROCKET_WORDS.label}>
      <span className="rk-title">{ROCKET_WORDS.title}</span>
      <div className="rk-list" role="radiogroup" aria-label={ROCKET_WORDS.label}>
        {cards.map((c) => {
          const name = rocketName(c);
          const cost = c.standard ? ROCKET_WORDS.standard : c.charge_M > 0 ? ROCKET_WORDS.charge(f.signedMoney(c.charge_M)) : ROCKET_WORDS.refund(f.signedMoney(c.charge_M));
          return (
            <div key={c.id} className={`rk-opt${c.picked ? ' on' : ''}${c.fits ? '' : ' heavy'}`}>
              <button type="button" role="radio" aria-checked={c.picked} className="rk-pick" onClick={() => !c.picked && onPick(c.id)}>
                <span className="rk-dot" aria-hidden="true" />
                <span className="rk-body">
                  <span className="rk-name">
                    {c.ride && <span className="rk-ride">{ROCKET_WORDS.ride}</span>}
                    {name}
                  </span>
                  <span className="rk-lift">
                    {ROCKET_WORDS.lifts(f.kg(c.lift_kg))}
                    {!c.fits && <span className="rk-heavy">{ROCKET_WORDS.tooHeavy}</span>}
                  </span>
                  <span className={`rk-cost${c.charge_M > 0 ? ' up' : c.charge_M < 0 ? ' down' : ''}`}>{cost}</span>
                  {!compact && <span className="rk-record">{ROCKET_WORDS.record(f.num(c.successes), f.num(c.flights))}</span>}
                </span>
              </button>
              <SourceInfo s={c.curve} title={ROCKET_WORDS.curveTitle(name)} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
