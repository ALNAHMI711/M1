/**
 * One slice of the reference regression fixtures (the fixtures are split in PARTS slices so vitest runs them in
 * parallel). Each fixture is one test: every check of every dataset must have at least the accepted number of equal
 * bars. Skipped when tests/reference-regression/data does not exist (the data is local only, see README.md).
 */
import { describe, it, expect } from 'vitest';
import { indicatorRegistry } from '../../src/index';
import { fixtureIds, loadFixture, loadBars, runChecks } from './compare';

export const PARTS = 8;

export function runPart(part: number): void {
  const ids = fixtureIds().filter((_, k) => k % PARTS === part);
  const byId = new Map(indicatorRegistry.map((e) => [e.id, e]));
  describe.skipIf(ids.length === 0)(`Reference regression part ${part + 1}/${PARTS}`, () => {
    it.each(ids)('%s', (id) => {
      const fx = loadFixture(id);
      const entry = byId.get(id);
      expect(entry, `registry entry ${id}`).toBeDefined();
      const worse: string[] = [];
      for (const ds of fx.datasets) {
        const bars = loadBars(ds.bars);
        const result = entry!.calculate(bars as never, { ...(fx.inputs ?? {}) } as never);
        for (const r of runChecks(ds, result, bars)) {
          if (r.equal < r.accepted) worse.push(`${r.dataset} | ${r.check}: equal ${r.equal}, accepted ${r.accepted} (of ${r.total})`);
        }
      }
      expect(worse, `checks with fewer equal bars than accepted (${id})`).toEqual([]);
    });
  });
}
