// Light-delay Mission Control. A crisis happens far away: the news needs one light-trip to reach Earth,
// and by then the craft has already acted on its standing order. A new command needs one more trip and
// arrives too late. The pulse animation is compressed in time; the countdown it shows is the engine's
// countdown(oneWay_s, fraction) of the real light time.
import { useEffect, useState } from 'react';
import type { CrisisCard, CrisisOption } from '../../engine/crisis';
import { countdown } from '../../engine/flightMap';
import type { Phase } from '../../engine/risk';
import { PHASE_NAME } from '../cadetWords';
import * as f from '../format';
import { SourceInfo } from './SourceInfo';

/** How long the pulse takes on screen (any light delay is squeezed into this). */
export const PULSE_MS = 5000;
const TICK_MS = 100;

type Stage = 'news' | 'acted' | 'choose' | 'sending' | 'late';

interface Props {
  card: CrisisCard;
  day: number;
  phase: Phase;
  destName: string;
  signal: { distance_m: number; oneWay_s: number; roundTrip_s: number };
  /** The option the craft took (its standing order). */
  order: CrisisOption;
  /** Options a new command could pick. */
  others: CrisisOption[];
  onContinue: () => void;
}

export function MissionControl({ card, day, phase, destName, signal, order, others, onContinue }: Props) {
  const [stage, setStage] = useState<Stage>('news');
  const [elapsed, setElapsed] = useState(0);
  const [command, setCommand] = useState<CrisisOption>();
  const moving = stage === 'news' || stage === 'sending';

  useEffect(() => {
    if (!moving) return;
    if (elapsed >= PULSE_MS) {
      setStage(stage === 'news' ? 'acted' : 'late');
      setElapsed(0);
      return;
    }
    const t = setTimeout(() => setElapsed(elapsed + TICK_MS), TICK_MS);
    return () => clearTimeout(t);
  }, [moving, elapsed, stage]);

  const fraction = elapsed / PULSE_MS;
  const left = countdown(signal.oneWay_s, fraction);
  // Pulse position along the line (layout): news travels craft → Earth, a command Earth → craft.
  const pulseAt = stage === 'news' ? 1 - fraction : stage === 'sending' ? fraction : stage === 'acted' || stage === 'choose' ? 0 : 1;

  return (
    <div className="tf-backdrop" role="dialog" aria-modal="true" aria-labelledby="mc-title">
      <div className="mc">
        <div className="mc-alert">
          <span className="mc-siren" aria-hidden="true">
            🚨
          </span>
          <span className="kicker">
            Day {f.num(day)} · {PHASE_NAME[phase]}
          </span>
        </div>
        <h2 id="mc-title" className="mc-title">
          {card.title}
        </h2>
        <p className="mc-prompt">{card.prompt}</p>

        <div className="mc-link" aria-label={`Earth to craft: ${f.distance(signal.distance_m)}`}>
          <span className="mc-end">
            <span className="mc-earth" aria-hidden="true" />
            Earth
          </span>
          <span className="mc-line">
            <span className="mc-dist">{f.distance(signal.distance_m)}</span>
            {moving && <span className={`mc-pulse ${stage}`} style={{ left: `${pulseAt * 100}%` }} aria-hidden="true" />}
          </span>
          <span className="mc-end">
            <span aria-hidden="true">🛰</span>
            {phase === 'cruise' ? 'Your craft' : `At ${destName}`}
          </span>
        </div>

        <div className="mc-status" aria-live="polite">
          {stage === 'news' && (
            <p>
              📡 News of the crisis reaches Earth in <b className="mono">{f.clock(left)}</b>
            </p>
          )}
          {(stage === 'acted' || stage === 'choose') && (
            <>
              <p>The news is here, but your craft did not wait. It followed your standing order:</p>
              <div className="mc-order">✅ {order.label}</div>
            </>
          )}
          {stage === 'sending' && command && (
            <p>
              📤 Sending “{command.label}”. Your command arrives in <b className="mono">{f.clock(left)}</b>
            </p>
          )}
          {stage === 'late' && (
            <>
              <p className="mc-late">⏰ Too late!</p>
              <p>
                Your command arrived <b className="mono">{f.clock(signal.roundTrip_s)}</b> after the crisis began. The craft had already acted on its standing order. That is why real missions queue their commands in advance.
              </p>
            </>
          )}
          {stage === 'choose' && (
            <div className="mc-choose" role="group" aria-label="New command">
              {others.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="btn-big ghost"
                  onClick={() => {
                    setCommand(o);
                    setStage('sending');
                  }}
                >
                  📤 {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mc-history">
          <SourceInfo s={card.realHistory} title="Real history" />
          <span>{card.realHistory.value}</span>
        </div>

        <div className="tf-actions mc-actions">
          {stage === 'acted' && others.length > 0 && (
            <button type="button" className="btn-big ghost" onClick={() => setStage('choose')}>
              Send a new command
            </button>
          )}
          {moving && (
            <button type="button" className="btn-big ghost" onClick={() => setElapsed(PULSE_MS)}>
              Skip
            </button>
          )}
          {(stage === 'acted' || stage === 'late') && (
            <button type="button" className="btn-big" onClick={onContinue}>
              Continue flight →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
