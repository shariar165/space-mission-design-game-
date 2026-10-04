// The UI calls evaluateDesign() (design screen) and simulateMission() (flight + Debrief) and renders
// what comes back. Every number is computed here; nothing is hand-typed into the UI.
import { G0, GAME_RULES, km, mu as muSI, S0 } from './constants';
import { COMMS_CALIBRATED, dataMeter, dataPerDay_bits, dataRate, lightDelay_s, REFERENCE_LINK } from './comms';
import { applicableCards, availableOptions, crisisScore, drawCrisis, safestOption, timeline, type CrisisCard, type CrisisOption, type PhaseWindow } from './crisis';
import { DESTINATIONS, LAUNCH_VEHICLES, lookup, PARTS } from './data';
import { earthDistance, julianDate } from './ephemeris';
import { launchMassCheck, launchSuccessProbability, payloadAtC3 } from './launch';
import { componentMasses, costBreakdown, costEvaluation, massRollup, wetMass, type CostBreakdown } from './massCost';
import { batteryMass, ETA_SYS, longestEclipse_s, powerMeter, powerOnDay, solarPower } from './power';
import { deltaVBudget, deltaVCapability, deltaVMeter, engineBlockers, propellantBurned, type DeltaVBudget } from './propulsion';
import { makeRng, phaseRisks, riskMeter, type Phase, type PhaseRisk } from './risk';
import { budgetScore, marginBandScore, missionSuccessScore, nextStar, scienceGoal_Gbit, scienceScore, stars, totalScore, type Category } from './scoring';
import { arrivalDeltaV, maxFlightDays, orbitChangeDeltaV, sunDistanceExtremes, transferForDesign } from './trajectory';
import { sourced, type Design, type Evaluation, type Meter, type Sourced } from './types';

const derived = (value: number, unit: string, equation: string) => sourced(value, unit, `Computed by the engine: ${equation}`);

/** Everything evaluateDesign computes, including the extra numbers the simulation and Debrief need. */
export interface FullEvaluation extends Evaluation {
  meters: Evaluation['meters'] & { risk: Meter };
  details: Evaluation['details'] & {
    launchDate: string;
    arrivalDate: string;
    deltaVBudget: DeltaVBudget;
    phaseRisks: PhaseRisk[];
    launchSuccess: number;
    power: { available_W: number; required_W: number; atEndOfScience: { available_W: number; required_W: number } };
    data: { producedPerDay_bits: number; downlinkedPerDayAtArrival_bits: number };
    cost: { development_M: number; launch_M: number; operations_M: number; cap_M: number };
    /** Development cost of each part group ($M). */
    costBreakdown: CostBreakdown;
    /**
     * Concept mass roll-up (kg): m_dry = (1 + k_margin) × subtotal. Real missions (asFlown) use the
     * published dry mass instead, so for them the roll-up is for reference only.
     */
    massBreakdown: {
      bus: number;
      instruments: { id: string; kg: number }[];
      powerGeneration: number;
      battery: number;
      comms: number;
      tanks: number;
      subtotal: number;
      growthMargin: number;
    };
    isp_s: number;
    propellant_kg: number;
    /** Planned science days actually used (design value, or the 365-day default). */
    scienceDays: number;
    asFlown: boolean;
    sampleReturn: boolean;
  };
}

