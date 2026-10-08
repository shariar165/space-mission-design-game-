// Shared set-up for the component tests (jsdom). Not a test file itself.
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { inlineRunner, setRiskRunner } from '../../src/ui/riskRunner';

// jsdom has no Web Worker: the Risk meter's Monte Carlo runs inline, with fewer runs (each one is still a full
// Mission operations flight through the engine).
export const TEST_RISK_RUNS = 20;
setRiskRunner(inlineRunner(), TEST_RISK_RUNS);

beforeEach(() => {
  // jsdom has no layout: scrolling is a no-op, and every test starts from empty storage.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  localStorage.clear();
  // No network in component tests: the DONKI snapshot cannot be read, so the Daily is offline (tests/ui/donki.test.ts
  // stubs its own responses).
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('no network in tests');
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Unlock the map up to Mars and open the Mars level from Home (Pack with every part). */
export function openMarsLevel(render: () => void, click: (el: Element) => void, getByRole: (role: string, opts: { name: RegExp }) => Element) {
  localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
  render();
  click(getByRole('button', { name: /^CHOOSE A MISSION/ }));
  click(getByRole('button', { name: /^Red Planet/ }));
}
