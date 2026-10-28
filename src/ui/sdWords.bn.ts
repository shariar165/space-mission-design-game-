// বাংলা: the Bangla words for the Signal Delay screens, export by export with the same shape as sdWords.ts (spec UI
// rule 48). lang.ts reads them when the player picks বাংলা.
// - Numbers and units are formatted exactly as in English (format.ts): Latin digits, the same units.
// - NASA mission names and science target names stay in English; so do robot names (A–Z only) and the game's name.
// - Planet names from the engine's data are said in Bangla (`place`); an asteroid keeps its name.
// - Friendly "তুমি" throughout, as the English talks to the player as "you".
// tests/lang.test.ts checks that every English word has its Bangla here.
import type * as EN from './sdWords';
import * as f from './format';

/** The shape of a Bangla export: the English one, with every word a string and no icons or colours. */
type Words<T> = T extends string
  ? string
  : T extends number | boolean
    ? T
    : T extends (...a: infer A) => infer R
      ? (...a: A) => Words<R>
      : T extends readonly (infer E)[]
        ? readonly Words<E>[]
        : T extends object
          ? { [K in keyof T as K extends 'icon' | 'color' ? never : K]: Words<T[K]> }
          : T;

/** Exports that are not words (icons, names, rules) or that read their words from translated tables. */
export type NotTranslated =
  | 'GAME_NAME'
  | 'EFFECT_ICON'
  | 'CHIP_ICON'
  | 'SCIENCE_PARTS'
  | 'ROBOT_NAMES'
  | 'ROBOT_NAME_MAX'
  | 'cleanRobotName'
  | 'robotNameOr'
  | 'nextRobotName'
  | 'fill'
  | 'optionShort'
  | 'dangerLook'
  | 'targetName';

export type Bangla = { [K in Exclude<keyof typeof EN, NotTranslated>]: Words<(typeof EN)[K]> };

/** A place in Bangla: its name, "in/at/to" it (locative) and "of" it (genitive). An asteroid keeps its name. */
const PLACES: Record<string, { name: string; in: string; of: string }> = {
  Moon: { name: 'চাঁদ', in: 'চাঁদে', of: 'চাঁদের' },
  Venus: { name: 'শুক্র', in: 'শুক্রে', of: 'শুক্রের' },
  Mars: { name: 'মঙ্গল', in: 'মঙ্গলে', of: 'মঙ্গলের' },
  Jupiter: { name: 'বৃহস্পতি', in: 'বৃহস্পতিতে', of: 'বৃহস্পতির' },
  Earth: { name: 'পৃথিবী', in: 'পৃথিবীতে', of: 'পৃথিবীর' },
  'Bennu (asteroid)': { name: 'গ্রহাণু Bennu', in: 'গ্রহাণু Bennu-তে', of: 'গ্রহাণু Bennu-র' },
};
const lookup = (name: string) => PLACES[name] ?? PLACES[name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()];
/** The place's name ("মঙ্গল"). */
export const place = (name: string) => lookup(name)?.name ?? name;
/** In, at or to the place ("মঙ্গলে"). */
export const placeIn = (name: string) => lookup(name)?.in ?? `${name}-এ`;
/** Of the place ("মঙ্গলের"). */
export const placeOf = (name: string) => lookup(name)?.of ?? `${name}-এর`;

/** Dates in Bangla month names, with the same (Latin) digits as English. */
const BN_DATES = 'bn-BD-u-nu-latn';

/** The parts' names, for lines that name one (fuelFixWords; the table itself is PART_LOOK below). */
const BN_PART_NAME: Record<string, string> = {
  computer: 'ফ্লাইট কম্পিউটার',
  engine: 'প্রধান ইঞ্জিন',
  camera: 'ক্যামেরা',
  spectrometer: 'স্পেকট্রোমিটার',
  magnetometer: 'ম্যাগনেটোমিটার',
  radar: 'রাডার সাউন্ডার',
  sniffer: 'বাতাস শোঁকার যন্ত্র (MAVEN-এর যন্ত্রগুচ্ছ)',
  dish: 'বড় ডিশ অ্যান্টেনা',
  solar: 'বাড়তি সোলার প্যানেল',
  battery: 'বড় ব্যাটারি',
  tank: 'বাড়তি জ্বালানি ট্যাংক',
  heater: 'হিটার প্যাক',
  shield: 'বিকিরণ-ঢাল',
  bumper: 'ধুলিকণা-বাম্পার',
  spare: 'বাড়তি কম্পিউটার',
  autopilot: 'অটোপাইলট চিপ',
};