export function evaluateDesign(design: Design): FullEvaluation {
  const dest = DESTINATIONS[design.destination];
  const bus = lookup(PARTS.buses, design.busId, 'bus');
  const engine = lookup(PARTS.engines, design.engineId, 'engine');
  const instruments = design.instrumentIds.map((id) => lookup(PARTS.instruments, id, 'instrument'));
  const lv = lookup(LAUNCH_VEHICLES, design.launchVehicleId, 'launch vehicle');
  const scienceDays = design.scienceDays ?? 365;
  const sampleReturn = dest.missionType === 'rendezvous';
  const blockers: string[] = [];
  const notes: string[] = [...dest.notes];

  // --- Trajectory ---
  const transfer = transferForDesign(design);
  let launchDate = design.launchDate;
  let arrivalDate = design.arrivalDate;
  let routeDeltaV_ms = 0;
  if (transfer.method === 'fixed-route' && 'label' in transfer) {
    launchDate = transfer.launchDate;
    arrivalDate = transfer.arrivalDate;
    routeDeltaV_ms = transfer.extraDeltaV.value;
    notes.push(
      `${transfer.label}: launch C3 = ${transfer.c3_km2s2} km²/s² is the published value and the flyby is not simulated; ` +
        `only the post-flyby leg (${transfer.postFlybyLegDays} days) is computed. Launch and arrival dates come from the route.`,
    );
  }
  const maxDays = design.destination === 'moon' ? undefined : maxFlightDays(design.destination);
  if (transfer.method === 'lambert' && maxDays !== undefined && transfer.flightDays >= maxDays) {
    blockers.push(
      `A ${Math.round(transfer.flightDays)}-day flight needs a full loop or more around the Sun. ` +
        `The game only models transfers of less than one revolution: under ${Math.floor(maxDays)} days to ${dest.name}.`,
    );
  }
  if (design.destination === 'moon') {
    notes.push('Moon transfers are Earth-centred: flight time comes from the transfer orbit, not the chosen dates.');
  }
  const jdLaunch = julianDate(launchDate);
  const jdArrival = design.destination === 'moon' ? jdLaunch + transfer.flightDays : julianDate(arrivalDate);
  const jdEndScience = jdArrival + scienceDays;

  // --- Power (arrival day, and end of science for the end-of-mission margin) ---
  const commsDraw_W = design.comms.txPower_W / PARTS.comms.dcToRfEfficiency.value;
  const baseRequired_W = bus.power_W.value + instruments.reduce((s, i) => s + i.power_W.value, 0) + commsDraw_W + engine.power_W.value;
  const atArrival = powerOnDay(design, jdArrival, (jdArrival - jdLaunch) / 365.25, baseRequired_W, bus.heaterBase_W.value);
  const atEnd = powerOnDay(design, jdEndScience, (jdEndScience - jdLaunch) / 365.25, baseRequired_W, bus.heaterBase_W.value);
  const power = powerMeter(atArrival.available_W, atArrival.required_W, {
    S0,
    sunDistance: derived(atArrival.rSun, 'm', 'JPL approximate ephemeris on arrival day'),
    arrayArea: sourced(design.power.arrayArea_m2 ?? 0, 'm²', 'Player design'),
    etaSys: ETA_SYS,
    degradationPerYear: PARTS.power.solarDegradation_perYear,
    busPower: bus.power_W,
    heaters: derived(atArrival.heaters_W, 'W', 'base × (1 + k(1 − sunlight))'),
    commsDraw: derived(commsDraw_W, 'W', 'P_t / DC-to-RF efficiency'),
  });
  if (power.status === 'over') {
    blockers.push(`Not enough power: ${Math.round(atArrival.available_W)} W available, ${Math.round(atArrival.required_W)} W needed.`);
  }

  let solarPowerRange_W: Evaluation['details']['solarPowerRange_W'];
  if (design.power.type === 'solar') {
    const ext = sunDistanceExtremes(design.destination === 'moon' ? 'earth' : design.destination, jdArrival);
    // Calibration convention: η_sys was fitted to MAVEN's published range with no degradation term.
    solarPowerRange_W = {
      atPerihelion: solarPower({ area_m2: design.power.arrayArea_m2 ?? 0, sunDistance_m: ext.perihelion_m }),
      atAphelion: solarPower({ area_m2: design.power.arrayArea_m2 ?? 0, sunDistance_m: ext.aphelion_m }),
    };
  }

  // --- Orbits and batteries (longest eclipse in the science orbit) ---
  const scienceOrbit = design.scienceOrbit ?? design.captureOrbit;
  let battery_kg = 0;
  let orbitTransfer_ms = 0;
  if (dest.missionType === 'orbiter') {
    const R = km(dest.radius_km.value);
    const mu = muSI(dest.gm_km3s2.value);
    const sci = { rp: R + km(scienceOrbit.periapsis_km), ra: R + km(scienceOrbit.apoapsis_km) };
    battery_kg = batteryMass(longestEclipse_s(mu, R, sci.rp, sci.ra), atArrival.required_W);
    if (design.scienceOrbit) {
      const cap = { rp: R + km(design.captureOrbit.periapsis_km), ra: R + km(design.captureOrbit.apoapsis_km) };
      orbitTransfer_ms = orbitChangeDeltaV(mu, cap, sci);
    }
  }

  // --- Mass ---
  const components = componentMasses(design, battery_kg);
  const rollup = massRollup(components);
  const dry_kg = design.asFlownDryMass_kg?.value ?? rollup.dry_kg;
  const wet_kg = wetMass(dry_kg, design.propellant_kg);

  // --- Δv ---
  const budget = deltaVBudget({
    arrival_ms: arrivalDeltaV(design.destination, transfer.vInfArr_ms, design.captureOrbit),
    orbitTransfer_ms,
    scienceDays,
    lifetimeDays: design.lifetimeDays,
    other_ms: routeDeltaV_ms,
  });
  const dvCapability = deltaVCapability(engine.isp_s.value, wet_kg, dry_kg);
  const deltaV = deltaVMeter(dvCapability, budget.total_ms, {
    isp: engine.isp_s,
    g0: G0,
    wetMass: derived(wet_kg, 'kg', 'm_dry + m_prop'),
    dryMass: design.asFlownDryMass_kg ?? derived(dry_kg, 'kg', '(1 + k_margin) × Σ components'),
    arrivalBurn: derived(budget.arrival_ms, 'm/s', dest.missionType === 'rendezvous' ? 'v∞ at arrival' : 'capture equation'),
    scienceOrbitTransfer: derived(orbitTransfer_ms, 'm/s', 'vis-viva two-burn change, capture → science orbit'),
    trajectoryCorrections: GAME_RULES.trajectoryCorrection_ms,
    orbitMaintenance: GAME_RULES.orbitMaintenance_msPerYear,
    lifetimeReserve: derived(budget.lifetimeReserve_ms, 'm/s', 'maintenance rate × (lifetime − science days)'),
    ...(transfer.method === 'fixed-route' && 'inputs' in transfer ? transfer.inputs : {}),
  });
  blockers.push(...engineBlockers(design.engineId, dest.missionType));
  if (deltaV.status === 'over') {
    blockers.push(`Not enough propellant: Δv ${Math.round(dvCapability)} m/s available, ${Math.round(budget.total_ms)} m/s needed.`);
  }

  // --- Launch ---
  const launch = launchMassCheck(lv.payloadCurve.value, transfer.c3_km2s2, wet_kg, {
    c3: derived(transfer.c3_km2s2, 'km²/s²', 'v∞,dep²'),
    wetMass: derived(wet_kg, 'kg', 'm_dry + m_prop'),
  });
  if (launch.blocker) blockers.push(launch.blocker);
  if (!payloadAtC3(lv.payloadCurve.value, transfer.c3_km2s2).inRange) {
    notes.push(`C3 = ${transfer.c3_km2s2.toFixed(1)} km²/s² is outside the ${lv.name} performance data; capacity is not interpolated.`);
  }
  const launchSuccess = launchSuccessProbability(lv.successes.value, lv.flights.value);

  // --- Comms ---
  const dEarth = earthDistance(design.destination, jdArrival);
  const downlinked = dataPerDay_bits(dataRate({ ...design.comms, distance_m: dEarth }));
  const produced = instruments.reduce((s, i) => s + i.data_Mbit_per_day.value * 1e6, 0);
  const data = dataMeter(produced, downlinked, {
    ...REFERENCE_LINK,
    earthDistance: derived(dEarth, 'm', 'JPL approximate ephemeris on arrival day'),
    passHours: GAME_RULES.dsnPassHours,
  });
  if (!COMMS_CALIBRATED) notes.push('Comms meter is uncalibrated: the reference link is a placeholder.');
  if (REFERENCE_LINK.groundDish_m.isGameEstimate) notes.push('Data rates scale from the published MRO link; the 34-m station for that figure is inferred.');
  if (produced > downlinked) notes.push('The radio, not the instruments, limits the science return.');

  // --- Cost ---
  const cost = costEvaluation(design);

  // --- Risk ---
  const risks = phaseRisks({
    missionType: dest.missionType,
    launchSuccess,
    deltaVMargin: deltaV.margin,
    powerMargin: power.margin,
    scienceDays,
    sampleReturn,
  });

  return {
    meters: { mass: launch.meter, power, deltaV, data, cost: cost.meter, risk: riskMeter(risks) },
    blockers,
    notes,
    trajectory: {
      c3: transfer.c3_km2s2,
      vInfArr: transfer.vInfArr_ms / 1000,
      flightDays: transfer.flightDays,
      path: transfer.path,
      method: transfer.method,
      ...(maxDays !== undefined ? { maxFlightDays: maxDays } : {}),
    },
    details: {
      dryMass_kg: dry_kg,
      wetMass_kg: wet_kg,
      deltaVCapability_ms: dvCapability,
      deltaVRequired_ms: budget.total_ms,
      launchCapacity_kg: launch.meter.limit,
      solarPowerRange_W,
      earthDistanceAtArrival_m: dEarth,
      lightDelayAtArrival_s: lightDelay_s(dEarth),
      launchDate,
      arrivalDate: design.destination === 'moon' ? launchDate : arrivalDate,
      deltaVBudget: budget,
      phaseRisks: risks,
      launchSuccess,
      power: {
        available_W: atArrival.available_W,
        required_W: atArrival.required_W,
        atEndOfScience: { available_W: atEnd.available_W, required_W: atEnd.required_W },
      },
      data: { producedPerDay_bits: produced, downlinkedPerDayAtArrival_bits: downlinked },
      cost: { development_M: cost.development_M, launch_M: cost.launch_M, operations_M: cost.operations_M, cap_M: cost.meter.limit },
      costBreakdown: costBreakdown(design),
      massBreakdown: {
        bus: components.bus,
        instruments: design.instrumentIds.map((id, i) => ({ id, kg: components.instruments[i] ?? 0 })),
        powerGeneration: components.power - battery_kg,
        battery: battery_kg,
        comms: components.comms,
        tanks: components.tanks,
        subtotal: rollup.subtotal_kg,
        growthMargin: rollup.growthMargin_kg,
      },
      isp_s: engine.isp_s.value,
      propellant_kg: design.propellant_kg,
      scienceDays,
      asFlown: design.asFlownDryMass_kg !== undefined,
      sampleReturn,
    },
  };
}

