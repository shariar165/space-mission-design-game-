// App state: the player's Design and the current step. The engine is called here and in the screens;
// the UI never computes a number itself. One flight model everywhere (the Mission operations engine):
// Cadet: Home → (mission map) → Pack → Fly & Survive → Mission Report; Daily mission; Notebook; Rescue History.
// Before the first Cadet mission (or Daily) the robot gets a name: Name Your Robot.
// The very first launch opens with the cold open (Mars Climate Orbiter, 1999), then Name Your Robot, then Home.
// Engineer: Build Bay → Fly & Survive → Mission Report (with Engineer details).
// Team mode (local co-op): Home → Team Setup → Mission Objective → Pack (Mars), every team action on one log (useTeam).
// Every step has ◂ BACK: the steps visited are kept on a trail, and the browser's own Back button walks it too.
import { useEffect, useMemo, useRef, useState } from 'react';
import { dailyDate, dailyDesign, dailyGrid, dailyNumber, dailySeed, dailyStreak } from '../engine/daily';
import { marsNow } from '../engine/marsNow';
import { badges, newBadges, rankFor, starTotals, type RankDef } from '../engine/ranks';
import { evaluateDesign } from '../engine/index';
import { flightFacts, mergeFacts, newLessons, NOTEBOOK, notebook, notebookProgress, rescueProgress, type NotebookFacts } from '../engine/notebook';
import { operationsDebrief, type OpsState } from '../engine/ops/index';
import { initialPack, levelCostCap, packLimits, packPart, rocketIdOf, rocketOptions, shelfFor, withRocket, type Packed, type PackLimit, type PartId } from '../engine/pack';
import { scienceReturned } from '../engine/ops/observe';
import type { RescueCaseId } from '../engine/rescue';
import type { Design, DestinationId } from '../engine/types';
import { TopBar, type Mode, type Step } from './components/TopBar';
import { LEVELS, levelById, loadProgress, maxStars, nextLevel, saveProgress, shelfOf, withStars, type Level, type Progress } from './levels';
import { loadDaily, loadFlights, loadLevelPacks, loadPostcards, loadRobotName, loadSeen, loadTeam, saveDaily, saveFlights, saveLevelPack, savePostcards, saveRobotName, saveSeen, saveTeam, type DailySave } from './saves';
import { defaultTeam } from '../engine/team/setup';
import { teamDesign } from '../engine/team/reduce';
import { objectiveCards } from '../engine/team/setup';
import type { Team } from '../engine/team/roles';
import { OBJECTIVE_IDS, type ObjectiveId } from '../engine/objectives';
import { orbitIdOf, orbitPresets, withOrbit } from '../engine/orbitPresets';
import { useTeam } from './useTeam';
import { TeamObjective } from './screens/TeamObjective';
import { TeamSetup } from './screens/TeamSetup';
import { useRoomHost, useRoomPhone } from './online/useRoom';
import { OnlineHost } from './screens/OnlineHost';
import { OnlineJoin } from './screens/OnlineJoin';
import { Controller } from './screens/Controller';
import { RoomBar, RoomHold } from './components/online/RoomHold';
import type { FlightLink } from '../engine/team/online';
import { cleanRoomCode, validRoomCode, type RoomStage } from '../engine/team/room';
import { Postcards } from './screens/Postcards';
import { postcardAlbum, postcardsEarned } from '../engine/postcards';
import type { Crew } from './components/sd/CrewFile';
import { BuildBay } from './screens/BuildBay';
import { ColdOpen } from './screens/ColdOpen';
import { Daily } from './screens/Daily';
import { FlyAndSurvive } from './screens/FlyAndSurvive';
import { Home } from './screens/Home';
import { LevelMap } from './screens/LevelMap';
import { MissionReport } from './screens/MissionReport';
import { LaunchDay } from './screens/LaunchDay';
import { NameRobot } from './screens/NameRobot';
import { Notebook } from './screens/Notebook';
import { Pack } from './screens/Pack';
import { RescueCaseView, RescueSelect } from './screens/Rescue';
import { BRIEF_WORDS, BRIEFING, DAILY_BRIEFING, FREE_BRIEFING, LESSON_WORDS, LEVEL_WORDS, LIVE_WEATHER, NAV } from './sdWords';
import { loadSpaceWeather, type SpaceWeather } from './donki';
import { useLang } from './lang';
import { defaultMissionName, starterDesign, today } from './starters';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * ?play=<level id> in the URL: open that level's Pack straight away (a judge's or a teacher's link), whatever is
 * unlocked; saved progress is not changed. Unknown ids are ignored.
 */
function urlPlay(): Level | undefined {
  try {
    const v = new URLSearchParams(window.location.search).get('play');
    return v ? levelById(v.trim()) : undefined;
  } catch {
    return undefined;
  }
}

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

