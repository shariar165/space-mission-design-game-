// NAME YOUR ROBOT (Signal Delay design, screen 00), before the first mission. The robot gets a name before it gets a
// mission, and its first words come back at once: on the pad there is no light time yet. Today's sky (engine marsNow)
// says how long they will take from now on. Words in sdWords (NAME_WORDS); the name is saved as sd.robot.
import { useRef, useState } from 'react';
import type { MarsNow } from '../../engine/marsNow';
import { BackButton } from '../components/sd/BackButton';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SoundToggle } from '../components/sd/SoundToggle';
import { useTeletype } from '../components/sd/Teletype';
import { useLoop } from '../sound';
import * as f from '../format';
import { useIsPhone } from '../sdGeometry';
import { cleanRobotName, NAME_WORDS, ROBOT_NAME_MAX, robotNameOr } from '../sdWords';

interface Props {
  /** The saved name ('' when none yet). */
  name: string;
  mode: Mode;
  onMode: (m: Mode) => void;
  mars: MarsNow;
  /** LAUNCH: the name is final (saved by App). */
  onName: (name: string) => void;
  /** LOAD ‹NAME› (after the first words) or SKIP: on to the mission. */
  onDone: () => void;
  onBack: () => void;
}

const CELLS = Array.from({ length: ROBOT_NAME_MAX }, (_, i) => i);

export function NameRobot({ name: saved, mode, onMode, mars, onName, onDone, onBack }: Props) {
  const phone = useIsPhone();
  useLoop('hum');
  const eng = mode === 'engineer';
  const [name, setName] = useState(saved);
  const [launched, setLaunched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const l1 = useTeletype(NAME_WORDS.intro1);
  const l2 = useTeletype(l1 === NAME_WORDS.intro1 ? NAME_WORDS.intro2 : '');
  const introDone = l2 === NAME_WORDS.intro2;
  const first = useTeletype(launched ? NAME_WORDS.firstWords : '');
  const shown = name.trim();
  const has = shown.length > 0;

  const type = (raw: string) => {
    setName(cleanRobotName(raw));
    setLaunched(false);
  };
  const launch = () => {
    if (!has) return;
    onName(shown);
    setLaunched(true);
  };
  const focus = () => input.current?.focus({ preventScroll: true });

  const sky = (
    <div className="nm-sky sd-well">
      <span className="nm-sky-k">{phone ? `${NAME_WORDS.sky} · ${f.crtDate(mars.date)}` : NAME_WORDS.sky}</span>
      <span className="nm-sky-v sd-crt-text">
        {phone ? NAME_WORDS.skyPhone(f.wholeMinutes(mars.lightTime_s)) : NAME_WORDS.skyLine(f.crtDate(mars.date), f.wholeMinutes(mars.lightTime_s))}
      </span>
      {eng && <span className="nm-sky-eng">{NAME_WORDS.skyEng(f.au(mars.distance_m), f.millionKm(mars.distance_m), f.lightTime(mars.lightTime_s)).toUpperCase()}</span>}
    </div>
  );

  return (
    <div className={`sd nm${phone ? ' phone' : ''}${eng ? ' eng' : ''}`}>
      <div className="nm-frame">
        <header className="nm-top">
          <span className="nm-brand">
            <BackButton onBack={onBack} />
            <span className="nm-word">SIGNAL DELAY</span>
            {!phone && <span className="nm-kicker">{NAME_WORDS.kicker}</span>}
          </span>
          <span className="sd-top-keys">
            <SoundToggle />
            <ModeLever mode={mode} onMode={onMode} />
          </span>
        </header>

        <main className="nm-crt sd-crt" aria-label="Name your robot">
          <div className="nm-line sd-crt-text">
            <span className="sr-only">{NAME_WORDS.intro1}</span>
            <span aria-hidden="true">
              {l1}
              {l1 !== NAME_WORDS.intro1 && <span className="sd-cursor">█</span>}
            </span>
          </div>
          <div className="nm-line sd-crt-text">
            <span className="sr-only">{NAME_WORDS.intro2}</span>
            <span aria-hidden="true">
              {l2}
              {l1 === NAME_WORDS.intro1 && !introDone && <span className="sd-cursor">█</span>}
            </span>
          </div>
          <div className={`nm-name${introDone ? ' on' : ''}`}>
            <span className="nm-count">{NAME_WORDS.count(f.num(name.length), f.num(ROBOT_NAME_MAX))}</span>
            <div className="nm-cells" onClick={focus}>
              {CELLS.map((i) => {
                const cur = i === name.length && !launched && introDone;
                return (
                  <span key={i} className={`nm-cell${name[i] ? ' full' : ''}${cur ? ' cur' : ''}`} aria-hidden="true">
                    {cur ? <span className="sd-cursor">█</span> : (name[i] ?? '')}
                  </span>
                );
              })}
              <input
                ref={input}
                className="nm-input"
                value={name}
                maxLength={ROBOT_NAME_MAX}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="characters"
                aria-label={NAME_WORDS.input}
                onChange={(e) => type(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && launch()}
              />
            </div>
          </div>
          {launched && (
            <div className="nm-first" role="status">
              <span className="nm-first-k">
                {NAME_WORDS.firstHead(shown, f.dayPad(0))}
                {!phone && ` · ${NAME_WORDS.noDelay}`}
              </span>
              <span className="nm-first-v">
                <span className="sr-only">{NAME_WORDS.firstWords}</span>
                <span aria-hidden="true">
                  {first}
                  <span className="sd-cursor">█</span>
                </span>
              </span>
              {phone && <span className="nm-first-note">{NAME_WORDS.noDelay}</span>}
            </div>
          )}
        </main>

        <div className="nm-keys">
          {NAME_WORDS.suggestions.map((s, i) => (
            <button key={s} type="button" className={`nm-sugg${name === s ? ' on' : ''}`} onClick={() => type(s)}>
              {!phone && <span className="nm-sugg-tag">{NAME_WORDS.suggestion(f.num(i + 1))}</span>}
              <span className="nm-sugg-label">{s}</span>
            </button>
          ))}
          {launched ? (
            <button type="button" className="nm-go" onClick={onDone}>
              <span className="nm-go-text">
                <span className="nm-go-word">{NAME_WORDS.load(shown)}</span>
                {!phone && <span className="nm-go-sub">{NAME_WORDS.loadSub}</span>}
              </span>
              <span className="nm-go-arrow">▸</span>
            </button>
          ) : (
            <button type="button" className="nm-go" disabled={!has} onClick={launch}>
              <span className="nm-go-word">{NAME_WORDS.launch}</span>
              <span className="nm-go-arrow">▸</span>
            </button>
          )}
        </div>

        <div className="nm-foot">
          {sky}
          {!launched && (
            <button type="button" className="sd-ghost-btn nm-skip" onClick={onDone}>
              {NAME_WORDS.skip(robotNameOr(saved))}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
