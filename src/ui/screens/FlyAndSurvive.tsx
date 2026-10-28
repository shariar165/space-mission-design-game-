// FLY & SURVIVE (Signal Delay design, screen 01; spec UI rules 16–20 and "Signal Delay"). The robot cruises on its
// own; danger cards stop time; you pick; the order flies to the robot at light speed and you wait to hear back.
// One screen for both modes, driven by the Mission operations engine. Every number comes from consoleView
// (ops/console.ts) and the Fly view model (ops/fly.ts); this screen only lays them out.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DESTINATIONS, HAZARDS, PARTS } from '../../engine/data';
import { flightMap, ghostFor, pathAhead } from '../../engine/flightMap';
import { comingUp, downlinkView, eclipseCard, flyCard, flyTiles, FLY_RULES, missionProgress, momentsSince, moonOrbitView, nextImageT, outcomeIn_s, scienceTargetsView, stormFront, transmissionFeed, type FeedEntry, type FlyChip, type MomentKind, type OpsState, type OrderLine } from '../../engine/ops/index';
import type { Design, Sourced } from '../../engine/types';
import { SPEED_OF_LIGHT } from '../../engine/constants';
import { BookCall } from '../components/ops/BookCall';
import { BlackoutPanel, CommandQueue, ExtensionDecision, NoticeToast, SafeModePanel } from '../components/ops/OpsPanels';
import { PowerDial } from '../components/ops/PowerDial';
import { CrtMap } from '../components/fly/CrtMap';
import { Transmissions, txLine } from '../components/fly/Transmissions';
import { BANNER_MS, LaunchCountdown, MomentBanner } from '../components/fly/Moment';
import { LangToggle } from '../components/sd/LangToggle';
import { SoundToggle } from '../components/sd/SoundToggle';
import { PostcardView, postcardSrc } from '../components/sd/PostcardView';
import { newPostcards, POSTCARDS, postcardsEarned } from '../../engine/postcards';
import { play, useLoop } from '../sound';
import { DangerCard, type CardView, type ChipView, type ChoiceView } from '../components/fly/DangerCard';
import { EquationsPanel } from '../components/fly/EquationsPanel';
import { Downlink } from '../components/fly/Downlink';
import { Globe } from '../components/fly/Globe';
import { useArrivalZoom, type ZoomDirection } from '../components/fly/arrivalZoom';
import { ScienceTargets } from '../components/fly/ScienceTargets';
import { BackButton } from '../components/sd/BackButton';
import { CoachCard } from '../components/sd/CoachCard';
import { MissionBriefing } from '../components/sd/MissionBriefing';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon } from '../components/sd/SDIcon';
import { Segments } from '../components/sd/Segments';
import { Teletype } from '../components/sd/Teletype';
import { useReducedMotion } from '../opsGeometry';
import { BLOCKER, COMMAND_KIND, eventLine, FAILURE_EFFECT, OPTION_BLURB } from '../opsWords';
import { GLOBE_FLYOVER_MS, projector, RIBBON_FLIP, RIBBON_GAP, RIBBON_INSET_PX, RIBBON_PHONE_MAX, ribbonSlots, RING_MS, transitSide, useCycle, useIsPhone } from '../sdGeometry';
import {
  arrivesWords,
  CHIP_ICON,
  COMING,
  DOWNLINK,
  EFFECT_ICON,
  endsInWords,
  FINISH_CONFIRM,
  BRAND_WORDS,
  FLY_WORDS,
  GAME_NAME,
  LEAVE_CONFIRM,
  milestoneLine,
  monthsShort,
  monthsWords,
  NAV,
  optionShort,
  playNudge,
  quietLine,
  LIVE_WEATHER,
  MOMENT_WORDS,
  MOON_WORDS,
  POSTCARD_WORDS,
  robotNameOr,
  stormLine,
  TX_WORDS,
  RESULT_EFFECT_CHIP,
  SCIENCE,
  resultLines,
  TILE,
  type Briefing,
  type TileKey,
} from '../sdWords';
import { OPS_SPEEDS, useOpsSession, type OpsSpeed } from '../useOpsSession';
import * as f from '../format';
import { voiceContext } from '../voiceContext';
import type { RealStorm } from '../../engine/spaceWeather';

interface Props {
  design: Design;
  seed: number;
  /** A live Daily's real DONKI storms (they replace the seeded solar storms). */
  storms?: RealStorm[];
  mode: Mode;
  onMode: (m: Mode) => void;
  missionName: string;
  onHome: () => void;
  /** The mission is over (complete, lost or never launched): go to the Mission Report. */
  onDone: (s: OpsState) => void;
  /** ◂ BACK: leave the flight (after a confirmation). */
  onBack?: () => void;
  /** Open the "how to fly" coach panels at the start (first flight). */
  coach?: boolean;
  /** The coach panels were closed. */
  onCoachSeen?: () => void;
  /** The mission briefing behind MISSION INFO. */
  brief?: { title: string; briefing: Briefing; concept?: string };
  /** The launch countdown opens the flight (the first flight of a level). */
  launchMoment?: boolean;
  onLaunchSeen?: () => void;
  /** Postcards this flight has earned so far (called when a new one arrives). */
  onPostcards?: (ids: string[]) => void;
  /** The robot's name (Pack); the default when empty. */
  robotName?: string;
  /** The build steps the level teaches: the Moon globe shows the trim-burn tag where fuel is taught (spec: UI rule 46). */
  teaches?: string[];
}

type Panel = 'power' | 'call' | 'queue' | 'eqs' | 'downlink';
/** The robot's reply to an order stays on screen this long (and holds the clock), then the outcome shows. */
export const REPLY_SHOW_MS = 4000;
/** Overlays that hold the clock while they are open. */
type Overlay = 'coach' | 'info' | 'finish' | 'leave';

const SPEED_LABEL = (s: OpsSpeed) => (s === 0 ? 'II' : `${f.num(s)}×`);
const SPEED_NAME = (s: OpsSpeed) => (s === 0 ? FLY_WORDS.pause : FLY_WORDS.speed(SPEED_LABEL(s)));
const TILE_ORDER: TileKey[] = ['power', 'fuel', 'data', 'systems'];

function chipViews(chips: FlyChip[]): ChipView[] {
  return chips.map((k) => ({ icon: CHIP_ICON[k.gauge], text: k.gauge === 'coins' ? `${f.signedInt(k.delta)} COINS` : f.signedInt(k.delta), tone: 'cost' as const }));
}

