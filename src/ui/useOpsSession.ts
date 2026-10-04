// The Operations Console session: one OpsState, stepped by the engine's advanceOperations. The UI only chooses
// how fast mission time runs and when to stop; every number on screen comes from consoleView (engine).
// The action log is kept in localStorage so a session can be resumed (replayOperations with `until`).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceOperations,
  bookDsn,
  consoleView,
  decide,
  nextEventT,
  replayOperations,
  sendCommand,
  startOperations,
  type CommandReceipt,
  type OpsAction,
  type OpsConsoleView,
  type OpsEventCode,
  type OpsState,
  type PowerPlan,
} from '../engine/ops/index';
import type { Design } from '../engine/types';

/** One clock step every quarter second; each step schedules the next. */
export const OPS_TICK_MS = 250;
/** Mission days per real minute: Pause, 1×, 10×, 100× (as the mockup: 1× = 1 day a minute). */
export const OPS_SPEEDS = [0, 1, 10, 100] as const;
export type OpsSpeed = (typeof OPS_SPEEDS)[number];
/** A command's trip across space plays in this many steps (about six seconds). */
export const TRANSIT_STEPS = 24;
/** The team's reaction time before the order leaves Earth plays in this many steps (one and a half seconds). */
export const TEAM_STEPS = 6;

/** The clock stops by itself when one of these happens, so the player never misses it. */
const PAUSE_ON = new Set<OpsEventCode>(['decision-open', 'conjunction-start', 'safe-mode', 'craft-lost', 'response-outcome', 'prime-complete', 'mission-complete', 'launch-failed']);

const STORE = 'mdt.ops';

interface Saved {
  key: string;
  seed: number;
  t: number;
  actions: OpsAction[];
}

function load(design: Design, seed: number, key: string): OpsState {
  try {
    const raw = localStorage.getItem(STORE);
    const saved = raw ? (JSON.parse(raw) as Saved) : undefined;
    if (saved && saved.key === key && saved.seed === seed && Array.isArray(saved.actions) && Number.isFinite(saved.t) && saved.t > 0) {
      return replayOperations(design, { seed }, saved.actions, saved.t);
    }
  } catch {
    /* no saved session, or storage unavailable: start fresh */
  }
  return startOperations(design, { seed });
}

function save(s: Saved | undefined) {
  try {
    if (s) localStorage.setItem(STORE, JSON.stringify(s));
    else localStorage.removeItem(STORE);
  } catch {
    /* storage unavailable: the session lasts for this visit only */
  }
}

export interface Transit {
  hazardId: string;
  optionId: string;
  /** Mission time the order was chosen, leaves Earth (after the team has reacted) and reaches the craft. */
  chosenAt: number;
  departsAt: number;
  arrivesAt: number;
  /** After the order lands: when its outcome is known (the danger strikes), if that is later. */
  resolveAt?: number;
}

/** The outcome after an order lands plays in this many steps. */
export const OUTCOME_STEPS = 8;

/** The next stop of a transit: the team's reaction in TEAM_STEPS steps, then the light-time trip in TRANSIT_STEPS. */
function transitStop(tr: Transit, t: number): number {
  if (t < tr.departsAt - 1e-12) return Math.min(tr.departsAt, t + Math.max(1e-6, (tr.departsAt - tr.chosenAt) / TEAM_STEPS));
  if (t < tr.arrivesAt - 1e-12 || tr.resolveAt === undefined) return Math.min(tr.arrivesAt, t + Math.max(1e-6, (tr.arrivesAt - tr.departsAt) / TRANSIT_STEPS));
  return Math.min(tr.resolveAt, t + Math.max(1e-6, (tr.resolveAt - tr.arrivesAt) / OUTCOME_STEPS));
}

export type Notice = { kind: 'refused'; reason: NonNullable<CommandReceipt['reason']>; retryAfterDay?: number } | { kind: 'booked'; day: number; dish: 34 | 70 } | { kind: 'sent' };