// ---------------------------------------------------------------------------
// Flight simulation

export type CrisisPolicy = 'safe' | 'risky' | ((card: CrisisCard, options: CrisisOption[]) => string);

export interface SimulationResult {
  launched: boolean;
  completed: boolean;
  phasesCompleted: number;
  totalPhases: number;
  failedPhase?: Phase;
  failureDay?: number;
  crisis?: {
    cardId: string;
    title: string;
    day: number;
    phase: Phase;
    optionId: string;
    optionLabel: string;
    choseSafest: boolean;
    reached: boolean;
    badOutcome: boolean;
    /** Δv paid for the chosen option (0 if the crisis was never reached). */
    deltaVSpent_ms: number;
    /** Propellant for deltaVSpent_ms, from the rocket equation at the craft's mass in that phase. */
    propellantSpent_kg: number;
    scienceDaysLost: number;
    /** Budget paid; a test bought before launch is always paid. */
    budgetSpent_M: number;
  };
  /** Mission day the flight ended: the failure day, the last planned day, or 0 if it never launched. */
  endDay: number;
  /** Earth–craft distance on endDay (m), from the ephemeris. */
  earthDistanceAtEnd_m: number;
  scienceDaysAchieved: number;
  plannedScienceDays: number;
  /** Science goal = Σ instrument data/day × planned science days. */
  goal_Gbit: number;
  /**
   * Data sent home: each science day, min(data produced, downlink capacity that day). The capacity comes from
   * the scaled link budget anchored to MRO's published link (station pairing inferred).
   */
  downlinked_Gbit: number;
  downlinkCalibrated: boolean;
  /** The reference-link value behind the downlink capacity (ⓘ): its estimated part if any, else the rate. */
  downlinkAnchor: Sourced<number>;
  radioLimited: boolean;
  endMargins: { deltaV: number; power: number; mass: number };
  scores: Record<Category, number>;
  score: number;
  breakdown: ReturnType<typeof totalScore>['breakdown'];
  stars: number;
  hint: string;
  /** The score category the hint is about (the Debrief highlights that row). */
  hintCategory?: Category;
}

