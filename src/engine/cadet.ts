// Cadet mode (spec: "UI rules", Cadet). The guided build offers 2–3 cards per step; each card is a full
// Design run through the same evaluateDesign as everything else. Sizes come from the model itself: the
// smallest array, RTG count or propellant load that reaches a target margin, found by bisection.
// Also here: the chips on each card, the metaphor gauges and the Test Flight checkpoints.
import type { MeterKey } from './compare';
import { REFERENCE_LINK } from './comms';
import { timeline } from './crisis';
import { DESTINATIONS, LAUNCH_VEHICLES, lookup, PARTS } from './data';
import { withArrayArea, withDish, withLauncher, withPowerType, withPropellant, withRtgCount } from './designEdits';
import { evaluateDesign, MONTE_CARLO_SEED, monteCarloMission, type FullEvaluation } from './index';
import { engineBlockers, propellantForDeltaV } from './propulsion';
import type { Phase } from './risk';
import { gameEstimate, sourced, type Design, type DestinationId, type MeterStatus, type Sourced } from './types';

// ---------------------------------------------------------------------------
// Rules (game estimates, listed in TODO_DATA.md)

export type Tier = 'lean' | 'balanced' | 'roomy';

/** Target margins for the sized cards. Lean and balanced sit inside the 10–30% scoring band; roomy is above it. */
export const CADET_TIERS: Record<Tier, Sourced<number>> = {
  lean: gameEstimate(0.1, 'fraction (margin)', 'Game rule (Cadet): "lean" cards are sized for a 10% margin, the bottom of the scoring band'),
  balanced: gameEstimate(0.25, 'fraction (margin)', 'Game rule (Cadet): "balanced" cards are sized for a 25% margin, inside the 10–30% scoring band'),
  roomy: gameEstimate(0.5, 'fraction (margin)', 'Game rule (Cadet): "roomy" cards are sized for a 50% margin, above the band (safe but heavy)'),
};

/** Size of one photo for the "photos sent home per day" gauge. */
export const PHOTO_FRAME_Mbit = gameEstimate(
  8.388608,
  'Mbit per photo',
  'Game estimate: one uncompressed 1024 × 1024 pixel, 8-bit image = 8,388,608 bits',
);

/** One coin on a card or in the budget jar is this fraction of the mission cost cap. */
export const COIN_FRACTION = gameEstimate(0.05, 'fraction of the cost cap', 'Game rule (Cadet): one coin = 5% of the mission cost cap');

/** The three radio dishes offered: small (game option), MAVEN's 2 m and MRO's 3 m. */
export const DISH_SIZES = {
  small: gameEstimate(1, 'm', 'Game option: a small 1 m high-gain antenna'),
  medium: sourced(2, 'm', 'NASA Science: MAVEN (2 m high-gain antenna)', { url: 'https://science.nasa.gov/mission/maven/' }),
  large: REFERENCE_LINK.dishDiameter_m,
} as const;
export type DishSize = keyof typeof DISH_SIZES;

/** Input grid for the sizing search (design inputs, not data): the smallest change a card makes. */
export const KNOB_STEP = { arrayArea: 0.1, rtgCount: 1, propellant: 5 } as const;
const KNOB_RANGE = { arrayArea: [0, 1000], rtgCount: [1, 40], propellant: [0, 30000] } as const;
export type Knob = keyof typeof KNOB_STEP;

/** Science packages: sets of catalogue instruments (design inputs). */
export const SCIENCE_PACKAGES = {
  snapshot: ['camera'],
  explorer: ['camera', 'spectrometer'],
  radar: ['radar', 'spectrometer'],
  fields: ['camera', 'magnetometer'],
  maven: ['maven-science-payload'],
} as const satisfies Record<string, readonly string[]>;
export type SciencePackage = keyof typeof SCIENCE_PACKAGES;

