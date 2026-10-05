// Mission operations: public API (spec: Mission operations). Every function takes a state and returns a new one;
// the input is never changed. A mission is a function of (design, seed, actions): replayOperations rebuilds it.
// Every player action is logged, refused ones too, because a refusal is itself an event.
import type { Phase } from '../risk';
import { budgetScore, marginBandScore, missionSuccessScore, nextStar, scienceGoal_Gbit, scienceScore, STAR_RULES, stars, totalScore, type Category } from '../scoring';
import { crisisScore } from '../crisis';
import { DESTINATIONS, HAZARDS, OPERATIONS } from '../data';
import type { Design } from '../types';
import { END_MISSION } from './extension';
import { defaultBooking, defaultPowerPlan, demand } from './resources';
import {
  cloneState,
  decideExtension,
  deltaVLeft_ms,
  drawRandom,
  newState,
  prepareOps,
  primeScienceFraction,
  queueCommand,
  simulate,
} from './timeline';
import type {
  Command,
  CommandReceipt,
  ConjunctionWindow,
  Decision,
  DsnBooking,
  EclipseSeason,
  ExtensionOption,
  OpsAction,
  OpsEnvironment,
  OpsEvent,
  OpsPhase,
  OpsState,
  PowerPlan,
} from './types';

export interface StartOptions {
  seed?: number;
  /** Replace every random stream with one function (tests: () => 0.999999 means "no bad luck"). */
  rng?: () => number;
  plan?: PowerPlan;
  /** Hazard type → option id: what the craft does if no command arrives in time. */
  standingOrders?: Record<string, string>;
  /** Reuse an environment already prepared for this design (Monte Carlo). */
  env?: OpsEnvironment;
}

/** Day 0, before launch. The random draws are all made here. */
export function startOperations(design: Design, opts: StartOptions = {}): OpsState {
  const env = opts.env ?? prepareOps(design);
  return newState(env, drawRandom(env, opts), { seed: opts.seed, plan: opts.plan, standingOrders: opts.standingOrders });
}

/** Run the clock for some days, to a time, or until the player has a new decision (state.newDecisions). */
export function advanceOperations(state: OpsState, opts: { days?: number; until?: number } = {}): OpsState {
  const s = cloneState(state);
  s.newDecisions = [];
  const tStop = opts.until ?? (opts.days !== undefined ? s.t + opts.days : Infinity);
  simulate(s, tStop);
  return s;
}

/** Send a command now. It reaches the craft one light time later; refused in a conjunction moratorium. */
export function sendCommand(state: OpsState, command: Command): { state: OpsState; receipt: CommandReceipt } {
  const s = cloneState(state);
  const receipt = queueCommand(s, command, s.t);
  s.actions.push({ t: state.t, kind: 'command', command });
  return { state: s, receipt };
}

/**
 * Answer a decision. A hazard response is a command, sent once the team has reacted (or now, if later); the
 * extension is a ground decision and takes effect at once.
 */
export function decide(state: OpsState, decisionId: string, optionId: string): { state: OpsState; receipt: CommandReceipt } {
  const s = cloneState(state);
  const dec = s.decisions.find((d) => d.id === decisionId);
  let receipt: CommandReceipt;
  if (!dec) receipt = { accepted: false, sentAt: s.t, reason: 'unknown-decision' };
  else if (dec.commanded) receipt = { accepted: false, sentAt: s.t, reason: 'already-commanded' };
  else if (dec.kind === 'extension') receipt = decideExtension(s, optionId);
  else if (!dec.hazardOptions!.some((o) => o.id === optionId)) receipt = { accepted: false, sentAt: s.t, reason: 'unknown-option' };
  else {
    receipt = queueCommand(s, { kind: 'respond', hazardId: dec.hazardId!, optionId }, Math.max(s.t, dec.earliestSend));
    if (receipt.accepted) dec.commanded = true;
  }
  s.actions.push({ t: state.t, kind: 'decide', decisionId, optionId });
  return { state: s, receipt };
}

