import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Sets fake env vars before any test imports the app (config/env.ts validates at startup).
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
  },
});
