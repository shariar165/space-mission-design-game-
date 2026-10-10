// Typed access to src/data/*.json. Every numeric data value in those files is a Sourced object.
import destinationsJson from '../data/destinations.json';
import hazardsJson from '../data/hazards.json';
import operationsJson from '../data/operations.json';
import launchVehiclesJson from '../data/launchVehicles.json';
import ridesharesJson from '../data/rideshares.json';
import lessonsJson from '../data/lessons.json';
import orbitalElementsJson from '../data/orbitalElements.json';
import partsJson from '../data/parts.json';
import type { DestinationId, Sourced } from './types';

export interface Destination {
  name: string;
  missionType: 'orbiter' | 'rendezvous';
  centralBody: 'sun' | 'earth';
  difficulty: string;
  sunDistance_1e6km: Sourced<number>;
  earthDistance_1e6km?: Sourced<number>;
  perihelion_1e6km?: Sourced<number>;
  aphelion_1e6km?: Sourced<number>;
  minEarthDistance_1e6km?: Sourced<number>;
  maxEarthDistance_1e6km?: Sourced<number>;
  orbitPeriod_days: Sourced<number>;
  synodicPeriod_days?: Sourced<number>;
  gm_km3s2: Sourced<number>;
  radius_km: Sourced<number>;
  sunlightVsEarth: Sourced<number>;
  /** North pole of rotation, J2000 equatorial: [value at J2000, rate per Julian century] in degrees. */
  poleRA_deg?: Sourced<[number, number]>;
  poleDec_deg?: Sourced<[number, number]>;
  /** Radiation belts (Mission operations, Jupiter only): every value is a game estimate. */
  radiation?: {
    doseRateRef_radPerHour: Sourced<number>;
    refRadius_radii: Sourced<number>;
    exponent: Sourced<number>;
    beltOuter_radii: Sourced<number>;
    tolerance_rad: Sourced<number>;
    lossRateAfterTolerance_perDay: Sourced<number>;
  };
  notes: string[];
  fixedRoutes?: Record<string, FixedRouteData>;
}

/** A published real-mission route offered as a fixed option (no gravity-assist simulation). */
export interface FixedRouteData {
  label: string;
  description: string;
  launchDate: Sourced<string>;
  launchC3_km2s2: Sourced<number>;
  dsmDate: Sourced<string>;
  dsmDeltaV_ms: Sourced<number>;
  flybyDate: Sourced<string>;
  approachStartDate: Sourced<string>;
  arrivalDate: Sourced<string>;
}

/** [value at J2000, rate per Julian century] */
type ElementWithRate = [number, number];

export interface JplApproxElements {
  kind: 'jpl-approx';
  a: ElementWithRate;
  e: ElementWithRate;
  I: ElementWithRate;
  L: ElementWithRate;
  varpi: ElementWithRate;
  Omega: ElementWithRate;
}

export interface OsculatingElements {
  kind: 'osculating';
  epochJD: number;
  a: number;
  e: number;
  i: number;
  om: number;
  w: number;
  ma: number;
  n: number;
}

export type EphemerisBody = 'earth' | 'venus' | 'mars' | 'jupiter' | 'bennu';

export const DESTINATIONS = destinationsJson as unknown as Record<DestinationId, Destination>;

export const ORBITAL_ELEMENTS = orbitalElementsJson as unknown as Record<
  EphemerisBody,
  Sourced<JplApproxElements | OsculatingElements>
>;

export interface LaunchVehicle {
  name: string;
  /** [C3 km²/s², payload kg] points, C3 ascending. */
  payloadCurve: Sourced<[number, number][]>;
  flights: Sourced<number>;
  successes: Sourced<number>;
  price_M: Sourced<number>;
}

export const LAUNCH_VEHICLES = launchVehiclesJson as unknown as Record<string, LaunchVehicle>;

/** A real shared launch the player's craft can ride as the secondary payload (spec: Launch vehicles › Rideshare). */
export interface Rideshare {
  name: string;
  vehicleId: string;
  destination: DestinationId;
  primary: string;
  precedent: string;
  precedentUrl: string;
  /** Mass budget allotted to the secondary payload, fuelled. */
  secondarySlot_kg: S;
  /** The primary payload's launch mass. */
  primaryMass_kg: S;
}
export const RIDESHARES = ridesharesJson as unknown as Record<string, Rideshare>;

type S = Sourced<number>;

export interface Bus { name: string; mass_kg: S; power_W: S; heaterBase_W: S; cost_M: S }
export interface Instrument { name: string; mass_kg: S; power_W: S; data_Mbit_per_day: S; cost_M: S }
export interface Engine { name: string; isp_s: S; canCapture: boolean; power_W: S; cost_M: S }