/** Book DSN passes for whole days. Ground-side (no light delay), but it must be made a lead time ahead. */
export function bookDsn(state: OpsState, fromDay: number, toDay: number, booking: DsnBooking): { state: OpsState; receipt: CommandReceipt } {
  const s = cloneState(state);
  const first = Math.floor(s.t) + OPERATIONS.dsn.bookingLead_days.value;
  let receipt: CommandReceipt;
  if (fromDay < first) receipt = { accepted: false, sentAt: s.t, reason: 'lead-time', retryAfterDay: first };
  else if (toDay < fromDay || toDay > s.env.horizonDay) receipt = { accepted: false, sentAt: s.t, reason: 'out-of-range' };
  else {
    for (let d = fromDay; d <= toDay; d++) s.dsn[d] = { ...booking };
    s.events.push({ t: s.t, code: 'dsn-booked', values: { fromDay, toDay, dish: booking.dish, hours: booking.hours } });
    receipt = { accepted: true, sentAt: s.t, arrivesAt: s.t };
  }
  if (!receipt.accepted) s.events.push({ t: s.t, code: 'dsn-refused', values: { reason: receipt.reason ?? '' } });
  s.actions.push({ t: state.t, kind: 'dsn', fromDay, toDay, booking });
  return { state: s, receipt };
}

/** Decisions still waiting for an answer. */
export function openDecisions(state: OpsState): Decision[] {
  return state.decisions.filter((d) => !d.commanded);
}

// ---------------------------------------------------------------------------
// Headless runs and replays

export type HazardPolicy = 'safe' | 'risky' | 'default' | ((decision: Decision, state: OpsState) => string | undefined);
export type ExtensionPolicy = 'end' | 'shortest' | 'longest' | ((options: ExtensionOption[], state: OpsState) => string);

function pickHazard(policy: HazardPolicy, d: Decision, s: OpsState): string | undefined {
  if (policy === 'default') return undefined;
  if (policy === 'safe') return d.safestOptionId;
  if (policy === 'risky') return d.hazardOptions!.reduce((a, b) => (b.failureChance.value > a.failureChance.value ? b : a)).id;
  return policy(d, s);
}

function pickExtension(policy: ExtensionPolicy, options: ExtensionOption[], s: OpsState): string {
  const ok = options.filter((o) => o.blockedBy.length === 0);
  if (typeof policy === 'function') return policy(ok, s);
  const ext = ok.filter((o) => o.id !== END_MISSION).sort((a, b) => a.years - b.years);
  if (policy === 'end' || ext.length === 0) return END_MISSION;
  return (policy === 'shortest' ? ext[0] : ext[ext.length - 1])!.id;
}

/** Fly a whole mission with a policy for every decision (tests, Monte Carlo). Reproducible for a seed. */
export function runOperations(
  design: Design,
  opts: StartOptions & { policy?: HazardPolicy; extension?: ExtensionPolicy } = {},
): { state: OpsState; debrief: OpsDebrief } {
  const s = finishOperations(startOperations(design, opts), { policy: opts.policy ?? 'safe', extension: opts.extension ?? 'end' });
  return { state: s, debrief: operationsDebrief(s) };
}

/**
 * Fly on from any state to the end of the mission (complete or lost), answering each new decision with a policy.
 * By default the craft handles every open hazard itself (standing order or fault protection at the deadline) and
 * the mission ends at the extension decision: the player's "finish mission", so a flight always reaches the report.
 */
