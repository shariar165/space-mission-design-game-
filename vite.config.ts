import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the game from /<repo>/; local dev and tests use /. The workflow sets VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
  },
});
