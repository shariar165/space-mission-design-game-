// Shared set-up for the component tests (jsdom). Not a test file itself.
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  // jsdom has no layout: scrolling is a no-op, and every test starts from empty storage.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Unlock the map up to Mars and open the Mars level (all five steps plus standing orders). */
export function openMarsLevel(render: () => void, click: (el: Element) => void, getByRole: (role: string, opts: { name: RegExp }) => Element) {
  localStorage.setItem('mdt.progress', JSON.stringify({ 'moon-1': 1, 'moon-2': 1, 'moon-3': 1 }));
  render();
  click(getByRole('button', { name: /^Red Planet/ }));
}
