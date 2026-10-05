// Engineer's Notebook (engine: src/engine/notebook.ts, data: src/data/notebook.json) and the Daily mission
// (src/engine/daily.ts). Every lesson's real history is a text that is already Sourced elsewhere in the data.
import { describe, expect, it } from 'vitest';
import { CRISIS_CARDS } from '../src/engine/crisis';
import { HAZARDS, LESSONS, OPERATIONS, PARTS } from '../src/engine/data';
import { presetDesign } from '../src/engine/missions';
import { runOperations } from '../src/engine/ops/index';
import { rescueCase, RESCUE_CASE_IDS } from '../src/engine/rescue';
import { emptyFacts, flightFacts, lessonText, mergeFacts, newLessons, notebook, NOTEBOOK, rescueProgress } from '../src/engine/notebook';
import { DAILY_RULES, dailyGrid, dailyNumber, dailySeed, dailyStreak, nextDailyIn_s } from '../src/engine/daily';
import { fnv1a } from '../src/engine/ops/random';

const maven = presetDesign('maven');

describe('lessons point at existing Sourced texts', () => {
  it('every lesson resolves to a Sourced string from hazards, crisis cards, rescue cases, lessons or a rule’s source', () => {
    expect(NOTEBOOK.length).toBeGreaterThanOrEqual(12);
    for (const l of NOTEBOOK) {
      const t = lessonText(l);
      expect(typeof t.value, l.id).toBe('string');
      expect(t.value.length, l.id).toBeGreaterThan(20);
      expect(t.source.length, l.id).toBeGreaterThan(0);
      expect(typeof t.isGameEstimate).toBe('boolean');
    }
    const byId = Object.fromEntries(NOTEBOOK.map((l) => [l.id, l]));
    expect(lessonText(byId['safe-beats-curious']!)).toBe(HAZARDS['solar-storm']!.realHistory);
    expect(lessonText(byId['check-your-units']!)).toBe(rescueCase('mco').lost);
    expect(lessonText(byId['borrow-speed']!)).toBe(LESSONS.jupiter!.lesson);
    expect(lessonText(byId['full-memory']!)).toBe(CRISIS_CARDS.find((c) => c.id === 'memory-full')!.realHistory);
    // a rule's own source is the text (the JPL conjunction quote, the battery depth-of-discharge source)
    expect(lessonText(byId['sun-gets-in-the-way']!).value).toBe(OPERATIONS.conjunction.commandThreshold_deg.source);
    expect(lessonText(byId['batteries-hate-the-dark']!).value).toBe(PARTS.power.batteryMaxDepthOfDischarge.source);
  });

  it('ids are unique and categories are the five of the design', () => {
    expect(new Set(NOTEBOOK.map((l) => l.id)).size).toBe(NOTEBOOK.length);
    for (const l of NOTEBOOK) expect(['signal', 'power', 'weather', 'nav', 'people']).toContain(l.category);
  });
});

describe('unlocking', () => {
  it('nothing is open at the start; finishing a level, solving a rescue and facing a hazard open their lessons', () => {
    expect(notebook(emptyFacts()).filter((c) => c.open)).toEqual([]);
    const facts = { ...emptyFacts(), progress: { 'moon-1': 1, 'rescue-mco': 2 }, hazards: { 'solar-storm': 214 } };
    const open = notebook(facts).filter((c) => c.open).map((c) => c.id);
    expect(open.sort()).toEqual(['check-your-units', 'safe-beats-curious', 'safe-mode-is-a-friend'].sort());
    // zero stars on a level does not count as finishing it
    expect(notebook({ ...emptyFacts(), progress: { 'moon-1': 0 } }).some((c) => c.open)).toBe(false);
  });

  it('a flight’s facts: hazards faced (first day), conjunction and eclipse seasons flown through', () => {
    const s = runOperations(maven, { seed: 2013, policy: 'safe', extension: 'end' }).state;
    const f = flightFacts(s);
    for (const h of s.hazards.filter((x) => x.choice)) expect(f.hazards[h.type]).toBeLessThanOrEqual(Math.floor(h.onset));
    expect(f.conjunction).toBe(s.env.conjunctions.some((w) => w.startDay <= s.env.primeEndDay));
    expect(f.eclipse).toBe(s.env.eclipseSeasons.some((e) => e.startDay <= s.env.primeEndDay));
  });

  it('newLessons lists what a flight opened; merging keeps the earliest day', () => {
    const before = { ...emptyFacts(), hazards: { debris: 40 } };
    const after = mergeFacts(before, { hazards: { debris: 90, 'solar-storm': 214 }, conjunction: true, eclipse: false });
    expect(after.hazards).toEqual({ debris: 40, 'solar-storm': 214 });
    expect(newLessons(before, after).sort()).toEqual(['safe-beats-curious', 'sun-gets-in-the-way'].sort());
  });

  it('rescue progress: solved cases out of all cases', () => {
    expect(rescueProgress({})).toEqual({ solved: 0, total: RESCUE_CASE_IDS.length });
    expect(rescueProgress({ 'rescue-mco': 1 })).toEqual({ solved: 1, total: RESCUE_CASE_IDS.length });
  });
});

describe('the Daily mission', () => {
  it('the number counts days since the epoch; the seed hashes the date', () => {
    expect(DAILY_RULES.epoch.isGameEstimate).toBe(true);
    const e = DAILY_RULES.epoch.value;
    expect(dailyNumber(e)).toBe(1);
    expect(dailyNumber('2026-11-10')).toBe(1 + (Date.parse('2026-11-10') - Date.parse(e)) / 86_400_000);
    expect(dailySeed('2026-11-10')).toBe(fnv1a('signal-delay-daily-2026-11-10'));
    expect(dailySeed('2026-11-10')).not.toBe(dailySeed('2026-11-11'));
  });

  it('streak: consecutive days played ending today (or yesterday, if today is not played yet)', () => {
    expect(dailyStreak([], '2026-11-10')).toBe(0);
    expect(dailyStreak(['2026-11-08', '2026-11-09', '2026-11-10'], '2026-11-10')).toBe(3);
    expect(dailyStreak(['2026-11-08', '2026-11-09'], '2026-11-10')).toBe(2);
    expect(dailyStreak(['2026-11-05', '2026-11-09'], '2026-11-10')).toBe(1);
    expect(dailyStreak(['2026-11-01'], '2026-11-10')).toBe(0);
  });

  it('next daily: seconds to the next UTC midnight', () => {
    const now = Date.parse('2026-11-10T23:00:00Z');
    expect(nextDailyIn_s(now)).toBe(3600);
  });

  it('the grid: one row per hazard answered, held / cost / hurt', () => {
    const s = runOperations(maven, { seed: 2013, policy: 'safe', extension: 'end' }).state;
    const g = dailyGrid(s);
    const answered = s.hazards.filter((h) => h.choice && h.outcomeDone);
    expect(g.rows.length).toBe(answered.length);
    g.rows.forEach((r, i) => {
      const h = answered[i]!;
      const o = HAZARDS[h.type]!.options.find((x) => x.id === h.choice!.optionId)!;
      const paid = (o.cost.deltaV_ms?.value ?? 0) > 0 || (o.cost.scienceDays?.value ?? 0) > 0 || (o.cost.budget_M?.value ?? 0) > 0;
      expect(r.type).toBe(h.type);
      expect(r.result).toBe(h.choice!.badOutcome ? 'hurt' : paid ? 'cost' : 'held');
    });
    expect(g.alive).toBe(s.status !== 'lost');
  });
});
