// HOME (Signal Delay design, screen 04). Four switches and the whole idea in one picture: an order leaves Earth
// and you watch it crawl to the robot, with MAVEN's real one-way light time at Mars arrival (engine).
import { useMemo, useState } from 'react';
import { countdown, signalDelay } from '../../engine/flightMap';
import { evaluateDesign } from '../../engine/index';
import { presetDesign } from '../../engine/missions';
import { CoachCard } from '../components/sd/CoachCard';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SoundToggle } from '../components/sd/SoundToggle';
import { CrewPlate, type Crew } from '../components/sd/CrewFile';
import { SDIcon, type SDIconName } from '../components/sd/SDIcon';
import { Teletype } from '../components/sd/Teletype';
import { useReducedMotion } from '../opsGeometry';
import { along, ring, useCycle, useIsPhone } from '../sdGeometry';
import { isUnlocked, LEVELS, type Level, type Progress } from '../levels';
import * as f from '../format';
import { HOW_TO_PLAY, POSTCARD_WORDS } from '../sdWords';

/** The demo order loops every 6 s: 5 s of flight, then a second of RECEIVED (design). */
export const HOME_LOOP_MS = 6000;
const FLIGHT_SHARE = 5 / 6;

const PITCH = 'YOU DON’T FLY THE ROCKET. YOU KEEP A ROBOT ALIVE MILLIONS OF KM AWAY, AND EVERY ORDER ARRIVES MINUTES LATE.';

interface MenuItem {
  label: string;
  sub: string;
  icon: SDIconName;
  tag: string;
  hot: boolean;
  onClick: () => void;
}

interface Props {
  progress: Progress;
  mode: Mode;
  onMode: (m: Mode) => void;
  daily: { number: number; played: boolean };
  rescue: { solved: number; total: number };
  notebook: { got: number; total: number };
  postcards: { got: number; total: number };
  /** Rank and badges (the crew file). */
  crew?: Crew;
  onPlay: (l: Level) => void;
  onMissions: () => void;
  onDaily: () => void;
  onRescue: () => void;
  onNotebook: () => void;
  onPostcards: () => void;
}

/** The level PLAY continues: the first open level without a star, else the last open one. */
export function nextToPlay(progress: Progress): { level: Level; index: number } {
  const open = LEVELS.map((l, i) => ({ level: l, index: i })).filter((x) => isUnlocked(x.index, progress));
  return open.find((x) => !(progress[x.level.id] ?? 0)) ?? open[open.length - 1]!;
}

