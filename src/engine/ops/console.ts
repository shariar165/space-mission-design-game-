// Operations Console view model (spec: UI rules 16–20). Everything the console shows, read from an OpsState
// and the fixed environment: the UI only formats these numbers. Pure functions; the state is never changed.
import { G0 } from '../constants';
import { coins, PHOTO_FRAME_Mbit } from '../cadet';
import { HAZARDS, OPERATIONS, PARTS, type FailureEffect, type HazardOption, type OpsPhase } from '../data';
import { frameOnDay, trailTo, type FlightFrame, type XY } from '../flightMap';
import { evaluateDesign, type FullEvaluation } from '../index';
import { marginStatus } from '../meter';
import { propellantBurned } from '../propulsion';
import { gameEstimate, sourced, type Design, type MeterStatus, type Sourced } from '../types';
import { commandArrival, inMoratorium, moratoriumEndDay, oneWayAt } from './commands';
import { defaultBooking, demand, downlinkCapacity_bitsPerDay, dsnExtraCost_M, type Loads } from './resources';
import { defaultResponse, effectiveFailureChance, isFree, optionBlockers, type ResponseBlocker } from './responses';
import { bookingFor, deltaVLeft_ms, deltaVStillNeeded_ms, powerMarginNow, spareNow } from './timeline';
import type {
  CommandRecord,
  ConjunctionWindow,
  DsnBooking,
  EclipseSeason,
  ExtensionOption,
  OpsEvent,
  OpsState,
  OpsStatus,
  PowerPlan,
  ResponseSource,
} from './types';
import { stormSourced, type RealStorm } from '../spaceWeather';

/** Game rules of the console's display (registered in the data audit). */
export const CONSOLE_RULES = {
  timelineWindow_days: gameEstimate(60, 'days', 'Game rule (Operations Console): the Upcoming strip shows the next 60 days'),
  conjunctionWarning_days: gameEstimate(
    14,
    'days',
    'Game rule (Operations Console): warn this many days before a solar-conjunction moratorium, so commands can be queued (about two DSN booking lead times)',
  ),
  riskLevelBounds: gameEstimate(
    [0.005, 0.01, 0.03, 0.1],
    'failure chance',
    'Game rule (Operations Console): bounds of the five-segment risk bar on a response card (1 segment ≤ 0.5%, 5 segments > 10%)',
  ),
  feedLength: gameEstimate(8, 'events', 'Game rule (Operations Console): the event feed keeps the latest 8 events'),
} satisfies Record<string, Sourced<unknown>>;

const DAY_S = 86_400;
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const derived = (value: number, unit: string, what: string): Sourced<number> => sourced(value, unit, `Computed by the engine: ${what}`);
const photosOf = (bits: number) => bits / (PHOTO_FRAME_Mbit.value * 1e6);

// ---------------------------------------------------------------------------
// Types

export type ConsoleChip = 'nominal' | 'hazard' | 'safe-mode' | 'conjunction-soon' | 'blackout' | 'decision' | 'lost' | 'complete' | 'not-launched';

export interface ConsoleClock {
  t: number;
  day: number;
  date: string;
  phase: OpsPhase;
  status: OpsStatus;
  oneWay_s: number;
  earthDistance_m: number;
  sunDistance_m: number;
  sepAngle_deg?: number;
  chip: ConsoleChip;
  /** The next big milestone, for the Cadet subline ("93 days until you reach Mars"). */
  next?: { kind: 'arrival' | 'prime-end' | 'extension-end'; day: number; inDays: number };
}

export interface ConsoleGauge {
  used: number;
  limit: number;
  margin: number;
  status: MeterStatus;
  /** How full the drawn bar is (0–1). */
  fill: number;
  /** Where the drawn marker sits (0–1), if the gauge has one. */
  mark?: number;
  equation: string;
  inputs: Record<string, Sourced<number>>;
}

export interface ConsoleGauges {
  /** used = today's demand with the plan in force (W), limit = power available today (W). */
  power: ConsoleGauge & { eclipseFraction: number; inEclipseSeason: boolean };
  /** used = Δv still needed, limit = Δv left (m/s). fill = propellant left of the load; mark = propellant still needed. */
  fuel: ConsoleGauge & { propellantLeft_kg: number; propellantNeeded_kg: number };
  /** used = data waiting on board, limit = recorder size (bits). */
  recorder: ConsoleGauge & { photosWaiting: number; producedToday_bits: number; downlinkedToday_bits: number; daysToFull?: number };
  /** used = extras spent, limit = the reserve (cap − development) ($M). */
  budget: ConsoleGauge & { spare_M: number; spareCoins: number; operations_M: number };
}

export type SignalState = 'downlink' | 'uplink' | 'blocked' | 'none';

export interface ConsoleMap {
  frame: FlightFrame;
  /** Path flown so far, for the map's trail. */
  trail: XY[];
  signal: SignalState;
}

