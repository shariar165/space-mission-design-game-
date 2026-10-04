// Power day by day over the mission (spec: Power, and Mission operations › Power). One model for the Power
// meter and Mission operations: the meter shows the worst day, and prepareOps reads the same days.
//
//   P_avail = min(P_gen (1 − f_ecl), E_batt / t_ecl,max)   (solar),   P_avail = P_RTG   (RTG)
//
// Required power is the Ops default plan: bus + engine + radio + heaters every day, and the instruments only
// in the science phase (and any extension). Eclipses come from the science orbit fixed in inertial space.
import { phaseOnDay, timeline } from './crisis';
import { craftSunDistance, type CraftPathInput, type XY } from './craftPath';
import { DESTINATIONS, lookup, PARTS } from './data';
import { julianDate } from './ephemeris';
import { eclipse, isoDate, scienceOrbitGeometry, sunDirection } from './ops/predictable';
import { batteryMass, powerOnDay } from './power';
import type { Design } from './types';

const YEAR = 365.25;

export type PowerPhase = 'launch' | 'cruise' | 'arrival' | 'science' | 'return' | 'extended';

/** The part of a day that no load or array size changes: where the craft is and how long it is in shadow. */
interface GeometryDay {
  day: number;
  jd: number;
  phase: PowerPhase;
  sunDistance_m: number;
  eclipseFraction: number;
  longestEclipse_s: number;
}

export interface PowerDay extends GeometryDay {
  date: string;
  /** Array (or RTG) output that day, before eclipses. */
  generation_W: number;
  /** What the craft can use, averaged over the day: the spec's P_avail. */
  available_W: number;
  heaterNeed_W: number;
  /** The default plan's load: bus + engine + radio + heaters, plus instruments in science. */
  required_W: number;
  /** (available − required) / required. */
  margin: number;
}

export interface EclipseSeasonSummary {
  startDay: number;
  endDay: number;
  startDate: string;
  endDate: string;
  longestEclipse_s: number;
  maxFraction: number;
}

export interface PowerProfileInput {
  design: Design;
  jdLaunch: number;
  flightDays: number;
  path: XY[];
  scienceDays: number;
  sampleReturn: boolean;
  /** Bus + engine (W), radio DC draw (W), all instruments on (W), and the bus heater base (W). */
  loads: { bus_W: number; radio_W: number; instruments_W: number; heaterBase_W: number };
}

export interface PowerProfile {
  arrivalDay: number;
  primeEndDay: number;
  days: PowerDay[];
  /** Battery sized for the worst-case eclipse at the heaviest science-day load, within the depth of discharge. */
  battery: { capacity_Wh: number; mass_kg: number; sizedForEclipse_s: number; load_W: number; depthOfDischarge: number };
}

/** The design's loads (W): bus + engine, the radio's DC draw, every instrument on, and the bus heater base. */
export function designLoads(design: Design): PowerProfileInput['loads'] {
  const bus = lookup(PARTS.buses, design.busId, 'bus');
  const engine = lookup(PARTS.engines, design.engineId, 'engine');
  return {
    bus_W: bus.power_W.value + engine.power_W.value,
    radio_W: design.comms.txPower_W / PARTS.comms.dcToRfEfficiency.value,
    instruments_W: design.instrumentIds.reduce((s, id) => s + lookup(PARTS.instruments, id, 'instrument').power_W.value, 0),
    heaterBase_W: bus.heaterBase_W.value,
  };
}

/** What powerProfileFor needs from an evaluation (a structural type, so this module never imports index.ts). */
export interface EvaluatedTrajectory {
  trajectory: { flightDays: number; path: XY[] };
  details: { launchDate: string; scienceDays: number; sampleReturn: boolean; power: { battery: { sizedForEclipse_s: number } } };
}