export function Home({ progress, mode, onMode, daily, rescue, notebook, postcards, crew, onPlay, onMissions, onDaily, onRescue, onNotebook, onPostcards }: Props) {
  const phone = useIsPhone();
  const still = useReducedMotion();
  const cycle = useCycle(HOME_LOOP_MS, !still);
  const ringPhase = useCycle(700, !still);
  const oneWay = useMemo(() => {
    const maven = presetDesign('maven');
    const ev = evaluateDesign(maven);
    return signalDelay(maven, ev.trajectory.flightDays, ev).oneWay_s;
  }, []);
  const p = still ? 1 : Math.min(1, cycle / FLIGHT_SHARE);
  const left = countdown(oneWay, p);
  const next = nextToPlay(progress);
  const r = ring(ringPhase);
  const [howTo, setHowTo] = useState(false);

  const menu: MenuItem[] = [
    { label: 'DAILY MISSION', sub: `Daily #${f.num(daily.number)}. Same mission for everyone today.`, icon: 'calendar', tag: daily.played ? 'DONE ✓' : 'NEW TODAY', hot: !daily.played, onClick: onDaily },
    { label: 'RESCUE HISTORY', sub: 'Real robots that nearly died. Try to save them.', icon: 'rescue', tag: `${f.num(rescue.solved)} OF ${f.num(rescue.total)}`, hot: false, onClick: onRescue },
    { label: 'NOTEBOOK', sub: 'Real lessons you have earned.', icon: 'book', tag: `${f.num(notebook.got)} OF ${f.num(notebook.total)}`, hot: false, onClick: onNotebook },
    { label: POSTCARD_WORDS.menu, sub: POSTCARD_WORDS.menuSub, icon: 'postcard', tag: `${f.num(postcards.got)} OF ${f.num(postcards.total)}`, hot: false, onClick: onPostcards },
  ];
  const howToEl = howTo && <CoachCard title={HOW_TO_PLAY.label} onClose={() => setHowTo(false)} />;
  const howToKey = (
    <button type="button" className="hm-missions hm-howto" aria-label={`${HOW_TO_PLAY.label}: ${HOW_TO_PLAY.sub}`} onClick={() => setHowTo(true)}>
      ? {HOW_TO_PLAY.label}
    </button>
  );

  // Demo geometry (design: Earth bottom-left, Mars top-right with the robot orbiting it). Decorative, not to scale.
  const orbit = cycle * Math.PI * 2 * 0.86;
  const craft: [number, number] = phone ? [370 + 58 * Math.cos(orbit), 90 + 20 * Math.sin(orbit)] : [470 + 80 * Math.cos(orbit), 170 + 26 * Math.sin(orbit)];
  const earth: [number, number] = phone ? [50, 120] : [130, 520];
  const pulse = along(earth, craft, p);
  const count = p >= 1 ? 'RECEIVED ✓' : f.mmss(left);

  const play = (
    <button type="button" className="hm-play" onClick={() => onPlay(next.level)} aria-label={`Play: mission ${f.num(next.index + 1)}, ${next.level.title}`}>
      <span className="hm-play-icon">
        <SDIcon icon="play" size={phone ? 22 : 30} color="var(--sd-amber)" fill />
      </span>
      <span className="hm-play-text">
        <span className="hm-play-word">PLAY</span>
        <span className="hm-play-sub">
          Mission {f.num(next.index + 1)} · {next.level.title}
        </span>
      </span>
      <span className="hm-play-arrow">▸</span>
    </button>
  );

  const menuEls = menu.map((m) => (
    <button key={m.label} type="button" className="hm-key" aria-label={`${m.label}: ${m.sub} (${m.tag})`} onClick={m.onClick}>
      <span className="hm-key-top">
        <span className="hm-key-icon">
          <SDIcon icon={m.icon} size={phone ? 21 : 24} color="var(--sd-crt-hi)" />
        </span>
        {!phone && <span className={`hm-key-tag${m.hot ? ' hot' : ''}`}>{m.tag}</span>}
      </span>
      <span className="hm-key-label">{m.label}</span>
      {!phone && <span className="hm-key-sub">{m.sub}</span>}
      {phone && <span className={`hm-key-tag${m.hot ? ' hot' : ''}`}>{m.tag}</span>}
    </button>
  ));

  const crt = phone ? (
    <div className="hm-crt sd-crt" aria-hidden="true">
      <svg viewBox="0 0 440 180" preserveAspectRatio="xMidYMid meet" className="hm-svg">
        <g transform="translate(50 120)">
          <circle r="26" fill="var(--sd-earth)" />
          <path d="M-17 -8 q8 -12 18 -8 q3 9 -8 12 q-8 2 -10 -4z" fill="var(--sd-land)" />
        </g>
        <g transform="translate(370 90)">
          <circle r="34" fill="var(--sd-mars)" />
          <circle cx="-10" cy="-6" r="8" fill="var(--sd-mars-dark)" />
          <path d="M-17 -28 q17 -11 34 0 z" fill="var(--sd-ice)" />
        </g>
        <line x1={earth[0]} y1={earth[1]} x2={craft[0]} y2={craft[1]} className="crt-pulse-line" />
        <circle cx={pulse[0]} cy={pulse[1]} r={r.r} className="crt-pulse-ring" style={{ strokeOpacity: r.opacity }} />
        <circle cx={pulse[0]} cy={pulse[1]} r="6" className="crt-pulse-dot" />
        <g transform={`translate(${craft[0].toFixed(1)} ${craft[1].toFixed(1)}) scale(0.9)`}>
          <rect x="-27" y="-6" width="17" height="12" fill="var(--sd-panel-blue)" />
          <rect x="10" y="-6" width="17" height="12" fill="var(--sd-panel-blue)" />
          <rect x="-8" y="-8" width="16" height="16" rx="2" fill="var(--sd-bus-gold)" />
        </g>
      </svg>
      <span className="hm-count small">{count}</span>
    </div>
  ) : (
    <div className="hm-crt sd-crt">
      <svg viewBox="0 0 600 700" preserveAspectRatio="xMidYMid meet" className="hm-svg" aria-hidden="true">
        <circle cx="300" cy="350" r="240" className="crt-orbit" />
        <circle cx="300" cy="350" r="40" fill="var(--sd-sun)" />
        <circle cx="300" cy="350" r="31" fill="var(--sd-sun-core)" />
        <g transform="translate(130 520)">
          <circle r="34" fill="var(--sd-earth)" />
          <path d="M-22 -10 q10 -16 24 -10 q4 12 -10 16 q-10 2 -14 -6z M4 12 q12 -2 16 8 q-8 10 -18 4z" fill="var(--sd-land)" />
          <text y="62" textAnchor="middle" className="crt-label hm-label">
            EARTH
          </text>
        </g>
        <g transform="translate(470 170)">
          <circle r="44" fill="var(--sd-mars)" />
          <circle cx="-14" cy="-8" r="11" fill="var(--sd-mars-dark)" />
          <circle cx="14" cy="18" r="7" fill="var(--sd-mars-dark)" />
          <path d="M-22 -36 q22 -14 44 0 z" fill="var(--sd-ice)" />
          <ellipse rx="80" ry="26" className="hm-mars-orbit" transform="rotate(-20)" />
        </g>
        <line x1={earth[0]} y1={earth[1]} x2={craft[0]} y2={craft[1]} className="crt-pulse-line" />
        <circle cx={pulse[0]} cy={pulse[1]} r={10 + r.r} className="crt-pulse-ring" style={{ strokeOpacity: r.opacity }} />
        <circle cx={pulse[0]} cy={pulse[1]} r="8" className="crt-pulse-dot" />
        <g transform={`translate(${craft[0].toFixed(1)} ${craft[1].toFixed(1)}) scale(1.4)`}>
          <rect x="-27" y="-6" width="17" height="12" fill="var(--sd-panel-blue)" stroke="var(--sd-panel-edge)" strokeWidth="1" />
          <rect x="10" y="-6" width="17" height="12" fill="var(--sd-panel-blue)" stroke="var(--sd-panel-edge)" strokeWidth="1" />
          <rect x="-8" y="-8" width="16" height="16" rx="2" fill="var(--sd-bus-gold)" stroke="var(--sd-bus-edge)" strokeWidth="1" />
          <path d="M-7 -8 q7 -10 14 0 z" fill="var(--sd-paper)" />
        </g>
      </svg>
      <div className="hm-order" role="status">
        <span>ORDER: TURN ON CAMERA</span>
        <span className="hm-count">{count}</span>
        <span>UNTIL THE ROBOT HEARS YOU</span>
      </div>
    </div>
  );

  if (phone)
    return (
      <div className={`sd hm phone${mode === 'engineer' ? ' eng' : ''}`}>
        <div className="hm-phone-top">
          <SoundToggle />
          <ModeLever mode={mode} onMode={onMode} />
        </div>
        {crew && <CrewPlate crew={crew} className="phone" />}
        <h1 className="hm-word">
          SIGNAL
          <br />
          DELAY
        </h1>
        <Teletype className="hm-pitch sd-crt-text" text={PITCH} />
        {crt}
        {play}
        {menuEls}
        <button type="button" className="hm-missions" onClick={onMissions}>
          CHOOSE A MISSION ▸
        </button>
        {howToKey}
        {howToEl}
      </div>
    );

  return (
    <div className={`sd hm${mode === 'engineer' ? ' eng' : ''}`}>
      <div className="hm-frame">
        <div className="hm-left">
          <div className="hm-hero">
            <span className="hm-kicker-row">
              <span className="hm-kicker">MISSION CONTROL · DEEP SPACE</span>
              {crew && <CrewPlate crew={crew} />}
            </span>
            <h1 className="hm-word">
              SIGNAL
              <br />
              DELAY
            </h1>
            <Teletype className="hm-pitch sd-crt-text" text={PITCH} />
          </div>
          <div className="hm-grid">
            {play}
            {menuEls}
          </div>
          <div className="hm-foot">
            <span className="hm-foot-keys">
              <button type="button" className="hm-missions" onClick={onMissions}>
                CHOOSE A MISSION ▸
              </button>
              {howToKey}
              <SoundToggle className="hm-sound" />
            </span>
            <ModeLever mode={mode} onMode={onMode} />
          </div>
        </div>
        {crt}
      </div>
      {howToEl}
    </div>
  );
}
