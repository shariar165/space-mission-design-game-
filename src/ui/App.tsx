// App state: the player's Design and the current step. The engine is called here and in the screens;
// the UI never computes a number itself. One flight model everywhere (the Mission operations engine):
// Cadet: Home → (mission map) → Pack → Fly & Survive → Mission Report; Daily mission; Notebook; Rescue History.
// Engineer: Build Bay → Fly & Survive → Mission Report (with Engineer details).
import { useEffect, useMemo, useState } from 'react';
import { dailyDate, dailyDesign, dailyGrid, dailyNumber, dailySeed } from '../engine/daily';
import { evaluateDesign } from '../engine/index';
import { flightFacts, mergeFacts, newLessons, NOTEBOOK, notebook, notebookProgress, rescueProgress, type NotebookFacts } from '../engine/notebook';
import { operationsDebrief, type OpsState } from '../engine/ops/index';
import { shelfFor } from '../engine/pack';
import type { RescueCaseId } from '../engine/rescue';
import type { Design, DestinationId } from '../engine/types';
import { TopBar, type Mode, type Step } from './components/TopBar';
import { levelById, loadProgress, nextLevel, saveProgress, shelfOf, withStars, type Level, type Progress } from './levels';
import { loadDaily, loadFlights, saveDaily, saveFlights, type DailySave } from './saves';
import { BuildBay } from './screens/BuildBay';
import { Daily } from './screens/Daily';
import { FlyAndSurvive } from './screens/FlyAndSurvive';
import { Home } from './screens/Home';
import { LevelMap } from './screens/LevelMap';
import { MissionReport } from './screens/MissionReport';
import { Notebook } from './screens/Notebook';
import { Pack } from './screens/Pack';
import { RescueCaseView, RescueSelect } from './screens/Rescue';
import { LESSON_WORDS } from './sdWords';
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
  const [step, setStep] = useState<Step>(() => (mode === 'cadet' ? 'home' : 'build'));
  const [fixedSeed] = useState(urlSeed);
  const [seed, setSeed] = useState(() => fixedSeed ?? newSeed());
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [rescueId, setRescueId] = useState<RescueCaseId>();
  /** The craft being flown, pinned at launch (a mode switch only changes what is shown). */
  const [flyDesign, setFlyDesign] = useState<Design>();
  /** The finished mission, for the Mission Report. */
  const [flown, setFlown] = useState<OpsState>();
  /** Notebook facts from flights (hazards faced, seasons flown through); levels and rescues come from progress. */
  const [flights, setFlights] = useState(loadFlights);
  /** Lessons the last flight opened (NEW). */
  const [fresh, setFresh] = useState<string[]>([]);
  const [daily, setDaily] = useState<DailySave>(loadDaily);
  /** The flight in progress is today's Daily mission. */
  const [dailyRun, setDailyRun] = useState(false);

  const cadetMode = mode === 'cadet';
  const level = levelById(cadet.levelId);
  /** The design being built: Cadet packs on top of the level's starter, Engineer edits it directly. */
  const active = cadetMode ? cadet.base : design;
  const ev = useMemo(() => evaluateDesign(active), [active]);
  const facts: NotebookFacts = useMemo(() => ({ ...flights, progress }), [flights, progress]);
  const todayIso = dailyDate(Date.now());

  useEffect(() => {
    try {
      localStorage.setItem('mdt.mode', mode);
    } catch {
      /* storage unavailable: mode is per-session only */
    }
  }, [mode]);

  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveFlights(flights), [flights]);
  useEffect(() => saveDaily(daily), [daily]);

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
    // In flight, on the report and on the Cadet-only screens only the layer changes.
    if (m === 'engineer') {
      setDesign(flyDesign && step !== 'map' && step !== 'home' ? flyDesign : cadet.base);
      if (step === 'map' || step === 'rescue' || step === 'home') setStep('build');
    } else if (step === 'build') {
      setCadet(cadetStart(design));
    }
    setMode(m);
  };

  const playLevel = (l: Level) => {
    const s = starterDesign(l.destination, today());
    setCadet(cadetStart(s, l.id));
    setMissionName(defaultMissionName(l.destination));
    setFlown(undefined);
    setDailyRun(false);
    setStep('build');
  };

  /** Launch: Fly & Survive flies the pinned craft with this seed. */
  const launchDesign = (d: Design) => {
    setFlyDesign(d);
    setFlown(undefined);
    setStep('fly');
  };
  const launch = () => ev.blockers.length === 0 && launchDesign(active);

  /** Today's Daily: the same craft and seed for everyone; played once, then its card. */
  const openDaily = () => {
    if (daily.results[todayIso]) return setStep('daily');
    setMissionName('Daily mission');
    setDailyRun(true);
    setSeed(dailySeed(todayIso));
    launchDesign(dailyDesign(starterDesign('mars', todayIso)));
  };

  const finish = (s: OpsState) => {
    const stars = operationsDebrief(s).stars;
    const nextProgress = cadetMode && level && !dailyRun ? withStars(progress, level.id, stars) : progress;
    const nextFacts = mergeFacts(facts, flightFacts(s));
    const { progress: _p, ...flightOnly } = nextFacts;
    setFresh(newLessons(facts, { ...nextFacts, progress: nextProgress }));
    setProgress(nextProgress);
    setFlights(flightOnly);
    setFlown(s);
    if (dailyRun) {
      setDaily((d) => ({ played: [...new Set([...d.played, todayIso])], results: { ...d.results, [todayIso]: dailyGrid(s) } }));
      setStep('daily');
    } else setStep('report');
  };

  /** Fly again: back to packing (Cadet) or the Build Bay (Engineer), with a new seed. */
  const flyAgain = () => {
    setSeed(fixedSeed ?? newSeed());
    setFlown(undefined);
    setDailyRun(false);
    setStep('build');
  };
  const next = level && cadetMode && (progress[level.id] ?? 0) >= 1 ? nextLevel(level.id) : undefined;
  const home = () => {
    setStep(cadetMode ? 'home' : 'build');
  };
  const firstNew = fresh.length ? notebook(facts).find((c) => c.id === fresh[0]) : undefined;
  const fullScreen = step === 'fly' || step === 'report' || step === 'home' || step === 'daily' || step === 'notebook' || (step === 'build' && cadetMode);

  return (
    <div className={`app${step === 'build' && !cadetMode ? ' fixed' : ''}${cadetMode ? ' is-cadet' : ''}${step === 'fly' ? ' is-fly' : ''}`}>
      {!fullScreen && (
        <TopBar
          step={step}
          mode={mode}
          onMode={changeMode}
          missionName={missionName}
          onMissionName={setMissionName}
          destination={active.destination}
          onDestination={changeDestination}
          onMap={() => setStep('home')}
        />
      )}
      {cadetMode && step === 'home' && (
        <Home
          progress={progress}
          mode={mode}
          onMode={changeMode}
          daily={{ number: dailyNumber(todayIso), played: daily.results[todayIso] !== undefined }}
          rescue={rescueProgress(progress)}
          notebook={notebookProgress(facts)}
          onPlay={playLevel}
          onMissions={() => setStep('map')}
          onDaily={openDaily}
          onRescue={() => {
            setRescueId(undefined);
            setStep('rescue');
          }}
          onNotebook={() => setStep('notebook')}
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
        <RescueSelect stars={{ mco: progress['rescue-mco'] ?? 0 }} onOpen={setRescueId} onMap={() => setStep('home')} />
      )}
      {cadetMode && step === 'rescue' && rescueId && (
        <RescueCaseView
          key={rescueId}
          id={rescueId}
          onSolved={(stars) => setProgress((p) => withStars(p, `rescue-${rescueId}`, stars))}
          onBack={() => setRescueId(undefined)}
        />
      )}
      {step === 'notebook' && <Notebook facts={facts} fresh={fresh} mode={mode} onMode={changeMode} onHome={home} />}
      {step === 'daily' && daily.results[todayIso] && (
        <Daily
          number={dailyNumber(todayIso)}
          date={todayIso}
          grid={daily.results[todayIso]!}
          played={daily.played}
          mode={mode}
          onMode={changeMode}
          onHome={home}
          {...(flown && dailyRun ? { onReport: () => setStep('report') } : {})}
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
          {...(level?.impossible ? { impossible: true, onLesson: () => setProgress((p) => withStars(p, level.id, 1)) } : {})}
          onHome={() => setStep('home')}
          onLaunch={launchDesign}
        />
      )}
      {step === 'build' && !cadetMode && <BuildBay design={design} ev={ev} engineer onChange={setDesign} onLaunch={launch} />}
      {step === 'fly' && flyDesign && (
        <FlyAndSurvive design={flyDesign} seed={seed} mode={mode} onMode={changeMode} missionName={missionName} onHome={home} onDone={finish} />
      )}
      {step === 'report' && flown && flyDesign && (
        <MissionReport
          state={flown}
          design={flyDesign}
          mode={mode}
          onMode={changeMode}
          missionName={missionName}
          {...(next && !dailyRun ? { next: { title: next.title, onPlay: () => playLevel(next) } } : {})}
          {...(firstNew
            ? {
                newCard: {
                  num: firstNew.num,
                  total: NOTEBOOK.length,
                  title: LESSON_WORDS[firstNew.id]?.title ?? firstNew.id,
                  body: LESSON_WORDS[firstNew.id]?.body ?? '',
                  onOpen: () => setStep('notebook'),
                },
              }
            : {})}
          onFlyAgain={dailyRun ? home : flyAgain}
          onHome={home}
          homeLabel={cadetMode ? 'HOME' : 'BUILD BAY'}
        />
      )}
    </div>
  );
}
