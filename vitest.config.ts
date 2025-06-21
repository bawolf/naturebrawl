import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environment for tests
    environment: 'node',
    // Allow tests to run in sequence for database tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
