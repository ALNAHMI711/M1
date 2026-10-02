/**
 * Registry consistency: each entry draws in the pane its port declares.
 */

import { describe, it, expect } from 'vitest';
import { indicatorRegistry } from '../../src/index';

describe('indicatorRegistry', () => {
  it('has unique ids', () => {
    const ids = indicatorRegistry.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses the overlay of the port metadata (Pine indicator(overlay = ...))', () => {
    const mismatches = indicatorRegistry
      .filter((e) => e.metadata && e.overlay !== e.metadata.overlay)
      .map((e) => `${e.id}: registry ${e.overlay}, metadata ${e.metadata.overlay}`);
    expect(mismatches).toEqual([]);
  });
});
