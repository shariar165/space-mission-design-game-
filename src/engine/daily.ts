// Daily mission (Signal Delay design, screen 05). The same mission for everyone, once a day: the date sets the
// seed, and the packed craft is fixed. The share card's grid shows how each danger went, never what was picked.
import { HAZARDS } from './data';
import { buildPackDesign, initialPack, packPart, shelfFor, type PartId } from './pack';
import { operationsDebrief } from './ops/index';
import { fnv1a } from './ops/random';
import type { OpsState } from './ops/types';
import type { RealStorm } from './spaceWeather';
import { gameEstimate, type Design, type Sourced } from './types';

export const DAILY_RULES = {
  epoch: gameEstimate('2026-10-01', 'date (UTC)', 'Game rule (Daily): Daily #1 is the first day of the Signal Delay daily mission'),
  extras: gameEstimate<PartId[]>(['shield', 'solar', 'battery', 'autopilot'], 'parts', 'Game rule (Daily): the daily craft packs the design’s starter extras'),
} satisfies Record<string, Sourced<unknown>>;

const DAY_MS = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Daily #n: 1 on the epoch, +1 every UTC day. */
export const dailyNumber = (dateIso: string) => 1 + Math.round((utc(dateIso) - utc(DAILY_RULES.epoch.value)) / DAY_MS);

/**
 * The day's seed: an FNV-1a hash of the date (the same generator family as Mission operations). With live weather
 * the real storms' DONKI event ids join the hash (sorted), so everyone with the same snapshot flies the same Daily;
 * a live quiet week (no storms) still differs from the offline Daily.
 */
export function dailySeed(dateIso: string, storms?: readonly RealStorm[]): number {
  const base = `signal-delay-daily-${dateIso.slice(0, 10)}`;
  if (!storms) return fnv1a(base);
  return fnv1a(`${base}|donki|${storms.flatMap((x) => x.eventIds).sort().join(',')}`);
}

/** Today's date in UTC (the daily turns over at UTC midnight). */
export const dailyDate = (nowMs: number) => isoOf(nowMs);

/** Seconds until the next daily (the next UTC midnight). */
export const nextDailyIn_s = (nowMs: number) => Math.ceil((utc(isoOf(nowMs)) + DAY_MS - nowMs) / 1000);

/** Days in a row played, ending today, or yesterday when today is not played yet. */
export function dailyStreak(played: string[], todayIso: string): number {
  const set = new Set(played.map((d) => d.slice(0, 10)));
  let day = utc(todayIso);
  if (!set.has(isoOf(day))) day -= DAY_MS;
  let n = 0;
  while (set.has(isoOf(day))) {
    n++;
    day -= DAY_MS;
  }
  return n;
}

/** The daily craft: the Mars starter with its own instruments plus the fixed extras. */
export function dailyDesign(base: Design): Design {
  let p = initialPack(base, shelfFor(base.destination));
  for (const id of DAILY_RULES.extras.value) p = packPart(p, id) ?? p;
  return buildPackDesign(base, p);
}

export type DailyResult = 'held' | 'cost' | 'hurt';

/** Where the day's space weather came from: the DONKI snapshot, or the seeded stand-in. */
export type DailyWeather = 'live' | 'offline';

export interface DailyGrid {
  /** realDate: the DONKI date of a real storm (live weather). */
  rows: { type: string; day: number; result: DailyResult; realDate?: string }[];
  alive: boolean;
  /** Last mission day of the report (the loss, or the end of the prime mission). */
  endDay: number;
  stars: number;
  /** The danger that set the day's theme (the first one faced), if any. */
  theme?: string;
  /** Absent on results saved before live weather. */
  weather?: DailyWeather;
}

/** One row per danger answered: held (no cost, it worked), cost (it worked but you paid), hurt (it went wrong). */
export function dailyGrid(s: OpsState, weather?: DailyWeather): DailyGrid {
  const rows = s.hazards
    .filter((h) => h.choice && h.outcomeDone)
    .map((h) => {
      const o = HAZARDS[h.type]!.options.find((x) => x.id === h.choice!.optionId)!;
      const paid = (o.cost.deltaV_ms?.value ?? 0) > 0 || (o.cost.scienceDays?.value ?? 0) > 0 || (o.cost.budget_M?.value ?? 0) > 0;
      return { type: h.type, day: Math.floor(h.onset), result: (h.choice!.badOutcome ? 'hurt' : paid ? 'cost' : 'held') as DailyResult, ...(h.real ? { realDate: h.real.date } : {}) };
    });
  const endDay = s.status === 'lost' ? Math.floor(s.failureT ?? s.t) : Math.min(Math.floor(s.t), s.env.primeEndDay);
  return {
    rows,
    alive: s.status !== 'lost' && s.status !== 'not-launched',
    endDay,
    stars: operationsDebrief(s).stars,
    ...(rows[0] ? { theme: rows[0].type } : {}),
    ...(weather ? { weather } : {}),
  };
}
