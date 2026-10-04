// Spec section: "Scoring". Weighted sum shown openly; margins scored on a band; stars; next-star hint.
// Spec writes Score = 100 Σ wᵢ sᵢ with sᵢ ∈ [0, 100]; that would reach 10,000, so the engine uses
// Score = Σ wᵢ sᵢ (0–100), the same as 100 Σ wᵢ (sᵢ/100).
import { G0, GAME_RULES } from './constants';
import { propellantForDeltaV } from './propulsion';
import { gameEstimate, type Sourced } from './types';

export type Category = 'science' | 'success' | 'budget' | 'deltaV' | 'power' | 'mass' | 'crisis';

const W = (v: number, what: string) => gameEstimate(v, 'weight', `Game rule (spec: Scoring): ${what}`);
export const WEIGHTS: Record<Category, Sourced<number>> = {
  science: W(0.3, 'science return'),
  success: W(0.2, 'mission success'),
  budget: W(0.15, 'budget discipline'),
  deltaV: W(0.1, 'propellant (Δv) margin'),
  power: W(0.1, 'power margin'),
  mass: W(0.1, 'mass margin'),
  crisis: W(0.05, 'crisis handling'),
};

/** Highest possible total score: Σ wᵢ × 100 (= 100 with the weights above). */
export const MAX_SCORE = Object.values(WEIGHTS).reduce((s, w) => s + 100 * w.value, 0);

export const MARGIN_BAND = {
  low: gameEstimate(0.1, 'fraction', 'Game rule (spec: Scoring): 100 inside 10–30% margin'),
  high: gameEstimate(0.3, 'fraction', 'Game rule (spec: Scoring): 100 inside 10–30% margin'),
  zeroAt: gameEstimate(0.8, 'fraction', 'Game rule (spec: Scoring): falls to 0 at 80% margin'),
};

/** Star rules (spec: Scoring, Stars), as Sourced game rules (the Mission Report shows them in Engineer mode). */
export const STAR_RULES = {
  phasesToReachScience: gameEstimate(3, 'phases', 'Game rule (spec: Stars): one star for reaching science, i.e. launch, cruise and arrival completed'),
  scienceForSecondStar: gameEstimate(70, 'score (0–100)', 'Game rule (spec: Stars): a second star at a science score of 70'),
};

export const BUDGET_ZERO_AT_OVERRUN = gameEstimate(0.2, 'fraction over cap', 'Game rule: budget score falls linearly from 100 at the cap to 0 at 20% over');

/** Debrief labels for a category score sᵢ (0–100). Display rule only; the score itself is unchanged. */
export const SCORE_GRADES = {
  strongFrom: gameEstimate(70, 'score (0–100)', 'Game rule: a category score of 70 or more is STRONG'),
  fairFrom: gameEstimate(40, 'score (0–100)', 'Game rule: a category score of 40–69 is FAIR; below 40 is WEAK'),
};

export type Grade = 'strong' | 'fair' | 'weak';

export function scoreGrade(s: number): Grade {
  if (s >= SCORE_GRADES.strongFrom.value) return 'strong';
  if (s >= SCORE_GRADES.fairFrom.value) return 'fair';
  return 'weak';
}

/** 100 inside 10–30%, linear to 0 at 0% and at 80%. */
export function marginBandScore(m: number): number {
  const lo = MARGIN_BAND.low.value;
  const hi = MARGIN_BAND.high.value;
  const zero = MARGIN_BAND.zeroAt.value;
  if (!(m > 0) || m >= zero) return 0;
  if (m < lo) return (100 * m) / lo;
  if (m <= hi) return 100;
  return (100 * (zero - m)) / (zero - hi);
}

export const inBand = (m: number) => m >= MARGIN_BAND.low.value && m <= MARGIN_BAND.high.value;

export function budgetScore(development_M: number, cap_M: number): number {
  if (development_M <= cap_M) return 100;
  return Math.max(0, 100 * (1 - (development_M / cap_M - 1) / BUDGET_ZERO_AT_OVERRUN.value));
}

/** The science goal: everything the instruments produce over the planned science phase (Σ data/day × days). */
export function scienceGoal_Gbit(producedPerDay_bits: number, plannedScienceDays: number): number {
  return (producedPerDay_bits * plannedScienceDays) / 1e9;
}

/** Data downlinked ÷ data the science goal needs, capped at 100. */
export function scienceScore(downlinked_Gbit: number, goal_Gbit: number): number {
  return Math.min(100, (100 * downlinked_Gbit) / goal_Gbit);
}

/** 100 if all phases complete; partial credit per phase reached. */
export function missionSuccessScore(completed: number, total: number): number {
  return (100 * completed) / total;
}

export function totalScore(s: Record<Category, number>): {
  total: number;
  breakdown: { category: Category; weight: number; score: number; contribution: number }[];
} {
  const breakdown = (Object.keys(WEIGHTS) as Category[]).map((category) => ({
    category,
    weight: WEIGHTS[category].value,
    score: s[category],
    contribution: WEIGHTS[category].value * s[category],
  }));
  return { total: breakdown.reduce((a, b) => a + b.contribution, 0), breakdown };
}

export interface EndMargins {
  deltaV: number;
  power: number;
  mass: number;
}

