import { defineConfig } from 'vitest/config';

// Reference regression suite (tests/reference-regression; local data, see tests/reference-regression/README.md)
export default defineConfig({
  test: {
    include: ['tests/reference-regression/**/*.test.ts'],
    testTimeout: 600000,
  },
});