/** The same profile evaluateDesign built, optionally further out (Mission operations runs to its horizon). */
export function powerProfileFor(design: Design, ev: EvaluatedTrajectory, toDay?: number): PowerProfile {
  return powerProfile(
    {
      design,
      jdLaunch: julianDate(ev.details.launchDate),
      flightDays: ev.trajectory.flightDays,
      path: ev.trajectory.path,
      scienceDays: ev.details.scienceDays,
      sampleReturn: ev.details.sampleReturn,
      loads: designLoads(design),
    },
    ev.details.power.battery.sizedForEclipse_s,
    toDay,
  );
}

// ---------------------------------------------------------------------------
// Geometry, memoised: array area, RTG count, propellant and instruments never change it, so Cadet sizing
// (bisection over evaluateDesign) only reruns cheap arithmetic.

const GEOMETRY_CACHE_SIZE = 32;
const geometryCache = new Map<string, GeometryDay[]>();

function geometryKey(p: PowerProfileInput, toDay: number): string {
  const d = p.design;
  const last = p.path[p.path.length - 1];
  return JSON.stringify([
    d.destination,
    p.jdLaunch,
    p.flightDays,
    p.path.length,
    last,
    p.scienceDays,
    p.sampleReturn,
    d.captureOrbit,
    d.scienceOrbit ?? null,
    toDay,
  ]);
}

export function phaseWindows(p: Pick<PowerProfileInput, 'flightDays' | 'scienceDays' | 'sampleReturn'>) {
  return timeline({
    flightDays: p.flightDays,
    scienceDays: p.scienceDays,
    returnDays: p.sampleReturn ? Math.round(p.flightDays) : undefined,
  });
}