export interface Parts {
  buses: Record<string, Bus>;
  instruments: Record<string, Instrument>;
  engines: Record<string, Engine>;
  power: {
    solarArraySpecificMass_kg_per_m2: S;
    solarArrayCost_M_per_m2: S;
    solarDegradation_perYear: S;
    rtgPower_W: S;
    rtgMass_kg: S;
    rtgCost_M: S;
    batterySpecificEnergy_Wh_per_kg: S;
    batteryMaxDepthOfDischarge: S;
    heaterSunlightFactor: S;
  };
  comms: {
    electronicsMass_kg: S;
    dishArealMass_kg_per_m2: S;
    transmitterMass_kg_per_W: S;
    dcToRfEfficiency: S;
    baseCost_M: S;
    dishCost_M_per_m2: S;
  };
  operations: { opsCost_M_per_year: S };
}

export const PARTS = partsJson as unknown as Parts;

/** Look up a catalogue entry or throw a plain-language error. */
export function lookup<T>(table: Record<string, T>, id: string, what: string): T {
  const v = table[id];
  if (!v) throw new Error(`Unknown ${what}: ${id}`);
  return v;
}

/** Lesson cards for Cadet levels (each fact Sourced), e.g. why Jupiter needs a gravity assist. */
export interface Lesson {
  title: string;
  lesson: Sourced<string>;
}
export const LESSONS = lessonsJson as unknown as Partial<Record<DestinationId, Lesson>>;

/** Mission operations parameters (spec: Mission operations). */
export interface Operations {
  conjunction: { commandThreshold_deg: S };
  solarCycle: { cycle24: Sourced<[string, string]>; cycle25: Sourced<[string, string]>; length_years: S };
  spaceWeather: { strongStormsPerCycle: S; quietToActiveRatio: S; distanceExponent: S };
  marsDust: { globalStormsPerMarsYear: S; seasonStartLs_deg: S; seasonEndLs_deg: S; perihelionLs_deg: S; perihelionLsRate_degPerYear: S };
  debris: { rate_perYear: S };
  reactionWheels: { installed: S; needed: S; weibullShape: S; weibullScale_years: S };
  memory: { baseRate_perYear: S; stormFactor: S; radiationFactor: S };
  power: { coldHazardFactor: S; brownoutDaysToLoss: S };
  recorder: { capacity_Gbit: S };
  dsn: { baseRate_perHour: S; apertureWeight34: S; apertureWeight70: S; contactsPerWeek: S; passOverhead_h: S; bookingLead_days: S };
  team: { reaction_h: S };
  trajectoryCorrections: { cruiseFractions: Sourced<number[]> };
  safeMode: { days: S };
  extension: { optionYears: Sourced<number[]>; approvalScience: S };
  orbitDefaults: { inclination_deg: S; raan_deg: S; argPeriapsis_deg: S };
}
export const OPERATIONS = operationsJson as unknown as Operations;

/** Where a hazard's failure lands: the whole craft, one instrument, the recorder's data, or a spell in safe mode. */
export type FailureEffect = 'craft' | 'instrument' | 'stored-data' | 'safe-mode';
/** Mission phases as Ops sees them: the crisis-card phases plus the extended mission. */
export type OpsPhase = 'launch' | 'cruise' | 'arrival' | 'science' | 'return' | 'extended';

export interface HazardOption {
  id: string;
  label: string;
  cost: { deltaV_ms?: S; scienceDays?: S; budget_M?: S };
  requires?: { powerMargin?: S };
  /** Can be used once per mission (e.g. the backup computer). */
  oneTime?: boolean;
  failureChance: S;
  failureEffect: FailureEffect;
}

export interface Hazard {
  id: string;
  title: string;
  /** Only real data creates it (a live Daily's CME shock): no seeded rate, and not in Pack's danger deck. */
  liveOnly?: boolean;
  destinations: DestinationId[];
  phases: OpsPhase[];
  /** 'earth': seen from Earth before it reaches the craft; 'craft': Earth learns one light time after onset. */
  detectedBy: 'earth' | 'craft';
  warningLead_days: S;
  /** Deadline for a response to reach the craft, in days after onset. */
  deadline_days: S;
  duration_days: S;
  realHistory: Sourced<string>;
  prompt: string;
  /** Empty: no response is possible (the hazard's effect is immediate). */
  options: HazardOption[];
}

export const HAZARDS: Record<string, Hazard> = Object.fromEntries(
  Object.entries(hazardsJson as unknown as Record<string, Omit<Hazard, 'id'>>).map(([id, h]) => [id, { id, ...h }]),
);