export function FlyAndSurvive({ design, seed, storms, mode, onMode, missionName, onHome, onDone, onBack, coach, onCoachSeen, brief, robotName, launchMoment, onLaunchSeen, onPostcards, teaches }: Props) {
  const name = robotNameOr(robotName);
  const engineer = mode === 'engineer';
  const ops = useOpsSession(design, seed, storms);
  const { state, view } = ops;
  const phone = useIsPhone();
  const still = useReducedMotion();
  const dest = DESTINATIONS[design.destination];
  const [panel, setPanel] = useState<Panel>();
  const [lastSpeed, setLastSpeed] = useState<OpsSpeed>(OPS_SPEEDS[2]);
  const [overlay, setOverlay] = useState<Overlay | undefined>(coach ? 'coach' : undefined);
  const [chosen, setChosen] = useState<{ label: string; chips: FlyChip[] }>();
  const [eclipseDone, setEclipseDone] = useState<number[]>([]);
  const ev = state?.env.ev;
  const map = useMemo(() => (ev ? flightMap(design, ev) : undefined), [design, ev]);
  const ghost = useMemo(() => (ev ? ghostFor(design, ev) : undefined), [design, ev]);
  const over = state !== undefined && (state.status === 'complete' || state.status === 'lost' || state.status === 'not-launched');
  const debrief = over;
  const ringPhase = useCycle(RING_MS, !!ops.transit && !still);

  const tiles = state && view ? flyTiles(state, view) : undefined;
  const storm = state ? stormFront(state) : undefined;
  const voice = useMemo(() => voiceContext(dest.name, robotName), [dest.name, robotName]);
  const feed = useMemo(() => (state ? transmissionFeed(state) : undefined), [state]);
  const card = state && view && ops.showAlert ? flyCard(state, view) : undefined;
  const coming = state ? comingUp(state) : undefined;
  const ahead = useMemo(() => (ev && view ? pathAhead(design, view.map.frame.day, ev) : []), [design, ev, view?.map.frame.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const eclipse = state && !ops.showAlert && !ops.transit && !ops.result ? eclipseCard(state) : undefined;
  const eclipseOpen = eclipse !== undefined && !eclipseDone.includes(eclipse.season.startDay);

  // ---- Science targets (Mars orbit): the panel opens when the robot's question reaches Earth, and holds the clock ----
  const sci = useMemo(() => (state ? scienceTargetsView(state) : undefined), [state]);
  // The Moon orbit (spec: UI rules 45–46): Earth, the link and the arcs on the globe; on Moon 1 and 2 the panel shows
  // the orbit alone.
  const moonView = useMemo(() => (state ? moonOrbitView(state) : undefined), [state]);
  const panelOk = sci?.available === true || moonView?.available === true;
  const dl = useMemo(() => (state ? downlinkView(state) : undefined), [state]);
  const [sciOpen, setSciOpen] = useState(false);
  // The arrival transition (spec: UI rule 42): in when the panel opens, out when the player goes back to the map.
  const rootRef = useRef<HTMLDivElement>(null);
  const [zoomDir, setZoomDir] = useState<ZoomDirection>();
  const openScience = () => {
    setSciOpen(true);
    setZoomDir('in');
  };
  const closeScience = () => setZoomDir('out');
  const zoom = useArrivalZoom(rootRef, zoomDir, 6, still, () => {
    if (zoomDir === 'out') setSciOpen(false);
    setZoomDir(undefined);
  });
  const [sciPick, setSciPick] = useState<string>();
  const asked = feed?.entries.some((e) => e.from === 'robot' && (e.message?.kind === 'targets' || (moonView !== undefined && e.message?.kind === 'science'))) ?? false;
  const askedSeen = useRef(false);
  useEffect(() => {
    if (!asked || askedSeen.current) return;
    askedSeen.current = true;
    if ((state?.t ?? 0) > 0 && panelOk) openScience();
  }, [asked]); // eslint-disable-line react-hooks/exhaustive-deps
  const sciShown = sciOpen && panelOk;
  const sciSelected = sciPick ?? sci?.cards.find((c) => c.blocker === undefined)?.id ?? sci?.cards[0]?.id ?? '';

  // ---- Big moments: the launch countdown, banners for the arrival burn and a storm hit, and their sounds ----
  const [launching, setLaunching] = useState(!!launchMoment);
  const endLaunch = () => {
    setLaunching(false);
    onLaunchSeen?.();
  };
  const seenEvents = useRef(0);
  const [banner, setBanner] = useState<{ kind: MomentKind; n: number }>();
  const [flyover, setFlyover] = useState<{ targetId: string; n: number }>();
  useEffect(() => {
    if (!flyover) return;
    const id = setTimeout(() => setFlyover(undefined), GLOBE_FLYOVER_MS);
    return () => clearTimeout(id);
  }, [flyover]);
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (!state) return;
    if (state.events.length < seenEvents.current) seenEvents.current = 0;
    const ms = momentsSince(state, seenEvents.current);
    seenEvents.current = state.events.length;
    // An OBSERVE order landing on the craft: the orbiter flies over its target on the globe.
    const shot = [...ms].reverse().find((m) => m.kind === 'observe');
    if (shot?.targetId) setFlyover((x) => ({ targetId: shot.targetId!, n: (x?.n ?? 0) + 1 }));
    const last = [...ms].reverse().find((m) => m.kind !== 'observe');
    if (!last) return;
    if (ms.some((m) => m.kind === 'storm-hit')) {
      play('zap');
      setShake(true);
    }
    if (last.kind === 'arrived') play('fanfare');
    if (last.kind === 'arrived' || last.kind === 'storm-hit') setBanner((b) => ({ kind: last.kind, n: (b?.n ?? 0) + 1 }));
  }, [state]);
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(undefined), BANNER_MS);
    return () => clearTimeout(id);
  }, [banner]);
  useEffect(() => {
    if (!shake) return;
    const id = setTimeout(() => setShake(false), BANNER_MS / 4);
    return () => clearTimeout(id);
  }, [shake]);
  const alertId = ops.showAlert ? view?.alert?.decisionId : undefined;
  useEffect(() => {
    if (alertId) play('alarm');
  }, [alertId]);
  useEffect(() => {
    if (over) play(state?.status === 'lost' || state?.status === 'not-launched' ? 'sad' : 'fanfare');
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- The robot's lines: a radio blip for each new one; its reply to an order gets the reply box ----
  const robotLines = feed?.entries.filter((e) => e.from === 'robot');
  const lastHeard = robotLines?.[robotLines.length - 1];
  const heardKey = useRef<string | undefined>(undefined);
  const [reply, setReply] = useState<FeedEntry>();
  useEffect(() => {
    if (!lastHeard) return;
    const k = `${lastHeard.at}:${lastHeard.message!.kind}`;
    if (heardKey.current === k) return;
    const first = heardKey.current === undefined && (state?.t ?? 0) > 1;
    heardKey.current = k;
    if (first || over) return;
    // A reply to an order beeps as it reaches Earth; the robot's other news gets the radio blip.
    if (lastHeard.roundTrip_s !== undefined) play('beep');
    else if (lastHeard.message!.kind !== 'status') play('radio');
    if (lastHeard.roundTrip_s !== undefined) setReply(lastHeard);
  }, [lastHeard, over]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!reply) return;
    const id = setTimeout(() => setReply(undefined), REPLY_SHOW_MS);
    return () => clearTimeout(id);
  }, [reply]);

  // ---- Postcards: a toast when the science opens a new one (the clock runs on); tap it for the full card ----
  const earned = useMemo(() => (state ? postcardsEarned(state) : []), [state]);
  const earnedKey = earned.join(',');
  const seenCards = useRef<string[]>([]);
  const [toast, setToast] = useState<string>();
  const [cardOpen, setCardOpen] = useState<string>();
  useEffect(() => {
    const fresh = newPostcards(seenCards.current, earned);
    seenCards.current = earned;
    if (!fresh.length) return;
    onPostcards?.(earned);
    if (!over) {
      setToast(fresh[fresh.length - 1]);
      play('ding');
    }
  }, [earnedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), BANNER_MS * 2);
    return () => clearTimeout(id);
  }, [toast]);
  const toastCard = POSTCARDS.find((c) => c.id === toast);
  const openPostcard = POSTCARDS.find((c) => c.id === cardOpen);

  // An eclipse planning card, an overlay, an open postcard or the launch countdown holds the clock like a danger card does.
  // Science Targets holds it too, but lets an OBSERVE order play its trip (and the robot's reply) while the panel is open.
  const heldAll = eclipseOpen || overlay !== undefined || launching || openPostcard !== undefined || (reply !== undefined && !sciShown);
  const held = heldAll || sciShown;
  const hold = heldAll ? true : sciShown ? 'orders' : false;
  useEffect(() => {
    ops.setHold(hold);
  }, [hold]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Sound: the CRT hums; radio static while an order or its reply crosses space (engine feed) and the clock
  // moves; a beep when an order reaches the robot (its reply's beep is above) ----
  useLoop('hum');
  const orders = feed?.entries.flatMap((e) => (e.order ? [e.order] : [])) ?? [];
  const crossing = orders.some((o) => o.status === 'in-flight' || o.status === 'reply-inbound');
  const moving = ops.transit !== undefined || ops.orderTrips.length > 0 || (ops.speed > 0 && !ops.locked && !held);
  useLoop('static', crossing && moving && !over);
  const orderWas = useRef(new Map<string, OrderLine['status']>());
  useEffect(() => {
    const was = orderWas.current;
    let landed = false;
    for (const o of orders) {
      const k = `${o.kind}:${o.sentAt}:${o.hazardId ?? o.targetId ?? ''}`;
      if (was.get(k) === 'in-flight' && o.status !== 'in-flight') landed = true;
      was.set(k, o.status);
    }
    if (landed && !over) play('beep');
  }, [feed]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeOverlay = () => {
    if (overlay === 'coach') onCoachSeen?.();
    setOverlay(undefined);
  };
  const finishMission = () => {
    setOverlay(undefined);
    setPanel(undefined);
    ops.finish();
  };

  const typeOf = (hazardId: string) => state?.hazards.find((h) => h.id === hazardId)?.type ?? '';
  const shortLabel = (hazardId: string, optionId: string) => {
    const type = typeOf(hazardId);
    const o = HAZARDS[type]?.options.find((x) => x.id === optionId);
    return optionShort(type, optionId, o?.label ?? optionId);
  };

  const setSpeed = (s: OpsSpeed) => {
    if (s > 0 && held) return;
    if (s > 0) setLastSpeed(s);
    ops.setSpeed(s);
  };

  // ---- Danger card (hazard) ----
  const respond = (optionId: string) => {
    const o = card?.options.find((x) => x.id === optionId);
    if (!o || !view?.alert) return;
    setChosen({ label: optionShort(view.alert.type, o.id, o.label), chips: o.chips });
    play('chirp');
    ops.respond(optionId);
  };

  const a = view?.alert;
  const hazardCard: CardView | undefined =
    card && a
      ? {
          icon: a.type === 'solar-storm' || a.type === 'cme-shock' ? 'storm' : a.type === 'mars-dust-storm' ? 'dust' : a.type === 'debris' ? 'debris' : a.type === 'insertion-anomaly' ? 'orbit' : 'sys',
          kicker: card.realSource ? LIVE_WEATHER.realKicker : FLY_WORDS.dangerCard,
          title: FLY_WORDS.hazard(a.type, a.title),
          line: a.real?.flare ? `${FLY_WORDS.prompt(a.type, a.prompt)} ${LIVE_WEATHER.fromFlare(a.real.flare)}` : FLY_WORDS.prompt(a.type, a.prompt),
          day: FLY_WORDS.day(f.num(Math.floor(state!.t))),
          hits: {
            k: a.real?.arrival
              ? FLY_WORDS.arrivesHow(a.real.arrival.isMinorImpact ? LIVE_WEATHER.severity.minor : a.real.arrival.isGlancingBlow ? LIVE_WEATHER.severity.glancing : LIVE_WEATHER.severity.direct)
              : FLY_WORDS.arrives,
            v: arrivesWords(card.onsetIn_s),
            ...(card.predictionSource ? { s: card.predictionSource } : {}),
          },
          takes: { k: phone ? FLY_WORDS.takesShort : FLY_WORDS.takes, v: FLY_WORDS.duration(a.oneWay_s) },
          history: card.realSource
            ? { k: LIVE_WEATHER.realEvent, s: card.realSource, ...(a.real ? { text: LIVE_WEATHER.event(a.real) } : {}) }
            : { k: FLY_WORDS.history, s: a.realHistory, ...(a.realHistory.isGameEstimate ? { badge: FLY_WORDS.toVerify } : {}) },
          choices: card.options.map((o): ChoiceView => {
            const chips = chipViews(o.chips);
            if (o.riskIncrease > 0) chips.push({ icon: EFFECT_ICON[o.failureEffect], text: FLY_WORDS.risk(f.num(o.riskIncrease)), tone: 'risk', title: FLY_WORDS.ifFails(FAILURE_EFFECT[o.failureEffect]) });
            const blocked = a.blockedByConjunction || !o.affordable;
            return {
              id: o.id,
              label: optionShort(a.type, o.id, o.label),
              sub: OPTION_BLURB[`${a.type}.${o.id}`] ?? o.label,
              chips,
              eng: `P(fail) ${f.pct(o.failureChance.value, o.failureChance.value < 0.01 ? 2 : 1)} → ${o.failureEffect}${o.cost.deltaV_ms ? ` · Δv ${f.speed(o.cost.deltaV_ms.value)}` : ''}${o.cost.scienceDays ? ` · ${f.days(o.cost.scienceDays.value)} science` : ''}${o.cost.budget_M ? ` · ${f.money(o.cost.budget_M.value, 1)}` : ''}`,
              disabled: blocked,
              ...(a.blockedByConjunction
                ? { blocker: FLY_WORDS.sunUntil(f.num(a.retryAfterDay ?? 0)) }
                : !o.affordable && o.blockedBy[0]
                  ? { blocker: BLOCKER[o.blockedBy[0]].toUpperCase() }
                  : {}),
              ...(o.isFallback ? { tag: a.fallback.by === 'standing-order' ? FLY_WORDS.standingOrder : FLY_WORDS.robotDefault } : {}),
            };
          }),
          footer: { label: a.blockedByConjunction ? FLY_WORDS.letRobotRuns : FLY_WORDS.letRobot, onClick: ops.deferAlert },
        }
      : undefined;

  // ---- Eclipse planning card ----
  const dod = PARTS.power.batteryMaxDepthOfDischarge;
  const eclipseView: CardView | undefined =
    eclipse && eclipseOpen && view
      ? {
          icon: 'eclipse',
          kicker: FLY_WORDS.planAhead,
          title: FLY_WORDS.eclipse,
          line: FLY_WORDS.eclipseLine(dest.name, f.minutes(eclipse.season.longestEclipse_s)),
          day: FLY_WORDS.day(f.num(Math.floor(state!.t))),
          hits: { k: FLY_WORDS.darkStarts, v: FLY_WORDS.inDays(eclipse.inDays) },
          takes: { k: phone ? FLY_WORDS.takesShort : FLY_WORDS.takes, v: FLY_WORDS.duration(view.clock.oneWay_s) },
          history: { k: FLY_WORDS.theRule, s: { ...dod, value: FLY_WORDS.dodRule(f.pct(dod.value, 0)) } as Sourced<string> },
          choices: eclipse.options.map((o): ChoiceView => {
            const chips: ChipView[] = [{ icon: 'power', text: FLY_WORDS.inTheDark(f.num(o.eclipseSegments), f.num(FLY_RULES.gaugeSegments.value)), tone: o.eclipseSegments <= 1 ? 'cost' : 'info' }];
            if (o.preview.cold) chips.push({ icon: 'heater', text: FLY_WORDS.cold, tone: 'risk', title: FLY_WORDS.coldTitle });
            const e = o.preview.eclipse;
            return {
              id: o.id,
              label: o.id === 'keep-warm' ? FLY_WORDS.useBattery : FLY_WORDS.savePower,
              sub: o.id === 'keep-warm' ? FLY_WORDS.keepWarm : FLY_WORDS.shiver,
              chips,
              ...(e ? { eng: `DoD ${f.pct(e.depthOfDischarge)} of ${f.pct(e.limit, 0)} · heaters ${f.pct(o.plan.heaters, 0)}` } : {}),
              disabled: o.id === 'save-power' && view.blackout.active,
              ...(o.id === 'save-power' && view.blackout.active ? { blocker: FLY_WORDS.sunNow } : {}),
            };
          }),
        }
      : undefined;

  const chooseEclipse = (id: string) => {
    if (!eclipse) return;
    const o = eclipse.options.find((x) => x.id === id);
    if (o?.id === 'save-power') ops.sendPlan(o.plan);
    setEclipseDone((d) => [...d, eclipse.season.startDay]);
  };

  const openCard = hazardCard ?? eclipseView;
  const pickCard = (id: string) => (hazardCard ? respond(id) : chooseEclipse(id));

  // OBSERVE: the order leaves now and lands one light time later. The globe stays on the target to watch it land.
  const observe = () => {
    const c = sci?.cards.find((x) => x.id === sciSelected);
    if (!c || c.blocker !== undefined) return;
    if (ops.observe(c.id)) {
      play('shutter');
      setSciPick(c.id);
    }
  };

  // Keyboard: ← → ↓ choose on a card; Space pause/resume, 1/2/3 speed, N next event, Esc closes a drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (overlay) return;
      if (openCard) {
        const i = e.key === 'ArrowLeft' ? 0 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' ? 2 : -1;
        const c = openCard.choices[i];
        if (c && !c.disabled) {
          e.preventDefault();
          pickCard(c.id);
        }
        return;
      }
      if (e.key === 'Escape') {
        setPanel(undefined);
        if (sciOpen) closeScience();
      }
      else if (e.key === ' ' && !(t instanceof HTMLButtonElement)) {
        e.preventDefault();
        setSpeed(ops.speed === 0 ? lastSpeed : 0);
      } else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed(OPS_SPEEDS[Number(e.key)]!);
      else if (e.key === 'n' || e.key === 'N') ops.nextEvent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (ops.error)
    return (
      <div className="sd sd-loading" role="alert">
        <p>MISSION COULD NOT START: {ops.error}</p>
      </div>
    );

  if (!state || !view || !map || !tiles || !coming || !feed)
    return (
      <div className="sd sd-loading" aria-busy="true">
        <Teletype text="PREPARING THE MISSION. WORKING OUT EVERY DAY: DISTANCES, LIGHT TIME, ECLIPSES." prefix="> " />
      </div>
    );

  // ---- Signal in flight / result ----
  const flying = ops.transit && view.commands.find((c) => c.status === 'in-flight' && c.hazardId === ops.transit!.hazardId);
  const outcome = ops.result && view.lastOutcome?.hazardId === ops.result.hazardId ? view.lastOutcome : undefined;
  const resultLabel = ops.result ? shortLabel(ops.result.hazardId, ops.result.optionId) : '';
  const resultText = outcome ? resultLines(outcome, resultLabel).map((l) => `> ${l}`).join('\n') : ops.result ? `> ${FLY_WORDS.orderArrived(resultLabel)}\n> ${FLY_WORDS.waitingToSee}` : '';
  const resultChips: ChipView[] = [...(chosen && ops.result ? chipViews(chosen.chips) : [])];
  if (outcome?.bad) resultChips.push({ icon: EFFECT_ICON[outcome.failureEffect], text: RESULT_EFFECT_CHIP[outcome.failureEffect], tone: 'risk' });
  const deltaOf = (k: TileKey) => (ops.result && chosen ? chosen.chips.find((c) => c.gauge === k)?.delta : undefined);

  const logText = openCard
    ? hazardCard
      ? FLY_WORDS.dangerAhead(openCard.title)
      : FLY_WORDS.planAheadLine(openCard.title)
    : flying
      ? FLY_WORDS.orderSent(shortLabel(flying.hazardId!, flying.optionId!))
      : ops.transit && feed.entries.some((e) => e.from === 'earth' && e.order!.hazardId === ops.transit!.hazardId && e.order!.status === 'reply-inbound')
        ? `${TX_WORDS.heard(name.toUpperCase())}.`
        : ops.transit
        ? FLY_WORDS.orderReceived
        : ops.result
        ? FLY_WORDS.signalReceived
        : storm
          ? stormLine(storm.phase, name, FLY_WORDS.duration(storm.hitsIn_s).toUpperCase())
          : (() => {
            const e = view.feed[0];
            const line = e && e.t > state.t - 3 ? eventLine(e, { destName: dest.name, optionLabel: shortLabel }) : undefined;
            return line ? line.toUpperCase() : quietLine(view.clock.phase, dest.name);
          })();

  const awaitingExt = state.status === 'awaiting-extension' && view.extension && !view.extension.decided;
  const lockedUi = ops.locked || held;
  const progress = missionProgress(state);
  const nudge = ops.speed === 0 && !lockedUi && !openCard && !flying && !ops.result && !debrief;
  const g = ghost && { path: ghost.path, label: `${ghost.label.toUpperCase()} · REAL` };
  const arrival = milestoneLine(view.clock.next?.kind, view.clock.next?.inDays, dest.name);
  const segTotal = FLY_RULES.gaugeSegments.value;

  const tileEng: Record<TileKey, string> = {
    power: `${f.signedPct(tiles.power.margin, 0)} · ${f.watts(tiles.power.available_W)}`,
    fuel: f.kg(tiles.fuel.propellantLeft_kg),
    data: `${f.gbit(tiles.data.sent_Gbit)}`,
    systems: `${f.num(tiles.systems.health)}/${f.num(segTotal)}`,
  };
  const tileColor = (k: TileKey) => (tiles[k].low ? 'var(--sd-alarm)' : 'var(--sd-crt-hi)');

  const resources = (
    <div className="fly-tiles" role="list" aria-label={FLY_WORDS.resources}>
      {TILE_ORDER.map((k) => {
        const t = tiles[k];
        const d = k === 'fuel' || k === 'data' ? deltaOf(k) : undefined;
        return (
          <div key={k} className={`fly-tile${t.low ? ' low' : ''}`} role="listitem" aria-label={FLY_WORDS.tile(TILE[k].name, f.num(t.segments), f.num(segTotal))} title={TILE[k].help}>
            <div className="fly-tile-well">
              <SDIcon icon={TILE[k].icon} size={phone ? 22 : 26} color={tileColor(k)} />
            </div>
            <div className="fly-tile-body">
              <Segments on={t.segments} total={segTotal} color={tileColor(k)} />
              <div className="fly-tile-name">
                <span>{TILE[k].name}</span>
                {engineer && <span className="fly-tile-eng">{tileEng[k]}</span>}
              </div>
            </div>
            {d !== undefined && <span className="fly-tile-delta">{f.signedInt(d)}</span>}
          </div>
        );
      })}
    </div>
  );

  const speeds = (
    <div className={`fly-speeds${nudge ? ' nudge' : ''}`} role="group" aria-label={FLY_WORDS.speeds}>
      {OPS_SPEEDS.map((sp) => (
        <button key={sp} type="button" className="sd-key fly-speed" aria-pressed={ops.speed === sp} aria-label={SPEED_NAME(sp)} disabled={lockedUi && sp !== 0} onClick={() => setSpeed(sp)}>
          {SPEED_LABEL(sp)}
        </button>
      ))}
    </div>
  );

  const ribbon = (
    <div className="fly-ribbon-screen sd-well">
      <div className="fly-ribbon-axis" />
      {coming.ticks.map((t) => (
        <div key={t.inDays} className="fly-tick" style={{ left: `${t.left * 100}%` }}>
          <span className="fly-tick-mark" />
          <span className="fly-tick-txt">{phone ? monthsShort(t.months) : engineer ? FLY_WORDS.tickEng(f.num(view.clock.day + t.inDays)) : monthsWords(t.months)}</span>
        </div>
      ))}
      <div className="fly-now" />
      <span className="fly-now-txt">{FLY_WORDS.now}</span>
      {ribbonSlots(coming.items, phone ? RIBBON_GAP.phone : RIBBON_GAP.desk, phone ? RIBBON_PHONE_MAX : 1).map((slot, k) => {
        const it = slot.items[0]!;
        const flip = slot.left > RIBBON_FLIP;
        const w = COMING[it.kind];
        const more = slot.items.slice(1).filter((x, k, all) => x.kind !== it.kind && all.findIndex((y) => y.kind === x.kind) === k);
        return (
          <div
            key={`${it.kind}-${it.day}-${k}`}
            className={`fly-ev${flip ? ' flip' : ''}${slot.lane ? ' low' : ''}${slot.items.some((x) => x.important) ? ' important' : ''}`}
            style={{ left: `max(${phone ? RIBBON_INSET_PX.phone : RIBBON_INSET_PX.desk}px, ${slot.left * 100}%)` }}
            title={slot.items.map((x) => COMING[x.kind].label(dest.name)).join(' · ')}
          >
            <span className="fly-ev-icon">
              <SDIcon icon={w.icon} size={phone ? 15 : 17} />
            </span>
            {more.map((x) => (
              <span key={x.kind} className="fly-ev-icon more">
                <SDIcon icon={COMING[x.kind].icon} size={phone ? 15 : 17} />
              </span>
            ))}
            <span className="fly-ev-text">
              <span className="fly-ev-label">{phone ? w.short(dest.name) : w.label(dest.name)}</span>
              {!phone && <span className="fly-ev-when">{engineer ? FLY_WORDS.whenEng(f.num(it.day), f.num(it.inDays)) : FLY_WORDS.inDays(it.inDays)}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );

  // The countdown boxes keep clear of the robot: top or bottom of the map, away from it.
  const side = map && view ? transitSide(projector(map.extent_m).at(view.map.frame.craft)[1]) : phone ? 'bottom' : 'top';
  const transitBox = flying && (
    <div className={`fly-transit at-${side}`} role="status" aria-live="polite">
      {!phone && <span className="fly-transit-k">{FLY_WORDS.onItsWay(shortLabel(flying.hazardId!, flying.optionId!))}</span>}
      <span className="fly-transit-q">{flying.departsIn_s > 0 ? FLY_WORDS.teamWriting : phone ? FLY_WORDS.reachesShort : FLY_WORDS.reaches}</span>
      <span className="fly-countdown ops-countdown">{f.mmss(flying.departsIn_s > 0 ? flying.departsIn_s : flying.timeLeft_s)}</span>
      {!phone && <span className="fly-transit-foot">{flying.departsIn_s > 0 ? FLY_WORDS.thenCrosses : FLY_WORDS.justWait}</span>}
    </div>
  );

  // After the order lands, the robot's reply crosses space back to Earth: nothing is known here until it arrives.
  const mine = ops.transit ? feed?.entries.find((e) => e.from === 'earth' && e.order!.kind === 'respond' && e.order!.hazardId === ops.transit!.hazardId)?.order : undefined;
  const returning = !flying && mine?.status === 'reply-inbound' ? mine : undefined;
  const returnBox = returning && (
    <div className={`fly-transit back at-${side}`} role="status" aria-live="polite">
      {!phone && <span className="fly-transit-k">{TX_WORDS.heard(name.toUpperCase())}</span>}
      <span className="fly-transit-q">{TX_WORDS.replyReaches}</span>
      <span className="fly-countdown">{f.mmss(returning.replyIn_s ?? 0)}</span>
      {!phone && <span className="fly-transit-foot">{TX_WORDS.alreadyActed}</span>}
    </div>
  );

  const replyBox = reply && !openCard && !sciShown && (
    <div className="fly-reply" role="status" aria-label={TX_WORDS.replyFrom(name.toUpperCase(), FLY_WORDS.duration(reply.message!.delay_s))}>
      <span className="fly-reply-k">{TX_WORDS.replyFrom(name.toUpperCase(), FLY_WORDS.duration(reply.message!.delay_s))}</span>
      <Teletype className="fly-reply-v" text={txLine(reply, voice).text} />
      {!phone && <span className="fly-reply-foot">{engineer ? TX_WORDS.roundTripEng(f.mmss(reply.roundTrip_s!), name.toUpperCase()) : TX_WORDS.roundTrip(FLY_WORDS.duration(reply.roundTrip_s!))}</span>}
    </div>
  );

  const waitFor = !flying && !returning && !reply && ops.transit ? outcomeIn_s(state, ops.transit.hazardId) : undefined;
  const waitBox = waitFor !== undefined && ops.transit && (
    <div className="fly-transit" role="status" aria-live="polite">
      {!phone && <span className="fly-transit-k">{FLY_WORDS.carriedOut(shortLabel(ops.transit.hazardId, ops.transit.optionId))}</span>}
      <span className="fly-transit-q">{FLY_WORDS.strikesIn(HAZARDS[typeOf(ops.transit.hazardId)] ? FLY_WORDS.hazard(typeOf(ops.transit.hazardId), HAZARDS[typeOf(ops.transit.hazardId)]!.title) : FLY_WORDS.danger)}</span>
      <span className="fly-countdown">{f.mmss(waitFor)}</span>
      {!phone && <span className="fly-transit-foot">{FLY_WORDS.holdOn}</span>}
    </div>
  );

  const resultBox = ops.result && !reply && (
    <div className="fly-result" role="dialog" aria-label={FLY_WORDS.incoming}>
      <div className="fly-result-head">
        <span>{FLY_WORDS.incomingFrom(missionName)}</span>
        <span>{FLY_WORDS.day(f.num(Math.floor(state.t)))}</span>
      </div>
      <Teletype className="fly-result-text sd-crt-text" text={resultText} />
      <div className="fly-result-foot">
        <span className="dc-chips">
          {resultChips.map((k, i) => (
            <span key={i} className={`sd-chip ${k.tone}`}>
              <SDIcon icon={k.icon} size={18} />
              {k.text}
            </span>
          ))}
        </span>
        <button type="button" className="sd-cta" onClick={ops.dismissResult}>
          {FLY_WORDS.continue}
        </button>
      </div>
    </div>
  );

  const actions = !openCard && !flying && !returning && !reply && !ops.result && !awaitingExt && !debrief && !sciShown && (
    <div className="fly-actions">
      <button type="button" className="fly-action" aria-pressed={panel === 'power'} onClick={() => setPanel((p) => (p === 'power' ? undefined : 'power'))}>
        <SDIcon icon="power" size={16} />
        {FLY_WORDS.powerPlan}
      </button>
      <button type="button" className="fly-action" aria-pressed={panel === 'call'} onClick={() => setPanel((p) => (p === 'call' ? undefined : 'call'))}>
        <SDIcon icon="dish" size={16} />
        {FLY_WORDS.callHome}
      </button>
      <button type="button" className="fly-action" aria-pressed={panel === 'queue'} aria-label={FLY_WORDS.ordersLabel} onClick={() => setPanel((p) => (p === 'queue' ? undefined : 'queue'))}>
        <SDIcon icon="share" size={16} />
        {FLY_WORDS.orders}
      </button>
      {engineer && (
        <button type="button" className="fly-action" aria-pressed={panel === 'eqs'} onClick={() => setPanel((p) => (p === 'eqs' ? undefined : 'eqs'))}>
          {FLY_WORDS.equations}
        </button>
      )}
      {panelOk && (
        <button type="button" className="fly-action sci-key" onClick={openScience}>
          <SDIcon icon={sci?.available ? 'camera' : 'orbit'} size={16} />
          {sci?.available ? SCIENCE.reopen : MOON_WORDS.reopen}
        </button>
      )}
      {phone && dl && dl.rows.length > 0 && (
        <button type="button" className="fly-action" aria-pressed={panel === 'downlink'} onClick={() => setPanel((p) => (p === 'downlink' ? undefined : 'downlink'))}>
          <SDIcon icon="dish" size={16} />
          {DOWNLINK.button}
        </button>
      )}
      <button type="button" className="fly-action" onClick={ops.nextEvent} disabled={lockedUi} aria-label={FLY_WORDS.nextEventLabel}>
        {FLY_WORDS.nextEvent}
      </button>
      <button type="button" className="fly-action finish" onClick={() => setOverlay('finish')}>
        {NAV.finish}
      </button>
    </div>
  );

  const drawers = (
    <>
      {!openCard && !flying && !ops.result && <SafeModePanel science={view.science} engineer={engineer} />}
      {!openCard && !flying && !ops.result && !panel && <BlackoutPanel view={view} engineer={engineer} onSkip={ops.skipTo} />}
      {panel === 'power' && (
        <div className="fly-drawer">
          <PowerDial
            state={state}
            engineer={engineer}
            destName={dest.name}
            blocked={view.blackout.active}
            onSend={(p) => {
              ops.sendPlan(p);
              setPanel('queue');
            }}
            onClose={() => setPanel(undefined)}
          />
        </div>
      )}
      {panel === 'call' && (
        <div className="fly-drawer">
          <BookCall
            state={state}
            engineer={engineer}
            onBook={(d, dish, hours) => {
              ops.book(d, dish, hours);
              setPanel(undefined);
            }}
            onClose={() => setPanel(undefined)}
          />
        </div>
      )}
      {panel === 'queue' && (
        <div className="fly-drawer">
          <CommandQueue
            commands={view.commands}
            blackout={view.blackout}
            engineer={engineer}
            optionLabel={(c) => (c.kind === 'respond' && c.hazardId && c.optionId ? shortLabel(c.hazardId, c.optionId) : COMMAND_KIND[c.kind])}
            onClose={() => setPanel(undefined)}
            onPlan={() => setPanel('power')}
            onCall={() => setPanel('call')}
          />
        </div>
      )}
      {panel === 'eqs' && (
        <div className="fly-drawer">
          <EquationsPanel gauges={view.gauges} onClose={() => setPanel(undefined)} />
        </div>
      )}
      {awaitingExt && (
        <div className="fly-drawer wide">
          <ExtensionDecision options={view.extension!.options} engineer={engineer} destName={dest.name} scienceDays={state.scienceDaysAchieved} onChoose={ops.extend} />
        </div>
      )}
      {debrief && (
        <div className="fly-end" role="dialog" aria-label={FLY_WORDS.over}>
          <span className="fly-end-k">{state.status === 'lost' ? FLY_WORDS.lost : state.status === 'not-launched' ? FLY_WORDS.notLaunched : FLY_WORDS.complete}</span>
          <span className="fly-end-v">{state.status === 'lost' ? FLY_WORDS.silent : FLY_WORDS.printing}</span>
          <button type="button" className="sd-cta" onClick={() => onDone(state)}>
            {FLY_WORDS.seeReport}
          </button>
        </div>
      )}
      {ops.notice && <NoticeToast notice={ops.notice} onClose={ops.dismissNotice} />}
    </>
  );

  const skipT = nextImageT(state);
  const sciPanel = sciShown && sci && !openCard && (
    <ScienceTargets
      view={sci}
      selected={sciSelected}
      onSelect={setSciPick}
      onObserve={observe}
      onDone={closeScience}
      busy={zoom.running}
      robotName={name}
      destName={dest.name}
      body={sci.body}
      engineer={engineer}
      phone={phone}
      orders={view.commands.filter((c) => c.kind === 'observe' && c.status === 'in-flight' && c.targetId).map((c) => ({ targetId: c.targetId!, timeLeft_s: c.timeLeft_s }))}
      {...(flyover ? { scanning: flyover.targetId } : {})}
      globe={
        <Globe
          body={sci.body}
          {...(moonView ? { moon: moonView, trimTag: !teaches || teaches.includes('fuel') } : {})}
          cards={sci.cards}
          orbit={sci.orbit}
          selected={sciSelected}
          onPick={setSciPick}
          phone={phone}
          engineer={engineer}
          still={still}
          robotName={name}
          overview={zoom.running}
          {...(flyover ? { flyover } : {})}
          shown={zoom.running ? zoom.shown : sci.cards.length}
        />
      }
    />
  );
  const downlink = panel === 'downlink' && dl && (
    <div className={`dn-wrap${phone ? ' phone' : ''}`}>
      <Downlink view={dl} robotName={name} phone={phone} still={still} onClose={() => setPanel(undefined)} {...(skipT !== undefined && !lockedUi ? { onSkip: () => ops.skipTo(skipT) } : {})} />
    </div>
  );
  const downlinkFoot = dl && dl.rows.length > 0 && (
    <button type="button" className={`tx-downlink${dl.waiting === 0 ? ' all' : ''}`} aria-pressed={panel === 'downlink'} onClick={() => setPanel((p) => (p === 'downlink' ? undefined : 'downlink'))}>
      <SDIcon icon="dish" size={24} />
      <span className="tx-downlink-t">
        <span className="tx-downlink-k">{DOWNLINK.button}</span>
        <span className="tx-downlink-s">{dl.waiting === 0 ? DOWNLINK.allHome(f.num(dl.rows.length)) : DOWNLINK.waitingOn(f.num(dl.waiting), dl.waiting === 1, name.toUpperCase())}</span>
      </span>
      <span className="tx-downlink-chev">{panel === 'downlink' ? DOWNLINK.close : DOWNLINK.open}</span>
    </button>
  );

  const crt = (
    <main className={`sd-crt fly-crt${view.blackout.active ? ' blackout' : ''}${shake && !still ? ' shake' : ''}`} aria-label={FLY_WORDS.map}>
      <CrtMap
        map={map}
        frame={view.map.frame}
        trail={view.map.trail}
        ahead={ahead}
        destination={design.destination}
        destName={dest.name}
        {...(g ? { ghost: g } : {})}
        {...(flying ? { pulse: flying.progress } : returning ? { pulse: returning.progress, pulseBack: true } : {})}
        ringPhase={ringPhase}
        {...(storm ? { storm } : {})}
        robotName={name}
        phone={phone}
        lost={state.status === 'lost'}
      />
      <Teletype className="fly-log sd-crt-text" text={logText} prefix="> " />
      {!phone && <span className="fly-goal">{FLY_WORDS.goal}</span>}
      {!phone && (
        <div className="fly-legend">
          <span>
            <span className="lg-path" />
            {FLY_WORDS.yourPath}
          </span>
          {g && (
            <span title={FLY_WORDS.ghost(ghost!.label)}>
              <span className="lg-ghost" />
              {FLY_WORDS.realPath}
              <span className="sr-only">{FLY_WORDS.ghost(ghost!.label)}</span>
            </span>
          )}
        </div>
      )}
      {engineer && !phone && (
        <div className="fly-eng-readout">
          <span>SUN DIST r = {f.au(view.clock.sunDistance_m)}</span>
          <span>EARTH DIST d = {f.au(view.clock.earthDistance_m)}</span>
          <span className="amber ops-met">LIGHT TIME t = d / c = {f.mmss(view.clock.oneWay_s)}</span>
          <span className="small">c = {f.num(SPEED_OF_LIGHT.value)} km/s · MET {f.met(state.t)}</span>
        </div>
      )}
      {engineer && phone && (
        <div className="fly-eng-phone">
          t = d / c = {f.au(view.clock.earthDistance_m)} / c = {f.mmss(view.clock.oneWay_s)}
        </div>
      )}
      {banner && !openCard && !debrief && !sciShown && (
        <MomentBanner
          key={banner.n}
          kind={banner.kind}
          title={banner.kind === 'arrived' ? MOMENT_WORDS.arrived(dest.name.toUpperCase(), design.destination === 'bennu') : MOMENT_WORDS.storm}
          sub={banner.kind === 'arrived' ? (design.destination === 'bennu' ? MOMENT_WORDS.arrivedSubBennu(name) : MOMENT_WORDS.arrivedSub(name)) : MOMENT_WORDS.stormSub(name)}
        />
      )}
      {transitBox}
      {returnBox}
      {replyBox}
      {waitBox}
      {!phone && resultBox}
      {!phone && openCard && <DangerCard card={openCard} engineer={engineer} phone={false} onPick={pickCard} />}
      {actions}
      {drawers}
      {!phone && sciPanel}
    </main>
  );

  const progressBar = (
    <div className="fly-progress" role="progressbar" aria-label={FLY_WORDS.progress} aria-valuemin={0} aria-valuemax={1} aria-valuenow={progress.fraction}>
      <div className="fly-progress-bar sd-well">
        <div className="fly-progress-fill" style={{ width: `${progress.fraction * 100}%` }} />
      </div>
      <span className="fly-progress-txt">{nudge ? playNudge(SPEED_LABEL(lastSpeed)) : endsInWords(progress.daysLeft)}</span>
    </div>
  );

  const confirm = (overlay === 'finish' || overlay === 'leave') && (
    <div className="sd-overlay" role="dialog" aria-modal="true" aria-label={overlay === 'finish' ? FINISH_CONFIRM.title : LEAVE_CONFIRM.title}>
      <div className="sd-confirm sd-paper">
        <h2 className="sd-brief-title">{overlay === 'finish' ? FINISH_CONFIRM.title : LEAVE_CONFIRM.title}</h2>
        <p className="sd-brief-job">{overlay === 'finish' ? FINISH_CONFIRM.body : LEAVE_CONFIRM.body}</p>
        <div className="sd-confirm-foot">
          <button type="button" className="sd-ghost-btn" onClick={() => setOverlay(undefined)}>
            {overlay === 'finish' ? FINISH_CONFIRM.no : LEAVE_CONFIRM.stay}
          </button>
          {overlay === 'leave' && onBack && (
            <button type="button" className="sd-ghost-btn" onClick={onBack}>
              {LEAVE_CONFIRM.leave}
            </button>
          )}
          {!debrief && (
            <button type="button" className="sd-cta" onClick={finishMission}>
              {overlay === 'finish' ? FINISH_CONFIRM.yes : LEAVE_CONFIRM.finish}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const overlays = (
    <>
      {launching && <LaunchCountdown onDone={endLaunch} still={still} />}
      {toastCard && !openPostcard && !debrief && (
        <button
          type="button"
          className="fly-postcard"
          onClick={() => {
            setCardOpen(toastCard.id);
            setToast(undefined);
          }}
        >
          <img src={postcardSrc(toastCard)} alt="" />
          <span className="fly-postcard-t">
            <span className="fly-postcard-k">{POSTCARD_WORDS.toast(dest.name.toUpperCase())}</span>
            <span className="fly-postcard-v">{toastCard.title}</span>
            <span className="fly-postcard-look">{POSTCARD_WORDS.look}</span>
          </span>
        </button>
      )}
      {openPostcard && <PostcardView card={openPostcard} onClose={() => setCardOpen(undefined)} closeLabel={POSTCARD_WORDS.keep} />}
      {overlay === 'coach' && !launching && <CoachCard onClose={closeOverlay} />}
      {overlay === 'info' && brief && (
        <MissionBriefing title={brief.title} destination={design.destination} briefing={brief.briefing} {...(brief.concept ? { concept: brief.concept } : {})} onClose={closeOverlay} />
      )}
      {confirm}
    </>
  );

  // Once the mission is over, Back goes on to the report instead of throwing the flight away.
  const back = () => (debrief ? onDone(state) : setOverlay('leave'));

  const helpKeys = (
    <div className="fly-help">
      <LangToggle className="fly-lang" />
      <SoundToggle className="fly-help-q" />
      {brief && (
        <button type="button" className="sd-ghost-btn fly-help-q" aria-label={NAV.info} title={NAV.info} onClick={() => setOverlay('info')}>
          i
        </button>
      )}
      <button type="button" className="sd-ghost-btn fly-help-q" aria-label={NAV.help} title={NAV.help} onClick={() => setOverlay('coach')}>
        ?
      </button>
    </div>
  );

  const brand = (
    <div className="sd-brand">
      <button type="button" className="sd-brand-name" onClick={onHome} aria-label={BRAND_WORDS.home}>
        {GAME_NAME}
      </button>
      <span className="sd-brand-sub">{BRAND_WORDS.sub(missionName, dest.name)}</span>
    </div>
  );

  if (phone)
    return (
      <div ref={rootRef} className={`sd fly phone${engineer ? ' eng' : ''}${zoom.running ? ' zooming' : ''}`}>
        <div className="fly-status">
          {onBack ? (
            <BackButton onBack={back} />
          ) : (
            <button type="button" className="fly-status-brand" onClick={onHome}>
              {GAME_NAME}
            </button>
          )}
          {helpKeys}
          <ModeLever mode={mode} onMode={onMode} />
        </div>
        {resources}
        <Transmissions feed={feed!} voice={voice} oneWay_s={view.clock.oneWay_s} phone {...(reply ? { hot: reply } : {})} />
        {crt}
        <div className="fly-bottom">
          <div className="fly-clock-row">
            <div className="fly-day sd-well" aria-label={FLY_WORDS.dayLabel(f.num(view.clock.day))}>
              <span className="fly-day-k">{FLY_WORDS.dayK}</span>
              <span className="fly-day-num ops-day-num">{f.dayPad(view.clock.day)}</span>
            </div>
            {speeds}
          </div>
          {progressBar}
          <div className="fly-ribbon phone">
            <span className="fly-ribbon-title">{FLY_WORDS.comingUp}</span>
            {ribbon}
          </div>
        </div>
        {openCard && <DangerCard card={openCard} engineer={engineer} phone onPick={pickCard} />}
        {resultBox}
        {sciPanel}
        {downlink}
        {overlays}
      </div>
    );

  return (
    <div ref={rootRef} className={`sd fly${engineer ? ' eng' : ''}${zoom.running ? ' zooming' : ''}`}>
      <header className="fly-top">
        <div className="fly-top-left">
          {onBack && <BackButton onBack={back} />}
          {brand}
        </div>
        {resources}
        <div className="fly-top-right">
          {helpKeys}
          <ModeLever mode={mode} onMode={onMode} />
        </div>
      </header>
      <div className="fly-mid">
        {crt}
        <Transmissions feed={feed!} voice={voice} oneWay_s={view.clock.oneWay_s} phone={false} {...(reply ? { hot: reply } : {})} {...(downlinkFoot ? { footer: downlinkFoot } : {})} />
      </div>
      <footer className="fly-bottom">
        <div className="fly-clock">
          <div className="fly-day sd-well" aria-label={FLY_WORDS.dayLabel(f.num(view.clock.day))}>
            <span className="fly-day-k">{FLY_WORDS.dayK}</span>
            <span className="fly-day-num ops-day-num">{f.dayPad(view.clock.day)}</span>
            <span className="fly-arrival">{arrival}</span>
          </div>
          {speeds}
          {progressBar}
        </div>
        <div className="fly-ribbon">
          <div className="fly-ribbon-head">
            <span>{FLY_WORDS.comingUpSub}</span>
            <span className="dim">{FLY_WORDS.nextMonths(f.num(coming.months))}</span>
          </div>
          {ribbon}
        </div>
      </footer>
      {downlink}
      {overlays}
    </div>
  );
}