export interface OpsSession {
  state?: OpsState;
  view?: OpsConsoleView;
  error?: string;
  speed: OpsSpeed;
  /** Time cannot run: a decision waits, or the mission is over. */
  locked: boolean;
  /** The open hazard alert is on screen (not left to the craft). */
  showAlert: boolean;
  transit?: Transit;
  /** The hazard whose response just reached the craft (or whose outcome just landed). */
  result?: { hazardId: string; optionId: string };
  notice?: Notice;
  setSpeed: (s: OpsSpeed) => void;
  respond: (optionId: string) => void;
  /** Leave the open hazard to the craft (standing order or fault protection at the deadline). */
  deferAlert: () => void;
  sendPlan: (plan: PowerPlan) => void;
  book: (day: number, dish: 34 | 70, hours: number) => void;
  extend: (optionId: string) => void;
  nextEvent: () => void;
  skipTo: (t: number) => void;
  dismissResult: () => void;
  dismissNotice: () => void;
  restart: () => void;
}

export function useOpsSession(design: Design, seed: number): OpsSession {
  const key = useMemo(() => JSON.stringify(design), [design]);
  const [state, setState] = useState<OpsState>();
  const [error, setError] = useState<string>();
  const [speed, setSpeedRaw] = useState<OpsSpeed>(0);
  const [transit, setTransit] = useState<Transit>();
  const [result, setResult] = useState<{ hazardId: string; optionId: string }>();
  const [notice, setNotice] = useState<Notice>();
  const [deferred, setDeferred] = useState<string[]>([]);
  const stateRef = useRef<OpsState>(undefined);
  stateRef.current = state;
  /** Real time of the last clock step, so mission time follows the wall clock even if the browser slows timers. */
  const lastTick = useRef(0);

  // Prepare the mission one tick later, so the "Preparing mission" screen can paint first.
  useEffect(() => {
    setState(undefined);
    setError(undefined);
    setSpeedRaw(0);
    setTransit(undefined);
    setResult(undefined);
    setDeferred([]);
    const id = setTimeout(() => {
      try {
        setState(load(design, seed, key));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 0);
    return () => clearTimeout(id);
  }, [design, seed, key]);

  const view = useMemo(() => (state ? consoleView(state) : undefined), [state]);

  /** Take a new state; stop the clock if something happened the player must see. */
  const apply = useCallback((next: OpsState, prev: OpsState) => {
    const fresh = next.events.slice(prev.events.length);
    if (fresh.some((e) => PAUSE_ON.has(e.code))) setSpeedRaw(0);
    const out = [...fresh].reverse().find((e) => e.code === 'response-outcome');
    if (out) setResult({ hazardId: String(out.values.hazardId), optionId: String(out.values.optionId) });
    setState(next);
  }, []);

  const showAlert = view?.alert !== undefined && !deferred.includes(view.alert.decisionId);
  // In a conjunction nothing can be sent, so the clock may run on to the deadline (the craft decides).
  const alertOpen = showAlert && !view!.alert!.blockedByConjunction;
  const over = state !== undefined && state.status !== 'flying';
  const locked = !state || over || alertOpen || result !== undefined;

  // The clock: one step per tick while running; a command in transit runs fast until it arrives.
  useEffect(() => {
    if (!state) return;
    if (!transit && (speed === 0 || locked)) {
      lastTick.current = 0;
      return;
    }
    const id = setTimeout(() => {
      const s = stateRef.current;
      if (!s || s.status !== 'flying') return;
      if (transit) {
        const next = advanceOperations(s, { until: transitStop(transit, s.t) });
        apply(next, s);
        const rec = next.hazards.find((h) => h.id === transit.hazardId);
        const outcomeLanded = next.events.slice(s.events.length).some((e) => e.code === 'response-outcome' && e.values.hazardId === transit.hazardId);
        const arrived = next.t >= transit.arrivesAt - 1e-12;
        if (next.status !== 'flying' || next.newDecisions.length || outcomeLanded || (arrived && (!rec || rec.outcomeDone || rec.resolveAt === undefined))) {
          setTransit(undefined);
          setResult((r) => r ?? { hazardId: transit.hazardId, optionId: transit.optionId });
        } else if (arrived && transit.resolveAt === undefined && rec?.resolveAt !== undefined) {
          // The order landed before the danger struck: keep time running until the outcome is known.
          setTransit({ ...transit, resolveAt: rec.resolveAt });
        }
        return;
      }
      const now = Date.now();
      // At most four ticks' worth at once: a tab coming back from the background does not leap ahead.
      const ms = lastTick.current ? Math.min(now - lastTick.current, 4 * OPS_TICK_MS) : OPS_TICK_MS;
      lastTick.current = now;
      apply(advanceOperations(s, { days: (speed * ms) / 60_000 }), s);
    }, OPS_TICK_MS);
    return () => clearTimeout(id);
  }, [state, speed, locked, transit, apply]);

  // Save the action log and the clock whenever an action is taken or the clock stops.
  useEffect(() => {
    if (state && (speed === 0 || state.actions.length)) save({ key, seed, t: state.t, actions: state.actions });
  }, [state?.actions.length, speed, state?.status, key, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const refuse = (r: CommandReceipt) => setNotice({ kind: 'refused', reason: r.reason ?? 'not-flying', ...(r.retryAfterDay !== undefined ? { retryAfterDay: r.retryAfterDay } : {}) });

  const respond = (optionId: string) => {
    const s = stateRef.current;
    const a = view?.alert;
    if (!s || !a) return;
    const r = decide(s, a.decisionId, optionId);
    setState(r.state);
    if (!r.receipt.accepted) return refuse(r.receipt);
    setNotice(undefined);
    setTransit({ hazardId: a.hazardId, optionId, chosenAt: s.t, departsAt: r.receipt.sentAt, arrivesAt: r.receipt.arrivesAt! });
  };

  const sendPlan = (plan: PowerPlan) => {
    const s = stateRef.current;
    if (!s) return;
    const r = sendCommand(s, { kind: 'power-plan', plan });
    setState(r.state);
    if (r.receipt.accepted) setNotice({ kind: 'sent' });
    else refuse(r.receipt);
  };

  const book = (day: number, dish: 34 | 70, hours: number) => {
    const s = stateRef.current;
    if (!s) return;
    const r = bookDsn(s, day, day, { dish, hours });
    setState(r.state);
    if (r.receipt.accepted) setNotice({ kind: 'booked', day, dish });
    else refuse(r.receipt);
  };

  const extend = (optionId: string) => {
    const s = stateRef.current;
    if (!s) return;
    const r = decide(s, 'extension', optionId);
    setState(r.state);
    if (!r.receipt.accepted) refuse(r.receipt);
  };

  const jump = (until: number) => {
    const s = stateRef.current;
    if (!s || s.status !== 'flying' || locked) return;
    apply(advanceOperations(s, { until }), s);
  };

  return {
    ...(state ? { state } : {}),
    ...(view ? { view } : {}),
    ...(error ? { error } : {}),
    speed,
    locked,
    showAlert,
    ...(transit ? { transit } : {}),
    ...(result ? { result } : {}),
    ...(notice ? { notice } : {}),
    setSpeed: (sp) => !locked && setSpeedRaw(sp),
    respond,
    deferAlert: () => view?.alert && setDeferred((d) => [...d, view.alert!.decisionId]),
    sendPlan,
    book,
    extend,
    nextEvent: () => state && jump(nextEventT(state)),
    skipTo: (t) => jump(t),
    dismissResult: () => setResult(undefined),
    dismissNotice: () => setNotice(undefined),
    restart: () => {
      save(undefined);
      setSpeedRaw(0);
      setTransit(undefined);
      setResult(undefined);
      setDeferred([]);
      setNotice(undefined);
      setState(startOperations(design, { seed }));
    },
  };
}
