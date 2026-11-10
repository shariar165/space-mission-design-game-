// SCIENCE ORBIT (spec UI rule 59): on the Mars Pack a solo Cadet picks the orbit to do the science from. Each card
// says what it costs and gives: the fuel to get there, the fuel margin left, the round trip to each moon, the air drag
// on its low passes and its longest shadow, with one plain line on the trade. Every number is the engine's
// (orbitPresets.ts orbitCards); ⓘ shows where the altitudes come from (MAVEN's published orbit, or the game rule).
import type { OrbitCard } from '../../../engine/orbitPresets';
import * as f from '../../format';
import { FLY_WORDS, ORBIT_WORDS } from '../../sdWords';
import { SourceInfo } from '../SourceInfo';

interface Props {
  cards: OrbitCard[];
  onPick: (id: string) => void;
  compact?: boolean;
}

export function OrbitPicker({ cards, onPick, compact }: Props) {
  return (
    <section className={`ob2${compact ? ' compact' : ''}`} aria-label={ORBIT_WORDS.label}>
      <span className="rk-title">{ORBIT_WORDS.title}</span>
      <div className="rk-list" role="radiogroup" aria-label={ORBIT_WORDS.label}>
        {cards.map((c) => (
          <div key={c.id} className={`rk-opt ob2-opt${c.picked ? ' on' : ''}`}>
            <button type="button" role="radio" aria-checked={c.picked} className="rk-pick" onClick={() => !c.picked && onPick(c.id)}>
              <span className="rk-dot" aria-hidden="true" />
              <span className="rk-body">
                <span className="rk-name">{ORBIT_WORDS.names[c.id]}</span>
                <span className="ob2-size">{ORBIT_WORDS.size(f.distance(c.periapsis_km * 1000), f.distance(c.apoapsis_km * 1000))}</span>
                {!compact && <span className="ob2-line">{ORBIT_WORDS.lines[c.id]}</span>}
                <span className="ob2-facts">
                  <span>{ORBIT_WORDS.change(f.speed(c.orbitChange_ms))}</span>
                  <span className={c.fuelStatus === 'over' ? 'bad' : c.fuelStatus === 'warning' ? 'warn' : ''}>{ORBIT_WORDS.fuel(f.pct(c.fuelMargin, 0))}</span>
                  <span>{ORBIT_WORDS.moons(f.speed(c.moons.phobos_ms), f.speed(c.moons.deimos_ms))}</span>
                  {!compact && <span>{ORBIT_WORDS.drag(f.factor(c.drag))}</span>}
                  {!compact && <span>{ORBIT_WORDS.shadow(FLY_WORDS.duration(c.longestShadow_s))}</span>}
                </span>
              </span>
            </button>
            {c.source && <SourceInfo s={c.source} title={ORBIT_WORDS.names[c.id]} />}
          </div>
        ))}
      </div>
    </section>
  );
}