export const PACKAGES_FOR: Record<DestinationId, SciencePackage[]> = {
  moon: ['snapshot', 'explorer', 'radar'],
  venus: ['snapshot', 'explorer', 'radar'],
  mars: ['snapshot', 'explorer', 'maven'],
  bennu: ['snapshot', 'explorer', 'fields'],
  jupiter: ['snapshot', 'fields', 'explorer'],
};

export type PowerOption = 'solar-lean' | 'solar-balanced' | 'rtg';
const POWER_OPTIONS: PowerOption[] = ['solar-lean', 'solar-balanced', 'rtg'];
const FUEL_OPTIONS: Tier[] = ['lean', 'balanced', 'roomy'];

// ---------------------------------------------------------------------------
// Sizing

/**
 * Smallest x on the grid lo, lo + step, … ≤ hi with f(x) ≥ target, for f increasing in x (bisection).
 * Undefined when even f(hi) misses the target.
 */
export function smallestOnGrid(f: (x: number) => number, target: number, lo: number, hi: number, step: number): number | undefined {
  const at = (k: number) => Math.round((lo + k * step) * 1e9) / 1e9;
  let a = 0;
  let b = Math.ceil((hi - lo) / step - 1e-9);
  if (f(at(a)) >= target) return at(a);
  if (f(at(b)) < target) return undefined;
  while (b - a > 1) {
    const m = Math.floor((a + b) / 2);
    if (f(at(m)) >= target) b = m;
    else a = m;
  }
  return at(b);
}

/** The power margin a design must keep: the Power meter's, which is already the worst day of the mission (eclipses included). */
export function worstPowerMargin(ev: FullEvaluation): number {
  return ev.meters.power.margin;
}

const KNOB: Record<Knob, { set: (d: Design, x: number) => Design; margin: (ev: FullEvaluation) => number }> = {
  arrayArea: { set: (d, x) => withArrayArea(withPowerType(d, 'solar'), x), margin: worstPowerMargin },
  rtgCount: { set: (d, x) => withRtgCount(withPowerType(d, 'rtg'), x), margin: worstPowerMargin },
  propellant: { set: withPropellant, margin: (ev) => ev.meters.deltaV.margin },
};

/**
 * The design with the smallest array / RTG count / propellant load that reaches `targetMargin`.
 * If no size in range reaches it, the largest is used, so the gauges show the problem honestly.
 */
export function sizeKnob(design: Design, knob: Knob, targetMargin: number): Design {
  const k = KNOB[knob];
  const [lo, hi] = KNOB_RANGE[knob];
  const x = smallestOnGrid((v) => k.margin(evaluateDesign(k.set(design, v))), targetMargin, lo, hi, KNOB_STEP[knob]);
  return k.set(design, x ?? hi);
}

// ---------------------------------------------------------------------------
// Guided build

export type CadetStep = 'science' | 'power' | 'radio' | 'fuel' | 'rocket';
export const CADET_STEPS: readonly CadetStep[] = ['science', 'power', 'radio', 'fuel', 'rocket'];

/** The card chosen on each step (an option id). */
export type CadetChoices = Record<CadetStep, string>;

