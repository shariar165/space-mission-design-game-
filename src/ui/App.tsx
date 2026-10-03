// App state: the player's Design and the current step. The engine is called here and in the screens;
// the UI never computes a number itself.
import { useEffect, useMemo, useState } from 'react';
import { evaluateDesign, previewCrisis, simulateMission, type SimulationResult } from '../engine/index';
import type { Design, DestinationId } from '../engine/types';
import { TopBar, type Mode, type Step } from './components/TopBar';
import { BuildBay } from './screens/BuildBay';
import { CrisisScreen } from './screens/CrisisScreen';
import { Debrief } from './screens/Debrief';
import { defaultMissionName, starterDesign, today } from './starters';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function storedMode(): Mode {
  try {
    return localStorage.getItem('mdt.mode') === 'engineer' ? 'engineer' : 'cadet';
  } catch {
    return 'cadet';
  }
}

export function App() {
  const [design, setDesign] = useState<Design>(() => starterDesign('mars', today()));
  const [missionName, setMissionName] = useState(() => defaultMissionName('mars'));
  const [mode, setMode] = useState<Mode>(storedMode);
  const [step, setStep] = useState<Step>('build');
  const [seed, setSeed] = useState(newSeed);
  const [sim, setSim] = useState<SimulationResult>();

  const ev = useMemo(() => evaluateDesign(design), [design]);
  const preview = useMemo(() => (step === 'crisis' ? previewCrisis(design, seed) : undefined), [step, design, seed]);

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
    setDesign(starterDesign(d, today()));
    setMissionName(defaultMissionName(d));
  };

  const fly = (optionId: string) => {
    setSim(simulateMission(design, { seed, crisisPolicy: () => optionId }));
    setStep('debrief');
  };

  return (
    <div className={`app${step === 'build' ? ' fixed' : ''}`}>
      <TopBar
        step={step}
        mode={mode}
        onMode={setMode}
        missionName={missionName}
        onMissionName={setMissionName}
        destination={design.destination}
        onDestination={changeDestination}
      />
      {step === 'build' && (
        <BuildBay design={design} ev={ev} engineer={mode === 'engineer'} onChange={setDesign} onLaunch={() => ev.blockers.length === 0 && setStep('crisis')} />
      )}
      {step === 'crisis' && preview && <CrisisScreen preview={preview} ev={ev} design={design} onChoose={fly} />}
      {step === 'crisis' && !preview && (
        <BuildBay design={design} ev={ev} engineer={mode === 'engineer'} onChange={setDesign} onLaunch={() => undefined} />
      )}
      {step === 'debrief' && sim && (
        <Debrief
          design={design}
          ev={ev}
          sim={sim}
          missionName={missionName}
          engineer={mode === 'engineer'}
          onRetry={() => {
            setSeed(newSeed());
            setSim(undefined);
            setStep('build');
          }}
          onEngineer={() => setMode('engineer')}
        />
      )}
    </div>
  );
}