export function finishOperations(state: OpsState, opts: { policy?: HazardPolicy; extension?: ExtensionPolicy } = {}): OpsState {
  const policy = opts.policy ?? 'default';
  let s = state;
  for (let i = 0; s.status === 'flying' || s.status === 'awaiting-extension'; i++) {
    if (i > 100_000) throw new Error('finishOperations did not finish');
    if (s.status === 'awaiting-extension') {
      const dec = s.decisions.find((d) => d.id === 'extension')!;
      s = decide(s, 'extension', pickExtension(opts.extension ?? 'end', dec.extensionOptions!, s)).state;
      continue;
    }
    const t0 = s.t;
    s = advanceOperations(s);
    for (const id of s.newDecisions) {
      const dec = s.decisions.find((d) => d.id === id)!;
      if (dec.kind !== 'hazard' || dec.commanded) continue;
      const choice = pickHazard(policy, dec, s);
      if (choice !== undefined) s = decide(s, id, choice).state;
    }
    // The clock's horizon was reached while still flying: nothing more can happen, so the mission is over.
    if (s.status === 'flying' && s.t <= t0 && s.newDecisions.length === 0) {
      s = { ...s, status: 'complete', events: [...s.events, { t: s.t, code: 'mission-complete', values: {} }] };
    }
  }
  return s;
}

/**
 * Rebuild a mission from its seed and action log (save/load). With `until`, stop at that mission time (resume a
 * session where it was left) instead of flying on to the end.
 */
export function replayOperations(design: Design, opts: StartOptions, actions: OpsAction[], until?: number): OpsState {
  let s = startOperations(design, opts);
  for (const a of actions) {
    while ((s.status === 'flying' || s.status === 'awaiting-extension') && s.t < a.t) {
      if (s.status === 'awaiting-extension') break;
      s = advanceOperations(s, { until: a.t });
    }
    if (a.kind === 'command') s = sendCommand(s, a.command).state;
    else if (a.kind === 'decide') s = decide(s, a.decisionId, a.optionId).state;
    else s = bookDsn(s, a.fromDay, a.toDay, a.booking).state;
  }
  if (until !== undefined) {
    while (s.status === 'flying' && s.t < until - 1e-12) s = advanceOperations(s, { until });
    return s;
  }
  while (s.status === 'flying') s = advanceOperations(s);
  return s;
}

// ---------------------------------------------------------------------------
// Forecast (events known in advance) and Debrief

export interface OperationsForecast {
  conjunctions: ConjunctionWindow[];
  eclipseSeasons: EclipseSeason[];
  /** Jupiter: dose rate in the science orbit and the days the dose reaches 50%, 75%, 100% of the tolerance. */
  dose?: { ratePerDay_rad: number; tolerance_rad: number; milestones: { fraction: number; day: number; date: string }[] };
  events: OpsEvent[];
}

/** Everything the player can see coming, from geometry alone (no random draws). */
export function operationsForecast(design: Design, env: OpsEnvironment = prepareOps(design)): OperationsForecast {
  const events: OpsEvent[] = [];
  for (const c of env.conjunctions) {
    events.push({ t: c.startDay, code: 'conjunction-start', values: { endDay: c.endDay, minAngle_deg: c.minAngle_deg, date: c.startDate } });
    events.push({ t: c.endDay + 1, code: 'conjunction-end', values: { date: c.endDate } });
  }
  for (const e of env.eclipseSeasons) {
    events.push({ t: e.startDay, code: 'eclipse-season-start', values: { endDay: e.endDay, longestEclipse_s: e.longestEclipse_s, date: e.startDate } });
    events.push({ t: e.endDay + 1, code: 'eclipse-season-end', values: { date: e.endDate } });
  }
  const rad = DESTINATIONS[design.destination].radiation;
  let dose: OperationsForecast['dose'];
  const rate = Math.max(...env.days.map((d) => d.doseRate_radPerDay));
  if (rad && rate > 0) {
    const milestones: { fraction: number; day: number; date: string }[] = [];
    let total = 0;
    const fractions = [0.5, 0.75, 1];
    for (const d of env.days) {
      total += d.doseRate_radPerDay;
      while (fractions.length && total >= fractions[0]! * rad.tolerance_rad.value) {
        const f = fractions.shift()!;
        milestones.push({ fraction: f, day: d.day, date: d.date });
        events.push({ t: d.day, code: 'dose-milestone', values: { fraction: f, date: d.date } });
      }
    }
    dose = { ratePerDay_rad: rate, tolerance_rad: rad.tolerance_rad.value, milestones };
  }
  events.sort((a, b) => a.t - b.t);
  return { conjunctions: env.conjunctions, eclipseSeasons: env.eclipseSeasons, ...(dose ? { dose } : {}), events };
}

