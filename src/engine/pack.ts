// Signal Delay Pack (spec: UI rules, Pack). The rocket nose is a backpack: every part takes squares (volume),
// and mass is a separate limit read from the launch meter. A packed part changes the design that evaluateDesign
// and Mission operations fly: instruments, the dish, array area, propellant, battery size, or a protection
// (pack.json). The danger deck shows which dangers those effects touch; the launch calendar rates each day with
// the same launch and Δv meters. Pure functions; no numbers are made up here.
import packJson from '../data/pack.json';
import { DISH_SIZES, PACKAGES_FOR, SCIENCE_PACKAGES } from './cadet';
import { DESTINATIONS, HAZARDS, LAUNCH_VEHICLES, lookup, RIDESHARES } from './data';
import type { FullEvaluation } from './index';
import { launchMassCheck, rideshareMassCheck } from './launch';
import { marginStatus } from './meter';
import { arrivalDeltaV, bestArrival, maxFlightDays, transferForDesign } from './trajectory';
import type { Design, DesignKit, DestinationId, MeterStatus, Sourced } from './types';

type S = Sourced<number>;
interface PartBase {
  kind: 'bus' | 'engine' | 'instrument' | 'dish' | 'power' | 'battery' | 'propellant' | 'kit';
  locked?: boolean;
  w: S;
  h: S;
  /** Dangers this part's effect touches (hazard types, or 'eclipse' / 'conjunction'). */
  covers: string[];
  instrumentId?: string;
  extraArrayArea_m2?: S;
  extraRtg?: S;
  batteryFactor?: S;
  extraPropellant?: S;
  mass_kg?: S;
  coldFactor?: S;
  hazardFactor?: Record<string, S>;
  autopilot?: boolean;
}

export type PartId =
  | 'computer'
  | 'engine'
  | 'camera'
  | 'spectrometer'
  | 'magnetometer'
  | 'radar'
  | 'sniffer'
  | 'dish'
  | 'solar'
  | 'battery'
  | 'tank'
  | 'heater'
  | 'shield'
  | 'bumper'
  | 'spare'
  | 'autopilot';

export const PACK = packJson as unknown as {
  grid: { cols: S; rows: S };
  coverage: { covered: S; some: S };
  calendar: { days: S; before: S; searchStep: S };
  parts: Record<PartId, PartBase>;
};

export interface Placed {
  id: PartId;
  r: number;
  c: number;
}
export type Packed = Placed[];

const COLS = () => PACK.grid.cols.value;
const ROWS = () => PACK.grid.rows.value;
const part = (id: PartId) => PACK.parts[id];
const INSTRUMENT_PART: Record<string, PartId> = Object.fromEntries(
  (Object.entries(PACK.parts) as [PartId, PartBase][]).filter(([, p]) => p.instrumentId).map(([id, p]) => [p.instrumentId!, id]),
);

// ---------------------------------------------------------------------------
// The nose (volume)

function occupied(packed: Packed): boolean[][] {
  const g = Array.from({ length: ROWS() }, () => Array<boolean>(COLS()).fill(false));
  for (const q of packed) {
    const p = part(q.id);
    for (let r = 0; r < p.h.value; r++) for (let c = 0; c < p.w.value; c++) if (g[q.r + r]) g[q.r + r]![q.c + c] = true;
  }
  return g;
}

/** The first free slot for a part, row by row (as the design), or undefined if it has no room. */
export function fitPart(packed: Packed, id: PartId): { r: number; c: number } | undefined {
  const p = part(id);
  const g = occupied(packed);
  for (let r = 0; r <= ROWS() - p.h.value; r++)
    for (let c = 0; c <= COLS() - p.w.value; c++) {
      let free = true;
      for (let i = 0; i < p.h.value && free; i++) for (let j = 0; j < p.w.value; j++) if (g[r + i]![c + j]) free = false;
      if (free) return { r, c };
    }
  return undefined;
}

/** Pack a part in its first free slot. The same pack if it is already packed; undefined if there is no room. */
export function packPart(packed: Packed, id: PartId): Packed | undefined {
  if (packed.some((q) => q.id === id)) return packed;
  const at = fitPart(packed, id);
  return at ? [...packed, { id, ...at }] : undefined;
}

export const unpackPart = (packed: Packed, id: PartId): Packed => (part(id).locked ? packed : packed.filter((q) => q.id !== id));

export function noseSquares(packed: Packed): { used: number; free: number; total: number } {
  const total = COLS() * ROWS();
  const used = packed.reduce((a, q) => a + part(q.id).w.value * part(q.id).h.value, 0);
  return { used, free: total - used, total };
}