export interface TimelineBand {
  kind: 'conjunction' | 'eclipse';
  startDay: number;
  endDay: number;
  left: number;
  width: number;
  active: boolean;
  /** Eclipse: longest single eclipse (s); conjunction: smallest Sun–Earth–probe angle (deg). */
  longestEclipse_s?: number;
  minAngle_deg?: number;
}

export interface TimelineEvent {
  kind: 'burn' | 'dsn' | 'open-slot' | 'phase' | 'dose';
  day: number;
  left: number;
  burnKind?: 'trajectory-correction' | 'route-manoeuvre' | 'arrival' | 'maintenance';
  dv_ms?: number;
  dish?: 34 | 70;
  hours?: number;
  /** The last pass before a solar-conjunction moratorium. */
  lastBeforeBlackout?: boolean;
  /** The first pass after a moratorium. */
  firstAfterBlackout?: boolean;
  phase?: OpsPhase;
  fraction?: number;
}

export interface ConsoleTimeline {
  from: number;
  to: number;
  /** Window length (days). */
  days: number;
  /** Day labels along the axis, every twelfth of the strip. */
  ticks: { day: number; left: number }[];
  bands: TimelineBand[];
  events: TimelineEvent[];
  /** The next milestone beyond the window, if any. */
  ahead?: { kind: 'arrival' | 'prime-end'; day: number; inDays: number };
}

export interface AlertOption {
  id: string;
  label: string;
  cost: HazardOption['cost'];
  requires?: HazardOption['requires'];
  oneTime: boolean;
  failureChance: Sourced<number>;
  /** 1–5 segments of the risk bar (CONSOLE_RULES.riskLevelBounds). */
  riskLevel: number;
  failureEffect: FailureEffect;
  affordable: boolean;
  blockedBy: ResponseBlocker[];
  isSafest: boolean;
  isFree: boolean;
  /** What the craft does if no command reaches it by the deadline. */
  isFallback: boolean;
  /** The costs in Cadet units: propellant for the Δv at today's mass (kg), budget in coins, photos not taken. */
  fuel_kg: number;
  coins: number;
  photosLost: number;
}

export interface ConsoleAlert {
  decisionId: string;
  hazardId: string;
  type: string;
  title: string;
  prompt: string;
  realHistory: Sourced<string>;
  detectedBy: 'earth' | 'craft';
  onset: number;
  knownAt: number;
  deadline: number;
  earliestSend: number;
  /** When a response sent now would leave (after the team has reacted). */
  sendAt: number;
  arrivesIfSent: number;
  /** One-way light time when it leaves (s). */
  oneWay_s: number;
  /** A response sent now would arrive after the deadline. */
  lateIfSent: boolean;
  blockedByConjunction: boolean;
  retryAfterDay?: number;
  fallback: { optionId: string; by: Exclude<ResponseSource, 'player'> };
  standingOrder?: string;
  options: AlertOption[];
  /** Live Daily: the real DONKI storm behind this card, and its ⓘ record. */
  real?: RealStorm;
  realSource?: Sourced<string>;
}

export interface ConsoleCommand {
  id: number;
  kind: CommandRecord['command']['kind'];
  hazardId?: string;
  optionId?: string;
  sentAt: number;
  arrivesAt: number;
  progress: number;
  timeLeft_s: number;
  /** A hazard response waits for the team to react: seconds until it leaves Earth (0 once it has left). */
  departsIn_s: number;
  status: CommandRecord['status'];
}

export interface ConsoleOutcome {
  hazardId: string;
  type: string;
  title: string;
  optionId: string;
  label: string;
  by: ResponseSource;
  bad: boolean;
  failureEffect: FailureEffect;
  t: number;
  scienceDaysLost: number;
  budget_M: number;
  coins: number;
  deltaV_ms: number;
}

export interface ConsoleBlackout {
  active: boolean;
  window?: ConjunctionWindow;
  dayOf?: number;
  total?: number;
  endDay?: number;
  retryAfterDay?: number;
  /** Whole days until contact returns (counting today). */
  daysLeft?: number;
  /** The next moratorium, while it is still ahead. */
  upcoming?: { window: ConjunctionWindow; inDays: number; lastSendDay: number; length_days: number; /** Inside the warning time (CONSOLE_RULES). */ soon: boolean };
}

export interface ConsoleScience {
  /** Instruments are off: safe mode, or a response that pauses science. */
  paused: boolean;
  cause?: 'safe-mode' | 'response';
  resumesAt?: number;
  instrumentsLost: string[];
  instrumentsOff: string[];
}

export interface OpsConsoleView {
  clock: ConsoleClock;
  map: ConsoleMap;
  gauges: ConsoleGauges;
  timeline: ConsoleTimeline;
  alert?: ConsoleAlert;
  lastOutcome?: ConsoleOutcome;
  commands: ConsoleCommand[];
  blackout: ConsoleBlackout;
  science: ConsoleScience;
  extension?: { options: ExtensionOption[]; decided: boolean; chosen?: OpsState['extension'] };
  feed: OpsEvent[];
}