function geometry(p: PowerProfileInput, toDay: number): GeometryDay[] {
  const key = geometryKey(p, toDay);
  const hit = geometryCache.get(key);
  if (hit) return hit;
  const tl = phaseWindows(p);
  const arrivalDay = tl.find((w) => w.phase === 'arrival')!.startDay;
  const science = tl.find((w) => w.phase === 'science')!;
  const ret = tl.find((w) => w.phase === 'return');
  const path: CraftPathInput = {
    destination: p.design.destination,
    jdLaunch: p.jdLaunch,
    flightDays: p.flightDays,
    path: p.path,
    scienceEndDay: science.endDay,
    ...(ret ? { returnEndDay: ret.endDay } : {}),
  };
  const orbit = scienceOrbitGeometry(p.design, p.jdLaunch + arrivalDay);
  const out: GeometryDay[] = [];
  for (let day = 0; day <= toDay; day++) {
    const jd = p.jdLaunch + day;
    const phase: PowerPhase = phaseOnDay(tl, day) ?? 'extended';
    const inOrbit = orbit !== undefined && (phase === 'science' || phase === 'extended');
    const ecl = inOrbit ? eclipse(orbit, sunDirection(p.design.destination, jd)) : { fraction: 0, longest_s: 0 };
    out.push({ day, jd, phase, sunDistance_m: craftSunDistance(path, day), eclipseFraction: ecl.fraction, longestEclipse_s: ecl.longest_s });
  }
  if (geometryCache.size >= GEOMETRY_CACHE_SIZE) geometryCache.delete(geometryCache.keys().next().value!);
  geometryCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------

/** Battery capacity (Wh) to carry a load through an eclipse using at most the allowed depth of discharge. */
export function batteryCapacity_Wh(eclipse_s: number, load_W: number, depthOfDischarge = PARTS.power.batteryMaxDepthOfDischarge.value): number {
  return ((eclipse_s / 3600) * load_W) / depthOfDischarge;
}

/** The default plan's load on a day (W): instruments draw only while science is on. */
export function defaultPlanLoad(loads: PowerProfileInput['loads'], phase: PowerPhase, heaterNeed_W: number): number {
  const scienceOn = phase === 'science' || phase === 'extended';
  return loads.bus_W + loads.radio_W + heaterNeed_W + (scienceOn ? loads.instruments_W : 0);
}

/**
 * Power on every day from launch to `toDay` (default: the end of the prime mission).
 * `worstCaseEclipse_s` is the Power section's worst-case eclipse in the science orbit (0 if none), which sizes
 * the battery.
 */
export function powerProfile(p: PowerProfileInput, worstCaseEclipse_s: number, toDay?: number): PowerProfile {
  const tl = phaseWindows(p);
  const arrivalDay = tl.find((w) => w.phase === 'arrival')!.startDay;
  const primeEndDay = tl[tl.length - 1]!.endDay;
  const geo = geometry(p, toDay ?? primeEndDay);
  const heaterBase = p.loads.heaterBase_W;
  const solar = p.design.power.type === 'solar';

  // Pass 1: generation and need (no battery dependence).
  const partial = geo.map((g) => {
    const pw = powerOnDay(p.design, g.jd, g.day / YEAR, 0, heaterBase, g.sunDistance_m);
    return { g, generation_W: pw.available_W, heaterNeed_W: pw.heaters_W, required_W: defaultPlanLoad(p.loads, g.phase, pw.heaters_W) };
  });

  // Battery: worst-case eclipse at the heaviest science-day load, within the depth of discharge.
  const scienceLoads = partial.filter((x) => x.g.phase === 'science').map((x) => x.required_W);
  const load_W = scienceLoads.length ? Math.max(...scienceLoads) : 0;
  const dod = PARTS.power.batteryMaxDepthOfDischarge.value;
  const capacity_Wh = worstCaseEclipse_s > 0 ? batteryCapacity_Wh(worstCaseEclipse_s, load_W, dod) : 0;
  const mass_kg = worstCaseEclipse_s > 0 ? batteryMass(worstCaseEclipse_s, load_W) / dod : 0;

  const days: PowerDay[] = partial.map(({ g, generation_W, heaterNeed_W, required_W }) => {
    const available_W = solar
      ? Math.min(generation_W * (1 - g.eclipseFraction), g.longestEclipse_s > 0 ? capacity_Wh / (g.longestEclipse_s / 3600) : Infinity)
      : generation_W;
    return { ...g, date: isoDate(g.jd), generation_W, available_W, heaterNeed_W, required_W, margin: (available_W - required_W) / required_W };
  });
  return { arrivalDay, primeEndDay, days, battery: { capacity_Wh, mass_kg, sizedForEclipse_s: worstCaseEclipse_s, load_W, depthOfDischarge: dod } };
}

/** The day with the lowest power margin from launch to the end of the prime mission (the earliest, on a tie). */
export function worstPowerDay(profile: PowerProfile): PowerDay {
  const prime = profile.days.filter((d) => d.day <= profile.primeEndDay);
  return prime.reduce((a, b) => (b.margin < a.margin ? b : a));
}

/** Runs of consecutive days with an eclipse, up to `toDay` (default: the end of the prime mission). */
export function eclipseSeasons(profile: PowerProfile, toDay = profile.primeEndDay): EclipseSeasonSummary[] {
  const out: EclipseSeasonSummary[] = [];
  let start: number | undefined;
  const days = profile.days.filter((d) => d.day <= toDay);
  days.forEach((d, i) => {
    const on = d.eclipseFraction > 0;
    if (on && start === undefined) start = i;
    const next = days[i + 1];
    if (start !== undefined && (!next || !(next.eclipseFraction > 0))) {
      const slice = days.slice(start, i + 1);
      out.push({
        startDay: slice[0]!.day,
        endDay: d.day,
        startDate: slice[0]!.date,
        endDate: d.date,
        longestEclipse_s: Math.max(...slice.map((x) => x.longestEclipse_s)),
        maxFraction: Math.max(...slice.map((x) => x.eclipseFraction)),
      });
      start = undefined;
    }
  });
  return out;
}

/** Whether a destination's science orbit can see eclipses at all (orbiters only). */
export const hasScienceOrbit = (design: Design) => DESTINATIONS[design.destination].missionType === 'orbiter';
