// Mission objectives (spec: Mission objectives). A Mars flight picks atmosphere, surface or moons. With one of the
// objective's instruments packed, its targets carry OBJECTIVE_RULES.share of the science; without one they count at
// the same rate as every other target, so the objective rewards the craft built for it. No objective (the Moon, the
// Daily, real missions) keeps each target's own weight.
import objectivesJson from '../data/objectives.json';
import { TARGETS, type Target, type TargetKind } from './targets';
import type { Design, Sourced } from './types';

export type ObjectiveId = 'atmosphere' | 'surface' | 'moons';

export interface Objective {
  id: ObjectiveId;
  /** The kinds of Mars target the objective is about. */
  favours: TargetKind[];
  /** Catalogue instrument ids that do its science (any one is enough). */
  instruments: string[];
  /** One line on the real mission behind the pairing. */
  why: Sourced<string>;
}

const DATA = objectivesJson as unknown as { rules: { share: Sourced<number>; metFraction: Sourced<number> }; objectives: Objective[] };

export const OBJECTIVE_RULES = DATA.rules;
export const OBJECTIVES: Objective[] = DATA.objectives;
export const OBJECTIVE_IDS = OBJECTIVES.map((o) => o.id);

export const objectiveOf = (id: ObjectiveId): Objective => OBJECTIVES.find((o) => o.id === id)!;

/** The objective this design flies, if any: objectives are Mars only. */
export const activeObjective = (design: Design): Objective | undefined =>
  design.destination === 'mars' && design.objective ? objectiveOf(design.objective) : undefined;

/** The craft carries one of the objective's instruments. */
export const objectiveMatched = (design: Design, o: Objective) => design.instrumentIds.some((i) => o.instruments.includes(i));

/** The balanced weight of the objective's targets (Σ w of the kinds it favours). */
export const favouredWeight = (o: Objective) => TARGETS.reduce((a, t) => a + (o.favours.includes(t.kind) ? t.weight.value : 0), 0);

/**
 * A target's share of the science for this design. With an objective: w × share / W_fav for a favoured target when a
 * matching instrument is packed, else w × (1 − share) / (1 − W_fav).
 */
export function targetWeight(design: Design, t: Target): number {
  const o = activeObjective(design);
  if (!o || t.body !== 'mars') return t.weight.value;
  const share = OBJECTIVE_RULES.share.value;
  const W = favouredWeight(o);
  return o.favours.includes(t.kind) && objectiveMatched(design, o) ? (t.weight.value * share) / W : (t.weight.value * (1 - share)) / (1 - W);
}