/** #join=MARS-7K2 in the URL: a phone opens straight on JOIN A ROOM with the code typed (spec: Online room). */
function joinLink(): string | undefined {
  try {
    const m = /^#join=([A-Za-z0-9-]+)$/.exec(window.location.hash);
    const code = m ? cleanRoomCode(m[1]!) : undefined;
    return code && validRoomCode(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

/** The online room's stage for a host screen step (undefined: not a step of the room's mission). */
const stageOf = (step: Step): RoomStage | undefined =>
  step === 'objective' ? 'objective' : step === 'build' || step === 'launch' ? 'pack' : step === 'fly' ? 'fly' : step === 'report' ? 'report' : undefined;

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

/** A new player: Cadet, no name screen behind them, no robot name and the cold open never seen (or skipped). */
function firstLaunch(mode: Mode): boolean {
  const seen = loadSeen();
  return mode === 'cadet' && !seen.includes('cold-open') && !seen.includes('name') && !loadRobotName();
}

export function App() {
  // The words' language (EN / বাংলা): a switch re-renders every screen in place, so a flight keeps flying.
  useLang();
  const [mode, setMode] = useState<Mode>(storedMode);
  const [design, setDesign] = useState<Design>(() => starterDesign('mars', today()));
  const [cadet, setCadet] = useState<CadetState>(() => cadetStart(design));
  const [missionName, setMissionName] = useState(() => defaultMissionName('mars'));
  const [linkCode] = useState(joinLink);
  /** A ?play= link's level, opened once on load (Cadet only; it skips the cold open). */
  const [linkLevel] = useState(() => (mode === 'cadet' ? urlPlay() : undefined));
  const [step, setStep] = useState<Step>(() => (linkCode ? 'join' : mode === 'cadet' ? (firstLaunch(mode) && !linkLevel ? 'cold' : 'home') : 'build'));
  /** The cold open on show is the first launch's (it goes on to the name screen), not a replay from Home. */
  const coldFirst = useRef(step === 'cold');
  /** The steps visited before this one, for ◂ BACK. */
  const [trail, setTrail] = useState<Step[]>([]);
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
  /** Today's space weather (the DONKI snapshot, or offline); undefined while the file is still loading. */
  const [weather, setWeather] = useState<SpaceWeather>();
  const weatherReq = useRef<Promise<SpaceWeather> | undefined>(undefined);
  /** The weather the Daily in progress was launched with. */
  const [dailyWeather, setDailyWeather] = useState<SpaceWeather>();
  const opening = useRef(false);
  /** Help already seen: level briefings and the flight coach. */
  const [seen, setSeen] = useState<string[]>(loadSeen);
  const [robotName, setRobotName] = useState<string>(loadRobotName);
  const [postcards, setPostcards] = useState<string[]>(loadPostcards);
  const addPostcards = (ids: string[]) =>
    setPostcards((p) => {
      const next = [...new Set([...p, ...ids])];
      savePostcards(next);
      return next;
    });
  /** Team mode: the crew being set up (kept as sd.team) and the team's one action log. */
  const [teamDraft, setTeamDraft] = useState<Team>(() => loadTeam() ?? defaultTeam(4));
  const changeTeam = (t: Team) => {
    setTeamDraft(t);
    saveTeam(t);
  };
  const teamPlay = useTeam();
  /** The level in play is the team's (packing and launching go through the team's log). */
  const [teamRun, setTeamRun] = useState(false);
  /** The Mars starter the team packs on (objectives are Mars only), with the Mars level's science targets. */
  const teamBase = useMemo(() => ({ ...starterDesign('mars', today()), ...(levelById('mars')?.targets ? { scienceTargets: true } : {}) }), []);
  /** Online room (spec: Online room): this screen as a room's host, or this phone in a room. */
  const roomHost = useRoomHost();
  const roomPhone = useRoomPhone();
  const [place, setPlace] = useState<'local' | 'online'>('local');
  /** The team in play is an online room's, and this screen is its host. */
  const [online, setOnline] = useState(false);
  /** A room is coming back from its resume code: rebuild the team from its log once it opens. */
  const resuming = useRef(false);
  /** The "role handed" panel closed with RESUME (by seat and role), so play goes on. */
  const [handSeen, setHandSeen] = useState<string>();
  const nameRobot = (n: string) => {
    setRobotName(n);
    saveRobotName(n);
  };

  const cadetMode = mode === 'cadet';
  /** This session's last solo flight, by level (spec UI rule 60). */
  const [lastFlight, setLastFlight] = useState<{ levelId: string; stars: number; science: number; limits: PackLimit[] }>();
  /** The packing and the picked launch day, kept while the player goes between Pack and the Launch Day step. */
  const [packSave, setPackSave] = useState<{ key: string; packed?: Packed; pick?: number }>();
  /** Name Your Robot comes first: a Cadet who has never named the robot (nor skipped the screen). */
  const needsName = cadetMode && !robotName && !seen.includes('name');
  /** Where the name screen goes on to. */
  const afterName = useRef<'build' | 'daily' | 'home'>('build');
  const level = levelById(cadet.levelId);
  /** The design being built: Cadet packs on top of the level's starter, Engineer edits it directly. */
  const active = cadetMode ? cadet.base : design;
  const ev = useMemo(() => evaluateDesign(active), [active]);
  const facts: NotebookFacts = useMemo(() => ({ ...flights, progress }), [flights, progress]);
  const todayIso = dailyDate(Date.now());
  const mars = useMemo(() => marsNow(todayIso), [todayIso]);

  // ---- Crew file: rank from the stars across the levels, badges from deeds (engine ranks.ts) ----
  const levelMax = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l.id, maxStars(l)])), []);
  type CrewInput = { facts: NotebookFacts; postcards: readonly string[]; played: string[] };
  const badgeInput = (x: CrewInput) => ({ facts: x.facts, postcards: x.postcards, dailyStreak: dailyStreak(x.played, todayIso) });
  const crewOf = (x: CrewInput): Crew => {
    const totals = starTotals(x.facts.progress, levelMax);
    return { ...rankFor(totals.stars, totals.maxStars), ...totals, badges: badges(badgeInput(x)) };
  };
  /** The crew file as it was when this flight launched, so the report can say what is new. */
  const atLaunch = useRef<CrewInput | undefined>(undefined);
  const [promotion, setPromotion] = useState<{ rank?: RankDef; badges: string[] }>();

  useEffect(() => {
    try {
      localStorage.setItem('mdt.mode', mode);
    } catch {
      /* storage unavailable: mode is per-session only */
    }
  }, [mode]);

  // Read today's space weather once, early, so the Daily key can say whether it is live.
  useEffect(() => {
    const req = loadSpaceWeather(todayIso);
    weatherReq.current = req;
    let alive = true;
    void req.then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [todayIso]);

  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveFlights(flights), [flights]);
  useEffect(() => saveDaily(daily), [daily]);
  useEffect(() => saveSeen(seen), [seen]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const markSeen = (id: string) => setSeen((s) => (s.includes(id) ? s : [...s, id]));

  // ---- Navigation: a trail of steps; the browser's Back button pops it too ----
  const root: Step = 'home';
  /** In-app Backs that have already gone back in the browser history (their popstate is ignored). */
  const ownPops = useRef(0);
  const go = (next: Step) => {
    if (next === step) return;
    setTrail((t) => [...t, step]);
    setStep(next);
    try {
      window.history.pushState({ sd: true }, '');
    } catch {
      /* no history API: in-app Back still works */
    }
  };
  /** Where Back lands: the last step on the trail that still makes sense (a finished flight is skipped). */
  const backTarget = (t: Step[]): { to: Step; rest: Step[] } => {
    const rest = [...t];
    while (rest.length) {
      const s = rest.pop()!;
      if (s === step || s === 'cold') continue;
      if (s === 'name' && !needsName) continue;
      if (s === 'fly' && (step === 'report' || step === 'daily' || step === 'fly' || !flyDesign)) continue;
      if (s === 'report' && !flown) continue;
      if (s === 'daily' && !daily.results[todayIso]) continue;
      return { to: s, rest };
    }
    return { to: root, rest: [] };
  };
  const doBack = () => {
    if (step === 'rescue' && rescueId) return setRescueId(undefined);
    if (step === 'fly') {
      // Leaving a flight ends it: the next launch is a new flight.
      setSeed(fixedSeed ?? newSeed());
      setDailyRun(false);
    }
    const { to, rest } = backTarget(trail);
    setTrail(rest);
    setStep(to);
  };
  const back = () => {
    doBack();
    try {
      if (window.history.state?.sd) {
        ownPops.current += 1;
        window.history.back();
      }
    } catch {
      /* no history API */
    }
  };
  const backRef = useRef(doBack);
  backRef.current = doBack;
  useEffect(() => {
    const onPop = () => {
      if (ownPops.current > 0) {
        ownPops.current -= 1;
        return;
      }
      backRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const changeDestination = (d: DestinationId) => {
    const s = starterDesign(d, today());
    setDesign(s);
    setCadet(cadetStart(s));
    setMissionName(defaultMissionName(d));
  };

  const changeMode = (m: Mode) => {
    if (m === mode) return;
    // Carry the craft across: Engineer starts from the Cadet build; Cadet re-reads the Engineer design as a free build.
    // In flight, on the report and on the other screens only the layer changes.
    if (m === 'engineer') {
      setDesign(flyDesign && step !== 'map' && step !== 'home' ? flyDesign : cadet.base);
      // The Engineer's workbench is the Build Bay; ◂ BACK from it returns to Home.
      if (step === 'map' || step === 'rescue' || step === 'home') go('build');
    } else if (step === 'build') {
      setCadet(cadetStart(design));
    }
    setMode(m);
  };

  /**
   * A solo level's last packing and objective (saves.ts sd.pack), re-packed through the engine: only the level's shelf
   * parts, in their order, each where packPart puts it; an objective only on a level that asks for one.
   */
  const restoreLevel = (l: Level, base: Design): { packed?: Packed; objective?: ObjectiveId; rocket?: string; orbit?: string } => {
    const saved = loadLevelPacks()[l.id];
    if (!saved) return {};
    const shelf = shelfOf(l);
    let packed = initialPack({ ...base, instrumentIds: [] }, shelf);
    for (const id of saved.parts) if ((shelf as string[]).includes(id)) packed = packPart(packed, id as PartId) ?? packed;
    const objective = l.objective && (OBJECTIVE_IDS as string[]).includes(saved.objective ?? '') ? (saved.objective as ObjectiveId) : undefined;
    const rocket = saved.rocket && rocketOptions(l.destination).includes(saved.rocket) ? saved.rocket : undefined;
    const orbit = saved.orbit && (orbitPresets(l.destination) as string[]).includes(saved.orbit) ? saved.orbit : undefined;
    return { packed, ...(objective ? { objective } : {}), ...(rocket ? { rocket } : {}), ...(orbit ? { orbit } : {}) };
  };

  const linkOpened = useRef(false);
  useEffect(() => {
    if (!linkLevel || linkOpened.current) return;
    linkOpened.current = true;
    playLevel(linkLevel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playLevel = (l: Level, objective?: ObjectiveId, asTeam = false) => {
    setTeamRun(asTeam);
    // a level's own budget (Cloud Diver, spec UI rule 57) rides on the design, so every meter and blocker reads it
    const cap = levelCostCap(l.id);
    // the starter's rocket is the level's standard one: another charges the difference (spec UI rule 58)
    const fresh = starterDesign(l.destination, today());
    const starter: Design = { ...fresh, standardRocketId: fresh.launchVehicleId, ...(l.targets ? { scienceTargets: true } : {}), ...(cap ? { costCap: cap } : {}) };
    const kept = asTeam ? {} : restoreLevel(l, starter);
    const picked = objective ?? kept.objective;
    const withKeptRocket = kept.rocket ? withRocket(starter, kept.rocket) : starter;
    const flown = kept.orbit ? withOrbit(withKeptRocket, kept.orbit) : withKeptRocket;
    const s = { ...flown, ...(picked ? { objective: picked } : {}) };
    setCadet(cadetStart(s, l.id));
    setDesign(s);
    setMissionName(defaultMissionName(l.destination));
    setFlown(undefined);
    setDailyRun(false);
    setPackSave(kept.packed ? { key: `${l.id}-${l.destination}`, packed: kept.packed } : undefined);
    if (needsName) {
      afterName.current = 'build';
      go('name');
    } else go('build');
  };

  /** Launch: Fly & Survive flies the pinned craft with this seed. */
  const launchDesign = (d: Design) => {
    atLaunch.current = { facts, postcards, played: daily.played };
    setFlyDesign(d);
    setFlown(undefined);
    go('fly');
  };
  const launch = () => ev.blockers.length === 0 && launchDesign(active);
  /** Team mode: the Flight Director's launch is on the team's log; fly the design the team's flight started with. */
  const launchTeam = () => {
    const s = teamPlay.current();
    if (s?.team.launched) launchDesign(teamDesign(s.team));
  };

  /**
   * Today's Daily: the same craft and seed for everyone; played once, then its card. With live weather the real
   * DONKI storms replace the seeded ones and join the seed (spec UI rule 37).
   */
  const launchDaily = (w: SpaceWeather) => {
    setMissionName('Daily mission');
    setDailyRun(true);
    setDailyWeather(w);
    setSeed(dailySeed(todayIso, w.status === 'live' ? w.storms : undefined));
    launchDesign(dailyDesign(starterDesign('mars', todayIso)));
  };
  const openDaily = (named = false) => {
    if (daily.results[todayIso]) return go('daily');
    if (needsName && !named) {
      afterName.current = 'daily';
      return go('name');
    }
    if (weather) return launchDaily(weather);
    // Still loading: wait for it (loadSpaceWeather gives up after its timeout and says offline).
    if (opening.current) return;
    opening.current = true;
    void (weatherReq.current ?? loadSpaceWeather(todayIso)).then((w) => {
      opening.current = false;
      setWeather(w);
      launchDaily(w);
    });
  };

  const finish = (s: OpsState) => {
    const stars = operationsDebrief(s).stars;
    // Change one thing and fly again (spec UI rule 60): Pack compares each limit with this flight.
    if (cadetMode && level && !dailyRun && !teamRun && flyDesign)
      setLastFlight({ levelId: level.id, stars, science: scienceReturned(s), limits: packLimits(evaluateDesign(flyDesign)) });
    const nextProgress = cadetMode && level && !dailyRun ? withStars(progress, level.id, stars) : progress;
    const nextFacts = mergeFacts(facts, flightFacts(s));
    const { progress: _p, ...flightOnly } = nextFacts;
    setFresh(newLessons(facts, { ...nextFacts, progress: nextProgress }));
    const before = atLaunch.current ?? { facts, postcards, played: daily.played };
    const after = { facts: { ...nextFacts, progress: nextProgress }, postcards: [...new Set([...postcards, ...postcardsEarned(s)])], played: dailyRun ? [...daily.played, todayIso] : daily.played };
    const rankBefore = crewOf(before).rank;
    const rankAfter = crewOf(after).rank;
    setPromotion({ ...(rankAfter.id !== rankBefore.id ? { rank: rankAfter } : {}), badges: newBadges(badgeInput(before), badgeInput(after)) });
    setProgress(nextProgress);
    setFlights(flightOnly);
    setFlown(s);
    if (dailyRun) {
      setDaily((d) => ({ played: [...new Set([...d.played, todayIso])], results: { ...d.results, [todayIso]: dailyGrid(s, dailyWeather?.status ?? 'offline') } }));
      go('daily');
    } else go('report');
  };

  /** Fly again: back to packing (Cadet) or the Build Bay (Engineer), with a new seed. A team starts a new log. */
  const flyAgain = () => {
    if (teamRun) {
      const next = fixedSeed ?? newSeed();
      setSeed(next);
      setFlown(undefined);
      teamPlay.start(teamDraft, teamBase, shelfFor('mars'), { seed: next });
      return go('objective');
    }
    setSeed(fixedSeed ?? newSeed());
    setFlown(undefined);
    setDailyRun(false);
    go('build');
  };
  const next = level && cadetMode && (progress[level.id] ?? 0) >= 1 ? nextLevel(level.id) : undefined;
  const home = () => go('home');
  const firstNew = fresh.length ? notebook(facts).find((c) => c.id === fresh[0]) : undefined;
  const fullScreen = step === 'team' || step === 'objective' || step === 'room' || step === 'join' || step === 'controller' || step === 'cold' || step === 'name' || step === 'launch' || step === 'fly' || step === 'report' || step === 'home' || step === 'daily' || step === 'notebook' || step === 'postcards' || (step === 'build' && cadetMode);

  /** The mission briefing: what to do on this level (or a free build, or today's Daily). */
  const briefFor = (forDaily: boolean) =>
    forDaily
      ? { title: BRIEF_WORDS.daily, briefing: { ...DAILY_BRIEFING, tip: `${DAILY_BRIEFING.tip} ${dailyWeather?.status === 'live' ? LIVE_WEATHER.briefLive : LIVE_WEATHER.briefOffline}` } }
      : level
        ? { title: level.title, briefing: BRIEFING[level.id] ?? FREE_BRIEFING, concept: LEVEL_WORDS.teaches[level.id] ?? '' }
        : { title: BRIEF_WORDS.free, briefing: FREE_BRIEFING };
  /** Solo Red Planet: the player picks the mission objective (spec UI rule 56); it sits on the level's starter design. */
  const soloObjective = cadetMode && level?.objective === true && !teamRun;
  const pickObjective = (o: ObjectiveId) => setCadet((c) => ({ ...c, base: { ...c.base, objective: o } }));
  /** Solo levels: the rocket (spec UI rule 58), on the level's design like the objective. */
  const pickRocket = (id: string) => setCadet((c) => ({ ...c, base: withRocket(c.base, id) }));
  /** Solo Mars: the science orbit (spec UI rule 59). */
  const pickOrbit = (id: string) => setCadet((c) => ({ ...c, base: withOrbit(c.base, id) }));
  const packBrief = { ...briefFor(false), open: level !== undefined && (!seen.includes(`brief:${level.id}`) || (soloObjective && !cadet.base.objective)) };
  /** In flight, MISSION INFO shows the objective flown (read-only). */
  const flyObjective = flyDesign?.objective && !teamRun && flyDesign.destination === 'mars' ? { cards: objectiveCards(flyDesign), picked: flyDesign.objective } : undefined;
  /** The launch countdown plays on the first flight of each level (and of the Daily, and of a free build). */
  const launchKey = `launch:${dailyRun ? 'daily' : (level?.id ?? 'free')}`;
  /** One packing per level: a new level (or destination) starts from its own starter. */
  const packKey = `${cadet.levelId ?? 'free'}-${cadet.base.destination}`;
  const keptPack = packSave?.key === packKey ? packSave : undefined;
  const starterPack = useMemo(() => initialPack(cadet.base, level ? shelfOf(level) : shelfFor(cadet.base.destination)), [cadet.base, level]);
  const teamNow = teamRun ? teamPlay.session?.team : undefined;
  const packedNow = teamNow ? teamNow.packed : (keptPack?.packed ?? starterPack);
  // A solo level's packing and objective are kept (sd.pack), so reopening the level, even after a reload, resumes them.
  useEffect(() => {
    if (!cadetMode || teamRun || dailyRun || !level || (step !== 'build' && step !== 'launch')) return;
    saveLevelPack(level.id, { parts: packedNow.map((p) => p.id), ...(cadet.base.objective ? { objective: cadet.base.objective } : {}), rocket: rocketIdOf(cadet.base), ...(orbitIdOf(cadet.base) ? { orbit: orbitIdOf(cadet.base)! } : {}) });
  }, [cadetMode, teamRun, dailyRun, level, step, packedNow, cadet.base]);
  /** The team's flight: launched by its Flight Director. */
  const teamFly = teamNow?.launched ? teamNow : undefined;

  // ---- Online room, host screen (spec: Online room): the room follows this screen; the phones act ----
  const host = online ? roomHost.host : undefined;
  const roomView = online && roomHost.view?.started ? roomHost.view : undefined;
  /** START MISSION: the room's team is the log's first entry, sent through the room (the phones hear it). */
  const startRoom = () => {
    const h = roomHost.host;
    const team = h?.start();
    if (!h || !team) return;
    teamPlay.start(team, h.mission.base, h.mission.shelf, { seed: h.mission.seed }, h);
    setOnline(true);
    go('objective');
  };
  const endRoom = () => {
    roomHost.close();
    setOnline(false);
  };
  useEffect(() => {
    const stage = stageOf(step);
    if (host && stage) host.setStage(stage);
  }, [host, step]);
  // The phones lock the objective, then the Flight Director's phone launches: this screen follows.
  const teamObjective = teamPlay.session?.team.objectiveLocked ? teamPlay.session.team.objective : undefined;
  useEffect(() => {
    if (online && step === 'objective' && teamObjective) playLevel(levelById('mars')!, teamObjective, true);
  }, [online, step, teamObjective]); // eslint-disable-line react-hooks/exhaustive-deps
  const teamLaunched = teamPlay.session?.team.launched === true;
  useEffect(() => {
    if (online && step === 'build' && teamLaunched) launchTeam();
  }, [online, step, teamLaunched]); // eslint-disable-line react-hooks/exhaustive-deps
  // Home ends the room.
  useEffect(() => {
    if (step === 'home' && (online || roomHost.phase !== 'idle')) endRoom();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // A room back from its resume code: rebuild the team from its log, then go on to where its mission was.
  useEffect(() => {
    const h = roomHost.host;
    if (!resuming.current || !h || !h.state.started || !h.team) return;
    resuming.current = false;
    const m = h.mission;
    teamPlay.start(h.team, m.base, m.shelf, { seed: m.seed }, h);
    setOnline(true);
    const s = teamPlay.current()!.team;
    if (s.objectiveLocked && s.objective) playLevel(levelById('mars')!, s.objective, true);
    else go('objective');
  }, [roomHost.host]); // eslint-disable-line react-hooks/exhaustive-deps
  /** The host's flight in the room: the phones' orders run through it; its clock is shared. */
  const flyRoom = useMemo(
    () => (host ? { link: (fl: FlightLink | undefined) => host.link(fl), clock: (c: { t: number; speed: number; running: boolean }) => host.setClock({ ...c, at: Date.now() }) } : undefined),
    [host],
  );
  const handKey = roomView?.message.kind === 'handed' ? `${roomView.message.callSign}-${roomView.message.role}` : undefined;
  const roomPanel = roomView && (roomView.message.kind === 'away' || (handKey !== undefined && handKey !== handSeen)) && (
    <RoomHold
      view={roomView}
      {...(teamPlay.session?.ops && teamPlay.session.team.launched ? { day: teamPlay.session.ops.t } : {})}
      onHand={() => roomView.message.kind === 'away' && host?.handNow(roomView.message.seat)}
      onResume={() => setHandSeen(handKey)}
    />
  );

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
          onMap={home}
          onBack={back}
        />
      )}
      {step === 'cold' && (
        <ColdOpen
          onDone={() => {
            markSeen('cold-open');
            if (!coldFirst.current) return back();
            coldFirst.current = false;
            // The first launch goes on to name the robot, then Home; nothing to go back to.
            if (needsName) afterName.current = 'home';
            setStep(needsName ? 'name' : 'home');
          }}
        />
      )}
      {step === 'home' && (
        <Home
          progress={progress}
          mode={mode}
          onMode={changeMode}
          daily={{ number: dailyNumber(todayIso), played: daily.results[todayIso] !== undefined, ...(weather ? { weather: weather.status } : {}) }}
          rescue={rescueProgress(progress)}
          notebook={notebookProgress(facts)}
          onPlay={playLevel}
          onMissions={() => go('map')}
          onDaily={() => openDaily()}
          onRescue={() => {
            setRescueId(undefined);
            go('rescue');
          }}
          onNotebook={() => go('notebook')}
          postcards={postcardAlbum(postcards)}
          crew={crewOf({ facts, postcards, played: daily.played })}
          mars={mars}
          onPostcards={() => go('postcards')}
          onIntro={() => go('cold')}
          onTeam={() => go('team')}
          onJoin={() => go('join')}
        />
      )}
      {step === 'team' && (
        <TeamSetup
          team={teamDraft}
          onTeam={changeTeam}
          mode={mode}
          onMode={changeMode}
          onBack={back}
          onNext={() => {
            setOnline(false);
            teamPlay.start(teamDraft, teamBase, shelfFor('mars'), { seed });
            go('objective');
          }}
          place={place}
          onPlace={setPlace}
          onRoom={() => {
            roomHost.open({ base: teamBase, shelf: shelfFor('mars'), seed });
            go('room');
          }}
        />
      )}
      {step === 'room' && (
        <OnlineHost
          room={roomHost}
          mode={mode}
          onMode={changeMode}
          onBack={() => {
            endRoom();
            back();
          }}
          onStart={startRoom}
          onLocal={() => {
            endRoom();
            setPlace('local');
            back();
          }}
          onResumed={() => {
            resuming.current = true;
          }}
        />
      )}
      {step === 'join' && (
        <OnlineJoin
          phone={roomPhone}
          onBack={back}
          onJoined={() => go('controller')}
          onLocal={() => {
            roomPhone.leave();
            setPlace('local');
            go('team');
          }}
          {...(linkCode ? { code: linkCode } : {})}
        />
      )}
      {step === 'controller' && (
        <Controller
          phone={roomPhone}
          onHome={() => {
            setTrail([]);
            setStep('home');
          }}
          onLocal={() => {
            roomPhone.leave();
            setPlace('local');
            go('team');
          }}
          onChangeRole={() => {
            roomPhone.pick(undefined);
            back();
          }}
        />
      )}
      {step === 'objective' && teamPlay.session && (
        <TeamObjective
          state={teamPlay.session.team}
          design={teamBase}
          onSend={teamPlay.send}
          mode={mode}
          onMode={changeMode}
          onBack={back}
          onNext={(o) => playLevel(levelById('mars')!, o, true)}
        />
      )}
      {step === 'name' && (
        <NameRobot
          name={robotName}
          mode={mode}
          onMode={changeMode}
          mars={mars}
          onName={(n) => {
            nameRobot(n);
            markSeen('name');
          }}
          onDone={() => {
            markSeen('name');
            if (afterName.current === 'daily') openDaily(true);
            else if (afterName.current === 'home') {
              setTrail([]);
              setStep('home');
            } else go('build');
          }}
          onBack={back}
        />
      )}
      {step === 'map' && (
        <LevelMap
          progress={progress}
          onPlay={playLevel}
          onRescue={() => {
            setRescueId(undefined);
            go('rescue');
          }}
        />
      )}
      {step === 'rescue' && !rescueId && <RescueSelect stars={{ mco: progress['rescue-mco'] ?? 0 }} onOpen={setRescueId} onMap={back} />}
      {step === 'rescue' && rescueId && (
        <RescueCaseView
          key={rescueId}
          id={rescueId}
          onSolved={(stars) => setProgress((p) => withStars(p, `rescue-${rescueId}`, stars))}
          onBack={() => setRescueId(undefined)}
        />
      )}
      {step === 'postcards' && <Postcards earned={postcards} onHome={home} onBack={back} />}
      {step === 'notebook' && <Notebook facts={facts} fresh={fresh} mode={mode} onMode={changeMode} onHome={home} onBack={back} />}
      {step === 'daily' && daily.results[todayIso] && (
        <Daily
          number={dailyNumber(todayIso)}
          date={todayIso}
          grid={daily.results[todayIso]!}
          played={daily.played}
          mode={mode}
          onMode={changeMode}
          onHome={home}
          onBack={back}
          {...(flown && dailyRun ? { onReport: () => go('report') } : {})}
        />
      )}
      {step === 'launch' && (
        <LaunchDay
          base={cadet.base}
          packed={packedNow}
          {...(keptPack?.pick !== undefined ? { pick: keptPack.pick } : {})}
          onPick={(i) => setPackSave({ key: packKey, packed: packedNow, ...(i !== undefined ? { pick: i } : {}) })}
          mode={mode}
          onMode={changeMode}
          missionName={missionName}
          onHome={home}
          onBack={back}
          onLaunch={launchDesign}
        />
      )}
      {step === 'build' && cadetMode && (
        <Pack
          key={packKey}
          base={cadet.base}
          shelf={level ? shelfOf(level) : shelfFor(cadet.base.destination)}
          mode={mode}
          onMode={changeMode}
          missionName={missionName}
          {...(level?.impossible ? { impossible: true, onLesson: () => setProgress((p) => withStars(p, level.id, 1)) } : {})}
          onHome={home}
          onBack={back}
          onLaunch={launchDesign}
          brief={packBrief}
          onBriefSeen={() => level && markSeen(`brief:${level.id}`)}
          robotName={robotName}
          onRobotName={nameRobot}
          {...(keptPack?.packed ? { packed: keptPack.packed } : {})}
          onPacked={(p) => setPackSave({ key: packKey, packed: p, ...(keptPack?.pick !== undefined ? { pick: keptPack.pick } : {}) })}
          {...(keptPack?.pick !== undefined ? { pick: keptPack.pick } : {})}
          onDays={() => go('launch')}
          {...(level && !teamRun ? { rocket: { onPick: pickRocket } } : {})}
          {...(lastFlight && level && lastFlight.levelId === level.id && !teamRun ? { last: lastFlight } : {})}
          {...(level && !teamRun && orbitPresets(level.destination).length ? { orbit: { onPick: pickOrbit } } : {})}
          {...(soloObjective ? { objective: { ...(cadet.base.objective ? { picked: cadet.base.objective } : {}), onPick: pickObjective } } : {})}
          {...(teamNow ? { team: { state: teamNow, log: teamPlay.log, send: teamPlay.send, ...(teamNow.objective ? { objective: teamNow.objective } : {}) }, onLaunch: launchTeam } : {})}
        />
      )}
      {step === 'build' && !cadetMode && <BuildBay design={design} ev={ev} engineer onChange={setDesign} onLaunch={launch} />}
      {step === 'fly' && flyDesign && (
        <FlyAndSurvive
          design={flyDesign}
          seed={(teamFly && teamPlay.opts?.seed) ?? seed}
          {...(dailyRun && dailyWeather?.status === 'live' ? { storms: dailyWeather.storms } : {})}
          mode={mode}
          onMode={changeMode}
          missionName={missionName}
          onHome={home}
          onDone={finish}
          onBack={back}
          coach={!seen.includes('coach')}
          onCoachSeen={() => markSeen('coach')}
          brief={{ ...briefFor(dailyRun), ...(flyObjective ? { objective: flyObjective } : {}) }}
          robotName={robotName}
          launchMoment={!seen.includes(launchKey)}
          onLaunchSeen={() => markSeen(launchKey)}
          onPostcards={addPostcards}
          {...(level ? { teaches: level.steps } : {})}
          {...(teamFly ? { team: { state: teamFly, log: teamPlay.log, send: teamPlay.send, ...(teamFly.objective ? { objective: teamFly.objective } : {}), ...(teamPlay.session?.ops ? { ops: teamPlay.session.ops } : {}), ...(flyRoom ? { room: { ...flyRoom, held: roomView?.holding === true } } : {}) } } : {})}
        />
      )}
      {step === 'report' && flown && flyDesign && (
        <MissionReport
          state={flown}
          {...(promotion ? { promotion } : {})}
          robotName={robotName}
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
                  onOpen: () => go('notebook'),
                },
              }
            : {})}
          onFlyAgain={dailyRun || online ? home : flyAgain}
          onHome={home}
          onBack={back}
          {...(teamFly ? { team: { state: teamFly, log: teamPlay.log } } : {})}
          {...(cadetMode && level && !dailyRun && !teamRun ? { shelf: shelfOf(level) } : {})}
          homeLabel={NAV.home}
        />
      )}
      {roomView && step !== 'room' && <RoomBar view={roomView} held={roomView.holding} />}
      {step !== 'room' && roomPanel}
    </div>
  );
}
