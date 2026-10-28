// @vitest-environment jsdom
// EN / বাংলা (spec UI rule 48): every word in sdWords.ts has a Bangla version in sdWords.bn.ts, with the same shape;
// numbers stay in Latin digits; the switch changes what the word exports say, and is saved in the browser.
import { afterEach, describe, expect, it } from 'vitest';
import * as f from '../src/ui/format';
import { lang, setLang } from '../src/ui/lang';
import * as W from '../src/ui/sdWords';
import { BN, place, placeIn, placeOf } from '../src/ui/sdWords.bn';

/** Exports that are not words, or that read their words from translated tables (sdWords.bn.ts `NotTranslated`). */
const NOT_TRANSLATED = ['GAME_NAME', 'EFFECT_ICON', 'CHIP_ICON', 'SCIENCE_PARTS', 'ROBOT_NAMES', 'ROBOT_NAME_MAX', 'cleanRobotName', 'robotNameOr', 'nextRobotName', 'fill', 'optionShort', 'dangerLook', 'targetName'];

/** Not translated yet: the next pull requests of the Bangla series take these (Fly, science, then Report and Notebook). */
const PENDING = [
  'TILE', 'OPTION_SHORT', 'arrivesWords', 'COMING', 'monthsWords', 'monthsShort', 'quietLine', 'milestoneLine', 'resultLines', 'RESULT_EFFECT_CHIP',
  'panelWords', 'PANEL_SOUND', 'STAR_WORDS', 'CATEGORY_NAME', 'savedWords', 'hurtWords', 'REPORT_STAMP', 'FINAL_WORDS', 'finalLines',
  'CATEGORY_LOOK', 'LESSON_WORDS', 'unlockHint', 'LIVE_WEATHER',
  'FLY_WORDS', 'endsInWords', 'playNudge', 'MAP_WORDS', 'stormLine', 'VOICE', 'TARGET_WORDS', 'VOICE_ALT', 'STATUS_VOICE', 'robotSays', 'TX_WORDS',
  'SCIENCE', 'MOON_WORDS', 'DOWNLINK', 'bodyWord', 'GLOBE_WORDS', 'ALBUM', 'DAILY_SCIENCE',
];

const BENGALI = /[ঀ-৿]/;
const BENGALI_DIGIT = /[০-৯]/;
/** Strings that are the same in both languages: names (robots, NASA, the language's own), keys and sound effects. */
const SAME_IN_BOTH = new Set(['EN', 'VOYA', 'TALLY', 'KESTREL', 'ARM', 'CME']);

const words = W as unknown as Record<string, unknown>;
const bangla = BN as Record<string, unknown>;
const exported = Object.keys(words).filter((k) => !NOT_TRANSLATED.includes(k));

/** Walk an English export and its Bangla side by side; report every word Bangla misses or gets the wrong shape. */
function compare(path: string, en: unknown, bn: unknown, bad: string[], leaves: { path: string; bn: string }[]) {
  if (typeof en === 'string') {
    if (typeof bn !== 'string') bad.push(`${path}: no Bangla`);
    else leaves.push({ path, bn });
  } else if (typeof en === 'function') {
    if (typeof bn !== 'function') bad.push(`${path}: no Bangla function`);
  } else if (Array.isArray(en)) {
    if (!Array.isArray(bn) || bn.length !== en.length) bad.push(`${path}: Bangla list of another length`);
    else en.forEach((e, i) => compare(`${path}[${i}]`, e, bn[i], bad, leaves));
  } else if (en !== null && typeof en === 'object') {
    if (bn === null || typeof bn !== 'object') return void bad.push(`${path}: no Bangla table`);
    for (const k of Object.keys(en)) {
      if (k === 'icon' || k === 'color') continue;
      compare(`${path}.${k}`, (en as Record<string, unknown>)[k], (bn as Record<string, unknown>)[k], bad, leaves);
    }
  }
}

afterEach(() => setLang('en'));

describe('Bangla words (spec UI rule 48)', () => {
  it('every word export has its Bangla, except those still pending in this series', () => {
    // read the English while English is on (the exports answer in the current language)
    expect(lang()).toBe('en');
    const missing = exported.filter((k) => bangla[k] === undefined);
    expect(missing.sort()).toEqual([...PENDING].sort());
    // and nothing in Bangla that English does not have
    expect(Object.keys(bangla).filter((k) => !(k in words))).toEqual([]);
  });

  it('each Bangla export has the English shape: every string, function, list and key', () => {
    const bad: string[] = [];
    const leaves: { path: string; bn: string }[] = [];
    for (const k of exported) if (bangla[k] !== undefined) compare(k, words[k], bangla[k], bad, leaves);
    expect(bad).toEqual([]);
    expect(leaves.length).toBeGreaterThan(100);
    // every Bangla string is written in Bangla (bar names that are the same in both) and keeps Latin digits
    expect(leaves.filter((l) => !BENGALI.test(l.bn) && !SAME_IN_BOTH.has(l.bn)).map((l) => l.path)).toEqual([]);
    expect(leaves.filter((l) => BENGALI_DIGIT.test(l.bn)).map((l) => l.path)).toEqual([]);
  });

  it('the switch changes what the exports say; numbers and units are formatted the same', () => {
    expect(W.COLD_OPEN.receive).toBe('▶ RECEIVE TRANSMISSION');
    expect(W.CREW_WORDS.stars(3, 21)).toBe('3 OF 21 STARS');
    setLang('bn');
    expect(lang()).toBe('bn');
    expect(W.COLD_OPEN.receive).toBe('▶ বার্তা গ্রহণ করো');
    // the same digits as English: Latin, through format.ts
    expect(W.CREW_WORDS.stars(3, 21)).toBe('21টির মধ্যে 3টি তারা');
    expect(W.MOMENT_WORDS.count(10)).toBe(`T−${f.num(10)}`);
    // a table keeps its icons; a list keeps its length
    expect(W.COACH[0]!.title).toBe('সময় চলতে দাও');
    expect(W.COACH[0]!.icon).toBe('play');
    expect(W.COACH.map((c) => c.icon)).toEqual(['play', 'storm', 'dish', 'power', 'postcard', 'star']);
    // NASA mission names stay in English; planet names are said in Bangla
    expect(W.COLD_OPEN.burn('SEPTEMBER 23, 1999', 'Mars Climate Orbiter')).toContain('MARS CLIMATE ORBITER');
    expect(W.POSTCARD_WORDS.toast('Mars')).toBe('📮 মঙ্গল থেকে পোস্টকার্ড!');
    expect(place('Bennu (asteroid)')).toBe('গ্রহাণু Bennu');
    // with the case endings Bangla puts on a place: to Mars, Mars's orbit
    expect(placeIn('Mars')).toBe('মঙ্গলে');
    expect(placeOf('Moon')).toBe('চাঁদের');
    expect(W.MOMENT_WORDS.arrived('Mars', false)).toBe('মঙ্গলের কক্ষপথে!');
    expect(W.STAR_GOALS('Moon')[0]).toBe('চাঁদে পৌঁছাও আর প্রথম বিজ্ঞান-তথ্য বাড়ি পাঠাও।');
    setLang('en');
    expect(W.COLD_OPEN.receive).toBe('▶ RECEIVE TRANSMISSION');
  });

  it('the choice is saved in the browser as sd.lang', () => {
    setLang('bn');
    expect(JSON.parse(localStorage.getItem('sd.lang')!)).toEqual({ lang: 'bn' });
    setLang('en');
    expect(JSON.parse(localStorage.getItem('sd.lang')!)).toEqual({ lang: 'en' });
  });
});
