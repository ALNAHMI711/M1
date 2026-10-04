import { defineConfig } from 'vitest/config';

// TradingView regression suite (tests/tv-regression; local data, see tests/tv-regression/README.md)
export default defineConfig({
  test: {
    include: ['tests/tv-regression/**/*.test.ts'],
    testTimeout: 600000,
  },
});
