// Spec section: "Crisis cards". One card per flight, drawn from those that fit the mission;
// its day always falls inside its phase (Timeline rule).
import crisisCardsJson from '../data/crisisCards.json';
import type { Phase } from './risk';
import type { Sourced } from './types';

export interface CrisisOption {
  id: string;
  label: string;
  cost: { deltaV_ms?: Sourced<number>; budget_M?: Sourced<number>; scienceDays?: Sourced<number> };
  requires?: { powerMargin?: Sourced<number> };
  /** Chance the crisis ends the affected phase after this choice. */
  failureChance: Sourced<number>;
  affects: Phase;
}

export interface CrisisCard {
  id: string;
  title: string;
  eventPhase: Phase | 'any';
  /** The decision is made before launch (e.g. pay for a test), the event happens later. */
  decisionBeforeLaunch?: boolean;
  missionTypes: string[];
  needsReturn: boolean;
  marginThatMatters: string;
  realHistory: Sourced<string>;
  prompt: string;
  options: CrisisOption[];
}

export const CRISIS_CARDS: CrisisCard[] = Object.entries(
  crisisCardsJson as unknown as Record<string, Omit<CrisisCard, 'id'>>,
).map(([id, c]) => ({ id, ...c }));

export interface PhaseWindow {
  phase: Phase;
  startDay: number;
  endDay: number;
}

/** Mission timeline in days from launch: launch day 0, cruise, arrival day, science, then return (sample missions). */
export function timeline(p: { flightDays: number; scienceDays: number; returnDays?: number }): PhaseWindow[] {
  const arrival = Math.round(p.flightDays);
  const scienceEnd = arrival + Math.max(1, Math.round(p.scienceDays));
  const tl: PhaseWindow[] = [
    { phase: 'launch', startDay: 0, endDay: 0 },
    { phase: 'cruise', startDay: 1, endDay: arrival - 1 },
    { phase: 'arrival', startDay: arrival, endDay: arrival },
    { phase: 'science', startDay: arrival + 1, endDay: scienceEnd },
  ];
  if (p.returnDays) tl.push({ phase: 'return', startDay: scienceEnd + 1, endDay: scienceEnd + Math.round(p.returnDays) });
  return tl;
}

export function phaseOnDay(tl: PhaseWindow[], day: number): Phase | undefined {
  return tl.find((w) => day >= w.startDay && day <= w.endDay)?.phase;
}

export function applicableCards(missionType: string, hasReturn: boolean): CrisisCard[] {
  return CRISIS_CARDS.filter((c) => c.missionTypes.includes(missionType) && (!c.needsReturn || hasReturn));
}

/** Draw one card and a day inside its phase. 'any' cards happen during cruise or science. */
export function drawCrisis(
  tl: PhaseWindow[],
  missionType: string,
  hasReturn: boolean,
  rng: () => number,
): { card: CrisisCard; phase: Phase; day: number } {
  const cards = applicableCards(missionType, hasReturn);
  const card = cards[Math.floor(rng() * cards.length)];
  if (!card) throw new Error(`No crisis cards for ${missionType}`);
  const windows =
    card.eventPhase === 'any'
      ? tl.filter((w) => w.phase === 'cruise' || w.phase === 'science')
      : tl.filter((w) => w.phase === card.eventPhase);
  const total = windows.reduce((s, w) => s + (w.endDay - w.startDay + 1), 0);
  let k = Math.floor(rng() * total);
  for (const w of windows) {
    const len = w.endDay - w.startDay + 1;
    if (k < len) return { card, phase: w.phase, day: w.startDay + k };
    k -= len;
  }
  throw new Error(`Card ${card.id} has no day inside its phase`);
}

/** Options the player's spare margins can pay for. Options with no cost are always available. */
export function availableOptions(
  card: CrisisCard,
  spare: { deltaV_ms: number; budget_M: number; powerMargin: number },
): CrisisOption[] {
  // A cost of zero is always payable, even when a spare margin is negative (an over-budget craft can launch).
  const payable = (cost: number, spare: number) => cost <= 0 || cost <= spare;
  return card.options.filter(
    (o) =>
      payable(o.cost.deltaV_ms?.value ?? 0, spare.deltaV_ms) &&
      payable(o.cost.budget_M?.value ?? 0, spare.budget_M) &&
      (o.requires?.powerMargin === undefined || o.requires.powerMargin.value <= spare.powerMargin),
  );
}

/** The safe choice is the option with the lowest failure chance. */
export function safestOption(options: CrisisOption[]): CrisisOption {
  return options.reduce((a, b) => (b.failureChance.value < a.failureChance.value ? b : a));
}

/**
 * Crisis handling score (game rule): outcome vs risk taken.
 * Safe & fine 100 · risky & fine 70 · safe & unlucky 50 · risky & lost 0.
 */
export function crisisScore(choseSafest: boolean, badOutcome: boolean): number {
  if (!badOutcome) return choseSafest ? 100 : 70;
  return choseSafest ? 50 : 0;
}
