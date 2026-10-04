// The mission clock (spec: Mission operations, "Mission clock"). prepareOps builds the fixed environment, which no
// player choice changes, once per design. The clock moves in whole days, but every event has an exact time, so
// commands that arrive part-way through a day split it into segments and power and data are counted per segment.
import { AU_M, G0, GAME_RULES, km } from '../constants';
import { lightDelay_s, dataRate } from '../comms';
import { phaseOnDay, timeline, type PhaseWindow } from '../crisis';
import { DESTINATIONS, HAZARDS, lookup, OPERATIONS, PARTS, type HazardOption, type OpsPhase } from '../data';
import { earthDistance, heliocentricPosition, julianDate, sunDistance } from '../ephemeris';
import { craftPosition, signalDelay } from '../flightMap';
import { evaluateDesign, type FullEvaluation } from '../index';
import { powerOnDay } from '../power';
import { propellantBurned } from '../propulsion';
import type { Design, Vec3 } from '../types';
import { commandArrival, inMoratorium, moratoriumEndDay, newsArrival } from './commands';
import { END_MISSION, extensionOptions } from './extension';
import {
  eclipse,
  isoDate,
  orbitDoseRate_radPerDay,
  scienceOrbitGeometry,
  solarLongitude,
  sunDirection,
  sunEarthProbeAngle,
} from './predictable';
import {
  debrisRate_perDay,
  drawCandidates,
  dustStormRate_perDay,
  insertionAnomalyChance,
  memoryRate_perDay,
  solarActivity,
  stormRate_perDay,
  stormRateMax_perDay,
  subRng,
  wheelHazard_perYear,
} from './random';
import { defaultBooking, defaultPowerPlan, demand, downlinkCapacity_bitsPerDay, dsnExtraCost_M, shedLoads } from './resources';
import { affordableResponses, defaultResponse, safestResponse, type Spare } from './responses';
import type {
  Command,
  CommandReceipt,
  ConjunctionWindow,
  Decision,
  DsnBooking,
  EclipseSeason,
  EnvDay,
  EventValues,
  HazardRecord,
  OpsDay,
  OpsEnvironment,
  OpsEventCode,
  OpsState,
  PlannedBurn,
  RandomDraws,
  ResponseSource,
} from './types';

const EPS = 1e-9;
const YEAR = 365.25;

// ---------------------------------------------------------------------------
// The fixed environment

function runs<T>(days: EnvDay[], test: (d: EnvDay) => boolean, make: (from: number, to: number) => T): T[] {
  const out: T[] = [];
  let start: number | undefined;
  for (let i = 0; i <= days.length; i++) {
    const on = i < days.length && test(days[i]!);
    if (on && start === undefined) start = i;
    if (!on && start !== undefined) {
      out.push(make(start, i - 1));
      start = undefined;
    }
  }
  return out;
}

/** Planned burns from the Δv budget, on the day each happens (spec: Mission operations, "Propellant"). */
function plannedBurns(design: Design, ev: FullEvaluation, tl: PhaseWindow[], jdLaunch: number): PlannedBurn[] {
  const b = ev.details.deltaVBudget;
  const arrival = tl.find((w) => w.phase === 'arrival')!.startDay;
  const science = tl.find((w) => w.phase === 'science')!;
  const burns: PlannedBurn[] = [];
  const fractions = OPERATIONS.trajectoryCorrections.cruiseFractions.value;
  for (const f of fractions) {
    const day = Math.min(Math.max(1, arrival - 1), Math.max(1, Math.round(f * ev.trajectory.flightDays)));
    burns.push({ day, dv_ms: b.trajectoryCorrections_ms / fractions.length, kind: 'trajectory-correction' });
  }
  if (b.other_ms > 0) {
    const route = design.trajectoryOption && design.trajectoryOption !== 'direct' ? DESTINATIONS[design.destination].fixedRoutes?.[design.trajectoryOption] : undefined;
    const day = route ? Math.round(julianDate(route.dsmDate.value) - jdLaunch) : 1;
    burns.push({ day: Math.max(1, Math.min(arrival - 1, day)), dv_ms: b.other_ms, kind: 'route-manoeuvre' });
  }
  burns.push({ day: arrival, dv_ms: b.arrival_ms + b.orbitTransfer_ms, kind: 'arrival' });
  const n = science.endDay - science.startDay + 1;
  for (let d = science.startDay; d <= science.endDay; d++) burns.push({ day: d, dv_ms: b.maintenance_ms / n, kind: 'maintenance' });
  return burns.sort((x, y) => x.day - y.day);
}

/**
 * Everything about the mission that no player choice changes, day by day: distances, light time, the
 * Sun–Earth–probe angle, eclipses, power available, link rates, radiation dose, solar activity and Mars Ls.
 */