export const footprint = (id: PartId) => ({ w: part(id).w.value, h: part(id).h.value, squares: part(id).w.value * part(id).h.value });

// ---------------------------------------------------------------------------
// Shelf and the packed craft

/** The parts a destination offers: the locked computer and engine, its instruments, and every extra that applies. */
export function shelfFor(destination: DestinationId): PartId[] {
  const instruments = [...new Set(PACKAGES_FOR[destination].flatMap((p) => SCIENCE_PACKAGES[p]))].map((i) => INSTRUMENT_PART[i]).filter((x): x is PartId => !!x);
  const extras: PartId[] = ['dish', 'solar', 'battery', 'tank', 'heater', 'shield', 'spare', 'autopilot'];
  if (HAZARDS.debris?.destinations.includes(destination)) extras.splice(6, 0, 'bumper');
  return ['computer', 'engine', ...instruments, ...extras];
}

/** The starting pack: the locked parts, then the starter design's own instruments (in order, where they fit). */
export function initialPack(base: Design, shelf: PartId[]): Packed {
  let p: Packed = [];
  for (const id of shelf.filter((x) => part(x).locked)) p = packPart(p, id) ?? p;
  for (const inst of base.instrumentIds) {
    const id = INSTRUMENT_PART[inst];
    if (id && shelf.includes(id)) p = packPart(p, id) ?? p;
  }
  return p;
}

/** The design the packed nose flies: the base design with each part's effect applied (pack.json). */
export function buildPackDesign(base: Design, packed: Packed): Design {
  const has = (id: PartId) => packed.some((q) => q.id === id);
  const ids = packed.map((q) => q.id);
  const instrumentIds = ids.map((id) => part(id).instrumentId).filter((x): x is string => !!x);
  let d: Design = { ...base, instrumentIds, power: { ...base.power }, comms: { ...base.comms } };
  if (has('dish')) d.comms.dishDiameter_m = DISH_SIZES.large.value;
  if (has('solar')) {
    const s = part('solar');
    if (d.power.type === 'rtg') d.power.rtgCount = (d.power.rtgCount ?? 0) + s.extraRtg!.value;
    else d.power.arrayArea_m2 = (d.power.arrayArea_m2 ?? 0) + s.extraArrayArea_m2!.value;
  }
  if (has('tank')) d = { ...d, propellant_kg: base.propellant_kg * (1 + part('tank').extraPropellant!.value) };
  const kit: DesignKit = {};
  if (has('battery')) kit.batteryFactor = part('battery').batteryFactor!.value;
  const extraMass = ids.reduce((a, id) => a + (part(id).kind === 'kit' ? part(id).mass_kg!.value : 0), 0);
  if (extraMass > 0) kit.extraMass_kg = extraMass;
  for (const id of ids) {
    const p = part(id);
    if (p.coldFactor) kit.coldFactor = p.coldFactor.value;
    if (p.autopilot) kit.autopilot = true;
    if (p.hazardFactor) kit.hazardFactor = { ...kit.hazardFactor, ...Object.fromEntries(Object.entries(p.hazardFactor).map(([k, v]) => [k, v.value])) };
  }
  if (Object.keys(kit).length) d.kit = kit;
  else delete d.kit;
  return d;
}

// ---------------------------------------------------------------------------
// Blockers: each one names the limit that failed

export type PackBlockerCode = 'too-heavy' | 'no-power' | 'no-fuel' | 'no-capture' | 'flight-too-long' | 'no-science' | 'other';
export interface PackBlocker {
  code: PackBlockerCode;
  /** The engine's own sentence (with its numbers), for Engineer mode. */
  engine?: string;
}

