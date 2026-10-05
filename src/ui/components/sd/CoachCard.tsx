// How to fly, in a few short panels: shown on the first flight, behind the ? key, and as HOW TO PLAY on Home.
import { useEffect, useState } from 'react';
import { COACH, NAV } from '../../sdWords';
import * as f from '../../format';
import { SDIcon } from './SDIcon';

export function CoachCard({ onClose, title = NAV.help }: { onClose: () => void; title?: string }) {
  const [i, setI] = useState(0);
  const panel = COACH[i]!;
  const last = i === COACH.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sd-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sd-coach sd-paper">
        <div className="sd-coach-head">
          <span className="sd-history-k">{title}</span>
          <span className="sd-coach-count">
            {f.num(i + 1)} / {f.num(COACH.length)}
          </span>
        </div>
        <div className="sd-coach-body">
          <span className="sd-coach-icon">
            <SDIcon icon={panel.icon} size={40} color="var(--sd-amber)" />
          </span>
          <div>
            <h2 className="sd-coach-title">{panel.title}</h2>
            <p className="sd-coach-text">{panel.body}</p>
          </div>
        </div>
        <div className="sd-coach-dots" aria-hidden="true">
          {COACH.map((c, k) => (
            <span key={c.title} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="sd-coach-foot">
          <button type="button" className="sd-ghost-btn" onClick={onClose}>
            SKIP
          </button>
          <span className="sd-coach-nav">
            {i > 0 && (
              <button type="button" className="sd-ghost-btn" onClick={() => setI(i - 1)}>
                {NAV.prev}
              </button>
            )}
            <button type="button" className="sd-cta" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? NAV.start : NAV.next}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