export function prepareOps(design: Design): OpsEnvironment {
  const ev = evaluateDesign(design);
  const dest = DESTINATIONS[design.destination];
  const jdLaunch = julianDate(ev.details.launchDate);
  const tl = timeline({
    flightDays: ev.trajectory.flightDays,
    scienceDays: ev.details.scienceDays,
    returnDays: ev.details.sampleReturn ? Math.round(ev.trajectory.flightDays) : undefined,
  });
  const arrivalDay = tl.find((w) => w.phase === 'arrival')!.startDay;
  const primeEndDay = tl[tl.length - 1]!.endDay;
  const extensible = dest.missionType === 'orbiter';
  const longestExtension = Math.max(...OPERATIONS.extension.optionYears.value);
  const horizonDay = extensible ? primeEndDay + Math.round(longestExtension * YEAR) : primeEndDay;

  const bus = lookup(PARTS.buses, design.busId, 'bus');
  const engine = lookup(PARTS.engines, design.engineId, 'engine');
  const instruments = design.instrumentIds.map((id) => ({ id, ...lookup(PARTS.instruments, id, 'instrument') }));
  const radio_W = design.comms.txPower_W / PARTS.comms.dcToRfEfficiency.value;
  const bus_W = bus.power_W.value + engine.power_W.value;
  const baseRequired_W = bus_W + radio_W + instruments.reduce((s, i) => s + i.power_W.value, 0);
  const battery_Wh = ev.details.massBreakdown.battery * PARTS.power.batterySpecificEnergy_Wh_per_kg.value;
  const orbit = scienceOrbitGeometry(design, jdLaunch + arrivalDay);
  const doseRate = orbit ? orbitDoseRate_radPerDay(design.destination, orbit) : 0;
  const threshold = OPERATIONS.conjunction.commandThreshold_deg.value;

  const days: EnvDay[] = [];
  for (let day = 0; day <= horizonDay; day++) {
    const jd = jdLaunch + day;
    const phase: OpsPhase = phaseOnDay(tl, day) ?? 'extended';
    const atDestination = day >= arrivalDay && phase !== 'return';
    const earthDistance_m = atDestination ? earthDistance(design.destination, jd) : signalDelay(design, day, ev).distance_m;
    let rCraft: Vec3 | undefined;
    let sunDistance_m: number;
    if (design.destination === 'moon') {
      sunDistance_m = sunDistance('earth', jd);
    } else if (atDestination) {
      rCraft = heliocentricPosition(design.destination, jd);
      sunDistance_m = Math.hypot(...rCraft);
    } else {
      const xy = craftPosition(design, day, ev);
      rCraft = [xy[0], xy[1], 0];
      sunDistance_m = Math.hypot(xy[0], xy[1]);
    }
    // Near Earth (launch, early cruise) the Sun is never behind the craft: no angle is reported.
    const sepAngle_deg = rCraft && earthDistance_m > 5e9 ? sunEarthProbeAngle(heliocentricPosition('earth', jd), rCraft) : undefined;
    const p = powerOnDay(design, jd, day / YEAR, baseRequired_W, bus.heaterBase_W.value, sunDistance_m);
    const inOrbit = orbit && (phase === 'science' || phase === 'extended');
    const ecl = inOrbit ? eclipse(orbit, sunDirection(design.destination, jd)) : { fraction: 0, longest_s: 0 };
    const available_W =
      design.power.type === 'solar'
        ? Math.min(p.available_W * (1 - ecl.fraction), ecl.longest_s > 0 ? battery_Wh / (ecl.longest_s / 3600) : Infinity)
        : p.available_W;
    const link = (dish: 34 | 70) => dataRate({ ...design.comms, groundDish_m: dish, distance_m: earthDistance_m });
    days.push({
      day,
      jd,
      date: isoDate(jd),
      phase,
      sunDistance_m,
      earthDistance_m,
      oneWay_s: lightDelay_s(earthDistance_m),
      ...(sepAngle_deg !== undefined ? { sepAngle_deg } : {}),
      conjunction: sepAngle_deg !== undefined && sepAngle_deg < threshold,
      eclipseFraction: ecl.fraction,
      longestEclipse_s: ecl.longest_s,
      generation_W: p.available_W,
      available_W,
      heaterNeed_W: p.heaters_W,
      rate34_bps: link(34),
      rate70_bps: link(70),
      doseRate_radPerDay: inOrbit ? doseRate : 0,
      solarActivity: solarActivity(jd),
      ...(design.destination === 'mars' ? { ls_deg: solarLongitude('mars', jd) } : {}),
    });
  }

  const conjunctions = runs(days, (d) => d.conjunction, (from, to): ConjunctionWindow => {
    const slice = days.slice(from, to + 1);
    const min = slice.reduce((a, b) => ((b.sepAngle_deg ?? 180) < (a.sepAngle_deg ?? 180) ? b : a));
    return { startDay: from, endDay: to, minDay: min.day, minAngle_deg: min.sepAngle_deg ?? 0, startDate: days[from]!.date, endDate: days[to]!.date };
  });
  const eclipseSeasons = runs(days, (d) => d.eclipseFraction > 0, (from, to): EclipseSeason => {
    const slice = days.slice(from, to + 1);
    return {
      startDay: from,
      endDay: to,
      longestEclipse_s: Math.max(...slice.map((d) => d.longestEclipse_s)),
      maxFraction: Math.max(...slice.map((d) => d.eclipseFraction)),
      startDate: days[from]!.date,
      endDate: days[to]!.date,
    };
  });

  return {
    design,
    ev,
    jdLaunch,
    timeline: tl,
    arrivalDay,
    primeEndDay,
    horizonDay,
    extensible,
    days,
    burns: plannedBurns(design, ev, tl, jdLaunch),
    conjunctions,
    eclipseSeasons,
    loads: {
      bus_W,
      radio_W,
      heaterBase_W: bus.heaterBase_W.value,
      instruments: instruments.map((i) => ({ id: i.id, power_W: i.power_W.value, data_bitsPerDay: i.data_Mbit_per_day.value * 1e6 })),
    },
    battery_Wh,
    dryMass_kg: ev.details.dryMass_kg,
    isp_s: ev.details.isp_s,
    lifetimeReserve_ms: ev.details.deltaVBudget.lifetimeReserve_ms,
    maintenancePerDay_ms: GAME_RULES.orbitMaintenance_msPerYear.value / YEAR,
  };
}

// ---------------------------------------------------------------------------
// Random draws (spec: determinism)

/** Hazards drawn from rate streams; the insertion anomaly is judged once on the arrival day. */
export const STREAM_HAZARDS = Object.keys(HAZARDS).filter((id) => id !== 'insertion-anomaly');