export interface ExtensionReport {
  /** 'not-offered': not an orbiter, or the prime mission did not end; 'declined': the mission ended at prime. */
  outcome: 'not-offered' | 'pending' | 'declined' | 'flying' | 'completed' | 'lost';
  optionId?: string;
  years?: number;
  daysFlown: number;
  downlinked_Gbit: number;
  cost_M: number;
}

export interface OpsDebrief {
  status: OpsState['status'];
  launched: boolean;
  /** The prime mission (every phase of the timeline) was completed. */
  completed: boolean;
  phasesCompleted: number;
  totalPhases: number;
  failedPhase?: OpsPhase;
  failureDay?: number;
  scienceDaysAchieved: number;
  plannedScienceDays: number;
  goal_Gbit: number;
  downlinked_Gbit: number;
  lostData_Gbit: number;
  radioLimited: boolean;
  hazards: { id: string; type: string; title: string; onsetDay: number; optionId?: string; by?: string; choseSafest?: boolean; badOutcome?: boolean }[];
  budget: { development_M: number; cap_M: number; operations_M: number; dsnExtra_M: number; responses_M: number };
  deltaV: { left_ms: number; responses_ms: number };
  endMargins: { deltaV: number; power: number; mass: number };
  scores: Record<Category, number>;
  score: number;
  breakdown: ReturnType<typeof totalScore>['breakdown'];
  stars: number;
  hint: string;
  hintCategory?: Category;
  extension: ExtensionReport;
}

