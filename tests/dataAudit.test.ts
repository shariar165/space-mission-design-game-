// Enforces spec rule 2 ("every constant and catalogue value carries a source") and regenerates
// TODO_DATA.md, the list of every value flagged isGameEstimate. Run: npm run todo-data
import { readdirSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import crisisCards from '../src/data/crisisCards.json';
import destinations from '../src/data/destinations.json';
import hazards from '../src/data/hazards.json';
import launchVehicles from '../src/data/launchVehicles.json';
import rideshares from '../src/data/rideshares.json';
import lessons from '../src/data/lessons.json';
import missions from '../src/data/missions.json';
import operations from '../src/data/operations.json';
import pack from '../src/data/pack.json';
import notebookData from '../src/data/notebook.json';
import postcards from '../src/data/postcards.json';
import ranks from '../src/data/ranks.json';
import orbitalElements from '../src/data/orbitalElements.json';
import parts from '../src/data/parts.json';
import rescueCases from '../src/data/rescueCases.json';
import spaceWeather from '../src/data/spaceWeather.json';
import { CADET_TIERS, COIN_FRACTION, DISH_SIZES, PHOTO_FRAME_Mbit } from '../src/engine/cadet';
import { DSN_X_BAND_GAIN_DBI, REFERENCE_LINK } from '../src/engine/comms';
import { CONSTANTS } from '../src/engine/constants';
import { LBF_TO_N, RESCUE_MAX_STARS } from '../src/engine/rescue';
import { COST_CAPS } from '../src/engine/massCost';
import { ETA_SYS } from '../src/engine/power';
import { ACCEPTABLE_MISSION_RISK, BASE_RISK, MARGIN_RISK_FACTOR_AT_ZERO } from '../src/engine/risk';
import { BUDGET_ZERO_AT_OVERRUN, MARGIN_BAND, SCORE_GRADES, STAR_RULES, WEIGHTS } from '../src/engine/scoring';
import type { Sourced } from '../src/engine/types';
import { RISK_RUNS, RISK_SEED } from '../src/engine/ops/riskEstimate';
import { CONSOLE_RULES } from '../src/engine/ops/console';
import { FLY_RULES } from '../src/engine/ops/fly';
import { DAILY_RULES } from '../src/engine/daily';
import { VOICE_RULES } from '../src/engine/ops/voice';

interface Entry {
  path: string;
  value: unknown;
  unit: string;
  source: string;
  url?: string;
  isGameEstimate: boolean;
}

const isSourced = (x: unknown): x is Sourced<unknown> =>
  typeof x === 'object' &&
  x !== null &&
  !Array.isArray(x) &&
  'value' in x &&
  typeof (x as Sourced<unknown>).unit === 'string' &&
  typeof (x as Sourced<unknown>).source === 'string' &&
  (x as Sourced<unknown>).source.length > 0 &&
  typeof (x as Sourced<unknown>).isGameEstimate === 'boolean';

/** Walk a JSON tree: collect Sourced leaves, and report any bare number found outside a Sourced object. */
function walk(node: unknown, path: string, entries: Entry[], bare: string[]) {
  if (isSourced(node)) {
    entries.push({ path, value: node.value, unit: node.unit, source: node.source, url: node.url, isGameEstimate: node.isGameEstimate });
    return;
  }
  if (typeof node === 'number') {
    bare.push(path);
    return;
  }
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`, entries, bare));
  else if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, entries, bare);
  }
}

const DATA_FILES: Record<string, unknown> = {
  'crisisCards.json': crisisCards,
  'destinations.json': destinations,
  'hazards.json': hazards,
  'launchVehicles.json': launchVehicles,
  'lessons.json': lessons,
  'missions.json': missions,
  'operations.json': operations,
  'orbitalElements.json': orbitalElements,
  'pack.json': pack,
  'notebook.json': notebookData,
  'postcards.json': postcards,
  'ranks.json': ranks,
  'parts.json': parts,
  'rescueCases.json': rescueCases,
  'rideshares.json': rideshares,
  'spaceWeather.json': spaceWeather,
};

const ENGINE_VALUES: Record<string, Record<string, Sourced<unknown>>> = {
  'constants.ts': CONSTANTS,
  'comms.ts REFERENCE_LINK': REFERENCE_LINK,
  'comms.ts DSN_X_BAND_GAIN_DBI': { '34m': DSN_X_BAND_GAIN_DBI[34], '70m': DSN_X_BAND_GAIN_DBI[70] },
  'massCost.ts COST_CAPS': COST_CAPS,
  'power.ts': { ETA_SYS },
  'risk.ts': { ...BASE_RISK, MARGIN_RISK_FACTOR_AT_ZERO, ACCEPTABLE_MISSION_RISK },
  'scoring.ts WEIGHTS': WEIGHTS,
  'scoring.ts': { ...MARGIN_BAND, BUDGET_ZERO_AT_OVERRUN, ...SCORE_GRADES },
  'cadet.ts CADET_TIERS': CADET_TIERS,
  'cadet.ts DISH_SIZES': DISH_SIZES,
  'cadet.ts': { PHOTO_FRAME_Mbit, COIN_FRACTION },
  'rescue.ts': { LBF_TO_N, RESCUE_MAX_STARS },
  'ops/riskEstimate.ts': { RISK_RUNS, RISK_SEED },
  'ops/console.ts CONSOLE_RULES': CONSOLE_RULES,
  'ops/fly.ts FLY_RULES': FLY_RULES,
  'scoring.ts STAR_RULES': STAR_RULES,
  'daily.ts DAILY_RULES': DAILY_RULES,
  'ops/voice.ts VOICE_RULES': VOICE_RULES,
};

const all: Entry[] = [];

describe('data audit', () => {
  it('every JSON file in src/data is audited (a new file cannot slip past)', () => {
    const onDisk = readdirSync(new URL('../src/data', import.meta.url)).filter((f) => f.endsWith('.json'));
    expect(onDisk.sort()).toEqual(Object.keys(DATA_FILES).sort());
  });

  for (const [file, json] of Object.entries(DATA_FILES)) {
    it(`${file}: every number is inside a Sourced object`, () => {
      const bare: string[] = [];
      walk(json, file, all, bare);
      expect(bare).toEqual([]);
    });
  }

  it('engine constants are all Sourced', () => {
    for (const [where, values] of Object.entries(ENGINE_VALUES)) {
      for (const [k, v] of Object.entries(values)) {
        expect(isSourced(v), `${where}.${k}`).toBe(true);
        all.push({ path: `${where}.${k}`, value: v.value, unit: v.unit, source: v.source, url: v.url, isGameEstimate: v.isGameEstimate });
      }
    }
  });
});

const OPEN_ITEMS = [
  'Export 6–8 payload-vs-C3 points per vehicle (C3 −2 to 40 km²/s²) from the NASA LSP Performance Query (elvperf.ksc.nasa.gov) into launchVehicles.json. The site only works interactively, so this needs a person.',
  'Launch price per vehicle, from NASA Announcement of Opportunity documents (not news articles).',
  'Comms reference link: MRO (DESCANSO Article 12) gives rate, distance, transmitter power and HGA size, but not the ground station for its 500 kbps figure (34 m inferred). Find a published link that names the station.',
  'Replace each engine Isp with a named flight engine and its published Isp.',
  'LRO (Moon, 2009): wet mass, dry mass, lunar orbit insertion Δv, power and data rate from the NASA LRO mission page.',
  'Venus, Moon and Jupiter fact-sheet values were copied on Oct 4, 2026 from Internet Archive copies of the NSSDC fact sheets (Sept. 28 – Oct. 3, 2026), because nssdc.gsfc.nasa.gov refused connections: re-check them against the live site when it is back. Bennu values still come from the JPL Small-Body Database (SBDB gives a = 1.12639 au, period 436.65 d, diameter 0.48444 km, GM 4.8904e-9 km³/s²).',
  'μ☉: confirm on the NASA Sun Fact Sheet.',
  'MMRTG power decay over the mission is not modelled yet (fact sheet gives launch power only).',
  'Crisis cards: check the real-history text on each card against NASA LLIS or the official failure report and put that link on the card.',
  'OSIRIS-REx: solar array area (to use the published 1,226–2,500 W as an independent η_sys check), dry mass, DSM-1 size, flyby day and arrival date.',
  'Part costs: candidate sources are NASA\'s Cost Estimating Handbook and NASA instrument cost models.',
  'Mission operations: check each hazard\'s real-history text (hazards.json) against the NASA mission page or LLIS and replace "to verify".',
  'Mission operations: source the hazard rates (debris, reaction-wheel Weibull, memory upsets), response costs and failure chances; and the Jupiter radiation model against Juno\'s vault design.',
  'Moon pole orientation: the NSSDC Moon fact sheet does not list it; verify the IAU WGCCRE values (Archinal et al. 2018) against a NASA source. Venus and Jupiter poles are now from their fact sheets.',
  'DSN aperture fee: find the current-year base rate (FY09 $1057/h is used, not inflated).',
];

afterAll(() => {
  const est = all.filter((e) => e.isGameEstimate);
  const show = (v: unknown) => {
    const s = JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  };
  const md = [
    '# TODO_DATA — values that are game estimates or still to verify',
    '',
    'Generated by `tests/dataAudit.test.ts` (`npm run todo-data`). Do not edit by hand: change the data and rerun.',
    '',
    `Every value below has \`isGameEstimate: true\` and must show "game estimate" in its ⓘ popover. ${est.length} values in total.`,
    '',
    '| Path | Value | Unit | Current source / what to do |',
    '| --- | --- | --- | --- |',
    ...est.map((e) => `| \`${e.path}\` | ${show(e.value).replace(/\|/g, '\\|')} | ${e.unit} | ${e.source.replace(/\|/g, '\\|')} |`),
    '',
    '## Other open data items',
    '',
    ...OPEN_ITEMS.map((s) => `- ${s}`),
    '',
  ].join('\n');
  writeFileSync(new URL('../TODO_DATA.md', import.meta.url), md, 'utf8');
});