// ---------------------------------------------------------------------------
// Pieces

const dayOf = (s: OpsState) => Math.max(0, Math.min(Math.floor(s.t), s.env.horizonDay));

function scienceOnDay(s: OpsState, day: number): boolean {
  const ph = s.env.days[day]?.phase;
  return ph === 'science' || (ph === 'extended' && s.extension !== undefined && day <= s.extension.endDay);
}

const sum = (d: Loads) => d.bus + d.heaters + d.instruments + d.radio;

/** Science data a full day makes with the plan in force (bits/day). */
function sciencePerDay(s: OpsState): number {
  const lost = new Set(s.instrumentsLost);
  return s.env.loads.instruments.reduce((a, i) => a + (lost.has(i.id) ? 0 : Math.max(0, Math.min(1, s.plan.instruments[i.id] ?? 0)) * i.data_bitsPerDay), 0);
}

function upcomingConjunction(s: OpsState): ConjunctionWindow | undefined {
  return s.env.conjunctions.find((w) => w.startDay > s.t);
}

function chipFor(s: OpsState, alert: ConsoleAlert | undefined, science: ConsoleScience, blackout: ConsoleBlackout): ConsoleChip {
  if (s.status === 'not-launched') return 'not-launched';
  if (s.status === 'lost') return 'lost';
  if (s.status === 'complete') return 'complete';
  if (s.status === 'awaiting-extension') return 'decision';
  if (alert) return 'hazard';
  if (blackout.active) return 'blackout';
  if (science.paused && science.cause === 'safe-mode') return 'safe-mode';
  if (blackout.upcoming?.soon) return 'conjunction-soon';
  return 'nominal';
}

function nextMilestone(s: OpsState): ConsoleClock['next'] {
  const day = dayOf(s);
  const env = s.env;
  if (day < env.arrivalDay) return { kind: 'arrival', day: env.arrivalDay, inDays: env.arrivalDay - day };
  if (day <= env.primeEndDay) return { kind: 'prime-end', day: env.primeEndDay, inDays: env.primeEndDay - day };
  if (s.extension && day <= s.extension.endDay) return { kind: 'extension-end', day: s.extension.endDay, inDays: s.extension.endDay - day };
  return undefined;
}

