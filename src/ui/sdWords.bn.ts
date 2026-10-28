// বাংলা: the Bangla words for the Signal Delay screens, export by export with the same shape as sdWords.ts (spec UI
// rule 48). lang.ts reads them when the player picks বাংলা.
// - Numbers and units are formatted exactly as in English (format.ts): Latin digits, the same units.
// - NASA mission names and science target names stay in English; so do robot names (A–Z only) and the game's name.
// - Planet names from the engine's data are said in Bangla (`place`); an asteroid keeps its name.
// - Friendly "তুমি" throughout, as the English talks to the player as "you".
// tests/lang.test.ts checks that every English word has its Bangla here.
import type * as EN from './sdWords';
import type * as OPS from './opsWords';
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
          ? { [K in keyof T as K extends 'icon' | 'color' | 'tone' ? never : K]: Words<T[K]> }
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
/** opsWords (the console drawers and the event feed), every export. */
export type BanglaOps = { [K in keyof typeof OPS]: Words<(typeof OPS)[K]> };

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

/** What each level teaches, for the subtitle under its English title. */
const BN_TEACHES: Record<string, string> = {
  'moon-1': 'শক্তি',
  'moon-2': 'জ্বালানি আর ওজন',
  'moon-3': 'বিজ্ঞান আর রেডিও',
  mars: 'আলোর দেরি',
  venus: 'বাজেট',
  bennu: 'গ্রহাণুর সঙ্গে দেখা আর ফেরা',
  jupiter: 'রকেটের সীমা',
};

/** A DONKI time as the record writes it (Latin digits, UTC). */
const donkiTime = (t: string) => t.replace('T', ' ').replace('Z', ' UTC');

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

/** A time in Bangla words: the same rounded number as English (format.ts durationParts), the unit in Bangla. */
const BN_UNIT = { day: 'দিন', hour: 'ঘণ্টা', minute: 'মিনিট', second: 'সেকেন্ড' } as const;
const duration = (s: number) => {
  const { n, unit } = f.durationParts(s);
  return `${f.num(n)} ${BN_UNIT[unit]}`;
};
const days = (n: number) => `${f.num(n)} দিন`;
const years = (n: number) => `${f.num(n)} বছর`;

/** The engine's hazard titles and questions in Bangla (the data stays English; the card says these). */
const BN_HAZARD: Record<string, string> = {
  'solar-storm': 'সৌর বিকিরণ-ঝড়',
  'cme-shock': 'CME-এর ধাক্কা',
  'mars-dust-storm': 'গ্রহজোড়া ধুলোঝড়',
  debris: 'ধূমকেতুর ধুলোর স্রোত',
  'reaction-wheel': 'রিঅ্যাকশন হুইল বিকল',
  'memory-corruption': 'কম্পিউটারের মেমরি নষ্ট',
  'insertion-anomaly': 'পৌঁছানোর বার্নে গোলমাল',
  'radiation-damage': 'বিকিরণে ক্ষতি',
  'drag-heating': 'গরম নিচু পাস',
};
const BN_PROMPT: Record<string, string> = {
  'solar-storm': 'সূর্য থেকে শক্তিশালী কণা ধেয়ে আসছে: একটা সৌর বিকিরণ-ঝড়। যন্ত্রগুলো বাঁচাবে?',
  'cme-shock': 'একটা করোনাল ম্যাস ইজেকশন (CME) মঙ্গলের দিকে আসছে। NASA-র মডেল বলছে তার ধাক্কা কখন পৌঁছাবে। সামলে নেবে?',
  'mars-dust-storm': 'পুরো গ্রহ ধুলোয় ঢেকে যাচ্ছে, আর ওপরের বায়ুমণ্ডল ফুলে উঠছে। অরবিটার কী করবে?',
  debris: 'একটা ধূমকেতু খুব কাছ দিয়ে যাবে, আর তার ধুলো যানে লাগতে পারে। কীভাবে বাঁচাবে?',
  'reaction-wheel': 'যানকে তাক করার মতো যথেষ্ট রিঅ্যাকশন হুইল আর বাকি নেই। এখন সে কীভাবে তাক করবে?',
  'memory-corruption': 'ফ্লাইট কম্পিউটারের মেমরি নষ্ট হয়ে গেছে। কীভাবে ঠিক করবে?',
  'insertion-anomaly': 'পৌঁছানোর বার্ন পরিকল্পনামতো হয়নি। এখন কী?',
  'radiation-damage': 'ইলেকট্রনিকস যতটা সইতে পারে, তার চেয়ে বেশি বিকিরণ খেয়ে ফেলেছে।',
  'drag-heating': 'বাতাসের ভেতর দিয়ে নিচু পাস যানকে গরম করে তুলছে। ওপরে উঠে যাবে, নাকি নিচে থেকেই ছবিটা শেষ করবে?',
};
const hazardBn = (type: string, title: string) => BN_HAZARD[type] ?? title;

const BN_EFFECT_LINE: Record<string, string> = {
  craft: 'যোগাযোগ বিচ্ছিন্ন। রোবট হারিয়ে গেছে।',
  instrument: 'একটা যন্ত্র চিরতরে নষ্ট হয়ে গেছে।',
  'stored-data': 'রোবটে জমা ছবিগুলো মুছে গেছে।',
  'safe-mode': 'রোবট সেফ মোডে লুকিয়েছে।',
};

/** The robot's lines when a hazard hits (sdWords' HIT_VOICE). */
const BN_HIT_VOICE: Record<string, string[]> = {
  'solar-storm': ['এখানে ঝড়। কণাগুলো আমার প্যানেলে আঘাত করছে।', 'আরেকটা সৌরঝড়। সার্কিটে টের পাচ্ছি।'],
  'cme-shock': ['CME আঘাত হেনেছে। নিচে মেরুজ্যোতি।', 'সূর্যের ধাক্কা-তরঙ্গ। সবকিছু কাঁপছে।'],
  'mars-dust-storm': ['নিচে ধুলোঝড়। বাতাস ফুলে আমার কক্ষপথের দিকে উঠছে।'],
  debris: ['ছোট্ট কিছু একটা এইমাত্র পাশ দিয়ে গেল। খুব জোরে।'],
  'reaction-wheel': ['আমার একটা চাকা ঘষা খাচ্ছে।'],
  'memory-corruption': ['মেমরিতে ভুল। পরীক্ষা চালাচ্ছি।'],
  'radiation-damage': ['{destOf} চারপাশে প্রচণ্ড বিকিরণ। সার্কিট ঝিনঝিন করছে।'],
};

const BN_VOICE = {
  launch: ['উড়ে গেলাম। সিস্টেম চালু। পরের গন্তব্য: {dest}।'],
  'launch-failed': ['রকেট ব্যর্থ হয়েছে। আমি প্যাড ছেড়ে উঠতেই পারিনি।'],
  halfway: ['{destOf} পথের অর্ধেক পেরোলাম। পেছনে পৃথিবী এখন একটা নীল বিন্দু।'],
  arrived: ['{destIn} পৌঁছেছি। ইঞ্জিন চালালাম। মাধ্যাকর্ষণ আমাকে ধরে ফেলল।'],
  science: ['যন্ত্র চালু। নিচে {dest}। মানচিত্র বানাচ্ছি।'],
  'heading-home': ['নমুনা তুলে রেখেছি। বাড়ির দিকে ফিরছি।'],
  'bonus-time': ['বাড়তি মিশন শুরু। এখনো আছি। এখনো কাজ করছি।'],
  dark: ['গ্রহণের মৌসুম। প্রতি কক্ষপথে {dark} পর্যন্ত অন্ধকার। ব্যাটারিতে চলছি।', 'আবার ছায়ার মৌসুম। প্রতি কক্ষপথে {dark} অন্ধকার। হিটার একটু কমালাম।', 'আবার অন্ধকার। নিয়ম আমার জানা।'],
  conjunction: ['সূর্য আমাদের মাঝখানে। কিছুদিন কোনো আদেশ আসবে না। নিজেই উড়ছি।'],
  'conjunction-end': ['সূর্য সরে গেছে। আবার তোমার কথা শুনতে পাচ্ছি।'],
  saved: ['{hazard} পেরিয়ে গেল। সব সিস্টেম নিরাপদ।', 'কাজ হয়েছে। কোনো ক্ষতি নেই।', 'এখানে সব ঠিক আছে।'],
  hurt: ['{hazard}: কিছু একটা ভেঙেছে। তবু উড়ছি।', 'ক্ষতি হয়েছে। যতটা পারি চালিয়ে যাচ্ছি।'],
  'instrument-lost': ['একটা যন্ত্র হারালাম। বাকিগুলো দিয়ে কাজ চালাচ্ছি।'],
  'safe-mode': ['সেফ মোড। অদরকারি সব বন্ধ। আদেশের অপেক্ষায়।'],
  brownout: ['ব্যাটারি কম। বাঁচতে কিছু জিনিস বন্ধ করছি।'],
  'wheel-spare': ['একটা চাকা বিকল। বাড়তিটা দায়িত্ব নিয়েছে। এখনো ঠিক দিকে তাক করে আছি।'],
  'out-of-fuel': ['ট্যাংক খালি। আর দিক বদলাতে পারছি না।'],
  'prime-complete': ['মূল মিশন শেষ। আমার সব বিজ্ঞান-তথ্য পথে।'],
  'last-words': ['আমার ব্যাটারি কম, আর অন্ধকার হয়ে আসছে।'],
  'order-received': ['আদেশ পেয়েছি। {option}। হয়ে গেছে।'],
  'acted-alone': ['সময়মতো কোনো আদেশ আসেনি। আমি বেছে নিলাম: {option}।'],
  'order-too-late': ['তোমার আদেশ দেরিতে এসেছে। আমি আগেই কাজ সেরে ফেলেছি।'],
  'science-milestone': ['বিজ্ঞান-লক্ষ্যের {pct} বাড়ি পাঠানো হয়েছে।'],
  extension: ['বাড়তি মিশনের আদেশ পেয়েছি। আরও {years}। এখনো আছি।'],
  'signing-off': ['{name} বিদায় নিচ্ছে। ধন্যবাদ, পৃথিবী।'],
  targets: ['{name} এখন {destOf} কক্ষপথে। কী দেখবে সে?'],
  observing: ['আদেশ পেয়েছি। {target}-এর ছবি তোলার তালিকায় রাখলাম।'],
  'observe-refused': ['এখন {target}-এর ছবি তুলতে পারছি না।'],
  'image-sent': ['{target}-এর ছবি বাড়ি পাঠালাম। {comment}'],
  'far-side': ['প্রতি {period}-এ {lost} চাঁদের আড়ালে থাকি। সেখানে সিগন্যাল নেই। নিজেই উড়ি।'],
  'link-back': ['যোগাযোগ ফিরেছে। তোমার আদেশ চাঁদের আড়ালে {waited} অপেক্ষা করেছে।'],
  'trim-burn': ['ট্রিম বার্ন: {dv}। চাঁদের এবড়োখেবড়ো মাধ্যাকর্ষণ আমাকে নিচে টানে। কক্ষপথ ধরে রাখছি।'],
};
const BN_VOICE_ALT = {
  arrivedBurn: 'ইঞ্জিন চালালাম: গতি কমল {dv}, জ্বালানি গেল {burned}। {dest} আমাকে ধরে ফেলল।',
  plan: 'আদেশ পেয়েছি। নতুন বিদ্যুৎ-পরিকল্পনা চালু।',
  standing: 'আদেশ পেয়েছি। নতুন স্থায়ী আদেশ রেখে দিলাম।',
  standingChoice: 'নতুন কোনো আদেশ নেই। তোমার স্থায়ী আদেশ মানছি: {option}।',
  goalMet: 'বিজ্ঞান-লক্ষ্য পূরণ। যা আনতে এসেছিলাম, সব বাড়ি পাঠানো হয়েছে।',
  hitUnknown: 'এখানে ঝামেলা। এইমাত্র কিছু একটা গোলমাল হলো।',
  observeDip: 'আদেশ পেয়েছি। {target}-এর জন্য নিচে নামছি। ছবি তালিকায়। {days} পরে আবার ওপরে।',
  observeFarSide: 'আদেশ পেয়েছি। {target} চাঁদের উল্টো পিঠে। তোমার চোখের আড়ালে একাই তুলব। ছবি তালিকায়।',
  refusedFuel: '{target}-এর জন্য যথেষ্ট জ্বালানি নেই। কক্ষপথে থাকতে যা লাগে, তা রেখে দিচ্ছি।',
  refusedUnreachable: 'এই কক্ষপথ থেকে {target} স্পষ্ট দেখতে পাই না।',
  refusedAlready: '{target} আগেই আমার তালিকায় আছে।',
  refusedNotInOrbit: 'এখনো কক্ষপথে নেই। {destIn} পৌঁছালে আবার বলো।',
};
const BN_STATUS_VOICE = {
  cruise: ['যাত্রা ঠিকঠাক। {destIn} পৌঁছাতে {days} দিন। জ্বালানি বাকি {fuel}।', 'সব শান্ত। পৃথিবী থেকে {dist} দূরে। পথ ধরে আছি।', 'স্টার ট্র্যাকার লক করা। {destIn} পৌঁছাতে {days} দিন।'],
  orbit: ['কক্ষপথ ঠিকঠাক। এ পর্যন্ত {data} বাড়ি পাঠিয়েছি।', 'সব শান্ত। মানচিত্র বানাচ্ছি। জ্বালানি বাকি {fuel}।', 'হিটার চলছে-থামছে। পৃথিবী থেকে {dist} দূরে। টিকে আছি।'],
  home: ['বাড়ির পথে। সব শান্ত। পৃথিবী থেকে {dist} দূরে।'],
};
const BN_TARGET_COMMENT: Record<string, string> = {
  'olympus-mons': 'এটা আমার পুরো দৃষ্টির চেয়েও চওড়া ছিল।',
  'valles-marineris': 'পুরো গ্রহজুড়ে একটা ফাটল। গোটা পাসজুড়ে আমি তার পিছু নিলাম।',
  'north-polar-cap': 'সাদা প্যাঁচ। বরফ যেন কিছু একটা লিখে রাখছে।',
  phobos: 'খাঁজগুলো দেখার মতো কাছে। এটা মঙ্গলের দিকে পড়ছে। ধীরে ধীরে।',
  deimos: 'ছোট। চুপচাপ। মসৃণ, যেন ওপরে বালি ঢেলে দেওয়া।',
  limb: 'এখানে আকাশ একটা সরু রেখা। দেখতে নিচু দিয়ে উড়েছি।',
  'apollo-11': 'ল্যান্ডারটা এখনো সেখানে। তাঁদের পায়ের ছাপও।',
  tycho: 'মাঝের চূড়ায় সূর্যোদয়। তার ছায়া মেঝে পেরিয়ে গেল।',
  shackleton: 'কিনারায় আলো। ভেতরের মেঝে কখনো সূর্য দেখেনি।',
  tsiolkovskiy: 'চাঁদের উল্টো পিঠে কালো লাভা। পৃথিবীর কেউ নিজের চোখে এটা কখনো দেখেনি।',
};
const BN_TARGET_NAME: Record<string, string> = {
  'olympus-mons': 'OLYMPUS MONS',
  'valles-marineris': 'VALLES MARINERIS',
  'north-polar-cap': 'NORTH POLAR CAP',
  phobos: 'PHOBOS',
  deimos: 'DEIMOS',
  limb: 'THIN AIR AT THE LIMB',
  'apollo-11': 'THE APOLLO 11 SITE',
  tycho: 'TYCHO',
  shackleton: 'SHACKLETON',
  tsiolkovskiy: 'TSIOLKOVSKIY',
};
const fillBn = (template: string, slots: Record<string, string>) => template.replace(/\{(\w+)\}/g, (all, k: string) => slots[k] ?? all);

