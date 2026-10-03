// Real-mission presets (MAVEN, OSIRIS-REx, LRO). Each value in missions.json is Sourced; this turns a
// preset into a plain Design so it runs through exactly the same engine as the player's craft.
import missionsJson from '../data/missions.json';
import type { Design, Sourced } from './types';

type S<T> = Sourced<T>;

interface PresetDesign {
  destination: S<Design['destination']>;
  launchVehicleId: S<string>;
  launchDate: S<string>;
  arrivalDate: S<string>;
  busId: S<string>;
  instrumentIds: S<string[]>;
  power: { type: S<'solar' | 'rtg'>; arrayArea_m2?: S<number>; rtgCount?: S<number> };
  comms: { dishDiameter_m: S<number>; txPower_W: S<number>; groundDish_m: S<34 | 70> };
  engineId: S<string>;
  propellant_kg: S<number>;
  captureOrbit: { periapsis_km: S<number>; apoapsis_km: S<number> };
  asFlownDryMass_kg?: S<number>;
  scienceDays?: S<number>;
  missionClass?: S<NonNullable<Design['missionClass']>>;
  lifetimeDays?: S<number>;
  scienceOrbit?: { periapsis_km: S<number>; apoapsis_km: S<number> };
  trajectoryOption?: S<NonNullable<Design['trajectoryOption']>>;
}

export interface MissionPreset {
  label: string;
  history: string;
  historyUrl?: string;
  design: PresetDesign;
  published: Record<string, S<number>>;
}

export type MissionId = 'maven' | 'osiris-rex';

const MISSIONS = missionsJson as unknown as Record<MissionId, MissionPreset> & { lro: unknown };

export function missionPreset(id: MissionId): MissionPreset {
  return MISSIONS[id];
}

/** The preset as a player Design (Sourced wrappers removed; sources stay in the preset). */
export function presetDesign(id: MissionId): Design {
  const d = MISSIONS[id].design;
  const design: Design = {
    destination: d.destination.value,
    launchVehicleId: d.launchVehicleId.value,
    launchDate: d.launchDate.value,
    arrivalDate: d.arrivalDate.value,
    busId: d.busId.value,
    instrumentIds: d.instrumentIds.value,
    power: { type: d.power.type.value },
    comms: {
      dishDiameter_m: d.comms.dishDiameter_m.value,
      txPower_W: d.comms.txPower_W.value,
      groundDish_m: d.comms.groundDish_m.value,
    },
    engineId: d.engineId.value,
    propellant_kg: d.propellant_kg.value,
    captureOrbit: { periapsis_km: d.captureOrbit.periapsis_km.value, apoapsis_km: d.captureOrbit.apoapsis_km.value },
  };
  if (d.power.arrayArea_m2) design.power.arrayArea_m2 = d.power.arrayArea_m2.value;
  if (d.power.rtgCount) design.power.rtgCount = d.power.rtgCount.value;
  if (d.asFlownDryMass_kg) design.asFlownDryMass_kg = d.asFlownDryMass_kg;
  if (d.scienceDays) design.scienceDays = d.scienceDays.value;
  if (d.missionClass) design.missionClass = d.missionClass.value;
  if (d.lifetimeDays) design.lifetimeDays = d.lifetimeDays.value;
  if (d.scienceOrbit) {
    design.scienceOrbit = { periapsis_km: d.scienceOrbit.periapsis_km.value, apoapsis_km: d.scienceOrbit.apoapsis_km.value };
  }
  if (d.trajectoryOption) design.trajectoryOption = d.trajectoryOption.value;
  return design;
}