interface Prepared {
  design: Design;
  ev: FullEvaluation;
  scienceDays: number;
  returnDays?: number;
  /** Downlink capacity for each science day (bits), from the Earth distance on that date. */
  dailyCapacity_bits: number[];
  producedPerDay_bits: number;
  goal_Gbit: number;
}

function prepare(design: Design): Prepared {
  const ev = evaluateDesign(design);
  const scienceDays = Math.max(1, Math.round(design.scienceDays ?? 365));
  const jdArrival = julianDate(ev.details.launchDate) + ev.trajectory.flightDays;
  const dailyCapacity_bits: number[] = [];
  for (let d = 1; d <= scienceDays; d++) {
    const dist = earthDistance(design.destination, jdArrival + d);
    dailyCapacity_bits.push(dataPerDay_bits(dataRate({ ...design.comms, distance_m: dist })));
  }
  return {
    design,
    ev,
    scienceDays,
    returnDays: ev.details.sampleReturn ? Math.round(ev.trajectory.flightDays) : undefined,
    dailyCapacity_bits,
    producedPerDay_bits: ev.details.data.producedPerDay_bits,
    goal_Gbit: scienceGoal_Gbit(ev.details.data.producedPerDay_bits, scienceDays),
  };
}

function pickOption(policy: CrisisPolicy, card: CrisisCard, options: CrisisOption[]): CrisisOption {
  if (policy === 'safe') return safestOption(options);
  if (policy === 'risky') return options.reduce((a, b) => (b.failureChance.value > a.failureChance.value ? b : a));
  const id = policy(card, options);
  const chosen = options.find((o) => o.id === id);
  if (!chosen) throw new Error(`Option ${id} is not available for ${card.id}`);
  return chosen;
}

