// What the player has done, kept in this browser only (a per-player convenience, like the level stars): the
// Notebook's flight facts and the Daily results. Every read and write survives missing storage.
import type { DailyGrid } from '../engine/daily';
import { emptyFacts, type NotebookFacts } from '../engine/notebook';

const NOTEBOOK_KEY = 'sd.notebook';
const DAILY_KEY = 'sd.daily';

type Flights = Omit<NotebookFacts, 'progress'>;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : undefined;
    return v && typeof v === 'object' ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: this visit only */
  }
}

export function loadFlights(): Flights {
  const { progress: _p, ...empty } = emptyFacts();
  const v = read<Partial<Flights>>(NOTEBOOK_KEY, {});
  return { ...empty, ...v, hazards: { ...(v.hazards ?? {}) } };
}
export const saveFlights = (f: Flights) => write(NOTEBOOK_KEY, f);

export interface DailySave {
  played: string[];
  results: Record<string, DailyGrid>;
}
export const loadDaily = (): DailySave => {
  const v = read<Partial<DailySave>>(DAILY_KEY, {});
  return { played: Array.isArray(v.played) ? v.played : [], results: v.results ?? {} };
};
export const saveDaily = (d: DailySave) => write(DAILY_KEY, d);
