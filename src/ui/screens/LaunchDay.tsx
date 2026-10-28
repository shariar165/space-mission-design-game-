// LAUNCH DAY: the short step after packing (spec UI rules 24 and 26). Six weeks of launch days for the packed craft,
// each coloured by the launch and Δv meters on that day (engine dayQuality); the best day is chosen until the player
// picks one (engine bestLaunchDay). Engineer mode always comes here from Pack; a Cadet comes by CHANGE ▸. Then ARM
// and LAUNCH. Every number is the engine's.
import { useState } from 'react';
import { DESTINATIONS } from '../../engine/data';
import { packBlockers, type Packed } from '../../engine/pack';
import type { Design } from '../../engine/types';
import { BackButton } from '../components/sd/BackButton';
import { LaunchCalendar } from '../components/sd/LaunchCalendar';
import { MissionSteps } from '../components/sd/MissionSteps';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { LangToggle } from '../components/sd/LangToggle';
import { SoundToggle } from '../components/sd/SoundToggle';
import { SDIcon } from '../components/sd/SDIcon';
import * as f from '../format';
import { useLaunchPlan } from '../launchPlan';
import { useIsPhone } from '../sdGeometry';
import { BRAND_WORDS, DAY_WORDS, GAME_NAME, LAUNCH_CHECKS, LAUNCH_DAY_WORDS, PACK_BLOCKER, PACK_WORDS, shortDate } from '../sdWords';

interface Props {
  base: Design;
  packed: Packed;
  /** The player's day (calendar index), if picked. */
  pick?: number;
  onPick: (i: number | undefined) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  missionName: string;
  onHome: () => void;
  onBack: () => void;
  onLaunch: (d: Design) => void;
}

export function LaunchDay({ base, packed, pick, onPick, mode, onMode, missionName, onHome, onBack, onLaunch }: Props) {
  const engineer = mode === 'engineer';
  const phone = useIsPhone();
  const dest = DESTINATIONS[base.destination];
  const plan = useLaunchPlan(base, packed, pick);
  const [armed, setArmed] = useState(false);
  const blockers = packBlockers(packed, plan.ev);
  const q = plan.q;
  const day = plan.day;
  const ready = armed && q !== undefined && q.quality !== 'bad' && blockers.length === 0;

  const checks = [
    { id: 'packed', text: LAUNCH_CHECKS.packed, done: blockers.length === 0 },
    { id: 'day', text: LAUNCH_CHECKS.day, done: q !== undefined && q.quality !== 'bad' },
    { id: 'arm', text: LAUNCH_CHECKS.arm, done: armed },
    { id: 'go', text: LAUNCH_CHECKS.go, done: false },
  ];
  const todo = checks.find((c) => !c.done)?.id;

  const facts = day && q && (
    <dl className="ld-facts">
      <div>
        <dt>{LAUNCH_DAY_WORDS.title}</dt>
        <dd>{shortDate(day.date)}</dd>
      </div>
      {day.arrivalDate && (
        <div>
          <dt>{LAUNCH_DAY_WORDS.arrives}</dt>
          <dd>{shortDate(day.arrivalDate)}</dd>
        </div>
      )}
      {day.flightDays !== undefined && (
        <div>
          <dt>{LAUNCH_DAY_WORDS.flight}</dt>
          <dd>{f.days(day.flightDays).toUpperCase()}</dd>
        </div>
      )}
      <div>
        <dt>{plan.auto ? LAUNCH_DAY_WORDS.best : LAUNCH_DAY_WORDS.yours}</dt>
        <dd className={q.quality}>{DAY_WORDS[q.quality].short}</dd>
      </div>
      {engineer && day.c3 !== undefined && (
        <div className="eng">
          <dt>{LAUNCH_DAY_WORDS.c3}</dt>
          <dd>
            {f.c3(day.c3)} · {f.speed(day.vInfArr_ms ?? 0)}
          </dd>
        </div>
      )}
      {engineer && q.massMargin !== undefined && (
        <div className="eng">
          <dt>{LAUNCH_DAY_WORDS.margins}</dt>
          <dd>
            {f.signedPct(q.massMargin, 0)} · {f.signedPct(q.deltaVMargin ?? 0, 0)}
          </dd>
        </div>
      )}
    </dl>
  );

  return (
    <div className={`sd pk ld${phone ? ' phone' : ''}${engineer ? ' eng' : ''}`}>
      <header className="pk-top">
        <div className="pk-top-left">
          <BackButton onBack={onBack} />
          {!phone && (
            <div className="sd-brand">
              <button type="button" className="sd-brand-name" onClick={onHome} aria-label={BRAND_WORDS.home}>
                {GAME_NAME}
              </button>
              <span className="sd-brand-sub">{BRAND_WORDS.sub(missionName, dest.name)}</span>
            </div>
          )}
        </div>
        {!phone && <MissionSteps at={0} />}
        <div className="pk-top-right">
          <span className="sd-top-keys">
            <LangToggle />
            <SoundToggle />
            <ModeLever mode={mode} onMode={onMode} />
          </span>
        </div>
      </header>
      <main className="pk-panel ld-main" aria-label={LAUNCH_DAY_WORDS.title}>
        <div className="ld-head">
          <h1 className="ld-title">{LAUNCH_DAY_WORDS.title}</h1>
          <p className="ld-sub">{LAUNCH_DAY_WORDS.sub}</p>
        </div>
        <LaunchCalendar days={plan.days} quality={plan.quality} dayIdx={plan.dayIdx} onPick={onPick} destName={dest.name} engineer={engineer} phone={phone} />
        {facts}
        {!plan.auto && (
          <button type="button" className="sd-ghost-btn ld-best" onClick={() => onPick(undefined)}>
            {LAUNCH_DAY_WORDS.useBest}
          </button>
        )}
        {blockers[0] && <p className="ld-block">{PACK_BLOCKER[blockers[0].code]}</p>}
      </main>
      <footer className="pk-panel pk-launch-panel ld-foot">
        <ol className="pk-checks" aria-label={PACK_WORDS.checklist}>
          {checks.map((c) => (
            <li key={c.id} className={`${c.done ? 'done' : ''}${todo === c.id ? ' todo' : ''}`} aria-checked={c.done} role="checkbox" aria-disabled="true">
              <span className="pk-check-box">{c.done && <SDIcon icon="check" size={12} color="var(--sd-crt-hi)" />}</span>
              {c.text}
            </li>
          ))}
        </ol>
        <div className="pk-launch">
          <button type="button" className={`pk-arm${armed ? ' on' : ''}`} role="switch" aria-checked={armed} aria-label={PACK_WORDS.armLabel} onClick={() => setArmed((a) => !a)}>
            <span className="pk-arm-slot">
              <span className="pk-arm-knob" />
            </span>
            <span className="pk-arm-word">{PACK_WORDS.arm}</span>
          </button>
          <button type="button" className={`pk-go${ready ? ' ready' : ''}`} disabled={!ready} onClick={() => onLaunch(plan.design)}>
            {PACK_WORDS.launch}
          </button>
        </div>
      </footer>
    </div>
  );
}
