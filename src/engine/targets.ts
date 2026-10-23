// Mars science targets (spec: Science targets and downlink). Typed access to src/data/targets.json: the six
// targets with their real NASA images, the moons' orbits, the MAVEN-fitted upper atmosphere, the deep dip,
// the science camera and the globe's surface map. The physics that prices an observation is in science.ts.
import targetsJson from '../data/targets.json';
import type { Sourced } from './types';

export type TargetKind = 'surface' | 'moon' | 'limb';
export type MoonId = 'phobos' | 'deimos';

export interface TargetImage {
  /** NASA Photojournal id. */
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
  /** Surface targets: planetocentric latitude and east longitude (−180…180). */
  lat_deg?: Sourced<number>;
  lon_deg?: Sourced<number>;
  /** Moon targets. */
  moon?: MoonId;
  learn: Sourced<string>;
  /** Share of the mission's science (the six sum to 1). */
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

interface TargetsData {
  targets: Target[];
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
  camera: {
    ifov_urad: Sourced<number>;
    power_W: Sourced<number>;
    imaging_h: Sourced<number>;
    dustRepeats: Sourced<number>;
    dustSeasonRepeats: Sourced<number>;
  };
  globe: { file: string; title: string; credit: string; lon0_deg: Sourced<number>; usage: Sourced<string> };
}

const DATA = targetsJson as unknown as TargetsData;

export const TARGETS: Target[] = DATA.targets;
export const MARS_MOONS = DATA.moons;
export const MARS_ATMOSPHERE = DATA.atmosphere;
export const DEEP_DIP = DATA.deepDip;
export const SCIENCE_CAMERA = DATA.camera;
export const MARS_GLOBE = DATA.globe;
export const TARGET_HEIGHTS = DATA.heights;

export const targetById = (id: string): Target | undefined => TARGETS.find((t) => t.id === id);

/** Facts the target cards quote, computed from their Sourced inputs. */
export function targetFacts() {
  const ratio = TARGET_HEIGHTS.olympusMons_km.value / TARGET_HEIGHTS.everest_km.value;
  return { olympusVsEverest: Math.round(ratio * 10) / 10 };
}
