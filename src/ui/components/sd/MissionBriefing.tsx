// MISSION BRIEFING: what to do, how the stars are earned and the four steps, in plain words. Opens by itself the
// first time a level is packed, and from the MISSION INFO key. Words only (sdWords.ts); no numbers.
import { useEffect } from 'react';
import { REAL_MISSION_FOR } from '../../../engine/compare';
import { DESTINATIONS } from '../../../engine/data';
import { missionPreset } from '../../../engine/missions';
import type { DestinationId } from '../../../engine/types';
import { MISSION_STEPS_WORDS, NAV, REAL_MISSION_LINE, STAR_GOALS, type Briefing } from '../../sdWords';
import * as f from '../../format';
import { SDIcon } from './SDIcon';

interface Props {
  title: string;
  destination: DestinationId;
  briefing: Briefing;
  /** The idea this level teaches, if it is a level. */
  concept?: string;
  onClose: () => void;
}

export function MissionBriefing({ title, destination, briefing, concept, onClose }: Props) {
  const dest = DESTINATIONS[destination].name.replace(/ \(.*\)$/, '');
  const real = REAL_MISSION_FOR[destination];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sd-overlay" role="dialog" aria-modal="true" aria-label="Mission briefing">
      <div className="sd-brief sd-paper">
        <div className="sd-brief-head">
          <span className="sd-history-k">MISSION BRIEFING · {dest.toUpperCase()}</span>
          <h2 className="sd-brief-title">{title.toUpperCase()}</h2>
          {concept && <span className="sd-brief-concept">YOU WILL LEARN: {concept.toUpperCase()}</span>}
        </div>

        <section className="sd-brief-sec">
          <h3>YOUR JOB</h3>
          <p className="sd-brief-job">{briefing.job}</p>
          <p className="sd-brief-tip">
            <SDIcon icon="star" size={16} color="var(--sd-red-ink)" /> TIP: {briefing.tip}
          </p>
        </section>

        <section className="sd-brief-sec">
          <h3>HOW TO EARN STARS</h3>
          <ol className="sd-brief-stars">
            {STAR_GOALS(dest).map((g, i) => (
              <li key={g}>
                <span className="sd-brief-starrow" aria-label={`${f.num(i + 1)} stars`}>
                  {Array.from({ length: i + 1 }, (_, k) => (
                    <SDIcon key={k} icon="star" size={14} color="var(--sd-gold)" fill />
                  ))}
                </span>
                {g}
              </li>
            ))}
          </ol>
        </section>

        <section className="sd-brief-sec">
          <h3>THE STEPS</h3>
          <ol className="sd-brief-steps">
            {MISSION_STEPS_WORDS.map((s, i) => (
              <li key={s.word}>
                <span className="sd-brief-num">{f.num(i + 1)}</span>
                <span>
                  <b>{s.word}</b> {s.line}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {real && <p className="sd-source">{REAL_MISSION_LINE(missionPreset(real).label)}</p>}

        <div className="sd-brief-foot">
          <button type="button" className="sd-cta" onClick={onClose}>
            {NAV.start}
          </button>
        </div>
      </div>
    </div>
  );
}
