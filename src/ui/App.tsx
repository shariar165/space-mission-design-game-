// App state: the player's Design and the current step. The engine is called here and in the screens;
// the UI never computes a number itself.
import { useEffect, useMemo, useState } from 'react';
import { buildCadetDesign, defaultChoices, type CadetChoices, type CadetStep, CADET_STEPS } from '../engine/cadet';
import { evaluateDesign, previewCrisis, simulateMission, type SimulationResult } from '../engine/index';
import type { Design, DestinationId } from '../engine/types';
import { TopBar, type Mode, type Step } from './components/TopBar';
import { BuildBay } from './screens/BuildBay';
import { CadetBuild } from './screens/CadetBuild';
import { CrisisScreen } from './screens/CrisisScreen';
import { Debrief } from './screens/Debrief';
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
}

const cadetStart = (base: Design): CadetState => ({ base, choices: defaultChoices(base), stepIdx: 0 });

export function App() {
  const [design, setDesign] = useState<Design>(() => starterDesign('mars', today()));
  const [cadet, setCadet] = useState<CadetState>(() => cadetStart(design));
  const [missionName, setMissionName] = useState(() => defaultMissionName('mars'));
  const [mode, setMode] = useState<Mode>(storedMode);
  const [step, setStep] = useState<Step>('build');
  const [fixedSeed] = useState(urlSeed);
  const [seed, setSeed] = useState(() => fixedSeed ?? newSeed());
  const [sim, setSim] = useState<SimulationResult>();

  const cadetDesign = useMemo(() => buildCadetDesign(cadet.base, cadet.choices), [cadet.base, cadet.choices]);
  /** The design being built and flown: Cadet derives it from the cards, Engineer edits it directly. */
  const active = mode === 'cadet' ? cadetDesign : design;
  const ev = useMemo(() => evaluateDesign(active), [active]);
  const preview = useMemo(() => (step === 'crisis' ? previewCrisis(active, seed) : undefined), [step, active, seed]);

  useEffect(() => {
    try {
      localStorage.setItem('mdt.mode', mode);
    } catch {
      /* storage unavailable: mode is per-session only */
    }
  }, [mode]);

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
    // Carry the craft across: Engineer starts from the Cadet build; Cadet re-reads the Engineer design as its base.
    if (m === 'engineer') setDesign(cadetDesign);
    else setCadet(cadetStart(design));
    setMode(m);
  };

  const fly = (optionId: string) => {
    setSim(simulateMission(active, { seed, crisisPolicy: () => optionId }));
    setStep('debrief');
  };

  const chooseCard = (s: CadetStep, id: string) => setCadet((c) => ({ ...c, choices: { ...c.choices, [s]: id } }));
  const cadetMode = mode === 'cadet';

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
      />
      {step === 'build' && cadetMode && (
        <CadetBuild
          base={cadet.base}
          choices={cadet.choices}
          design={cadetDesign}
          ev={ev}
          steps={CADET_STEPS}
          stepIdx={cadet.stepIdx}
          onChoose={chooseCard}
          onStep={(i) => setCadet((c) => ({ ...c, stepIdx: Math.max(0, Math.min(CADET_STEPS.length, i)) }))}
          onLaunch={() => ev.blockers.length === 0 && setStep('crisis')}
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
        <Debrief
          design={active}
          ev={ev}
          sim={sim}
          missionName={missionName}
          engineer={mode === 'engineer'}
          seed={seed}
          seedFromUrl={fixedSeed !== undefined}
          onRetry={() => {
            setSeed(fixedSeed ?? newSeed());
            setSim(undefined);
            setStep('build');
          }}
          onEngineer={() => changeMode('engineer')}
        />
      )}
    </div>
  );
}
