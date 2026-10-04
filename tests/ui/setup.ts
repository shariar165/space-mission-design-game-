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