/** A hazard's name inside a Bangla sentence: the danger deck's word (DANGER_LOOK's Bangla), else the engine's title. */
const BN_DANGER_TITLE: Record<string, string> = {
  eclipse: 'গ্রহণের মৌসুম',
  conjunction: 'সূর্য মাঝখানে',
  'solar-storm': 'বিকিরণ-ঝড়',
  'cme-shock': 'CME-এর ধাক্কা',
  'mars-dust-storm': 'ধুলোঝড়',
  debris: 'ধূমকেতুর ধুলো',
  'reaction-wheel': 'চাকা বিকল',
  'memory-corruption': 'মেমরির গোলমাল',
  'insertion-anomaly': 'পৌঁছানোর বার্নে গোলমাল',
};
const dangerBn = (type: string, title: string) => BN_DANGER_TITLE[type] ?? hazardBn(type, title.toUpperCase());
const BN_CHIP: Record<string, string> = { craft: 'রোবট হারিয়েছে', instrument: 'যন্ত্র হারিয়েছে', 'stored-data': 'ছবি মুছে গেছে', 'safe-mode': 'সেফ মোড' };
const BN_CATEGORY_WORD: Record<string, string> = {
  science: 'বাড়ি পাঠানো বিজ্ঞান',
  success: 'মিশনের পর্বগুলো',
  budget: 'বাজেট',
  deltaV: 'জ্বালানির মার্জিন',
  power: 'বিদ্যুতের মার্জিন',
  mass: 'ওজনের মার্জিন',
  crisis: 'সংকট সামলানো',
};
/** "Face …" in an unlock hint: the hazard with Bangla's genitive ending, ready for "মুখোমুখি হও". */
const BN_HAZARD_PHRASE: Record<string, string> = {
  'solar-storm': 'একটা সৌরঝড়ের',
  'cme-shock': 'একটা CME-এর ধাক্কার',
  'mars-dust-storm': 'একটা ধুলোঝড়ের',
  debris: 'ধূমকেতুর ধুলোর',
  'reaction-wheel': 'চাকা বিকল হওয়ার',
  'memory-corruption': 'একটা মেমরির গোলমালের',
  'insertion-anomaly': 'পৌঁছানোর বার্নের গোলমালের',
  'radiation-damage': 'বিকিরণের ক্ষতির',
};
const BN_FINAL = {
  opening: {
    complete: 'দিন {day}। {science} দিন ধরে আমি {destOf} দিকে তাকিয়ে ছিলাম।',
    lost: 'দিন {day}। আমি {name}। তুমি কি শুনছ?',
    extended: 'দিন {day}। মূল মিশন শেষ। বাড়তিটাও।',
  },
  hurt: 'দিন {when}-এর {hazard} আমাকে আঘাত করেছিল। {effect}',
  effect: {
    craft: 'আমি প্রায় টিকতেই পারিনি।',
    instrument: 'একটা যন্ত্র আর কখনো জাগেনি।',
    'stored-data': 'যে ডেটা আমার কাছে ছিল, তা হারিয়ে গেছে।',
    'safe-mode': 'কয়েক দিন আমি সেফ মোডে লুকিয়ে ছিলাম।',
  },
  saved: {
    part: '{part} আমার হয়ে {hazard} সামলেছে।',
    autopilot: 'কোনো আদেশ সময়মতো পৌঁছাতে পারেনি। অটোপাইলট চিপ আমাকে {hazard} পার করিয়েছে।',
    choice: 'দিন {when}-এ তুমি বেছেছিলে {option}। ওটাই আমাকে বাঁচিয়েছে।',
  },
  arrival: 'তুমি আমাকে {dv} বার্নে পাঠিয়েছিলে। {dest} প্রথম চেষ্টাতেই আমাকে ধরে ফেলেছে।',
  conjunction: '{days} দিন সূর্য আমাদের মাঝখানে ছিল। আমি নিজেই উড়েছি।',
  quiet: 'কিছুই ভাঙেনি। একবারও না।',
  fuel: 'জ্বালানি বাকি {fuel}। ব্যাটারি টিকে আছে।',
  extension: 'বাড়তি মিশন শেষ: পরিকল্পনার চেয়ে আরও {years}।',
  signOff: 'মূল মিশন শেষ। {name} বিদায় নিচ্ছে।',
  cause: {
    hazard: '{hazard} সামলাতে পারলাম না। সিস্টেম বিকল হচ্ছে।',
    fuel: 'আমার ট্যাংক খালি। পথ ধরে রাখতে পারছি না।',
    power: '{days} দিন বিদ্যুৎ নেই। ব্যাটারি প্রায় শেষ।',
    unknown: 'কিছু একটা গোলমাল। সিস্টেম বিকল হচ্ছে।',
  },
  cutOff: 'আমার অ্যান্টেনা ঘোরাচ্ছি সেদিকে, যেখানে পৃথিবী থাকার কথা, যেখান',
};
const BN_PART_UPPER = (id: string) => BN_PART_NAME[id] ?? id;

