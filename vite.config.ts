import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the game from /<repo>/; local dev and tests use /. The workflow sets VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    // Many tests fly whole missions through the engine; with every file running in parallel a 1–2 s test can pass 5 s.
    testTimeout: 20_000,
  },
});
