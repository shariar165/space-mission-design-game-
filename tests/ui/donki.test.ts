// @vitest-environment jsdom
// The Daily's space weather in the browser (src/ui/donki.ts). The game reads only its own static snapshot,
// data/donki-latest.json (written by the DONKI GitHub Action), never CCMC. Anything wrong → offline weather.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSnapshot, realStorms } from '../../src/engine/spaceWeather';
import { loadSpaceWeather, SNAPSHOT_PATH } from '../../src/ui/donki';
import './setup';

const sampleText = readFileSync(join(process.cwd(), 'tests/fixtures/donki/documented-format-sample.json'), 'utf8') // vitest runs from the project root;
const storms = realStorms(readSnapshot(sampleText)!);
// The sample's window ends 2030-01-07, so 2030-01-08 is the day after (fresh).
const TODAY = '2030-01-08';

const respond = (body: string, init: ResponseInit = { status: 200, headers: { 'content-type': 'application/json' } }) =>
  vi.fn(async () => new Response(body, init));

afterEach(() => vi.unstubAllGlobals());

describe('loadSpaceWeather', () => {
  it('a fresh snapshot is live weather: the real storms, and it is cached for the day', async () => {
    const fetch = respond(sampleText);
    vi.stubGlobal('fetch', fetch);
    const w = await loadSpaceWeather(TODAY);
    expect(w.status).toBe('live');
    if (w.status === 'live') expect(w.storms).toEqual(storms);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/${SNAPSHOT_PATH}`);
    expect(SNAPSHOT_PATH).toBe('data/donki-latest.json');
    expect(init.cache).toBe('no-cache');
    expect(JSON.parse(localStorage.getItem('sd.donki')!).date).toBe(TODAY);
  });

  it('the same day again reads the cache and does not fetch, so a later deploy cannot change today’s Daily', async () => {
    vi.stubGlobal('fetch', respond(sampleText));
    await loadSpaceWeather(TODAY);
    const again = vi.fn(async () => {
      throw new Error('must not fetch');
    });
    vi.stubGlobal('fetch', again);
    const w = await loadSpaceWeather(TODAY);
    expect(w.status).toBe('live');
    expect(again).not.toHaveBeenCalled();
  });

  it('a cache from another day is ignored', async () => {
    localStorage.setItem('sd.donki', JSON.stringify({ date: '2030-01-07', text: sampleText }));
    const fetch = respond(sampleText);
    vi.stubGlobal('fetch', fetch);
    await loadSpaceWeather(TODAY);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a missing file (404)', () => respond('Not found', { status: 404 })],
    ['the dev server’s HTML fallback', () => respond('<!doctype html><html><body>Signal Delay</body></html>', { status: 200, headers: { 'content-type': 'text/html' } })],
    ['bad JSON', () => respond('{"fetchedAt": ')],
    ['a network error', () => vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))],
  ])('%s → offline, and nothing is cached', async (_name, make) => {
    vi.stubGlobal('fetch', make());
    expect(await loadSpaceWeather(TODAY)).toEqual({ status: 'offline' });
    expect(localStorage.getItem('sd.donki')).toBeNull();
  });

  it('a stale snapshot (its window ended 3 days ago, over maxAge_days = 2) → offline', async () => {
    vi.stubGlobal('fetch', respond(sampleText));
    expect(await loadSpaceWeather('2030-01-10')).toEqual({ status: 'offline' });
  });

  it('a file that never arrives → offline after the timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))),
    );
    expect(await loadSpaceWeather(TODAY, { timeoutMs: 20 })).toEqual({ status: 'offline' });
  });
});
