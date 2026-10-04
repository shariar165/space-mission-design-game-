// Spec section: "Mass and cost". Mass roll-up with concept growth margin; development cost vs class cap.
import { GAME_RULES } from './constants';
import { LAUNCH_VEHICLES, lookup, PARTS, RIDESHARES } from './data';
import { rideshareLaunchPrice } from './launch';
import { makeMeter } from './meter';
import { tankMass } from './propulsion';
import { gameEstimate, sourced, type Design, type Meter, type MissionClass, type Sourced } from './types';

/** Caps on development cost (Phases A–D); launch vehicle and operations (Phases E–F) are excluded. */
export const COST_CAPS: Record<MissionClass, Sourced<number>> = {
  discovery: sourced(500, '$M (FY2019)', 'NASA Discovery 2019 AO overview (excludes launch vehicle, Phases E–F, contributions)', {
    url: 'https://discovery.larc.nasa.gov/PDF_FILES/03a_Brown_Overview.pdf',
  }),
  newFrontiers: gameEstimate(
    850,
    '$M',
    'Approx. from SpaceNews on the New Frontiers 4 AO; replace with the NASA AO itself (excludes launch and operations)',
    'https://spacenews.com/?p=64699',
  ),
};

export interface ComponentMasses {
  bus: number;
  instruments: number[];
  power: number;
  comms: number;
  tanks: number;
  /** Packed extras with no other model (Signal Delay kit); 0 for every other design. */
  kit?: number;
}

/** m_dry = (1 + k_margin)(m_bus + Σ m_instruments + m_power + m_comms + m_tanks + m_kit), k_margin = 0.30. */
export function massRollup(c: ComponentMasses): { subtotal_kg: number; growthMargin_kg: number; dry_kg: number } {
  const subtotal_kg = c.bus + c.instruments.reduce((a, b) => a + b, 0) + c.power + c.comms + c.tanks + (c.kit ?? 0);
  const k = GAME_RULES.massGrowthMargin.value;
  return { subtotal_kg, growthMargin_kg: k * subtotal_kg, dry_kg: (1 + k) * subtotal_kg };
}

/** m_wet = m_dry + m_prop */
export function wetMass(dry_kg: number, propellant_kg: number): number {
  return dry_kg + propellant_kg;
}

const dishArea = (d_m: number) => Math.PI * (d_m / 2) ** 2;

/** Component masses for a design, read from the parts catalogue. Battery mass comes from power.ts. */
export function componentMasses(design: Design, batteryMass_kg: number): ComponentMasses {
  const bus = lookup(PARTS.buses, design.busId, 'bus');
  const p = PARTS.power;
  const c = PARTS.comms;
  const generation =
    design.power.type === 'solar'
      ? (design.power.arrayArea_m2 ?? 0) * p.solarArraySpecificMass_kg_per_m2.value
      : (design.power.rtgCount ?? 0) * p.rtgMass_kg.value;
  return {
    bus: bus.mass_kg.value,
    instruments: design.instrumentIds.map((id) => lookup(PARTS.instruments, id, 'instrument').mass_kg.value),
    power: generation + batteryMass_kg,
    comms:
      c.electronicsMass_kg.value +
      c.dishArealMass_kg_per_m2.value * dishArea(design.comms.dishDiameter_m) +
      c.transmitterMass_kg_per_W.value * design.comms.txPower_W,
    tanks: tankMass(design.propellant_kg),
    ...(design.kit?.extraMass_kg ? { kit: design.kit.extraMass_kg } : {}),
  };
}

export interface CostBreakdown {
  bus: number;
  instruments: { id: string; cost_M: number }[];
  engine: number;
  power: number;
  comms: number;
}

/** Development cost of each part group ($M). All part costs are game estimates until sourced. */
export function costBreakdown(design: Design): CostBreakdown {
  const p = PARTS.power;
  const c = PARTS.comms;
  return {
    bus: lookup(PARTS.buses, design.busId, 'bus').cost_M.value,
    instruments: design.instrumentIds.map((id) => ({ id, cost_M: lookup(PARTS.instruments, id, 'instrument').cost_M.value })),
    engine: lookup(PARTS.engines, design.engineId, 'engine').cost_M.value,
    power:
      design.power.type === 'solar'
        ? (design.power.arrayArea_m2 ?? 0) * p.solarArrayCost_M_per_m2.value
        : (design.power.rtgCount ?? 0) * p.rtgCost_M.value,
    comms: c.baseCost_M.value + c.dishCost_M_per_m2.value * dishArea(design.comms.dishDiameter_m),
  };
}

/** Development cost (Phases A–D) = Σ part costs. */
export function developmentCost(design: Design): number {
  const b = costBreakdown(design);
  return b.bus + b.instruments.reduce((s, i) => s + i.cost_M, 0) + b.engine + b.power + b.comms;
}

/** Development cost vs cap. Margin = (cap − development)/cap. */
export function costMeter(development_M: number, cap_M: number, inputs: Record<string, Sourced<number>>): Meter {
  return makeMeter(
    development_M,
    cap_M,
    (cap_M - development_M) / cap_M,
    'Development (Phases A–D) = Σ part costs; margin = (cap − development)/cap. Launch and operations are counted separately.',
    inputs,
  );
}

/**
 * Development, launch and operations cost. On a rideshare the launch price is the secondary's share, which
 * needs the craft's wet mass (evaluateDesign passes it).
 */
export function costEvaluation(design: Design, opts: { wet_kg?: number } = {}): {
  meter: Meter;
  development_M: number;
  launch_M: number;
  operations_M: number;
  total_M: number;
} {
  const cap = COST_CAPS[design.missionClass ?? 'discovery'];
  const development_M = developmentCost(design);
  const lv = lookup(LAUNCH_VEHICLES, design.launchVehicleId, 'launch vehicle');
  const ride = design.rideshareId ? RIDESHARES[design.rideshareId] : undefined;
  const launch_M =
    ride && opts.wet_kg !== undefined ? rideshareLaunchPrice(lv.price_M.value, opts.wet_kg, ride.primaryMass_kg.value) : lv.price_M.value;
  const launchPrice: Sourced<number> =
    launch_M === lv.price_M.value
      ? lv.price_M
      : gameEstimate(launch_M, '$M', `Game rule: the secondary pays a mass-proportional share of the ${lv.name} price, price × m_wet / (m_wet + m_primary)`);
  const operations_M = PARTS.operations.opsCost_M_per_year.value * ((design.scienceDays ?? 365) / 365.25);
  return {
    meter: { ...costMeter(development_M, cap.value, { cap, launchPrice, opsPerYear: PARTS.operations.opsCost_M_per_year }), limitSource: cap },
    development_M,
    launch_M,
    operations_M,
    total_M: development_M + launch_M + operations_M,
  };
}