export const BN: Partial<Bangla> = {
  // -------------------------------------------------------------------------
  // Pack and Launch Day

  PART_LOOK: {
    computer: { name: 'ফ্লাইট কম্পিউটার', short: 'মগজ' },
    engine: { name: 'প্রধান ইঞ্জিন', short: 'ইঞ্জিন' },
    camera: { name: 'ক্যামেরা', short: 'ক্যামেরা' },
    spectrometer: { name: 'স্পেকট্রোমিটার', short: 'স্পেকট্রো' },
    magnetometer: { name: 'ম্যাগনেটোমিটার', short: 'ম্যাগ' },
    radar: { name: 'রাডার সাউন্ডার', short: 'রাডার' },
    sniffer: { name: 'বাতাস শোঁকার যন্ত্র (MAVEN-এর যন্ত্রগুচ্ছ)', short: 'শোঁকা' },
    dish: { name: 'বড় ডিশ অ্যান্টেনা', short: 'ডিশ' },
    solar: { name: 'বাড়তি সোলার প্যানেল', short: 'সোলার' },
    battery: { name: 'বড় ব্যাটারি', short: 'ব্যাটারি' },
    tank: { name: 'বাড়তি জ্বালানি ট্যাংক', short: 'জ্বালানি' },
    heater: { name: 'হিটার প্যাক', short: 'হিটার' },
    shield: { name: 'বিকিরণ-ঢাল', short: 'ঢাল' },
    bumper: { name: 'ধুলিকণা-বাম্পার', short: 'বাম্পার' },
    spare: { name: 'বাড়তি কম্পিউটার', short: 'বাড়তি' },
    autopilot: { name: 'অটোপাইলট চিপ', short: 'অটো' },
  },
  DANGER_LOOK: {
    eclipse: { title: 'গ্রহণের মৌসুম', short: 'গ্রহণ', line: 'গ্রহটা সূর্যকে আড়াল করে। বিদ্যুৎ কমে যায়।' },
    conjunction: { title: 'সূর্য মাঝখানে', short: 'সূর্য', line: 'প্রায় দুই সপ্তাহ বাড়িতে কোনো কল নেই।' },
    'solar-storm': { title: 'বিকিরণ-ঝড়', short: 'ঝড়', line: 'সূর্য দ্রুতগামী কণা ছোড়ে, যা ইলেকট্রনিকস পুড়িয়ে দেয়।' },
    'cme-shock': { title: 'CME-এর ধাক্কা', short: 'CME', line: 'সৌর প্লাজমার একটা মেঘ মঙ্গলে আছড়ে পড়ে।' },
    'mars-dust-storm': { title: 'ধুলোঝড়', short: 'ধুলো', line: 'মঙ্গলের বাতাস ফুলে ওঠে আর নিচু কক্ষপথকে টেনে ধরে।' },
    debris: { title: 'ধূমকেতুর ধুলো', short: 'কণা', line: 'ছোট্ট কণাগুলো বুলেটের চেয়েও জোরে আঘাত করে।' },
    'reaction-wheel': { title: 'চাকা বিকল', short: 'চাকা', line: 'যে ঘূর্ণি-চাকা রোবটকে ঠিক দিকে ঘোরায়, সেটা ক্ষয়ে যায়।' },
    'memory-corruption': { title: 'মেমরির গোলমাল', short: 'মেমরি', line: 'বিকিরণ কম্পিউটারের বিট উল্টে দেয়।' },
    'insertion-anomaly': { title: 'পৌঁছানোর বার্নে গোলমাল', short: 'পৌঁছানো', line: 'গতি কমানোর বার্ন পরিকল্পনামতো হয় না।' },
  },
  deckWhen: (c) => {
    if (c.kind === 'eclipse' || c.kind === 'conjunction') return 'নিশ্চিত · আগেই দেখা যায়';
    return c.detectedBy === 'earth' ? 'আচমকা · আগাম সতর্কতাসহ' : 'আচমকা · কোনো সতর্কতা ছাড়া';
  },
  STAMP: {
    covered: { word: 'সামলানো', short: 'ঠিক' },
    some: { word: 'কিছুটা সামলানো', short: 'কিছুটা' },
    none: { word: 'অরক্ষিত', short: 'নেই' },
  },
  PACK_BLOCKER: {
    'too-heavy': 'এই রকেটের জন্য খুব ভারী',
    'no-power': 'যথেষ্ট বিদ্যুৎ নেই',
    'no-fuel': 'সেখানে যাওয়ার মতো জ্বালানি নেই',
    'no-capture': 'এই ইঞ্জিন গতি কমিয়ে কক্ষপথে ঢুকতে পারে না',
    'flight-too-long': 'এই যাত্রা খেলার জন্য খুব লম্বা',
    'no-science': 'অন্তত একটি বিজ্ঞানযন্ত্র নাও',
    other: 'উৎক্ষেপণের জন্য তৈরি নয়',
  },
  PACK_WORDS: {
    noRoom: 'নাকে আর জায়গা নেই',
    step: 'গোছাও',
    shelf: 'যন্ত্রাংশের তাক',
    shelfLabel: 'যন্ত্রাংশের তাক',
    tapToPack: 'নিতে ছোঁও',
    shelfEmpty: 'তাক খালি। সব গোছানো হয়ে গেছে।',
    pack: (name, fits) => `${name} নাও${fits ? '' : ' (জায়গা নেই)'}`,
    fits: (n) => `আঁটবে · ${n} ঘর`,
    fitsShort: (n) => `${n} ঘর`,
    wontFit: 'আঁটবে না',
    noRoomShort: 'জায়গা নেই',
    earnsData: 'ডেটা আনে',
    covers: (danger) => `সামলায়: ${danger}`,
    fairing: 'নাক আর ওজন',
    nose: 'রকেটের নাক',
    noseLabel: 'রকেটের নাক',
    noseState: (state) => `নাক: ${state}`,
    full: 'ভরা · আর কিছু আঁটবে না',
    fullShort: 'ভরা',
    left: (n) => `আর ${n}টি ঘর খালি`,
    alwaysPacked: (name) => `${name} · সবসময় থাকে`,
    alwaysPackedLabel: (name) => `${name} (সবসময় থাকে)`,
    tapToUnpack: (name) => `${name} · সরাতে ছোঁও`,
    unpack: (name) => `${name} সরাও`,
    weight: 'ওজন',
    weightLabel: 'ওজন',
    deck: 'বিপদের তাস',
    deckOf: (dest) => `বিপদের তাস · ${place(dest)}`,
    deckLabel: (dest) => `বিপদের তাস: ${place(dest)}`,
    deckSub: 'সব তাস খোলা। কী আসছে, তুমি জানো।',
    checklist: 'উৎক্ষেপণের তালিকা',
    arm: 'ARM',
    armLabel: 'আর্ম',
    launch: 'উৎক্ষেপণ',
    lesson: (title) => `শিক্ষা · ${title.toUpperCase()}`,
    lessonTitle: 'শিক্ষাটি',
    lessonLearned: '★ শিক্ষা পেলাম',
  },
  BRAND_WORDS: {
    home: 'Signal Delay: হোম',
    sub: (mission, dest) => `${mission.toUpperCase()} · গন্তব্য ${place(dest)}`,
  },
  STEP_WORDS: { label: 'মিশনের ধাপ', pack: 'গোছাও', build: 'বানাও', fly: 'ওড়াও', report: 'রিপোর্ট' },
  fuelFixWords: (fix) => {
    const pack = `${BN_PART_NAME[fix.part]} নাও`;
    return fix.why === 'station-keeping' ? `${pack} — ${f.km(fix.orbitAlt_m).toUpperCase()} কক্ষপথে প্রতি মাসে ট্রিম বার্ন লাগে` : pack;
  },
  DAY_WORDS: {
    good: { msg: (d) => `ভালো দিন · ${place(d)} নাগালে`, short: 'ভালো' },
    soso: { msg: () => 'চলনসই · হাতে বাড়তি কম', short: 'চলনসই' },
    bad: { msg: (d) => `খারাপ দিন · ${place(d)} নাগালের বাইরে`, short: 'খারাপ' },
  },
  LAUNCH_DAY_WORDS: {
    title: 'উৎক্ষেপণের দিন',
    head: (span) => `উৎক্ষেপণের দিন · ${span}`,
    daysLabel: 'উৎক্ষেপণের দিন',
    sub: 'ছয় সপ্তাহের উৎক্ষেপণের দিন। সবুজ: সহজ যাত্রা। হলুদ: হাতে বাড়তি কম। লাল: নাগালের বাইরে।',
    line: 'উৎক্ষেপণের দিন',
    auto: 'সেরা দিন · তোমার জন্য বাছা',
    yours: 'তোমার বাছাই',
    change: 'বদলাও ▸',
    arrives: 'পৌঁছাবে',
    flight: 'যাত্রা',
    best: 'সেরা দিন',
    useBest: 'সেরা দিনটা নাও',
    working: 'উৎক্ষেপণের দিনগুলো হিসাব হচ্ছে…',
    c3: 'C3 · পৌঁছানোর v∞',
    margins: 'মার্জিন · ভর · Δv',
  },
  WEIGHT_WORDS: { ok: 'যথেষ্ট হালকা', warning: 'প্রায় বেশি ভারী', over: 'এই রকেটের জন্য খুব ভারী' },
  shortDate: (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(BN_DATES, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  monthSpan: (fromIso, toIso) => {
    const m = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(BN_DATES, { month: 'short', timeZone: 'UTC' });
    const y = toIso.slice(0, 4);
    return m(fromIso) === m(toIso) ? `${m(fromIso)} ${y}` : `${m(fromIso)}–${m(toIso)} ${y}`;
  },

  // -------------------------------------------------------------------------
  // Briefings, coach panels, launch checklist and navigation

  BRIEFING: {
    'moon-1': {
      job: 'চাঁদে একটি ছোট রোবট পাঠাও, আর ছবি তোলার সময় তার চার্জ ধরে রাখো।',
      tip: 'সোলার ডানা আর একটি ব্যাটারি নাও। চাঁদের ছায়াতেও রোবটের বিদ্যুৎ লাগে।',
    },
    'moon-2': {
      job: 'এমন পরিমাণ জ্বালানি নিয়ে চাঁদে পৌঁছাও, যাতে গতি কমিয়ে কক্ষপথে থেকে যাওয়া যায়।',
      tip: 'জ্বালানি ভারী, আর রকেটকে তার প্রতিটি ফোঁটা তুলতে হয়। ওজনের মিটারে চোখ রাখো।',
    },
    'moon-3': {
      job: 'পুরো রোবটটা নিজে বানাও: বিজ্ঞানযন্ত্র, বিদ্যুৎ, রেডিও আর জ্বালানি। তারপর ওড়াও।',
      tip: 'বিজ্ঞানের যন্ত্রাংশ ডেটা জোগাড় করে। বড় ডিশ সেই ডেটা আরও তাড়াতাড়ি বাড়ি পাঠায়।',
    },
    mars: {
      job: 'মঙ্গলে একটি রোবট পাঠাও, আর গ্রহটা নিয়ে গবেষণার সময় তাকে বাঁচিয়ে রাখো।',
      tip: 'রেডিওতে মঙ্গল কয়েক মিনিটের পথ, তাই তোমার আদেশ দেরিতে পৌঁছায়। বিপদের কার্ডে আগেভাগে উত্তর দাও।',
    },
    venus: {
      job: 'টাকা ফুরিয়ে না ফেলে মেঘে ঢাকা শুক্রে একটি রাডার রোবট পাঠাও।',
      tip: 'প্রতিটি সিদ্ধান্তে কয়েন খরচ হয়। সস্তা ভালো, কিন্তু যে রোবট ভেঙে যায় সে কিছুই আনে না।',
    },
    bennu: {
      job: 'একটি ছোট গ্রহাণুর কাছে যাও, তাকে খুঁটিয়ে দেখো, আর একটি নুড়ির নমুনা বাড়ি নিয়ে এসো।',
      tip: 'গ্রহাণুর মাধ্যাকর্ষণ নেই বললেই চলে। বাড়তি জ্বালানি থাকলে তার কাছে নিরাপদে থাকা যায়।',
    },
    jupiter: {
      job: 'খুঁজে বের করো, কোনো রকেট পৃথিবী থেকে সোজা বৃহস্পতিতে রোবট পাঠাতে পারে কি না।',
      tip: 'ওজনের মিটারে কিছুই না আঁটলে সেটাই শিক্ষা: আসল মিশনগুলো আগে অন্য গ্রহের পাশ দিয়ে ঘুরে যায়।',
    },
  },
  FREE_BRIEFING: {
    job: 'যেমন খুশি রোবট বানাও, উৎক্ষেপণ করো, আর মিশন শেষ না হওয়া পর্যন্ত তাকে বাঁচিয়ে রাখো।',
    tip: 'ডান দিকের বিপদগুলো সামলাতে পারে এমন যন্ত্রাংশ নাও। প্রতিটি যন্ত্রাংশ দেখায় সেটা কোন বিপদে কাজে লাগে।',
  },
  DAILY_BRIEFING: {
    job: 'আজকের মিশন সব খেলোয়াড়ের জন্য একই। রোবটকে বাঁচিয়ে রাখো, তারপর নিজের ফল মিলিয়ে দেখো।',
    tip: 'দিনে মাত্র একবার সুযোগ, তাই বেছে নেওয়ার আগে প্রতিটি বিপদের কার্ড পড়ে নাও।',
  },
  MISSION_STEPS_WORDS: [
    { word: 'গোছাও', line: 'রকেটের নাকে আঁটে এমন যন্ত্রাংশ বেছে নাও।' },
    { word: 'উৎক্ষেপণ', line: 'একটি সবুজ দিন বাছো, ARM সুইচ ওঠাও, উৎক্ষেপণ চাপো।' },
    { word: 'ওড়াও', line: 'সময় চলতে দাও। বিপদের কার্ড এলে উত্তর দাও।' },
    { word: 'রিপোর্ট', line: 'দেখো কেমন করলে, আর তারা জিতে নাও।' },
  ],
  STAR_GOALS: (dest) => [`${placeIn(dest)} পৌঁছাও আর প্রথম বিজ্ঞান-তথ্য বাড়ি পাঠাও।`, 'মিশনের অর্ধেক বিজ্ঞান বাড়ি নিয়ে এসো।', 'মিশনের বেশির ভাগ বিজ্ঞান বাড়ি নিয়ে এসো।'],
  REAL_MISSION_LINE: (label) => `সেখানে যাওয়া আসল NASA মিশন: ${label}।`,
  COACH: [
    { title: 'সময় চলতে দাও', body: 'ওড়াতে নিচের 10×, 100× বা 1000× চাপো। থামাতে II চাপো। প্রতিটি কার্ডের পরে সময় আবার চলতে থাকে।' },
    { title: 'বিপদের কার্ড', body: 'বিপদ এগিয়ে এলে সময় থেমে যায় আর একটি কার্ড আসে। একটি উত্তর বাছো। প্রতিটি উত্তর দেখায় তার খরচ কত।' },
    { title: 'আদেশ ধীরে পৌঁছায়', body: 'তোমার আদেশ আলোর গতিতে মহাকাশ পাড়ি দেয়। রোবটের কাছে পৌঁছাতে কয়েক মিনিট লাগতে পারে, তাই আগেভাগে কাজ করো।' },
    { title: 'চারটি দণ্ডে চোখ রাখো', body: 'বিদ্যুৎ, জ্বালানি, ডেটা আর সিস্টেম ওপরে দেখা যায়। এগুলোকে লাল ঘর থেকে দূরে রাখো।' },
    { title: 'তোমার রোবট চিঠি লেখে', body: 'তার বার্তাও আলোর গতিতে আসে। তার বিজ্ঞান-তথ্য পৃথিবীতে পৌঁছালে তুমি আসল NASA পোস্টকার্ড পাবে।' },
    { title: 'শেষ পর্যন্ত যাও', body: 'মিশন শেষ হলে রিপোর্ট আর তারা পাবে। তাড়া আছে? মিশন শেষ করো চাপলে বাকিটা রোবট নিজেই উড়বে।' },
  ],
  HOW_TO_PLAY: { label: 'কীভাবে খেলবে', sub: 'নতুন? এক মিনিটে খেলাটা শিখে নাও।' },
  HOME_WORDS: {
    more: 'আরও',
    kicker: 'মিশন কন্ট্রোল · গভীর মহাকাশ',
    pitch: 'রকেট তুমি চালাও না। তুমি লক্ষ লক্ষ কিলোমিটার দূরের একটি রোবটকে বাঁচিয়ে রাখো, আর তোমার প্রতিটি আদেশ পৌঁছায় কয়েক মিনিট দেরিতে।',
    play: 'খেলো',
    playLabel: (n, title) => `খেলো: মিশন ${n}, ${title}`,
    mission: (n, title) => `মিশন ${n} · ${title}`,
    choose: 'মিশন বাছো ▸',
    order: 'আদেশ: ক্যামেরা চালু করো',
    untilHeard: 'পরে রোবট তোমার কথা শুনবে',
    received: 'পৌঁছেছে ✓',
    earth: 'পৃথিবী',
    daily: 'দৈনিক মিশন',
    dailySub: (n, weather) => `দৈনিক #${n}। ${weather}`,
    dailyQuiet: 'আজ সবার জন্য একই মিশন।',
    dailyDone: 'শেষ ✓',
    dailyNew: 'আজ নতুন',
    rescue: 'উদ্ধার-ইতিহাস',
    rescueSub: 'যে আসল রোবটগুলো প্রায় মারা যাচ্ছিল। তাদের বাঁচানোর চেষ্টা করো।',
    notebook: 'নোটবুক',
    notebookSub: 'তোমার অর্জন করা আসল শিক্ষা।',
    count: (got, total) => `${got} / ${total}`,
  },
  MODE_WORDS: { cadet: 'ক্যাডেট', engineer: 'ইঞ্জিনিয়ার', short: 'ইঞ্জি' },
  BRIEF_WORDS: {
    kicker: (dest) => `মিশনের ব্রিফিং · ${place(dest)}`,
    learn: (concept) => `তুমি শিখবে: ${concept.toUpperCase()}`,
    job: 'তোমার কাজ',
    tip: 'পরামর্শ:',
    stars: 'কীভাবে তারা জিতবে',
    steps: 'ধাপগুলো',
  },
  MARS_NOW: {
    title: 'মঙ্গল এই মুহূর্তে',
    away: 'দূরে',
    takes: 'একটি বার্তা পৌঁছাতে লাগে',
    oneWay: '(একদিকে)',
    next: 'পরের সৌর সংযোগ',
    in: '· বাকি',
    now: 'এখন সৌর সংযোগ: সূর্য পৃথিবী আর মঙ্গলের মাঝখানে। মিশনগুলো আদেশ পাঠানো থামিয়ে রাখে।',
    until: '· শেষ হবে',
  },
  LAUNCH_CHECKS: {
    packed: 'আঁটে এমন যন্ত্রাংশ গোছাও',
    day: 'একটি সবুজ উৎক্ষেপণের দিন বাছো',
    arm: 'ARM সুইচ ওঠাও',
    go: 'উৎক্ষেপণ চাপো',
  },
  NAV: {
    back: '◂ ফিরে যাও',
    info: 'মিশনের তথ্য',
    help: 'কীভাবে ওড়াবে',
    start: 'বুঝেছি ▸',
    next: 'পরের ▸',
    prev: '◂ আগের',
    finish: 'মিশন শেষ করো ▸▸',
    skip: 'বাদ দাও',
  },
  FINISH_CONFIRM: {
    title: 'মিশন শেষ করবে?',
    body: 'বাকিটা রোবট নিজেই উড়বে। যেকোনো বিপদে সে নিজের তৈরি পরিকল্পনা মেনে চলবে, তারপর তুমি রিপোর্ট দেখবে।',
    yes: 'মিশন শেষ করো ▸▸',
    no: 'উড়তে থাকো',
  },
  LEAVE_CONFIRM: {
    title: 'এই ফ্লাইট ছেড়ে যাবে?',
    body: 'এই ফ্লাইট শেষ হবে, আর তুমি আগের স্ক্রিনে ফিরে যাবে। সেখান থেকে আবার উৎক্ষেপণ করতে পারবে।',
    leave: '◂ ফ্লাইট ছাড়ো',
    finish: 'শেষ করে রিপোর্ট দেখো ▸▸',
    stay: 'উড়তে থাকো',
  },

  // -------------------------------------------------------------------------
  // The robot's name

  ROBOT_WORDS: {
    nameLabel: 'তোমার রোবটের নাম',
    suggest: 'একটি নাম সাজেস্ট করো',
    took: (dest, delay) => `${place(dest)} থেকে · তোমার কাছে আসতে লেগেছে ${delay}`,
    lastMessage: (name) => `${name}-এর শেষ বার্তা`,
  },
  NAME_WORDS: {
    kicker: 'প্যাড 39A · উৎক্ষেপণের আগে',
    intro1: '> একটি নতুন রোবট প্যাডে অপেক্ষা করছে।',
    intro2: '> তার একটা নাম দাও।',
    count: (n, max) => `নাম · ${n} / ${max}`,
    input: 'রোবটের নাম',
    suggestions: ['VOYA', 'TALLY', 'KESTREL'],
    suggestion: (n) => `পরামর্শ ${n}`,
    launch: 'আজকের আকাশে উৎক্ষেপণ',
    firstHead: (name, day) => `${name} · দিন ${day} · এইমাত্র পাঠানো`,
    noDelay: 'এই শেষবার কোনো দেরি নেই',
    firstWords: 'সিস্টেম চালু। জ্বালানি ভরা। তুমি প্রস্তুত হলেই আমি প্রস্তুত।',
    load: (name) => `${name}-কে তোলো`,
    loadSub: 'এরপর: যন্ত্রাংশ গোছানোর ঘর',
    skip: (name) => `বাদ দাও · নাম থাকুক ${name}`,
    sky: 'আজকের আকাশ',
    skyLine: (date, minutes) => `আজ · ${date} · মঙ্গল ${minutes} আলোক-মিনিট দূরে`,
    skyPhone: (minutes) => `মঙ্গল ${minutes} আলোক-মিনিট দূরে`,
    skyEng: (au, mkm, t) => `${au} · ${mkm} · t = d / c = ${t}`,
  },

  // -------------------------------------------------------------------------
  // Big moments, sound and language

  SOUND_WORDS: { on: 'শব্দ চালু', off: 'শব্দ বন্ধ' },
  LANG_WORDS: { label: 'ভাষা', en: 'EN', bn: 'বাংলা' },
  COLD_OPEN: {
    label: 'Mars Climate Orbiter, 1999: যে সিগন্যাল আর ফেরেনি',
    burn: (date, craft) => `${date} · ${craft.toUpperCase()} · কক্ষপথে ঢোকার বার্ন`,
    expected: 'মঙ্গলের আড়াল থেকে বেরোলেই সিগন্যাল আসার কথা',
    receive: '▶ বার্তা গ্রহণ করো',
    waiting: 'সিগন্যালের অপেক্ষা',
    lost: '— কোনো সিগন্যাল নেই —',
    units: 'এক দল মেপেছিল পাউন্ডে। অন্য দল, নিউটনে।',
    moral: 'তোমার প্রতিটি আদেশ দেরিতে পৌঁছায়। তাই ভেবেচিন্তে পাঠাও।',
    source: (citation) => `সূত্র · ${citation.toUpperCase()}`,
    skip: 'বাদ দাও ▸',
    menu: 'ভূমিকা',
    menuSub: 'শুরুটা আবার দেখো: যে রোবট চুপ হয়ে গিয়েছিল।',
    menuTag: 'আবার',
  },
  MOMENT_WORDS: {
    countdownK: 'উৎক্ষেপণ',
    count: (n) => `T−${f.num(n)}`,
    liftoff: 'উড়ে গেল!',
    skip: 'বাদ দাও ▸',
    arrived: (dest, asteroid) => (asteroid ? `${placeIn(dest)} পৌঁছে গেছি!` : `${placeOf(dest)} কক্ষপথে!`),
    arrivedSub: (name) => `${name} ইঞ্জিন চালাল, আর মাধ্যাকর্ষণ তাকে ধরে ফেলল।`,
    arrivedSubBennu: (name) => `${name} গতি কমিয়ে গ্রহাণুর পাশাপাশি উড়ছে।`,
    storm: 'সৌরঝড় আঘাত হেনেছে!',
    stormSub: (name) => `সূর্যের কণা ${name}-কে আঘাত করছে।`,
    launchFailed: 'উৎক্ষেপণ ব্যর্থ',
  },

  // -------------------------------------------------------------------------
  // Postcards, ranks and badges

  POSTCARD_WORDS: {
    menu: 'পোস্টকার্ড',
    menuSub: 'তোমার রোবটদের বাড়ি পাঠানো আসল NASA ছবি।',
    title: 'মহাকাশ থেকে পোস্টকার্ড',
    sub: 'NASA মিশনের আসল ছবি। রোবটের বিজ্ঞান-তথ্য পৃথিবীতে পৌঁছালে সে একটি করে বাড়ি পাঠায়।',
    toast: (dest) => `📮 ${place(dest)} থেকে পোস্টকার্ড!`,
    look: 'দেখতে ছোঁও',
    keep: 'উড়তে থাকো ▸',
    close: 'বন্ধ করো',
    credit: (c) => `ছবি: ${c}`,
    report: 'এই ফ্লাইটের পোস্টকার্ড',
    none: 'এবার কোনো পোস্টকার্ড নেই: কোনো বিজ্ঞান-তথ্য পৃথিবীতে পৌঁছায়নি।',
    locked: 'তালাবন্ধ',
    hint: (dest, share) =>
      share <= 0
        ? `${placeIn(dest)} উড়ে যাও আর প্রথম বিজ্ঞান-তথ্য বাড়ি পাঠাও।`
        : share >= 1
          ? `${place(dest)} থেকে সব বিজ্ঞান-তথ্য বাড়ি পাঠাও।`
          : `${place(dest)} থেকে অর্ধেক বিজ্ঞান-তথ্য বাড়ি পাঠাও।`,
  },
  RANK_WORDS: {
    cadet: 'ক্যাডেট',
    'flight-controller': 'ফ্লাইট কন্ট্রোলার',
    capcom: 'ক্যাপকম',
    'flight-director': 'ফ্লাইট ডিরেক্টর',
    'mission-legend': 'মিশন কিংবদন্তি',
  },
  CREW_WORDS: {
    title: 'ক্রু ফাইল',
    rank: 'তোমার পদ',
    toNext: (n, next) => `${next} হতে আর ${f.num(n)}★`,
    top: 'সর্বোচ্চ পদ',
    stars: (n, max) => `${f.num(max)}টির মধ্যে ${f.num(n)}টি তারা`,
    badges: 'ব্যাজ',
    open: 'তোমার ক্রু ফাইল খোলো',
    close: 'বন্ধ করো',
    realJob: 'আসল কাজটা',
    promoted: 'পদোন্নতি!',
    newBadge: 'নতুন ব্যাজ',
    earned: 'পেয়েছ',
    locked: 'এখনো না',
  },
  BADGE_WORDS: {
    'first-flight': { name: 'প্রথম ফ্লাইট', how: 'যেকোনো মিশনে একটি তারা জেতো।' },
    'storm-survivor': { name: 'ঝড় পেরোনো', how: 'কোনো যন্ত্র না হারিয়ে একটি সৌরঝড় পার হও।' },
    'through-the-sun': { name: 'সূর্যের ওপারে', how: 'সূর্য যখন তোমার রেডিও আটকে রাখে (সৌর সংযোগ), তখনো উড়তে থাকো।' },
    'night-shift': { name: 'রাতের পালা', how: 'বিদ্যুৎ না ফুরিয়ে পুরো একটি গ্রহণের মৌসুম পার করো।' },
    'bonus-time': { name: 'বাড়তি সময়', how: 'ফ্লাইটের শেষে মিশন বাড়ানোর অনুরোধ করো।' },
    'sample-home': { name: 'নমুনা বাড়িতে', how: 'গ্রহাণু Bennu-র একটি টুকরো পৃথিবীতে নিয়ে এসো।' },
    shutterbug: { name: 'ছবি-পাগল', how: 'এক জায়গার সব পোস্টকার্ড জোগাড় করো।' },
    'daily-streak': { name: 'রোজকার ধারা', how: 'পরপর তিন দিন দৈনিক মিশন খেলো।' },
    rescuer: { name: 'উদ্ধারকারী', how: 'উদ্ধার-ইতিহাসে একটি রোবটকে বাঁচাও।' },
    'big-thinker': { name: 'বড় ভাবুক', how: 'খুঁজে বের করো কেন কোনো রকেট সোজা বৃহস্পতিতে যায় না।' },
  },
};
