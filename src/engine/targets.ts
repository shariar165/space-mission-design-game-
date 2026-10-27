// Science targets (spec: Science targets and downlink; Moon orbit, Targets). Typed access to the target sets:
// src/data/targets.json (Mars: the six targets with their real NASA images, the moons' orbits, the MAVEN-fitted
// upper atmosphere, the deep dip, the science camera and the globe's surface map) and src/data/moonTargets.json
// (Moon 3: four targets with LROC pictures, LROC's Narrow Angle Camera and the Moon map). The physics that prices
// an observation is in science.ts.
import targetsJson from '../data/targets.json';
import moonTargetsJson from '../data/moonTargets.json';
import type { DestinationId, Sourced } from './types';

export type TargetBody = 'mars' | 'moon';
export type TargetKind = 'surface' | 'moon' | 'limb';
export type MoonId = 'phobos' | 'deimos';

export interface TargetImage {
  /** NASA Photojournal id (Mars), or the LROC product id of a PDS frame (Moon). */
  nasaId: string;
  title: string;
  /** Path under the site root (public/). */
  file: string;
  credit: string;
  mission: string;
  usage: Sourced<string>;
}

export interface Target {
  id: string;
  name: string;
  kind: TargetKind;
  /** The body the target belongs to (set from its target set). */
  body: TargetBody;
  /** Surface targets: latitude and east longitude (−180…180). */
  lat_deg?: Sourced<number>;
  lon_deg?: Sourced<number>;
  /** Moon targets (Mars' moons). */
  moon?: MoonId;
  learn: Sourced<string>;
  /** Share of the mission's science (each set sums to 1). */
  weight: Sourced<number>;
  /** Ground resolution the picture needs. */
  resolution_m: Sourced<number>;
  image_Mbit: Sourced<number>;
  /** A hazy target: shot again until one frame is clear (costs power). */
  dust: boolean;
  image: TargetImage;
}

export interface MarsMoon {
  name: string;
  a_km: Sourced<number>;
  period_days: Sourced<number>;
}

export interface ScienceCamera {
  ifov_urad: Sourced<number>;
  power_W: Sourced<number>;
  imaging_h: Sourced<number>;
  /** Mars only: repeat passes for a hazy target, outside and inside the dust season. */
  dustRepeats?: Sourced<number>;
  dustSeasonRepeats?: Sourced<number>;
}

export interface GlobeMap {
  file: string;
  title: string;
  credit: string;
  lon0_deg: Sourced<number>;
  usage: Sourced<string>;
}

/** One body's targets, the camera that shoots them and the globe they sit on. */
export interface TargetSet {
  body: TargetBody;
  targets: Target[];
  camera: ScienceCamera;
  globe: GlobeMap;
  /** The lowest periapsis an observing pass may fly (Moon: the bottom of LRO's band; Mars: SCIENCE_RULES). */
  lowestAlt_km?: Sourced<number>;
}

interface MarsData {
  targets: Omit<Target, 'body'>[];
  heights: { olympusMons_km: Sourced<number>; everest_km: Sourced<number> };
  moons: Record<MoonId, MarsMoon>;
  atmosphere: {
    nominalAlt_km: Sourced<number>;
    nominalDensity_kgkm3: Sourced<number>;
    deepAlt_km: Sourced<number>;
    deepDensity_kgkm3: Sourced<number>;
    dragCoefficient: Sourced<number>;
  };
  deepDip: { alt_km: Sourced<number>; days: Sourced<number> };
  camera: ScienceCamera;
  globe: GlobeMap;
}

interface MoonData {
  targets: Omit<Target, 'body'>[];
  camera: ScienceCamera;
  lowestAlt_km: Sourced<number>;
  globe: GlobeMap;
}

const DATA = targetsJson as unknown as MarsData;
const MOON_DATA = moonTargetsJson as unknown as MoonData;

const withBody = (body: TargetBody, ts: Omit<Target, 'body'>[]): Target[] => ts.map((t) => ({ ...t, body }));

export const TARGET_SETS: Record<TargetBody, TargetSet> = {
  mars: { body: 'mars', targets: withBody('mars', DATA.targets), camera: DATA.camera, globe: DATA.globe },
  moon: { body: 'moon', targets: withBody('moon', MOON_DATA.targets), camera: MOON_DATA.camera, globe: MOON_DATA.globe, lowestAlt_km: MOON_DATA.lowestAlt_km },
};

/** The Mars targets (the six of the design). */
export const TARGETS: Target[] = TARGET_SETS.mars.targets;
export const MARS_MOONS = DATA.moons;
export const MARS_ATMOSPHERE = DATA.atmosphere;
export const DEEP_DIP = DATA.deepDip;
export const SCIENCE_CAMERA = DATA.camera;
export const MARS_GLOBE = DATA.globe;
export const TARGET_HEIGHTS = DATA.heights;

/** The target set of a destination, if it has one. */
export const targetSetFor = (dest: DestinationId): TargetSet | undefined => (dest === 'mars' || dest === 'moon' ? TARGET_SETS[dest] : undefined);

const ALL_TARGETS = [...TARGET_SETS.mars.targets, ...TARGET_SETS.moon.targets];
export const targetById = (id: string): Target | undefined => ALL_TARGETS.find((t) => t.id === id);

/** Facts the target cards quote, computed from their Sourced inputs. */
export function targetFacts() {
  const ratio = TARGET_HEIGHTS.olympusMons_km.value / TARGET_HEIGHTS.everest_km.value;
  return { olympusVsEverest: Math.round(ratio * 10) / 10 };
}
