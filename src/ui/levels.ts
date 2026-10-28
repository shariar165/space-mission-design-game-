// Cadet levels: Moon (3 parts) → Mars → Venus → Bennu → Jupiter. Each level unlocks one new idea and opens
// only the build steps it teaches; the other steps keep their balanced cards, so every level starts
// flyable (tests/ui/levelMap.test.tsx checks this). Ids and titles only: no numbers. Titles stay English in both
// languages; what each level teaches and its map line are words (sdWords.ts LEVEL_WORDS).
import type { CadetStep } from '../engine/cadet';
import { shelfFor, type PartId } from '../engine/pack';
import type { DestinationId } from '../engine/types';

export interface Level {
  id: string;
  destination: DestinationId;
  title: string;
  steps: CadetStep[];
  /** Standing orders and Mission Control are part of this level. */
  orders: boolean;
  /** Jupiter: the star is for finding out why the direct flight is impossible. */
  impossible?: boolean;
  /** Pack: the parts on the shelf (default: everything the destination offers). Early levels teach with fewer. */
  shelf?: PartId[];
  /** The science is the destination's targets (Moon 3; Mars always flies its own). */
  targets?: boolean;
}

/** The parts a level puts on the shelf. */
export const shelfOf = (l: Level): PartId[] => l.shelf ?? shelfFor(l.destination);

const ALL: CadetStep[] = ['science', 'power', 'radio', 'fuel', 'rocket'];

export const LEVELS: Level[] = [
  { id: 'moon-1', destination: 'moon', title: 'First Light', steps: ['power'], orders: false, shelf: ['computer', 'engine', 'camera', 'solar', 'battery'] },
  { id: 'moon-2', destination: 'moon', title: 'Heavy Lifting', steps: ['power', 'fuel', 'rocket'], orders: false, shelf: ['computer', 'engine', 'camera', 'spectrometer', 'solar', 'battery', 'tank', 'dish'] },
  { id: 'moon-3', destination: 'moon', title: 'Full Build', steps: ALL, orders: false, targets: true },
  { id: 'mars', destination: 'mars', title: 'Red Planet', steps: ALL, orders: true },
  { id: 'venus', destination: 'venus', title: 'Cloud Diver', steps: ALL, orders: true },
  { id: 'bennu', destination: 'bennu', title: 'Pebble Catcher', steps: ALL, orders: true },
  { id: 'jupiter', destination: 'jupiter', title: 'Giant Leap', steps: ALL, orders: true, impossible: true },
];

/** Stars a level can give: three for a flight (spec: Stars), one for the Jupiter lesson. */
export const maxStars = (l: Level) => (l.impossible ? 1 : 3);

export const levelById = (id: string | undefined) => LEVELS.find((l) => l.id === id);

/** A level is open when it is the first one or the one before it has at least one star. */
export function isUnlocked(i: number, progress: Progress): boolean {
  if (i === 0) return true;
  const prev = LEVELS[i - 1];
  return prev !== undefined && (progress[prev.id] ?? 0) >= 1;
}

export const nextLevel = (id: string) => LEVELS[LEVELS.findIndex((l) => l.id === id) + 1];

// ---------------------------------------------------------------------------
// Progress: best stars per level, kept in this browser only (a per-player convenience).

export type Progress = Record<string, number>;
const KEY = 'mdt.progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as unknown) : {};
    return p && typeof p === 'object' ? (p as Progress) : {};
  } catch {
    return {};
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress lasts for this visit only */
  }
}

/** Keep the best result for a level. */
export const withStars = (p: Progress, id: string, stars: number): Progress => ({ ...p, [id]: Math.max(p[id] ?? 0, stars) });
