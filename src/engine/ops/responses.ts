// Hazard responses (spec: Mission operations, "Responses"). Only the responses the remaining margins can pay for
// are offered; the free option always is. A response is checked again when it reaches the craft.
import type { HazardOption } from '../data';

/** What the craft can still spend right now. */
export interface Spare {
  /** Δv left beyond what the plan still needs (m/s). */
  deltaV_ms: number;
  /** Budget reserve left: (cap − development) − extras spent ($M). */
  budget_M: number;
  /** Today's power margin with the current plan. */
  powerMargin: number;
  /** Science days still to fly in this phase of the mission. */
  scienceDays: number;
}

export const isFree = (o: HazardOption): boolean =>
  !o.cost.deltaV_ms?.value && !o.cost.budget_M?.value && !o.cost.scienceDays?.value && o.requires?.powerMargin === undefined && !o.oneTime;

/** What keeps a response from being offered: a margin it cannot pay for, or a one-time option already used. */
export type ResponseBlocker = 'one-time' | 'deltaV' | 'budget' | 'scienceDays' | 'power';

/** Why an option cannot be paid for now (empty: it can). A zero cost is always payable (decision #24). */
export function optionBlockers(o: HazardOption, spare: Spare, oneTimeUsed: string[] = []): ResponseBlocker[] {
  const payable = (cost: number, have: number) => cost <= 0 || cost <= have;
  const out: ResponseBlocker[] = [];
  if (o.oneTime && oneTimeUsed.includes(o.id)) out.push('one-time');
  if (!payable(o.cost.deltaV_ms?.value ?? 0, spare.deltaV_ms)) out.push('deltaV');
  if (!payable(o.cost.budget_M?.value ?? 0, spare.budget_M)) out.push('budget');
  if (!payable(o.cost.scienceDays?.value ?? 0, spare.scienceDays)) out.push('scienceDays');
  if (o.requires?.powerMargin !== undefined && o.requires.powerMargin.value > spare.powerMargin) out.push('power');
  return out;
}

/** Options the spare margins can pay for, so the free option always stays. */
export function affordableResponses(options: HazardOption[], spare: Spare, oneTimeUsed: string[] = []): HazardOption[] {
  return options.filter((o) => optionBlockers(o, spare, oneTimeUsed).length === 0);
}

/** The safe choice: the lowest failure chance. */
export function safestResponse(options: HazardOption[]): HazardOption {
  return options.reduce((a, b) => (b.failureChance.value < a.failureChance.value ? b : a));
}

/**
 * What the craft does when no command arrives in time: its standing order if one is set and affordable,
 * otherwise its fault-protection default (the free option; the safest affordable one if a hazard has no free option).
 */
export function defaultResponse(offered: HazardOption[], standingOrder?: string): { option: HazardOption; by: 'standing-order' | 'fault-protection' } {
  const ordered = standingOrder !== undefined ? offered.find((o) => o.id === standingOrder) : undefined;
  if (ordered) return { option: ordered, by: 'standing-order' };
  const free = offered.find(isFree);
  return { option: free ?? safestResponse(offered), by: 'fault-protection' };
}