/** Draw the flight's crisis card and the options the spare margins can pay for. Shared by run() and previewCrisis(). */
function setUpCrisis(p: Prepared, rng: () => number): { tl: PhaseWindow[]; drawn: ReturnType<typeof drawCrisis>; options: CrisisOption[] } {
  const d = p.ev.details;
  const tl = timeline({ flightDays: p.ev.trajectory.flightDays, scienceDays: p.scienceDays, returnDays: p.returnDays });
  const drawn = drawCrisis(tl, DESTINATIONS[p.design.destination].missionType, d.sampleReturn, rng);
  const options = availableOptions(drawn.card, {
    deltaV_ms: d.deltaVCapability_ms - d.deltaVRequired_ms,
    budget_M: d.cost.cap_M - d.cost.development_M,
    powerMargin: p.ev.meters.power.margin,
  });
  return { tl, drawn, options };
}

/**
 * Craft mass during a phase (kg): the wet mass until arrival. After arrival, the wet mass minus the propellant
 * burned for the arrival burn, the capture → science orbit change and the trajectory corrections (rocket equation).
 */
export function massInPhase(ev: FullEvaluation, phase: Phase): number {
  const d = ev.details;
  if (phase === 'launch' || phase === 'cruise') return d.wetMass_kg;
  const b = d.deltaVBudget;
  return d.wetMass_kg - propellantBurned(d.wetMass_kg, b.arrival_ms + b.orbitTransfer_ms + b.trajectoryCorrections_ms, d.isp_s);
}