function boundRate(env: OpsEnvironment, type: string): number {
  const h = HAZARDS[type]!;
  if (!h.destinations.includes(env.design.destination)) return 0;
  const o = OPERATIONS;
  const kCold = o.power.coldHazardFactor.value;
  switch (type) {
    case 'solar-storm': {
      const rMin = Math.min(...env.days.map((d) => d.sunDistance_m));
      return stormRateMax_perDay() * (AU_M / rMin) ** o.spaceWeather.distanceExponent.value;
    }
    case 'mars-dust-storm':
      return dustStormRate_perDay(270);
    case 'debris':
      return debrisRate_perDay();
    case 'reaction-wheel':
      return (o.reactionWheels.installed.value * wheelHazard_perYear((env.horizonDay + 1) / YEAR) * kCold) / YEAR;
    case 'memory-corruption': {
      const maxDose = Math.max(...env.days.map((d) => d.doseRate_radPerDay));
      return memoryRate_perDay({ stormActive: true, doseRate_radPerDay: maxDose, cold: true });
    }
    case 'radiation-damage':
      return DESTINATIONS[env.design.destination].radiation?.lossRateAfterTolerance_perDay.value ?? 0;
    default:
      return 0;
  }
}

export function drawRandom(env: OpsEnvironment, opts: { seed?: number; rng?: () => number }): RandomDraws {
  const seed = opts.seed ?? 1;
  const stream = (name: string) => opts.rng ?? subRng(seed, name);
  const launch = stream('launch')();
  const ins = stream('insertion-anomaly');
  const insertion = { uAccept: ins(), uOutcome: ins() };
  const candidates: RandomDraws['candidates'] = {};
  for (const type of STREAM_HAZARDS) {
    const bound = boundRate(env, type);
    candidates[type] = { bound_perDay: bound, list: drawCandidates(stream(type), bound, env.horizonDay + 1) };
  }
  return { launch, insertion, candidates };
}

// ---------------------------------------------------------------------------
// State

function emptyDay(env: OpsEnvironment, day: number): OpsDay {
  const e = env.days[Math.min(day, env.days.length - 1)]!;
  return {
    day,
    date: e.date,
    phase: e.phase,
    conjunction: e.conjunction,
    eclipseFraction: e.eclipseFraction,
    available_W: e.available_W,
    demand_W: { bus: 0, heaters: 0, instruments: 0, radio: 0 },
    served_W: { bus: 0, heaters: 0, instruments: 0, radio: 0 },
    cold: false,
    brownout: false,
    produced_bits: 0,
    downlinked_bits: 0,
    lost_bits: 0,
    recorder_bits: 0,
    dv_ms: 0,
    propellant_kg: 0,
    propellantLeft_kg: 0,
    cost_M: 0,
    dose_rad: 0,
    scienceActive: 0,
  };
}

export function newState(
  env: OpsEnvironment,
  draws: RandomDraws,
  opts: { seed?: number; plan?: OpsState['plan']; standingOrders?: Record<string, string> },
): OpsState {
  const launched = env.ev.blockers.length === 0;
  return {
    env,
    draws,
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    t: 0,
    startedDay: -1,
    status: launched ? 'flying' : 'not-launched',
    mass_kg: env.ev.details.wetMass_kg,
    burnsDone: 0,
    dvPlannedSpent_ms: 0,
    dvResponses_ms: 0,
    dvExtensionResponses_ms: 0,
    opsCost_M: 0,
    dsnExtra_M: 0,
    responseBudget_M: 0,
    extensionCost_M: 0,
    recorder_bits: 0,
    produced_bits: 0,
    downlinkedPrime_bits: 0,
    downlinkedExtension_bits: 0,
    lost_bits: 0,
    radioLimited: false,
    scienceDaysAchieved: 0,
    pausedUntil: 0,
    instrumentsLost: [],
    wheelsWorking: OPERATIONS.reactionWheels.installed.value,
    attitude: 'wheels',
    oneTimeUsed: [],
    dose_rad: 0,
    coldDays: 0,
    brownoutStreak: 0,
    plan: opts.plan ?? defaultPowerPlan(env),
    dsn: {},
    standingOrders: { ...(opts.standingOrders ?? {}) },
    cursors: Object.fromEntries(STREAM_HAZARDS.map((h) => [h, 0])),
    hazards: [],
    decisions: [],
    commands: [],
    actions: [],
    ledger: [],
    today: emptyDay(env, 0),
    events: [],
    extensionDecided: false,
    newDecisions: [],
  };
}

/** A copy safe to change: arrays and the records the clock updates are copied; env and draws are shared. */
export function cloneState(s: OpsState): OpsState {
  return {
    ...s,
    instrumentsLost: [...s.instrumentsLost],
    oneTimeUsed: [...s.oneTimeUsed],
    plan: { ...s.plan, instruments: { ...s.plan.instruments } },
    dsn: { ...s.dsn },
    standingOrders: { ...s.standingOrders },
    cursors: { ...s.cursors },
    hazards: s.hazards.map((h) => ({ ...h, ...(h.choice ? { choice: { ...h.choice } } : {}) })),
    decisions: s.decisions.map((d) => ({ ...d })),
    commands: s.commands.map((c) => ({ ...c })),
    actions: [...s.actions],
    ledger: [...s.ledger],
    today: { ...s.today, demand_W: { ...s.today.demand_W }, served_W: { ...s.today.served_W } },
    events: [...s.events],
    ...(s.extension ? { extension: { ...s.extension } } : {}),
    newDecisions: [...s.newDecisions],
  };
}