function gauges(s: OpsState): ConsoleGauges {
  const env = s.env;
  const day = dayOf(s);
  const e = env.days[day]!;
  const ev = env.ev;

  // Power today with the plan in force (spec: Mission operations, Power).
  const want = demand(env, e, s.plan, { scienceOn: scienceOnDay(s, day), lost: s.instrumentsLost });
  const required = sum(want);
  const pMargin = powerMarginNow(s);
  const power = {
    used: required,
    limit: e.available_W,
    margin: pMargin,
    status: marginStatus(pMargin),
    fill: clamp01(e.available_W > 0 ? (e.available_W - required) / e.available_W : 0),
    equation: 'margin = (P_avail − P_req) / P_req,  P_avail = min(P_gen (1 − f_ecl), E_batt / t_ecl)',
    inputs: {
      available_W: derived(e.available_W, 'W', 'power available today after eclipses and the battery limit'),
      generation_W: derived(e.generation_W, 'W', 'array or RTG output at today’s Sun distance and age'),
      required_W: derived(required, 'W', 'bus + engine + heaters + instruments + radio with the plan in force'),
      eclipseFraction: derived(e.eclipseFraction, 'fraction of the day', 'time in the planet’s shadow today'),
      battery_Wh: derived(env.battery_Wh, 'Wh', 'battery sized for the worst eclipse (Power meter)'),
    },
    eclipseFraction: e.eclipseFraction,
    inEclipseSeason: env.eclipseSeasons.some((x) => x.startDay <= day && day <= x.endDay),
  };

  // Δv: what the tank can still give against what the plan still needs (rocket equation at the current mass).
  const left = deltaVLeft_ms(s);
  const need = deltaVStillNeeded_ms(s);
  const loaded = ev.details.propellant_kg;
  const propLeft = s.mass_kg - env.dryMass_kg;
  const propNeed = need > 0 ? propellantBurned(s.mass_kg, Math.min(need, left), env.isp_s) : 0;
  const fMargin = need > 0 ? (left - need) / need : Infinity;
  const fuel = {
    used: need,
    limit: left,
    margin: fMargin,
    status: marginStatus(fMargin),
    fill: clamp01(loaded > 0 ? propLeft / loaded : 0),
    mark: clamp01(loaded > 0 ? propNeed / loaded : 0),
    equation: 'Δv_left = Isp · g₀ · ln(m / m_dry)',
    inputs: {
      isp_s: derived(env.isp_s, 's', 'engine specific impulse'),
      g0: G0,
      mass_kg: derived(s.mass_kg, 'kg', 'craft mass now'),
      dryMass_kg: derived(env.dryMass_kg, 'kg', 'dry mass'),
      deltaVNeeded_ms: derived(need, 'm/s', 'planned burns still to make + the lifetime reserve'),
    },
    propellantLeft_kg: propLeft,
    propellantNeeded_kg: propNeed,
  };

  // Recorder: data waiting for a pass (spec: Data and the DSN).
  const cap = OPERATIONS.recorder.capacity_Gbit.value * 1e9;
  const last = s.ledger[s.ledger.length - 1];
  const produced = last?.produced_bits ?? 0;
  const down = last?.downlinked_bits ?? 0;
  const net = produced - down;
  const rMargin = (cap - s.recorder_bits) / cap;
  const recorder = {
    used: s.recorder_bits,
    limit: cap,
    margin: rMargin,
    status: marginStatus(rMargin),
    fill: clamp01(s.recorder_bits / cap),
    equation: 'recorder = stored + produced − downlinked  (≤ recorder size)',
    inputs: {
      recorder_bits: derived(s.recorder_bits, 'bit', 'science data waiting on board'),
      capacity_bits: sourced(cap, 'bit', OPERATIONS.recorder.capacity_Gbit.source, { isGameEstimate: OPERATIONS.recorder.capacity_Gbit.isGameEstimate }),
      producedLastDay_bits: derived(produced, 'bit', 'science data produced on the last full day'),
      downlinkedLastDay_bits: derived(down, 'bit', 'data sent home on the last full day'),
    },
    photosWaiting: photosOf(s.recorder_bits),
    producedToday_bits: produced,
    downlinkedToday_bits: down,
    ...(net > 0 ? { daysToFull: (cap - s.recorder_bits) / net } : {}),
  };

  // Budget reserve: (cap − development) − extras (the crisis-card convention).
  const reserve = ev.details.cost.cap_M - ev.details.cost.development_M;
  const spare = spareNow(s).budget_M;
  const extras = s.dsnExtra_M + s.responseBudget_M;
  const bMargin = reserve > 0 ? spare / reserve : spare >= 0 ? 0 : -1;
  const budget = {
    used: extras,
    limit: reserve,
    margin: bMargin,
    status: marginStatus(bMargin),
    fill: clamp01(reserve > 0 ? spare / reserve : 0),
    equation: 'spare = (cap − development) − DSN extras − response costs',
    inputs: {
      cap_M: derived(ev.details.cost.cap_M, '$M (FY2019)', 'the mission class cost cap'),
      development_M: derived(ev.details.cost.development_M, '$M (FY2019)', 'development cost (Budget meter)'),
      dsnExtra_M: derived(s.dsnExtra_M, '$M', 'DSN passes booked beyond the daily one'),
      responses_M: derived(s.responseBudget_M, '$M', 'hazard responses paid so far'),
    },
    spare_M: spare,
    spareCoins: spare > 0 ? coins(spare, ev.details.cost.cap_M) : 0,
    operations_M: s.opsCost_M,
  };
  return { power, fuel, recorder, budget };
}

function blackoutView(s: OpsState): ConsoleBlackout {
  const env = s.env;
  if (inMoratorium(env, s.t)) {
    const day = dayOf(s);
    const w = env.conjunctions.find((c) => c.startDay <= day && day <= c.endDay);
    const retry = moratoriumEndDay(env, s.t);
    return w
      ? { active: true, window: w, dayOf: day - w.startDay + 1, total: w.endDay - w.startDay + 1, endDay: w.endDay, retryAfterDay: retry, daysLeft: retry - day }
      : { active: true, retryAfterDay: retry };
  }
  const w = upcomingConjunction(s);
  return w ? { active: false, upcoming: { window: w, inDays: w.startDay - dayOf(s), lastSendDay: w.startDay - 1, length_days: w.endDay - w.startDay + 1, soon: w.startDay - dayOf(s) <= CONSOLE_RULES.conjunctionWarning_days.value } } : { active: false };
}

function scienceView(s: OpsState): ConsoleScience {
  const paused = s.t < s.pausedUntil && scienceOnDay(s, dayOf(s));
  const safe = [...s.events].reverse().find((e) => e.code === 'safe-mode');
  const cause = paused ? (safe && Number(safe.values.until) >= s.pausedUntil - 1e-9 ? 'safe-mode' : 'response') : undefined;
  const lost = new Set(s.instrumentsLost);
  const live = s.env.loads.instruments.filter((i) => !lost.has(i.id));
  const off = paused ? live.map((i) => i.id) : live.filter((i) => (s.plan.instruments[i.id] ?? 0) <= 0).map((i) => i.id);
  return { paused, ...(cause ? { cause, resumesAt: s.pausedUntil } : {}), instrumentsLost: [...s.instrumentsLost], instrumentsOff: off };
}

