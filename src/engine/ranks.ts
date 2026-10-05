// Ranks and badges (spec: UI rules, Ranks and badges; data src/data/ranks.json). Ranks follow real Mission Control
// jobs and rise with the stars earned across the levels. Badges are deeds: Notebook flight facts, a full set of one
// destination's postcards, a Daily streak, a Rescue History solve, the Jupiter lesson.
import ranksJson from '../data/ranks.json';
import type { NotebookFacts } from './notebook';
import { POSTCARDS } from './postcards';
import type { Sourced } from './types';

export interface RankDef {
  id: string;
  /** Stars needed; the last rank asks for every star instead. */
  minStars?: Sourced<number>;
  allStars?: boolean;
  /** What the real job is (Sourced; the game ranks say so). */
  job: Sourced<string>;
}

type BadgeFact = 'stormNoLoss' | 'conjunction' | 'eclipseNoBrownout' | 'extended' | 'sampleReturned';
export type BadgeRule =
  | { kind: 'any-level-star' }
  | { kind: 'fact'; fact: BadgeFact }
  | { kind: 'postcard-set' }
  | { kind: 'daily-streak'; days: Sourced<number> }
  | { kind: 'rescue' }
  | { kind: 'level-star'; id: string };

export interface BadgeDef {
  id: string;
  icon: string;
  rule: BadgeRule;
}

const DATA = ranksJson as unknown as { ranks: RankDef[]; badges: BadgeDef[] };
export const RANKS = DATA.ranks;
export const BADGES = DATA.badges;

const isRescue = (key: string) => key.startsWith('rescue-');

/** Stars earned across the levels (best per level, capped at its maximum) and the most there are. */
export function starTotals(progress: Record<string, number>, levelMax: Record<string, number>): { stars: number; maxStars: number } {
  let stars = 0;
  let maxStars = 0;
  for (const [id, max] of Object.entries(levelMax)) {
    maxStars += max;
    stars += Math.min(max, Math.max(0, progress[id] ?? 0));
  }
  return { stars, maxStars };
}

const needs = (r: RankDef, maxStars: number) => (r.allStars ? maxStars : (r.minStars?.value ?? 0));

/** The rank for a star count, the next one and the stars still to earn for it. */
export function rankFor(stars: number, maxStars: number): { rank: RankDef; index: number; next?: RankDef; starsToNext?: number } {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (stars >= needs(r, maxStars)) index = i;
  });
  const rank = RANKS[index]!;
  const next = RANKS[index + 1];
  return { rank, index, ...(next ? { next, starsToNext: needs(next, maxStars) - stars } : {}) };
}

export interface BadgeInput {
  facts: NotebookFacts;
  /** Postcards earned (saved album). */
  postcards: readonly string[];
  /** Days in a row the Daily has been played (daily.ts dailyStreak). */
  dailyStreak: number;
}

function earned(rule: BadgeRule, x: BadgeInput): boolean {
  const p = x.facts.progress;
  switch (rule.kind) {
    case 'any-level-star':
      return Object.entries(p).some(([k, v]) => !isRescue(k) && v >= 1);
    case 'fact':
      return !!x.facts[rule.fact];
    case 'postcard-set': {
      const have = new Set(x.postcards);
      const dests = [...new Set(POSTCARDS.map((c) => c.destination))];
      return dests.some((d) => POSTCARDS.filter((c) => c.destination === d).every((c) => have.has(c.id)));
    }
    case 'daily-streak':
      return x.dailyStreak >= rule.days.value;
    case 'rescue':
      return Object.entries(p).some(([k, v]) => isRescue(k) && v >= 1);
    case 'level-star':
      return (p[rule.id] ?? 0) >= 1;
  }
}

/** Every badge in data order, earned or not. */
export function badges(x: BadgeInput): (BadgeDef & { earned: boolean })[] {
  return BADGES.map((b) => ({ ...b, earned: earned(b.rule, x) }));
}

/** Badges earned in `after` that were not in `before`. */
export function newBadges(before: BadgeInput, after: BadgeInput): string[] {
  const was = new Set(badges(before).filter((b) => b.earned).map((b) => b.id));
  return badges(after)
    .filter((b) => b.earned && !was.has(b.id))
    .map((b) => b.id);
}