const emit = (s: OpsState, t: number, code: OpsEventCode, values: EventValues = {}) => {
  s.events.push({ t, code, values });
};

// ---------------------------------------------------------------------------
// Resources and margins

export function deltaVLeft_ms(s: OpsState): number {
  return s.env.isp_s * G0.value * Math.log(s.mass_kg / s.env.dryMass_kg);
}

/** Δv the plan still needs: planned burns not yet made, plus the lifetime reserve (or the extension's upkeep). */
export function deltaVStillNeeded_ms(s: OpsState): number {
  const planned = s.env.burns.slice(s.burnsDone).reduce((a, b) => a + b.dv_ms, 0);
  if (s.extension) return planned + s.env.maintenancePerDay_ms * Math.max(0, s.extension.endDay - Math.max(s.startedDay, s.env.primeEndDay));
  return planned + s.env.lifetimeReserve_ms;
}

const isExtended = (s: OpsState, day: number) => s.env.days[day]?.phase === 'extended';

export function bookingFor(s: OpsState, day: number): DsnBooking {
  return s.dsn[day] ?? defaultBooking(s.env.design);
}

function scienceOn(s: OpsState, day: number): boolean {
  const ph = s.env.days[day]?.phase;
  return ph === 'science' || (ph === 'extended' && s.extension !== undefined && day <= s.extension.endDay);
}

/** Today's power margin with the current plan: (available − demand)/demand. */
export function powerMarginNow(s: OpsState): number {
  const day = Math.min(Math.floor(s.t), s.env.horizonDay);
  const e = s.env.days[day]!;
  const d = demand(s.env, e, s.plan, { scienceOn: scienceOn(s, day), lost: s.instrumentsLost });
  const total = d.bus + d.heaters + d.instruments + d.radio;
  return (e.available_W - total) / total;
}

export function spareNow(s: OpsState): Spare {
  const d = s.env.ev.details;
  const day = Math.floor(s.t);
  const sciEnd = isExtended(s, day) && s.extension ? s.extension.endDay : s.env.timeline.find((w) => w.phase === 'science')!.endDay;
  return {
    deltaV_ms: deltaVLeft_ms(s) - deltaVStillNeeded_ms(s),
    budget_M: d.cost.cap_M - d.cost.development_M - s.dsnExtra_M - s.responseBudget_M,
    powerMargin: powerMarginNow(s),
    scienceDays: Math.max(0, sciEnd - Math.max(day, s.pausedUntil)),
  };
}

function burn(s: OpsState, dv_ms: number, kind: string): boolean {
  if (dv_ms <= 0) return true;
  if (dv_ms > deltaVLeft_ms(s) + 1e-9) {
    emit(s, s.t, 'out-of-propellant', { kind, dv_ms, left_ms: deltaVLeft_ms(s) });
    lose(s, s.t);
    return false;
  }
  const prop = propellantBurned(s.mass_kg, dv_ms, s.env.isp_s);
  s.mass_kg -= prop;
  s.today.dv_ms += dv_ms;
  s.today.propellant_kg += prop;
  emit(s, s.t, 'burn', { kind, dv_ms, propellant_kg: prop });
  return true;
}

function lose(s: OpsState, t: number) {
  if (s.status === 'lost') return;
  s.status = 'lost';
  s.failureT = t;
  s.failedPhase = s.env.days[Math.min(Math.floor(t), s.env.horizonDay)]!.phase;
  emit(s, t, 'craft-lost', { phase: s.failedPhase });
  for (const d of s.decisions) d.commanded = true;
}

// ---------------------------------------------------------------------------
// Hazards

function stormActiveAt(s: OpsState, t: number): boolean {
  return s.hazards.some((h) => h.type === 'solar-storm' && h.onset <= t && t < h.endsAt);
}

/** λ(t, state) for a hazard whose candidate is judged at t (per day). */
function hazardRate(s: OpsState, type: string, t: number): number {
  const h = HAZARDS[type]!;
  const env = s.env;
  const onset = h.detectedBy === 'earth' ? t + h.warningLead_days.value : t;
  const e = env.days[Math.floor(onset)];
  if (!e || !h.destinations.includes(env.design.destination) || !h.phases.includes(e.phase)) return 0;
  if (e.phase === 'extended' && (!s.extension || onset > s.extension.endDay + 1)) return 0;
  const kCold = s.today.cold ? OPERATIONS.power.coldHazardFactor.value : 1;
  switch (type) {
    case 'solar-storm':
      return stormRate_perDay(e.jd, e.sunDistance_m);
    case 'mars-dust-storm':
      return e.ls_deg === undefined ? 0 : dustStormRate_perDay(e.ls_deg);
    case 'debris':
      return debrisRate_perDay();
    case 'reaction-wheel':
      return s.attitude === 'wheels' && s.wheelsWorking > 0 ? (s.wheelsWorking * wheelHazard_perYear(onset / YEAR) * kCold) / YEAR : 0;
    case 'memory-corruption':
      return memoryRate_perDay({ stormActive: stormActiveAt(s, onset), doseRate_radPerDay: e.doseRate_radPerDay, cold: s.today.cold });
    case 'radiation-damage': {
      const tol = DESTINATIONS[env.design.destination].radiation?.tolerance_rad.value ?? Infinity;
      return s.dose_rad >= tol ? boundRate(env, type) : 0;
    }
    default:
      return 0;
  }
}