export function riskLevel(failureChance: number): number {
  return 1 + CONSOLE_RULES.riskLevelBounds.value.filter((b) => failureChance > b).length;
}

function alertView(s: OpsState): ConsoleAlert | undefined {
  if (s.status !== 'flying') return undefined;
  const dec = s.decisions.find((d) => d.kind === 'hazard' && !d.commanded);
  if (!dec) return undefined;
  const rec = s.hazards.find((h) => h.id === dec.hazardId)!;
  const h = HAZARDS[rec.type]!;
  const spare = spareNow(s);
  const offered = dec.hazardOptions ?? [];
  const sendAt = Math.max(s.t, dec.earliestSend);
  const arrivesIfSent = commandArrival(s.env, sendAt);
  const blockedByConjunction = inMoratorium(s.env, sendAt);
  const standingOrder = s.standingOrders[rec.type];
  const fb = defaultResponse(offered.length ? offered : h.options, standingOrder, s.env.design.kit?.autopilot);
  const offeredIds = new Set(offered.map((o) => o.id));
  // Packed protections (Signal Delay kit) scale the failure chance; the data value is kept when there are none.
  const chance = (o: (typeof h.options)[number]): Sourced<number> => {
    const v = effectiveFailureChance(s.env.design, rec.type, o.failureChance.value);
    return v === o.failureChance.value ? o.failureChance : derived(v, o.failureChance.unit, `${o.failureChance.source} × the packed protection`);
  };
  return {
    decisionId: dec.id,
    hazardId: rec.id,
    type: rec.type,
    title: h.title,
    prompt: h.prompt,
    realHistory: h.realHistory,
    ...(rec.real ? { real: rec.real, realSource: stormSourced(rec.real) } : {}),
    detectedBy: h.detectedBy,
    onset: rec.onset,
    knownAt: rec.knownAt,
    deadline: rec.deadline,
    earliestSend: dec.earliestSend,
    sendAt,
    arrivesIfSent,
    oneWay_s: oneWayAt(s.env, sendAt),
    lateIfSent: arrivesIfSent > rec.deadline,
    blockedByConjunction,
    ...(blockedByConjunction ? { retryAfterDay: moratoriumEndDay(s.env, sendAt) } : {}),
    fallback: { optionId: fb.option.id, by: fb.by },
    ...(standingOrder !== undefined ? { standingOrder } : {}),
    options: h.options.map((o) => {
      // What was offered when Earth learned of it decides the card; the live blockers explain the ones left out.
      const blockedBy = offeredIds.has(o.id) ? [] : optionBlockers(o, spare, s.oneTimeUsed);
      return {
        id: o.id,
        label: o.label,
        cost: o.cost,
        ...(o.requires ? { requires: o.requires } : {}),
        oneTime: o.oneTime ?? false,
        failureChance: chance(o),
        riskLevel: riskLevel(chance(o).value),
        failureEffect: o.failureEffect,
        affordable: offeredIds.has(o.id),
        blockedBy: offeredIds.has(o.id) ? [] : blockedBy.length ? blockedBy : ['one-time'],
        isSafest: o.id === dec.safestOptionId,
        isFree: isFree(o),
        isFallback: o.id === fb.option.id,
        fuel_kg: o.cost.deltaV_ms?.value ? propellantBurned(s.mass_kg, o.cost.deltaV_ms.value, s.env.isp_s) : 0,
        coins: o.cost.budget_M?.value ? coins(o.cost.budget_M.value, s.env.ev.details.cost.cap_M) : 0,
        photosLost: photosOf((o.cost.scienceDays?.value ?? 0) * sciencePerDay(s)),
      };
    }),
  };
}

function lastOutcomeView(s: OpsState): ConsoleOutcome | undefined {
  const ev = [...s.events].reverse().find((e) => e.code === 'response-outcome');
  if (!ev) return undefined;
  const rec = s.hazards.find((h) => h.id === ev.values.hazardId)!;
  const h = HAZARDS[rec.type]!;
  const o = h.options.find((x) => x.id === ev.values.optionId)!;
  return {
    hazardId: rec.id,
    type: rec.type,
    title: h.title,
    optionId: o.id,
    label: o.label,
    by: rec.choice?.by ?? 'player',
    bad: ev.values.bad === true,
    failureEffect: o.failureEffect,
    t: ev.t,
    scienceDaysLost: o.cost.scienceDays?.value ?? 0,
    budget_M: o.cost.budget_M?.value ?? 0,
    coins: o.cost.budget_M?.value ? coins(o.cost.budget_M.value, s.env.ev.details.cost.cap_M) : 0,
    deltaV_ms: o.cost.deltaV_ms?.value ?? 0,
  };
}

