// Screenshot harness (not a test suite: vitest runs the tests). `npm run shots` drives the game and the
// Claude Design reference copies at the two design sizes, 1440 × 900 desktop and 390 × 844 phone.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const root = path.dirname(fileURLToPath(import.meta.url));
// Browsers live inside the venv, never in the user profile (CLAUDE.md: everything through .venv).
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(root, '.venv', 'ms-playwright');

const PORT = 5199;

export default defineConfig({
  testDir: 'tests/visual',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 120_000,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