function createHazard(s: OpsState, type: string, t: number, uOutcome: number) {
  const h = HAZARDS[type]!;
  const n = s.hazards.filter((x) => x.type === type).length + 1;
  const onset = h.detectedBy === 'earth' ? t + h.warningLead_days.value : t;
  const knownAt = h.detectedBy === 'earth' ? t : newsArrival(s.env, onset);
  const rec: HazardRecord = {
    id: `${type}-${n}`,
    type,
    onset,
    knownAt,
    deadline: onset + h.deadline_days.value,
    endsAt: onset + h.duration_days.value,
    uOutcome,
    status: 'pending',
    onsetDone: false,
    knownDone: false,
    endDone: false,
    outcomeDone: false,
  };
  s.hazards.push(rec);
  if (h.detectedBy === 'earth') emit(s, t, 'hazard-warning', { hazardId: rec.id, type, onsetAt: onset });
}

function onset(s: OpsState, rec: HazardRecord) {
  rec.onsetDone = true;
  const h = HAZARDS[rec.type]!;
  emit(s, rec.onset, 'hazard-onset', { hazardId: rec.id, type: rec.type });
  if (rec.type === 'reaction-wheel') {
    s.wheelsWorking = Math.max(0, s.wheelsWorking - 1);
    if (s.wheelsWorking >= OPERATIONS.reactionWheels.needed.value) {
      rec.status = 'resolved';
      rec.knownDone = true;
      rec.outcomeDone = true;
      emit(s, rec.onset, 'wheel-spare-took-over', { hazardId: rec.id, wheelsWorking: s.wheelsWorking });
    }
  }
  if (h.options.length === 0) {
    rec.status = 'resolved';
    rec.knownDone = true;
    rec.outcomeDone = true;
    lose(s, rec.onset);
  }
}

function openHazardDecision(s: OpsState, rec: HazardRecord, t: number) {
  rec.knownDone = true;
  if (rec.status === 'resolved') return;
  emit(s, t, 'hazard-known', { hazardId: rec.id, type: rec.type });
  const h = HAZARDS[rec.type]!;
  const offered = affordableResponses(h.options, spareNow(s), s.oneTimeUsed);
  rec.offered = offered.map((o) => o.id);
  rec.status = 'open';
  const decision: Decision = {
    id: rec.id,
    kind: 'hazard',
    hazardId: rec.id,
    openedAt: t,
    earliestSend: t + OPERATIONS.team.reaction_h.value / 24,
    deadline: rec.deadline,
    hazardOptions: offered,
    safestOptionId: safestResponse(offered).id,
    commanded: false,
  };
  s.decisions.push(decision);
  s.newDecisions.push(decision.id);
  emit(s, t, 'decision-open', { decisionId: decision.id, deadline: rec.deadline });
}

function executeResponse(s: OpsState, rec: HazardRecord, option: HazardOption, by: ResponseSource, t: number) {
  const h = HAZARDS[rec.type]!;
  let chosen = option;
  let source = by;
  const nowAffordable = affordableResponses(h.options, spareNow(s), s.oneTimeUsed);
  if (!nowAffordable.some((o) => o.id === chosen.id)) {
    emit(s, t, 'response-unaffordable', { hazardId: rec.id, optionId: chosen.id });
    const def = defaultResponse(nowAffordable, s.standingOrders[rec.type]);
    chosen = def.option;
    source = def.by;
  }
  const offeredIds = rec.offered ?? nowAffordable.map((o) => o.id);
  const offered = h.options.filter((o) => offeredIds.includes(o.id));
  rec.choice = { optionId: chosen.id, by: source, executedAt: t, choseSafest: chosen.id === safestResponse(offered.length ? offered : nowAffordable).id };
  rec.status = 'resolved';
  rec.resolveAt = Math.max(t, rec.onset);
  const dec = s.decisions.find((d) => d.id === rec.id);
  if (dec) dec.commanded = true;
  if (chosen.oneTime) s.oneTimeUsed.push(chosen.id);
  const budget = chosen.cost.budget_M?.value ?? 0;
  if (budget > 0) {
    if (isExtended(s, Math.floor(t))) s.extensionCost_M += budget;
    else s.responseBudget_M += budget;
    s.today.cost_M += budget;
  }
  const days = chosen.cost.scienceDays?.value ?? 0;
  if (days > 0) s.pausedUntil = Math.max(s.pausedUntil, rec.resolveAt) + days;
  if (rec.type === 'reaction-wheel') s.attitude = chosen.id === 'thrusters' ? 'thrusters' : chosen.id === 'hybrid' ? 'hybrid' : 'degraded';
  const dv = chosen.cost.deltaV_ms?.value ?? 0;
  emit(s, t, 'command-executed', { hazardId: rec.id, optionId: chosen.id, by: source });
  if (dv > 0 && burn(s, dv, 'response')) {
    if (isExtended(s, Math.floor(t))) s.dvExtensionResponses_ms += dv;
    else s.dvResponses_ms += dv;
  }
}

function resolveOutcome(s: OpsState, rec: HazardRecord, t: number) {
  rec.outcomeDone = true;
  if (!rec.choice) return;
  const option = HAZARDS[rec.type]!.options.find((o) => o.id === rec.choice!.optionId)!;
  const bad = rec.uOutcome < option.failureChance.value;
  rec.choice.badOutcome = bad;
  emit(s, t, 'response-outcome', { hazardId: rec.id, optionId: option.id, bad });
  if (!bad) return;
  switch (option.failureEffect) {
    case 'craft':
      lose(s, t);
      break;
    case 'instrument': {
      const live = s.env.loads.instruments.filter((i) => !s.instrumentsLost.includes(i.id));
      const worst = live.reduce<(typeof live)[number] | undefined>((a, b) => (!a || b.data_bitsPerDay > a.data_bitsPerDay ? b : a), undefined);
      if (worst) {
        s.instrumentsLost.push(worst.id);
        emit(s, t, 'instrument-lost', { instrumentId: worst.id });
      }
      break;
    }
    case 'stored-data':
      s.lost_bits += s.recorder_bits;
      s.today.lost_bits += s.recorder_bits;
      emit(s, t, 'stored-data-lost', { bits: s.recorder_bits });
      s.recorder_bits = 0;
      break;
    case 'safe-mode':
      s.pausedUntil = Math.max(s.pausedUntil, t) + OPERATIONS.safeMode.days.value;
      emit(s, t, 'safe-mode', { until: s.pausedUntil });
      break;
  }
}