function commandsView(s: OpsState): ConsoleCommand[] {
  return s.commands.map((c) => {
    const span = c.arrivesAt - c.sentAt;
    const progress = c.status !== 'in-flight' ? 1 : span > 0 ? clamp01((s.t - c.sentAt) / span) : 1;
    return {
      id: c.id,
      kind: c.command.kind,
      ...(c.command.kind === 'respond' ? { hazardId: c.command.hazardId, optionId: c.command.optionId } : {}),
      sentAt: c.sentAt,
      arrivesAt: c.arrivesAt,
      progress,
      timeLeft_s: c.status === 'in-flight' ? Math.max(0, (c.arrivesAt - s.t) * DAY_S) : 0,
      departsIn_s: c.status === 'in-flight' ? Math.max(0, (c.sentAt - s.t) * DAY_S) : 0,
      status: c.status,
    };
  });
}

function timelineView(s: OpsState): ConsoleTimeline {
  const env = s.env;
  const span = CONSOLE_RULES.timelineWindow_days.value;
  const from = dayOf(s);
  const to = from + span;
  const at = (d: number) => clamp01((d - from) / span);
  const day = from;
  const bands: TimelineBand[] = [];
  for (const w of env.conjunctions) {
    if (w.endDay + 1 <= from || w.startDay >= to) continue;
    const a = Math.max(w.startDay, from);
    const z = Math.min(w.endDay + 1, to);
    bands.push({ kind: 'conjunction', startDay: w.startDay, endDay: w.endDay, left: at(a), width: at(z) - at(a), active: w.startDay <= day && day <= w.endDay, minAngle_deg: w.minAngle_deg });
  }
  for (const e of env.eclipseSeasons) {
    if (e.endDay + 1 <= from || e.startDay >= to) continue;
    const a = Math.max(e.startDay, from);
    const z = Math.min(e.endDay + 1, to);
    bands.push({ kind: 'eclipse', startDay: e.startDay, endDay: e.endDay, left: at(a), width: at(z) - at(a), active: e.startDay <= day && day <= e.endDay, longestEclipse_s: e.longestEclipse_s });
  }

  const events: TimelineEvent[] = [];
  const inWindow = (d: number) => d > from && d < to;
  for (const b of env.burns.slice(s.burnsDone)) {
    if (b.kind === 'maintenance' || !inWindow(b.day)) continue;
    events.push({ kind: 'burn', day: b.day, left: at(b.day), burnKind: b.kind, dv_ms: b.dv_ms });
  }
  for (const w of env.timeline) if (inWindow(w.startDay) && w.phase !== 'launch') events.push({ kind: 'phase', day: w.startDay, left: at(w.startDay), phase: w.phase });
  // Passes worth marking: extra bookings, and the last pass before / first pass after each moratorium.
  const standard = defaultBooking(env.design);
  for (const [k, b] of Object.entries(s.dsn)) {
    const d = Number(k);
    if (inWindow(d) && (b.dish !== standard.dish || b.hours !== standard.hours)) events.push({ kind: 'dsn', day: d, left: at(d), dish: b.dish, hours: b.hours });
  }
  for (const w of env.conjunctions) {
    const before = w.startDay - 1;
    const after = w.endDay + 1;
    const pass = (d: number, flag: 'lastBeforeBlackout' | 'firstAfterBlackout') => {
      if (!inWindow(d)) return;
      const b = bookingFor(s, d);
      const existing = events.find((x) => x.kind === 'dsn' && x.day === d);
      if (existing) existing[flag] = true;
      else events.push({ kind: 'dsn', day: d, left: at(d), dish: b.dish, hours: b.hours, [flag]: true });
    };
    pass(before, 'lastBeforeBlackout');
    pass(after, 'firstAfterBlackout');
  }
  // The first day a new booking can still be made (ground lead time), skipping moratorium days.
  let slot = day + OPERATIONS.dsn.bookingLead_days.value;
  while (env.days[slot]?.conjunction) slot++;
  if (s.status === 'flying' && inWindow(slot) && slot <= env.horizonDay && !events.some((x) => x.kind === 'dsn' && x.day === slot)) events.push({ kind: 'open-slot', day: slot, left: at(slot) });
  events.sort((a, b) => a.day - b.day);

  const ahead =
    env.arrivalDay >= to
      ? { kind: 'arrival' as const, day: env.arrivalDay, inDays: env.arrivalDay - day }
      : env.primeEndDay >= to
        ? { kind: 'prime-end' as const, day: env.primeEndDay, inDays: env.primeEndDay - day }
        : undefined;
  const step = span / 12;
  const ticks: { day: number; left: number }[] = [];
  for (let d = Math.ceil((from + step / 2) / step) * step; d < to; d += step) ticks.push({ day: d, left: at(d) });
  return { from, to, days: span, ticks, bands, events, ...(ahead ? { ahead } : {}) };
}

function signalFor(s: OpsState): SignalState {
  if (s.status === 'not-launched' || s.status === 'lost') return 'none';
  if (inMoratorium(s.env, s.t)) return 'blocked';
  if (s.commands.some((c) => c.status === 'in-flight')) return 'uplink';
  return s.plan.radio ? 'downlink' : 'none';
}

