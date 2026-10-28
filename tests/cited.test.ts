// @vitest-environment jsdom
// The data's cited texts in Bangla (spec UI rule 48): every real history, "what we learn", postcard title and
// caption, Rescue History text, lesson and rank job has its Bangla in cited.bn.ts; the data itself stays English and
// Sourced (ⓘ shows the original), and the live storm card says what DONKI observed in the player's language.
import { afterEach, describe, expect, it } from 'vitest';
import { CRISIS_CARDS } from '../src/engine/crisis';
import { HAZARDS, LESSONS } from '../src/engine/data';
import { lessonText, NOTEBOOK } from '../src/engine/notebook';
import { POSTCARDS } from '../src/engine/postcards';
import { RANKS } from '../src/engine/ranks';
import { RESCUE_CASE_IDS, rescueCase } from '../src/engine/rescue';
import { stormSourced, type RealStorm } from '../src/engine/spaceWeather';
import { TARGET_SETS } from '../src/engine/targets';
import { said } from '../src/ui/cited';
import { CITED_BN } from '../src/ui/cited.bn';
import { setLang } from '../src/ui/lang';
import { LIVE_WEATHER } from '../src/ui/sdWords';

const BENGALI = /[ঀ-৿]/;
const BENGALI_DIGIT = /[০-৯]/;

/** Every English text the screens show from the data, with where it comes from. */
function citedTexts(): { at: string; en: string }[] {
  const out: { at: string; en: string }[] = [];
  for (const [id, h] of Object.entries(HAZARDS)) out.push({ at: `hazard ${id}`, en: h.realHistory.value });
  for (const c of CRISIS_CARDS) out.push({ at: `crisis ${c.id}`, en: c.realHistory.value });
  for (const set of Object.values(TARGET_SETS)) for (const t of set.targets) out.push({ at: `target ${t.id}`, en: t.learn.value });
  for (const p of POSTCARDS) out.push({ at: `postcard ${p.id} title`, en: p.title }, { at: `postcard ${p.id}`, en: p.caption.value });
  for (const id of RESCUE_CASE_IDS) {
    const c = rescueCase(id);
    out.push({ at: `rescue ${id} lost`, en: c.lost.value });
    for (const k of c.clues) out.push({ at: `clue ${k.id} title`, en: k.title }, { at: `clue ${k.id} text`, en: k.text }, { at: `clue ${k.id} verdict`, en: k.verdict }, { at: `clue ${k.id} evidence`, en: k.evidence.value });
  }
  for (const [id, l] of Object.entries(LESSONS)) out.push({ at: `lesson ${id} title`, en: l!.title }, { at: `lesson ${id}`, en: l!.lesson.value });
  for (const r of RANKS) out.push({ at: `rank ${r.id}`, en: r.job.value });
  for (const l of NOTEBOOK) out.push({ at: `notebook ${l.id}`, en: lessonText(l).value });
  return out;
}

afterEach(() => setLang('en'));

describe('cited texts in Bangla (spec UI rule 48)', () => {
  it('every cited text the screens show has its Bangla, and none is left over', () => {
    const texts = citedTexts();
    expect(texts.length).toBeGreaterThan(60);
    expect(texts.filter((t) => CITED_BN[t.en] === undefined).map((t) => t.at)).toEqual([]);
    const live = new Set(texts.map((t) => t.en));
    expect(Object.keys(CITED_BN).filter((en) => !live.has(en))).toEqual([]);
  });

  it('each Bangla is written in Bangla with Latin digits, and keeps the numbers of the English', () => {
    const digits = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).sort();
    for (const [en, bn] of Object.entries(CITED_BN)) {
      expect(bn, en).toMatch(BENGALI);
      expect(bn, en).not.toMatch(BENGALI_DIGIT);
      expect(digits(bn), en).toEqual(digits(en));
    }
  });

  it('said() follows the switch; a text with no Bangla stays as it is', () => {
    const tycho = TARGET_SETS.moon.targets.find((t) => t.id === 'tycho')!.learn.value;
    expect(said(tycho)).toBe(tycho);
    setLang('bn');
    expect(said(tycho)).toBe(CITED_BN[tycho]);
    // target names stay in English inside the Bangla
    expect(said(POSTCARDS.find((p) => p.id === 'moon-tycho')!.caption.value)).toContain('Tycho');
    expect(said('Not a cited text.')).toBe('Not a cited text.');
  });

  it('a real storm card: English says what the DONKI record says; Bangla the same facts and numbers', () => {
    const storm = { id: 'x', kind: 'cme', hazard: 'cme-shock', time: '2024-05-10T17:00Z', date: '2024-05-10', eventIds: ['x'], flare: 'X3.9', speed_kms: 1200, impacts: [], severity: 1 } as unknown as RealStorm;
    const sep = { ...storm, kind: 'sep', speed_kms: undefined, instruments: ['GOES-18'], flare: undefined } as unknown as RealStorm;
    expect(LIVE_WEATHER.event(storm)).toBe(stormSourced(storm).value);
    expect(LIVE_WEATHER.event(sep)).toBe(stormSourced(sep).value);
    setLang('bn');
    expect(LIVE_WEATHER.event(storm)).toBe('করোনাল ভর নিক্ষেপ (CME), গতি 1,200 km/s, 2024-05-10 17:00 UTC; এসেছে একটা X3.9 সৌর-শিখা থেকে');
    expect(LIVE_WEATHER.event(sep)).toContain('GOES-18');
  });
});