function applyDeadline(s: OpsState, rec: HazardRecord, t: number) {
  const h = HAZARDS[rec.type]!;
  const offered = affordableResponses(h.options, spareNow(s), s.oneTimeUsed);
  const def = defaultResponse(offered, s.standingOrders[rec.type]);
  if (!rec.offered) rec.offered = offered.map((o) => o.id);
  emit(s, t, 'deadline-missed', { hazardId: rec.id, optionId: def.option.id, by: def.by });
  executeResponse(s, rec, def.option, def.by, t);
}

// ---------------------------------------------------------------------------
// Commands

function executeCommand(s: OpsState, cmd: Command, t: number, id: number) {
  const rec = s.commands.find((c) => c.id === id)!;
  if (cmd.kind === 'power-plan' || cmd.kind === 'standing-orders') {
    if (cmd.kind === 'power-plan') s.plan = { ...cmd.plan, instruments: { ...cmd.plan.instruments } };
    else s.standingOrders = { ...cmd.orders };
    rec.status = 'executed';
    emit(s, t, 'command-executed', { commandId: id, kind: cmd.kind });
    return;
  }
  const hz = s.hazards.find((h) => h.id === cmd.hazardId);
  if (!hz || hz.status === 'resolved') {
    rec.status = 'too-late';
    emit(s, t, 'command-too-late', { commandId: id, hazardId: cmd.hazardId });
    return;
  }
  rec.status = 'executed';
  const option = HAZARDS[hz.type]!.options.find((o) => o.id === cmd.optionId)!;
  executeResponse(s, hz, option, 'player', t);
}

/** Queue a command on the uplink at sentAt (≥ now). Refused in a moratorium or when the craft is not flying. */
export function queueCommand(s: OpsState, command: Command, sentAt: number): CommandReceipt {
  if (s.status !== 'flying') return { accepted: false, sentAt, reason: 'not-flying' };
  if (inMoratorium(s.env, sentAt)) {
    emit(s, s.t, 'command-refused', { reason: 'conjunction', retryAfterDay: moratoriumEndDay(s.env, sentAt) });
    return { accepted: false, sentAt, reason: 'conjunction', retryAfterDay: moratoriumEndDay(s.env, sentAt) };
  }
  const arrivesAt = commandArrival(s.env, sentAt);
  const id = s.commands.length + 1;
  s.commands.push({ id, sentAt, arrivesAt, command, status: 'in-flight' });
  emit(s, sentAt, 'command-sent', { commandId: id, kind: command.kind, arrivesAt });
  return { accepted: true, sentAt, arrivesAt };
}

// ---------------------------------------------------------------------------
// Extension

function openExtensionDecision(s: OpsState, t: number) {
  s.status = 'awaiting-extension';
  const options = extensionOptions(s.env, {
    deltaVLeft_ms: deltaVLeft_ms(s),
    dose_rad: s.dose_rad,
    attitudeOk: s.attitude !== 'degraded' && (s.attitude !== 'wheels' || s.wheelsWorking >= OPERATIONS.reactionWheels.needed.value),
    primeScienceFraction: primeScienceFraction(s),
    instrumentsLost: s.instrumentsLost,
  });
  s.decisions.push({ id: 'extension', kind: 'extension', openedAt: t, earliestSend: t, extensionOptions: options, commanded: false });
  s.newDecisions.push('extension');
  emit(s, t, 'decision-open', { decisionId: 'extension' });
}

export function primeScienceFraction(s: OpsState): number {
  const sci = s.env.timeline.find((w) => w.phase === 'science')!;
  const goal = s.env.loads.instruments.reduce((a, i) => a + i.data_bitsPerDay, 0) * (sci.endDay - sci.startDay + 1);
  return goal > 0 ? s.downlinkedPrime_bits / goal : 0;
}

/** A ground decision, effective at once: end the mission or extend it. */
export function decideExtension(s: OpsState, optionId: string): CommandReceipt {
  const dec = s.decisions.find((d) => d.id === 'extension');
  if (!dec || dec.commanded || s.status !== 'awaiting-extension') return { accepted: false, sentAt: s.t, reason: 'unknown-decision' };
  const opt = dec.extensionOptions!.find((o) => o.id === optionId);
  if (!opt || opt.blockedBy.length) return { accepted: false, sentAt: s.t, reason: 'unknown-option' };
  dec.commanded = true;
  s.extensionDecided = true;
  emit(s, s.t, 'extension-decided', { optionId, years: opt.years });
  if (opt.id === END_MISSION) {
    s.status = 'complete';
    emit(s, s.t, 'mission-complete', {});
  } else {
    s.extension = { optionId, years: opt.years, startDay: s.env.primeEndDay + 1, endDay: s.env.primeEndDay + opt.days };
    s.status = 'flying';
  }
  return { accepted: true, sentAt: s.t, arrivesAt: s.t };
}

// ---------------------------------------------------------------------------
// The clock

