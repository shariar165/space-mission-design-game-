// The DONKI snapshot script (scripts/fetch-donki.mjs) run by the daily GitHub Action. Only its pure parts are
// tested here; the network calls run on GitHub's runner.
import { describe, expect, it } from 'vitest';
import { buildSnapshot, donkiUrl, parseBody, windowFor } from '../scripts/fetch-donki.mjs';
import spaceWeather from '../src/data/spaceWeather.json';

describe('fetch-donki script', () => {
  it('the window is the seven whole UTC days before today', () => {
    // 2026-10-08 − 7 d = 2026-10-01; − 1 d = 2026-10-07.
    expect(windowFor('2026-10-08')).toEqual({ startDate: '2026-10-01', endDate: '2026-10-07' });
    // Across a month end: 2026-03-03 − 7 d = 2026-02-24 (28-day February).
    expect(windowFor('2026-03-03')).toEqual({ startDate: '2026-02-24', endDate: '2026-03-02' });
    expect(() => windowFor('not a date')).toThrow();
  });

  it('requests the CCMC DONKI-API base from spaceWeather.json, with no API key', () => {
    const url = donkiUrl('FLR', '2024-05-08', '2024-05-14');
    expect(url).toBe('https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=2024-05-08&endDate=2024-05-14');
    expect(url.startsWith(spaceWeather.donki.apiBase.value)).toBe(true);
    expect(url).not.toMatch(/api_key/);
  });

  it('an empty 200 means no events; a web page or an object is an error', () => {
    expect(parseBody('')).toEqual([]);
    expect(parseBody('  \n')).toEqual([]);
    expect(parseBody('[{"flrID":"x"}]')).toEqual([{ flrID: 'x' }]);
    // The old api.nasa.gov URL answers a 301 HTML page: never mistake it for data.
    expect(() => parseBody('<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"><html>')).toThrow();
    expect(() => parseBody('{"error":"rate limited"}')).toThrow();
  });

  it('the snapshot carries its fetch time, window and source URLs', () => {
    const s = buildSnapshot({
      fetchedAt: '2026-10-08T00:20:00.000Z',
      window: { startDate: '2026-10-01', endDate: '2026-10-07' },
      flr: { url: 'f', records: [] },
      cme: { url: 'c', records: [] },
    });
    expect(s.source).toEqual({ base: spaceWeather.donki.apiBase.value, announcement: 'https://ccmc.gsfc.nasa.gov/news/major-updates/' });
    expect(s.window.endDate).toBe('2026-10-07');
  });
});
