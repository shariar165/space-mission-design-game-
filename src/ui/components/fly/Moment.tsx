// Big moments on the flight screen: the launch countdown (T−5 … LIFTOFF, engine countdownAt) and the banners for
// the arrival burn and a solar storm hit (engine momentsSince). Presentation only: they never change the flight.
import { useEffect, useRef, useState } from 'react';
import { countdownAt } from '../../../engine/ops/index';
import { play } from '../../sound';
import { MOMENT_WORDS } from '../../sdWords';

/** A banner stays this long (ms, real time). */
export const BANNER_MS = 2800;
const TICK_MS = 100;

export function LaunchCountdown({ onDone, still }: { onDone: () => void; still: boolean }) {
  const [t0] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const c = countdownAt(elapsed);
  const last = useRef<string>('');
  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), TICK_MS);
    return () => clearInterval(id);
  }, [t0]);
  useEffect(() => {
    const k = c.liftoff ? 'liftoff' : String(c.count);
    if (k === last.current) return;
    last.current = k;
    play(c.liftoff ? 'launch' : 'tick');
  }, [c.count, c.liftoff]);
  useEffect(() => {
    if (c.done) onDone();
  }, [c.done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`mo-launch${c.liftoff ? ' liftoff' : ''}${still ? ' still' : ''}`} role="dialog" aria-label={MOMENT_WORDS.countdownK}>
      <div className="mo-pad">
        <svg className="mo-rocket" viewBox="-40 -150 80 230" aria-hidden="true">
          <g className="mo-smoke">
            <circle cx="-26" cy="62" r="16" />
            <circle cx="24" cy="64" r="18" />
            <circle cx="0" cy="70" r="20" />
          </g>
          <g className="mo-ship">
            <path className="mo-flame" d="M-10 40 Q0 92 10 40 Z" />
            <path d="M-14 -70 Q0 -140 14 -70 L14 36 L-14 36 Z" fill="var(--sd-paper)" stroke="var(--sd-paper-ink)" strokeWidth="2" />
            <path d="M-14 6 L-28 38 L-14 32 Z M14 6 L28 38 L14 32 Z" fill="var(--sd-red)" />
            <circle cy="-48" r="7" fill="var(--sd-panel-blue)" stroke="var(--sd-paper-ink)" strokeWidth="2" />
            <rect x="-14" y="-12" width="28" height="6" fill="var(--sd-red)" />
          </g>
        </svg>
      </div>
      <span className="mo-count-k">{MOMENT_WORDS.countdownK}</span>
      <span className="mo-count" aria-live="polite">
        {c.liftoff ? MOMENT_WORDS.liftoff : MOMENT_WORDS.count(c.count)}
      </span>
      <button type="button" className="sd-ghost-btn mo-skip" onClick={onDone}>
        {MOMENT_WORDS.skip}
      </button>
    </div>
  );
}

export function MomentBanner({ kind, title, sub }: { kind: string; title: string; sub: string }) {
  return (
    <div className={`mo-banner ${kind}`} aria-live="polite">
      <span className="mo-burst" aria-hidden="true" />
      <span className="mo-banner-title">{title}</span>
      <span className="mo-banner-sub">{sub}</span>
    </div>
  );
}