function run(p: Prepared, rng: () => number, policy: CrisisPolicy): SimulationResult {
  const { ev, design } = p;
  const d = ev.details;
  let devCost_M = d.cost.development_M;
  const massMargin = ev.meters.mass.margin;
  const endPowerMargin = (d.power.atEndOfScience.available_W - d.power.atEndOfScience.required_W) / d.power.atEndOfScience.required_W;
  const jdLaunch = julianDate(d.launchDate);

  type FinishInput = Omit<
    SimulationResult,
    'scores' | 'score' | 'breakdown' | 'stars' | 'hint' | 'hintCategory' | 'endMargins' | 'goal_Gbit' | 'plannedScienceDays' | 'earthDistanceAtEnd_m' | 'downlinkCalibrated' | 'downlinkAnchor'
  > & { dvMargin: number; crisisScoreValue: number };
  const finish = (r: FinishInput): SimulationResult => {
    const endMargins = { deltaV: r.dvMargin, power: endPowerMargin, mass: massMargin };
    const sci = scienceScore(r.downlinked_Gbit, p.goal_Gbit);
    const scores: Record<Category, number> = {
      science: sci,
      success: missionSuccessScore(r.phasesCompleted, r.totalPhases),
      budget: budgetScore(devCost_M, d.cost.cap_M),
      deltaV: marginBandScore(endMargins.deltaV),
      power: marginBandScore(endMargins.power),
      mass: marginBandScore(endMargins.mass),
      crisis: r.crisisScoreValue,
    };
    const t = totalScore(scores);
    const reachedScience = r.launched && r.phasesCompleted >= 3;
    const s = stars({ reachedScience, scienceScore: sci, margins: endMargins });
    const { dvMargin: _dv, crisisScoreValue: _cs, ...rest } = r;
    const next = nextStar({
      stars: s,
      failedPhase: r.failedPhase,
      blockers: ev.blockers,
      radioLimited: r.radioLimited,
      scienceScore: sci,
      margins: endMargins,
      deltaV: { required_ms: d.deltaVRequired_ms, capability_ms: d.deltaVCapability_ms, isp_s: d.isp_s, dry_kg: d.dryMass_kg, propellant_kg: d.propellant_kg, asFlown: d.asFlown },
      launch: { capacity_kg: d.launchCapacity_kg, wet_kg: d.wetMass_kg },
      power: { available_W: d.power.atEndOfScience.available_W, required_W: d.power.atEndOfScience.required_W, type: design.power.type, arrayArea_m2: design.power.arrayArea_m2 },
    });
    return {
      ...rest,
      goal_Gbit: p.goal_Gbit,
      downlinkCalibrated: COMMS_CALIBRATED,
      downlinkAnchor: REFERENCE_LINK.groundDish_m.isGameEstimate ? REFERENCE_LINK.groundDish_m : REFERENCE_LINK.rate_bps,
      plannedScienceDays: p.scienceDays,
      earthDistanceAtEnd_m: earthDistance(design.destination, jdLaunch + r.endDay),
      endMargins,
      scores,
      score: t.total,
      breakdown: t.breakdown,
      stars: s,
      hint: next.hint,
      ...(next.category ? { hintCategory: next.category } : {}),
    };
  };

  const phases = d.phaseRisks;
  if (ev.blockers.length) {
    return finish({
      launched: false, completed: false, phasesCompleted: 0, totalPhases: phases.length, endDay: 0, scienceDaysAchieved: 0,
      downlinked_Gbit: 0, radioLimited: false, dvMargin: ev.meters.deltaV.margin, crisisScoreValue: 0,
    });
  }

  // Crisis: one card per flight, its day inside its phase. Decide with the spare margins at that point.
  const { tl, drawn, options } = setUpCrisis(p, rng);
  const missionType = DESTINATIONS[design.destination].missionType;
  const chosen = pickOption(policy, drawn.card, options);
  const choseSafest = chosen.id === safestOption(drawn.card.options).id;
  if (drawn.card.decisionBeforeLaunch) devCost_M += chosen.cost.budget_M?.value ?? 0;
  const dvSpent = chosen.cost.deltaV_ms?.value ?? 0;
  const scienceDaysLost = chosen.cost.scienceDays?.value ?? 0;
  const order: Phase[] = phases.map((ph) => ph.phase);
  const crisisIdx = order.indexOf(drawn.phase);
  const dvMarginAfter = (d.deltaVCapability_ms - dvSpent - d.deltaVRequired_ms) / d.deltaVRequired_ms;
  const postCrisis = phaseRisks({
    missionType,
    launchSuccess: d.launchSuccess,
    deltaVMargin: dvMarginAfter,
    powerMargin: ev.meters.power.margin,
    scienceDays: p.scienceDays,
    sampleReturn: d.sampleReturn,
  });

  let crisisReached = false;
  let badOutcome = false;
  let doomedPhase: Phase | undefined;
  let completed = 0;
  let failedPhase: Phase | undefined;
  let failureDay: number | undefined;
  let scienceDaysAchieved = 0;
  const scienceWindow = tl.find((w) => w.phase === 'science')!;

  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i]!;
    const win = tl.find((w) => w.phase === ph.phase)!;
    if (i === crisisIdx) {
      crisisReached = true;
      badOutcome = rng() < chosen.failureChance.value;
      if (badOutcome) doomedPhase = chosen.affects;
    }
    const pFail = i >= crisisIdx ? postCrisis[i]!.pFail : ph.pFail;
    const fails = doomedPhase === ph.phase || rng() < pFail;
    if (ph.phase === 'science') {
      const planned = Math.max(0, p.scienceDays - (crisisReached || crisisIdx < i ? scienceDaysLost : 0));
      if (fails) {
        const dayIn = doomedPhase === 'science' && crisisIdx === i ? drawn.day - scienceWindow.startDay : Math.floor(rng() * p.scienceDays);
        scienceDaysAchieved = Math.min(planned, Math.max(0, dayIn));
      } else scienceDaysAchieved = planned;
    }
    if (fails) {
      failedPhase = ph.phase;
      failureDay = doomedPhase === ph.phase && crisisIdx === i ? drawn.day : win.startDay + Math.floor(rng() * (win.endDay - win.startDay + 1));
      break;
    }
    completed++;
  }

  let downlinked_bits = 0;
  let radioLimited = false;
  for (let k = 0; k < scienceDaysAchieved; k++) {
    const cap = p.dailyCapacity_bits[k] ?? 0;
    if (cap < p.producedPerDay_bits) radioLimited = true;
    downlinked_bits += Math.min(cap, p.producedPerDay_bits);
  }

  const deltaVSpent_ms = crisisReached ? dvSpent : 0;
  return finish({
    launched: true,
    completed: completed === phases.length,
    phasesCompleted: completed,
    totalPhases: phases.length,
    ...(failedPhase ? { failedPhase, failureDay } : {}),
    endDay: failureDay ?? tl[tl.length - 1]!.endDay,
    crisis: {
      cardId: drawn.card.id,
      title: drawn.card.title,
      day: drawn.day,
      phase: drawn.phase,
      optionId: chosen.id,
      optionLabel: chosen.label,
      choseSafest,
      reached: crisisReached,
      badOutcome,
      deltaVSpent_ms,
      propellantSpent_kg: propellantBurned(massInPhase(p.ev, drawn.phase), deltaVSpent_ms, d.isp_s),
      scienceDaysLost: crisisReached ? scienceDaysLost : 0,
      budgetSpent_M: crisisReached || drawn.card.decisionBeforeLaunch ? (chosen.cost.budget_M?.value ?? 0) : 0,
    },
    scienceDaysAchieved,
    downlinked_Gbit: downlinked_bits / 1e9,
    radioLimited,
    dvMargin: crisisReached ? dvMarginAfter : ev.meters.deltaV.margin,
    crisisScoreValue: crisisReached ? crisisScore(choseSafest, badOutcome) : 100,
  });
}

