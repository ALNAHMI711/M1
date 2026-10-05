import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/regression/**', 'tests/reference-regression/**'],
    testTimeout: 30000,
  },
});
