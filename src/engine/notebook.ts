// Engineer's Notebook (Signal Delay design, screen 06; spec UI rules). Every mission earns real lessons from real
// spaceflight. Each lesson points at a text that is already Sourced elsewhere in the data (notebook.json says
// where) and at the deed that earns it. The collection size is whatever the data holds.
import notebookJson from '../data/notebook.json';
import { CRISIS_CARDS } from './crisis';
import { HAZARDS, LESSONS, OPERATIONS, PARTS } from './data';
import type { OpsState } from './ops/types';
import { rescueCase, RESCUE_CASE_IDS, type RescueCaseId } from './rescue';
import type { DestinationId, Sourced } from './types';

export type LessonCategory = 'signal' | 'power' | 'weather' | 'nav' | 'people';
export type LessonText =
  | { kind: 'hazard'; id: string }
  | { kind: 'crisis'; id: string }
  | { kind: 'rescue-lost'; id: RescueCaseId }
  | { kind: 'lesson'; id: DestinationId }
  | { kind: 'conjunction-rule' }
  | { kind: 'battery-rule' };
export type LessonUnlock =
  | { kind: 'face-hazard'; id: string }
  | { kind: 'finish-level'; id: string }
  | { kind: 'solve-rescue'; id: RescueCaseId }
  | { kind: 'conjunction' }
  | { kind: 'eclipse' };

export interface Lesson {
  id: string;
  category: LessonCategory;
  icon: string;
  text: LessonText;
  unlock: LessonUnlock;
}

export const NOTEBOOK = (notebookJson as unknown as { lessons: Lesson[] }).lessons;

/** A rule's own source as the real-history text (it is a quote or a citation already in the data). */
const fromRule = (s: Sourced<unknown>): Sourced<string> => ({ value: s.source, unit: '', source: s.source, ...(s.url ? { url: s.url } : {}), isGameEstimate: s.isGameEstimate });

/** The Sourced real-history text a lesson points at. */
export function lessonText(l: Lesson): Sourced<string> {
  const t = l.text;
  switch (t.kind) {
    case 'hazard':
      return HAZARDS[t.id]!.realHistory;
    case 'crisis':
      return CRISIS_CARDS.find((c) => c.id === t.id)!.realHistory;
    case 'rescue-lost':
      return rescueCase(t.id).lost;
    case 'lesson':
      return LESSONS[t.id]!.lesson;
    case 'conjunction-rule':
      return fromRule(OPERATIONS.conjunction.commandThreshold_deg);
    case 'battery-rule':
      return fromRule(PARTS.power.batteryMaxDepthOfDischarge);
  }
}

/** What the player has done: hazards faced (first mission day), seasons flown through, best stars per level/rescue. */
export interface NotebookFacts {
  hazards: Record<string, number>;
  conjunction: boolean;
  eclipse: boolean;
  /** Badges (ranks.ts): a solar storm met with every instrument kept, an eclipse season with no brownout, an
   *  extension chosen, a sample brought home. */
  stormNoLoss: boolean;
  eclipseNoBrownout: boolean;
  extended: boolean;
  sampleReturned: boolean;
  progress: Record<string, number>;
}

export const emptyFacts = (): NotebookFacts => ({
  hazards: {},
  conjunction: false,
  eclipse: false,
  stormNoLoss: false,
  eclipseNoBrownout: false,
  extended: false,
  sampleReturned: false,
  progress: {},
});

/** The facts one finished flight adds: hazards answered (their first day), the seasons it flew through, its deeds. */
export function flightFacts(s: OpsState): Omit<NotebookFacts, 'progress'> {
  const end = s.status === 'lost' ? Math.floor(s.failureT ?? s.t) : Math.min(Math.floor(s.t), s.env.primeEndDay);
  const hazards: Record<string, number> = {};
  for (const h of s.hazards) {
    if (!h.choice) continue;
    const d = Math.floor(h.onset);
    hazards[h.type] = Math.min(hazards[h.type] ?? Infinity, d);
  }
  const alive = s.status !== 'lost' && s.status !== 'not-launched';
  return {
    hazards,
    conjunction: s.env.conjunctions.some((w) => w.startDay <= end),
    eclipse: s.env.eclipseSeasons.some((e) => e.startDay <= end),
    stormNoLoss: alive && s.instrumentsLost.length === 0 && s.hazards.some((h) => h.type === 'solar-storm' && h.onset <= s.t),
    eclipseNoBrownout: alive && s.events.some((e) => e.code === 'eclipse-season-end') && !s.events.some((e) => e.code === 'brownout'),
    extended: s.extension !== undefined,
    sampleReturned: s.status === 'complete' && s.env.timeline.some((w) => w.phase === 'return'),
  };
}

export function mergeFacts(a: NotebookFacts, b: Partial<NotebookFacts>): NotebookFacts {
  const hazards = { ...a.hazards };
  for (const [k, d] of Object.entries(b.hazards ?? {})) hazards[k] = Math.min(hazards[k] ?? Infinity, d);
  const progress = { ...a.progress };
  for (const [k, v] of Object.entries(b.progress ?? {})) progress[k] = Math.max(progress[k] ?? 0, v);
  const or = (k: 'conjunction' | 'eclipse' | 'stormNoLoss' | 'eclipseNoBrownout' | 'extended' | 'sampleReturned') => !!a[k] || !!b[k];
  return {
    hazards,
    conjunction: or('conjunction'),
    eclipse: or('eclipse'),
    stormNoLoss: or('stormNoLoss'),
    eclipseNoBrownout: or('eclipseNoBrownout'),
    extended: or('extended'),
    sampleReturned: or('sampleReturned'),
    progress,
  };
}

function isOpen(l: Lesson, f: NotebookFacts): boolean {
  const u = l.unlock;
  switch (u.kind) {
    case 'face-hazard':
      return f.hazards[u.id] !== undefined;
    case 'finish-level':
      return (f.progress[u.id] ?? 0) >= 1;
    case 'solve-rescue':
      return (f.progress[`rescue-${u.id}`] ?? 0) >= 1;
    case 'conjunction':
      return f.conjunction;
    case 'eclipse':
      return f.eclipse;
  }
}

export interface NotebookCard extends Lesson {
  num: number;
  open: boolean;
  /** Mission day the lesson was earned on, when a flight earned it. */
  day?: number;
}

/** Every lesson with its number (1 …) and open state. */
export function notebook(f: NotebookFacts): NotebookCard[] {
  return NOTEBOOK.map((l, i) => {
    const open = isOpen(l, f);
    const day = open && l.unlock.kind === 'face-hazard' ? f.hazards[l.unlock.id] : undefined;
    return { ...l, num: i + 1, open, ...(day !== undefined ? { day } : {}) };
  });
}

/** Lessons opened between two sets of facts (the Mission Report's NEW CARD). */
export function newLessons(before: NotebookFacts, after: NotebookFacts): string[] {
  const was = new Set(notebook(before).filter((c) => c.open).map((c) => c.id));
  return notebook(after)
    .filter((c) => c.open && !was.has(c.id))
    .map((c) => c.id);
}

export const notebookProgress = (f: NotebookFacts) => ({ got: notebook(f).filter((c) => c.open).length, total: NOTEBOOK.length });

export const rescueProgress = (progress: Record<string, number>) => ({
  solved: RESCUE_CASE_IDS.filter((id) => (progress[`rescue-${id}`] ?? 0) >= 1).length,
  total: RESCUE_CASE_IDS.length,
});