/** Start-of-day actions: launch, phase changes, conjunction and eclipse-season edges, planned burns. */
function startDay(s: OpsState, day: number) {
  s.startedDay = day;
  const env = s.env;
  const e = env.days[day]!;
  const prev = env.days[day - 1];
  s.today = emptyDay(env, day);
  if (day === 0) {
    if (s.draws.launch < 1 - env.ev.details.launchSuccess) {
      emit(s, 0, 'launch-failed', {});
      lose(s, 0);
      return;
    }
    emit(s, 0, 'launch', { date: e.date });
  }
  if (!prev || prev.phase !== e.phase) emit(s, day, 'phase-start', { phase: e.phase });
  if (e.conjunction && !prev?.conjunction) emit(s, day, 'conjunction-start', { minAngle_deg: e.sepAngle_deg ?? 0 });
  if (!e.conjunction && prev?.conjunction) emit(s, day, 'conjunction-end', {});
  for (const season of env.eclipseSeasons) {
    if (season.startDay === day) emit(s, day, 'eclipse-season-start', { endDay: season.endDay, longestEclipse_s: season.longestEclipse_s });
    if (season.endDay + 1 === day) emit(s, day, 'eclipse-season-end', {});
  }
  // The arrival burn: first judge the insertion anomaly on the Δv margin left (as the Risk model), then burn.
  while (s.burnsDone < env.burns.length && env.burns[s.burnsDone]!.day <= day && s.status === 'flying') {
    const b = env.burns[s.burnsDone]!;
    if (b.kind === 'arrival') {
      const need = deltaVStillNeeded_ms(s);
      const margin = (deltaVLeft_ms(s) - need) / need;
      if (s.draws.insertion.uAccept < insertionAnomalyChance(margin)) {
        const n = s.hazards.filter((x) => x.type === 'insertion-anomaly').length + 1;
        s.hazards.push({
          id: `insertion-anomaly-${n}`,
          type: 'insertion-anomaly',
          onset: day,
          knownAt: newsArrival(env, day),
          deadline: day + HAZARDS['insertion-anomaly']!.deadline_days.value,
          endsAt: day,
          uOutcome: s.draws.insertion.uOutcome,
          status: 'pending',
          onsetDone: false,
          knownDone: false,
          endDone: false,
          outcomeDone: false,
        });
      }
    }
    s.burnsDone++;
    s.dvPlannedSpent_ms += b.dv_ms;
    if (!burn(s, b.dv_ms, b.kind)) return;
  }
  if (e.phase === 'extended' && s.extension && day <= s.extension.endDay) burn(s, env.maintenancePerDay_ms, 'maintenance');
}

/** Power, data and dose over [t0, t1) inside one day, with the settings in force. */
function integrate(s: OpsState, t0: number, t1: number) {
  const dt = t1 - t0;
  if (dt <= 0) return;
  const day = Math.floor(t0 + EPS);
  const env = s.env;
  const e = env.days[day]!;
  const sci = scienceOn(s, day) && t0 + EPS >= s.pausedUntil;
  const want = demand(env, e, s.plan, { scienceOn: sci, lost: s.instrumentsLost });
  const got = shedLoads(e.available_W, want);
  const T = s.today;
  for (const k of ['bus', 'heaters', 'instruments', 'radio'] as const) {
    T.demand_W[k] += want[k] * dt;
    T.served_W[k] += got[k] * dt;
  }
  // Cold: heaters below what this day needs, whether fault protection shed them or the plan asked for less.
  if (got.heaters < e.heaterNeed_W - 1e-9) T.cold = true;
  if (got.bus < want.bus - 1e-9) T.brownout = true;
  const instrFrac = want.instruments > 0 ? got.instruments / want.instruments : 0;
  const lost = new Set(s.instrumentsLost);
  const produced = sci
    ? env.loads.instruments.reduce((a, i) => a + (lost.has(i.id) ? 0 : Math.max(0, Math.min(1, s.plan.instruments[i.id] ?? 0)) * i.data_bitsPerDay), 0) * instrFrac * dt
    : 0;
  const radioFrac = want.radio > 0 ? got.radio / want.radio : 0;
  const capacity = downlinkCapacity_bitsPerDay(e, bookingFor(s, day)) * dt * radioFrac;
  const total = s.recorder_bits + produced;
  const down = Math.min(total, capacity);
  let recorder = total - down;
  const cap = OPERATIONS.recorder.capacity_Gbit.value * 1e9;
  if (recorder > cap) {
    s.lost_bits += recorder - cap;
    T.lost_bits += recorder - cap;
    recorder = cap;
  }
  s.recorder_bits = recorder;
  s.produced_bits += produced;
  T.produced_bits += produced;
  T.downlinked_bits += down;
  if (e.phase === 'extended') s.downlinkedExtension_bits += down;
  else s.downlinkedPrime_bits += down;
  if (sci && e.phase === 'science' && capacity < produced - 1e-6) s.radioLimited = true;
  if (sci && instrFrac > 0) {
    T.scienceActive += dt * instrFrac;
    if (e.phase === 'science') s.scienceDaysAchieved += dt * instrFrac;
  }
  s.dose_rad += e.doseRate_radPerDay * dt;
  T.dose_rad += e.doseRate_radPerDay * dt;
}

