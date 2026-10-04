// Typed access to src/data/*.json. Every numeric data value in those files is a Sourced object.
import destinationsJson from '../data/destinations.json';
import launchVehiclesJson from '../data/launchVehicles.json';
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