/**
 * The crisis this flight will meet for a given seed, and the options the margins can pay for. The player
 * chooses, then simulateMission(design, { seed, crisisPolicy: () => optionId }) flies the same draw.
 * Undefined when the design is blocked (it never launches).
 */
export function previewCrisis(
  design: Design,
  seed: number,
): { card: CrisisCard; day: number; phase: Phase; options: CrisisOption[]; safestOptionId: string } | undefined {
  const p = prepare(design);
  if (p.ev.blockers.length) return undefined;
  const { drawn, options } = setUpCrisis(p, makeRng(seed));
  return { card: drawn.card, day: drawn.day, phase: drawn.phase, options, safestOptionId: safestOption(drawn.card.options).id };
}

// ---------------------------------------------------------------------------
// Standing orders (Cadet Mission Control). Signals take minutes to reach the craft, so the player queues
// what it should do for each crisis before launch, and the craft acts on its own when the crisis comes.

export interface CrisisOrder {
  card: CrisisCard;
  /** Options the spare margins can pay for (the free option is always one). */
  available: CrisisOption[];
  /** The order the craft follows if the player sets none: the safest available option. */
  defaultOptionId: string;
  /** Propellant each option burns (kg): rocket equation at the craft mass in the card's phase (cruise for "any"). */
  fuel_kg: Record<string, number>;
}