function closeDay(s: OpsState, day: number) {
  const env = s.env;
  const e = env.days[day]!;
  const T = s.today;
  const ops = PARTS.operations.opsCost_M_per_year.value / YEAR;
  const extra = dsnExtraCost_M(bookingFor(s, day), defaultBooking(env.design));
  if (e.phase === 'science') {
    s.opsCost_M += ops;
    T.cost_M += ops;
  }
  if (e.phase === 'extended') {
    s.extensionCost_M += ops + extra;
    T.cost_M += ops + extra;
  } else if (extra > 0) {
    s.dsnExtra_M += extra;
    T.cost_M += extra;
  }
  if (T.served_W.instruments < T.demand_W.instruments - 1e-6 || T.served_W.radio < T.demand_W.radio - 1e-6) emit(s, day + 1, 'load-shed', { day });
  if (T.cold) s.coldDays++;
  T.recorder_bits = s.recorder_bits;
  T.propellantLeft_kg = s.mass_kg - env.dryMass_kg;
  const rad = DESTINATIONS[env.design.destination].radiation;
  if (rad) {
    for (const f of [0.5, 0.75, 1]) {
      const lim = f * rad.tolerance_rad.value;
      if (s.dose_rad >= lim && s.dose_rad - T.dose_rad < lim) emit(s, day + 1, 'dose-milestone', { fraction: f, dose_rad: s.dose_rad });
    }
  }
  s.ledger.push(T);
  if (T.brownout) {
    s.brownoutStreak++;
    emit(s, day + 1, 'brownout', { streak: s.brownoutStreak });
    if (s.brownoutStreak >= OPERATIONS.power.brownoutDaysToLoss.value) lose(s, day + 1);
  } else s.brownoutStreak = 0;
  if (s.status !== 'flying') return;
  if (day === env.primeEndDay) {
    emit(s, day + 1, 'prime-complete', {});
    if (env.extensible) openExtensionDecision(s, day + 1);
    else {
      s.status = 'complete';
      emit(s, day + 1, 'mission-complete', {});
    }
  } else if (s.extension && day >= s.extension.endDay) {
    s.status = 'complete';
    emit(s, day + 1, 'mission-complete', {});
  }
}

function nextEventTime(s: OpsState): number {
  let next = Infinity;
  const after = (x: number | undefined) => {
    if (x !== undefined && x > s.t + EPS && x < next) next = x;
  };
  for (const type of STREAM_HAZARDS) after(s.draws.candidates[type]!.list[s.cursors[type]!]?.t);
  for (const c of s.commands) if (c.status === 'in-flight') after(c.arrivesAt);
  for (const h of s.hazards) {
    if (!h.onsetDone) after(h.onset);
    if (!h.knownDone) after(h.knownAt);
    if (h.status !== 'resolved') after(h.deadline);
    if (h.resolveAt !== undefined && !h.outcomeDone) after(h.resolveAt);
    if (!h.endDone) after(h.endsAt);
  }
  after(s.pausedUntil);
  return next;
}

/** Everything due at time t, in a fixed order: candidates, commands, hazard onsets, news, deadlines, outcomes, ends. */
function processAt(s: OpsState, t: number) {
  for (const type of STREAM_HAZARDS) {
    const stream = s.draws.candidates[type]!;
    let c = stream.list[s.cursors[type]!];
    while (c && c.t <= t + EPS) {
      s.cursors[type]! += 1;
      if (s.status === 'flying' && c.uAccept < hazardRate(s, type, c.t) / stream.bound_perDay) createHazard(s, type, c.t, c.uOutcome);
      c = stream.list[s.cursors[type]!];
    }
  }
  const due = s.commands.filter((c) => c.status === 'in-flight' && c.arrivesAt <= t + EPS).sort((a, b) => a.arrivesAt - b.arrivesAt || a.id - b.id);
  for (const c of due) if (s.status === 'flying') executeCommand(s, c.command, c.arrivesAt, c.id);
  for (const h of s.hazards) {
    if (s.status !== 'flying') break;
    if (!h.onsetDone && h.onset <= t + EPS) onset(s, h);
    if (s.status === 'flying' && !h.knownDone && h.knownAt <= t + EPS) openHazardDecision(s, h, h.knownAt);
    if (s.status === 'flying' && h.status !== 'resolved' && h.knownDone && h.deadline <= t + EPS) applyDeadline(s, h, t);
    if (s.status === 'flying' && h.resolveAt !== undefined && !h.outcomeDone && h.resolveAt <= t + EPS) resolveOutcome(s, h, t);
    if (!h.endDone && h.endsAt <= t + EPS && h.onsetDone) {
      h.endDone = true;
      if (h.endsAt > h.onset) emit(s, h.endsAt, 'hazard-end', { hazardId: h.id });
    }
  }
}

// The clock's calls change s.status; these keep TypeScript from narrowing it inside the loop.
const isFlying = (s: OpsState) => s.status === 'flying';
const isLost = (s: OpsState) => s.status === 'lost';

/**
 * Run the clock (mutates s) until tStop, the end of the mission, or a new decision for the player.
 * A deadline that falls before Earth hears of a hazard is held until the news arrives.
 */
export function simulate(s: OpsState, tStop: number): void {
  let guard = 0;
  while (s.status === 'flying' && s.t < tStop - EPS) {
    if (++guard > 1e7) throw new Error('Mission clock did not advance');
    const day = Math.floor(s.t + EPS);
    if (day > s.env.horizonDay) break;
    if (s.startedDay < day) {
      startDay(s, day);
      processAt(s, s.t);
      if (!isFlying(s) || s.newDecisions.length) {
        if (isLost(s)) closeOut(s, day);
        return;
      }
    }
    const tNext = Math.min(day + 1, tStop, nextEventTime(s));
    integrate(s, s.t, tNext);
    s.t = tNext;
    processAt(s, s.t);
    if (isLost(s)) {
      closeOut(s, day);
      return;
    }
    if (s.t >= day + 1 - EPS) {
      s.t = day + 1;
      closeDay(s, day);
    }
    if (s.newDecisions.length) return;
  }
}

/** The day the craft was lost still gets its ledger row. */
function closeOut(s: OpsState, day: number) {
  if (s.ledger.length === 0 || s.ledger[s.ledger.length - 1]!.day < day) {
    s.today.recorder_bits = s.recorder_bits;
    s.today.propellantLeft_kg = s.mass_kg - s.env.dryMass_kg;
    s.ledger.push(s.today);
  }
}