export function stepOptionIds(destination: DestinationId, step: CadetStep): string[] {
  switch (step) {
    case 'science':
      return PACKAGES_FOR[destination];
    case 'power':
      return POWER_OPTIONS;
    case 'radio':
      return Object.keys(DISH_SIZES);
    case 'fuel':
      return FUEL_OPTIONS;
    case 'rocket':
      return Object.keys(LAUNCH_VEHICLES);
  }
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The cards that match a starter design, with "balanced" sizing. */
export function defaultChoices(base: Design): CadetChoices {
  const packages = PACKAGES_FOR[base.destination];
  const dishes = Object.entries(DISH_SIZES) as [DishSize, Sourced<number>][];
  const nearestDish = dishes.reduce((best, d) =>
    Math.abs(d[1].value - base.comms.dishDiameter_m) <= Math.abs(best[1].value - base.comms.dishDiameter_m) ? d : best,
  );
  return {
    science: packages.find((p) => sameSet(SCIENCE_PACKAGES[p], base.instrumentIds)) ?? packages[0]!,
    power: base.power.type === 'rtg' ? 'rtg' : 'solar-balanced',
    radio: nearestDish[0],
    fuel: 'balanced',
    rocket: base.launchVehicleId,
  };
}

/**
 * Apply the cards to the starter design. Sizing runs after every choice that changes it: power after the
 * instruments (they set the load), fuel last (it depends on the whole dry mass), so a change on an earlier
 * step never leaves a stale fuel load.
 */
export function buildCadetDesign(base: Design, choices: CadetChoices): Design {
  const pkg = SCIENCE_PACKAGES[choices.science as SciencePackage];
  let d: Design = { ...base, instrumentIds: pkg ? [...pkg] : [...base.instrumentIds] };
  const dish = DISH_SIZES[choices.radio as DishSize];
  if (dish) d = withDish(d, dish.value);
  if (choices.power === 'rtg') d = sizeKnob(d, 'rtgCount', CADET_TIERS.balanced.value);
  else d = sizeKnob(d, 'arrayArea', CADET_TIERS[choices.power === 'solar-lean' ? 'lean' : 'balanced'].value);
  if (LAUNCH_VEHICLES[choices.rocket]) d = withLauncher(d, choices.rocket);
  const tier = CADET_TIERS[choices.fuel as Tier] ?? CADET_TIERS.balanced;
  return sizeKnob(d, 'propellant', tier.value);
}

// ---------------------------------------------------------------------------
// Chips and gauges

export type GaugeKey = 'weight' | 'power' | 'fuel' | 'photos' | 'budget';
export const GAUGE_METER: Record<GaugeKey, MeterKey> = { weight: 'mass', power: 'power', fuel: 'deltaV', photos: 'data', budget: 'cost' };
export const GAUGE_KEYS = Object.keys(GAUGE_METER) as GaugeKey[];

/** What the part on a card weighs, makes and costs (absolute values for that card's design). */
export interface CadetChips {
  mass_kg: number;
  cost_M?: number;
  coins?: number;
  powerMade_W?: number;
  powerUsed_W?: number;
  photosTaken?: number;
  photosSent?: number;
  spareFuel_kg?: number;
  lift_kg?: number;
  flights?: number;
  successes?: number;
}

/** Coins for a cost: ⌈cost / (coin fraction × cap)⌉; nothing for no cost. */
export function coins(cost_M: number, cap_M: number): number {
  if (!(cost_M > 0)) return 0;
  return Math.ceil(cost_M / (COIN_FRACTION.value * cap_M) - 1e-9);
}

const photos = (bits: number) => bits / (PHOTO_FRAME_Mbit.value * 1e6);

function chipsFor(step: CadetStep, design: Design, ev: FullEvaluation): CadetChips {
  const d = ev.details;
  const cap = d.cost.cap_M;
  const withCost = (cost_M: number) => ({ cost_M, coins: coins(cost_M, cap) });
  switch (step) {
    case 'science': {
      const ins = design.instrumentIds.map((id) => lookup(PARTS.instruments, id, 'instrument'));
      return {
        mass_kg: d.massBreakdown.instruments.reduce((s, i) => s + i.kg, 0),
        powerUsed_W: ins.reduce((s, i) => s + i.power_W.value, 0),
        photosTaken: photos(d.data.producedPerDay_bits),
        ...withCost(d.costBreakdown.instruments.reduce((s, i) => s + i.cost_M, 0)),
      };
    }
    case 'power':
      return { mass_kg: d.massBreakdown.powerGeneration + d.massBreakdown.battery, powerMade_W: d.power.available_W, ...withCost(d.costBreakdown.power) };
    case 'radio':
      return {
        mass_kg: d.massBreakdown.comms,
        photosSent: photos(Math.min(d.data.producedPerDay_bits, d.data.downlinkedPerDayAtArrival_bits)),
        ...withCost(d.costBreakdown.comms),
      };
    case 'fuel':
      return {
        mass_kg: d.propellant_kg + d.massBreakdown.tanks,
        spareFuel_kg: d.propellant_kg - propellantForDeltaV(d.deltaVRequired_ms, d.isp_s, d.dryMass_kg),
      };
    case 'rocket': {
      const lv = lookup(LAUNCH_VEHICLES, design.launchVehicleId, 'launch vehicle');
      return { mass_kg: d.wetMass_kg, lift_kg: d.launchCapacity_kg, flights: lv.flights.value, successes: lv.successes.value };
    }
  }
}

export interface CadetOption {
  id: string;
  step: CadetStep;
  chosen: boolean;
  design: Design;
  chips: CadetChips;
  /** Gauges that would be red (over the limit) with this card. */
  redGauges: GaugeKey[];
}

/** The 2–3 cards for one step, each a full design with the other choices kept. */
export function cadetOptions(base: Design, choices: CadetChoices, step: CadetStep): CadetOption[] {
  return stepOptionIds(base.destination, step).map((id) => {
    const design = buildCadetDesign(base, { ...choices, [step]: id });
    const ev = evaluateDesign(design);
    const g = cadetGauges(ev);
    return {
      id,
      step,
      chosen: choices[step] === id,
      design,
      chips: chipsFor(step, design, ev),
      redGauges: GAUGE_KEYS.filter((k) => g[k].status === 'over'),
    };
  });
}

export interface Gauge {
  key: GaugeKey;
  meter: MeterKey;
  status: MeterStatus;
  /** Demand ÷ supply (meter used ÷ limit): above 1 the gauge is over its line. */
  ratio: number;
}

/** Eclipse seasons for the battery gauge: when the planet's shadow sets the power limit, the gauge warns. */
export interface EclipseWarning {
  seasons: number;
  first?: { startDate: string; endDate: string };
  /** Longest single eclipse (s) and the largest share of a day in shadow, over the prime mission. */
  longestEclipse_s: number;
  maxShadowFraction: number;
  /** Power margin on the worst day, and on the worst day with no eclipse. */
  worstMargin: number;
  sunlitMargin: number;
  /** The worst power day is an eclipse day. */
  warn: boolean;
}

export type CadetGauges = Record<Exclude<GaugeKey, 'photos' | 'power'>, Gauge> & {
  power: Gauge & { eclipse: EclipseWarning };
  photos: Gauge & { taken: number; sent: number };
};

export function eclipseWarning(ev: FullEvaluation): EclipseWarning {
  const p = ev.details.power;
  const first = p.eclipseSeasons[0];
  return {
    seasons: p.eclipseSeasons.length,
    ...(first ? { first: { startDate: first.startDate, endDate: first.endDate } } : {}),
    longestEclipse_s: Math.max(0, ...p.eclipseSeasons.map((s) => s.longestEclipse_s)),
    maxShadowFraction: Math.max(0, ...p.eclipseSeasons.map((s) => s.maxFraction)),
    worstMargin: p.worstDay.margin,
    sunlitMargin: p.worstSunlitMargin,
    warn: p.eclipseSeasons.length > 0 && p.worstDay.eclipseFraction > 0,
  };
}

export function cadetGauges(ev: FullEvaluation): CadetGauges {
  const g = (key: GaugeKey): Gauge => {
    const m = ev.meters[GAUGE_METER[key]];
    return { key, meter: GAUGE_METER[key], status: m.status, ratio: m.used / m.limit };
  };
  const data = ev.details.data;
  return {
    weight: g('weight'),
    power: { ...g('power'), eclipse: eclipseWarning(ev) },
    fuel: g('fuel'),
    budget: g('budget'),
    photos: { ...g('photos'), taken: photos(data.producedPerDay_bits), sent: photos(Math.min(data.producedPerDay_bits, data.downlinkedPerDayAtArrival_bits)) },
  };
}

// ---------------------------------------------------------------------------
// Test Flight

export type CheckStatus = 'pass' | 'shaky' | 'fail';
export type CheckReason =
  | 'too-heavy'
  | 'flight-too-long'
  | 'no-power'
  | 'low-power'
  | 'power-fades'
  | 'engine-cannot-capture'
  | 'no-fuel'
  | 'low-fuel'
  | 'radio-limited';

const FAILS: ReadonlySet<CheckReason> = new Set(['too-heavy', 'flight-too-long', 'no-power', 'engine-cannot-capture', 'no-fuel']);

export interface Checkpoint {
  phase: Phase;
  startDay: number;
  endDay: number;
  status: CheckStatus;
  reasons: CheckReason[];
  /** Share of the seeded Monte Carlo flights lost in this phase. */
  lossChance: number;
}

export interface TestFlightResult {
  checkpoints: Checkpoint[];
  /** First phase that fails for certain (a blocker), if any. */
  firstFail?: Phase;
  runs: number;
  seed: number;
  successRate: number;
}

/**
 * Where the mission would fail, before launch. Each blocker is placed in the phase where it bites; thin
 * margins (below the 10% warning, where the risk factor rises above 1) make a phase "shaky". Loss chances
 * come from the seeded Monte Carlo, the same model the flight uses.
 */
export function testFlight(design: Design, opts: { runs?: number; seed?: number } = {}): TestFlightResult {
  const ev = evaluateDesign(design);
  const d = ev.details;
  const m = ev.meters;
  const dest = DESTINATIONS[design.destination];
  const tl = timeline({ flightDays: ev.trajectory.flightDays, scienceDays: d.scienceDays, returnDays: d.sampleReturn ? Math.round(ev.trajectory.flightDays) : undefined });
  const end = d.power.atEndOfScience;
  const tooLong = ev.trajectory.method === 'lambert' && ev.trajectory.maxFlightDays !== undefined && ev.trajectory.flightDays >= ev.trajectory.maxFlightDays;
  const fuel = (): CheckReason[] => (m.deltaV.status === 'over' ? ['no-fuel'] : m.deltaV.status === 'warning' ? ['low-fuel'] : []);
  const power = (): CheckReason[] => (m.power.status === 'over' ? ['no-power'] : m.power.status === 'warning' ? ['low-power'] : []);
  const reasons: Record<Phase, CheckReason[]> = {
    launch: [...(m.mass.status === 'over' ? (['too-heavy'] as const) : []), ...(tooLong ? (['flight-too-long'] as const) : [])],
    cruise: power(),
    arrival: [...(engineBlockers(design.engineId, dest.missionType).length ? (['engine-cannot-capture'] as const) : []), ...fuel()],
    science: [
      ...power().filter((r) => r !== 'no-power'),
      ...(m.data.status !== 'ok' ? (['radio-limited'] as const) : []),
      ...(m.power.status !== 'over' && end.available_W < end.required_W ? (['power-fades'] as const) : []),
    ],
    return: fuel(),
  };
  const runs = opts.runs ?? 200;
  const seed = opts.seed ?? MONTE_CARLO_SEED;
  const mc = monteCarloMission(design, { runs, seed });
  const checkpoints: Checkpoint[] = tl.map((w) => {
    const r = reasons[w.phase];
    return {
      phase: w.phase,
      startDay: w.startDay,
      endDay: w.endDay,
      status: r.some((x) => FAILS.has(x)) ? 'fail' : r.length ? 'shaky' : 'pass',
      reasons: r,
      lossChance: (mc.failuresByPhase[w.phase] ?? 0) / runs,
    };
  });
  const firstFail = checkpoints.find((c) => c.status === 'fail')?.phase;
  return { checkpoints, ...(firstFail ? { firstFail } : {}), runs, seed, successRate: mc.successRate };
}
