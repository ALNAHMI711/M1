/**
 * IndicatorRenderer ownership rules on a fake chart (no canvas): a render replaces what the instance drew before,
 * clear() removes everything it created (series and primitives), two instances do not touch each other, the pane of
 * the host is used, force_overlay output goes to pane 0.
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { IndicatorRenderer } from '../../src/render';
import { indicatorRegistry } from '../../src/index';

interface FakeSeries {
  pane: number;
  primitives: Set<unknown>;
  options: Record<string, unknown>;
  data: unknown[];
}

function fakeChart() {
  const series = new Set<FakeSeries>();
  const preserve = new Map<number, boolean>();
  let paneCount = 1;
  const make = (options: Record<string, unknown> = {}, pane = 0) => {
    const s: FakeSeries = { pane, primitives: new Set(), options: { ...options }, data: [] };
    paneCount = Math.max(paneCount, pane + 1);
    series.add(s);
    return {
      _fake: s,
      setData: (d: unknown[]) => { s.data = d; },
      applyOptions: (o: Record<string, unknown>) => Object.assign(s.options, o),
      options: () => s.options,
      attachPrimitive: (p: unknown) => { s.primitives.add(p); },
      detachPrimitive: (p: unknown) => { s.primitives.delete(p); },
      getPane: () => ({ paneIndex: () => s.pane }),
      seriesType: () => 'Line',
      data: () => s.data,
    };
  };
  const pane = (i: number) => ({
    getSeries: () => [...series].filter((s) => s.pane === i),
    preserveEmptyPane: () => preserve.get(i) ?? false,
    setPreserveEmptyPane: (v: boolean) => preserve.set(i, v),
    paneIndex: () => i,
    getHTMLElement: () => null,
  });
  const chart = {
    addSeries: (_def: unknown, options: Record<string, unknown>, paneIndex = 0) => make(options, paneIndex),
    addCustomSeries: (_view: unknown, options: Record<string, unknown>, paneIndex = 0) => make(options, paneIndex),
    removeSeries: (s: { _fake: FakeSeries }) => { series.delete(s._fake); },
    panes: () => Array.from({ length: paneCount }, (_, i) => pane(i)),
    removePane: (i: number) => { if (i === paneCount - 1) paneCount--; },
    timeScale: () => ({}),
    priceScale: () => ({ width: () => 0 }),
  };
  return { chart: chart as never, series, primitives: () => [...series].reduce((n, s) => n + s.primitives.size, 0), panes: () => paneCount };
}

const bars: Bar[] = Array.from({ length: 300 }, (_, i) => {
  const c = 100 + Math.sin(i / 9) * 10 + i * 0.05;
  return { time: 1_600_000_000 + i * 86_400, open: c - 0.5, high: c + 2, low: c - 2, close: c, volume: 1000 + i };
});

const entry = (id: string) => indicatorRegistry.find((e) => e.id === id)!;

describe('IndicatorRenderer', () => {
  it('replaces its drawing on render and removes everything on clear', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
    const rsi = entry('rsi');
    r.render(rsi, rsi.calculate(bars, {}), bars);
    const count = f.series.size;
    const prims = f.primitives();
    expect(count).toBeGreaterThan(0);
    expect(r.series().length).toBe(count);
    expect([...f.series].every((s) => s.pane === 1)).toBe(true);

    r.render(rsi, rsi.calculate(bars, { length: 7 }), bars);
    expect(f.series.size).toBe(count);
    expect(f.primitives()).toBe(prims);

    r.clear();
    expect(f.series.size).toBe(0);
    expect(f.primitives()).toBe(0);
    expect(r.series()).toEqual([]);
    expect(f.panes()).toBe(1);
  });

  it('keeps the series of other instances', () => {
    const f = fakeChart();
    const bb = new IndicatorRenderer(f.chart);
    const rsi = new IndicatorRenderer(f.chart, { paneIndex: 1 });
    bb.render(entry('bb'), entry('bb').calculate(bars, {}), bars);
    rsi.render(entry('rsi'), entry('rsi').calculate(bars, {}), bars);
    const bbSeries = bb.series().length;
    expect(bbSeries).toBeGreaterThan(0);
    expect([...f.series].filter((s) => s.pane === 0).length).toBe(bbSeries);
    rsi.clear();
    expect(f.series.size).toBe(bbSeries);
  });

  it('puts the plot series first, applies plot overrides and keeps autoscale off on request', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart);
    const bb = entry('bb');
    r.render(bb, bb.calculate(bars, {}), bars, {
      autoscale: false,
      lastValueVisible: true,
      plots: { [bb.plotConfig[0].id]: { color: '#123456', lineWidth: 3 } },
    });
    const first = (r.series()[0] as unknown as { _fake: FakeSeries })._fake;
    expect(first.options.color).toBe('#123456');
    expect(first.options.lineWidth).toBe(3);
    expect(first.options.lastValueVisible).toBe(true);
    expect([...f.series].every((s) => typeof s.options.autoscaleInfoProvider === 'function')).toBe(true);
  });

  it('hides a plot with visible: false', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
    const rsi = entry('rsi');
    r.render(rsi, rsi.calculate(bars, {}), bars);
    const all = r.series().length;
    r.render(rsi, rsi.calculate(bars, {}), bars, { plots: { [rsi.plotConfig[0].id]: { visible: false } } });
    expect(r.series().length).toBe(all - 1);
  });
});