// ---------------------------------------------------------------------------
// Public API

/** Everything the Operations Console shows, from the state alone. */
export function consoleView(s: OpsState): OpsConsoleView {
  const env = s.env;
  const day = dayOf(s);
  const e = env.days[day]!;
  const alert = alertView(s);
  const science = scienceView(s);
  const blackout = blackoutView(s);
  const extDec = s.decisions.find((d) => d.id === 'extension');
  const next = nextMilestone(s);
  const tMap = Math.min(s.t, env.horizonDay);
  const lastOutcome = lastOutcomeView(s);
  return {
    clock: {
      t: s.t,
      day,
      date: e.date,
      phase: e.phase,
      status: s.status,
      oneWay_s: oneWayAt(env, s.t),
      earthDistance_m: e.earthDistance_m,
      sunDistance_m: e.sunDistance_m,
      ...(e.sepAngle_deg !== undefined ? { sepAngle_deg: e.sepAngle_deg } : {}),
      chip: chipFor(s, alert, science, blackout),
      ...(next ? { next } : {}),
    },
    map: { frame: frameOnDay(env.design, tMap, env.ev), trail: trailTo(env.design, tMap, env.ev), signal: signalFor(s) },
    gauges: gauges(s),
    timeline: timelineView(s),
    ...(alert ? { alert } : {}),
    ...(lastOutcome ? { lastOutcome } : {}),
    commands: commandsView(s),
    blackout,
    science,
    ...(extDec ? { extension: { options: extDec.extensionOptions ?? [], decided: extDec.commanded, ...(s.extension ? { chosen: s.extension } : {}) } } : {}),
    feed: s.events.slice(-CONSOLE_RULES.feedLength.value).reverse(),
  };
}

export interface PowerPlanPreview {
  plan: PowerPlan;
  today: { available_W: number; demand: Loads; required_W: number; margin: number; status: MeterStatus };
  /** The coming (or current) eclipse season: battery depth of discharge in its longest eclipse with this plan. */
  eclipse?: { season: EclipseSeason; load_W: number; depthOfDischarge: number; limit: number; margin: number; lowestCharge: number; lowestAllowedCharge: number; status: MeterStatus };
  science_bitsPerDay: number;
  sciencePhotosPerDay: number;
  downlink_bitsPerDay: number;
  /** Heaters below the day's need: hardware hazards run faster (k_cold). */
  cold: boolean;
  /** Wattage split for the dial: the most each slice can take, and what this plan gives it. */
  split: { bus_W: number; scienceMax_W: number; science_W: number; heatersMax_W: number; heaters_W: number; radio_W: number; radioMax_W: number };
  equation: string;
  inputs: Record<string, Sourced<number>>;
}

/** What a power plan would do: today's margin, the eclipse battery depth of discharge, science and downlink. */
export function powerPlanPreview(s: OpsState, plan: PowerPlan): PowerPlanPreview {
  const env = s.env;
  const day = dayOf(s);
  const e = env.days[day]!;
  const sciOn = scienceOnDay(s, day) && s.t >= s.pausedUntil;
  const d = demand(env, e, plan, { scienceOn: scienceOnDay(s, day), lost: s.instrumentsLost });
  const required = sum(d);
  const margin = (e.available_W - required) / required;
  const lost = new Set(s.instrumentsLost);
  const live = env.loads.instruments.filter((i) => !lost.has(i.id));
  const duty = (id: string) => Math.max(0, Math.min(1, plan.instruments[id] ?? 0));
  const science = sciOn ? live.reduce((a, i) => a + duty(i.id) * i.data_bitsPerDay, 0) : 0;
  const downlink = plan.radio ? downlinkCapacity_bitsPerDay(e, bookingFor(s, day)) : 0;
  const limit = PARTS.power.batteryMaxDepthOfDischarge.value;
  const season = env.eclipseSeasons.find((x) => x.endDay >= day);
  let eclipse: PowerPlanPreview['eclipse'];
  if (season) {
    const sd = env.days[Math.max(season.startDay, day)]!;
    const load = sum(demand(env, sd, plan, { scienceOn: scienceOnDay(s, sd.day), lost: s.instrumentsLost }));
    const dod = env.battery_Wh > 0 ? (load * season.longestEclipse_s) / (env.battery_Wh * 3600) : Infinity;
    const m = (limit - dod) / limit;
    eclipse = { season, load_W: load, depthOfDischarge: dod, limit, margin: m, lowestCharge: 1 - dod, lowestAllowedCharge: 1 - limit, status: marginStatus(m) };
  }
  const scienceMax = live.reduce((a, i) => a + i.power_W, 0);
  return {
    plan,
    today: { available_W: e.available_W, demand: d, required_W: required, margin, status: marginStatus(margin) },
    ...(eclipse ? { eclipse } : {}),
    science_bitsPerDay: science,
    sciencePhotosPerDay: photosOf(science),
    downlink_bitsPerDay: downlink,
    cold: plan.heaters < 1 - 1e-9 && e.heaterNeed_W > 0,
    split: {
      bus_W: env.loads.bus_W,
      scienceMax_W: scienceMax,
      science_W: d.instruments,
      heatersMax_W: e.heaterNeed_W,
      heaters_W: d.heaters,
      radio_W: d.radio,
      radioMax_W: env.loads.radio_W,
    },
    equation: 'DoD = (P_bus + P_sci + P_heat + P_radio) · t_ecl / E_batt',
    inputs: {
      available_W: derived(e.available_W, 'W', 'power available today'),
      required_W: derived(required, 'W', 'what this plan asks for today'),
      ...(eclipse
        ? {
            longestEclipse_s: derived(eclipse.season.longestEclipse_s, 's', 'longest eclipse of the season'),
            battery_Wh: derived(env.battery_Wh, 'Wh', 'battery capacity'),
            depthOfDischarge: derived(eclipse.depthOfDischarge, 'fraction', 'battery used in the longest eclipse'),
          }
        : {}),
      maxDepthOfDischarge: PARTS.power.batteryMaxDepthOfDischarge,
    },
  };
}

