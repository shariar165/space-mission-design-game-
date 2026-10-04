// Cadet mode words: card names, one helper line per screen and the Test Flight sentences.
// Words only: every number on a Cadet screen comes from the engine (cadet.ts) and is formatted by format.ts.
import type { CadetStep, CheckReason, GaugeKey } from '../engine/cadet';
import type { Phase } from '../engine/risk';

export const STEP_TITLE: Record<CadetStep, string> = {
  science: 'Science',
  power: 'Power',
  radio: 'Radio',
  fuel: 'Fuel',
  rocket: 'Rocket',
};

export const STEP_QUESTION: Record<CadetStep, string> = {
  science: 'What will you study?',
  power: 'How will you make power?',
  radio: 'How big a dish?',
  fuel: 'How much fuel?',
  rocket: 'Pick your rocket',
};

/** One short, friendly helper line per step. */
export function stepHelper(step: CadetStep, destName: string): string {
  switch (step) {
    case 'science':
      return 'Instruments are why we fly. More instruments take more photos, but weigh more.';
    case 'power':
      return `Sunlight gets weaker far from the Sun. Nuclear RTGs work anywhere, at a price.`;
    case 'radio':
      return `${destName} is far away. A bigger dish sends more photos home, but it is heavier.`;
    case 'fuel':
      return `Fuel brakes your craft into orbit at ${destName}. Extra fuel is safety, and weight.`;
    case 'rocket':
      return 'A bigger rocket lifts more. Check the scale before you choose.';
  }
}

export const OPTION_NAME: Record<string, string> = {
  // science packages
  snapshot: 'Snapshot camera',
  explorer: 'Camera + spectrometer',
  radar: 'Radar mapper',
  fields: 'Camera + magnetometer',
  maven: 'MAVEN science kit',
  // power
  'solar-lean': 'Small solar wings',
  'solar-balanced': 'Big solar wings',
  rtg: 'Nuclear RTGs',
  // radio
  small: 'Small dish',
  medium: 'Medium dish',
  large: 'Large dish',
  // fuel
  lean: 'Just enough',
  balanced: 'Safe amount',
  roomy: 'Extra tank',
};

/** The tag on a sized card. */
export const OPTION_TAG: Record<string, string> = {
  'solar-lean': 'Lean',
  'solar-balanced': 'Balanced',
  rtg: 'Balanced',
  lean: 'Lean',
  balanced: 'Balanced',
  roomy: 'Roomy',
};

export const GAUGE_LABEL: Record<GaugeKey, string> = {
  weight: 'Weight',
  power: 'Power',
  fuel: 'Fuel',
  photos: 'Photos sent home',
  budget: 'Budget',
};

/** Short gauge names for the phone layout. */
export const GAUGE_SHORT: Record<GaugeKey, string> = { weight: 'Weight', power: 'Power', fuel: 'Fuel', photos: 'Photos', budget: 'Budget' };

export const GAUGE_ICON: Record<GaugeKey, string> = {
  weight: '⚖',
  power: '🔋',
  fuel: '⛽',
  photos: '📷',
  budget: '💰',
};

/** Two-word tag on a card that would turn a gauge red. */
export const RED_TAG: Record<GaugeKey, string> = {
  weight: 'too heavy',
  power: 'too weak',
  fuel: 'too little',
  photos: 'radio jammed',
  budget: 'over budget',
};

export const PHASE_NAME: Record<Phase, string> = {
  launch: 'Launch',
  cruise: 'Cruise',
  arrival: 'Arrival',
  science: 'Science',
  return: 'Trip home',
};

/** One plain sentence per Test Flight finding. */
export function reasonSentence(r: CheckReason, destName: string): string {
  switch (r) {
    case 'too-heavy':
      return 'Too heavy: the rocket cannot lift your craft off Earth.';
    case 'flight-too-long':
      return 'This trip is too long for a direct flight. Pick other dates.';
    case 'no-power':
      return 'The batteries run flat on the way. Add more power.';
    case 'low-power':
      return 'Power is tight. One cloudy day for the panels and things get risky.';
    case 'power-fades':
      return 'Power fades before the science is done. Panels age as you fly.';
    case 'engine-cannot-capture':
      return `This engine cannot brake hard enough to stop at ${destName}.`;
    case 'no-fuel':
      return `Not enough fuel to brake into orbit. The craft flies past ${destName}.`;
    case 'low-fuel':
      return 'Fuel is tight. The braking burn has almost no spare.';
    case 'radio-limited':
      return 'The radio cannot send home every photo. Try a bigger dish.';
  }
}

/** Status words on each gauge (status is always icon + colour + label). */
export const GAUGE_STATUS: Record<GaugeKey, Record<'ok' | 'warning' | 'over', string>> = {
  weight: { ok: 'Light enough', warning: 'Tipping', over: 'Too heavy' },
  power: { ok: 'Charged', warning: 'Tight', over: 'Too weak' },
  fuel: { ok: 'Enough', warning: 'Tight', over: 'Too little' },
  photos: { ok: 'All sent', warning: 'Tight', over: 'Jammed' },
  budget: { ok: 'Under cap', warning: 'Tight', over: 'Over cap' },
};

/** The battery gauge's eclipse-season warning (numbers come from cadetGauges().power.eclipse). */
export const ECLIPSE_WORDS = {
  badge: 'Eclipse season',
  title: 'Shadow seasons',
  warn: 'Your weakest day is in the planet’s shadow: the panels go dark, the battery carries the craft, and the day’s power drops.',
  calm: 'The craft passes through shadow, but its weakest day is a sunny one.',
  none: 'No eclipses on this mission: the panels see the Sun every day.',
};

export const ORDERS_HELPER = 'Signals take minutes to reach your craft, so it cannot wait for you. Tell it now what to do if…';

/** What an option costs, as cadet words (numbers are added by the caller from the engine). */
export const COST_ICON = { fuel: '⛽', budget: '💰', science: '🔭' } as const;
