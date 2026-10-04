// Test Flight: a short preview that flies the craft through the engine's checkpoints (testFlight())
// and stops at the first phase that fails, before the real launch. Timing is presentation only.
import { useEffect, useState } from 'react';
import type { TestFlightResult } from '../../engine/cadet';
import { PHASE_NAME, reasonSentence } from '../cadetWords';
import { StatusIcon } from './icons';

/** The whole preview lasts about ten seconds, split evenly over the checkpoints. */
export const TEST_FLIGHT_MS = 10_000;
/** Short pause before the craft leaves the pad. */
const LIFT_OFF_MS = 300;

const PHASE_ICON: Record<string, string> = { launch: '🚀', cruise: '🌌', arrival: '🪐', science: '🔭', return: '🏠' };

export function TestFlight({ result, destName, onClose }: { result: TestFlightResult; destName: string; onClose: () => void }) {
  const cps = result.checkpoints;
  const stopAt = cps.findIndex((c) => c.status === 'fail');
  const last = stopAt >= 0 ? stopAt : cps.length - 1;
  const [at, setAt] = useState(-1);
  const done = at >= last;

  useEffect(() => {
    if (done) return;
    const delay = at < 0 ? LIFT_OFF_MS : TEST_FLIGHT_MS / cps.length;
    const t = setTimeout(() => setAt(at + 1), delay);
    return () => clearTimeout(t);
  }, [at, done, cps.length]);

  const failed = done && stopAt >= 0;
  const findings = cps.slice(0, Math.max(0, at + 1)).filter((c) => c.status !== 'pass');
  const markerLeft = `${((Math.max(0, at) + 0.5) / cps.length) * 100}%`;

  return (
    <div className="tf-backdrop" role="dialog" aria-modal="true" aria-labelledby="tf-title">
      <div className="tf">
        <div className="tf-head">
          <h2 id="tf-title" className="h2">
            Test Flight
          </h2>
          <button type="button" className="popover-close" aria-label="Close test flight" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="tf-track">
          {cps.map((c, i) => (
            <div key={c.phase} className={`tf-seg ${i <= at ? c.status : 'ahead'}`} aria-current={i === at ? 'step' : undefined}>
              <span className="tf-icon" aria-hidden="true">
                {PHASE_ICON[c.phase]}
              </span>
              <span className="tf-name">{PHASE_NAME[c.phase]}</span>
              {i <= at && (
                <span className="tf-st">
                  <StatusIcon status={c.status === 'pass' ? 'ok' : c.status === 'shaky' ? 'warning' : 'over'} size={13} />
                </span>
              )}
            </div>
          ))}
          <span className={`tf-craft${failed ? ' boom' : ''}`} style={{ left: markerLeft }} aria-hidden="true">
            {failed ? '💥' : '🛰'}
          </span>
        </div>
        <div className="tf-out" aria-live="polite">
          {!done && <p className="muted">Flying the plan…</p>}
          {done && !failed && findings.length === 0 && <p className="tf-good">All clear! Your craft makes it all the way.</p>}
          {done && failed && <p className="tf-bad">This mission would fail during {PHASE_NAME[cps[stopAt]!.phase].toLowerCase()}.</p>}
          {done && !failed && findings.length > 0 && <p className="tf-warn">It makes it, but some parts are risky.</p>}
          <ul className="tf-findings">
            {findings.flatMap((c) =>
              c.reasons.map((r) => (
                <li key={`${c.phase}-${r}`} className={c.status}>
                  <StatusIcon status={c.status === 'shaky' ? 'warning' : 'over'} size={13} /> <b>{PHASE_NAME[c.phase]}:</b> {reasonSentence(r, destName)}
                </li>
              )),
            )}
          </ul>
        </div>
        <div className="tf-actions">
          {!done && (
            <button type="button" className="btn-big ghost" onClick={() => setAt(last)}>
              Skip
            </button>
          )}
          {done && (
            <button type="button" className="btn-big" onClick={onClose}>
              {failed ? 'Fix my craft' : 'Back to the craft'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