export const BN: Bangla = {
  // -------------------------------------------------------------------------
  // Mission Report, final transmission, album, Notebook and Daily

  panelWords: (pnl, ctx) => {
    const day = `দিন ${f.num(pnl.day)}`;
    switch (pnl.kind) {
      case 'launch':
        return { head: `${day} · উড়ে গেল`, text: `${ctx.rocket} রকেটে প্যাড ছাড়ল। এখন রোবট নিজেই নিজের ভরসা।` };
      case 'launch-failed':
        return { head: `${day} · উৎক্ষেপণ ব্যর্থ`, text: 'উৎক্ষেপণের দিন রকেট ব্যর্থ হলো। রকেট নিখুঁত নয়।' };
      case 'not-launched':
        return { head: `${day} · উৎক্ষেপণ হয়নি`, text: 'যান কখনো মাটি ছাড়েনি।' };
      case 'hazard': {
        const t = dangerBn(pnl.hazardType!, ctx.title(pnl.hazardType!));
        const label = ctx.label(pnl.hazardType!, pnl.optionId!);
        const how = pnl.bad ? `গোলমাল হলো: ${BN_CHIP[pnl.effect ?? 'safe-mode']}।` : 'কাজ হলো।';
        const who = pnl.by === 'standing-order' ? `রোবট তার আদেশ মানল: ${label}।` : pnl.by === 'fault-protection' ? `সময়মতো আদেশ আসেনি। রোবট বেছে নিল: ${label}।` : `তুমি বেছে নিলে: ${label}।`;
        return { head: `${day} · ${t}`, text: `${who} ${how}` };
      }
      case 'arrival':
        return { head: `${day} · ${placeIn(ctx.dest)} পৌঁছানো`, text: `লম্বা একটা গতি কমানোর বার্ন। ${place(ctx.dest)} তোমাকে ধরে ফেলল।` };
      case 'conjunction':
        return { head: `${day} · সূর্য মাঝখানে`, text: `${days(pnl.blackoutDays ?? 0)} কোনো রেডিও নেই। ${ctx.autopilot ? 'অটোপাইলট একাই উড়িয়েছে।' : 'রোবট অপেক্ষা করে পার করেছে।'}` };
      case 'lost':
        return { head: `${day} · যোগাযোগ বিচ্ছিন্ন`, text: 'রোবট চুপ হয়ে গেল। কেউ আর কখনো তার কথা শোনেনি।' };
      case 'complete':
        return { head: `${day} · মিশন শেষ`, text: `বিজ্ঞানের কাজ শেষ: ${f.gbit(ctx.sent_Gbit)} বাড়ি পাঠানো হয়েছে।` };
    }
  },
  PANEL_SOUND: { 'solar-storm': 'ঝিঝিৎ!', 'cme-shock': 'ধপাস!', 'mars-dust-storm': 'সাঁই সাঁই', debris: 'ঠং!', 'reaction-wheel': 'ঘড়ঘড়', 'memory-corruption': 'বিপ?', 'insertion-anomaly': 'ভুস' },
  STAR_WORDS: () => ['প্রথম বিজ্ঞান বাড়িতে', 'অর্ধেক বিজ্ঞান', 'বেশির ভাগ বিজ্ঞান'],
  CATEGORY_NAME: { science: 'বিজ্ঞান', success: 'সাফল্য', budget: 'বাজেট', deltaV: 'Δv মার্জিন', power: 'বিদ্যুতের মার্জিন', mass: 'ভরের মার্জিন', crisis: 'সংকট সামলানো' },
  savedWords: (v, ctx) => {
    switch (v.code) {
      case 'part':
        return { strong: BN_PART_UPPER(v.part), rest: `। এটা ${dangerBn(v.hazardType, ctx.title(v.hazardType))}-কে অনেক কম বিপজ্জনক করে দিয়েছে।` };
      case 'autopilot':
        return { strong: 'অটোপাইলট চিপ', rest: `। এটা নিজেই ${dangerBn(v.hazardType, ctx.title(v.hazardType))}-এর জবাব দিয়েছে।` };
      case 'choice':
        return { strong: `“${ctx.label(v.hazardType, v.optionId)}” বেছে নেওয়া`, rest: `, যখন ${dangerBn(v.hazardType, ctx.title(v.hazardType))} এল।` };
      case 'quiet':
        return { strong: 'ভালো পরিকল্পনা', rest: '। এবার কিছুই গোলমাল হয়নি।' };
    }
  },
  hurtWords: (v, ctx) => {
    switch (v.code) {
      case 'bad-outcome':
        return { strong: `“${ctx.label(v.hazardType, v.optionId)}”`, rest: `, ${dangerBn(v.hazardType, ctx.title(v.hazardType))}-এর সময়: ${BN_CHIP[v.effect]}।` };
      case 'category':
        return { strong: BN_CATEGORY_WORD[v.category] ?? v.category, rest: ` 100-এর মধ্যে মাত্র ${f.num(v.score)} পেয়েছে।` };
      case 'nothing':
        return { strong: 'বড় কিছু না', rest: '। সব স্কোরই মোটামুটি বা তার চেয়ে ভালো।' };
    }
  },
  REPORT_STAMP: { complete: { word: ['মিশন', 'শেষ'] }, extended: { word: ['মিশন', 'বাড়ল'] }, lost: { word: ['রোবট', 'হারাল'] }, 'not-launched': { word: ['উৎক্ষেপণ', 'হয়নি'] } },
  FINAL_WORDS: {
    kicker: (day) => `টেলিটাইপ 03 · পাওয়া গেছে দিন ${day}`,
    incomplete: 'অসম্পূর্ণ',
    sent: (delay) => `ছাপার ${delay} আগে পাঠানো`,
    title: (name) => `শেষ বার্তা — ${name}`,
    ...BN_FINAL,
    lost: '— সিগন্যাল হারিয়েছে —',
    still: 'এখনো আছি।',
    foot: {
      complete: 'কাগজ নড়ার সময়েই শেষ কথাগুলো {delay} পুরোনো হয়ে গিয়েছিল।',
      lost: 'ডিপ স্পেস নেটওয়ার্ক শুনতেই থাকল। আর কিছু আসেনি।',
      extended: 'আসলে বিদায় নয়: মিশন শেষ, রোবট নয়।',
    },
    feed: 'কাগজ টানো · মিশনের রিপোর্ট ▾',
    label: 'শেষ বার্তা',
  },
  finalLines: (ft, ctx) => {
    const W = BN_FINAL;
    return ft.lines.map((l) => {
      const v = l.values;
      const slots: Record<string, string> = {
        dest: place(ctx.dest),
        destOf: placeOf(ctx.dest),
        name: ctx.name.toUpperCase(),
        hazard: v.hazardType ? dangerBn(v.hazardType, ctx.title(v.hazardType)) : '',
        ...(v.day !== undefined ? { day: f.dayPad(v.day), when: f.num(v.day) } : {}),
        ...(v.scienceDays !== undefined ? { science: f.num(v.scienceDays) } : {}),
        ...(v.dv_ms !== undefined ? { dv: f.speed(v.dv_ms).toUpperCase() } : {}),
        ...(v.days !== undefined ? { days: f.num(v.days) } : {}),
        ...(v.propellantLeft_kg !== undefined ? { fuel: f.kg(v.propellantLeft_kg).toUpperCase() } : {}),
        ...(v.years !== undefined ? { years: years(v.years) } : {}),
      };
      switch (l.kind) {
        case 'opening':
          return fillBn(W.opening[ft.ending], slots);
        case 'hurt':
          return fillBn(W.hurt, { ...slots, effect: v.effect ? W.effect[v.effect] : '' }).trim();
        case 'saved': {
          const sv = v.saved!;
          if (sv.code === 'part') return fillBn(W.saved.part, { ...slots, part: BN_PART_UPPER(sv.part), hazard: dangerBn(sv.hazardType, ctx.title(sv.hazardType)) });
          if (sv.code === 'autopilot') return fillBn(W.saved.autopilot, { ...slots, hazard: dangerBn(sv.hazardType, ctx.title(sv.hazardType)) });
          if (sv.code === 'choice') return fillBn(W.saved.choice, { ...slots, option: ctx.label(sv.hazardType, sv.optionId) });
          return W.quiet;
        }
        case 'arrival':
          return fillBn(W.arrival, slots);
        case 'conjunction':
          return fillBn(W.conjunction, slots);
        case 'quiet':
          return W.quiet;
        case 'fuel':
          return fillBn(W.fuel, slots);
        case 'extension':
          return fillBn(W.extension, slots);
        case 'sign-off':
          return fillBn(W.signOff, slots);
        case 'cause':
          return fillBn(W.cause[v.cause ?? 'unknown'], slots);
        case 'cut-off':
          return W.cutOff;
      }
    });
  },
  CATEGORY_LOOK: { signal: { name: 'সিগন্যাল' }, power: { name: 'বিদ্যুৎ' }, weather: { name: 'মহাকাশ-আবহাওয়া' }, nav: { name: 'পথ চেনা' }, people: { name: 'মানুষ' } },
  LESSON_WORDS: {
    'safe-beats-curious': { title: 'কৌতূহলের চেয়ে নিরাপত্তা আগে', body: 'সৌরঝড় এগিয়ে এলে আসল দলগুলো যন্ত্র বন্ধ করে দেয়। কয়েক দিনের বিজ্ঞান হাতছাড়া হওয়া একটা যন্ত্র চিরতরে হারানোর চেয়ে ভালো।' },
    'air-swells': { title: 'বাতাস ফুলে ওঠে', body: 'গ্রহজোড়া ধুলোঝড় মঙ্গলের বাতাস গরম করে ফুলিয়ে তোলে। নিচু কক্ষপথ হঠাৎ ঘন বাতাসের ভেতর দিয়ে টেনে যায়।' },
    'radiation-adds-up': { title: 'বিকিরণ জমতে থাকে', body: 'ইলেকট্রনিকস সারা জীবনে কেবল নির্দিষ্ট পরিমাণ বিকিরণ সইতে পারে। বড় গ্রহের বলয়ের কাছে প্রতিটি দিন তার কিছুটা খরচ করে।' },
    'sun-gets-in-the-way': { title: 'সূর্য মাঝখানে চলে আসে', body: 'কখনো কখনো সূর্য পৃথিবী আর তোমার রোবটের মাঝখানে বসে। তার গোলমাল রেডিও এলোমেলো করে দেয়, তাই সরে না যাওয়া পর্যন্ত কেউ আদেশ পাঠায় না।' },
    'bits-flip': { title: 'বিট উল্টে যায়', body: 'একটা দ্রুতগামী কণা কম্পিউটারের মেমরির একটা বিট উল্টে দিতে পারে। রোবটের কাছে পরীক্ষা, প্যাচ বা কম্পিউটার বদলানোর উপায় থাকে।' },
    'full-memory': { title: 'মেমরি ভরে যায়', body: 'যে রোবট অনেক বেশি ফাইল জমায়, তার জায়গা ফুরিয়ে সে বিভ্রান্ত হতে পারে। প্রকৌশলীরা লক্ষ লক্ষ কিলোমিটার দূর থেকে একটাকে সারিয়েছিলেন।' },
    'batteries-hate-the-dark': { title: 'ব্যাটারি অন্ধকার পছন্দ করে না', body: 'গ্রহের ছায়ায় সোলার প্যানেল কিছুই বানায় না। তখন ব্যাটারিই রোবটকে চালায়, আর কখনো পুরো খালি না করলে সেগুলো বেশি দিন টেকে।' },
    'wheels-wear-out': { title: 'চাকা ক্ষয়ে যায়', body: 'ঘূর্ণি-চাকা জ্বালানি ছাড়াই রোবটকে তাক করে, কিন্তু সেগুলো ক্ষয়ে যায়। একটা বিকল হলে বাড়তি চাকা আর থ্রাস্টার কাজ চালিয়ে নেয়।' },
    'safe-mode-is-a-friend': { title: 'সেফ মোড বন্ধু', body: 'রোবট বিভ্রান্ত হলে বাড়তি সব বন্ধ করে, সূর্যের দিকে মুখ করে, আর পৃথিবীর সাহায্যের অপেক্ষা করে।' },
    'braking-is-scary': { title: 'গতি কমানো ভয়ের', body: 'পৌঁছানো মানে দ্বিতীয় সুযোগ ছাড়া একটা লম্বা ইঞ্জিন-বার্ন। ভুল হলে কী করবে, দলগুলো আগেই পরিকল্পনা করে রাখে।' },
    'duck-the-dust': { title: 'ধুলো এড়াও', body: 'ধূমকেতুর ধুলো বুলেটের চেয়েও জোরে আঘাত করে। আগে থেকে দেখতে পেলে রোবট গ্রহের আড়ালে লুকাতে পারে, বা প্যানেল কিনারা করে ঘোরাতে পারে।' },
    'borrow-speed': { title: 'গ্রহের কাছ থেকে গতি ধার করো', body: 'কোনো রকেট যথেষ্ট শক্তিশালী না হলে একটা গ্রহের পাশ দিয়ে উড়ে যাও আর তার একটু গতি নিয়ে নাও: একে বলে মহাকর্ষীয় সহায়তা।' },
    'check-your-units': { title: 'একক মিলিয়ে নাও', body: 'দুটো দল, দুই রকম সংখ্যা, একটা হারানো মহাকাশযান। সবসময় জোরে বলে একক মিলিয়ে নাও।' },
    'trust-but-test': { title: 'বিশ্বাস করো, তবে পরীক্ষা করো', body: 'সেন্সর ভুল বলতে পারে: একটা ঝাঁকুনিকেও অবতরণ মনে হতে পারে। হার্ডওয়্যার যা যা টের পেতে পারে, সবকিছুর সঙ্গে সফটওয়্যার পরীক্ষা করো।' },
    'install-it-right': { title: 'ঠিক দিক ওপরে রেখে বসাও', body: 'উল্টো করে বসানো একটা যন্ত্রাংশ প্রতিটি পরীক্ষা পেরিয়েও আসল দিনে ব্যর্থ হতে পারে। শুধু যন্ত্রাংশ নয়, পুরো যান পরীক্ষা করো।' },
  },
  unlockHint: (u, ctx) => {
    switch (u.kind) {
      case 'face-hazard':
        return BN_HAZARD_PHRASE[u.id] ? `${BN_HAZARD_PHRASE[u.id]} মুখোমুখি হও` : `${ctx.hazard(u.id)}-এর মুখোমুখি হও`;
      case 'finish-level':
        return `${ctx.level(u.id)} মিশনে একটা তারা জেতো`;
      case 'solve-rescue':
        return `উদ্ধার-ইতিহাসে ${ctx.rescue(u.id)}-কে বাঁচাও`;
      case 'conjunction':
        return 'একটা সৌর সংযোগ পেরিয়ে উড়ে যাও';
      case 'eclipse':
        return 'একটা গ্রহণের মৌসুম পেরিয়ে উড়ে যাও';
    }
  },
  ALBUM: {
    label: 'মিশনের অ্যালবাম',
    kicker: (name) => `টেলিটাইপ 03 · মিশনের অ্যালবাম — ${name}`,
    meta: { complete: (day) => `দিন 001–${day}`, lost: (day) => `শেষ যোগাযোগ · দিন ${day}`, extended: (day) => `দিন 001–${day} · এখনো চলছে` },
    returned: (n, total) => `${n} / ${total} লক্ষ্য ফিরেছে`,
    lostOn: (name, day) => `${name} হারিয়ে গিয়েছিল দিন ${day}-এ —`,
    madeIt: (n) => `${n} ছবি বাড়ি পৌঁছেছে।`,
    noneMadeIt: 'কোনো ছবি বাড়ি পৌঁছায়নি।',
    ofScience: (pct) => `মিশনের বিজ্ঞানের ${pct}`,
    soFar: (pct) => `এ পর্যন্ত ${pct} · এখনো উড়ছে`,
    subComplete: (name, day) => `${name} · মূল মিশন শেষ · দিন ${day}`,
    subExtended: (name, day) => `${name} · মিশন বাড়ানো হয়েছে · দিন ${day}`,
    bar: 'মিশনের বিজ্ঞান · প্রতিটি লক্ষ্যের একটা ঘর, যা শেখায় সেই মাপে',
    barPct: (pct) => `${pct} ফিরেছে`,
    plus: (pct) => `+${pct} বিজ্ঞান`,
    missed: (pct) => `${pct} হাতছাড়া`,
    partialSci: 'ছবির অংশ · বিজ্ঞান নেই',
    notReturned: 'ফেরেনি',
    signalLost: '— সিগন্যাল হারিয়েছে —',
    partialCap: (pct) => `${pct} পাঠানোর পর সিগন্যাল হারিয়েছে`,
    credit: (credit, mission) => `ছবির সূত্র: ${credit} · ${mission}`,
    why: {
      'never-ordered': () => 'কখনো দেখা হয়নি',
      'order-lost': () => 'আদেশটা কখনো পৌঁছায়নি',
      'refused-fuel': () => 'বাদ · যথেষ্ট জ্বালানি নেই',
      'refused-unreachable': () => 'বাদ · এই কক্ষপথ থেকে দেখা যায় না',
      refused: () => 'বাদ · রোবট না বলেছে',
      'never-taken': () => 'শেষ হওয়ার সময়েও দেখছিল',
      'never-sent': (day) => `দিন ${day}-এ তোলা · কখনো পাঠানো হয়নি`,
      'still-possible': () => 'এখনো সম্ভব · বাড়তি মিশন',
    },
    foot: {
      complete: 'প্রতিটি খালি ফ্রেম এমন এক লক্ষ্য, যা এখনো ওখানে। এই মিশনে নয়।',
      lost: 'যে ছবিগুলো আগেই বাড়ি এসেছে, সেগুলো গোনা হয়। বাকিগুলো তার মেমরিতে রয়ে গেছে, মঙ্গলের ওপরে কোথাও।',
      extended: 'খালি ফ্রেম, আর সেগুলো ভরানোর মতো জ্বালানি বাকি থাকা একটা রোবট।',
      all: 'প্রতিটি লক্ষ্য বাড়িতে। ওখানে দেখার আর কিছু বাকি নেই।',
      none: 'কোনো ছবি বাড়ি পৌঁছায়নি। পরেরবার আগেভাগে লক্ষ্যের আদেশ দাও, আর DSN পাসের অপেক্ষা করো।',
    },
    feed: 'কাগজ টানো · শেষ বার্তা ▾',
  },
  DAILY_SCIENCE: { card: (pct) => `বিজ্ঞান বাড়িতে ${pct}`, share: (pct) => `🔭 বিজ্ঞানের ${pct} বাড়িতে` },
  REPORT_WORDS: {
    title: 'মিশনের রিপোর্ট',
    titleLines: ['মিশনের', 'রিপোর্ট'],
    kicker: (mission, dest, lastDay) => `টেলিটাইপ · ${mission.toUpperCase()} · ${place(dest)} · দিন 000–${lastDay}`,
    kickerPhone: (mission, day) => `${mission.toUpperCase()} · দিন ${day}`,
    stars: (n) => `${n} / 3 তারা`,
    saved: 'কী তোমাকে বাঁচাল',
    hurt: 'কী তোমার ক্ষতি করল',
    youVs: 'তুমি বনাম আসলটা',
    youVsLabel: 'তুমি বনাম আসল মিশন',
    you: 'তুমি',
    launch: 'উৎক্ষেপণ',
    plannedScience: 'পরিকল্পিত বিজ্ঞান',
    metric: { wetMass: 'উৎক্ষেপণের ভর', dryMass: 'শুকনো ভর', propellant: 'জ্বালানি', powerAtArrival: 'পৌঁছানোর সময় বিদ্যুৎ', deltaVCapability: 'Δv সামর্থ্য' },
    noCompare: 'তুলনা করার মতো আসল মিশন এখনো নেই',
    newCard: 'নতুন কার্ড',
    notebookCard: (n, total) => `প্রকৌশলীর নোটবুক · ${n} / ${total}`,
    realLesson: 'আসল শিক্ষা',
    fromFlight: 'এই ফ্লাইট থেকে',
    toVerify: 'যাচাই বাকি',
    lessonTitle: 'শিক্ষাটি',
    notebook: 'নোটবুক',
    openNotebook: 'নোটবুক খোলো',
    next: (title) => `এরপর: ${title.toUpperCase()}`,
    flyAgain: 'আবার ওড়াও',
    lastWords: 'Opportunity-র শেষ বার্তা',
    nextStar: (hint) => `পরের তারা · ${hint}`,
  },
  COMIC_WORDS: { boom: 'ধুড়ুম!', zap: 'ঝিঝিৎ!', whoosh: 'সাঁই সাঁই', beep: 'বিপ বিপ' },
  NOTEBOOK_WORDS: {
    title: 'প্রকৌশলীর নোটবুক',
    titleShort: 'নোটবুক',
    collected: (n, total) => `${n} / ${total} জোগাড় হয়েছে`,
    categories: 'বিভাগ',
    lessons: 'শিক্ষা',
    lesson: 'শিক্ষা',
    lessonOf: (n, title) => `শিক্ষা ${n}: ${title}`,
    lessonLocked: (n, hint) => `শিক্ষা ${n}: তালাবন্ধ। ${hint}`,
    kicker: (n, category) => `শিক্ষা ${n} · ${category}`,
    close: 'শিক্ষা বন্ধ করো',
    history: 'আসল ইতিহাস',
    toVerify: 'যাচাই বাকি',
    source: 'সূত্র',
    earned: (how) => `পেয়েছ · ${how}`,
    missionDay: (day) => `মিশনের দিন ${day}`,
    rescue: (name) => `উদ্ধার-ইতিহাস · ${name.toUpperCase()}`,
    aFlight: 'একটা ফ্লাইট',
    locked: 'তালাবন্ধ',
    toEarn: (hint) => `এই শিক্ষা পেতে: ${hint}।`,
    fresh: 'নতুন',
  },
  DAILY_WORDS: {
    no: (n) => `দৈনিক #${n}`,
    result: (n) => `দৈনিক ${n}-এর ফল`,
    date: (date) => `${date} · মঙ্গল`,
    theme: (danger) => `${danger}-এর দিন`,
    quiet: 'শান্ত যাত্রা',
    stars: (n) => `${n} / 3 তারা`,
    how: 'প্রতিটি বিপদ কেমন গেল',
    none: 'আজ কোনো বিপদের কার্ড নেই। শান্ত ফ্লাইট।',
    result_: { held: 'সামলানো', cost: 'খরচ হলো', hurt: 'ক্ষতি হলো' },
    realOf: (date) => `, আসল ঘটনা ${date}`,
    day: 'দিন ',
    dayShort: 'দি',
    alive: 'রোবট বেঁচে আছে',
    lost: 'রোবট হারিয়েছে',
    endDay: (day) => ` · দিন ${day}`,
    streak: (n) => `টানা ${n} দিন`,
    madeIt: 'তুমি পেরেছ।',
    gone: 'রোবট হারিয়ে গেছে।',
    show: 'তোমার দলকে দেখাও।',
    copies: 'লেখা হিসেবে কপি হয়',
    copied: 'কপি হয়েছে ✓',
    share: 'ফল শেয়ার করো',
    copy: 'ফল কপি করো',
    save: 'ছবি সেভ করো',
    report: 'মিশনের রিপোর্ট',
    next: (t) => `পরের দৈনিক ${t} পরে`,
    shareAlive: (day) => `🤖 বেঁচে আছে · দিন ${day}`,
    shareLost: (day) => `💥 হারিয়েছে · দিন ${day}`,
    shareQuiet: '🟦 শান্ত ফ্লাইট',
  },

  // -------------------------------------------------------------------------
  // Science targets, the Moon scene, the downlink and the globe

  SCIENCE: {
    title: (dest) => `${placeOf(dest)} কক্ষপথ · বিজ্ঞানের লক্ষ্য`,
    titlePhone: (dest) => `${placeOf(dest)} কক্ষপথ · লক্ষ্য বাছো`,
    hint: 'প্রতিটি ছবির দাম জ্বালানি, ব্যাটারি বা ঝুঁকি। সবকিছু দেখা যাবে না।',
    hintSome: (n) => `আদেশ ${n} · প্রতিটি ছবির দাম জ্বালানি, ব্যাটারি বা ঝুঁকি`,
    image: 'ছবি',
    quality: { 3: 'ঝকঝকে', 2: 'ভালো', 1: 'মোটামুটি' },
    risk: { none: 'সাধারণ কক্ষপথ', low: 'টান কম', medium: 'টান মাঝারি', high: 'টান বেশি' },
    dust: 'ধুলোময়',
    state: { ordered: 'আদেশ পথে', observing: 'এখন দেখছে', 'on-board': 'রোবটে আছে', sent: 'পথে', home: 'বাড়িতে ✓', refused: 'ফেরত' },
    observe: 'দেখো',
    orderTakes: (target, time, name) => `${target} · আদেশ ${name}-এর কাছে পৌঁছাতে লাগে ${time}`,
    orderTakesShort: (time) => `${time} পরে পৌঁছাবে`,
    blocked: {
      ordered: ['আগেই আদেশ দেওয়া আছে। অন্য লক্ষ্য বাছো।', 'আগেই আদেশ দেওয়া'],
      fuel: ['যথেষ্ট জ্বালানি নেই। কক্ষপথে থাকতে যা লাগে, রোবট তা রেখে দেয়।', 'জ্বালানি কম'],
      unreachable: ['এই কক্ষপথ থেকে এটা স্পষ্ট দেখা যায় না।', 'এখান থেকে দেখা যায় না'],
      blackout: ['সূর্য মাঝখানে: সরে না যাওয়া পর্যন্ত কোনো আদেশ নয়।', 'সূর্য মাঝখানে'],
      'not-flying': ['রোবট এখন আদেশ নিচ্ছে না।', 'এখন আদেশ নয়'],
    },
    done: 'শেষ · উড়তে থাকো',
    doneShort: 'শেষ',
    skip: 'বিজ্ঞান বাদ দাও',
    skipShort: 'বাদ',
    reopen: 'বিজ্ঞান',
    globeCredit: { mars: 'মঙ্গল · NASA/USGS VIKING MOSAIC', moon: 'চাঁদ · NASA SVS CGI MOON KIT (LROC)' },
    eng: (res, size, dv, d) => `রেজোলিউশন ${res}/PX · ${size} · Δv ${dv} · ${d}`,
    marker: (n, name) => `${n} ${name}`,
    moonRing: (name) => `${name}-এর কক্ষপথ`,
    periapsis: (from, to) => `পেরিঅ্যাপসিস ${from} → ${to}`,
    periapsisNow: (h) => `পেরিঅ্যাপসিস ${h}`,
    apoapsis: (from, to) => `অ্যাপোঅ্যাপসিস ${from} → ${to}`,
    dragEng: (pr, rho) => `P(টানে গরম) ${pr} · ρ/ρ₀ ×${rho}`,
    moonSub: (a) => `${a} ওপরে ঘোরে`,
    orbitChange: 'কক্ষপথ বদল · নেমে আবার ওঠা',
    limbSub: 'ওপরের বায়ুমণ্ডল · পাশ থেকে দেখা',
    notToScale: 'উচ্চতা মাপমতো নয়',
    orbiter: (name) => name,
    orderOut: (target, name, time) => `${target}-এর আদেশ · ${time} পরে ${name}-এর কাছে পৌঁছাবে`,
    orderOutShort: (time) => `${time} পরে আদেশ পৌঁছাবে`,
    scanning: (name, target) => `${name} এখন ${target}-এর ওপরে · স্ক্যান করছে`,
    sheet: 'বিজ্ঞানের লক্ষ্য',
    sheetMore: 'আরও ▴',
    sheetLess: 'কম ▾',
  },
  MOON_WORDS: {
    earth: (dist, oneWay) => `পৃথিবী · ${dist} · ${oneWay}`,
    earthSub: 'সবসময় কাছের পিঠটা দেখে',
    linkUp: (oneWay) => `যোগাযোগ · চালু · ${oneWay}`,
    linkLost: 'যোগাযোগ · বিচ্ছিন্ন · উল্টো পিঠ',
    far: 'সিগন্যাল নেই — চাঁদের আড়ালে',
    farSub: (lost, period) => `প্রতি ${period} মিনিটে ≈${lost}`,
    allInView: 'আজ পৃথিবী পুরো কক্ষপথটা দেখতে পায়',
    shadow: 'চাঁদের ছায়ায়',
    shadowSub: (dark, period) => `প্রতি ${period} মিনিটে ${dark} · ব্যাটারিতে`,
    trim: 'কক্ষপথ ধরে রাখা',
    trimNext: (when, dv) => `ম্যাসকন নিচু কক্ষপথকে নিচে টানে · পরের ট্রিম বার্ন ${when} পরে · ${dv}`,
    legend: 'বলয়টা কী দেখায়',
    notToScale: 'মাপমতো নয় · // পৃথিবীর দূরত্ব ছোট করে দেখানো',
    farTarget: 'উল্টো পিঠ · দেখার সময় সিগন্যাল নেই',
    titleOf: (alt) => `চাঁদের কক্ষপথ · ${alt} ওপরে`,
    hint: 'চাঁদের আড়ালে পৃথিবী তোমাকে দেখতে পায় না। আদেশ যোগাযোগের অপেক্ষায় থাকে।',
    reopen: 'চাঁদের কক্ষপথ',
    done: 'শেষ · উড়তে থাকো',
    doneShort: 'শেষ',
  },
  DOWNLINK: {
    button: 'ডাউনলিংক',
    waitingOn: (n, _one, name) => `${name}-এ ${n} ছবি অপেক্ষায়`,
    allHome: (n) => `${n} ছবিই বাড়িতে`,
    shortWaiting: (n) => `${n} অপেক্ষায়`,
    shortHome: 'সব বাড়িতে',
    open: 'খোলো ◂',
    close: 'বন্ধ ▸',
    kicker: (dish, sent) => `টেলিটাইপ 04 · DSN ${dish} · ${sent}`,
    kickerPhone: (dish) => `টেলিটাইপ 04 · DSN ${dish}`,
    sentBefore: (t) => `ছাপার ${t} আগে পাঠানো`,
    noSignal: 'এখনো সিগন্যাল নেই',
    title: 'ডাউনলিংক',
    closeKey: '✕ বন্ধ',
    big: (n) => `${n} ছবি অপেক্ষায়`,
    bigHome: 'সব ছবি বাড়িতে',
    nextPass: (t) => `পরের DSN পাস ${t} পরে`,
    passOpen: (t) => `DSN পাস খোলা · আর ${t}`,
    noPass: 'আর কোনো DSN পাস নেই',
    row: { ordered: 'আদেশ পাঠানো', observing: 'দেখছে', waiting: 'অপেক্ষায়', 'coming-down': '↓', 'on-its-way': 'পথে', home: 'বাড়িতে ✓' },
    skip: 'পাস পর্যন্ত এগোও',
    skipSub: (t) => `${t} এগিয়ে যাও`,
    receiving: 'আসছে…',
    receivingSub: 'বিট আসার সঙ্গে সঙ্গে, লাইন ধরে ধরে',
    allDone: 'সব বাড়িতে',
    allDoneSub: 'ড্রয়ার বন্ধ করো',
    nothing: 'কোনো আদেশ নেই',
    nothingSub: 'আগে লক্ষ্য বাছো',
    reprint: 'আবার ছাপো',
    reprintSub: 'বাড়ি আসা শেষ ছবিটা',
    imageOf: (i, n, name) => `ছবি ${i} / ${n} — ${name}`,
    waitingDish: 'ডিশের অপেক্ষায়',
    paperLoaded: 'কাগজ তৈরি · এখনো ছাপার কিছু নেই',
    printing: (pct, size) => `আসছে · ${pct} · ${size}`,
    opened: 'পুরো রঙে খোলা হলো',
    voice: (name, line) => `${name}: “${line}”`,
    credit: (credit, mission, id) => `ছবির সূত্র: ${credit} · ${mission} · ${id}`,
  },
  bodyWord: (b) => ({ mars: 'মঙ্গল', moon: 'চাঁদ' })[b],
  GLOBE_WORDS: { toggleLabel: (body) => `${body}-এর গ্লোব 3D আর সমতলের মধ্যে বদলাও`, to2d: '2D', to3d: '3D' },

  // -------------------------------------------------------------------------
  // Fly & Survive

  TILE: {
    power: { name: 'বিদ্যুৎ', help: 'আজ কতটা বাড়তি বিদ্যুৎ আছে' },
    fuel: { name: 'জ্বালানি', help: 'ট্যাংকে কতটা জ্বালানি বাকি' },
    data: { name: 'ডেটা', help: 'লক্ষ্যের তুলনায় কতটা বিজ্ঞান-তথ্য বাড়ি গেছে' },
    systems: { name: 'সিস্টেম', help: 'রোবট কতটা সুস্থ' },
  },
  OPTION_SHORT: {
    'solar-storm.shelter': 'ঢাল তোলো',
    'solar-storm.keep-observing': 'কাজ চালাও',
    'cme-shock.safe-mode': 'সেফ মোড',
    'cme-shock.keep-observing': 'আঘাতটা দেখো',
    'mars-dust-storm.raise-periapsis': 'ওপরে ওঠো',
    'mars-dust-storm.wait-it-out': 'অপেক্ষা করো',
    'mars-dust-storm.carry-on': 'চালিয়ে যাও',
    'debris.hide': 'গ্রহের আড়ালে লুকাও',
    'debris.edge-on': 'কিনারা ঘোরাও',
    'debris.ignore': 'কিছু কোরো না',
    'reaction-wheel.thrusters': 'থ্রাস্টার চালাও',
    'reaction-wheel.hybrid': 'নতুন তাক-পরিকল্পনা',
    'reaction-wheel.carry-on': 'চালিয়ে যাও',
    'memory-corruption.backup-computer': 'বাড়তি কম্পিউটার',
    'memory-corruption.patch': 'প্যাচ পাঠাও',
    'memory-corruption.reboot': 'রিবুট',
    'insertion-anomaly.trim-burn': 'ট্রিম বার্ন',
    'insertion-anomaly.accept-orbit': 'এই কক্ষপথই থাক',
    'insertion-anomaly.hold': 'স্থির থাকো',
    'drag-heating.pop-up': 'এখনই পেরিঅ্যাপসিস তোলো',
    'drag-heating.stay-low': 'নিচে থেকে ছবিটা শেষ করো',
  },
  arrivesWords: (s) => (s < 60 ? 'এখনই' : `${duration(s)} পরে`),
  COMING: {
    eclipse: { label: () => 'গ্রহণের মৌসুম', short: () => 'অন্ধকার' },
    conjunction: { label: () => 'সূর্য রেডিও আটকায়', short: () => 'সূর্য' },
    'course-fix': { label: () => 'পথ সংশোধন', short: () => 'সংশোধন' },
    arrival: { label: (d) => `${placeIn(d)} পৌঁছানো`, short: (d) => place(d) },
    'dust-season': { label: () => 'ধুলোঝড়ের মৌসুম', short: () => 'ধুলো' },
  },
  monthsWords: (m) => `${f.num(m)} মাস`,
  monthsShort: (m) => `${f.num(m)} মাস`,
  quietLine: (phase, dest) => {
    switch (phase) {
      case 'launch':
        return 'উড়ে গেল। রোবট পথে।';
      case 'cruise':
        return `${placeOf(dest)} পথে। সব শান্ত।`;
      case 'arrival':
        return `${placeIn(dest)} পৌঁছাচ্ছি।`;
      case 'science':
        return `${placeOf(dest)} কক্ষপথে। বিজ্ঞানের কাজ চলছে।`;
      case 'return':
        return 'বাড়ির পথে।';
      case 'extended':
        return 'বাড়তি মিশন। এখনো উড়ছে।';
    }
  },
  milestoneLine: (kind, inDays, dest) => {
    if (kind === 'arrival' && inDays !== undefined) return `${place(dest)} আর ${days(inDays)}`;
    if (kind === 'prime-end' && inDays !== undefined) return `বিজ্ঞানের কাজ শেষ ${days(inDays)} পরে`;
    if (kind === 'extension-end' && inDays !== undefined) return `বাড়তি মিশন শেষ ${days(inDays)} পরে`;
    return placeIn(dest);
  },
  resultLines: (o, shortLabel) => {
    const lines: string[] = [];
    if (o.by === 'standing-order') lines.push(`সময়মতো কোনো আদেশ আসেনি। রোবট তার স্থায়ী আদেশ মেনেছে: ${shortLabel}।`);
    else if (o.by === 'fault-protection') lines.push(`সময়মতো কোনো আদেশ আসেনি। রোবট বেছে নিয়েছে: ${shortLabel}।`);
    else lines.push(`আদেশ পালন হয়েছে: ${shortLabel}।`);
    const t = hazardBn(o.type, o.title.toUpperCase());
    lines.push(o.bad ? `${t} জোরালো আঘাত হেনেছে।` : `${t} পেরিয়ে গেছে।`);
    lines.push(o.bad ? BN_EFFECT_LINE[o.failureEffect]! : 'সব সিস্টেম নিরাপদ।');
    if (o.scienceDaysLost > 0) lines.push(`বিজ্ঞানের ${days(o.scienceDaysLost)} হাতছাড়া হলো।`);
    if (o.deltaV_ms > 0) lines.push(`ইঞ্জিন চলল: ${f.speed(o.deltaV_ms).toUpperCase()}।`);
    return lines;
  },
  RESULT_EFFECT_CHIP: { craft: 'রোবট হারিয়েছে', instrument: 'যন্ত্র হারিয়েছে', 'stored-data': 'ছবি মুছে গেছে', 'safe-mode': 'সেফ মোড' },
  FLY_WORDS: {
    goal: 'লক্ষ্য: মিশন শেষ না হওয়া পর্যন্ত রোবটকে বাঁচিয়ে রাখো',
    duration,
    years,
    day: (n) => `দিন ${n}`,
    dayLabel: (n) => `দিন ${n}`,
    dayK: 'দিন',
    inDays: (n) => `${days(n)} পরে`,
    hazard: (type, title) => hazardBn(type, title.toUpperCase()),
    prompt: (type, prompt) => BN_PROMPT[type] ?? prompt,
    dangerCard: 'বিপদের কার্ড',
    arrives: 'বিপদ আসবে',
    arrivesHow: (severity) => `বিপদ আসবে · ${severity}`,
    takes: 'তোমার আদেশ পৌঁছাতে লাগে',
    takesShort: 'আদেশ পৌঁছাতে',
    history: 'আসল ইতিহাস',
    toVerify: 'যাচাই বাকি',
    risk: (n) => `⚠ ঝুঁকি +${n}`,
    ifFails: (effect) => `ব্যর্থ হলে ${effect}`,
    sunUntil: (day) => `সূর্য মাঝখানে: দিন ${day}-এর আগে কোনো আদেশ নয়`,
    sunNow: 'সূর্য মাঝখানে: এখন কোনো আদেশ নয়',
    standingOrder: 'স্থায়ী আদেশ',
    robotDefault: 'রোবটের নিজের পছন্দ',
    letRobot: 'রোবটকেই ঠিক করতে দাও',
    letRobotRuns: 'রোবটকেই ঠিক করতে দাও · সময় চলবে',
    swipe: ['◂ বাঁয়ে সোয়াইপ / ← কী', '→ কী / ডানে সোয়াইপ ▸', '▾ ↓ কী'],
    swipePhone: ['◂ বাঁয়ে সোয়াইপ', 'ডানে সোয়াইপ ▸', 'ছোঁও'],
    planAhead: 'আগাম পরিকল্পনা',
    eclipse: 'গ্রহণের মৌসুম',
    eclipseLine: (dest, dark) => `প্রতি কক্ষপথে ${dark} পর্যন্ত ${place(dest)} সূর্যকে আড়াল করবে। সূর্য নেই, বিদ্যুৎও নেই।`,
    darkStarts: 'অন্ধকার মৌসুম শুরু',
    theRule: 'নিয়মটা',
    dodRule: (pct) => `অন্ধকারে ব্যাটারি কেবল ${pct} পর্যন্ত খরচ হয়, তাই হাজার হাজার কক্ষপথ টিকে থাকে।`,
    inTheDark: (on, total) => `অন্ধকারে ${on}/${total}`,
    cold: 'ঠান্ডা',
    coldTitle: 'ঠান্ডা যন্ত্রাংশ তাড়াতাড়ি ক্ষয়ে যায়',
    useBattery: 'ব্যাটারি খরচ করো',
    savePower: 'বিদ্যুৎ বাঁচাও',
    keepWarm: 'সবকিছু গরম রাখো।',
    shiver: 'হিটার কমিয়ে দাও। একটু কাঁপো।',
    dangerAhead: (title) => `সামনে বিপদ: ${title}।`,
    planAheadLine: (title) => `আগাম পরিকল্পনা: ${title}।`,
    orderSent: (label) => `আদেশ পাঠানো হলো: ${label}।`,
    orderReceived: 'রোবট আদেশ পেয়েছে।',
    signalReceived: 'সিগন্যাল পৌঁছেছে।',
    orderArrived: (label) => `আদেশ পৌঁছেছে: ${label}।`,
    waitingToSee: 'কী হয়, দেখার অপেক্ষা।',
    onItsWay: (label) => `আদেশ “${label}” পথে`,
    teamWriting: 'দল আদেশটা লিখছে',
    reaches: 'রোবটের কাছে সিগন্যাল পৌঁছাবে',
    reachesShort: 'রোবটের কাছে আদেশ পৌঁছাবে',
    thenCrosses: 'তারপর সেটা আলোর গতিতে মহাকাশ পাড়ি দেবে',
    justWait: 'এখন অপেক্ষা ছাড়া কিছু করার নেই',
    carriedOut: (label) => `আদেশ “${label}” পালন হয়েছে`,
    strikesIn: (title) => `${title} আঘাত হানবে`,
    danger: 'বিপদ',
    holdOn: 'রোবট প্রস্তুত। শক্ত হয়ে থাকো।',
    incoming: 'আসা বার্তা',
    incomingFrom: (mission) => `আসছে · ${mission.toUpperCase()} থেকে`,
    continue: 'চালিয়ে যাও ▸',
    resources: 'রোবটের রসদ',
    tile: (name, on, total) => `${name}: ${on} / ${total}`,
    speeds: 'সময়ের গতি',
    pause: 'থামাও',
    speed: (x) => `${x} গতি`,
    powerPlan: 'বিদ্যুৎ-পরিকল্পনা',
    callHome: 'বাড়িতে কল',
    orders: 'আদেশ',
    ordersLabel: 'আদেশের সারি',
    equations: 'সমীকরণ',
    nextEvent: 'পরের ঘটনা ▸',
    nextEventLabel: 'পরের ঘটনা',
    progress: 'মিশনের অগ্রগতি',
    over: 'মিশন শেষ',
    lost: 'যোগাযোগ বিচ্ছিন্ন',
    notLaunched: 'উৎক্ষেপণ হয়নি',
    complete: 'মূল মিশন শেষ',
    silent: 'রোবট চুপ হয়ে গেছে।',
    printing: 'টেলিটাইপ তোমার রিপোর্ট ছাপছে।',
    seeReport: 'মিশনের রিপোর্ট দেখো ▸',
    map: 'মিশনের মানচিত্র',
    yourPath: 'তোমার পথ',
    realPath: 'আসল NASA পথ',
    ghost: (label) => `${label}: আসল পথ, তোমার পাশ থেকে শুরু করে ঘোরানো`,
    now: 'এখন',
    tickEng: (day) => `দিন ${day}`,
    whenEng: (day, t) => `দিন ${day} · T−${t} d`,
    comingUp: 'সামনে আসছে',
    comingUpSub: 'সামনে আসছে · এগুলো আগেই দেখা যায়',
    nextMonths: (n) => `পরের ${n} মাস`,
  },
  endsInWords: (daysLeft) => (daysLeft <= 0 ? 'মিশন শেষ' : `মিশন শেষ হবে ${days(daysLeft)} পরে`),
  playNudge: (speedLabel) => `▶ সময় চালাতে ${speedLabel} চাপো`,
  MAP_WORDS: {
    earth: 'পৃথিবী',
    planet: (name) => place(name),
    sun: 'সূর্য',
    storm: 'সৌরঝড়',
    order: 'তোমার আদেশ',
    reply: 'তার উত্তর',
    you: 'তুমি',
  },
  stormLine: (phase, name, hitsIn) =>
    phase === 'coming' ? `সূর্যে বিস্ফোরণ। ${hitsIn} পরে সৌরঝড় ${name}-কে আঘাত করবে।` : `${name}-এর ওপর সৌরঝড়। চারদিকে কণা।`,
  VOICE: BN_VOICE,
  TARGET_WORDS: Object.fromEntries(Object.keys(BN_TARGET_NAME).map((id) => [id, { name: BN_TARGET_NAME[id]!, comment: BN_TARGET_COMMENT[id]! }])),
  VOICE_ALT: BN_VOICE_ALT,
  STATUS_VOICE: BN_STATUS_VOICE,
  robotSays: (m, ctx) => {
    const v = m.values;
    const pick = (lines: readonly string[]) => lines[m.seq % lines.length]!;
    const type = v.hazardType ?? '';
    const slots: Record<string, string> = {
      dest: place(ctx.dest),
      destIn: placeIn(ctx.dest),
      destOf: placeOf(ctx.dest),
      name: ctx.name.toUpperCase(),
      option: v.optionId ? (ctx.option ? ctx.option(type, v.optionId) : v.optionId.toUpperCase()) : '',
      hazard: type ? hazardBn(type, (ctx.hazard ? ctx.hazard(type) : type).toUpperCase()) : '',
      ...(v.daysToArrival !== undefined ? { days: f.num(v.daysToArrival) } : {}),
      ...(v.earthDistance_m !== undefined ? { dist: f.millionKm(v.earthDistance_m).toUpperCase() } : {}),
      ...(v.propellantLeft_kg !== undefined ? { fuel: f.kg(v.propellantLeft_kg).toUpperCase() } : {}),
      ...(v.downlinked_bits !== undefined ? { data: f.bits(v.downlinked_bits).toUpperCase() } : {}),
      ...(v.dv_ms !== undefined ? { dv: f.speed(v.dv_ms).toUpperCase() } : {}),
      ...(v.propellant_kg !== undefined ? { burned: f.kg(v.propellant_kg).toUpperCase() } : {}),
      ...(v.longestEclipse_s !== undefined ? { dark: f.minutes(v.longestEclipse_s).toUpperCase() } : {}),
      ...(v.lost_s !== undefined ? { lost: f.minutes(v.lost_s).toUpperCase() } : {}),
      ...(v.period_s !== undefined ? { period: f.minutes(v.period_s).toUpperCase() } : {}),
      ...(v.waited_s !== undefined ? { waited: f.minutes(v.waited_s).toUpperCase() } : {}),
      ...(v.fraction !== undefined ? { pct: f.pct(v.fraction, 0) } : {}),
      ...(v.years !== undefined ? { years: years(v.years) } : {}),
      ...(v.targetId !== undefined ? { target: BN_TARGET_NAME[v.targetId] ?? v.targetId.toUpperCase(), comment: BN_TARGET_COMMENT[v.targetId] ?? '' } : {}),
      ...(v.days !== undefined ? { days: days(v.days) } : {}),
    };
    const A = BN_VOICE_ALT;
    let t: string;
    if (m.kind === 'hit') t = pick(BN_HIT_VOICE[type] ?? [A.hitUnknown]);
    else if (m.kind === 'status') t = pick(BN_STATUS_VOICE[v.phase === 'cruise' || v.phase === 'launch' ? 'cruise' : v.phase === 'return' ? 'home' : 'orbit']);
    else if (m.kind === 'arrived' && v.dv_ms !== undefined) t = A.arrivedBurn;
    else if (m.kind === 'order-received' && v.commandKind === 'power-plan') t = A.plan;
    else if (m.kind === 'order-received' && v.commandKind === 'standing-orders') t = A.standing;
    else if (m.kind === 'acted-alone' && v.by === 'standing-order') t = A.standingChoice;
    else if (m.kind === 'science-milestone' && (v.fraction ?? 0) >= 1) t = A.goalMet;
    else if (m.kind === 'observing' && (v.days ?? 1) > 1) t = A.observeDip;
    else if (m.kind === 'observing' && v.farSide) t = A.observeFarSide;
    else if (m.kind === 'observe-refused' && v.reason === 'fuel') t = A.refusedFuel;
    else if (m.kind === 'observe-refused' && v.reason === 'unreachable') t = A.refusedUnreachable;
    else if (m.kind === 'observe-refused' && v.reason === 'already-ordered') t = A.refusedAlready;
    else if (m.kind === 'observe-refused' && v.reason === 'not-in-orbit') t = A.refusedNotInOrbit;
    else t = pick(BN_VOICE[m.kind as keyof typeof BN_VOICE]);
    return fillBn(t, slots);
  },
  TX_WORDS: {
    kicker: (name) => `টেলিটাইপ 02 · ${name} ⇄ পৃথিবী`,
    title: 'ট্রান্সমিশন',
    keyRobot: (name) => `কালো · ${name}`,
    keyYou: 'লাল · তুমি',
    fromEarth: (name) => `পৃথিবী ▸ ${name}`,
    day: (day) => `দিন ${day}`,
    took: (delay) => `লেগেছে ${delay}`,
    noDelay: 'দেরি নেই · প্যাডে',
    reply: 'উত্তর',
    queued: (t) => `দল লিখছে · ${t} পরে রওনা`,
    inFlight: (t) => `পথে · ${t}`,
    replyInbound: 'পৌঁছেছে · উত্তর আসছে',
    delivered: 'পৌঁছেছে',
    tooLate: 'দেরি হয়ে গেছে',
    order: (what) => `আদেশ: ${what}।`,
    plan: 'নতুন বিদ্যুৎ-পরিকল্পনা',
    standing: 'নতুন স্থায়ী আদেশ',
    observe: (target) => `${target} দেখো`,
    extend: (y) => `আরও ${y} উড়তে থাকো`,
    footBefore: (name) => `${name} যা বলে, তা এখানে ছাপা হতে হতে `,
    footAge: (age) => `${age} পুরোনো`,
    footAfter: ' হয়ে যায়।',
    empty: 'এখনো কিছু নেই। রোবট এখনো প্যাডে।',
    log: '▾ লগ',
    close: '▴ বন্ধ',
    logLabel: 'ট্রান্সমিশনের লগ',
    replyFrom: (name, delay) => `${name}-এর উত্তর · লেগেছে ${delay}`,
    roundTrip: (t) => `তোমার আদেশ গিয়ে আবার ফিরে এল: ${t}`,
    roundTripEng: (t, name) => `আসা-যাওয়া 2t = ${t} · পৃথিবী → ${name} → পৃথিবী`,
    heard: (name) => `${name} তোমার কথা শুনেছে। উত্তর আসছে`,
    replyReaches: 'উত্তর পৃথিবীতে পৌঁছাবে',
    alreadyActed: 'সে আগেই কাজ করে ফেলেছে। তুমি শুধু এখনো দেখতে পাচ্ছ না',
  },
  LIVE_WEATHER: {
    live: 'আসল সূর্য · NASA DONKI',
    prediction: 'NASA WSA-ENLIL মডেলের পূর্বাভাস',
    severity: { direct: 'সরাসরি আঘাত', glancing: 'পাশ ঘেঁষা ধাক্কা', minor: 'হালকা আঘাত' },
    fromFlare: (cls) => `একটা ${cls} শিখা থেকে।`,
    offline: 'অফলাইন — বানানো আবহাওয়া',
    homeLive: 'আজ সবার জন্য একই মিশন, এই সপ্তাহের আসল সৌরঝড়সহ।',
    homeOffline: 'আজ সবার জন্য একই মিশন। অফলাইন — বানানো আবহাওয়া।',
    briefLive: 'এই ফ্লাইটের সৌরঝড়গুলো এই সপ্তাহে সত্যিই সূর্যে ঘটেছে। NASA-র DONKI ডেটাবেস সেগুলো লিখে রেখেছে; রেকর্ড দেখতে ঝড়ের কার্ডে ⓘ ছোঁও।',
    briefOffline: 'অফলাইন — বানানো আবহাওয়া। আসল মহাকাশ-আবহাওয়ার ফাইল পড়া যায়নি, তাই আজকের ঝড়গুলো বানানো।',
    realKicker: 'বিপদের কার্ড · আসল সূর্য',
    event: (st) =>
      `${
        st.kind === 'sep'
          ? `সৌরকণার ঝড়, ${donkiTime(st.time)}${st.instruments?.length ? `; দেখেছে ${st.instruments.join(', ')}` : ''}`
          : `করোনাল ভর নিক্ষেপ (CME)${st.speed_kms !== undefined ? `, গতি ${f.num(st.speed_kms)} km/s` : ''}, ${donkiTime(st.time)}`
      }${st.flare ? `; এসেছে একটা ${st.flare} সৌর-শিখা থেকে` : ''}`,
    realEvent: 'আসল ঘটনা · NASA DONKI',
    realOn: 'আসল',
    shareLive: '☀️ আসল সূর্য · NASA DONKI',
    shareOffline: '☁️ অফলাইন · বানানো আবহাওয়া',
  },

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
    left: (n) => `আর ${n} ঘর খালি`,
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
  dayCount: (n) => `${f.num(n)} দিন`,
  fullDate: (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(BN_DATES, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }),
  crtDate: (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(BN_DATES, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }),
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
  LEVEL_WORDS: {
    teaches: BN_TEACHES,
    blurb: {
      'moon-1': 'এমন সৌর ডানা বাছো, যাতে যানে সবসময় চার্জ থাকে।',
      'moon-2': 'জ্বালানির প্রতিটি কিলোগ্রামও তো ওপরে তুলতে হয়।',
      'moon-3': 'পুরো যানটা নিজে বানাও।',
      mars: 'সরাসরি চালানোর জন্য অনেক দূর: যানকে আদেশ দাও।',
      venus: 'বড় রাডার, ছোট মানিব্যাগ। টাকার বয়ামে চোখ রাখো।',
      bennu: 'একটা গ্রহাণুর সঙ্গে দেখা করো, আর নমুনা নিয়ে ঘরে ফেরো।',
      jupiter: 'কোনো রকেট কি পৃথিবী থেকে সোজা বৃহস্পতিতে পৌঁছাতে পারে?',
    },
    sub: (id) => `যা শিখবে: ${BN_TEACHES[id] ?? id}`,
  },
  LEVEL_MAP_WORDS: {
    kicker: 'মিশনের মানচিত্র',
    title: 'এবার কোথায় উড়বে?',
    helper: 'প্রতিটি মিশন একটা নতুন ধারণা শেখায়। পরেরটা খুলতে একটা তারা জেতো।',
    total: 'জেতা তারা',
    dest: (name) => place(name),
    node: (title, dest, teaches, open) => `${title}: ${dest}, যা শিখবে: ${teaches}${open ? '' : ' (বন্ধ)'}`,
    learn: (teaches) => `যা শিখবে: ${teaches}`,
    stars: (n, max) => `${n} / ${max} তারা`,
    rescue: 'উদ্ধার-ইতিহাস',
    rescueSub: 'হারিয়ে যাওয়া এক আসল মিশনের বাগ খুঁজে বের করো, উৎক্ষেপণের আগেই।',
  },
  BRIEF_WORDS: {
    label: 'মিশনের ব্রিফিং',
    daily: 'আজকের মিশন',
    free: 'নিজের মতো বানাও',
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
    backLabel: 'ফিরে যাও',
    home: 'হোম',
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
    date: (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(BN_DATES, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
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

  RESCUE_WORDS: {
    kicker: '🛟 উদ্ধার-ইতিহাস',
    kickerYear: (year) => `🛟 উদ্ধার-ইতিহাস · ${year}`,
    title: 'হারিয়ে যাওয়া একটা মিশন বাঁচাও',
    helper: 'ছোট ছোট ভুলে আসল মহাকাশযান হারিয়ে গেছে। ফাইলটা পড়ো, বাগটা খুঁজে বের করো, আর উৎক্ষেপণের আগেই ঠিক করো।',
    lostAtMars: 'মঙ্গলে পৌঁছানোর সময় হারিয়ে যায়',
    stars: (n) => `${n} তারা`,
    coming: ['ক্যাপসুল, 2004', 'ল্যান্ডার, 1999'],
    comingSoon: 'শিগগিরই আসছে',
    back: '◂ ফিরে যাও',
    caseHelper: 'মঙ্গলে পৌঁছানোর সময় এটি হারিয়ে যায়। উৎক্ষেপণের আগেই বাগটা খুঁজে বের করো।',
    whatHappened: 'কী ঘটেছিল',
    file: 'মিশনের ফাইল',
    fact: {
      launch: 'উৎক্ষেপণ',
      rocket: 'রকেট',
      launchMass: 'উৎক্ষেপণের ভর',
      fuel: 'জ্বালানি',
      power: 'মঙ্গলে শক্তি',
      engine: 'প্রধান ইঞ্জিন',
      arrival: 'পৌঁছানো',
      delay: 'মঙ্গলে সংকেতের দেরি',
      lowest: 'পরিকল্পিত সবচেয়ে নিচু বিন্দু',
    },
    clues: 'সূত্র',
    which: 'কোনটা বাগ?',
    fromReport: 'ব্যর্থতার রিপোর্ট থেকে',
    accuse: 'এটাই বাগ!',
    saved: '🎉 বাগ পাওয়া গেছে। মিশন বাঁচল!',
    starsOf: (n, max) => `${n} / ${max} তারা`,
    factor: { before: 'প্রতিটি ধাক্কা ছিল নেভিগেটরদের ধারণার চেয়ে ', mid: ' বড় ', drift: '। পুরো যাত্রায় যানটি পরিকল্পনার চেয়ে ', after: ' নিচে নেমে এসেছিল।' },
    factorTitle: 'পাউন্ড-ফোর্স থেকে নিউটন',
    chart: (plan, safe, actual) => `পরিকল্পনা ${plan}, টিকে থাকার সীমা ${safe}, আসলে ${actual}`,
    plan: (km) => `পরিকল্পনা · ${km}`,
    safe: (km) => `নিরাপদ সীমা · ${km}`,
    happened: (km) => `যা ঘটল · ${km}`,
    note: { plan: 'সবচেয়ে নিচু বিন্দু: পরিকল্পনা', safe: ' · নিরাপদ সীমা', estimate: ' · হারানোর পরের হিসাব' },
    noteTitle: { plan: 'পরিকল্পিত সবচেয়ে নিচু বিন্দু', safe: 'সবচেয়ে নিচু নিরাপদ বিন্দু', estimate: 'হিসাব করা সবচেয়ে নিচু বিন্দু' },
    backToList: 'উদ্ধার-ইতিহাসে ফিরে যাও',
  },
  SOURCE_WORDS: {
    label: (title) => (title ? `উৎস: ${title}` : 'উৎস'),
    kicker: 'উৎস',
    close: 'বন্ধ করো',
    original: 'মূল লেখা (ইংরেজি)',
    estimate: 'গেমের অনুমান · NASA-র তথ্য নয়',
    computed: 'ইঞ্জিনের হিসাব',
    published: 'প্রকাশিত উৎস',
    unit: (u) => `একক: ${u}`,
    open: 'উৎস খোলো ↗',
  },
  POSTCARD_WORDS: {
    menu: 'পোস্টকার্ড',
    menuSub: 'তোমার রোবটদের বাড়ি পাঠানো আসল NASA ছবি।',
    view: (title) => `পোস্টকার্ড: ${title}`,
    tile: (title, dest) => `${title} (${place(dest)})`,
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
    stars: (n, max) => `${f.num(n)} / ${f.num(max)} তারা`,
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


/** opsWords in Bangla: the console drawers, the gauges and the event feed. */
export const BN_OPS: BanglaOps = {
  DRAWER_WORDS: {
    queue: {
      title: 'আদেশের সারি',
      counts: (flying, recent) => `পথে ${flying} · সাম্প্রতিক ${recent}`,
      close: 'আদেশের সারি বন্ধ করো',
      sunNow: (day) => `সৌর সংযোগ: দিন ${day}-এর আগে কোনো আদেশ নয়।`,
      sunSoon: (inDays, day) => `${days(inDays)} পরে সৌর সংযোগ: দিন ${day}-এর আগেই আদেশ পাঠিয়ে দাও।`,
      sunThen: (length) => `তারপর ${days(length)} সূর্য রেডিও আটকে রাখবে। যা পাঠিয়েছ, তা দিয়েই যান চলবে।`,
      empty: 'এখনো কিছু পাঠানো হয়নি। আদেশ পাঠাতে বিদ্যুৎ-পরিকল্পনা বদলাও, বা কোনো বিপদের জবাব দাও।',
      onItsWay: 'পথে',
      sentDay: (day) => `পাঠানো দিন ${day}`,
      arrivesIn: 'যানে পৌঁছাবে',
      carriedOut: 'পালন হয়েছে',
      tooLate: 'দেরি হয়ে গেছে',
      day: (day) => `দিন ${day}`,
      plan: '+ বিদ্যুৎ-পরিকল্পনা',
      call: 'বাড়িতে কল বুক করো',
    },
    blackout: {
      label: 'রেডিও বন্ধ',
      kicker: (day, total) => `রেডিও বন্ধ · দিন ${day} / ${total}`,
      title: (total) => `পৃথিবী আর যানের মাঝে সূর্য: ${days(total)} কোনো যোগাযোগ নেই`,
      before: 'তোমার পাঠানো পরিকল্পনা মেনেই যান উড়ছে। যোগাযোগ ফিরবে ',
      day: (day) => `দিন ${day}-এ`,
      after: (left) => `, ${days(left)} পরে।`,
      skip: (day) => `দিন ${day}-এ এগিয়ে যাও`,
    },
    safe: {
      label: 'সেফ মোড',
      chip: 'সেফ মোড',
      title: 'তোমার যান নিজেকে বাঁচিয়েছে।',
      body: 'যন্ত্র বন্ধ করে সে সূর্যের দিকে মুখ করে আছে, ধীর বিকন দিয়ে বাড়িতে ডাকছে। বিজ্ঞানের কাজ নিজে থেকেই আবার শুরু হবে।',
      off: (name) => `${name} বন্ধ`,
      beacon: 'বিকন চালু',
      resumes: 'বিজ্ঞানের কাজ আবার শুরু ',
      day: (day) => `দিন ${day}-এ`,
    },
    ext: {
      label: 'মিশন বাড়ানো',
      kicker: 'মিশনের সিদ্ধান্ত',
      title: 'তোমার মূল মিশন শেষ। এখন কী?',
      sub: (n, dest) => `${placeIn(dest)} ${days(n)} বিজ্ঞানের কাজ। তোমার যান এখনো কাজ করছে।`,
      retire: 'সম্মানের সঙ্গে অবসর',
      extendBy: (y) => `আরও ${years(y)} বাড়াও`,
      recommended: 'পরামর্শ · তোমার রিপোর্টে যাও',
      retireBody: 'যা শিখেছ, সব জমা করো। তোমার স্কোর পাকা, আর কিছু গোলমাল হতে পারবে না।',
      extendBody: 'আরও বিজ্ঞানের জন্য উড়তে থাকো। নতুন টাকা খরচ মেটাবে, কিন্তু যন্ত্রাংশ বুড়ো হচ্ছে আর জ্বালানি সীমিত।',
      extendCadet: ' রিপোর্টের আগে আরও উড়তে হবে।',
      moreScience: 'আরও বিজ্ঞান',
      fuel: 'ট্রিমের জ্বালানি',
      of: (a, b) => `${a} / ${b}`,
      powerEnd: 'শেষে বিদ্যুৎ',
      newMoney: 'নতুন টাকা',
      retireKey: 'যানকে অবসর দাও',
      extendKey: 'মিশন বাড়াও',
    },
    notice: {
      sent: 'আদেশ পাঠানো হলো। আদেশের সারিতে দেখো, কীভাবে সেটা মহাকাশ পাড়ি দেয়।',
      booked: (day, big) => `দিন ${day}-এ ${big ? 'বড়' : 'ছোট'} ডিশে বাড়িতে কল বুক হয়েছে।`,
      conjunction: (day) => `সৌর সংযোগের সময় যোগাযোগ নেই। দিন ${day}-এ আবার চেষ্টা করো।`,
      leadTime: (day) => `খুব তাড়াতাড়ি: ডিশগুলো এক সপ্তাহ আগে বুক হয়। প্রথম খালি দিন: দিন ${day}।`,
      notFlying: 'যান এখন উড়ছে না।',
      refused: 'এটা ফেরত এসেছে।',
      dismiss: 'সরাও',
    },
    power: {
      title: 'বিদ্যুৎ-পরিকল্পনা',
      share: 'আজকের ভাগ',
      close: 'বিদ্যুৎ-পরিকল্পনা বন্ধ করো',
      split: 'বিদ্যুতের ভাগ: সাদা হাতলগুলো টানো',
      science: 'বিজ্ঞান',
      scienceShare: 'বিজ্ঞানের ভাগ',
      photosDay: (n) => `দিনে প্রায় ${n} ছবি`,
      heaters: 'হিটার',
      heaterShare: 'হিটারের ভাগ',
      chilly: 'জ্বালানির লাইন ঠান্ডা হয়ে আসছে',
      warm: 'জ্বালানি আর যন্ত্রাংশ গরম রাখে',
      radio: 'রেডিও',
      sends: 'ছবি বাড়ি পাঠায়',
      radioOff: 'বন্ধ: কিছুই বাড়ি যায় না',
      lowest: 'ব্যাটারির সবচেয়ে নিচের অবস্থা',
      reset: 'আগের মতো',
      noContact: 'যোগাযোগ নেই',
      send: 'পাঠাও',
      over: 'বেশি হয়ে গেছে! আজ যানকে কিছু জিনিস বন্ধ করতে হবে।',
      flat: (dest) => `বেশি হয়ে গেছে! ${placeOf(dest)} ছায়ায় ব্যাটারি একেবারে ফুরিয়ে যাবে।`,
      low: 'বিজ্ঞান বেশি, কিন্তু গ্রহণে ব্যাটারি কমে আসে।',
      cold: 'হিটার কম: জ্বালানির লাইন খুব ঠান্ডা হয়ে যেতে পারে, আর ঠান্ডা যন্ত্রাংশ বেশি বিকল হয়।',
      radioIsOff: 'রেডিও বন্ধ: আবার চালু না করা পর্যন্ত কোনো ছবি বাড়ি যাবে না।',
      healthy: 'ভারসাম্যপূর্ণ পরিকল্পনা। প্রতিটি গ্রহণে ব্যাটারি সুস্থ থাকে।',
      balanced: 'ভারসাম্যপূর্ণ পরিকল্পনা।',
    },
    call: {
      title: 'বাড়িতে কল বুক করো',
      pass: (day, hours) => `দিন ${day} · ${hours} H পাস`,
      close: 'বুকিং বন্ধ করো',
      earlier: 'আগের দিন',
      later: 'পরের দিন',
      day: (day) => `দিন ${day}`,
      firstFree: (day) => `প্রথম খালি দিন: ${day}`,
      dish: 'ডিশ',
      big: 'বড় ডিশ',
      small: 'ছোট ডিশ',
      included: 'ধরা আছে',
      free: 'বিনা খরচে',
      coins: (n) => `${n} কয়েন`,
      photosHome: (n) => `প্রায় ${n} ছবি বাড়ি যাবে`,
      booked: 'বুক করা',
      tooSoon: (day) => `খুব তাড়াতাড়ি: দিন ${day} থেকে বুক করো।`,
      conjunction: (day) => `সেদিন রেডিও নেই (সৌর সংযোগ)। দিন ${day}-এ চেষ্টা করো।`,
      afterEnd: 'সেদিন মিশন শেষ হয়ে যাবে।',
      already: 'আগেই বুক করা',
      book: (big) => `${big ? 'বড়' : 'ছোট'} ডিশ বুক করো`,
    },
  },
  OPS_PHASE: { launch: 'উৎক্ষেপণ', cruise: 'যাত্রাপথ', arrival: 'পৌঁছানো', science: 'বিজ্ঞান-কক্ষপথ', return: 'বাড়ির পথ', extended: 'বাড়তি মিশন' },
  CHIP: {
    nominal: { label: 'সব সিস্টেম ঠিক' },
    hazard: { label: 'বিপদ · সিদ্ধান্ত' },
    'safe-mode': { label: 'সেফ মোড' },
    'conjunction-soon': { label: 'সামনে সৌর সংযোগ' },
    blackout: { label: 'যোগাযোগ নেই' },
    decision: { label: 'সিদ্ধান্ত' },
    lost: { label: 'যান হারিয়েছে' },
    complete: { label: 'মিশন শেষ' },
    'not-launched': { label: 'উৎক্ষেপণ হয়নি' },
  },
  STATUS_LABEL: { ok: 'ঠিক আছে', warning: 'সতর্কতা', over: 'সীমা ছাড়িয়েছে' },
  GAUGE_NAME: {
    power: { cadet: 'ব্যাটারি', engineer: 'আজকের বিদ্যুৎ' },
    fuel: { cadet: 'জ্বালানি ট্যাংক', engineer: 'বাকি Δv' },
    recorder: { cadet: 'অপেক্ষমাণ ছবি', engineer: 'রেকর্ডার' },
    budget: { cadet: 'অপারেশনের বাজেট', engineer: 'বাজেটের মজুত' },
  },
  gaugeLine: (k, g, destName) => {
    switch (k) {
      case 'power': {
        const p = g.power;
        if (p.status === 'over') return 'আজ যথেষ্ট বিদ্যুৎ নেই: যান কিছু জিনিস বন্ধ করছে।';
        if (p.status === 'warning') return 'আজ বাড়তি বিদ্যুৎ খুব কম।';
        if (p.inEclipseSeason) return `সুস্থ। ${placeOf(destName)} ছায়া পেরোনোর পর প্রতিবার আবার চার্জ হয়।`;
        return 'পুরো রোদ। আজ প্রচুর বিদ্যুৎ।';
      }
      case 'fuel': {
        const x = g.fuel;
        if (x.status === 'over') return 'পরিকল্পিত বার্নগুলোর জন্য যথেষ্ট জ্বালানি নেই!';
        if (x.status === 'warning') return 'সামনের বার্নগুলোর জন্য যথেষ্ট, তবে হাতে খুব সামান্য বাড়তি।';
        return 'পরিকল্পিত প্রতিটি বার্নের জন্য যথেষ্ট, বাড়তিও আছে।';
      }
      case 'recorder': {
        const r = g.recorder;
        if (r.status === 'over') return 'মেমরি ভরা: নতুন ছবি হারিয়ে যাচ্ছে।';
        if (r.daysToFull !== undefined && r.status === 'warning') return `প্রায় ${days(r.daysToFull)} পরে মেমরি ভরে যাবে। ছবি বাড়ি পাঠাও, নয়তো বিজ্ঞানের কাজ কমাও।`;
        if (r.photosWaiting < 1) return 'সব বাড়ি পৌঁছেছে।';
        return `প্রায় ${f.photos(r.photosWaiting)} ছবি বাড়ি যাওয়ার অপেক্ষায়।`;
      }
      case 'budget': {
        const b = g.budget;
        if (b.status === 'over') return 'বাজেট ছাড়িয়েছে: বাড়তি কল আর মেরামতের খরচ মজুতের চেয়ে বেশি।';
        if (b.status === 'warning') return 'মজুত প্রায় শেষ।';
        return 'বাড়িতে বাড়তি কল আর সমস্যা সারানোর জন্য মজুত।';
      }
    }
  },
  SIGNAL_LINE: { downlink: 'ছবি আর খবর বাড়ির পথে', uplink: 'তোমার আদেশ পথে', blocked: 'সূর্য রেডিও আটকে রেখেছে', none: 'রেডিও চুপ' },
  BLOCKER: {
    deltaV: 'বাড়তি জ্বালানি নেই',
    budget: 'মজুতে যথেষ্ট টাকা নেই',
    scienceDays: 'যথেষ্ট বিজ্ঞানের দিন বাকি নেই',
    power: 'আজ বাড়তি বিদ্যুৎ নেই',
    'one-time': 'এই মিশনে একবার ব্যবহার হয়ে গেছে',
  },
  FAILURE_EFFECT: {
    craft: 'যান হারিয়ে যেতে পারে',
    instrument: 'একটা যন্ত্র ভেঙে যেতে পারে',
    'stored-data': 'রোবটে জমা ছবি মুছে যেতে পারে',
    'safe-mode': 'যান সেফ মোডে চলে যেতে পারে',
  },
  RISK_WORD: ['', 'খুব কম', 'কম', 'মাঝারি', 'বেশি', 'খুব বেশি'],
  OPTION_BLURB: {
    'solar-storm.shelter': 'যন্ত্রগুলো বন্ধ করে অপেক্ষা করো।',
    'solar-storm.keep-observing': 'কাছ থেকে ঝড়টা মাপো। একটা যন্ত্রের ক্ষতি হতে পারে।',
    'cme-shock.safe-mode': 'ধাক্কা না যাওয়া পর্যন্ত কেবল জরুরি জিনিস চালু রাখো।',
    'cme-shock.keep-observing': 'MAVEN-এর মতো মঙ্গলে ধাক্কাটা লাগতে দেখো। একটা যন্ত্রের ক্ষতি হতে পারে।',
    'mars-dust-storm.raise-periapsis': 'একটু জ্বালানি পুড়িয়ে ফুলে ওঠা বাতাসের ওপরে থাকো।',
    'mars-dust-storm.wait-it-out': 'ধুলো না থিতানো পর্যন্ত ছবি তোলা বন্ধ রাখো।',
    'mars-dust-storm.carry-on': 'পরিকল্পনামতো উড়তে থাকো, আর আশা করো বাতাস পাতলাই থাকবে।',
    'debris.hide': 'কক্ষপথের সময় এমনভাবে মেলাও, যাতে গ্রহ তোমাকে আড়াল করে।',
    'debris.edge-on': 'প্যানেলগুলো কিনারা করে ঘোরাও আর যন্ত্রগুলো বন্ধ করো।',
    'debris.ignore': 'কিছু কোরো না, আর আশা করো কিছু লাগবে না।',
    'reaction-wheel.thrusters': 'থ্রাস্টার দিয়ে তাক করো: জ্বালানি খরচ হবে।',
    'reaction-wheel.hybrid': 'বাকি চাকাগুলো দিয়ে তাক করা শেখো।',
    'reaction-wheel.carry-on': 'বাকি চাকাগুলো নিয়েই চালিয়ে যাও।',
    'memory-corruption.backup-computer': 'বাড়তি কম্পিউটারে চলে যাও (মাত্র একবার)।',
    'memory-corruption.patch': 'প্রকৌশলীরা একটা সমাধান লিখে ওপরে পাঠান।',
    'memory-corruption.reboot': 'বন্ধ করে আবার চালু করো।',
    'insertion-anomaly.trim-burn': 'থ্রাস্টার চালিয়ে কক্ষপথে ঢোকা শেষ করো।',
    'insertion-anomaly.accept-orbit': 'লম্বা কক্ষপথটাই রাখো, আর বিজ্ঞানের পরিকল্পনা বদলাও।',
    'insertion-anomaly.hold': 'যানকে নিজের যত্ন নিজেই নিতে দাও।',
    'drag-heating.pop-up': 'এখনই পেরিঅ্যাপসিস তোলো',
    'drag-heating.stay-low': 'নিচে থেকেই ছবিটা শেষ করো',
  },
  EXTENSION_BLOCKER: {
    deltaV: 'কক্ষপথ ঠিক রাখার মতো জ্বালানি নেই',
    power: 'শেষে যথেষ্ট বিদ্যুৎ থাকবে না',
    radiation: 'ইলেকট্রনিকস অনেক বেশি বিকিরণ খাবে',
    attitude: 'যান আর ঠিকমতো তাক করতে পারে না',
    'science-review': 'NASA-র পর্যালোচনা: এখনো যথেষ্ট বিজ্ঞান-তথ্য বাড়ি আসেনি',
  },
  COMMAND_KIND: { observe: 'ছবি তোলো', 'power-plan': 'নতুন বিদ্যুৎ-পরিকল্পনা', respond: 'বিপদের জবাব', 'standing-orders': 'নতুন স্থায়ী আদেশ' },
  eventLine: (e, ctx) => {
    const v = e.values;
    const phase: Record<string, string> = { launch: 'উৎক্ষেপণ', cruise: 'যাত্রাপথ', arrival: 'পৌঁছানো', science: 'বিজ্ঞান-কক্ষপথ', return: 'বাড়ির পথ', extended: 'বাড়তি মিশন' };
    switch (e.code) {
      case 'launch':
        return 'উৎক্ষেপণ! তোমার যান পথে।';
      case 'launch-failed':
        return 'উৎক্ষেপণের দিন রকেট ব্যর্থ হয়েছে।';
      case 'phase-start':
        return `${phase[String(v.phase)] ?? 'নতুন পর্ব'} শুরু।`;
      case 'burn':
        if (v.kind === 'maintenance') return undefined;
        return v.kind === 'station-keeping' ? `ট্রিম বার্ন: ${f.speed(Number(v.dv_ms))}।` : `ইঞ্জিন বার্ন: ${f.speed(Number(v.dv_ms))}।`;
      case 'conjunction-start':
        return 'সৌর সংযোগ: সূর্য সরে না যাওয়া পর্যন্ত রেডিও যোগাযোগ নেই।';
      case 'conjunction-end':
        return 'সৌর সংযোগের পর যোগাযোগ ফিরেছে।';
      case 'eclipse-season-start':
        return `গ্রহণের মৌসুম: প্রতি কক্ষপথে যান ${placeOf(ctx.destName)} ছায়া পেরোয়।`;
      case 'eclipse-season-end':
        return 'গ্রহণের মৌসুম শেষ: আবার পুরো রোদ।';
      case 'hazard-warning':
        return 'সতর্কতা: কিছু একটা তোমার যানের দিকে আসছে।';
      case 'decision-open':
        return v.decisionId === 'extension' ? 'মূল মিশন শেষ: এরপর কী, ঠিক করার সময়।' : 'একটা সিদ্ধান্ত তোমার অপেক্ষায়।';
      case 'command-sent':
        return 'আদেশ পাঠানো হলো: এখন সেটা আলোর গতিতে মহাকাশ পাড়ি দিচ্ছে।';
      case 'command-refused':
        return v.reason === 'conjunction' ? `আদেশ ফেরত: দিন ${f.num(Number(v.retryAfterDay))}-এর আগে যোগাযোগ নেই।` : 'আদেশ ফেরত।';
      case 'command-executed':
        return v.optionId ? `যান পালন করেছে: ${ctx.optionLabel(String(v.hazardId), String(v.optionId))}।` : 'যান তোমার আদেশ পালন করেছে।';
      case 'command-too-late':
        return 'তোমার আদেশ দেরিতে পৌঁছেছে।';
      case 'deadline-missed':
        return v.by === 'standing-order' ? 'সময়মতো আদেশ আসেনি: যান তার স্থায়ী আদেশ মেনেছে।' : 'সময়মতো আদেশ আসেনি: ফল্ট প্রোটেকশন তোমার হয়ে বেছে নিয়েছে।';
      case 'response-outcome':
        return v.bad ? 'গোলমাল হয়ে গেছে।' : 'কাজ হয়েছে।';
      case 'instrument-lost':
        return 'একটা যন্ত্র কাজ করা বন্ধ করেছে।';
      case 'stored-data-lost':
        return `জমা ডেটা হারিয়েছে: ${f.bits(Number(v.bits))}।`;
      case 'safe-mode':
        return `দিন ${f.num(Math.floor(Number(v.until)))} পর্যন্ত সেফ মোড।`;
      case 'load-shed':
        return 'যথেষ্ট বিদ্যুৎ নেই: যান কিছু জিনিস বন্ধ করেছে।';
      case 'brownout':
        return 'ব্রাউনআউট: যানের কম্পিউটার বিদ্যুৎ হারিয়েছে!';
      case 'dsn-booked':
        return `বাড়িতে কল বুক হয়েছে: ${f.num(Number(v.dish))} m ডিশ।`;
      case 'dsn-refused':
        return 'বুকিং ফেরত।';
      case 'craft-lost':
        return 'যোগাযোগ বিচ্ছিন্ন। যান হারিয়ে গেছে।';
      case 'prime-complete':
        return 'মূল মিশন শেষ!';
      case 'extension-decided':
        return Number(v.years) > 0 ? 'মিশন বাড়ানো হলো।' : 'সম্মানের সঙ্গে মিশনের অবসর।';
      case 'mission-complete':
        return 'মিশন শেষ।';
      case 'out-of-propellant':
        return 'পরিকল্পিত বার্নের জন্য জ্বালানি শেষ।';
      case 'wheel-spare-took-over':
        return 'একটা রিঅ্যাকশন হুইল বিকল; বাড়তিটা দায়িত্ব নিয়েছে।';
      default:
        return undefined;
    }
  },
};
