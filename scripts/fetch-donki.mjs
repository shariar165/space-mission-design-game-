// Fetch NASA DONKI solar flares (FLR), CMEs and solar energetic particle events (SEP) from CCMC and save them for
// the game (spec: UI rules, live Daily).
// The game never calls CCMC: this script runs in the daily GitHub Action (.github/workflows/donki.yml) and writes a
// static snapshot, public/data/donki-latest.json, that the game reads from its own origin.
//
//   node scripts/fetch-donki.mjs                                  latest snapshot (the 7 whole UTC days before today)
//   node scripts/fetch-donki.mjs --today 2026-10-08               the same, as if today were that date
//   node scripts/fetch-donki.mjs --fixtures 2024-05-08 2024-05-14 raw responses into tests/fixtures/donki/
//
// On any failure (network, non-200, a body that is not a JSON array) it exits 1 and writes nothing, so the last
// snapshot stays and ages until the game calls it stale.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETTINGS = JSON.parse(readFileSync(join(ROOT, 'src/data/spaceWeather.json'), 'utf8')).donki;
const KINDS = /** @type {const} */ (['FLR', 'CME', 'SEP']);
const DAY_MS = 86_400_000;
const REQUEST_TIMEOUT_MS = 60_000;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The snapshot window for a UTC date: the `windowDays` whole days before it. */
export function windowFor(todayIso, days = SETTINGS.windowDays.value) {
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(today)) throw new Error(`Invalid date: ${todayIso}`);
  return { startDate: isoDay(today - days * DAY_MS), endDate: isoDay(today - DAY_MS) };
}

/** The DONKI request URL for one record type and window. */
export function donkiUrl(kind, startDate, endDate, base = SETTINGS.apiBase.value) {
  return `${base}${kind}?startDate=${startDate}&endDate=${endDate}`;
}

/** A DONKI body as records. DONKI answers an empty 200 when nothing happened; anything but a JSON array throws. */
export function parseBody(body) {
  if (body.trim() === '') return [];
  const json = JSON.parse(body);
  if (!Array.isArray(json)) throw new Error('DONKI response is not a JSON array');
  return json;
}

/** The snapshot the game reads. */
export function buildSnapshot({ fetchedAt, window, flr, cme, sep }) {
  return {
    fetchedAt,
    source: { base: SETTINGS.apiBase.value, announcement: SETTINGS.apiBase.url },
    window,
    flr,
    cme,
    sep,
  };
}

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { accept: 'application/json' } });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`${url} → HTTP ${res.status}`);
  return { status: res.status, body, records: parseBody(body) };
}

async function latest(todayIso) {
  const window = windowFor(todayIso);
  const out = {};
  for (const kind of KINDS) {
    const url = donkiUrl(kind, window.startDate, window.endDate);
    const { records } = await get(url);
    out[kind.toLowerCase()] = { url, records };
    console.log(`${kind} ${window.startDate} → ${window.endDate}: ${records.length} records`);
  }
  const snapshot = buildSnapshot({ fetchedAt: new Date().toISOString(), window, flr: out.flr, cme: out.cme, sep: out.sep });
  const file = join(ROOT, 'public/data/donki-latest.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`wrote ${file}`);
}

async function fixtures(startDate, endDate) {
  const dir = join(ROOT, 'tests/fixtures/donki');
  const got = [];
  for (const kind of KINDS) {
    const url = donkiUrl(kind, startDate, endDate);
    const r = await get(url);
    got.push({ file: `${kind.toLowerCase()}-${startDate}_${endDate}.json`, url, status: r.status, body: r.body, records: r.records.length });
  }
  mkdirSync(dir, { recursive: true });
  const fetchedAt = new Date().toISOString();
  for (const g of got) writeFileSync(join(dir, g.file), g.body);
  const index = join(dir, 'recorded.json');
  let recorded = {};
  try {
    recorded = JSON.parse(readFileSync(index, 'utf8'));
  } catch {
    /* first recording */
  }
  for (const g of got) recorded[g.file] = { url: g.url, status: g.status, fetchedAt, records: g.records };
  writeFileSync(index, `${JSON.stringify(recorded, null, 2)}\n`);
  for (const g of got) console.log(`recorded ${g.file}: ${g.records} records`);
}

async function main(argv) {
  const at = (flag) => argv.indexOf(flag);
  if (at('--fixtures') >= 0) {
    const [startDate, endDate] = argv.slice(at('--fixtures') + 1);
    if (!startDate || !endDate) throw new Error('usage: --fixtures <startDate> <endDate>');
    return fixtures(startDate, endDate);
  }
  const today = at('--today') >= 0 ? argv[at('--today') + 1] : isoDay(Date.now());
  if (!today) throw new Error('usage: --today <YYYY-MM-DD>');
  return latest(today);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`fetch-donki failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
