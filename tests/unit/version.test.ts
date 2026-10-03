/**
 * The exported version is the package version.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { version } from '../../src/index';

describe('version', () => {
  it('equals the package.json version', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
    expect(version).toBe(pkg.version);
  });
});