/** Prime-mission Debrief with the Scoring section's rules; the extension is reported separately (decision #27). */
export function operationsDebrief(s: OpsState): OpsDebrief {
  const env = s.env;
  const ev = env.ev;
  const d = ev.details;
  const tl = env.timeline;
  const sci = tl.find((w) => w.phase === 'science')!;
  const plannedScienceDays = sci.endDay - sci.startDay + 1;
  const goal_Gbit = scienceGoal_Gbit(env.loads.instruments.reduce((a, i) => a + i.data_bitsPerDay, 0), plannedScienceDays);
  const lostInPrime = s.status === 'lost' && s.failedPhase !== 'extended';
  const cutoff = lostInPrime ? Math.floor(s.failureT ?? 0) : s.ledger.length;
  const phasesCompleted = s.status === 'not-launched' ? 0 : tl.filter((w) => w.endDay < cutoff).length;
  const primeDone = phasesCompleted === tl.length;
  const downlinked_Gbit = s.downlinkedPrime_bits / 1e9;

  // End-of-prime margins: Δv after response burns; power on the worst day of the prime mission, eclipses included
  // (the Power meter, which reads these same days); mass at launch.
  const dvMargin = (d.deltaVCapability_ms - s.dvResponses_ms - d.deltaVRequired_ms) / d.deltaVRequired_ms;
  const endMargins = { deltaV: dvMargin, power: ev.meters.power.margin, mass: ev.meters.mass.margin };

  // Prime mission only: hazards that struck after the prime mission belong to the extension's report.
  const answered = s.hazards.filter((h) => h.choice && h.offered && HAZARDS[h.type]!.options.length > 0 && h.onset < env.primeEndDay + 1);
  const crisis = answered.length
    ? answered.reduce((a, h) => a + crisisScore(h.choice!.choseSafest, h.choice!.badOutcome ?? false), 0) / answered.length
    : 100;
  const sciScore = scienceScore(downlinked_Gbit, goal_Gbit);
  const scores: Record<Category, number> = {
    science: sciScore,
    success: missionSuccessScore(phasesCompleted, tl.length),
    budget: budgetScore(d.cost.development_M + s.dsnExtra_M + s.responseBudget_M, d.cost.cap_M),
    deltaV: marginBandScore(endMargins.deltaV),
    power: marginBandScore(endMargins.power),
    mass: marginBandScore(endMargins.mass),
    crisis,
  };
  const t = totalScore(scores);
  const launched = s.status !== 'not-launched' && !(s.status === 'lost' && s.failureT === 0);
  const reachedScience = launched && phasesCompleted >= STAR_RULES.phasesToReachScience.value;
  const st = stars({ reachedScience, scienceScore: sciScore, margins: endMargins });
  const failedPrime: Phase | undefined = lostInPrime && s.failedPhase !== 'extended' ? (s.failedPhase as Phase) : undefined;
  const next = nextStar({
    stars: st,
    failedPhase: failedPrime,
    blockers: ev.blockers,
    radioLimited: s.radioLimited,
    scienceScore: sciScore,
    margins: endMargins,
    deltaV: { required_ms: d.deltaVRequired_ms, capability_ms: d.deltaVCapability_ms, isp_s: d.isp_s, dry_kg: d.dryMass_kg, propellant_kg: d.propellant_kg, asFlown: d.asFlown },
    launch: { capacity_kg: d.launchCapacity_kg, wet_kg: d.wetMass_kg },
    power: { available_W: d.power.worstDay.available_W, required_W: d.power.worstDay.required_W, type: env.design.power.type, arrayArea_m2: env.design.power.arrayArea_m2 },
  });

  let extension: ExtensionReport;
  const extDays = s.extension ? s.ledger.filter((r) => r.phase === 'extended').length : 0;
  const base = { daysFlown: extDays, downlinked_Gbit: s.downlinkedExtension_bits / 1e9, cost_M: s.extensionCost_M };
  if (!env.extensible || !primeDone) extension = { outcome: 'not-offered', ...base };
  else if (s.status === 'awaiting-extension') extension = { outcome: 'pending', ...base };
  else if (!s.extension) extension = { outcome: 'declined', ...base };
  else {
    const outcome = s.status === 'lost' ? 'lost' : s.status === 'complete' ? 'completed' : 'flying';
    extension = { outcome, optionId: s.extension.optionId, years: s.extension.years, ...base };
  }

  return {
    status: s.status,
    launched,
    completed: primeDone,
    phasesCompleted,
    totalPhases: tl.length,
    ...(lostInPrime ? { failedPhase: s.failedPhase, failureDay: Math.floor(s.failureT ?? 0) } : {}),
    scienceDaysAchieved: s.scienceDaysAchieved,
    plannedScienceDays,
    goal_Gbit,
    downlinked_Gbit,
    lostData_Gbit: s.lost_bits / 1e9,
    radioLimited: s.radioLimited,
    hazards: s.hazards.map((h) => ({
      id: h.id,
      type: h.type,
      title: HAZARDS[h.type]!.title,
      onsetDay: Math.floor(h.onset),
      ...(h.choice ? { optionId: h.choice.optionId, by: h.choice.by, choseSafest: h.choice.choseSafest } : {}),
      ...(h.choice?.badOutcome !== undefined ? { badOutcome: h.choice.badOutcome } : {}),
    })),
    budget: { development_M: d.cost.development_M, cap_M: d.cost.cap_M, operations_M: s.opsCost_M, dsnExtra_M: s.dsnExtra_M, responses_M: s.responseBudget_M },
    deltaV: { left_ms: deltaVLeft_ms(s), responses_ms: s.dvResponses_ms },
    endMargins,
    scores,
    score: t.total,
    breakdown: t.breakdown,
    stars: st,
    hint: next.hint,
    ...(next.category ? { hintCategory: next.category } : {}),
    extension,
  };
}

export { defaultBooking, defaultPowerPlan, prepareOps, primeScienceFraction };
export { consoleView, dsnOptions, nextEventT, opsAvailable, powerPlanPreview, CONSOLE_RULES } from './console';
export type * from './console';
export { comingUp, eclipseCard, flyCard, flyTiles, FLY_RULES, missionProgress, outcomeIn_s, segmentsFromFraction, segmentsFromMargin, stormFront, systemsHealth } from './fly';
export type * from './fly';
export { heardMessages, robotMessages, VOICE_RULES } from './voice';
export type * from './voice';
export type * from './types';