/** Stars, in order: 1 reached the destination and started science; 2 science ≥ 70%; 3 every margin in band. */
export function stars(p: { reachedScience: boolean; scienceScore: number; margins: EndMargins }): number {
  if (!p.reachedScience) return 0;
  if (p.scienceScore < STAR_RULES.scienceForSecondStar.value) return 1;
  if (!(inBand(p.margins.deltaV) && inBand(p.margins.power) && inBand(p.margins.mass))) return 2;
  return 3;
}

/**
 * Propellant that gives Δv capability = required × (1 + targetMargin), from the rocket equation.
 * Concept designs: dry mass grows with propellant (tanks 12%, then the 30% growth margin), solved by iteration.
 */
export function propellantForMargin(p: {
  targetMargin: number;
  required_ms: number;
  isp_s: number;
  dry_kg: number;
  propellant_kg: number;
  asFlown: boolean;
}): number {
  const dv = p.required_ms * (1 + p.targetMargin);
  if (p.asFlown) return propellantForDeltaV(dv, p.isp_s, p.dry_kg);
  const k = (1 + GAME_RULES.massGrowthMargin.value) * GAME_RULES.tankFraction.value;
  const dryBase = p.dry_kg - k * p.propellant_kg;
  const x = Math.exp(dv / (p.isp_s * G0.value)) - 1;
  if (k * x >= 1) return Infinity; // tanks grow faster than the Δv they buy
  return (dryBase * x) / (1 - k * x);
}

const kg = (x: number) => `${Math.round(x)} kg`;

export interface NextStarInput {
  stars: number;
  failedPhase?: string;
  blockers?: string[];
  radioLimited: boolean;
  scienceScore: number;
  margins: EndMargins;
  deltaV: { required_ms: number; capability_ms: number; isp_s: number; dry_kg: number; propellant_kg: number; asFlown: boolean };
  launch: { capacity_kg: number; wet_kg: number };
  power: { available_W: number; required_W: number; type: 'solar' | 'rtg'; arrayArea_m2?: number };
}

/** The Debrief's "For the next star" hint, computed by the engine. */
export function nextStarHint(c: NextStarInput): string {
  return nextStar(c).hint;
}

/** The hint and the score category it is about (the Debrief highlights that row). */
export function nextStar(c: NextStarInput): { hint: string; category?: Category } {
  const r = (category: Category | undefined, hint: string) => (category ? { hint, category } : { hint });
  if (c.stars >= 3) return r(undefined, 'All three stars earned.');
  if (c.stars === 0) {
    if (c.blockers?.length) return r('success', `Fix this first: ${c.blockers[0]}`);
    return r('success', `Reach the destination: the mission was lost in the ${c.failedPhase ?? 'unknown'} phase. Bigger margins lower that phase's risk.`);
  }
  if (c.stars === 1) {
    if (c.radioLimited) return r('science', `Science return is ${Math.round(c.scienceScore)}% and the radio is the limit: a 70 m DSN dish gives about 4.2× the data rate, or use a bigger antenna.`);
    return r('science', `Science return is ${Math.round(c.scienceScore)}%: add science days or instruments to reach 70%.`);
  }
  // Star 3: first margin outside its band.
  const m = c.margins;
  const lo = MARGIN_BAND.low.value;
  const hi = MARGIN_BAND.high.value;
  if (m.deltaV < lo || m.deltaV > hi) {
    const target = m.deltaV < lo ? lo : hi;
    const newProp = propellantForMargin({ targetMargin: target, ...c.deltaV });
    const change = newProp - c.deltaV.propellant_kg;
    if (change > 0) {
      const k = c.deltaV.asFlown ? 0 : (1 + GAME_RULES.massGrowthMargin.value) * GAME_RULES.tankFraction.value;
      const addedWet = change * (1 + k);
      const unused = c.launch.capacity_kg - c.launch.wet_kg;
      return r('deltaV', addedWet <= unused
        ? `Carry ${kg(change)} more propellant for a ${target * 100}% Δv margin — it fits: ${kg(unused)} of launch capacity unused.`
        : `Carry ${kg(change)} more propellant for a ${target * 100}% Δv margin — it does not fit (${kg(unused)} unused launch capacity): choose a bigger rocket or a cheaper capture orbit.`);
    }
    return r('deltaV', `Carry ${kg(-change)} less propellant: a ${hi * 100}% Δv margin is enough.`);
  }
  if (m.power < lo || m.power > hi) {
    const target = m.power < lo ? lo : hi;
    const neededW = c.power.required_W * (1 + target);
    if (c.power.type === 'solar' && c.power.arrayArea_m2) {
      const area = (c.power.arrayArea_m2 * neededW) / c.power.available_W;
      const d = area - c.power.arrayArea_m2;
      return r('power', d > 0
        ? `Add ${d.toFixed(1)} m² of solar array for a ${target * 100}% power margin.`
        : `Remove ${(-d).toFixed(1)} m² of solar array: a ${hi * 100}% power margin is enough.`);
    }
    return r('power', m.power < lo ? 'Add power: another RTG, or lower the power the craft needs.' : 'You carry more power than you need: remove an RTG.');
  }
  if (m.mass < lo) {
    return r('mass', `Cut ${kg(c.launch.wet_kg - (1 - lo) * c.launch.capacity_kg)} of launch mass or choose a bigger rocket for a ${lo * 100}% mass margin.`);
  }
  return r('mass', `${kg(c.launch.capacity_kg - c.launch.wet_kg)} of launch capacity is unused: a smaller rocket, or more payload, puts the mass margin in band.`);
}
