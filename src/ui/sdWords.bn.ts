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

export const BN: Partial<Bangla> = {
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
    tile: (name, on, total) => `${name}: ${total}টির ${on}টি`,
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


/** opsWords in Bangla: the console drawers, the gauges and the event feed. */
export const BN_OPS: BanglaOps = {
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
        return `প্রায় ${f.photos(r.photosWaiting)}টি ছবি বাড়ি যাওয়ার অপেক্ষায়।`;
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
