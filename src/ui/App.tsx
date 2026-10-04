// App state: the player's Design and the current step. The engine is called here and in the screens;
// the UI never computes a number itself.
// Cadet: Level map → guided build (→ orders) → Flight with Mission Control → Debrief → next level.
// Engineer: Build Bay → crisis card → Debrief, unchanged.
import { useEffect, useMemo, useState } from 'react';
import { buildCadetDesign, CADET_STEPS, defaultChoices, type CadetChoices, type CadetStep } from '../engine/cadet';
import type { CrisisCard, CrisisOption } from '../engine/crisis';
import { crisisOrders, evaluateDesign, previewCrisis, simulateMission, standingOrderPolicy, type SimulationResult } from '../engine/index';
import type { Design, DestinationId } from '../engine/types';
import { LevelBanner, LevelGoal } from './components/LevelCards';
import { TopBar, type Mode, type Step } from './components/TopBar';
import { levelById, loadProgress, saveProgress, withStars, type Level, type Progress } from './levels';
import { BuildBay } from './screens/BuildBay';
import { CadetBuild } from './screens/CadetBuild';
import { CrisisScreen } from './screens/CrisisScreen';
import { Debrief } from './screens/Debrief';
import { Flight } from './screens/Flight';
import { LevelMap } from './screens/LevelMap';
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
  /** The level's starter design; the cards are applied on top of it. */
  base: Design;
  choices: CadetChoices;
  stepIdx: number;
  /** The level being played; undefined is a free build (all steps). */
  levelId?: string;
}

const cadetStart = (base: Design, levelId?: string): CadetState => ({ base, choices: defaultChoices(base), stepIdx: 0, ...(levelId ? { levelId } : {}) });

export function App() {
  const [mode, setMode] = useState<Mode>(storedMode);
  const [design, setDesign] = useState<Design>(() => starterDesign('mars', today()));
  const [cadet, setCadet] = useState<CadetState>(() => cadetStart(design));
  const [missionName, setMissionName] = useState(() => defaultMissionName('mars'));
  const [step, setStep] = useState<Step>(() => (mode === 'cadet' ? 'map' : 'build'));
  const [fixedSeed] = useState(urlSeed);
  const [seed, setSeed] = useState(() => fixedSeed ?? newSeed());
  const [sim, setSim] = useState<SimulationResult>();
  /** Standing orders (crisis card id → option id) the Cadet craft follows on its own. */
  const [orders, setOrders] = useState<Record<string, string>>({});
  const [flightCrisis, setFlightCrisis] = useState<{ card: CrisisCard; options: CrisisOption[] }>();
  const [progress, setProgress] = useState<Progress>(loadProgress);

  const cadetMode = mode === 'cadet';
  const level = levelById(cadet.levelId);
  const cadetDesign = useMemo(() => buildCadetDesign(cadet.base, cadet.choices), [cadet.base, cadet.choices]);
  /** The design being built and flown: Cadet derives it from the cards, Engineer edits it directly. */
  const active = cadetMode ? cadetDesign : design;
  const ev = useMemo(() => evaluateDesign(active), [active]);
  const preview = useMemo(() => (step === 'crisis' ? previewCrisis(active, seed) : undefined), [step, active, seed]);
  const withOrders = level?.orders ?? true;
  const orderList = useMemo(() => (cadetMode && withOrders ? crisisOrders(cadetDesign) : []), [cadetMode, withOrders, cadetDesign]);

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
    if (m === 'engineer') {
      setDesign(cadetDesign);
      if (step === 'map' || step === 'rescue' || step === 'flight') setStep('build');
    } else {
      setCadet(cadetStart(design));
      if (step === 'crisis') setStep('build');
    }
    setMode(m);
  };

  const playLevel = (l: Level) => {
    const s = starterDesign(l.destination, today());
    setCadet(cadetStart(s, l.id));
    setMissionName(defaultMissionName(l.destination));
    setOrders({});
    setSim(undefined);
    setStep('build');
  };

  const award = (stars: number) => level && setProgress((p) => withStars(p, level.id, stars));

  const fly = (optionId: string) => {
    setSim(simulateMission(active, { seed, crisisPolicy: () => optionId }));
    setStep('debrief');
  };

  const chooseCard = (s: CadetStep, id: string) => setCadet((c) => ({ ...c, choices: { ...c.choices, [s]: id } }));

  /** Cadet launch: the craft flies with its standing orders; the Flight screen replays the result. */
  const launchCadet = () => {
    if (ev.blockers.length) return;
    const p = previewCrisis(active, seed);
    setFlightCrisis(p && { card: p.card, options: p.options });
    setSim(simulateMission(active, { seed, crisisPolicy: standingOrderPolicy(orders) }));
    setStep('flight');
  };

  const retry = () => {
    setSeed(fixedSeed ?? newSeed());
    setSim(undefined);
    setStep('build');
  };

  return (
    <div className={`app${step === 'build' && !cadetMode ? ' fixed' : ''}${cadetMode ? ' is-cadet' : ''}`}>
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
      {cadetMode && step === 'map' && <LevelMap progress={progress} onPlay={playLevel} />}
      {step === 'build' && cadetMode && (
        <CadetBuild
          base={cadet.base}
          choices={cadet.choices}
          design={cadetDesign}
          ev={ev}
          steps={level?.steps ?? CADET_STEPS}
          stepIdx={cadet.stepIdx}
          onChoose={chooseCard}
          onStep={(i) => setCadet((c) => ({ ...c, stepIdx: i }))}
          onLaunch={launchCadet}
          orders={withOrders ? { list: orderList, chosen: orders, onChoose: (cardId, optionId) => setOrders((o) => ({ ...o, [cardId]: optionId })) } : undefined}
          goal={level && <LevelGoal level={level} stars={progress[level.id] ?? 0} onMap={() => setStep('map')} />}
          onTestFlight={(result) => {
            // Jupiter: the lesson star is for finding the launch failure in a Test Flight.
            if (level?.impossible && result.firstFail === 'launch') award(1);
          }}
        />
      )}
      {step === 'flight' && sim && (
        <Flight
          design={active}
          ev={ev}
          sim={sim}
          crisis={flightCrisis}
          missionName={missionName}
          onDone={() => {
            award(sim.stars);
            setStep('debrief');
          }}
        />
      )}
      {step === 'build' && !cadetMode && (
        <BuildBay design={design} ev={ev} engineer={mode === 'engineer'} onChange={setDesign} onLaunch={() => ev.blockers.length === 0 && setStep('crisis')} />
      )}
      {step === 'crisis' && preview && <CrisisScreen preview={preview} ev={ev} design={active} seed={seed} onChoose={fly} />}
      {step === 'crisis' && !preview && (
        <BuildBay design={active} ev={ev} engineer={mode === 'engineer'} onChange={setDesign} onLaunch={() => undefined} />
      )}
      {step === 'debrief' && sim && (
        <>
          {cadetMode && level && <LevelBanner level={level} stars={sim.stars} onPlay={playLevel} onMap={() => setStep('map')} onRetry={retry} />}
          <Debrief
            design={active}
            ev={ev}
            sim={sim}
            missionName={missionName}
            engineer={mode === 'engineer'}
            seed={seed}
            seedFromUrl={fixedSeed !== undefined}
            onRetry={retry}
            onEngineer={() => changeMode('engineer')}
          />
        </>
      )}
    </div>
  );
}
