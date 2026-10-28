// The language of the words on screen: English or Bangla (spec UI rule 48). Only words change: every number and
// unit is formatted the same way in both (format.ts), and NASA mission names and target names stay in English.
// - sdWords.ts wraps each of its exports in `tr(name, english)`. A wrapped table answers in the current language
//   when it is read, so a screen that re-renders after a switch shows the other language with no remount (a flight
//   keeps flying). A wrapped function calls the Bangla function of the same name.
// - The Bangla words live in sdWords.bn.ts, export by export, with the same shape (BN for sdWords, BN_OPS for
//   opsWords). A key Bangla leaves out falls back to English (`icon`, `color` and `tone` are never words);
//   tests/lang.test.ts checks every word has its Bangla.
// - The choice is saved in the browser (`sd.lang`); <html lang> follows it. It is saved here, not in saves.ts, which
//   imports sdWords (and so this module).
import { useSyncExternalStore } from 'react';
import { BN, BN_OPS } from './sdWords.bn';

export type Lang = 'en' | 'bn';
export const LANGS: readonly Lang[] = ['en', 'bn'];

const LANG_KEY = 'sd.lang';

function loadLang(): Lang {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    return raw && (JSON.parse(raw) as { lang?: unknown }).lang === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

function saveLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, JSON.stringify({ lang: l }));
  } catch {
    /* storage unavailable: this visit only */
  }
}

/** Read on first use, so storage is only touched once the page runs. */
let current: Lang | undefined;
const listeners = new Set<() => void>();

export const lang = (): Lang => (current ??= loadLang());

function mark(l: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** Switch the words on screen; saved, and every `useLang` re-renders. */
export function setLang(l: Lang): void {
  if (lang() === l) return;
  current = l;
  saveLang(l);
  mark(l);
  for (const fn of listeners) fn();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The language, re-rendering on a switch (App reads it so every screen re-renders). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, lang, lang);
}

/** Put <html lang> in step with the saved choice at start-up. */
export const applyLang = () => mark(lang());

/** Never words: icon names, colours and tones stay as English has them. */
const NOT_WORDS = new Set(['icon', 'color', 'tone']);

/** The Bangla tables: sdWords' exports, and opsWords' (the console drawers and the event feed). */
const TABLES = { sd: BN, ops: BN_OPS } as Record<'sd' | 'ops', Record<string, unknown>>;

const proxies = new WeakMap<object, Map<unknown, object>>();

function bangla(en: object, bn: unknown): unknown {
  let byBn = proxies.get(en);
  if (!byBn) proxies.set(en, (byBn = new Map()));
  let p = byBn.get(bn);
  if (!p) {
    p = new Proxy(en, {
      get(target, key, receiver) {
        const e: unknown = Reflect.get(target, key, receiver);
        if (lang() !== 'bn' || typeof key !== 'string' || NOT_WORDS.has(key) || bn === null || typeof bn !== 'object') return e;
        const b: unknown = (bn as Record<string, unknown>)[key];
        if (b === undefined) return e;
        if (e !== null && typeof e === 'object' && b !== null && typeof b === 'object') return bangla(e, b);
        return b;
      },
    });
    byBn.set(bn, p);
  }
  return p;
}

/**
 * The export `name` of sdWords (or of opsWords, `set` 'ops') in the current language: English as given, Bangla from
 * the table's export of that name. Functions call the Bangla function; tables and lists are read through a proxy,
 * key by key.
 */
export function tr<T>(name: string, en: T, set: 'sd' | 'ops' = 'sd'): T {
  const table = TABLES[set];
  if (typeof en === 'function') {
    const wrapped = (...args: unknown[]) => {
      const bn = lang() === 'bn' ? table[name] : undefined;
      return (typeof bn === 'function' ? bn : (en as (...a: unknown[]) => unknown))(...args);
    };
    return wrapped as T;
  }
  if (en !== null && typeof en === 'object') return bangla(en, table[name]) as T;
  return en;
}