/** Every crisis card this mission can meet, with what the spare margins can pay for. */
export function crisisOrders(design: Design): CrisisOrder[] {
  const ev = evaluateDesign(design);
  const d = ev.details;
  const spare = {
    deltaV_ms: d.deltaVCapability_ms - d.deltaVRequired_ms,
    budget_M: d.cost.cap_M - d.cost.development_M,
    powerMargin: ev.meters.power.margin,
  };
  return applicableCards(DESTINATIONS[design.destination].missionType, d.sampleReturn).map((card) => {
    const available = availableOptions(card, spare);
    const m0 = massInPhase(ev, card.eventPhase === 'any' ? 'cruise' : card.eventPhase);
    return {
      card,
      available,
      defaultOptionId: safestOption(available).id,
      fuel_kg: Object.fromEntries(card.options.map((o) => [o.id, propellantBurned(m0, o.cost.deltaV_ms?.value ?? 0, d.isp_s)])),
    };
  });
}

/** A crisis policy from standing orders (card id → option id). A missing or unaffordable order → the safest option. */
export function standingOrderPolicy(orders: Record<string, string>): CrisisPolicy {
  return (card, options) => {
    const id = orders[card.id];
    return id !== undefined && options.some((o) => o.id === id) ? id : safestOption(options).id;
  };
}

/** Fly one mission. Reproducible for a given seed. */
export function simulateMission(design: Design, opts: { seed?: number; rng?: () => number; crisisPolicy?: CrisisPolicy } = {}): SimulationResult {
  return run(prepare(design), opts.rng ?? makeRng(opts.seed ?? 1), opts.crisisPolicy ?? 'safe');
}

/** Default Monte Carlo seed: the same design always gives the same 1,000-run result (reproducible demos). */
export const MONTE_CARLO_SEED = 2013;

/** Engineer mode: fly the same design n times (default 1,000) and report the success rate. Seeded, so reproducible. */
export function monteCarloMission(
  design: Design,
  opts: { runs?: number; seed?: number; crisisPolicy?: CrisisPolicy } = {},
): { runs: number; seed: number; successRate: number; meanScore: number; starsHistogram: number[]; failuresByPhase: Partial<Record<Phase, number>> } {
  const p = prepare(design);
  const seed = opts.seed ?? MONTE_CARLO_SEED;
  const rng = makeRng(seed);
  const n = opts.runs ?? 1000;
  let successes = 0;
  let scoreSum = 0;
  const starsHistogram = [0, 0, 0, 0];
  const failuresByPhase: Partial<Record<Phase, number>> = {};
  for (let i = 0; i < n; i++) {
    const r = run(p, rng, opts.crisisPolicy ?? 'safe');
    if (r.completed) successes++;
    scoreSum += r.score;
    starsHistogram[r.stars]! += 1;
    if (r.failedPhase) failuresByPhase[r.failedPhase] = (failuresByPhase[r.failedPhase] ?? 0) + 1;
  }
  return { runs: n, seed, successRate: successes / n, meanScore: scoreSum / n, starsHistogram, failuresByPhase };
}

export type { Design, Evaluation, Meter, Sourced } from './types';
export type { CrisisCard, CrisisOption } from './crisis';
export type { Phase } from './risk';
export type { Category, Grade } from './scoring';