export interface DsnChoice {
  dish: 34 | 70;
  hours: number;
  rate_bps: number;
  data_bits: number;
  photos: number;
  extraCost_M: number;
  extraCoins: number;
  isStandard: boolean;
  booked: boolean;
}

export interface DsnOptionsView {
  earliestDay: number;
  day: number;
  conjunction: boolean;
  options: DsnChoice[];
  refused?: { reason: 'lead-time' | 'out-of-range' | 'conjunction'; retryAfterDay?: number };
}

/** The two dishes for a pass on a day (default: the first day a booking can still be made). */
export function dsnOptions(s: OpsState, requestedDay?: number): DsnOptionsView {
  const env = s.env;
  const earliestDay = Math.floor(s.t) + OPERATIONS.dsn.bookingLead_days.value;
  const day = Math.min(env.horizonDay, requestedDay ?? earliestDay);
  const e = env.days[Math.max(0, day)]!;
  const standard = defaultBooking(env.design);
  const current = bookingFor(s, day);
  const options = ([34, 70] as const).map((dish): DsnChoice => {
    const b: DsnBooking = { dish, hours: standard.hours };
    const data = downlinkCapacity_bitsPerDay(e, b);
    const extra = dsnExtraCost_M(b, standard);
    return {
      dish,
      hours: b.hours,
      rate_bps: dish === 70 ? e.rate70_bps : e.rate34_bps,
      data_bits: data,
      photos: photosOf(data),
      extraCost_M: extra,
      extraCoins: extra > 0 ? coins(extra, env.ev.details.cost.cap_M) : 0,
      isStandard: dish === standard.dish,
      booked: current.dish === dish && current.hours === b.hours,
    };
  });
  let refused: DsnOptionsView['refused'];
  if (day < earliestDay) refused = { reason: 'lead-time', retryAfterDay: earliestDay };
  else if (day > env.horizonDay) refused = { reason: 'out-of-range' };
  else if (e.conjunction) refused = { reason: 'conjunction', retryAfterDay: moratoriumEndDay(env, day) };
  return { earliestDay, day, conjunction: e.conjunction, options, ...(refused ? { refused } : {}) };
}

/**
 * The next moment worth stopping the clock for: a command arriving, a phase, a planned burn (not daily upkeep),
 * a conjunction warning or edge, an eclipse season start, science resuming, the end of the prime mission. Hazards Earth has not
 * seen yet are never included (advanceOperations stops on its own when one becomes known).
 */
export function nextEventT(s: OpsState): number {
  const env = s.env;
  let next = Infinity;
  const after = (x: number | undefined) => {
    if (x !== undefined && x > s.t + 1e-9 && x < next) next = x;
  };
  for (const c of s.commands) if (c.status === 'in-flight') after(c.arrivesAt);
  for (const b of env.burns.slice(s.burnsDone)) if (b.kind !== 'maintenance') after(b.day);
  for (const w of env.timeline) after(w.startDay);
  for (const w of env.conjunctions) {
    // The warning comes first, so commands can still be queued before the Sun blocks the radio.
    after(w.startDay - CONSOLE_RULES.conjunctionWarning_days.value);
    after(w.startDay);
    after(w.endDay + 1);
  }
  for (const e of env.eclipseSeasons) after(e.startDay);
  after(s.pausedUntil);
  after(env.primeEndDay + 1);
  if (s.extension) after(s.extension.endDay + 1);
  return Math.min(next, env.horizonDay + 1);
}

/** Can this design be flown in Operations? Only if it can launch (no blockers). */
export function opsAvailable(design: Design, ev: FullEvaluation = evaluateDesign(design)): boolean {
  return ev.blockers.length === 0;
}
