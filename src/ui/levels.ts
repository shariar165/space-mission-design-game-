// Cadet levels: Moon (3 parts) → Mars → Venus → Bennu → Jupiter. Each level unlocks one new idea and opens
// only the build steps it teaches; the other steps keep their balanced cards, so every level starts
// flyable (tests/ui/levelMap.test.tsx checks this). Words and ids only: no numbers.
import type { CadetStep } from '../engine/cadet';
import type { DestinationId } from '../engine/types';

export interface Level {
  id: string;
  destination: DestinationId;
  title: string;
  /** The one new idea this level teaches. */
  concept: string;
  /** One friendly line on the map card. */
  blurb: string;
  steps: CadetStep[];
  /** Standing orders and Mission Control are part of this level. */
  orders: boolean;
  /** Jupiter: the star is for finding out why the direct flight is impossible. */
  impossible?: boolean;
}

const ALL: CadetStep[] = ['science', 'power', 'radio', 'fuel', 'rocket'];

export const LEVELS: Level[] = [
  { id: 'moon-1', destination: 'moon', title: 'First Light', concept: 'Power', blurb: 'Pick solar wings that keep your craft charged.', steps: ['power'], orders: false },
  { id: 'moon-2', destination: 'moon', title: 'Heavy Lifting', concept: 'Fuel & weight', blurb: 'Every kilogram of fuel must be lifted too.', steps: ['power', 'fuel', 'rocket'], orders: false },
  { id: 'moon-3', destination: 'moon', title: 'Full Build', concept: 'Science & radio', blurb: 'Build the whole craft yourself.', steps: ALL, orders: false },
  { id: 'mars', destination: 'mars', title: 'Red Planet', concept: 'Light delay', blurb: 'Too far to steer live: give your craft orders.', steps: ALL, orders: true },
  { id: 'venus', destination: 'venus', title: 'Cloud Diver', concept: 'Budget', blurb: 'Big radar, small wallet. Watch the coin jar.', steps: ALL, orders: true },
  { id: 'bennu', destination: 'bennu', title: 'Pebble Catcher', concept: 'Rendezvous & return', blurb: 'Meet an asteroid and bring a sample home.', steps: ALL, orders: true },
  { id: 'jupiter', destination: 'jupiter', title: 'Giant Leap', concept: 'Rocket limits', blurb: 'Can any rocket reach Jupiter straight from Earth?', steps: ALL, orders: true, impossible: true },
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
