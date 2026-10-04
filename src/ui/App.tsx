// App state: the player's Design and the current step. The engine is called here and in the screens;
// the UI never computes a number itself. One flight model everywhere (the Mission operations engine):
// Cadet: Level map → build → Fly & Survive → Mission Report → next level.
// Engineer: Build Bay → Fly & Survive → Mission Report (with Engineer details).
import { useEffect, useMemo, useState } from 'react';
import { evaluateDesign } from '../engine/index';
import { operationsDebrief, type OpsState } from '../engine/ops/index';
import type { Design, DestinationId } from '../engine/types';
import { TopBar, type Mode, type Step } from './components/TopBar';
import { levelById, loadProgress, saveProgress, shelfOf, withStars, type Level, type Progress } from './levels';
import { BuildBay } from './screens/BuildBay';
import { Pack } from './screens/Pack';
import { shelfFor } from '../engine/pack';
import { FlyAndSurvive } from './screens/FlyAndSurvive';
import { LevelMap } from './screens/LevelMap';
import { RescueCaseView, RescueSelect } from './screens/Rescue';
import type { RescueCaseId } from '../engine/rescue';
import { defaultMissionName, starterDesign, today } from './starters';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** ?seed=N in the URL: every flight uses that seed, so a demo replays identically. */
function urlSeed(): number | undefined {
  try {
    const v = new URLSearchParams(window.location.search).get('seed');
    if (v === null || !/^\d+$/.test(v.trim())) return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isSafeInteger(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function storedMode(): Mode {
  try {
    return localStorage.getItem('mdt.mode') === 'engineer' ? 'engineer' : 'cadet';
  } catch {
    return 'cadet';
  }
}

interface CadetState {
  /** The level's starter design; the packed parts are applied on top of it (Pack). */
  base: Design;
  /** The level being played; undefined is a free build (every part). */
  levelId?: string;
}

const cadetStart = (base: Design, levelId?: string): CadetState => ({ base, ...(levelId ? { levelId } : {}) });

export function App() {
  const [mode, setMode] = useState<Mode>(storedMode);
  const [design, setDesign] = useState<Design>(() => starterDesign('mars', today()));
  const [cadet, setCadet] = useState<CadetState>(() => cadetStart(design));
  const [missionName, setMissionName] = useState(() => defaultMissionName('mars'));
  const [step, setStep] = useState<Step>(() => (mode === 'cadet' ? 'map' : 'build'));
  const [fixedSeed] = useState(urlSeed);
  const [seed, setSeed] = useState(() => fixedSeed ?? newSeed());
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [rescueId, setRescueId] = useState<RescueCaseId>();
  /** The craft being flown, pinned at launch (a mode switch only changes what is shown). */
  const [flyDesign, setFlyDesign] = useState<Design>();
  /** The finished mission, for the Mission Report. */
  const [, setFlown] = useState<OpsState>();

  const cadetMode = mode === 'cadet';
  const level = levelById(cadet.levelId);
  /** The design being built: Cadet packs on top of the level's starter, Engineer edits it directly. */
  const active = cadetMode ? cadet.base : design;
  const ev = useMemo(() => evaluateDesign(active), [active]);

  useEffect(() => {
    try {
      localStorage.setItem('mdt.mode', mode);
    } catch {
      /* storage unavailable: mode is per-session only */
    }
  }, [mode]);

  useEffect(() => saveProgress(progress), [progress]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const changeDestination = (d: DestinationId) => {
    const s = starterDesign(d, today());
    setDesign(s);
    setCadet(cadetStart(s));
    setMissionName(defaultMissionName(d));
  };

  const changeMode = (m: Mode) => {
    if (m === mode) return;
    // Carry the craft across: Engineer starts from the Cadet build; Cadet re-reads the Engineer design as a free build.
    // In flight or on the report only the layer changes.
    if (m === 'engineer') {
      setDesign(flyDesign && step !== 'map' ? flyDesign : cadet.base);
      if (step === 'map' || step === 'rescue') setStep('build');
    } else if (step !== 'fly' && step !== 'report') {
      setCadet(cadetStart(design));
    }
    setMode(m);
  };

  const playLevel = (l: Level) => {
    const s = starterDesign(l.destination, today());
    setCadet(cadetStart(s, l.id));
    setMissionName(defaultMissionName(l.destination));
    setFlown(undefined);
    setStep('build');
  };

  const award = (stars: number) => level && setProgress((p) => withStars(p, level.id, stars));

  /** Launch: Fly & Survive flies the pinned craft with this seed. */
  const launchDesign = (d: Design) => {
    setFlyDesign(d);
    setFlown(undefined);
    setStep('fly');
  };
  const launch = () => ev.blockers.length === 0 && launchDesign(active);

  const finish = (s: OpsState) => {
    if (cadetMode) award(operationsDebrief(s).stars);
    setFlown(s);
    setSeed(fixedSeed ?? newSeed());
    setStep(cadetMode ? 'map' : 'build');
  };

  return (
    <div className={`app${step === 'build' && !cadetMode ? ' fixed' : ''}${cadetMode ? ' is-cadet' : ''}${step === 'fly' ? ' is-fly' : ''}`}>
      {step !== 'fly' && !(step === 'build' && cadetMode) && (
        <TopBar
          step={step}
          mode={mode}
          onMode={changeMode}
          missionName={missionName}
          onMissionName={setMissionName}
          destination={active.destination}
          onDestination={changeDestination}
          onMap={() => setStep('map')}
        />
      )}
      {cadetMode && step === 'map' && (
        <LevelMap
          progress={progress}
          onPlay={playLevel}
          onRescue={() => {
            setRescueId(undefined);
            setStep('rescue');
          }}
        />
      )}
      {cadetMode && step === 'rescue' && !rescueId && (
        <RescueSelect stars={{ mco: progress['rescue-mco'] ?? 0 }} onOpen={setRescueId} onMap={() => setStep('map')} />
      )}
      {cadetMode && step === 'rescue' && rescueId && (
        <RescueCaseView
          key={rescueId}
          id={rescueId}
          onSolved={(stars) => setProgress((p) => withStars(p, `rescue-${rescueId}`, stars))}
          onBack={() => setRescueId(undefined)}
        />
      )}
      {step === 'build' && cadetMode && (
        <Pack
          key={`${cadet.levelId ?? 'free'}-${cadet.base.destination}`}
          base={cadet.base}
          shelf={level ? shelfOf(level) : shelfFor(cadet.base.destination)}
          mode={mode}
          onMode={changeMode}
          missionName={missionName}
          {...(level?.impossible ? { impossible: true, onLesson: () => award(1) } : {})}
          onHome={() => setStep('map')}
          onLaunch={launchDesign}
        />
      )}
      {step === 'build' && !cadetMode && <BuildBay design={design} ev={ev} engineer onChange={setDesign} onLaunch={launch} />}
      {step === 'fly' && flyDesign && (
        <FlyAndSurvive
          design={flyDesign}
          seed={seed}
          mode={mode}
          onMode={changeMode}
          missionName={missionName}
          onHome={() => setStep(cadetMode ? 'map' : 'build')}
          onDone={finish}
        />
      )}
    </div>
  );
}
