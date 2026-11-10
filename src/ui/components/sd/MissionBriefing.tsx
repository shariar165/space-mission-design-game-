// MISSION BRIEFING: what to do, how the stars are earned and the four steps, in plain words. Opens by itself the
// first time a level is packed, and from the MISSION INFO key. Words only (sdWords.ts); no numbers.
// On Red Planet a solo player also picks the mission objective here (spec UI rule 56): START waits for the pick, and
// in flight the same section shows the objective flown, read-only. The cards are the engine's (objectiveCards).
import { useEffect } from 'react';
import type { ObjectiveId } from '../../../engine/objectives';
import type { ObjectiveCard } from '../../../engine/team/setup';
import { REAL_MISSION_FOR } from '../../../engine/compare';
import { DESTINATIONS } from '../../../engine/data';
import { missionPreset } from '../../../engine/missions';
import type { DestinationId } from '../../../engine/types';
import { BRIEF_WORDS, MISSION_STEPS_WORDS, NAV, OBJECTIVE_PICK_WORDS as OP, OBJECTIVE_WORDS, PART_LOOK, REAL_MISSION_LINE, STAR_GOALS, type Briefing } from '../../sdWords';
import * as f from '../../format';
import { useIsPhone } from '../../sdGeometry';
import { BackButton } from './BackButton';
import { SDIcon } from './SDIcon';

interface Props {
  title: string;
  destination: DestinationId;
  briefing: Briefing;
  /** The idea this level teaches, if it is a level. */
  concept?: string;
  /** The mission objective: the cards to pick from (with `onPick`), or the one flown (read-only, in flight). */
  objective?: BriefObjective;
  onClose: () => void;
}

export interface BriefObjective {
  cards: ObjectiveCard[];
  picked?: ObjectiveId;
  /** Picking is open (Pack, before launch); START waits for a pick. */
  onPick?: (id: ObjectiveId) => void;
  /** ◂ BACK out of the level while no objective is picked yet. */
  onBack?: () => void;
}

export function MissionBriefing({ title, destination, briefing, concept, objective, onClose }: Props) {
  const dest = DESTINATIONS[destination].name.replace(/ \(.*\)$/, '');
  const real = REAL_MISSION_FOR[destination];
  const phone = useIsPhone();
  /** An objective must be picked before the briefing closes. */
  const mustPick = !!objective?.onPick && !objective.picked;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mustPick) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, mustPick]);

  const pick = objective?.onPick;
  const shown = objective ? (pick ? objective.cards : objective.cards.filter((c) => c.id === objective.picked)) : [];
  const objectiveSec = objective && shown.length > 0 && (
    <section className="sd-brief-sec sd-brief-obj">
      <h3>{pick ? OP.heading : OP.yours}</h3>
      {pick && <p className="sd-brief-obj-sub">{OP.sub}</p>}
      <div className="sd-brief-objs" role="radiogroup" aria-label={OP.group}>
        {shown.map((c) => {
          const w = OBJECTIVE_WORDS.objectives[c.id];
          const on = objective.picked === c.id;
          const body = (
            <>
              <span className="sd-brief-obj-title">{w.title}</span>
              {!phone && <span className="sd-brief-obj-line">{w.line}</span>}
              <span className="sd-brief-obj-needs">
                {OP.needs(c.parts.map((p) => PART_LOOK[p].short).join(OBJECTIVE_WORDS.or))}
                {c.matched && <span className="sd-brief-obj-on">{OP.onBoard}</span>}
              </span>
            </>
          );
          return pick ? (
            <button key={c.id} type="button" role="radio" aria-checked={on} className={`sd-brief-objcard${on ? ' on' : ''}`} onClick={() => pick(c.id)}>
              {body}
            </button>
          ) : (
            <div key={c.id} className="sd-brief-objcard on" role="radio" aria-checked="true" aria-disabled="true">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="sd-overlay" role="dialog" aria-modal="true" aria-label={BRIEF_WORDS.label}>
      <div className="sd-brief sd-paper">
        <div className="sd-brief-head">
          <span className="sd-history-k">{BRIEF_WORDS.kicker(dest)}</span>
          <h2 className="sd-brief-title">{title.toUpperCase()}</h2>
          {concept && <span className="sd-brief-concept">{BRIEF_WORDS.learn(concept)}</span>}
        </div>

        <section className="sd-brief-sec">
          <h3>{BRIEF_WORDS.job}</h3>
          <p className="sd-brief-job">{briefing.job}</p>
          <p className="sd-brief-tip">
            <SDIcon icon="star" size={16} color="var(--sd-red-ink)" /> {BRIEF_WORDS.tip} {briefing.tip}
          </p>
        </section>

        {objectiveSec}

        <section className="sd-brief-sec">
          <h3>{BRIEF_WORDS.stars}</h3>
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
          <h3>{BRIEF_WORDS.steps}</h3>
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
          {mustPick && objective?.onBack && <BackButton onBack={objective.onBack} />}
          <button type="button" className="sd-cta" disabled={mustPick} onClick={onClose}>
            {mustPick ? OP.startLocked : NAV.start}
          </button>
        </div>
      </div>
    </div>
  );
}
