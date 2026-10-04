// Cadet Build Bay: one decision per screen. "Step 2 of 5 — Power" with 2–3 big cards, the craft as the
// hero and the metaphor gauges under it; a last Review screen holds Test Flight and Launch.
// Every number comes from the engine: cadetOptions (cards), cadetGauges (gauges), testFlight.
import { useMemo, useState, type ReactNode } from 'react';
import { cadetGauges, cadetOptions, testFlight, type CadetChoices, type CadetStep } from '../../engine/cadet';
import { DESTINATIONS } from '../../engine/data';
import type { FullEvaluation } from '../../engine/index';
import type { Design } from '../../engine/types';
import { STEP_QUESTION, STEP_TITLE, stepHelper } from '../cadetWords';
import { CadetCraft } from '../components/CadetCraft';
import { ChoiceCard } from '../components/ChoiceCard';
import { Gauges } from '../components/Gauges';
import { TestFlight } from '../components/TestFlight';
import { Check } from '../components/icons';

const STEP_ICON: Record<CadetStep, string> = { science: '🔭', power: '🔋', radio: '📡', fuel: '⛽', rocket: '🚀' };

interface Props {
  base: Design;
  choices: CadetChoices;
  design: Design;
  ev: FullEvaluation;
  /** Steps the player decides in this level; the others keep their balanced cards. */
  steps: readonly CadetStep[];
  /** 0 … steps.length − 1 are decisions; steps.length is the Review screen. */
  stepIdx: number;
  onChoose: (step: CadetStep, id: string) => void;
  onStep: (i: number) => void;
  onLaunch: () => void;
  /** Optional level goal shown on the Review screen. */
  goal?: ReactNode;
  /** Called after a Test Flight finishes (levels can award a lesson star). */
  onTestFlight?: (failed: boolean) => void;
}

export function CadetBuild({ base, choices, design, ev, steps, stepIdx, onChoose, onStep, onLaunch, goal, onTestFlight }: Props) {
  const dest = DESTINATIONS[design.destination];
  const review = stepIdx >= steps.length;
  const step = steps[Math.min(stepIdx, steps.length - 1)]!;
  const gauges = useMemo(() => cadetGauges(ev), [ev]);
  const options = useMemo(() => (review ? [] : cadetOptions(base, choices, step)), [base, choices, step, review]);
  const [flight, setFlight] = useState<ReturnType<typeof testFlight>>();
  const blocked = ev.blockers.length > 0;

  return (
    <div className="cadet">
      <nav className="cprogress" aria-label="Build steps">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`cdot${i === stepIdx ? ' current' : i < stepIdx ? ' done' : ''}`}
            aria-current={i === stepIdx ? 'step' : undefined}
            onClick={() => onStep(i)}
          >
            <span className="cdot-icon" aria-hidden="true">
              {i < stepIdx ? <Check size={14} /> : STEP_ICON[s]}
            </span>
            <span className="cdot-name">{STEP_TITLE[s]}</span>
          </button>
        ))}
        <button type="button" className={`cdot${review ? ' current' : ''}`} aria-current={review ? 'step' : undefined} onClick={() => onStep(steps.length)}>
          <span className="cdot-icon" aria-hidden="true">
            🏁
          </span>
          <span className="cdot-name">Launch</span>
        </button>
      </nav>

      <div className="cadet-grid">
        <section className="stage" aria-label="Your spacecraft">
          <div className="stage-dest">
            <span className="kicker">Bound for</span> <b>{dest.name}</b>
          </div>
          <CadetCraft design={design} weight={gauges.weight.status} />
        </section>

        <section className="cpanel" aria-labelledby="cpanel-title">
          {review ? (
            <>
              <div className="ckicker">Ready to fly?</div>
              <h1 id="cpanel-title" className="ctitle">
                Check your craft, then launch
              </h1>
              <p className="chelper">Run a Test Flight first: it shows where your mission could go wrong.</p>
              {goal}
              <div className="review-actions">
                <button
                  type="button"
                  className="btn-big ghost"
                  onClick={() => {
                    setFlight(testFlight(design));
                  }}
                >
                  🛰 Test Flight
                </button>
                <button type="button" className="btn-big launch" disabled={blocked} onClick={onLaunch}>
                  🚀 Launch
                </button>
              </div>
              {blocked && <p className="locked-note">Launch is locked: the Test Flight shows why.</p>}
            </>
          ) : (
            <>
              <div className="ckicker">
                Step {stepIdx + 1} of {steps.length} — {STEP_TITLE[step]}
              </div>
              <h1 id="cpanel-title" className="ctitle">
                {STEP_QUESTION[step]}
              </h1>
              <p className="chelper">{stepHelper(step, dest.name)}</p>
              <div className="choices" role="group" aria-label={`${STEP_TITLE[step]} choices`}>
                {options.map((o) => (
                  <ChoiceCard key={o.id} o={o} onChoose={() => onChoose(step, o.id)} />
                ))}
              </div>
            </>
          )}
          <div className="cnav">
            <button type="button" className="btn-big ghost" disabled={stepIdx === 0} onClick={() => onStep(stepIdx - 1)}>
              ← Back
            </button>
            {!review && (
              <button type="button" className="btn-big" onClick={() => onStep(stepIdx + 1)}>
                {stepIdx === steps.length - 1 ? 'Review craft →' : 'Next →'}
              </button>
            )}
          </div>
        </section>

        <div className="gauge-dock">
          <Gauges gauges={gauges} ev={ev} design={design} destName={dest.name} />
        </div>
      </div>

      {flight && (
        <TestFlight
          result={flight}
          destName={dest.name}
          onClose={() => {
            onTestFlight?.(flight.firstFail !== undefined);
            setFlight(undefined);
          }}
        />
      )}
    </div>
  );
}