export function packBlockers(packed: Packed, ev: FullEvaluation): PackBlocker[] {
  const out: PackBlocker[] = [];
  if (!packed.some((q) => part(q.id).kind === 'instrument')) out.push({ code: 'no-science' });
  for (const b of ev.blockers) {
    const code: PackBlockerCode = /too heavy|cannot reach C3|secondary slot/i.test(b)
      ? 'too-heavy'
      : /power/i.test(b)
        ? 'no-power'
        : /propellant|Δv/i.test(b)
          ? 'no-fuel'
          : /capture|cannot brake|ion/i.test(b)
            ? 'no-capture'
            : /revolution|loop/i.test(b)
              ? 'flight-too-long'
              : 'other';
    out.push({ code, engine: b });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Danger deck

export interface DeckCard {
  id: string;
  kind: 'eclipse' | 'conjunction' | 'hazard';
  /** Hazards: warned by Earth first, or found by the craft. */
  detectedBy?: 'earth' | 'craft';
  parts: PartId[];
  stamp: 'covered' | 'some' | 'none';
}

/** The destination's dangers, foreseeable first, and which packed parts cover each (game rule thresholds). */
export function dangerDeck(destination: DestinationId, packed: Packed): DeckCard[] {
  const dest = DESTINATIONS[destination];
  const cards: Omit<DeckCard, 'parts' | 'stamp'>[] = [];
  if (dest.missionType === 'orbiter') cards.push({ id: 'eclipse', kind: 'eclipse' });
  if (destination !== 'moon') cards.push({ id: 'conjunction', kind: 'conjunction' });
  for (const [id, h] of Object.entries(HAZARDS)) {
    if (h.options.length && !h.liveOnly && h.destinations.includes(destination)) cards.push({ id, kind: 'hazard', detectedBy: h.detectedBy });
  }
  return cards.map((c) => {
    const parts = packed.map((q) => q.id).filter((id) => part(id).covers.includes(c.id));
    const stamp = parts.length >= PACK.coverage.covered.value ? 'covered' : parts.length >= PACK.coverage.some.value ? 'some' : 'none';
    return { ...c, parts, stamp };
  });
}

/** Parts on the shelf that cover a danger (for the hover links). */
export const partsCovering = (shelf: PartId[], danger: string) => shelf.filter((id) => part(id).covers.includes(danger));
export const coversOf = (id: PartId) => [...part(id).covers];

// ---------------------------------------------------------------------------
// Launch calendar

export interface CalendarDay {
  date: string;
  /** Lowest-energy arrival for that launch day (Moon: the fixed transfer). */
  arrivalDate?: string;
  c3?: number;
  vInfArr_ms?: number;
  flightDays?: number;
}

const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

/** The calendar's transfers: PACK.calendar.days launch days, starting `before` days ahead of the best one. */
export function calendarTransfers(destination: DestinationId, bestDate: string): CalendarDay[] {
  const n = PACK.calendar.days.value;
  const start = -PACK.calendar.before.value;
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(bestDate, start + i);
    if (destination === 'moon') {
      const t = transferForDesign({ destination, launchDate: date, arrivalDate: date });
      return { date, arrivalDate: date, c3: t.c3_km2s2, vInfArr_ms: t.vInfArr_ms, flightDays: t.flightDays };
    }
    try {
      const t = bestArrival(destination, date, { stepDays: PACK.calendar.searchStep.value });
      return { date, arrivalDate: t.arrivalDate, c3: t.c3_km2s2, vInfArr_ms: t.vInfArr_ms, flightDays: t.flightDays };
    } catch {
      return { date };
    }
  });
}

export interface DayQuality {
  quality: 'good' | 'soso' | 'bad';
  massMargin?: number;
  deltaVMargin?: number;
  capacity_kg?: number;
}

const QUALITY: Record<MeterStatus, DayQuality['quality']> = { ok: 'good', warning: 'soso', over: 'bad' };

/**
 * How a launch day suits the packed craft: the launch meter at that day's C3 and the Δv meter with that day's
 * arrival burn (the rest of the budget is the same). Quality is the worse status: ok → good, warning → so-so,
 * over (or no transfer) → bad.
 */
export function dayQuality(design: Design, ev: FullEvaluation, day: CalendarDay): DayQuality {
  if (day.c3 === undefined || day.vInfArr_ms === undefined || day.flightDays === undefined) return { quality: 'bad' };
  if (design.destination !== 'moon' && day.flightDays >= maxFlightDays(design.destination)) return { quality: 'bad' };
  const lv = lookup(LAUNCH_VEHICLES, design.launchVehicleId, 'launch vehicle');
  const wet = ev.details.wetMass_kg;
  const ride = design.rideshareId ? RIDESHARES[design.rideshareId] : undefined;
  const launch = ride
    ? rideshareMassCheck(lv.payloadCurve.value, day.c3, wet, ride.secondarySlot_kg.value, ride.primaryMass_kg.value)
    : launchMassCheck(lv.payloadCurve.value, day.c3, wet);
  const need = ev.details.deltaVRequired_ms - ev.details.deltaVBudget.arrival_ms + arrivalDeltaV(design.destination, day.vInfArr_ms, design.captureOrbit);
  const dvMargin = (ev.details.deltaVCapability_ms - need) / need;
  const worst = Math.min(launch.meter.margin, dvMargin);
  return { quality: QUALITY[marginStatus(worst)], massMargin: launch.meter.margin, deltaVMargin: dvMargin, capacity_kg: launch.meter.limit };
}

/** The design flown from a calendar day. */
export function onDay(design: Design, day: CalendarDay): Design {
  return { ...design, launchDate: day.date, arrivalDate: day.arrivalDate ?? day.date };
}
